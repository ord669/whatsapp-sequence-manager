import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logger, toError } from '@/lib/logger'

const log = logger.child({ route: 'templates/:id' })

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const template = await prisma.template.findUnique({
      where: { id: params.id },
      include: {
        metaAccount: {
          select: {
            phoneNumber: true,
            displayName: true,
            wabaName: true,
          },
        },
        folder: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    if (!template) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(template)
  } catch (error) {
    log.error(
      { err: toError(error), action: 'GET', templateId: params.id },
      'Error fetching template'
    )
    return NextResponse.json(
      { error: 'Failed to fetch template' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await prisma.template.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    log.error(
      { err: toError(error), action: 'DELETE', templateId: params.id },
      'Error deleting template'
    )
    return NextResponse.json(
      { error: 'Failed to delete template' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const folderId: string | null =
      body.folderId === undefined || body.folderId === null || body.folderId === ''
        ? null
        : body.folderId

    if (folderId) {
      const folderExists = await prisma.templateFolder.findUnique({
        where: { id: folderId },
      })

      if (!folderExists) {
        return NextResponse.json(
          { error: 'Folder not found' },
          { status: 404 }
        )
      }
    }

    const template = await prisma.template.update({
      where: { id: params.id },
      data: {
        folderId,
      },
      include: {
        metaAccount: {
          select: {
            phoneNumber: true,
            displayName: true,
            wabaName: true,
          },
        },
        folder: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    return NextResponse.json(template)
  } catch (error) {
    log.error(
      { err: toError(error), action: 'PATCH', templateId: params.id },
      'Error updating template folder'
    )
    return NextResponse.json(
      { error: 'Failed to update template' },
      { status: 500 }
    )
  }
}

