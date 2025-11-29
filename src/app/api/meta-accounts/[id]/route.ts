import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logger, toError } from '@/lib/logger'

const log = logger.child({ route: 'meta-accounts/:id' })

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const {
      isActive,
      isVerified,
      accessToken,
      qualityRating,
      chatwootAccountId,
      chatwootInboxId,
      chatwootApiAccessToken,
    } = body

    const updateData: any = {}
    if (isActive !== undefined) updateData.isActive = isActive
    if (isVerified !== undefined) updateData.isVerified = isVerified
    if (accessToken !== undefined) updateData.accessToken = accessToken
    if (qualityRating !== undefined) updateData.qualityRating = qualityRating
    if (chatwootAccountId !== undefined)
      updateData.chatwootAccountId = chatwootAccountId
        ? chatwootAccountId.toString().trim()
        : null
    if (chatwootInboxId !== undefined)
      updateData.chatwootInboxId = chatwootInboxId
        ? chatwootInboxId.toString().trim()
        : null
    if (chatwootApiAccessToken !== undefined)
      updateData.chatwootApiAccessToken = chatwootApiAccessToken
        ? chatwootApiAccessToken.trim()
        : null

    const account = await prisma.metaAccount.update({
      where: { id: params.id },
      data: updateData,
    })

    return NextResponse.json(account)
  } catch (error) {
    log.error(
      { err: toError(error), action: 'PATCH', metaAccountId: params.id },
      'Error updating meta account'
    )
    return NextResponse.json(
      { error: 'Failed to update account' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await prisma.metaAccount.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    log.error(
      { err: toError(error), action: 'DELETE', metaAccountId: params.id },
      'Error deleting meta account'
    )
    return NextResponse.json(
      { error: 'Failed to delete account' },
      { status: 500 }
    )
  }
}

