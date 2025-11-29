import axios from 'axios'
import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import { logger, toError } from '@/lib/logger'
import { parsePhoneNumber } from '@/lib/utils'
import { resolveChatwootCredentials } from '@/lib/chatwoot'

const CHATWOOT_BASE_URL = process.env.CHATWOOT_BASE_URL || 'https://cw.i3c.uk'
const PAGE_SIZE = 100

const log = logger.child({ route: 'contacts/sync-chatwoot' })

type SyncResult = {
	created: number
	updated: number
	skipped: number
}

type ChatwootContactInbox = {
	id?: string | number | null
	inbox_id?: string | number | null
	source_id?: string | null
	conversation_id?: string | number | null
	[key: string]: unknown
} | null

type ChatwootContact = {
	id?: string | number | null
	name?: string | null
	email?: string | null
	identifier?: string | null
	phone_number?: string | null
	custom_attributes?: Record<string, unknown> | null
	additional_attributes?: Record<string, unknown> | null
	contact_inboxes?: ChatwootContactInbox[] | null
	last_conversation_id?: string | number | null
	[key: string]: unknown
}

type UpsertResult = 'created' | 'updated' | 'skipped'

type ChatwootFieldPayload = Partial<{
	chatwootContactId: string
	chatwootInboxId: string
	chatwootSourceId: string
	chatwootConversationId: string
	chatwootContactInboxId: string
}>

type ChatwootSyncSource = {
	metaAccountId: string
	displayName: string
	phoneNumber: string
	accountId: string
	apiAccessToken: string
}

export async function POST(request: Request) {
	const rawBody = await request.text()
	let parsedBody: Record<string, unknown> | null = null

	if (rawBody && rawBody.trim().length > 0) {
		try {
			parsedBody = JSON.parse(rawBody)
		} catch {
			return NextResponse.json(
				{ error: 'Invalid JSON body' },
				{ status: 400 }
			)
		}
	}

	const targetContactId =
		typeof parsedBody?.contactId === 'string'
			? parsedBody.contactId
			: parsedBody?.contactId
			? String(parsedBody.contactId)
			: null

	if (targetContactId) {
		return syncSingleContact(targetContactId)
	}

	try {
		const metaAccounts = await prisma.metaAccount.findMany({
			where: {
				isActive: true,
				chatwootAccountId: { not: null },
				chatwootApiAccessToken: { not: null },
			},
			orderBy: { createdAt: 'asc' },
		})

		const sources: ChatwootSyncSource[] = []

		for (const account of metaAccounts) {
			const credentials = resolveChatwootCredentials(account, { allowEnvFallback: false })
			if (!credentials) continue

			sources.push({
				metaAccountId: account.id,
				displayName: account.displayName,
				phoneNumber: account.phoneNumber,
				accountId: credentials.accountId,
				apiAccessToken: credentials.apiAccessToken,
			})
		}

		if (sources.length === 0) {
			const fallback = resolveChatwootCredentials(undefined, { allowEnvFallback: true })
			if (fallback) {
				sources.push({
					metaAccountId: 'chatwoot-env-default',
					displayName: fallback.label || 'Chatwoot Account',
					phoneNumber: fallback.phoneNumber || 'N/A',
					accountId: fallback.accountId,
					apiAccessToken: fallback.apiAccessToken,
				})
			}
		}

		if (sources.length === 0) {
			return NextResponse.json(
				{
					error:
						'No Chatwoot credentials configured. Add them to a Meta account or set CHATWOOT_ACCOUNT_ID and CHATWOOT_API_ACCESS_TOKEN.',
				},
				{ status: 400 }
			)
		}

		const summary: Array<{
			metaAccountId: string
			displayName: string
			phoneNumber: string
			status: 'success' | 'error'
			created?: number
			updated?: number
			skipped?: number
			error?: string
		}> = []

		for (const source of sources) {
			try {
				const result = await syncChatwootContactsForAccount(source)
				summary.push({
					metaAccountId: source.metaAccountId,
					displayName: source.displayName,
					phoneNumber: source.phoneNumber,
					status: 'success',
					...result,
				})
			} catch (error) {
				const err = toError(error)
				log.error({ err, metaAccountId: source.metaAccountId }, 'Chatwoot contact sync failed')
				summary.push({
					metaAccountId: source.metaAccountId,
					displayName: source.displayName,
					phoneNumber: source.phoneNumber,
					status: 'error',
					error: err.message,
				})
			}
		}

		const hasSuccess = summary.some((entry) => entry.status === 'success')

		return NextResponse.json(
			{
				success: hasSuccess,
				summary,
			},
			{ status: hasSuccess ? 200 : 500 }
		)
	} catch (error) {
		const err = toError(error)
		log.error({ err }, 'Unexpected Chatwoot contact sync error')
		return NextResponse.json(
			{ error: err.message || 'Failed to sync contacts from Chatwoot' },
			{ status: 500 }
		)
	}
}

async function syncChatwootContactsForAccount(source: ChatwootSyncSource): Promise<SyncResult> {
	const { accountId, apiAccessToken } = source
	const headers = {
		'Api-Access-Token': apiAccessToken,
		'Content-Type': 'application/json',
	}

	const result: SyncResult = {
		created: 0,
		updated: 0,
		skipped: 0,
	}

	let page = 1
	while (true) {
		const response = await axios.get(
			`${CHATWOOT_BASE_URL}/api/v1/accounts/${accountId}/contacts`,
			{
				headers,
				params: { page, per_page: PAGE_SIZE },
			}
		)

		const contacts = extractContactsArray(response.data)
		if (contacts.length === 0) {
			break
		}

		for (const remoteContact of contacts) {
			const outcome = await upsertChatwootContact(remoteContact)
			if (outcome === 'created') result.created += 1
			else if (outcome === 'updated') result.updated += 1
			else result.skipped += 1
		}

		if (contacts.length < PAGE_SIZE) {
			break
		}

		page += 1
	}

	return result
}

async function upsertChatwootContact(remoteContact: ChatwootContact): Promise<UpsertResult> {
	const phoneNumber = resolvePhoneNumber(remoteContact)

	if (!phoneNumber) {
		return 'skipped'
	}

	const displayName =
		remoteContact.name ||
		getAttributeValue(remoteContact.custom_attributes, 'name') ||
		getAttributeValue(remoteContact.additional_attributes, 'name') ||
		remoteContact.identifier ||
		remoteContact.email ||
		phoneNumber

	const { firstName, lastName } = splitContactName(displayName)
	const offer = extractOfferFromChatwootPayload(remoteContact)
	const chatwootFields = buildChatwootFieldPayload(remoteContact)

	const existing = await prisma.contact.findUnique({
		where: { phoneNumber },
	})

	if (existing) {
		const updateData: Prisma.ContactUpdateInput = {
			firstName,
			lastName,
			...chatwootFields,
		}

		if (offer) {
			updateData.offer = offer
		}

		await prisma.contact.update({
			where: { id: existing.id },
			data: updateData,
		})

		return 'updated'
	}

	await prisma.contact.create({
		data: {
			phoneNumber,
			firstName,
			lastName,
			offer: offer ?? null,
			...chatwootFields,
		},
	})

	return 'created'
}

function extractContactsArray(payload: unknown): ChatwootContact[] {
	if (!payload) return []
	if (Array.isArray(payload)) return payload as ChatwootContact[]

	const candidates = [
		(payload as Record<string, unknown>)?.payload,
		(payload as Record<string, unknown>)?.data,
		(payload as Record<string, unknown>)?.contacts,
	]

	for (const candidate of candidates) {
		if (Array.isArray(candidate)) {
			return candidate as ChatwootContact[]
		}
	}

	return []
}

function resolvePhoneNumber(contact: ChatwootContact): string | null {
	const candidates: Array<string | number | null | undefined> = [
		contact.phone_number,
		contact.identifier,
		getAttributeValue(contact.additional_attributes, 'phone_number'),
		getAttributeValue(contact.additional_attributes, 'phone'),
		getAttributeValue(contact.custom_attributes, 'phone_number'),
		getAttributeValue(contact.custom_attributes, 'phone'),
	]

	if (Array.isArray(contact.contact_inboxes)) {
		for (const inbox of contact.contact_inboxes) {
			if (inbox?.source_id) {
				candidates.push(inbox.source_id)
			}
		}
	}

	for (const candidate of candidates) {
		const normalized = normalizePhone(candidate)
		if (normalized) {
			return normalized
		}
	}

	return null
}

function normalizePhone(value?: string | number | null): string | null {
	if (value === undefined || value === null) {
		return null
	}

	const raw = String(value).trim()
	if (!raw || !/\d/.test(raw)) {
		return null
	}

	const prefixed = raw.startsWith('+') ? raw : `+${raw}`
	const parsed = parsePhoneNumber(prefixed)

	return parsed.length >= 5 ? parsed : null
}

function splitContactName(name?: string | null) {
	const fallbackFirst = 'Chatwoot'
	const fallbackLast = 'Contact'

	if (!name) {
		return { firstName: fallbackFirst, lastName: fallbackLast }
	}

	const parts = name.trim().split(/\s+/).filter(Boolean)

	if (parts.length === 0) {
		return { firstName: fallbackFirst, lastName: fallbackLast }
	}

	if (parts.length === 1) {
		return { firstName: parts[0], lastName: fallbackLast }
	}

	return {
		firstName: parts[0],
		lastName: parts.slice(1).join(' '),
	}
}

function buildChatwootFieldPayload(contact: ChatwootContact): ChatwootFieldPayload {
	const fields: ChatwootFieldPayload = {}

	if (contact.id !== undefined && contact.id !== null) {
		fields.chatwootContactId = String(contact.id)
	}

	const primaryInbox = Array.isArray(contact.contact_inboxes)
		? contact.contact_inboxes.find((inbox) => Boolean(inbox)) ?? null
		: null

	if (primaryInbox?.inbox_id !== undefined && primaryInbox.inbox_id !== null) {
		fields.chatwootInboxId = String(primaryInbox.inbox_id)
	}

	if (primaryInbox?.source_id) {
		fields.chatwootSourceId = String(primaryInbox.source_id)
	}

	if (primaryInbox?.id !== undefined && primaryInbox.id !== null) {
		fields.chatwootContactInboxId = String(primaryInbox.id)
	}

	const conversationCandidate =
		contact.last_conversation_id ??
		(contact as Record<string, unknown>)?.lastConversationId ??
		primaryInbox?.conversation_id ??
		null

	if (conversationCandidate !== undefined && conversationCandidate !== null) {
		fields.chatwootConversationId = String(conversationCandidate)
	}

	return fields
}

function getAttributeValue(
	attributes: Record<string, unknown> | null | undefined,
	key: string
): string | null {
	if (!attributes) {
		return null
	}

	if (!(key in attributes)) {
		return null
	}

	const value = attributes[key]
	if (value === undefined || value === null) {
		return null
	}

	const normalized = String(value).trim()
	return normalized.length > 0 ? normalized : null
}

function extractOfferFromChatwootPayload(payload: unknown): string | null {
	return findOfferInValue(payload, 0)
}

function findOfferInValue(value: unknown, depth: number): string | null {
	if (depth > 6 || value === null || value === undefined) {
		return null
	}

	if (
		typeof value === 'string' ||
		typeof value === 'number' ||
		typeof value === 'boolean'
	) {
		const normalized = String(value).trim()
		return normalized.length > 0 ? normalized : null
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
			const nestedResult = findOfferInValue(candidate, depth + 1)
			if (nestedResult) return nestedResult
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

async function syncSingleContact(contactId: string) {
	try {
		const contact = await prisma.contact.findUnique({
			where: { id: contactId },
		})

		if (!contact) {
			return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
		}

		if (!contact.chatwootContactId) {
			return NextResponse.json(
				{
					error:
						'Contact is not linked to Chatwoot yet. Make sure it has a chatwootContactId before syncing.',
				},
				{ status: 400 }
			)
		}

		const credentials = resolveChatwootCredentials(undefined, {
			allowEnvFallback: true,
		})

		if (!credentials) {
			return NextResponse.json(
				{ error: 'Chatwoot credentials are not configured.' },
				{ status: 400 }
			)
		}

		const response = await axios.get(
			`${CHATWOOT_BASE_URL}/api/v1/accounts/${credentials.accountId}/contacts/${contact.chatwootContactId}`,
			{
				headers: {
					'Content-Type': 'application/json',
					'Api-Access-Token': credentials.apiAccessToken,
				},
			}
		)

		const payload = (response.data?.payload ?? response.data) as ChatwootContact | undefined

		if (!payload) {
			return NextResponse.json(
				{ error: 'Chatwoot contact payload was empty' },
				{ status: 502 }
			)
		}

		const outcome = await upsertChatwootContact(payload)

		return NextResponse.json({
			success: true,
			summary: [
				{
					metaAccountId: `contact-${contact.id}`,
					displayName: `${contact.firstName} ${contact.lastName}`.trim() || contact.phoneNumber,
					phoneNumber: contact.phoneNumber,
					status: 'success',
					created: outcome === 'created' ? 1 : 0,
					updated: outcome === 'updated' ? 1 : 0,
					skipped: outcome === 'skipped' ? 1 : 0,
				},
			],
		})
	} catch (error) {
		if (axios.isAxiosError(error)) {
			const status = error.response?.status ?? 500
			const message =
				error.response?.data?.error ||
				error.response?.data?.message ||
				error.message ||
				'Failed to sync contact from Chatwoot'
			return NextResponse.json({ error: message }, { status })
		}

		log.error(
			{ err: toError(error), action: 'syncSingleContact', contactId },
			'Error syncing single contact from Chatwoot'
		)
		return NextResponse.json(
			{ error: 'Failed to sync contact from Chatwoot' },
			{ status: 500 }
		)
	}
}


