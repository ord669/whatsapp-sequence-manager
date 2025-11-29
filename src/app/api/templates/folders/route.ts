import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logger, toError } from '@/lib/logger'

const log = logger.child({ route: 'template-folders' })

export async function GET() {
  try {
    const folders = await prisma.templateFolder.findMany({
      orderBy: [
        { sortOrder: 'asc' },
        { createdAt: 'asc' },
      ],
      include: {
        _count: {
          select: { templates: true },
        },
      },
    })

    return NextResponse.json(folders)
  } catch (error) {
    log.error({ err: toError(error), action: 'GET' }, 'Error fetching template folders')
    return NextResponse.json(
      { error: 'Failed to fetch template folders' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const name = (body.name || '').trim()

    if (!name) {
      return NextResponse.json(
        { error: 'Folder name is required' },
        { status: 400 }
      )
    }

    const existing = await prisma.templateFolder.findFirst({
      where: {
        name: {
          equals: name,
          mode: 'insensitive',
        },
      },
    })

    if (existing) {
      return NextResponse.json(
        { error: 'A folder with this name already exists' },
        { status: 400 }
      )
    }

    const lastFolder = await prisma.templateFolder.findFirst({
      orderBy: { sortOrder: 'desc' },
    })

    const folder = await prisma.templateFolder.create({
      data: {
        name,
        sortOrder: (lastFolder?.sortOrder || 0) + 1,
      },
      include: {
        _count: {
          select: { templates: true },
        },
      },
    })

    return NextResponse.json(folder, { status: 201 })
  } catch (error) {
    log.error({ err: toError(error), action: 'POST' }, 'Error creating template folder')
    return NextResponse.json(
      { error: 'Failed to create folder' },
      { status: 500 }
    )
  }
}

