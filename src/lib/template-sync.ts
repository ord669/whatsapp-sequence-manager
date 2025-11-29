import { Prisma, type MetaAccount } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { MetaAPI } from '@/lib/meta-api'

export class TemplateSyncError extends Error {
  status: number

  constructor(message: string, status = 500) {
    super(message)
    this.name = 'TemplateSyncError'
    this.status = status
  }
}

export interface TemplateSyncResult {
  synced: number
  updated: number
  total: number
}

type MetaAccountInput = string | MetaAccount

export async function syncTemplatesForMetaAccount(
  metaAccountOrId: MetaAccountInput
): Promise<TemplateSyncResult> {
  const metaAccount =
    typeof metaAccountOrId === 'string'
      ? await prisma.metaAccount.findUnique({ where: { id: metaAccountOrId } })
      : metaAccountOrId

  if (!metaAccount) {
    throw new TemplateSyncError('Meta account not found', 404)
  }

  const metaAPI = new MetaAPI({
    phoneNumberId: metaAccount.phoneNumberId,
    accessToken: metaAccount.accessToken,
    wabaId: metaAccount.wabaId,
  })

  const result = await metaAPI.listTemplates()

  if (!result.success) {
    throw new TemplateSyncError(result.error || 'Failed to fetch templates from Meta', 400)
  }

  const templates = result.data.data || []
  let synced = 0
  let updated = 0

  for (const metaTemplate of templates) {
    let bodyText = ''
    let headerType: string | null = null
    let headerContent: string | null = null
    let footerText = ''
    let buttons: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput = Prisma.JsonNull

    if (metaTemplate.components) {
      for (const component of metaTemplate.components) {
        if (component.type === 'BODY') {
          bodyText = component.text || ''
        } else if (component.type === 'HEADER') {
          if (component.format === 'TEXT') {
            headerType = 'TEXT'
            headerContent = component.text || null
          } else if (component.format === 'IMAGE') {
            headerType = 'IMAGE'
            headerContent = component.example?.header_handle?.[0] || null
          } else if (component.format === 'VIDEO') {
            headerType = 'VIDEO'
            headerContent = component.example?.header_handle?.[0] || null
          } else if (component.format === 'DOCUMENT') {
            headerType = 'DOCUMENT'
            headerContent = component.example?.header_handle?.[0] || null
          }
        } else if (component.type === 'FOOTER') {
          footerText = component.text || ''
        } else if (component.type === 'BUTTONS') {
          buttons =
            component.buttons && component.buttons.length > 0
              ? (component.buttons as Prisma.InputJsonValue)
              : Prisma.JsonNull
        }
      }
    }

    const existing = await prisma.template.findFirst({
      where: {
        metaAccountId: metaAccount.id,
        metaTemplateName: metaTemplate.name,
      },
    })

    const variables: string[] = []
    const variableMatches = bodyText.match(/\{\{(\d+)\}\}/g) || []
    variableMatches.forEach((match: string) => {
      const num = match.replace(/\{|\}/g, '')
      if (!variables.includes(num)) {
        variables.push(num)
      }
    })

    const templateData = {
      name: metaTemplate.name
        .split('_')
        .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' '),
      metaTemplateName: metaTemplate.name,
      category: metaTemplate.category,
      language: metaTemplate.language,
      status:
        metaTemplate.status === 'APPROVED'
          ? ('APPROVED' as const)
          : metaTemplate.status === 'REJECTED'
            ? ('REJECTED' as const)
            : ('PENDING' as const),
      bodyText,
      headerType,
      headerContent,
      footerText: footerText || null,
      buttons,
      variables,
      metaTemplateId: metaTemplate.id,
      metaAccountId: metaAccount.id,
    }

    if (existing) {
      await prisma.template.update({
        where: { id: existing.id },
        data: templateData,
      })
      updated++
    } else {
      await prisma.template.create({
        data: templateData,
      })
      synced++
    }
  }

  return {
    synced,
    updated,
    total: templates.length,
  }
}

