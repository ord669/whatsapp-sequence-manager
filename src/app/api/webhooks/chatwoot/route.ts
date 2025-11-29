import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { parsePhoneNumber } from '@/lib/utils'
import { logger, toError } from '@/lib/logger'

const log = logger.child({ route: 'webhooks/chatwoot' })

type ChatwootSender =
	| {
			id?: string | number | null
			name?: string | null
			identifier?: string | null
			phone_number?: string | null
	  }
	| null
	| undefined

function deriveNames(name?: string | null) {
	const fallbackFirst = 'Unknown'
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

function normalizePhone(raw?: string | null) {
	if (!raw || raw.trim().length === 0) {
		return null
	}

	const trimmed = raw.trim()
	const withPrefix = trimmed.startsWith('+') ? trimmed : `+${trimmed}`
	return parsePhoneNumber(withPrefix)
}

export async function POST(request: Request) {
	try {
		const payload = await request.json()

		const sender: ChatwootSender =
			payload?.meta?.sender ?? payload?.messages?.[0]?.sender ?? payload?.sender

		const rawPhone =
			sender?.phone_number ??
			payload?.contact_inbox?.source_id ??
			payload?.meta?.sender?.phone_number

		const phoneNumber = normalizePhone(rawPhone)

		if (!phoneNumber) {
			return NextResponse.json(
				{ error: 'Missing phone number in webhook payload' },
				{ status: 400 }
			)
		}

		const displayName =
			sender?.name ??
			sender?.identifier ??
			payload?.meta?.sender?.name ??
			'Unknown Contact'

		const { firstName, lastName } = deriveNames(displayName)

		const existing = await prisma.contact.findUnique({
			where: { phoneNumber },
		})

		const conversationId = payload?.id ? String(payload.id) : null
		const contactInbox = payload?.contact_inbox
		const inboxId = contactInbox?.inbox_id
			? String(contactInbox.inbox_id)
			: payload?.inbox_id
			? String(payload.inbox_id)
			: null
		const contactInboxId = contactInbox?.id ? String(contactInbox.id) : null
		const sourceId = contactInbox?.source_id ?? null
		const senderId =
			typeof sender?.id === 'number' || typeof sender?.id === 'string'
				? String(sender.id)
				: null

		const chatwootFields = {
			...(senderId && { chatwootContactId: senderId }),
			...(inboxId && { chatwootInboxId: inboxId }),
			...(sourceId && { chatwootSourceId: sourceId }),
			...(conversationId && { chatwootConversationId: conversationId }),
			...(contactInboxId && { chatwootContactInboxId: contactInboxId }),
		}

		if (existing) {
			const needsUpdate =
				existing.firstName !== firstName || existing.lastName !== lastName

			const updateData = {
				...(needsUpdate ? { firstName, lastName } : {}),
				...chatwootFields,
			}

			if (Object.keys(updateData).length > 0) {
				await prisma.contact.update({
					where: { id: existing.id },
					data: updateData,
				})
			}

			return NextResponse.json({
				success: true,
				created: false,
				contactId: existing.id,
			})
		}

		const contact = await prisma.contact.create({
			data: { phoneNumber, firstName, lastName, ...chatwootFields },
		})

		return NextResponse.json({
			success: true,
			created: true,
			contactId: contact.id,
		})
	} catch (error) {
		log.error({ err: toError(error) }, 'Chatwoot webhook error')
		return NextResponse.json(
			{ error: 'Failed to process webhook' },
			{ status: 500 }
		)
	}
}
