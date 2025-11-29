'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
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
import { cn } from '@/lib/utils'

const STORAGE_KEY = 'sequence-wizard-draft'
const STORAGE_VERSION = 2

interface MetaAccount {
	id: string
	phoneNumber: string
	displayName: string
	isActive: boolean
}

interface SequenceWizardProps {
	initialSequenceId?: string | null
}

export function SequenceWizard({ initialSequenceId = null }: SequenceWizardProps) {
	const router = useRouter()
	const [formData, setFormData] = useState({
		name: '',
		description: '',
		metaAccountId: '',
		status: 'DRAFT' as 'DRAFT' | 'ACTIVE',
	})
	const [steps, setSteps] = useState<SequenceStep[]>([])
	const [sequenceId, setSequenceId] = useState<string | null>(initialSequenceId || null)
	const [isSavingDraft, setIsSavingDraft] = useState(false)
	const [isLoadingSequence, setIsLoadingSequence] = useState(false)
	const [shouldFetchSequence, setShouldFetchSequence] = useState(Boolean(initialSequenceId))

	const wizardSteps = useMemo(
		() => [
			{
				title: 'Sequence Details',
				description: 'Name, WhatsApp account, description, and status',
			},
			{
				title: 'Sequence Flow',
				description: 'Design each step of the WhatsApp journey',
			},
		],
		[]
	)
	const [currentStep, setCurrentStep] = useState(0)

	useEffect(() => {
		if (!initialSequenceId) return
		setSequenceId(initialSequenceId)
		setShouldFetchSequence(true)
	}, [initialSequenceId])

	useEffect(() => {
		if (initialSequenceId) return
		if (typeof window === 'undefined') return
		const stored = localStorage.getItem(STORAGE_KEY)
		if (!stored) return

		try {
			const parsed = JSON.parse(stored)

			if (parsed.version !== STORAGE_VERSION) {
				localStorage.removeItem(STORAGE_KEY)
				return
			}

			if (parsed.formData) setFormData(parsed.formData)
			if (Array.isArray(parsed.steps)) setSteps(parsed.steps)
			if (parsed.sequenceId) {
				setSequenceId(parsed.sequenceId)
				setShouldFetchSequence(true)
			}
			if (typeof parsed.currentStep === 'number') {
				setCurrentStep(Math.min(parsed.currentStep, wizardSteps.length - 1))
			}
		} catch (error) {
			console.error('Failed to parse stored sequence data', error)
		}
	}, [initialSequenceId, wizardSteps.length])

	useEffect(() => {
		if (initialSequenceId) return
		if (typeof window === 'undefined') return
		localStorage.setItem(
			STORAGE_KEY,
			JSON.stringify({
				version: STORAGE_VERSION,
				formData,
				steps,
				currentStep,
				sequenceId,
			})
		)
	}, [formData, steps, currentStep, sequenceId, initialSequenceId])

	const fetchSequence = useCallback(
		async (id: string) => {
			setIsLoadingSequence(true)
			try {
				const res = await fetch(`/api/sequences/${id}`)
				if (!res.ok) throw new Error('Failed to load sequence')
				const data = await res.json()

				setFormData({
					name: data.name || '',
					description: data.description || '',
					metaAccountId: data.metaAccountId || '',
					status: (data.status as 'DRAFT' | 'ACTIVE') || 'DRAFT',
				})

				if (data.steps && Array.isArray(data.steps)) {
					const mappedSteps: SequenceStep[] = data.steps.map((step: any, index: number) => ({
						id: step.nodeId || step.id || `step-${index}`,
						type: step.nodeType || 'MESSAGE',
						templateId: step.template?.id || step.templateId || '',
						templateName: step.template?.name || step.templateName,
						templatePreview: step.template?.bodyText || step.templatePreview,
						variableValues:
							(step.variableValues as Record<string, string> | null) || {},
						label:
							step.template?.name ||
							step.label ||
							(step.nodeType === 'DELAY'
								? 'Delay'
								: `Step ${step.stepOrder ?? index + 1}`),
						delayValue: step.delayValue ?? 0,
						delayUnit: step.delayUnit ?? 'MINUTES',
						scheduledTime: step.scheduledTime || null,
						burstTemplates: step.burstTemplates || undefined,
					}))
					setSteps(mappedSteps)
				} else {
					setSteps([])
				}
			} catch (error) {
				console.error(error)
				alert('Failed to load sequence. Please refresh and try again.')
			} finally {
				setIsLoadingSequence(false)
				setShouldFetchSequence(false)
			}
		},
		[]
	)

	useEffect(() => {
		if (shouldFetchSequence && sequenceId) {
			void fetchSequence(sequenceId)
		}
	}, [fetchSequence, sequenceId, shouldFetchSequence])

	const { data: metaAccounts } = useQuery<MetaAccount[]>({
		queryKey: ['meta-accounts'],
		queryFn: async () => {
			const res = await fetch('/api/meta-accounts')
			if (!res.ok) throw new Error('Failed to fetch accounts')
			return res.json()
		},
	})

	const selectableAccounts =
		metaAccounts?.filter(
			(account) => account.isActive || account.id === formData.metaAccountId
		) || []

	const saveSequenceDraft = useCallback(
		async (nextSteps?: SequenceStep[]) => {
			if (!formData.name.trim() || !formData.metaAccountId) return null

			const isInitialDraft = !sequenceId
			setIsSavingDraft(true)
			try {
				const payload = {
					name: formData.name.trim(),
					description: formData.description,
					metaAccountId: formData.metaAccountId,
					status: isInitialDraft ? 'DRAFT' : formData.status,
					steps: nextSteps ?? steps,
				}

				const url = sequenceId ? `/api/sequences/${sequenceId}` : '/api/sequences'
				const method = sequenceId ? 'PATCH' : 'POST'
				const res = await fetch(url, {
					method,
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(payload),
				})

				if (!res.ok) {
					const data = await res.json()
					throw new Error(data.error || 'Failed to save draft')
				}

				const data = await res.json()
				if (!sequenceId && data?.id) {
					setSequenceId(data.id)
				}
				return data?.id || sequenceId
			} finally {
				setIsSavingDraft(false)
			}
		},
		[formData, sequenceId, steps]
	)

	const createMutation = useMutation({
		mutationFn: async () => {
			const payload = {
				name: formData.name.trim(),
				description: formData.description,
				metaAccountId: formData.metaAccountId,
				status: formData.status,
				steps,
			}

			const url = sequenceId ? `/api/sequences/${sequenceId}` : '/api/sequences'
			const method = sequenceId ? 'PATCH' : 'POST'

			const res = await fetch(url, {
				method,
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload),
			})

			if (!res.ok) {
				const data = await res.json()
				throw new Error(data.error || 'Failed to save sequence')
			}

			const data = await res.json()
			if (!sequenceId && data?.id) {
				setSequenceId(data.id)
			}
			return data
		},
		onSuccess: () => {
			if (typeof window !== 'undefined' && !initialSequenceId) {
				localStorage.removeItem(STORAGE_KEY)
			}
			router.push('/dashboard/sequences')
		},
	})

	const handleContinueToFlow = async () => {
		if (!canProceedToFlow) {
			alert('Please fill in the required fields.')
			return
		}

		try {
			await saveSequenceDraft()
			goToNextStep()
		} catch (error) {
			console.error(error)
			alert('Failed to save draft. Please try again.')
		}
	}

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault()

		if (currentStep < wizardSteps.length - 1) {
			await handleContinueToFlow()
			return
		}

		if (!formData.name || !formData.metaAccountId) {
			alert('Please fill in the required fields.')
			return
		}

		if (steps.length === 0) {
			alert('Please add at least one step to your sequence.')
			return
		}

		createMutation.mutate()
	}

	const formId = 'sequence-wizard-form'
	const isDetailsStep = currentStep === 0
	const isFlowStep = currentStep === 1
	const canProceedToFlow = Boolean(formData.name.trim()) && Boolean(formData.metaAccountId)
	const canCreateSequence =
		canProceedToFlow &&
		steps.length > 0 &&
		!createMutation.isPending &&
		!isSavingDraft &&
		!isLoadingSequence
	const goToPreviousStep = () => setCurrentStep((prev) => Math.max(0, prev - 1))
	const goToNextStep = () => setCurrentStep((prev) => Math.min(wizardSteps.length - 1, prev + 1))

	const handleStepsChange = (updatedSteps: SequenceStep[]) => {
		setSteps(updatedSteps)
		if (formData.name.trim() && formData.metaAccountId) {
			void (async () => {
				try {
					await saveSequenceDraft(updatedSteps)
				} catch (error) {
					console.error(error)
					alert('Failed to auto-save draft. Please check your connection.')
				}
			})()
		}
	}

	const isEditingExisting = Boolean(initialSequenceId || sequenceId)
	const pageTitle = isEditingExisting ? 'Edit Sequence' : 'Create New Sequence'
	const pageDescription = isEditingExisting
		? 'Update your WhatsApp automation journey with the guided wizard'
		: 'Design a WhatsApp automation journey with a guided wizard'
	const finalCtaLabel = createMutation.isPending
		? isEditingExisting
			? 'Saving...'
			: 'Creating...'
		: isEditingExisting
		? 'Save Changes'
		: 'Create Sequence'

	return (
		<PageChrome
			title={pageTitle}
			description={pageDescription}
			showSearchSection={false}
			headerActions={
				<Link href="/dashboard/sequences">
					<Button variant="ghost" size="sm">
						<ArrowLeft className="mr-2 h-4 w-4" />
						Back to Sequences
					</Button>
				</Link>
			}
			footerContent={
				<div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
					<Link href="/dashboard/sequences">
						<Button type="button" variant="outline" className="w-full md:w-auto">
							Cancel
						</Button>
					</Link>
					<div className="flex flex-col gap-3 md:flex-row">
						{currentStep > 0 && (
							<Button
								type="button"
								variant="outline"
								className="w-full md:w-auto"
								onClick={goToPreviousStep}>
								Back
							</Button>
						)}

						{currentStep < wizardSteps.length - 1 ? (
							<Button
								type="button"
								className="w-full md:w-auto"
								onClick={handleContinueToFlow}
								disabled={!canProceedToFlow || isSavingDraft || isLoadingSequence}>
								{isSavingDraft ? 'Saving draft...' : 'Continue to Flow'}
							</Button>
						) : (
							<Button
								form={formId}
								type="submit"
								className="w-full md:w-auto"
								disabled={!canCreateSequence}>
								{finalCtaLabel}
							</Button>
						)}
					</div>
				</div>
			}>
			<form id={formId} onSubmit={handleSubmit} className="flex min-h-0 flex-col gap-6">
				<div className="grid gap-4 md:grid-cols-2">
					{wizardSteps.map((step, index) => {
						const isActive = index === currentStep
						const isComplete = index < currentStep
						return (
							<div
								key={step.title}
								className={cn(
									'rounded-lg border p-4 transition-colors',
									isActive ? 'border-primary bg-primary/5' : 'border-border',
									isComplete ? 'opacity-60' : ''
								)}>
								<div className="flex items-center gap-3">
									<div
										className={cn(
											'flex h-8 w-8 items-center justify-center rounded-full border text-sm font-semibold',
											isActive
												? 'border-primary text-primary'
												: 'border-muted-foreground/30 text-muted-foreground',
											isComplete && 'bg-primary text-primary-foreground border-primary'
										)}>
										{index + 1}
									</div>
									<div>
										<p className="text-sm font-medium">{step.title}</p>
										<p className="text-xs text-muted-foreground">{step.description}</p>
									</div>
								</div>
							</div>
						)
					})}
				</div>

				{isDetailsStep && (
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
								onValueChange={(value) => setFormData({ ...formData, metaAccountId: value })}
								disabled={isLoadingSequence}>
								<SelectTrigger>
									<SelectValue placeholder="Select account" />
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
				)}

				{isFlowStep && (
					<div className="flex-1 min-h-0">
						{formData.metaAccountId ? (
							isLoadingSequence ? (
								<div className="rounded-lg border-2 border-dashed py-12 text-center text-muted-foreground">
									<p>Loading sequence steps...</p>
								</div>
							) : (
								<SequenceStepBuilder
									metaAccountId={formData.metaAccountId}
									steps={steps}
									onChange={handleStepsChange}
									className="h-full"
								/>
							)
						) : (
							<div className="rounded-lg border-2 border-dashed py-12 text-center text-muted-foreground">
								<p>Please select a WhatsApp account to start building your sequence</p>
							</div>
						)}
					</div>
				)}
			</form>
		</PageChrome>
	)
}

export default SequenceWizard

