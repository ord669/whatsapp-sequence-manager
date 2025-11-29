import { NextResponse } from 'next/server'
import { MetaAPI } from '@/lib/meta-api'
import { logger, toError } from '@/lib/logger'

const log = logger.child({ route: 'meta-accounts/verify' })

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { phoneNumberId, accessToken, wabaId } = body

    if (!phoneNumberId || !accessToken || !wabaId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const metaAPI = new MetaAPI({
      phoneNumberId,
      accessToken,
      wabaId,
    })

    // Verify phone number
    const phoneResult = await metaAPI.verifyConnection()

    if (!phoneResult.success) {
      return NextResponse.json(
        { error: phoneResult.error },
        { status: 400 }
      )
    }

    // Get WABA details
    const wabaResult = await metaAPI.getWABADetails()
    
    // Get Business Manager name (if available)
    let businessManagerName = 'My Business'
    if (wabaResult.success && wabaResult.data.owner_business_info) {
      businessManagerName = wabaResult.data.owner_business_info.name || businessManagerName
    }

    return NextResponse.json({
      success: true,
      phoneNumber: phoneResult.data.display_phone_number,
      displayName: phoneResult.data.verified_name,
      qualityRating: phoneResult.data.quality_rating,
      wabaName: wabaResult.success ? (wabaResult.data.name || 'WhatsApp Business Account') : 'WhatsApp Business Account',
      businessManagerName,
    })
  } catch (error) {
    const err = toError(error)
    log.error({ err, action: 'POST' }, 'Error verifying Meta connection')
    return NextResponse.json(
      { error: err.message || 'Verification failed' },
      { status: 500 }
    )
  }
}

