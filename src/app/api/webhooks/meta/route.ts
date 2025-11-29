import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logger, toError } from '@/lib/logger'

const log = logger.child({ route: 'webhooks/meta' })

// Webhook verification (GET)
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  const VERIFY_TOKEN = process.env.WEBHOOK_VERIFY_TOKEN

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    log.info('Meta webhook verified')
    return new NextResponse(challenge, { status: 200 })
  }

  return NextResponse.json(
    { error: 'Verification failed' },
    { status: 403 }
  )
}

// Webhook events (POST)
export async function POST(request: Request) {
  try {
    const body = await request.json()

    // Process webhook events
    if (body.object === 'whatsapp_business_account') {
      const entries = body.entry || []

      for (const entry of entries) {
        const changes = entry.changes || []

        for (const change of changes) {
          const value = change.value

          // Handle message status updates
          if (value.statuses) {
            for (const status of value.statuses) {
              await handleMessageStatus(status)
            }
          }

          // Handle template status updates
          if (value.message_template_id) {
            await handleTemplateStatus(value)
          }
        }
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    log.error({ err: toError(error) }, 'Webhook error')
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    )
  }
}

async function handleMessageStatus(status: any) {
  const { id, status: messageStatus, timestamp } = status

  try {
    const message = await prisma.sentMessage.findFirst({
      where: { metaMessageId: id },
    })

    if (!message) return

    const updateData: any = {}

    switch (messageStatus) {
      case 'sent':
        updateData.status = 'SENT'
        updateData.sentAt = new Date(parseInt(timestamp) * 1000)
        break
      case 'delivered':
        updateData.status = 'DELIVERED'
        updateData.deliveredAt = new Date(parseInt(timestamp) * 1000)
        break
      case 'read':
        updateData.status = 'READ'
        updateData.readAt = new Date(parseInt(timestamp) * 1000)
        break
      case 'failed':
        updateData.status = 'FAILED'
        updateData.failedAt = new Date(parseInt(timestamp) * 1000)
        updateData.errorMessage = status.errors?.[0]?.message || 'Unknown error'
        break
    }

    await prisma.sentMessage.update({
      where: { id: message.id },
      data: updateData,
    })
  } catch (error) {
    log.error({ err: toError(error), hook: 'message-status' }, 'Error handling message status')
  }
}

async function handleTemplateStatus(value: any) {
  const { message_template_id, event } = value

  try {
    const template = await prisma.template.findFirst({
      where: { metaTemplateId: message_template_id },
    })

    if (!template) return

    let status: 'PENDING' | 'APPROVED' | 'REJECTED' = 'PENDING'

    if (event === 'APPROVED') {
      status = 'APPROVED'
    } else if (event === 'REJECTED') {
      status = 'REJECTED'
    }

    await prisma.template.update({
      where: { id: template.id },
      data: { status },
    })
  } catch (error) {
    log.error({ err: toError(error), hook: 'template-status' }, 'Error handling template status')
  }
}

