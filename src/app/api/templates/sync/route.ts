import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logger, toError } from '@/lib/logger'
import { syncTemplatesForMetaAccount, TemplateSyncError } from '@/lib/template-sync'

const log = logger.child({ route: 'templates/sync' })

export async function POST() {
  try {
    const metaAccounts = await prisma.metaAccount.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'asc' },
    })

    if (metaAccounts.length === 0) {
      return NextResponse.json(
        { error: 'No active Meta accounts found. Connect an account first.' },
        { status: 400 }
      )
    }

    const summary = []
    for (const account of metaAccounts) {
      try {
        const result = await syncTemplatesForMetaAccount(account)
        summary.push({
          metaAccountId: account.id,
          displayName: account.displayName,
          phoneNumber: account.phoneNumber,
          status: 'success',
          ...result,
        })
      } catch (error) {
        const err = error instanceof TemplateSyncError ? error : new TemplateSyncError('Failed to sync templates')
        summary.push({
          metaAccountId: account.id,
          displayName: account.displayName,
          phoneNumber: account.phoneNumber,
          status: 'error',
          error: err.message,
        })
        log.error(
          { err: toError(error), metaAccountId: account.id },
          'Error syncing templates for Meta account'
        )
      }
    }

    const hasSuccess = summary.some((entry) => entry.status === 'success')

    return NextResponse.json(
      {
        success: hasSuccess,
        summary,
      },
      { status: hasSuccess ? 200 : 500 }
    )
  } catch (error) {
    const err = toError(error)
    log.error({ err, action: 'POST' }, 'Error syncing templates from Meta')
    return NextResponse.json(
      { error: err.message || 'Failed to sync templates' },
      { status: 500 }
    )
  }
}

