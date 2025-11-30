import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logger, toError } from '@/lib/logger'

const log = logger.child({ route: 'sequences/:id' })

export async function GET(
	request: Request,
	{ params }: { params: { id: string } }
) {
	try {
		const sequence = await prisma.sequence.findUnique({
			where: { id: params.id },
			include: {
				metaAccount: {
					select: {
						phoneNumber: true,
						displayName: true,
						wabaName: true,
					},
				},
				steps: {
					orderBy: [{ stepOrder: 'asc' }, { subOrder: 'asc' }],
					select: {
						id: true,
						nodeId: true,
						nodeType: true,
						stepOrder: true,
						subOrder: true,
						delayValue: true,
						delayUnit: true,
						scheduledTime: true,
						variableValues: true,
						burstTemplates: true,
						template: {
							select: {
								id: true,
								name: true,
								bodyText: true,
							},
						},
					},
				},
				subscriptions: {
					where: {
						status: { in: ['ACTIVE', 'PAUSED'] },
					},
					include: {
						contact: {
							select: {
								id: true,
								phoneNumber: true,
								firstName: true,
								lastName: true,
							},
						},
					},
				},
				analytics: true,
			},
		})

		if (!sequence) {
			return NextResponse.json({ error: 'Sequence not found' }, { status: 404 })
		}

		// Map flowLayout to flowData for consistency with frontend
		// Parse flowLayout JSON string to object
		let flowData = null
		if (sequence.flowLayout) {
			try {
				flowData = JSON.parse(sequence.flowLayout as string)
			} catch (e) {
				log.warn(
					{ err: toError(e), sequenceId: params.id },
					'Failed to parse flowLayout'
				)
			}
		}

		// Add manual counts
		const responseData = {
			...sequence,
			flowData,
			_count: {
				subscriptions: sequence.subscriptions?.length || 0,
				sentMessages: 0, // Will be calculated separately if needed
			},
		}

		return NextResponse.json(responseData)
	} catch (error) {
		log.error(
			{ err: toError(error), action: 'GET', sequenceId: params.id },
			'Error fetching sequence'
		)
		return NextResponse.json(
			{ error: 'Failed to fetch sequence' },
			{ status: 500 }
		)
	}
}

export async function PATCH(
	request: Request,
	{ params }: { params: { id: string } }
) {
	try {
		const body = await request.json()
		const { name, description, isActive, flowData, steps, status } = body

		const sequence = await prisma.sequence.update({
			where: { id: params.id },
			data: {
				...(name && { name }),
				...(description !== undefined && { description }),
				...(status && { status }),
				...(isActive !== undefined && { isActive }),
				...(status === 'ACTIVE' && { isActive: true }),
				...(status === 'DRAFT' && { isActive: false }),
				...(status === 'INACTIVE' && { isActive: false }),
				...(flowData && { flowLayout: JSON.stringify(flowData) }),
			},
		})

		// Update steps if provided
		if (steps) {
			// Delete existing steps
			await prisma.sequenceStep.deleteMany({
				where: { sequenceId: params.id },
			})

			// Create new steps
			if (steps.length > 0) {
				await prisma.sequenceStep.createMany({
					data: steps.map((step: any, index: number) => ({
						sequenceId: params.id,
						templateId: step.templateId || null,
						nodeId: step.id || step.nodeId || `step-${index}`,
						nodeType: step.type || step.nodeType || 'MESSAGE',
						stepOrder: index + 1,
						subOrder: 0,
						delayValue: step.delayValue || 0,
						delayUnit: step.delayUnit || 'MINUTES',
						scheduledTime: step.scheduledTime || null,
						variableValues: step.variableValues || {},
						burstTemplates: step.burstTemplates || null,
						positionX: null,
						positionY: null,
					})),
				})
			}
		}

		return NextResponse.json(sequence)
	} catch (error) {
		log.error(
			{ err: toError(error), action: 'PATCH', sequenceId: params.id },
			'Error updating sequence'
		)
		return NextResponse.json(
			{ error: 'Failed to update sequence' },
			{ status: 500 }
		)
	}
}

export async function PUT(
	request: Request,
	{ params }: { params: { id: string } }
) {
	// Redirect to PATCH for backward compatibility
	return PATCH(request, { params })
}

export async function DELETE(
	request: Request,
	{ params }: { params: { id: string } }
) {
	try {
		// Soft delete: set deletedAt timestamp instead of hard delete
		await prisma.sequence.update({
			where: { id: params.id },
			data: {
				deletedAt: new Date(),
				status: 'INACTIVE', // Also mark as inactive
				isActive: false,
			},
		})

		return NextResponse.json({ success: true })
	} catch (error) {
		log.error(
			{ err: toError(error), action: 'DELETE', sequenceId: params.id },
			'Error deleting sequence'
		)
		return NextResponse.json(
			{ error: 'Failed to delete sequence' },
			{ status: 500 }
		)
	}
}
