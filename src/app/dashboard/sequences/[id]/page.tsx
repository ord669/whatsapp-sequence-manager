'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Edit, Trash2, Clock } from 'lucide-react'
import Link from 'next/link'
import { DeleteConfirmDialog } from '@/components/sequences/DeleteConfirmDialog'
import { cn } from '@/lib/utils'
import { PageChrome } from '@/components/layout/PageChrome'
import { Badge as StatusBadge } from '@/components/ui/badge'

export default function ViewSequencePage() {
	const params = useParams()
	const router = useRouter()
	const queryClient = useQueryClient()
	const sequenceId = params.id as string
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

	const { data: sequence, isLoading } = useQuery({
		queryKey: ['sequence', sequenceId],
		queryFn: async () => {
			const res = await fetch(`/api/sequences/${sequenceId}`)
			if (!res.ok) throw new Error('Failed to fetch sequence')
			return res.json()
		},
	})

	const deleteMutation = useMutation({
		mutationFn: async () => {
			const res = await fetch(`/api/sequences/${sequenceId}`, {
				method: 'DELETE',
			})
			if (!res.ok) throw new Error('Failed to delete sequence')
			return res.json()
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['sequences'] })
			router.push('/dashboard/sequences')
		},
	})

	const handleDelete = () => {
		deleteMutation.mutate()
	}

	if (isLoading) {
		return <div className="p-8">Loading sequence...</div>
	}

	if (!sequence) {
		return <div className="p-8">Sequence not found</div>
	}

	const steps = sequence.steps || []

	const formatDelay = (value: number, unit: string) => {
		if (value === 0) return '0 minutes'
		const unitLabel =
			value === 1 ? unit.toLowerCase().slice(0, -1) : unit.toLowerCase()
		return `${value} ${unitLabel}`
	}

	const statusBadge =
		sequence.status === 'ACTIVE'
			? { variant: 'default' as const, label: 'Active' }
			: sequence.status === 'DRAFT'
			? { variant: 'outline' as const, label: 'Draft' }
			: { variant: 'secondary' as const, label: sequence.status || 'Inactive' }

	return (
		<PageChrome
			title={sequence.name}
			description={sequence.description || 'Sequence overview'}
			badge={<StatusBadge variant={statusBadge.variant}>{statusBadge.label}</StatusBadge>}
			headerActions={
				<Link href="/dashboard/sequences">
					<Button variant="ghost" size="sm">
						<ArrowLeft className="mr-2 h-4 w-4" />
						Back to Sequences
					</Button>
				</Link>
			}
			searchContent={
				<p className="text-sm text-muted-foreground">
					Sequence insights are static—filters are not required for this view.
				</p>
			}
			footerContent={
				<div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
					<Link href={`/dashboard/sequences/${sequenceId}/edit`}>
						<Button variant="outline" className="w-full md:w-auto">
							<Edit className="mr-2 h-4 w-4" />
							Edit Sequence
						</Button>
					</Link>
					<Button
						variant="destructive"
						className="w-full md:w-auto"
						onClick={() => setDeleteDialogOpen(true)}
						disabled={deleteMutation.isPending}>
						<Trash2 className="mr-2 h-4 w-4" />
						Delete Sequence
					</Button>
				</div>
			}>
			<div className="grid gap-6 md:grid-cols-3">
				<Card>
					<CardHeader>
						<CardTitle className="text-sm font-medium">Total Steps</CardTitle>
					</CardHeader>
					<CardContent>
						<p className="text-2xl font-bold">{steps.length}</p>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle className="text-sm font-medium">Active Subscribers</CardTitle>
					</CardHeader>
					<CardContent>
						<p className="text-2xl font-bold">{sequence._count?.subscriptions || 0}</p>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle className="text-sm font-medium">Messages Sent</CardTitle>
					</CardHeader>
					<CardContent>
						<p className="text-2xl font-bold">{sequence._count?.sentMessages || 0}</p>
					</CardContent>
				</Card>
			</div>

			<Card className="flex-1">
				<CardHeader>
					<CardTitle>Sequence Flow</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="mx-auto flex max-w-2xl flex-col items-center">
						<div className="rounded-full border-2 border-green-300 bg-green-100 px-6 py-2 font-medium text-green-700">
							Start
						</div>
						{steps.length === 0 ? (
							<div className="my-8 text-center text-muted-foreground">
								<p>No steps in this sequence.</p>
							</div>
						) : (
							steps.map((step: any) => (
								<div key={step.id} className="flex w-full flex-col items-center">
									<div className="my-2 flex flex-col items-center">
										<div className="h-4 w-px bg-gray-300" />
										{step.delayValue >= 0 && (
											<div className="flex items-center gap-1 rounded-full border px-3 py-1 text-xs text-gray-600">
												<Clock className="h-3 w-3" />
												Wait {formatDelay(step.delayValue, step.delayUnit)}
											</div>
										)}
										<div className="h-4 w-px bg-gray-300" />
										<div className="h-0 w-0 border-l-[6px] border-r-[6px] border-t-[8px] border-l-transparent border-r-transparent border-t-gray-300" />
									</div>
									<div className="w-full rounded-lg border bg-white shadow-sm">
										<div className="flex items-center gap-3 p-4">
											<div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500 text-sm font-bold text-white">
												{step.stepOrder}
											</div>
											<div className="min-w-0 flex-1">
												<div className="truncate font-medium">
													{step.template?.name || 'No template selected'}
												</div>
												<div className="truncate text-sm text-gray-500">
													{step.template?.category || 'MESSAGE'}
												</div>
											</div>
										</div>
									</div>
								</div>
							))
						)}
						{steps.length > 0 && (
							<div className="my-2 flex flex-col items-center">
								<div className="h-6 w-px bg-gray-300" />
							</div>
						)}
						<div className="mt-2 rounded-full border-2 border-gray-300 bg-gray-100 px-6 py-2 font-medium text-gray-700">
							End
						</div>
					</div>
				</CardContent>
			</Card>

			<DeleteConfirmDialog
				open={deleteDialogOpen}
				onOpenChange={setDeleteDialogOpen}
				onConfirm={handleDelete}
				title="Delete Sequence"
				description={`Are you sure you want to delete "${sequence?.name}"? This will remove the sequence and all its configuration.`}
				isLoading={deleteMutation.isPending}
			/>
		</PageChrome>
	)
}
