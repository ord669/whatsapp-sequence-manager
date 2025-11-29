import axios from 'axios'
import cron from 'node-cron'
import {
  PrismaClient,
  Prisma,
  Contact,
  MetaAccount,
  SequenceStep,
  Template,
} from '@prisma/client'

import { logger, toError } from '../src/lib/logger'

const prisma = new PrismaClient()
const jobLogger = logger.child({ module: 'message-scheduler' })

const META_API_VERSION = 'v18.0'
const META_API_BASE_URL = `https://graph.facebook.com/${META_API_VERSION}`
const CHATWOOT_BASE_URL =
  process.env.CHATWOOT_BASE_URL || 'https://cw.i3c.uk'

type SubscriptionWithRelations =
  Prisma.SequenceSubscriptionGetPayload<{
    include: {
      contact: true
      sequence: {
        include: {
          steps: {
            orderBy: [
              { stepOrder: 'asc' },
              { subOrder: 'asc' },
            ]
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

jobLogger.info(
  { schedule: '* * * * *' },
  'Message scheduler initialized and awaiting first tick'
)

cron.schedule('* * * * *', async () => {
  const runLogger = jobLogger.child({ runStartedAt: new Date().toISOString() })
  runLogger.info('Running message scheduler tick')

  try {
    await processScheduledMessages()
    runLogger.info('Message scheduler tick finished')
  } catch (error) {
    runLogger.error({ err: toError(error) }, 'Scheduler error')
  }
})

async function processScheduledMessages() {
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
              orderBy: [
                { stepOrder: 'asc' },
                { subOrder: 'asc' },
              ],
            },
            metaAccount: true,
          },
        },
      },
    })

  jobLogger.info(
    { count: subscriptions.length },
    'Located subscriptions ready to process'
  )

  for (const subscription of subscriptions) {
    const subscriptionLogger = jobLogger.child({
      subscriptionId: subscription.id,
    })

    try {
      await processSubscription(subscription, subscriptionLogger)
    } catch (error) {
      subscriptionLogger.error(
        { err: toError(error) },
        'Error processing subscription'
      )
    }
  }
}

async function processSubscription(
  subscription: SubscriptionWithRelations,
  subscriptionLogger = jobLogger
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
  subscriptionLogger.info(
    {
          stepOrder: step.stepOrder,
          subStep: step.subOrder,
          burstIndex: entryIndex + 1,
          templateId: entry.templateId,
    },
    'Sending sequence step message'
  )

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
        subscriptionLogger.error(
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

    await prisma.sentMessage.create({
      data: {
        contactId: contact.id,
        subscriptionId: subscription.id,
          templateId: entry.templateId,
        metaMessageId: result.messageId || null,
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
      subscriptionLogger.info('Sequence completed for subscription')
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

      subscriptionLogger.info(
        {
          nextStep: nextStep.stepOrder,
          nextSubStep: nextStep.subOrder,
          scheduledAt: nextScheduledAt.toISOString(),
        },
        'Scheduled next step'
      )
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
    return raw
      .map((entry) => {
        if (typeof entry !== 'object' || entry === null) return null
        const typed = entry as Record<string, unknown>
        if (typeof typed.templateId !== 'string') return null
        return {
          templateId: typed.templateId,
          templateName:
            typeof typed.templateName === 'string'
              ? typed.templateName
              : undefined,
          variableValues:
            typeof typed.variableValues === 'object' && typed.variableValues !== null
              ? (typed.variableValues as Record<string, string>)
              : undefined,
        }
      })
      .filter((entry): entry is BurstEntry => Boolean(entry))
  }

  return [
    {
      templateId: step.templateId,
      variableValues:
        (step.variableValues as Record<string, string> | null) || {},
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

    const { parameters, processedBodyParams } = buildTemplateParameters(
      template,
      step,
      contact,
      options?.variableValues
    )

    if (shouldUseChatwoot(metaAccount, contact)) {
      return await sendChatwootTemplateMessage({
        metaAccount,
        contact,
        template,
        processedBodyParams,
      })
    }

    return await sendMetaTemplateMessage({
      metaAccount,
      contact,
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
    ((step.variableValues as Record<string, string> | null) || {})
  const matches = template.bodyText.match(/\{\{\d+\}\}/g) || []

  for (const match of matches) {
    const varNum = match.replace(/\{|\}/g, '')
    let value = variableValues[varNum]

    if (value === '{firstName}') value = contact.firstName
    if (value === '{lastName}') value = contact.lastName
    if (value === '{phoneNumber}') value = contact.phoneNumber

    const resolved = value || 'N/A'

    parameters.push({
      type: 'text',
      text: resolved,
    })

    processedBodyParams[varNum] = resolved
  }

  return { parameters, processedBodyParams }
}

function shouldUseChatwoot(metaAccount: MetaAccount, contact: Contact) {
  return (
    !!metaAccount.chatwootAccountId &&
    !!metaAccount.chatwootApiAccessToken &&
    !!contact.chatwootConversationId
  )
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
  if (!metaAccount.chatwootAccountId || !metaAccount.chatwootApiAccessToken) {
    return {
      success: false,
      error: 'Chatwoot credentials are missing on the Meta account record',
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
      `${CHATWOOT_BASE_URL}/api/v1/accounts/${metaAccount.chatwootAccountId}/conversations/${contact.chatwootConversationId}/messages`,
      payload,
      {
        headers: {
          'Content-Type': 'application/json',
          'Api-Access-Token': metaAccount.chatwootApiAccessToken,
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

