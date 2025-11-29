import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logger, toError } from '@/lib/logger'

const log = logger.child({ route: 'template-folders-id' })

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const folder = await prisma.templateFolder.findUnique({
      where: { id: params.id },
      include: {
        _count: {
          select: { templates: true },
        },
      },
    })

    if (!folder) {
      return NextResponse.json({ error: 'Folder not found' }, { status: 404 })
    }

    if (folder._count.templates > 0) {
      return NextResponse.json(
        { error: 'Folder is not empty' },
        { status: 400 }
      )
    }

    await prisma.templateFolder.delete({ where: { id: params.id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    log.error({ err: toError(error), action: 'DELETE', folderId: params.id }, 'Error deleting template folder')
    return NextResponse.json(
      { error: 'Failed to delete folder' },
      { status: 500 }
    )
  }
}


