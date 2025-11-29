import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logger, toError } from '@/lib/logger'

const log = logger.child({ route: 'subscriptions/bulk-unsubscribe' })

export async function POST(request: Request) {
	try {
		const body = await request.json()
		const contactIds: string[] = body?.contactIds

		if (!Array.isArray(contactIds) || contactIds.length === 0) {
			return NextResponse.json(
				{ error: 'contactIds must be a non-empty array' },
				{ status: 400 }
			)
		}

		const result = await prisma.sequenceSubscription.updateMany({
			where: {
				contactId: { in: contactIds },
				status: 'ACTIVE',
			},
			data: {
				status: 'CANCELLED',
				updatedAt: new Date(),
			},
		})

		return NextResponse.json({ updated: result.count })
	} catch (error) {
		log.error({ err: toError(error) }, 'Bulk unsubscribe error')
		return NextResponse.json(
			{ error: 'Failed to unsubscribe contacts' },
			{ status: 500 }
		)
	}
}

