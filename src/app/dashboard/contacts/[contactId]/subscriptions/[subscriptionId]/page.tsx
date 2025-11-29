'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog'
import { ArrowLeft, Clock, Loader2, Phone, User } from 'lucide-react'
import { format } from 'date-fns'
import { cn, formatPhoneNumber } from '@/lib/utils'

export default function ContactSequenceViewPage() {
	const params = useParams()
	const router = useRouter()
	const queryClient = useQueryClient()
	const contactId = params.contactId as string
	const subscriptionId = params.subscriptionId as string
	const [isUnsubscribeDialogOpen, setIsUnsubscribeDialogOpen] = useState(false)
	const [unsubscribeConfirmation, setUnsubscribeConfirmation] = useState('')

	const { data, isLoading, error } = useQuery({
		queryKey: ['contact-sequence-flow', contactId, subscriptionId],
		queryFn: async () => {
			const res = await fetch(`/api/contacts/${contactId}/subscriptions/${subscriptionId}`)
			if (!res.ok) {
				throw new Error('Failed to load subscription details')
			}
			return res.json()
		},
	})

	const unsubscribeMutation = useMutation({
		mutationFn: async () => {
			const res = await fetch(`/api/subscriptions/${subscriptionId}`, {
				method: 'DELETE',
			})
			if (!res.ok) throw new Error('Failed to unsubscribe contact')
			return res.json()
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['contact-sequence-flow', contactId, subscriptionId] })
			setIsUnsubscribeDialogOpen(false)
			setUnsubscribeConfirmation('')
			router.push('/dashboard/contacts')
		},
	})

	if (isLoading) {
		return (
			<div className="flex h-full items-center justify-center">
				<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
			</div>
		)
	}

	if (error || !data) {
		return (
			<div className="flex h-full flex-col items-center justify-center gap-4 text-center">
				<p className="text-muted-foreground">Unable to load this subscription.</p>
				<Button variant="outline" onClick={() => router.back()}>
					Go back
				</Button>
			</div>
		)
	}

	const { contact, subscription, sequence } = data
	const steps = sequence?.steps || []

	const getBurstDisplayEntries = (step: any) => {
		const burst = step.burstTemplates
		if (Array.isArray(burst) && burst.length > 0) {
			return burst
		}
		return [
			{
				templateName: step.template?.name || 'Message',
				templateCategory: step.template?.category || 'MESSAGE',
			},
		]
	}

	const getStepState = (step: any) => {
		const status = subscription.status ?? ''
		const normalizedStatus = status.toUpperCase()

		if (normalizedStatus === 'COMPLETED') {
			return 'completed'
		}

		const stepOrder = step.stepOrder ?? 0
		const subOrder = step.subOrder ?? 0
		const currentStep = subscription.currentStep ?? 0
		const currentSub = subscription.currentSubStep ?? 0

		const sentAlready =
			stepOrder < currentStep ||
			(stepOrder === currentStep && subOrder < currentSub)

		if (normalizedStatus === 'CANCELLED') {
			if (sentAlready) return 'completed'
			return 'cancelled'
		}

		if (sentAlready) return 'completed'
		if (stepOrder === currentStep && subOrder === currentSub) return 'current'
		return 'upcoming'
	}

	const renderStepCard = (step: any, index: number) => {
		const state = getStepState(step)
		return (
			<div key={step.id || `${step.stepOrder}-${step.subOrder}-${index}`} className="w-full flex flex-col items-center">
				{/* Connector */}
				<div className="flex flex-col items-center my-2">
					{index === 0 ? (
						<div className="w-px h-4 bg-transparent" />
					) : (
						<div className={cn('w-px h-4', getConnectorColor(state))} />
					)}
					{step.delayValue !== null && step.delayValue !== undefined && (
						<div className="flex items-center gap-1 px-3 py-1 bg-gray-100 rounded-full text-xs text-gray-600 border">
							<Clock className="h-3 w-3" />
							Wait {formatDelay(step.delayValue, step.delayUnit)}
						</div>
					)}
					<div className={cn('w-px h-4', getConnectorColor(state))} />
				</div>

				<div
					className={cn(
						'w-full border rounded-lg bg-white shadow-sm transition',
						state === 'completed' && 'border-green-300 bg-green-50',
						state === 'current' && 'border-amber-300 bg-amber-50 ring-2 ring-amber-200',
						state === 'cancelled' && 'border-red-200 bg-red-50',
						state === 'upcoming' && 'border-muted/60 bg-card text-muted-foreground'
					)}>
					<div className="flex items-center p-4 gap-3">
						<div
							className={cn(
								'flex items-center justify-center w-10 h-10 rounded-lg font-bold text-sm',
								state === 'completed'
									? 'bg-green-500 text-white'
									: state === 'current'
									? 'bg-amber-500 text-white'
									: state === 'cancelled'
									? 'bg-red-500 text-white'
									: 'bg-muted text-muted-foreground'
							)}>
							{step.stepOrder}
						</div>
						<div className="flex-1 min-w-0">
							<div className="space-y-1">
								{getBurstDisplayEntries(step).map((entry: any, msgIndex: number) => (
									<div
										key={`${step.id}-burst-${msgIndex}`}
										className="flex items-center gap-2">
										<div className="font-medium truncate">
											{entry.templateName || `Message ${msgIndex + 1}`}
										</div>
										<div className="text-xs uppercase tracking-wide text-muted-foreground">
											{entry.templateCategory || step.template?.category || 'MESSAGE'}
										</div>
									</div>
								))}
							</div>
						</div>
						<div className="text-xs text-muted-foreground">{subLabel(step)}</div>
					</div>
				</div>
			</div>
		)
	}

	return (
		<div className="flex h-full flex-col gap-6 pb-8">
			<div className="flex items-center justify-between">
				<Link href="/dashboard/contacts">
					<Button variant="ghost" size="sm">
						<ArrowLeft className="mr-2 h-4 w-4" />
						Back to contacts
					</Button>
				</Link>
			</div>

			<div className="grid gap-4 md:grid-cols-2">
				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-sm text-muted-foreground">Contact</CardTitle>
					</CardHeader>
					<CardContent className="flex items-center gap-4">
						<div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
							<User className="h-6 w-6" />
						</div>
						<div>
							<p className="text-lg font-semibold">
								{contact.firstName} {contact.lastName}
							</p>
							<div className="flex items-center gap-2 text-sm text-muted-foreground">
								<Phone className="h-3.5 w-3.5" />
								{formatPhoneNumber(contact.phoneNumber)}
							</div>
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-sm text-muted-foreground">Sequence</CardTitle>
					</CardHeader>
					<CardContent>
						<p className="text-lg font-semibold">{sequence.name}</p>
						<p className="text-sm text-muted-foreground">
							Status:{' '}
							<span className="font-medium capitalize">{subscription.status?.toLowerCase()}</span>
						</p>
						{subscription.startedAt && (
							<p className="text-xs text-muted-foreground mt-1">
								Started {format(new Date(subscription.startedAt), 'PPpp')}
							</p>
						)}
					</CardContent>
				</Card>
			</div>

			<Card className="flex-1">
				<CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
					<CardTitle>Sequence flow for this contact</CardTitle>
					<Button
						variant="destructive"
						size="sm"
						onClick={() => setIsUnsubscribeDialogOpen(true)}
						disabled={unsubscribeMutation.isPending}>
						Unsubscribe
					</Button>
				</CardHeader>
				<CardContent>
					<div className="flex flex-col items-center max-w-2xl mx-auto">
						<div className="px-6 py-2 bg-green-100 text-green-700 rounded-full font-medium border-2 border-green-300">
							Start
						</div>
						{steps.length === 0 ? (
							<div className="my-10 text-center text-muted-foreground">
								<p>This sequence has no steps yet.</p>
							</div>
						) : (
							steps.map((step: any, index: number) => renderStepCard(step, index))
						)}
						{steps.length > 0 && (
							<div className="flex flex-col items-center my-2">
								<div className="w-px h-6 bg-gray-300" />
							</div>
						)}
						<div
							className={cn(
								'px-6 py-2 rounded-full font-medium border-2 mt-2',
								subscription.status === 'COMPLETED'
									? 'bg-green-600 text-white border-green-700'
									: subscription.status === 'CANCELLED'
									? 'bg-red-600 text-white border-red-700'
									: 'bg-gray-100 text-gray-700 border-gray-300'
							)}>
							{subscription.status === 'COMPLETED'
								? 'Completed'
								: subscription.status === 'CANCELLED'
								? 'Cancelled'
								: 'End'}
						</div>
					</div>
				</CardContent>
			</Card>

			<Dialog
				open={isUnsubscribeDialogOpen}
				onOpenChange={(open) => {
					setIsUnsubscribeDialogOpen(open)
					if (!open) {
						setUnsubscribeConfirmation('')
					}
				}}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Unsubscribe contact</DialogTitle>
						<DialogDescription>
							This removes <span className="font-semibold">{contact.firstName} {contact.lastName}</span> from <span className="font-semibold">{sequence.name}</span>. Type <span className="text-destructive font-semibold">UNSUB</span> to confirm.
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-2">
						<Input
							value={unsubscribeConfirmation}
							onChange={(e) => setUnsubscribeConfirmation(e.target.value)}
							placeholder="Type UNSUB to confirm"
							autoFocus
						/>
						<p className="text-xs text-muted-foreground">
							This action is immediate and cannot be undone.
						</p>
					</div>
					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => {
								setIsUnsubscribeDialogOpen(false)
								setUnsubscribeConfirmation('')
							}}>
							Cancel
						</Button>
						<Button
							variant="destructive"
							disabled={
								unsubscribeConfirmation.trim().toUpperCase() !== 'UNSUB' ||
								unsubscribeMutation.isPending
							}
							onClick={() => unsubscribeMutation.mutate()}>
							{unsubscribeMutation.isPending ? 'Unsubscribing...' : 'Confirm unsubscribe'}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

		</div>
	)
}

function formatDelay(value: number | null | undefined, unit: string | null | undefined) {
	if (value == null) {
		value = 0
	}
	if (!unit) {
		unit = 'MINUTES'
	}
	const label =
		value === 1
			? unit.toLowerCase().replace(/s$/, '')
			: unit.toLowerCase()
	return `${value} ${label}`
}

function subLabel(step: any) {
	if (step.subOrder && step.subOrder > 0) {
		return `Sub-step ${step.subOrder}`
	}
	return ''
}

function getConnectorColor(state: string) {
	if (state === 'completed') return 'bg-green-400'
	if (state === 'current') return 'bg-amber-400'
	if (state === 'cancelled') return 'bg-red-400'
	return 'bg-gray-300'
}

