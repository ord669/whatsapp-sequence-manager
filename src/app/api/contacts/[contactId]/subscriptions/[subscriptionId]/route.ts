import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logger, toError } from '@/lib/logger'

const log = logger.child({ route: 'contacts/:contactId/subscriptions/:subscriptionId' })

export async function GET(
	request: Request,
	{
		params,
	}: {
		params: {
			contactId: string
			subscriptionId: string
		}
	}
) {
	try {
		const { contactId, subscriptionId } = params

		const subscription = await prisma.sequenceSubscription.findFirst({
			where: {
				id: subscriptionId,
				contactId,
			},
			include: {
				contact: {
					select: {
						id: true,
						firstName: true,
						lastName: true,
						phoneNumber: true,
					},
				},
				sequence: {
					select: {
						id: true,
						name: true,
						description: true,
						steps: {
							orderBy: [
								{ stepOrder: 'asc' },
								{ subOrder: 'asc' },
							],
							select: {
								id: true,
								stepOrder: true,
								subOrder: true,
								delayValue: true,
								delayUnit: true,
								scheduledTime: true,
								burstTemplates: true,
								template: {
									select: {
										id: true,
										name: true,
										category: true,
									},
								},
							},
						},
					},
				},
			},
		})

		if (!subscription) {
			return NextResponse.json({ error: 'Subscription not found' }, { status: 404 })
		}

		return NextResponse.json({
			contact: subscription.contact,
			subscription: {
				id: subscription.id,
				status: subscription.status,
				currentStep: subscription.currentStep,
				currentSubStep: subscription.currentSubStep,
				startedAt: subscription.startedAt,
				completedAt: subscription.completedAt,
				lastMessageSentAt: subscription.lastMessageSentAt,
				nextScheduledAt: subscription.nextScheduledAt,
			},
			sequence: subscription.sequence,
		})
	} catch (error) {
		log.error(
			{
				err: toError(error),
				action: 'GET',
				contactId: params.contactId,
				subscriptionId: params.subscriptionId,
			},
			'Error fetching subscription context'
		)
		return NextResponse.json({ error: 'Failed to load subscription' }, { status: 500 })
	}
}

