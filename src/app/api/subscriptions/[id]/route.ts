import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logger, toError } from '@/lib/logger'

const log = logger.child({ route: 'subscriptions/:id' })

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await prisma.sequenceSubscription.update({
      where: { id: params.id },
      data: {
        status: 'CANCELLED',
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    log.error(
      { err: toError(error), action: 'DELETE', subscriptionId: params.id },
      'Error cancelling subscription'
    )
    return NextResponse.json(
      { error: 'Failed to cancel subscription' },
      { status: 500 }
    )
  }
}

