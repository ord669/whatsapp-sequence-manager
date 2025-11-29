import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const DEMO_FOLDER_NAMES = ['Show', 'Product Updates', 'Customer Success']
const DEMO_TEMPLATE_NAME_PREFIX = 'demo_template_'
const DEMO_TEMPLATE_ID_PREFIX = 'demo-'

async function main() {
	const demoTemplates = await prisma.template.findMany({
		where: {
			OR: [
				{ metaTemplateName: { startsWith: DEMO_TEMPLATE_NAME_PREFIX } },
				{ metaTemplateId: { startsWith: DEMO_TEMPLATE_ID_PREFIX } },
				{ name: { startsWith: 'demo template', mode: 'insensitive' } },
			],
		},
		select: { id: true },
	})

	const templateIds = demoTemplates.map((template) => template.id)

	const [removedSteps, removedTemplates] =
		templateIds.length > 0
			? await prisma.$transaction([
					prisma.sequenceStep.deleteMany({
						where: {
							templateId: {
								in: templateIds,
							},
						},
					}),
					prisma.template.deleteMany({
						where: {
							id: {
								in: templateIds,
							},
						},
					}),
				])
			: [{ count: 0 }, { count: 0 }]

	const removedFolders = await prisma.templateFolder.deleteMany({
		where: {
			name: {
				in: DEMO_FOLDER_NAMES,
			},
		},
	})

	console.log(
		[
			`Removed ${removedTemplates.count} demo templates`,
			removedSteps.count > 0 ? `removed ${removedSteps.count} linked sequence steps` : null,
			removedFolders.count > 0 ? `removed ${removedFolders.count} demo folders` : null,
		]
			.filter(Boolean)
			.join(', ') || 'No demo templates or folders found'
	)
}

main()
	.catch((error) => {
		console.error('Failed to remove demo templates/folders', error)
		process.exit(1)
	})
	.finally(async () => {
		await prisma.$disconnect()
	})


