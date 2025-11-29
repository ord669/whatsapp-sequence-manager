import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logger, toError } from '@/lib/logger'

const log = logger.child({ route: 'sequences/bulk-delete' })

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

		// Soft delete multiple sequences
		await prisma.sequence.updateMany({
			where: {
				id: { in: ids },
			},
			data: {
				deletedAt: new Date(),
				status: 'INACTIVE',
				isActive: false,
			},
		})

		return NextResponse.json({
			success: true,
			deletedCount: ids.length,
		})
	} catch (error) {
		log.error({ err: toError(error) }, 'Error bulk deleting sequences')
		return NextResponse.json(
			{ error: 'Failed to delete sequences' },
			{ status: 500 }
		)
	}
}

