import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { MetaAPI } from '@/lib/meta-api'
import { logger, toError } from '@/lib/logger'

const log = logger.child({ route: 'templates' })

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const search = searchParams.get('search')
    const folderId = searchParams.get('folderId')

    const where: any = {}

    if (status) {
      where.status = status
    }

    if (folderId) {
      where.folderId = folderId === 'UNASSIGNED' ? null : folderId
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' as const } },
        { metaTemplateName: { contains: search, mode: 'insensitive' as const } },
        { bodyText: { contains: search, mode: 'insensitive' as const } },
      ]
    }

    const templates = await prisma.template.findMany({
      where,
      include: {
        metaAccount: {
          select: {
            phoneNumber: true,
            displayName: true,
          },
        },
        folder: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(templates)
  } catch (error) {
    log.error({ err: toError(error), action: 'GET' }, 'Error fetching templates')
    return NextResponse.json(
      { error: 'Failed to fetch templates' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      name,
      metaTemplateName,
      metaAccountId,
      category,
      language,
      bodyText,
      footerText,
      variables,
      folderId,
    } = body

    if (!name || !metaTemplateName || !metaAccountId || !bodyText) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Get Meta account
    const metaAccount = await prisma.metaAccount.findUnique({
      where: { id: metaAccountId },
    })

    if (!metaAccount) {
      return NextResponse.json(
        { error: 'Meta account not found' },
        { status: 404 }
      )
    }

    // Check if template name already exists for this account
    const existing = await prisma.template.findFirst({
      where: {
        metaAccountId,
        metaTemplateName,
      },
    })

    if (existing) {
      return NextResponse.json(
        { error: 'Template with this name already exists for this account' },
        { status: 400 }
      )
    }

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

    // Prepare Meta API payload
    const components: any[] = [
      {
        type: 'BODY',
        text: bodyText,
      },
    ]

    // Add example if variables exist
    if (variables && variables.length > 0) {
      const exampleValues = variables.map((v: any) => v.example || 'Example')
      components[0].example = {
        body_text: [exampleValues],
      }
    }

    if (footerText) {
      components.push({
        type: 'FOOTER',
        text: footerText,
      })
    }

    // Submit to Meta
    const metaAPI = new MetaAPI({
      phoneNumberId: metaAccount.phoneNumberId,
      accessToken: metaAccount.accessToken,
      wabaId: metaAccount.wabaId,
    })

    const result = await metaAPI.createTemplate({
      name: metaTemplateName,
      language: language || 'en',
      category: category || 'MARKETING',
      components,
    })

    if (!result.success) {
      return NextResponse.json(
        { error: `Meta API Error: ${result.error}` },
        { status: 400 }
      )
    }

    // Save to database
    const template = await prisma.template.create({
      data: {
        name,
        metaTemplateName,
        metaTemplateId: result.data.id || null,
        metaAccountId,
        category: category || 'MARKETING',
        language: language || 'en',
        folderId: folderId || null,
        status: result.data.status === 'APPROVED' ? 'APPROVED' : 'PENDING',
        bodyText,
        footerText: footerText || null,
        variables: variables || [],
      },
      include: {
        metaAccount: {
          select: {
            phoneNumber: true,
            displayName: true,
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

    return NextResponse.json(template, { status: 201 })
  } catch (error) {
    const err = toError(error)
    log.error({ err, action: 'POST' }, 'Error creating template')
    return NextResponse.json(
      { error: err.message || 'Failed to create template' },
      { status: 500 }
    )
  }
}

