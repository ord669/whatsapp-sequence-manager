'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select'
import { ArrowLeft, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { SequenceStepBuilder, SequenceStep } from '@/components/sequences/SequenceStepBuilder'
import { DeleteConfirmDialog } from '@/components/sequences/DeleteConfirmDialog'

interface MetaAccount {
	id: string
	phoneNumber: string
	displayName: string
	isActive: boolean
}

export default function EditSequencePage() {
	const router = useRouter()
	const params = useParams()
	const sequenceId = params.id as string
	const queryClient = useQueryClient()

	const [formData, setFormData] = useState({
		name: '',
		description: '',
		metaAccountId: '',
		status: 'DRAFT' as 'DRAFT' | 'ACTIVE',
	})
	const [steps, setSteps] = useState<SequenceStep[]>([])
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

	// Fetch existing sequence
	const { data: sequence, isLoading } = useQuery({
		queryKey: ['sequence', sequenceId],
		queryFn: async () => {
			const res = await fetch(`/api/sequences/${sequenceId}`)
			if (!res.ok) throw new Error('Failed to fetch sequence')
			return res.json()
		},
	})

	// Load sequence data into form
	useEffect(() => {
		if (sequence) {
			setFormData({
				name: sequence.name,
				description: sequence.description || '',
				metaAccountId: sequence.metaAccountId || '',
				status: sequence.status || 'DRAFT',
			})

			// Load steps from sequence
			if (sequence.steps && sequence.steps.length > 0) {
				const loadedSteps: SequenceStep[] = sequence.steps.map((step: any) => ({
					id: step.id,
					type: step.nodeType || 'MESSAGE',
					templateId: step.template?.id,
					templateName: step.template?.name,
					label: step.template?.name ? `📧 ${step.template.name}` : `Step ${step.stepOrder}`,
					delayValue: step.delayValue || 0,
					delayUnit: step.delayUnit || 'MINUTES',
					scheduledTime:
						step.delayUnit === 'DAYS' ? step.scheduledTime || '09:00' : null,
					burstTemplates: step.burstTemplates || undefined,
				}))
				setSteps(loadedSteps)
			}
		}
	}, [sequence])

	const { data: accounts } = useQuery<MetaAccount[]>({
		queryKey: ['meta-accounts'],
		queryFn: async () => {
			const res = await fetch('/api/meta-accounts')
			if (!res.ok) throw new Error('Failed to fetch accounts')
			return res.json()
		},
	})

	const allAccounts = accounts || []
	const selectedAccount = allAccounts.find((a) => a.id === formData.metaAccountId)
	const selectableAccounts = selectedAccount
		? [
				selectedAccount,
				...allAccounts.filter((a) => a.isActive && a.id !== selectedAccount.id),
		  ]
		: allAccounts.filter((a) => a.isActive)
	const isSelectedAccountInactive = selectedAccount ? !selectedAccount.isActive : false

	const updateMutation = useMutation({
		mutationFn: async () => {
			const res = await fetch(`/api/sequences/${sequenceId}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					name: formData.name,
					description: formData.description,
					metaAccountId: formData.metaAccountId,
					status: formData.status,
					steps: steps,
				}),
			})
			if (!res.ok) {
				const data = await res.json()
				throw new Error(data.error || 'Failed to update sequence')
			}
			return res.json()
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['sequences'] })
			queryClient.invalidateQueries({ queryKey: ['sequence', sequenceId] })
			router.push('/dashboard/sequences')
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

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault()

		if (!formData.name || !formData.metaAccountId) {
			alert('Please fill in the required fields.')
			return
		}

		// Validate that sequence has at least one step
		if (steps.length === 0) {
			alert('Please add at least one step to your sequence.')
			return
		}

		updateMutation.mutate()
	}

	const handleDelete = () => {
		deleteMutation.mutate()
	}

	if (isLoading) {
		return <div className="p-8">Loading sequence...</div>
	}

	return (
		<div className="h-full flex flex-col overflow-hidden">
			<div className="mb-6">
				<Link href="/dashboard/sequences">
					<Button variant="ghost" size="sm">
						<ArrowLeft className="mr-2 h-4 w-4" />
						Back to Sequences
					</Button>
				</Link>
			</div>

			<h1 className="mb-6 text-3xl font-bold">Edit Sequence</h1>

			<form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-6 overflow-y-auto">
				<div className="grid gap-6 lg:grid-cols-[360px_1fr] flex-1 min-h-0">
					<div className="space-y-6">
						<div className="grid gap-4">
							<div className="space-y-2">
								<Label htmlFor="name">Sequence Name *</Label>
								<Input
									id="name"
									required
									value={formData.name}
									onChange={(e) => setFormData({ ...formData, name: e.target.value })}
									placeholder="e.g., Welcome Series"
								/>
							</div>

							<div className="space-y-2">
								<Label htmlFor="metaAccountId">WhatsApp Account *</Label>
								{selectableAccounts.length > 0 ? (
									<Select
										key={formData.metaAccountId || 'no-account'}
										value={formData.metaAccountId}
										onValueChange={(value) =>
											setFormData({ ...formData, metaAccountId: value })
										}>
										<SelectTrigger>
											<SelectValue
												placeholder="Select account"
												aria-label={
													selectedAccount
														? `${selectedAccount.phoneNumber} - ${selectedAccount.displayName}`
														: undefined
												}>
												{selectedAccount && (
													<span className="truncate">
														{selectedAccount.phoneNumber} - {selectedAccount.displayName}
														{!selectedAccount.isActive && ' (inactive)'}
													</span>
												)}
											</SelectValue>
										</SelectTrigger>
										<SelectContent>
											{selectableAccounts.map((account) => (
												<SelectItem key={account.id} value={account.id}>
													{account.phoneNumber} - {account.displayName}
													{!account.isActive && ' (inactive)'}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								) : (
									<div className="border rounded-md px-3 py-2 text-sm text-muted-foreground">
										Loading accounts...
									</div>
								)}
								{isSelectedAccountInactive && (
									<p className="text-xs text-muted-foreground">
										This WhatsApp account is currently inactive. You can still edit
										the sequence, but new subscriptions may be blocked until it is
										reactivated.
									</p>
								)}
							</div>

							<div className="space-y-2">
								<Label htmlFor="description">Description (Optional)</Label>
								<Input
									id="description"
									value={formData.description}
									onChange={(e) =>
										setFormData({ ...formData, description: e.target.value })
									}
									placeholder="What is this sequence for?"
								/>
							</div>

							<div className="space-y-2">
								<Label htmlFor="status">Status *</Label>
								<Select
									value={formData.status}
									onValueChange={(value) =>
										setFormData({ ...formData, status: value as 'DRAFT' | 'ACTIVE' })
									}>
									<SelectTrigger>
										<SelectValue placeholder="Select status" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="DRAFT">Draft</SelectItem>
										<SelectItem value="ACTIVE">Active</SelectItem>
									</SelectContent>
								</Select>
							</div>
						</div>
					</div>

					<div className="rounded-lg border bg-card flex flex-col min-h-0">
						<div className="flex-1 overflow-y-auto pb-2">
							{formData.metaAccountId ? (
								<SequenceStepBuilder
									metaAccountId={formData.metaAccountId}
									steps={steps}
									onChange={setSteps}
									className="h-full overflow-y-auto pr-2"
								/>
							) : (
								<div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg m-4">
									<p>Please select a WhatsApp account to edit your sequence</p>
								</div>
							)}
						</div>
					</div>
				</div>

				{/* Action Buttons */}
				<div className="flex justify-between gap-2 pt-6 border-t shrink-0 bg-background">
					<div className="flex gap-2">
						<Link href="/dashboard/sequences">
							<Button type="button" variant="outline">
								Cancel
							</Button>
						</Link>
						<Button
							type="button"
							variant="destructive"
							onClick={() => setDeleteDialogOpen(true)}
							disabled={updateMutation.isPending || deleteMutation.isPending}>
							<Trash2 className="mr-2 h-4 w-4" />
							Delete
						</Button>
					</div>
					<Button
						type="submit"
						disabled={
							updateMutation.isPending ||
							!formData.metaAccountId ||
							!formData.name ||
							steps.length === 0
						}>
						{updateMutation.isPending ? 'Saving...' : 'Save Changes'}
					</Button>
				</div>
			</form>

			{/* Delete Confirmation Dialog */}
			<DeleteConfirmDialog
				open={deleteDialogOpen}
				onOpenChange={setDeleteDialogOpen}
				onConfirm={handleDelete}
				title="Delete Sequence"
				description={`Are you sure you want to delete "${formData.name}"? This will remove the sequence and all its configuration.`}
				isLoading={deleteMutation.isPending}
			/>
		</div>
	)
}
