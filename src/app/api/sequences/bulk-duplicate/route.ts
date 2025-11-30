import { NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { logger, toError } from '@/lib/logger'

const log = logger.child({ route: 'sequences/bulk-duplicate' })

export async function POST(request: Request) {
	try {
		const body = await request.json()
		const { ids } = body

		if (!Array.isArray(ids) || ids.length === 0) {
			return NextResponse.json(
				{ error: 'Invalid or empty sequence IDs array' },
				{ status: 400 }
			)
		}

		const sequences = await prisma.sequence.findMany({
			where: {
				id: { in: ids },
				deletedAt: null,
			},
			include: {
				steps: {
					orderBy: [{ stepOrder: 'asc' }, { subOrder: 'asc' }],
				},
			},
		})

		if (sequences.length === 0) {
			return NextResponse.json(
				{ error: 'No sequences found to duplicate' },
				{ status: 404 }
			)
		}

		const duplicatedSequences = await prisma.$transaction(
			sequences.map((sequence) => {
				const duplicateName = generateDuplicateName(sequence.name)

				return prisma.sequence.create({
					data: {
						name: duplicateName,
						description: sequence.description,
						metaAccountId: sequence.metaAccountId,
						flowLayout: normalizeJson(sequence.flowLayout),
						status: 'DRAFT',
						isActive: false,
						version: 1,
						isMajorVersion: true,
						parentSequenceId: sequence.id,
						labels: sequence.labels,
						similarToVersionIds: [],
						steps:
							sequence.steps.length > 0
								? {
										createMany: {
											data: sequence.steps.map((step, index) => ({
												templateId: step.templateId,
												nodeId: step.nodeId || `node-${index}`,
												nodeType: step.nodeType,
												stepOrder: step.stepOrder,
												subOrder: step.subOrder,
												delayValue: step.delayValue,
												delayUnit: step.delayUnit,
												scheduledTime: step.scheduledTime,
												variableValues: normalizeJson(step.variableValues ?? {}),
												burstTemplates: normalizeJson(step.burstTemplates ?? []),
												positionX: step.positionX,
												positionY: step.positionY,
											})),
										},
								  }
								: undefined,
					},
					select: {
						id: true,
						name: true,
					},
				})
			})
		)

		return NextResponse.json({
			success: true,
			duplicatedCount: duplicatedSequences.length,
			newSequenceIds: duplicatedSequences.map((sequence) => sequence.id),
		})
	} catch (error) {
		log.error({ err: toError(error) }, 'Error bulk duplicating sequences')
		return NextResponse.json(
			{ error: 'Failed to duplicate sequences' },
			{ status: 500 }
		)
	}
}

const generateDuplicateName = (originalName?: string | null) => {
	const baseName = originalName?.trim() || 'Untitled Sequence'
	return `${baseName} (Copy)`
}

const normalizeJson = (value: unknown): Prisma.InputJsonValue => {
	if (!value) return {}
	if (typeof value === 'string') {
		try {
			return JSON.parse(value)
		} catch {
			return {}
		}
	}

	return value as Prisma.InputJsonValue
}


