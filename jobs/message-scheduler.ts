import { randomUUID } from 'crypto'

import axios from 'axios'
import cron from 'node-cron'
import type { Bindings, Logger } from 'pino'
import {
	PrismaClient,
	Prisma,
	Contact,
	MetaAccount,
	SequenceStep,
	Template,
} from '@prisma/client'

import { logger, toError } from '../src/lib/logger'
import { resolveChatwootCredentials } from '../src/lib/chatwoot'

const prisma = new PrismaClient()
const jobLogger = logger.child({ module: 'message-scheduler' })
const SCHEDULER_SCHEDULE = '* * * * *'

type SchedulerTask =
	| 'scheduler.init'
	| 'scheduler.tick'
	| 'subscription.process'
	| 'message.dispatch'
	| 'schedule.next-step'
	| 'sequence.complete'
	| 'chatwoot.offer-lookup'

const createTaskLogger = (
	baseLogger: Logger,
	task: SchedulerTask,
	extraBindings: Bindings = {}
) => baseLogger.child({ task, ...extraBindings })

const formatContactName = (contact: Pick<Contact, 'firstName' | 'lastName'>) => {
	const name = `${contact.firstName || ''} ${contact.lastName || ''}`.trim()
	return name.length > 0 ? name : undefined
}

const buildContactBindings = (contact: Contact) => ({
	contactId: contact.id,
	contactPhone: contact.phoneNumber,
	contactName: formatContactName(contact),
})

const buildMetaAccountBindings = (metaAccount: MetaAccount) => ({
	metaAccountId: metaAccount.id,
	metaAccountName: metaAccount.displayName || metaAccount.wabaName,
})

const buildSubscriptionBindings = (subscription: SubscriptionWithRelations) => ({
	subscriptionId: subscription.id,
	sequenceId: subscription.sequence.id,
	sequenceName: subscription.sequence.name,
	...buildMetaAccountBindings(subscription.sequence.metaAccount),
	...buildContactBindings(subscription.contact),
})

const META_API_VERSION = 'v18.0'
const META_API_BASE_URL = `https://graph.facebook.com/${META_API_VERSION}`
const CHATWOOT_BASE_URL = process.env.CHATWOOT_BASE_URL || 'https://cw.i3c.uk'

type SubscriptionWithRelations = Prisma.SequenceSubscriptionGetPayload<{
	include: {
		contact: true
		sequence: {
			include: {
				steps: {
					orderBy: [{ stepOrder: 'asc' }, { subOrder: 'asc' }]
				}
				metaAccount: true
			}
		}
	}
}>

type TemplateMessageResult = {
	success: boolean
	error?: string
	data?: unknown
	messageId?: string | null
}

createTaskLogger(jobLogger, 'scheduler.init', {
	schedule: SCHEDULER_SCHEDULE,
}).info('Message scheduler initialized and awaiting first tick')

cron.schedule(SCHEDULER_SCHEDULE, async () => {
	const runLogger = createTaskLogger(jobLogger, 'scheduler.tick', {
		runId: randomUUID(),
		runStartedAt: new Date().toISOString(),
		operation: 'scheduler.tick.start',
	})
	runLogger.info('Message scheduler tick started')

	try {
		const processedCount = await processScheduledMessages(runLogger)
		runLogger.info(
			{
				operation: 'scheduler.tick.finish',
				processedCount,
			},
			'Message scheduler tick finished'
		)
	} catch (error) {
		runLogger.error({ err: toError(error) }, 'Scheduler error')
	}
})

async function processScheduledMessages(runLogger: Logger) {
	const subscriptions: SubscriptionWithRelations[] =
		await prisma.sequenceSubscription.findMany({
			where: {
				status: 'ACTIVE',
				nextScheduledAt: {
					lte: new Date(),
				},
			},
			include: {
				contact: true,
				sequence: {
					include: {
						steps: {
							orderBy: [{ stepOrder: 'asc' }, { subOrder: 'asc' }],
						},
						metaAccount: true,
					},
				},
			},
		})

	if (subscriptions.length === 0) {
		runLogger.debug(
			{ operation: 'subscriptions.idle' },
			'No subscriptions ready for processing this tick'
		)
		return 0
	}

	runLogger.info(
		{ count: subscriptions.length, operation: 'subscriptions.found' },
		'Located subscriptions ready to process'
	)

	let processedCount = 0
	for (const subscription of subscriptions) {
		const subscriptionLogger = createTaskLogger(
			runLogger,
			'subscription.process',
			{
				operation: 'subscription.process',
				...buildSubscriptionBindings(subscription),
			}
		)

		subscriptionLogger.info(
			{
				currentStep: subscription.currentStep,
				currentSubStep: subscription.currentSubStep,
			},
			'Processing subscription'
		)

		try {
			await processSubscription(subscription, subscriptionLogger)
			processedCount += 1
		} catch (error) {
			subscriptionLogger.error(
				{ err: toError(error) },
				'Error processing subscription'
			)
		}
	}

	return processedCount
}

async function processSubscription(
	subscription: SubscriptionWithRelations,
	subscriptionLogger: Logger
) {
	const { contact, sequence } = subscription
	const steps = sequence.steps
	let currentIndex = steps.findIndex(
		(s) =>
			s.stepOrder === subscription.currentStep &&
			s.subOrder === subscription.currentSubStep
	)

	if (currentIndex === -1) {
		subscriptionLogger.warn(
			{ operation: 'subscription.no-step' },
			'No step found for subscription; marking as completed'
		)
		await prisma.sequenceSubscription.update({
			where: { id: subscription.id },
			data: {
				status: 'COMPLETED',
				completedAt: new Date(),
			},
		})
		return
	}

	while (currentIndex < steps.length) {
		const step = steps[currentIndex]
		const burstEntries = getBurstEntries(step)

		for (const [entryIndex, entry] of burstEntries.entries()) {
			const messageLogger = createTaskLogger(
				subscriptionLogger,
				'message.dispatch',
				{
					operation: 'message.send',
					stepOrder: step.stepOrder,
					subStep: step.subOrder,
					burstIndex: entryIndex + 1,
					templateId: entry.templateId,
					templateName: entry.templateName,
				}
			)
			messageLogger.info('Sending sequence step message')

			const result = await sendTemplateMessage(
				sequence.metaAccount,
				contact,
				step,
				{
					templateId: entry.templateId,
					variableValues: entry.variableValues,
				}
			)

			if (!result.success) {
				messageLogger.error(
					{ error: result.error },
					'Failed to send template message'
				)

				await prisma.sentMessage.create({
					data: {
						contactId: contact.id,
						subscriptionId: subscription.id,
						templateId: entry.templateId,
						status: 'FAILED',
						failedAt: new Date(),
						errorMessage: result.error,
					},
				})
				return
			}

			const metaMessageId =
				typeof result.messageId === 'number'
					? String(result.messageId)
					: result.messageId || null

			messageLogger.info(
				{
					operation: 'message.sent',
					metaMessageId,
					status: 'SENT',
				},
				'Template message sent successfully'
			)

			await prisma.sentMessage.create({
				data: {
					contactId: contact.id,
					subscriptionId: subscription.id,
					templateId: entry.templateId,
					metaMessageId,
					status: 'SENT',
					sentAt: new Date(),
				},
			})
		}

		currentIndex += 1
		const nextStep = steps[currentIndex]

		if (!nextStep) {
			await prisma.sequenceSubscription.update({
				where: { id: subscription.id },
				data: {
					status: 'COMPLETED',
					completedAt: new Date(),
					lastMessageSentAt: new Date(),
				},
			})
			createTaskLogger(subscriptionLogger, 'sequence.complete', {
				operation: 'subscription.complete',
			}).info('Sequence completed for subscription')
			return
		}

		if (nextStep.delayValue > 0) {
			const nextScheduledAt = calculateNextScheduledAt(nextStep)
			await prisma.sequenceSubscription.update({
				where: { id: subscription.id },
				data: {
					currentStep: nextStep.stepOrder,
					currentSubStep: nextStep.subOrder,
					currentNodeId: nextStep.nodeId,
					lastMessageSentAt: new Date(),
					nextScheduledAt,
				},
			})

			createTaskLogger(subscriptionLogger, 'schedule.next-step', {
				nextStep: nextStep.stepOrder,
				nextSubStep: nextStep.subOrder,
				scheduledAt: nextScheduledAt.toISOString(),
				operation: 'subscription.schedule',
			}).info('Scheduled next step')
			return
		}

		await prisma.sequenceSubscription.update({
			where: { id: subscription.id },
			data: {
				currentStep: nextStep.stepOrder,
				currentSubStep: nextStep.subOrder,
				currentNodeId: nextStep.nodeId,
				lastMessageSentAt: new Date(),
				nextScheduledAt: new Date(),
			},
		})
	}
}

type BurstEntry = {
	templateId: string
	templateName?: string
	variableValues?: Record<string, string>
}

function getBurstEntries(step: SequenceStep): BurstEntry[] {
	const raw = step.burstTemplates as Prisma.JsonValue | null

	if (Array.isArray(raw) && raw.length > 0) {
		const burstEntries: BurstEntry[] = []

		for (const entry of raw) {
			if (typeof entry !== 'object' || entry === null) continue
			const typed = entry as Record<string, unknown>
			if (typeof typed.templateId !== 'string') continue

			burstEntries.push({
				templateId: typed.templateId,
				templateName:
					typeof typed.templateName === 'string' ? typed.templateName : undefined,
				variableValues:
					typeof typed.variableValues === 'object' && typed.variableValues !== null
						? (typed.variableValues as Record<string, string>)
						: undefined,
			})
		}

		if (burstEntries.length > 0) {
			return burstEntries
		}
	}

	return [
		{
			templateId: step.templateId,
			variableValues: (step.variableValues as Record<string, string> | null) || {},
		},
	]
}

function calculateNextScheduledAt(step: SequenceStep) {
	const now = Date.now()
	const value = step.delayValue ?? 0
	const unit = step.delayUnit

	if (value <= 0) {
		return new Date(now)
	}

	if (unit === 'MINUTES') {
		return new Date(now + value * 60 * 1000)
	}
	if (unit === 'HOURS') {
		return new Date(now + value * 60 * 60 * 1000)
	}
	if (unit === 'DAYS') {
		return new Date(now + value * 24 * 60 * 60 * 1000)
	}

	return new Date(now)
}

async function sendTemplateMessage(
	metaAccount: MetaAccount,
	contact: Contact,
	step: SequenceStep,
	options?: { templateId?: string; variableValues?: Record<string, string> }
): Promise<TemplateMessageResult> {
	try {
		const templateId = options?.templateId ?? step.templateId
		if (!templateId) {
			return { success: false, error: 'Template not specified' }
		}

		const template = await prisma.template.findUnique({
			where: { id: templateId },
		})

		if (!template) {
			return { success: false, error: 'Template not found' }
		}

		const variableValuesOverride = options?.variableValues
		const activeVariableValues =
			variableValuesOverride ||
			(step.variableValues as Record<string, string> | null) ||
			{}

		const requiresOfferLookup = variableValuesRequireOffer(activeVariableValues)
		let contactWithOffer = contact

		if (requiresOfferLookup) {
			const ensuredOffer = await ensureOfferValue(metaAccount, contact)
			if (!ensuredOffer) {
				return {
					success: false,
					error: `Offer is required for template "${template.name}" but could not be resolved for contact ${contact.firstName} ${contact.lastName} (${contact.phoneNumber})`,
				}
			}
			contactWithOffer = { ...contact, offer: ensuredOffer }
		}

		const { parameters, processedBodyParams } = buildTemplateParameters(
			template,
			step,
			contactWithOffer,
			variableValuesOverride
		)

		if (shouldUseChatwoot(metaAccount, contactWithOffer)) {
			return await sendChatwootTemplateMessage({
				metaAccount,
				contact: contactWithOffer,
				template,
				processedBodyParams,
			})
		}

		return await sendMetaTemplateMessage({
			metaAccount,
			contact: contactWithOffer,
			template,
			parameters,
		})
	} catch (error) {
		if (axios.isAxiosError(error)) {
			return {
				success: false,
				error: error.response?.data?.error?.message || error.message,
			}
		}

		return {
			success: false,
			error: toError(error).message,
		}
	}
}

function buildTemplateParameters(
	template: Template,
	step: SequenceStep,
	contact: Contact,
	variableValuesOverride?: Record<string, string>
) {
	const parameters: Array<{ type: 'text'; text: string }> = []
	const processedBodyParams: Record<string, string> = {}
	const variableValues =
		variableValuesOverride ||
		(step.variableValues as Record<string, string> | null) ||
		{}
	const matches = template.bodyText.match(/\{\{\d+\}\}/g) || []

	for (const match of matches) {
		const varNum = match.replace(/\{|\}/g, '')
		let value = variableValues[varNum]

		if (value === '{firstName}') value = contact.firstName
		if (value === '{lastName}') value = contact.lastName
		if (value === '{phoneNumber}') value = contact.phoneNumber
		if (value === '{offer}') value = contact.offer || ''

		const resolved = value || 'N/A'

		parameters.push({
			type: 'text',
			text: resolved,
		})

		processedBodyParams[varNum] = resolved
	}

	return { parameters, processedBodyParams }
}

function variableValuesRequireOffer(
	variableValues?: Record<string, string> | null
) {
	if (!variableValues) return false
	return Object.values(variableValues).some(
		(value) => typeof value === 'string' && value.trim() === '{offer}'
	)
}

async function ensureOfferValue(metaAccount: MetaAccount, contact: Contact) {
	const existingOffer = contact.offer?.trim()
	if (existingOffer) {
		return existingOffer
	}

	const fetchedOffer = await fetchOfferFromChatwoot(metaAccount, contact)
	if (fetchedOffer) {
		const normalized = fetchedOffer.trim()
		await prisma.contact.update({
			where: { id: contact.id },
			data: { offer: normalized },
		})
		return normalized
	}

	return null
}

async function fetchOfferFromChatwoot(
	metaAccount: MetaAccount,
	contact: Contact
) {
	if (!contact.chatwootContactId && !contact.chatwootConversationId) {
		return null
	}

	const chatwootCredentials = resolveChatwootCredentials(metaAccount)
	if (!chatwootCredentials) {
		return null
	}

	const headers = {
		'Content-Type': 'application/json',
		'Api-Access-Token': chatwootCredentials.apiAccessToken,
	}
	const accountId = chatwootCredentials.accountId

	const lookupLogger = createTaskLogger(jobLogger, 'chatwoot.offer-lookup', {
		operation: 'chatwoot.offer-lookup',
		...buildContactBindings(contact),
		chatwootContactId: contact.chatwootContactId,
		chatwootConversationId: contact.chatwootConversationId,
		chatwootAccountId: accountId,
		...buildMetaAccountBindings(metaAccount),
	})

	const endpoints: Array<{ label: string; url: string }> = []

	if (contact.chatwootContactId) {
		endpoints.push({
			label: 'contact',
			url: `${CHATWOOT_BASE_URL}/api/v1/accounts/${accountId}/contacts/${contact.chatwootContactId}`,
		})
	}

	if (contact.chatwootConversationId) {
		endpoints.push({
			label: 'conversation',
			url: `${CHATWOOT_BASE_URL}/api/v1/accounts/${accountId}/conversations/${contact.chatwootConversationId}`,
		})
	}

	for (const endpoint of endpoints) {
		try {
			const response = await axios.get(endpoint.url, { headers })
			const offer = extractOfferFromChatwootPayload(response.data)
			if (offer) {
				lookupLogger.info(
					{ endpoint: endpoint.label, operation: 'chatwoot.offer-match' },
					'Resolved offer value from Chatwoot'
				)
				return offer
			}
		} catch (error) {
			lookupLogger.warn(
				{
					endpoint: endpoint.label,
					url: endpoint.url,
					err: toError(error),
					operation: 'chatwoot.offer-fetch-failed',
				},
				'Failed to fetch offer from Chatwoot endpoint'
			)
		}
	}

	return null
}

function extractOfferFromChatwootPayload(payload: unknown): string | null {
	return findOfferInValue(payload, 0)
}

function findOfferInValue(value: unknown, depth: number): string | null {
	if (depth > 6 || value === null || value === undefined) {
		return null
	}

	if (typeof value === 'string') {
		const trimmed = value.trim()
		return trimmed.length > 0 ? trimmed : null
	}

	if (Array.isArray(value)) {
		for (const item of value) {
			const result = findOfferInValue(item, depth + 1)
			if (result) return result
		}
		return null
	}

	if (typeof value !== 'object') {
		return null
	}

	const obj = value as Record<string, unknown>

	for (const key of Object.keys(obj)) {
		const normalizedKey = key.toLowerCase()
		if (normalizedKey.includes('offer')) {
			const candidate = obj[key]
			if (
				typeof candidate === 'string' ||
				typeof candidate === 'number' ||
				typeof candidate === 'boolean'
			) {
				const normalized = String(candidate).trim()
				if (normalized.length > 0) return normalized
			}
			const result = findOfferInValue(candidate, depth + 1)
			if (result) return result
		}
	}

	for (const key of Object.keys(obj)) {
		const nestedValue = obj[key]
		if (typeof nestedValue === 'object' && nestedValue !== null) {
			const nestedResult = findOfferInValue(nestedValue, depth + 1)
			if (nestedResult) return nestedResult
		}
	}

	return null
}

function shouldUseChatwoot(metaAccount: MetaAccount, contact: Contact) {
	const credentials = resolveChatwootCredentials(metaAccount)
	return Boolean(credentials && contact.chatwootConversationId)
}

async function sendMetaTemplateMessage({
	metaAccount,
	contact,
	template,
	parameters,
}: {
	metaAccount: MetaAccount
	contact: Contact
	template: Template
	parameters: Array<{ type: 'text'; text: string }>
}): Promise<TemplateMessageResult> {
	const payload = {
		messaging_product: 'whatsapp',
		to: contact.phoneNumber.replace(/[^\d]/g, ''),
		type: 'template',
		template: {
			name: template.metaTemplateName,
			language: {
				code: template.language,
			},
			...(parameters.length > 0 && {
				components: [
					{
						type: 'body',
						parameters,
					},
				],
			}),
		},
	}

	const response = await axios.post(
		`${META_API_BASE_URL}/${metaAccount.phoneNumberId}/messages`,
		payload,
		{
			headers: {
				Authorization: `Bearer ${metaAccount.accessToken}`,
				'Content-Type': 'application/json',
			},
		}
	)

	return {
		success: true,
		data: response.data,
		messageId: response.data?.messages?.[0]?.id || null,
	}
}

async function sendChatwootTemplateMessage({
	metaAccount,
	contact,
	template,
	processedBodyParams,
}: {
	metaAccount: MetaAccount
	contact: Contact
	template: Template
	processedBodyParams: Record<string, string>
}): Promise<TemplateMessageResult> {
	const chatwootCredentials = resolveChatwootCredentials(metaAccount)
	if (!chatwootCredentials) {
		return {
			success: false,
			error: 'Chatwoot credentials are not configured',
		}
	}

	if (!contact.chatwootConversationId) {
		return {
			success: false,
			error: 'Chatwoot conversation is not linked to this contact',
		}
	}

	try {
		const processedParams =
			Object.keys(processedBodyParams).length > 0
				? { body: processedBodyParams }
				: { body: {} }

		const payload = {
			content: `Triggered template ${template.metaTemplateName}`,
			message_type: 'outgoing',
			template_params: {
				name: template.metaTemplateName,
				category: template.category,
				language: template.language,
				processed_params: processedParams,
			},
		}

		const response = await axios.post(
			`${CHATWOOT_BASE_URL}/api/v1/accounts/${chatwootCredentials.accountId}/conversations/${contact.chatwootConversationId}/messages`,
			payload,
			{
				headers: {
					'Content-Type': 'application/json',
					'Api-Access-Token': chatwootCredentials.apiAccessToken,
				},
			}
		)

		return {
			success: true,
			data: response.data,
			messageId: response.data?.id || null,
		}
	} catch (error) {
		if (axios.isAxiosError(error)) {
			return {
				success: false,
				error: error.response?.data?.error || error.message,
			}
		}

		return { success: false, error: toError(error).message }
	}
}
