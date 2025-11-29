import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { MetaAPI } from '@/lib/meta-api'
import { logger, toError } from '@/lib/logger'

const log = logger.child({ route: 'meta-accounts/:id/test' })

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const account = await prisma.metaAccount.findUnique({
      where: { id: params.id },
    })

    if (!account) {
      return NextResponse.json(
        { error: 'Account not found' },
        { status: 404 }
      )
    }

    const metaAPI = new MetaAPI({
      phoneNumberId: account.phoneNumberId,
      accessToken: account.accessToken,
      wabaId: account.wabaId,
    })

    const result = await metaAPI.verifyConnection()

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      )
    }

    // Update quality rating if available
    if (result.data.quality_rating) {
      await prisma.metaAccount.update({
        where: { id: params.id },
        data: {
          qualityRating: result.data.quality_rating,
          isVerified: true,
        },
      })
    }

    return NextResponse.json({
      success: true,
      message: 'Connection test successful',
      data: result.data,
    })
  } catch (error) {
    const err = toError(error)
    log.error(
      { err, action: 'POST', metaAccountId: params.id },
      'Error testing Meta connection'
    )
    return NextResponse.json(
      { error: err.message || 'Connection test failed' },
      { status: 500 }
    )
  }
}

