import { PrismaClient, Prisma, TemplateStatus } from '@prisma/client'

const prisma = new PrismaClient()

const folderNames = ['Show', 'Product Updates', 'Customer Success']
const categories = ['MARKETING', 'UTILITY', 'AUTHENTICATION']
const languages = ['en_US', 'he_IL', 'es_ES']
const messages = [
  'Hello {{1}}, this is a friendly reminder about your upcoming call.',
  'Hi {{1}}, thanks for checking in! Here is the update you asked for.',
  'Hey {{1}}, welcome aboard. Let us know how we can help.',
  'שלום {{1}}, איך אפשר לסייע לך היום?',
  '¡Hola {{1}}! Queríamos compartir una novedad contigo.',
]

async function ensureFolders() {
  const created: string[] = []
  for (const [index, name] of folderNames.entries()) {
    const folder = await prisma.templateFolder.upsert({
      where: { name },
      update: {},
      create: {
        name,
        sortOrder: index + 1,
      },
    })
    created.push(folder.id)
  }
  return created
}

async function main() {
  const metaAccount = await prisma.metaAccount.findFirst()
  if (!metaAccount) {
    throw new Error('No Meta account found. Connect an account before seeding templates.')
  }

  const folderIds = await ensureFolders()
  const templatesToCreate = 30

  for (let i = 0; i < templatesToCreate; i++) {
    const metaTemplateName = `demo_template_${i + 1}`
    const folderId = i % (folderIds.length + 1) < folderIds.length ? folderIds[i % folderIds.length] : null
    const status = ['APPROVED', 'PENDING', 'REJECTED'][i % 3] as TemplateStatus
    const category = categories[i % categories.length]
    const language = languages[i % languages.length]
    const bodyText = messages[i % messages.length] + ` (Demo #${i + 1})`

    await prisma.template.upsert({
      where: {
        metaAccountId_metaTemplateName: {
          metaAccountId: metaAccount.id,
          metaTemplateName,
        },
      },
      update: {
        name: metaTemplateName.split('_').join(' '),
        category,
        language,
        status,
        folderId,
        bodyText,
        variables: [{ name: 'firstName', example: 'Ava' }],
        headerType: null,
        headerContent: null,
        footerText: 'Demo template footer',
        buttons: Prisma.JsonNull,
      },
      create: {
        name: metaTemplateName.split('_').join(' '),
        metaTemplateName,
        metaTemplateId: `demo-${i + 1}`,
        metaAccountId: metaAccount.id,
        category,
        language,
        status,
        folderId,
        bodyText,
        variables: [{ name: 'firstName', example: 'Ava' }],
        footerText: 'Demo template footer',
        buttons: Prisma.JsonNull,
      },
    })
  }

  console.log(`Seeded ${templatesToCreate} demo templates`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

