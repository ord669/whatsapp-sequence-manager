import { NextResponse } from 'next/server'
import { Prisma, SubscriptionStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { addMinutes, addHours, addDays } from 'date-fns'
import { logger, toError } from '@/lib/logger'

const log = logger.child({ route: 'subscriptions' })

export async function GET() {
  try {
    const subscriptions = await prisma.sequenceSubscription.findMany({
      include: {
        contact: true,
        sequence: {
          select: {
            id: true,
            name: true,
            version: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(subscriptions)
  } catch (error) {
    log.error({ err: toError(error), action: 'GET' }, 'Error fetching subscriptions')
    return NextResponse.json(
      { error: 'Failed to fetch subscriptions' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { contactId, sequenceId } = body

    if (!contactId || !sequenceId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Check if subscription already exists
    const existing = await prisma.sequenceSubscription.findUnique({
      where: {
        contactId_sequenceId: {
          contactId,
          sequenceId,
        },
      },
    })

    // Get the sequence to find the first step
    const sequence = await prisma.sequence.findUnique({
      where: { id: sequenceId },
      include: {
        steps: {
          orderBy: [
            { stepOrder: 'asc' },
            { subOrder: 'asc' },
          ],
          take: 1,
        },
      },
    })

    if (!sequence) {
      return NextResponse.json(
        { error: 'Sequence not found' },
        { status: 404 }
      )
    }

    if (!sequence.isActive) {
      return NextResponse.json(
        { error: 'Sequence is not active' },
        { status: 400 }
      )
    }

    if (sequence.steps.length === 0) {
      return NextResponse.json(
        { error: 'Sequence has no steps' },
        { status: 400 }
      )
    }

    const firstStep = sequence.steps[0]
    
    // Calculate next scheduled time (immediate start)
    let nextScheduledAt = new Date()
    
    // If first step has a delay, add it
    if (firstStep.delayValue > 0) {
      if (firstStep.delayUnit === 'MINUTES') {
        nextScheduledAt = addMinutes(nextScheduledAt, firstStep.delayValue)
      } else if (firstStep.delayUnit === 'HOURS') {
        nextScheduledAt = addHours(nextScheduledAt, firstStep.delayValue)
      } else if (firstStep.delayUnit === 'DAYS') {
        nextScheduledAt = addDays(nextScheduledAt, firstStep.delayValue)
        // TODO: Adjust for scheduled time and business hours
      }
    }

    const baseSubscriptionData = {
      status: SubscriptionStatus.ACTIVE,
      currentStep: firstStep.stepOrder,
      currentSubStep: firstStep.subOrder,
      currentNodeId: firstStep.nodeId,
      nextScheduledAt,
      startedAt: new Date(),
      pausedAt: null,
      completedAt: null,
      lastMessageSentAt: null,
    } satisfies Omit<
      Prisma.SequenceSubscriptionUncheckedCreateInput,
      'contactId' | 'sequenceId'
    > &
      Prisma.SequenceSubscriptionUpdateInput

    let subscription

    if (existing) {
      subscription = await prisma.sequenceSubscription.update({
        where: { id: existing.id },
        data: baseSubscriptionData,
        include: {
          contact: true,
          sequence: {
            select: {
              id: true,
              name: true,
              version: true,
            },
          },
        },
      })

      log.info(
        {
          action: 'subscription.reset',
          subscriptionId: subscription.id,
          contactId: subscription.contactId,
          sequenceId: subscription.sequenceId,
          sequenceName: subscription.sequence?.name,
          nextScheduledAt: subscription.nextScheduledAt?.toISOString(),
        },
        'Subscription reset to sequence start'
      )
    } else {
      subscription = await prisma.sequenceSubscription.create({
        data: {
          contactId,
          sequenceId,
          ...baseSubscriptionData,
        },
        include: {
          contact: true,
          sequence: {
            select: {
              id: true,
              name: true,
              version: true,
            },
          },
        },
      })

      log.info(
        {
          action: 'subscription.create',
          subscriptionId: subscription.id,
          contactId: subscription.contactId,
          sequenceId: subscription.sequenceId,
          sequenceName: subscription.sequence?.name,
          nextScheduledAt: subscription.nextScheduledAt?.toISOString(),
        },
        'Subscription created'
      )
    }

    return NextResponse.json(subscription, { status: 201 })
  } catch (error) {
    const err = toError(error)
    log.error({ err, action: 'POST' }, 'Error creating subscription')
    return NextResponse.json(
      { error: err.message || 'Failed to create subscription' },
      { status: 500 }
    )
  }
}

