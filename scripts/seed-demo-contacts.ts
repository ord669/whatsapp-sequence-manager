import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const firstNames = [
	'Sophia',
	'Liam',
	'Olivia',
	'Noah',
	'Emma',
	'Aiden',
	'Ava',
	'Ethan',
	'Isabella',
	'Mason',
	'Mia',
	'Logan',
	'Amelia',
	'Lucas',
	'Harper',
]

const lastNames = [
	'Jackson',
	'Nguyen',
	'Patel',
	'Kim',
	'Smith',
	'Garcia',
	'Brown',
	'Rodriguez',
	'Wilson',
	'Martinez',
	'Anderson',
	'Taylor',
	'Thomas',
	'Moore',
	'Perez',
]

const demoContacts = Array.from({ length: 30 }).map((_, index) => {
	const firstName = firstNames[index % firstNames.length]
	const lastName = lastNames[(index * 2) % lastNames.length]

	return {
		phoneNumber: `+1555000${String(index + 1).padStart(4, '0')}`,
		firstName,
		lastName,
		chatwootConversationId: Math.random() > 0.6 ? `CW-${2000 + index}` : null,
		chatwootInboxId: Math.random() > 0.7 ? `IN-${50 + index}` : null,
		chatwootSourceId: Math.random() > 0.7 ? `SRC-${100 + index}` : null,
		createdAt: new Date(Date.now() - index * 1000 * 60 * 60),
		updatedAt: new Date(Date.now() - index * 1000 * 60 * 60),
	}
})

async function main() {
	for (const contact of demoContacts) {
		await prisma.contact.upsert({
			where: { phoneNumber: contact.phoneNumber },
			update: contact,
			create: contact,
		})
	}

	console.log(`Seeded ${demoContacts.length} demo contacts ✅`)
}

main()
	.catch((error) => {
		console.error('Failed to seed demo contacts', error)
		process.exit(1)
	})
	.finally(async () => {
		await prisma.$disconnect()
	})

