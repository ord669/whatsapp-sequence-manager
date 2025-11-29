import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logger, toError } from '@/lib/logger'

const log = logger.child({ route: 'meta-accounts' })

export async function GET() {
  try {
    const accounts = await prisma.metaAccount.findMany({
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(accounts)
  } catch (error) {
    log.error({ err: toError(error), action: 'GET' }, 'Error fetching meta accounts')
    return NextResponse.json(
      { error: 'Failed to fetch accounts' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()

    const {
      businessManagerName,
      wabaId,
      wabaName,
      phoneNumberId,
      phoneNumber,
      displayName,
      appId,
      appSecret,
      accessToken,
      chatwootAccountId,
      chatwootInboxId,
      chatwootApiAccessToken,
    } = body

    // Validate required fields
    if (
      !wabaId ||
      !wabaName ||
      !phoneNumberId ||
      !phoneNumber ||
      !displayName ||
      !appId ||
      !appSecret ||
      !accessToken
    ) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Check if account already exists
    const existing = await prisma.metaAccount.findFirst({
      where: {
        wabaId,
        phoneNumberId,
      },
    })

    if (existing) {
      return NextResponse.json(
        { error: 'This account is already connected' },
        { status: 400 }
      )
    }

    // Verify the connection actually works before saving
    const { MetaAPI } = await import('@/lib/meta-api')
    const metaAPI = new MetaAPI({
      phoneNumberId,
      accessToken,
      wabaId,
    })

    const verifyResult = await metaAPI.verifyConnection()
    
    if (!verifyResult.success) {
      return NextResponse.json(
        { 
          error: 'Failed to verify Meta API connection. Please check your credentials.',
          details: verifyResult.error 
        },
        { status: 400 }
      )
    }

    // Connection verified, now save to database
    const account = await prisma.metaAccount.create({
      data: {
        businessManagerName: businessManagerName || null,
        wabaId,
        wabaName,
        phoneNumberId,
        phoneNumber,
        displayName,
        appId,
        appSecret,
        accessToken,
        isActive: true,
        isVerified: true,
        qualityRating: verifyResult.data.quality_rating || null,
        chatwootAccountId: chatwootAccountId
          ? chatwootAccountId.toString().trim()
          : null,
        chatwootInboxId: chatwootInboxId
          ? chatwootInboxId.toString().trim()
          : null,
        chatwootApiAccessToken: chatwootApiAccessToken
          ? chatwootApiAccessToken.trim()
          : null,
      },
    })

    return NextResponse.json(account, { status: 201 })
  } catch (error) {
    log.error({ err: toError(error), action: 'POST' }, 'Error creating meta account')
    return NextResponse.json(
      { error: 'Failed to create account' },
      { status: 500 }
    )
  }
}

