import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logger, toError } from '@/lib/logger'

const log = logger.child({ route: 'sequences' })

export async function GET() {
  try {
    const sequences = await prisma.sequence.findMany({
      where: {
        deletedAt: null, // Exclude soft-deleted sequences
      },
      include: {
        metaAccount: {
          select: {
            phoneNumber: true,
            displayName: true,
          },
        },
        steps: {
          orderBy: [
            { stepOrder: 'asc' },
            { subOrder: 'asc' },
          ],
          include: {
            template: {
              select: {
                name: true,
                metaTemplateName: true,
              },
            },
          },
        },
        _count: {
          select: {
            subscriptions: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(sequences)
  } catch (error) {
    log.error({ err: toError(error), action: 'GET' }, 'Error fetching sequences')
    return NextResponse.json(
      { error: 'Failed to fetch sequences' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      name,
      description,
      metaAccountId,
      flowLayout,
      steps,
      status,
    } = body

    if (!name || !metaAccountId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const sequence = await prisma.sequence.create({
      data: {
        name,
        description: description || null,
        metaAccountId,
        flowLayout: flowLayout || {},
        version: 1,
        isMajorVersion: true,
        status: status || 'DRAFT', // Default to DRAFT
        isActive: status === 'ACTIVE', // Keep isActive in sync
      },
      include: {
        metaAccount: {
          select: {
            phoneNumber: true,
            displayName: true,
          },
        },
      },
    })

    // Create steps if provided
    if (steps && steps.length > 0) {
      await prisma.sequenceStep.createMany({
        data: steps.map((step: any, index: number) => ({
          sequenceId: sequence.id,
          templateId: step.templateId || null,
          nodeId: step.id || `step-${index}`,
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

    return NextResponse.json(sequence, { status: 201 })
  } catch (error) {
    const err = toError(error)
    log.error({ err, action: 'POST' }, 'Error creating sequence')
    return NextResponse.json(
      { error: err.message || 'Failed to create sequence' },
      { status: 500 }
    )
  }
}

