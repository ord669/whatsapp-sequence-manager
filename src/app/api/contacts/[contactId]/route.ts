import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logger, toError } from '@/lib/logger'

const log = logger.child({ route: 'contacts/:contactId' })

export async function GET(
	request: Request,
	{ params }: { params: { contactId: string } }
) {
	try {
		const contact = await prisma.contact.findUnique({
			where: { id: params.contactId },
			include: {
				subscriptions: {
					include: {
						sequence: {
							select: {
								id: true,
								name: true,
								version: true,
							},
						},
					},
				},
				_count: {
					select: {
						sentMessages: true,
					},
				},
			},
		})

		if (!contact) {
			return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
		}

		return NextResponse.json(contact)
	} catch (error) {
		log.error({ err: toError(error), action: 'GET', contactId: params.contactId }, 'Error fetching contact')
		return NextResponse.json({ error: 'Failed to fetch contact' }, { status: 500 })
	}
}

export async function PUT(
	request: Request,
	{ params }: { params: { contactId: string } }
) {
	try {
		const body = await request.json()
		const { firstName, lastName } = body

		const contact = await prisma.contact.update({
			where: { id: params.contactId },
			data: {
				firstName,
				lastName,
			},
		})

		return NextResponse.json(contact)
	} catch (error) {
		log.error({ err: toError(error), action: 'PUT', contactId: params.contactId }, 'Error updating contact')
		return NextResponse.json({ error: 'Failed to update contact' }, { status: 500 })
	}
}

export async function DELETE(
	request: Request,
	{ params }: { params: { contactId: string } }
) {
	try {
		await prisma.contact.delete({
			where: { id: params.contactId },
		})

		return NextResponse.json({ success: true })
	} catch (error) {
		log.error({ err: toError(error), action: 'DELETE', contactId: params.contactId }, 'Error deleting contact')
		return NextResponse.json({ error: 'Failed to delete contact' }, { status: 500 })
	}
}

