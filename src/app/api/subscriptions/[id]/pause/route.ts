import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logger, toError } from '@/lib/logger'

const log = logger.child({ route: 'subscriptions/:id/pause' })

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const subscription = await prisma.sequenceSubscription.update({
      where: { id: params.id },
      data: {
        status: 'PAUSED',
        pausedAt: new Date(),
      },
    })

    return NextResponse.json(subscription)
  } catch (error) {
    log.error(
      { err: toError(error), action: 'PUT', subscriptionId: params.id },
      'Error pausing subscription'
    )
    return NextResponse.json(
      { error: 'Failed to pause subscription' },
      { status: 500 }
    )
  }
}

