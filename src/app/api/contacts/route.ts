import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { parsePhoneNumber } from '@/lib/utils'
import { logger, toError } from '@/lib/logger'

const log = logger.child({ route: 'contacts' })

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')

    const where = search
      ? {
          OR: [
            { firstName: { contains: search, mode: 'insensitive' as const } },
            { lastName: { contains: search, mode: 'insensitive' as const } },
            { phoneNumber: { contains: search } },
          ],
        }
      : {}

    const contacts = await prisma.contact.findMany({
      where,
      include: {
        _count: {
          select: {
            subscriptions: {
              where: { status: 'ACTIVE' },
            },
          },
        },
        subscriptions: {
          select: {
            id: true,
            sequenceId: true,
            status: true,
            startedAt: true,
            completedAt: true,
            currentStep: true,
            currentSubStep: true,
            sequence: {
              select: {
                name: true,
                steps: {
                  select: {
                    stepOrder: true,
                    subOrder: true,
                    template: {
                      select: {
                        name: true,
                      },
                    },
                  },
                  orderBy: [
                    { stepOrder: 'asc' },
                    { subOrder: 'asc' },
                  ],
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    const response = contacts.map(({ subscriptions, ...contact }) => ({
      ...contact,
      activeSubscriptions: subscriptions.map((s) => {
        const steps = [...(s.sequence?.steps ?? [])].sort((a, b) => {
          if ((a.stepOrder ?? 0) === (b.stepOrder ?? 0)) {
            return (a.subOrder ?? 0) - (b.subOrder ?? 0)
          }
          return (a.stepOrder ?? 0) - (b.stepOrder ?? 0)
        })

        const currentStep = s.currentStep ?? steps[0]?.stepOrder ?? 1
        const currentSub = s.currentSubStep ?? 0

        let pendingStep = steps.find(
          (step) =>
            step.stepOrder === currentStep &&
            (step.subOrder ?? 0) === currentSub
        )

        if (!pendingStep) {
          pendingStep = steps.find(
            (step) =>
              (step.stepOrder ?? 0) >= currentStep &&
              (step.subOrder ?? 0) >= currentSub
          )
        }

        return {
        id: s.id,
        sequenceId: s.sequenceId,
        sequenceName: s.sequence?.name ?? 'Sequence',
          status: s.status,
          startedAt: s.startedAt,
          completedAt: s.completedAt,
          nextStepOrder: pendingStep?.stepOrder ?? null,
          nextMessageTitle: pendingStep?.template?.name ?? null,
        }
      }),
    }))

    return NextResponse.json(response)
  } catch (error) {
    log.error({ err: toError(error), action: 'GET' }, 'Error fetching contacts')
    return NextResponse.json(
      { error: 'Failed to fetch contacts' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { phoneNumber, firstName, lastName, offer } = body

    if (!phoneNumber || !firstName || !lastName) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Parse and validate phone number
    const parsedPhone = parsePhoneNumber(phoneNumber)
    
    // Check if contact already exists
    const existing = await prisma.contact.findUnique({
      where: { phoneNumber: parsedPhone },
    })

    if (existing) {
      return NextResponse.json(
        { error: 'Contact with this phone number already exists' },
        { status: 400 }
      )
    }

    const sanitizedOffer =
      typeof offer === 'string' && offer.trim().length > 0
        ? offer.trim()
        : null

    const contact = await prisma.contact.create({
      data: {
        phoneNumber: parsedPhone,
        firstName,
        lastName,
        offer: sanitizedOffer,
      },
    })

    log.info(
      {
        action: 'POST',
        contactId: contact.id,
        phoneNumber: parsedPhone,
      },
      'Contact created'
    )

    return NextResponse.json(contact, { status: 201 })
  } catch (error) {
    log.error({ err: toError(error), action: 'POST' }, 'Error creating contact')
    return NextResponse.json(
      { error: 'Failed to create contact' },
      { status: 500 }
    )
  }
}

