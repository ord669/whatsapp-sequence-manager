import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logger, toError } from '@/lib/logger'

const log = logger.child({ route: 'subscriptions/:id/resume' })

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const subscription = await prisma.sequenceSubscription.update({
      where: { id: params.id },
      data: {
        status: 'ACTIVE',
        pausedAt: null,
      },
    })

    return NextResponse.json(subscription)
  } catch (error) {
    log.error(
      { err: toError(error), action: 'PUT', subscriptionId: params.id },
      'Error resuming subscription'
    )
    return NextResponse.json(
      { error: 'Failed to resume subscription' },
      { status: 500 }
    )
  }
}

