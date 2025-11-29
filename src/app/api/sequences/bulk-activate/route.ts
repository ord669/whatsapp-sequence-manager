import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logger, toError } from '@/lib/logger'

const log = logger.child({ route: 'sequences/bulk-activate' })

export async function POST(request: Request) {
	try {
		const body = await request.json()
		const { ids } = body

		if (!ids || !Array.isArray(ids) || ids.length === 0) {
			return NextResponse.json(
				{ error: 'Invalid or empty sequence IDs array' },
				{ status: 400 }
			)
		}

		const result = await prisma.sequence.updateMany({
			where: {
				id: { in: ids },
				deletedAt: null,
			},
			data: {
				status: 'ACTIVE',
				isActive: true,
				deletedAt: null,
			},
		})

		return NextResponse.json({
			success: true,
			updatedCount: result.count,
		})
	} catch (error) {
		log.error({ err: toError(error) }, 'Error bulk activating sequences')
		return NextResponse.json(
			{ error: 'Failed to activate sequences' },
			{ status: 500 }
		)
	}
}



