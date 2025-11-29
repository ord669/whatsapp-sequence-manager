import { NextResponse } from 'next/server'
import { syncTemplatesForMetaAccount, TemplateSyncError } from '@/lib/template-sync'
import { logger, toError } from '@/lib/logger'

const log = logger.child({ route: 'meta-accounts/:id/sync-templates' })

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const result = await syncTemplatesForMetaAccount(params.id)

    return NextResponse.json({
      success: true,
      ...result,
    })
  } catch (error) {
    const err = toError(error)
    const status = error instanceof TemplateSyncError ? error.status : 500
    log.error(
      { err, action: 'POST', metaAccountId: params.id },
      'Error syncing templates'
    )
    return NextResponse.json(
      { error: err.message || 'Failed to sync templates' },
      { status }
    )
  }
}

