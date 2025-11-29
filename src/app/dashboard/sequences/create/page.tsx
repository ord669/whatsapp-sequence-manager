'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation, useQuery } from '@tanstack/react-query'
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
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { SequenceStepBuilder, SequenceStep } from '@/components/sequences/SequenceStepBuilder'
import { PageChrome } from '@/components/layout/PageChrome'

interface MetaAccount {
	id: string
	phoneNumber: string
	displayName: string
	isActive: boolean
}

export default function CreateSequencePage() {
	const router = useRouter()
	const [formData, setFormData] = useState({
		name: '',
		description: '',
		metaAccountId: '',
		status: 'DRAFT',
	})
	const [steps, setSteps] = useState<SequenceStep[]>([])

	const { data: metaAccounts } = useQuery<MetaAccount[]>({
		queryKey: ['meta-accounts'],
		queryFn: async () => {
			const res = await fetch('/api/meta-accounts')
			if (!res.ok) throw new Error('Failed to fetch accounts')
			return res.json()
		},
	})

	const createMutation = useMutation({
		mutationFn: async () => {
			const res = await fetch('/api/sequences', {
				method: 'POST',
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
				throw new Error(data.error || 'Failed to create sequence')
			}
			return res.json()
		},
		onSuccess: () => {
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

		createMutation.mutate()
	}

	const activeAccounts = metaAccounts?.filter((acc) => acc.isActive) || []

	const formId = 'create-sequence-form'

	return (
		<PageChrome
			title="Create New Sequence"
			description="Design a WhatsApp automation journey from scratch"
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
					Sequence builders do not require search or filters for now.
				</p>
			}
			footerContent={
				<div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
					<Link href="/dashboard/sequences">
						<Button type="button" variant="outline" className="w-full md:w-auto">
							Cancel
						</Button>
					</Link>
					<Button
						form={formId}
						type="submit"
						className="w-full md:w-auto"
						disabled={
							createMutation.isPending ||
							!formData.metaAccountId ||
							!formData.name ||
							steps.length === 0
						}>
						{createMutation.isPending ? 'Creating...' : 'Create Sequence'}
					</Button>
				</div>
			}>
			<form id={formId} onSubmit={handleSubmit} className="space-y-6">
				<div className="grid max-w-4xl gap-4 md:grid-cols-2">
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
						<Select
							value={formData.metaAccountId}
							onValueChange={(value) => setFormData({ ...formData, metaAccountId: value })}>
							<SelectTrigger>
								<SelectValue placeholder="Select account" />
							</SelectTrigger>
							<SelectContent>
								{activeAccounts.map((account) => (
									<SelectItem key={account.id} value={account.id}>
										{account.phoneNumber} - {account.displayName}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					<div className="space-y-2 md:col-span-2">
						<Label htmlFor="description">Description (Optional)</Label>
						<Input
							id="description"
							value={formData.description}
							onChange={(e) => setFormData({ ...formData, description: e.target.value })}
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
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="DRAFT">Draft</SelectItem>
								<SelectItem value="ACTIVE">Active</SelectItem>
							</SelectContent>
						</Select>
					</div>
				</div>

				{formData.metaAccountId ? (
					<SequenceStepBuilder
						metaAccountId={formData.metaAccountId}
						steps={steps}
						onChange={setSteps}
					/>
				) : (
					<div className="rounded-lg border-2 border-dashed py-12 text-center text-muted-foreground">
						<p>Please select a WhatsApp account to start building your sequence</p>
					</div>
				)}
			</form>
		</PageChrome>
	)
}
