'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
	MoreVertical,
	Edit,
	Trash2,
	GitBranch,
	XCircle,
	Phone,
	MessageCircle,
	RefreshCw,
} from 'lucide-react'
import { cn, formatPhoneNumber } from '@/lib/utils'
import { format, formatDistanceToNow } from 'date-fns'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { AddContactDialog } from './AddContactDialog'

interface ContactRowProps {
	contact: {
		id: string
		phoneNumber: string
		firstName: string
		lastName: string
		offer?: string | null
		chatwootContactId?: string | null
		chatwootConversationId?: string | null
		chatwootInboxId?: string | null
		chatwootSourceId?: string | null
		activeSubscriptions?: Array<{
			id: string
			sequenceId: string
			sequenceName?: string
			status?: string | null
			startedAt?: string | null
			completedAt?: string | null
			nextStepOrder?: number | null
			nextMessageTitle?: string | null
		}>
		createdAt: string
		_count?: {
			subscriptions: number
		}
	}
	onDelete: () => void
	onUnsubscribe?: () => void
	disableUnsubscribe?: boolean
	onSync?: () => void
	isSyncing?: boolean
	isSelected: boolean
	onSelectChange: (value: boolean) => void
}

export function ContactRow({
	contact,
	onDelete,
	onUnsubscribe,
	disableUnsubscribe,
	onSync,
	isSyncing,
	isSelected,
	onSelectChange,
}: ContactRowProps) {
	const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
	const createdDate = new Date(contact.createdAt)
	const relativeCreatedDate = formatDistanceToNow(createdDate, { addSuffix: true })
	const hasChatwootConversation = Boolean(contact.chatwootConversationId)
	const hasChatwootContact = Boolean(contact.chatwootContactId)
	const hasChatwootData =
		hasChatwootConversation || hasChatwootContact || Boolean(contact.chatwootInboxId || contact.chatwootSourceId)
	const offerLabel = contact.offer?.trim() || ''

	return (
		<>
			<tr className="transition-colors hover:bg-primary/5">
				<td className="px-4 py-4 w-12 align-middle">
					<Checkbox
						aria-label={`Select ${contact.firstName} ${contact.lastName}`}
						checked={isSelected}
						onCheckedChange={(checked) => onSelectChange(Boolean(checked))}
					/>
				</td>
				<td className="px-6 py-4">
					<p className="text-sm font-semibold leading-tight text-foreground">
						{contact.firstName} {contact.lastName}
					</p>
				</td>
				<td className="px-6 py-4">
					<div className="inline-flex items-center gap-2 rounded-full border border-dashed border-border/70 bg-background px-3 py-1 text-xs font-medium text-foreground shadow-sm">
						<Phone className="h-3.5 w-3.5 text-muted-foreground" />
						<span>{formatPhoneNumber(contact.phoneNumber)}</span>
					</div>
				</td>
				<td className="px-6 py-4">
					{offerLabel ? (
						<div className="text-sm font-medium text-foreground">{offerLabel}</div>
					) : (
						<span className="text-xs uppercase tracking-wide text-muted-foreground">Not set</span>
					)}
				</td>
				<td className="px-6 py-4 text-sm text-muted-foreground">
					{hasChatwootData ? (
						<div className="group relative inline-flex w-fit items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-50/80 px-3 py-1 text-[0.75rem] font-semibold text-emerald-700 shadow-sm transition-colors dark:bg-emerald-500/15">
							<MessageCircle className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
							<span>{hasChatwootConversation ? 'Conversation linked' : 'Contact linked'}</span>
							<div className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 hidden w-64 -translate-x-1/2 flex-col rounded-xl border border-border/70 bg-background p-3 text-xs text-foreground shadow-xl ring-1 ring-black/5 group-hover:flex">
								<div className="space-y-1 text-muted-foreground">
									{contact.chatwootConversationId && (
										<div className="flex items-center justify-between">
											<span className="text-[0.65rem] uppercase tracking-wide">Conversation</span>
											<span className="font-medium text-foreground">
												#{contact.chatwootConversationId}
											</span>
										</div>
									)}
									{contact.chatwootContactId && (
										<div className="flex items-center justify-between">
											<span className="text-[0.65rem] uppercase tracking-wide">Contact</span>
											<span className="font-medium text-foreground">
												#{contact.chatwootContactId}
											</span>
										</div>
									)}
									{contact.chatwootInboxId && (
										<div className="flex items-center justify-between">
											<span className="text-[0.65rem] uppercase tracking-wide">
												Inbox
											</span>
											<span className="font-medium text-foreground">
												#{contact.chatwootInboxId}
											</span>
							</div>
								)}
								{contact.chatwootSourceId && (
										<div className="flex items-center justify-between">
											<span className="text-[0.65rem] uppercase tracking-wide">
												Source
											</span>
											<span className="font-medium text-foreground">
												{contact.chatwootSourceId}
											</span>
										</div>
								)}
								</div>
							</div>
						</div>
					) : (
						<Badge variant="outline" className="border-dashed text-xs text-muted-foreground">
							Not linked
						</Badge>
					)}
				</td>
				<td className="px-6 py-4">
					{contact.activeSubscriptions && contact.activeSubscriptions.length > 0 ? (
						<div className="flex flex-wrap gap-2">
							{contact.activeSubscriptions.map((sub) => (
								<div key={sub.id} className="group relative">
									<Link
										href={`/dashboard/contacts/${contact.id}/subscriptions/${sub.id}`}
										className={cn(
											'inline-flex items-center rounded-full font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 text-xs shadow-sm border px-3 py-1',
											getSubscriptionBadgeClasses(sub)
										)}>
									<GitBranch className="mr-1 h-3 w-3" />
									{sub.sequenceName || 'Sequence'}
									</Link>
									<div className="pointer-events-none absolute left-1/2 top-full z-10 mt-2 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-[0.65rem] font-semibold text-background shadow-lg group-hover:block">
										{getSubscriptionTooltip(sub)}
									</div>
								</div>
							))}
						</div>
					) : (
						<span className="text-sm text-muted-foreground">None</span>
					)}
				</td>
				<td className="px-6 py-4 text-sm text-muted-foreground">
					<div className="relative inline-block group">
						<div className="font-medium text-foreground">{format(createdDate, 'MMM d, yyyy')}</div>
						<div className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-[0.7rem] font-medium text-background shadow-lg group-hover:block">
							Added {relativeCreatedDate}
						</div>
					</div>
				</td>
				<td className="px-6 py-4 text-right">
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="ghost" size="sm">
								<MoreVertical className="h-4 w-4" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							{contact.activeSubscriptions &&
								contact.activeSubscriptions.length > 0 &&
								onUnsubscribe && (
								<DropdownMenuItem
									onClick={onUnsubscribe}
									disabled={disableUnsubscribe}
									className="text-amber-600 focus:text-amber-600">
									<XCircle className="mr-2 h-4 w-4" />
									Unsubscribe
								</DropdownMenuItem>
							)}
							{onSync && (
								<DropdownMenuItem onClick={onSync} disabled={isSyncing}>
									<RefreshCw
										className={`mr-2 h-4 w-4 ${
											isSyncing ? 'animate-spin text-primary' : ''
										}`}
									/>
									{isSyncing ? 'Syncing…' : 'Sync from Chatwoot'}
								</DropdownMenuItem>
							)}
							<DropdownMenuItem onClick={() => setIsEditDialogOpen(true)}>
								<Edit className="mr-2 h-4 w-4" />
								Edit
							</DropdownMenuItem>
							<DropdownMenuItem
								onClick={onDelete}
								className="text-destructive focus:text-destructive">
								<Trash2 className="mr-2 h-4 w-4" />
								Delete
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</td>
			</tr>

			<AddContactDialog
				open={isEditDialogOpen}
				onOpenChange={setIsEditDialogOpen}
				contact={contact}
			/>
		</>
	)
}

function getSubscriptionBadgeClasses(sub: {
	status?: string | null
	startedAt?: string | null
	completedAt?: string | null
}) {
	const status = (sub.status ?? '').toUpperCase()

	switch (status) {
		case 'FAILED':
			return 'bg-red-100 text-red-900 border-red-200'
		case 'CANCELLED':
			return 'bg-red-100 text-red-900 border-red-200'
		case 'PAUSED':
			return 'bg-blue-100 text-blue-900 border-blue-200'
		case 'COMPLETED':
			return 'bg-zinc-800 text-white border-zinc-900'
		case 'ACTIVE':
			return 'bg-zinc-100 text-zinc-800 border-zinc-200'
		default:
			return 'bg-muted text-muted-foreground border-muted-foreground/30'
	}
}

function getSubscriptionTooltip(sub: {
	nextStepOrder?: number | null
	nextMessageTitle?: string | null
	status?: string | null
}) {
	const statusLabel = (sub.status ?? 'UNKNOWN').toUpperCase()
	const statusText =
		statusLabel === 'ACTIVE'
			? 'Active'
			: statusLabel === 'PAUSED'
			? 'Paused'
			: statusLabel === 'COMPLETED'
			? 'Completed'
			: statusLabel === 'CANCELLED'
			? 'Cancelled'
			: statusLabel === 'FAILED'
			? 'Failed'
			: 'Pending'

	if (sub.nextStepOrder && sub.nextMessageTitle && statusLabel === 'ACTIVE') {
		return `${statusText} — next: Step ${sub.nextStepOrder} · ${sub.nextMessageTitle}`
	}

	if (statusLabel === 'COMPLETED') {
		return 'Completed — all messages sent'
	}

	if (statusLabel === 'CANCELLED') {
		return 'Cancelled — contact unsubscribed'
	}

	if (statusLabel === 'PAUSED') {
		return 'Paused — waiting to resume'
	}

	if (statusLabel === 'FAILED') {
		return 'Failed — needs attention'
	}

	return `${statusText} — next step not scheduled yet`
}
