'use client'

import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Plus, RefreshCw, Search, Users, Upload } from 'lucide-react'
import { AddContactDialog } from '@/components/contacts/AddContactDialog'
import { BulkUnsubscribeDialog } from '@/components/contacts/BulkUnsubscribeDialog'
import { ContactRow } from '@/components/contacts/ContactRow'
import { BulkSubscribeDialog } from '@/components/contacts/BulkSubscribeDialog'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog'
import { PageChrome } from '@/components/layout/PageChrome'

interface Contact {
	id: string
	phoneNumber: string
	firstName: string
	lastName: string
	offer?: string | null
	createdAt: string
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
	}>
	_count?: {
		subscriptions: number
	}
}

interface ChatwootSyncSummaryEntry {
	metaAccountId: string
	displayName: string
	phoneNumber: string
	status: 'success' | 'error'
	created?: number
	updated?: number
	skipped?: number
	error?: string
}

interface ChatwootSyncResponse {
	success: boolean
	summary: ChatwootSyncSummaryEntry[]
}

export default function ContactsPage() {
	const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
	const [searchQuery, setSearchQuery] = useState('')
	const [selectedContacts, setSelectedContacts] = useState<string[]>([])
	const [isBulkSubscribeOpen, setIsBulkSubscribeOpen] = useState(false)
	const [isBulkUnsubscribeOpen, setIsBulkUnsubscribeOpen] = useState(false)
	const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
	const [deleteConfirmation, setDeleteConfirmation] = useState('')
	const [syncingContactId, setSyncingContactId] = useState<string | null>(null)
	const queryClient = useQueryClient()

	const { data: contacts, isLoading } = useQuery<Contact[]>({
		queryKey: ['contacts', searchQuery],
		queryFn: async () => {
			const params = new URLSearchParams()
			if (searchQuery) params.append('search', searchQuery)

			const res = await fetch(`/api/contacts?${params}`)
			if (!res.ok) throw new Error('Failed to fetch contacts')
			return res.json()
		},
	})

	const syncContactsMutation = useMutation({
		mutationFn: async (): Promise<ChatwootSyncResponse> => {
			const res = await fetch('/api/contacts/sync', { method: 'POST' })
			const data = await res.json()
			if (!res.ok) {
				throw new Error(data.error || 'Failed to sync contacts from Chatwoot')
			}
			return data
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['contacts'] })
		},
	})

	const syncContactMutation = useMutation({
		mutationFn: async (contactId: string) => {
			const res = await fetch('/api/contacts/sync', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ contactId }),
			})
			const data = await res.json().catch(() => ({}))
			if (!res.ok) {
				throw new Error(data.error || 'Failed to sync contact from Chatwoot')
			}
			return data
		},
		onMutate: (contactId) => {
			setSyncingContactId(contactId)
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['contacts'] })
		},
		onSettled: () => {
			setSyncingContactId(null)
		},
	})

	const deleteContactMutation = useMutation({
		mutationFn: async (id: string) => {
			const res = await fetch(`/api/contacts/${id}`, {
				method: 'DELETE',
			})
			if (!res.ok) throw new Error('Failed to delete contact')
			return res.json()
		},
		onSuccess: (_, deletedId) => {
			queryClient.invalidateQueries({ queryKey: ['contacts'] })
			setSelectedContacts((prev) => prev.filter((id) => id !== deletedId))
		},
	})

	const unsubscribeContacts = async (contactIds: string[]) => {
		const res = await fetch('/api/subscriptions/bulk-unsubscribe', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ contactIds }),
		})
		if (!res.ok) {
			const data = await res.json()
			throw new Error(data.error || 'Failed to unsubscribe contacts')
		}
		return res.json()
	}

	const singleUnsubscribeMutation = useMutation({
		mutationFn: (contactId: string) => unsubscribeContacts([contactId]),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['contacts'] })
		},
	})

	const bulkUnsubscribeMutation = useMutation({
		mutationFn: () => unsubscribeContacts(selectedContacts),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['contacts'] })
			setSelectedContacts([])
			setIsBulkUnsubscribeOpen(false)
		},
	})

	const bulkDeleteMutation = useMutation({
		mutationFn: async (contactIds: string[]) => {
			await Promise.all(
				contactIds.map(async (id) => {
					const res = await fetch(`/api/contacts/${id}`, {
						method: 'DELETE',
					})
					if (!res.ok) {
						const data = await res.json().catch(() => ({}))
						throw new Error(data.error || 'Failed to delete contact')
					}
				})
			)
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['contacts'] })
			setSelectedContacts([])
			setIsDeleteDialogOpen(false)
			setDeleteConfirmation('')
		},
	})

	useEffect(() => {
		if (!contacts) return
		setSelectedContacts((prev) =>
			prev.filter((id) => contacts.some((contact) => contact.id === id))
		)
	}, [contacts])

	const toggleSelectAll = (checked: boolean) => {
		if (!contacts) return
		if (checked) {
			setSelectedContacts(contacts.map((contact) => contact.id))
		} else {
			setSelectedContacts([])
		}
	}

	const handleSelectContact = (contactId: string, checked: boolean) => {
		setSelectedContacts((prev) => {
			if (checked) {
				return Array.from(new Set([...prev, contactId]))
			}
			return prev.filter((id) => id !== contactId)
		})
	}

	const hasContacts = Boolean(contacts && contacts.length > 0)
	const hasSelection = selectedContacts.length > 0
	const isDeleteConfirmationValid =
		deleteConfirmation.trim().toUpperCase() === 'DELETE'
	const allSelected =
		hasContacts && selectedContacts.length === (contacts?.length || 0)
	const someSelected =
		selectedContacts.length > 0 &&
		selectedContacts.length < (contacts?.length || 0)
	const selectAllChecked = allSelected
		? true
		: someSelected
		? 'indeterminate'
		: false

	const syncSummary = syncContactsMutation.data?.summary ?? []
	const successfulSyncs = syncSummary.filter((entry) => entry.status === 'success')
	const failedSyncs = syncSummary.filter((entry) => entry.status === 'error')
	const totalCreatedFromSync = successfulSyncs.reduce((sum, entry) => sum + (entry.created ?? 0), 0)
	const totalUpdatedFromSync = successfulSyncs.reduce((sum, entry) => sum + (entry.updated ?? 0), 0)

	return (
		<PageChrome
			title="Contacts"
			description="Manage your contact list for WhatsApp sequences"
			searchContent={
				<div className="relative w-full lg:max-w-md">
					<Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
					<Input
						placeholder="Search by name or phone number..."
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						className="h-11 rounded-2xl border-slate-200 pl-12"
					/>
				</div>
			}
			footerContent={
				<div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
					<div className="flex flex-wrap items-center gap-2">
						<Button variant="outline" className="rounded-full">
							<Upload className="mr-2 h-4 w-4" />
							Import CSV
						</Button>
						<Button
							variant="secondary"
							className="rounded-full"
							onClick={() => syncContactsMutation.mutate()}
							disabled={syncContactsMutation.isPending}>
							<RefreshCw
								className={`mr-2 h-4 w-4 ${
									syncContactsMutation.isPending ? 'animate-spin' : ''
								}`}
							/>
							{syncContactsMutation.isPending ? 'Syncing…' : 'Sync Chatwoot'}
						</Button>
						<Button className="rounded-full" onClick={() => setIsAddDialogOpen(true)}>
							<Plus className="mr-2 h-4 w-4" />
							Add Contact
						</Button>
					</div>
					<div className="flex flex-1 flex-col gap-3 text-sm lg:flex-row lg:items-center lg:justify-end">
						<div>
							<span className="font-medium text-foreground">
								{hasSelection ? `${selectedContacts.length} selected` : 'No contacts selected'}
							</span>
							<span className="ml-2 text-muted-foreground">
								{hasSelection
									? 'Use the actions to manage them.'
									: 'Select contacts to enable bulk actions.'}
							</span>
						</div>
						<div className="flex flex-wrap justify-end gap-2">
							<Button
								variant="outline"
								size="sm"
								disabled={!hasSelection}
								onClick={() => setSelectedContacts([])}>
								Clear selection
							</Button>
							<Button
								size="sm"
								variant="destructive"
								disabled={!hasSelection || bulkDeleteMutation.isPending}
								onClick={() => setIsDeleteDialogOpen(true)}>
								Delete
							</Button>
							<Button
								size="sm"
								variant="secondary"
								disabled={!hasSelection}
								onClick={() => setIsBulkUnsubscribeOpen(true)}>
								Unsubscribe
							</Button>
							<Button
								size="sm"
								disabled={!hasSelection}
								onClick={() => setIsBulkSubscribeOpen(true)}>
								Subscribe
							</Button>
						</div>
					</div>
				</div>
			}>
			<div className="flex flex-1 min-h-0 flex-col">
				{syncContactsMutation.isError && (
					<div className="mb-4 rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
						{(syncContactsMutation.error as Error).message}
					</div>
				)}

				{syncContactMutation.isError && (
					<div className="mb-4 rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
						{(syncContactMutation.error as Error).message}
					</div>
				)}

				{syncContactsMutation.isSuccess && successfulSyncs.length > 0 && (
					<div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
						Synced contacts from {successfulSyncs.length}{' '}
						{successfulSyncs.length === 1 ? 'account' : 'accounts'}. Created {totalCreatedFromSync}{' '}
						and updated {totalUpdatedFromSync}.
						{failedSyncs.length > 0 && (
							<span className="ml-2 text-amber-700">
								{failedSyncs.length} account{failedSyncs.length === 1 ? '' : 's'} failed. Check server
								logs for details.
							</span>
						)}
					</div>
				)}

				{isLoading ? (
					<div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-border/60 text-sm text-muted-foreground">
						Loading contacts...
					</div>
				) : contacts && contacts.length === 0 ? (
					<Card className="flex flex-1 flex-col">
						<CardContent className="flex flex-1 flex-col items-center justify-center text-center">
							<Users className="mb-4 h-12 w-12 text-muted-foreground" />
							<h3 className="mb-2 text-lg font-semibold">No contacts yet</h3>
							<p className="mb-4 text-muted-foreground">Add your first contact to start building sequences</p>
							<Button onClick={() => setIsAddDialogOpen(true)}>
								<Plus className="mr-2 h-4 w-4" />
								Add Contact
							</Button>
						</CardContent>
					</Card>
				) : (
					<Card className="flex flex-1 min-h-0 flex-col overflow-hidden rounded-[28px] border border-slate-200 shadow-sm">
						<CardContent className="flex flex-1 min-h-0 flex-col p-0">
							<div className="flex-1 min-h-0 rounded-xl border border-border/60 shadow-sm">
								<div className="relative h-full overflow-x-auto overflow-y-auto rounded-xl">
									<table className="min-w-full text-sm">
										<thead className="sticky top-0 z-10 bg-background/95 text-[0.7rem] uppercase tracking-[0.15em] text-muted-foreground/90 backdrop-blur">
											<tr>
												<th className="w-12 px-4 py-3 text-left font-semibold">
													<Checkbox
														aria-label="Select all contacts"
														checked={selectAllChecked}
														onCheckedChange={(checked) => toggleSelectAll(Boolean(checked))}
														disabled={!hasContacts}
													/>
												</th>
												<th className="px-6 py-3 text-left font-semibold">Contact</th>
												<th className="px-6 py-3 text-left font-semibold">Phone Number</th>
												<th className="px-6 py-3 text-left font-semibold">Offer they see</th>
												<th className="px-6 py-3 text-left font-semibold">Chatwoot</th>
												<th className="px-6 py-3 text-left font-semibold">Active Sequences</th>
												<th className="px-6 py-3 text-left font-semibold">Added</th>
												<th className="px-6 py-3 text-right font-semibold">Actions</th>
											</tr>
										</thead>
										<tbody className="divide-y divide-border/60 bg-background">
											{contacts?.map((contact) => (
												<ContactRow
													key={contact.id}
													contact={contact}
													onDelete={() => deleteContactMutation.mutate(contact.id)}
													onUnsubscribe={
														contact.activeSubscriptions && contact.activeSubscriptions.length > 0
															? () => singleUnsubscribeMutation.mutate(contact.id)
															: undefined
													}
													disableUnsubscribe={singleUnsubscribeMutation.isPending}
													onSync={
														contact.chatwootContactId
															? () => syncContactMutation.mutate(contact.id)
															: undefined
													}
													isSyncing={syncingContactId === contact.id && syncContactMutation.isPending}
													isSelected={selectedContacts.includes(contact.id)}
													onSelectChange={(checked) => handleSelectContact(contact.id, checked)}
												/>
											))}
										</tbody>
									</table>
								</div>
							</div>
						</CardContent>
					</Card>
				)}
			</div>

			<AddContactDialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen} />

			<BulkSubscribeDialog
				open={isBulkSubscribeOpen}
				onOpenChange={setIsBulkSubscribeOpen}
				contactIds={selectedContacts}
				onComplete={() => {
					queryClient.invalidateQueries({ queryKey: ['contacts'] })
					setSelectedContacts([])
					setIsBulkSubscribeOpen(false)
				}}
			/>

			<BulkUnsubscribeDialog
				open={isBulkUnsubscribeOpen && selectedContacts.length > 0}
				onOpenChange={(open) => {
					if (!open) setIsBulkUnsubscribeOpen(false)
				}}
				contactCount={selectedContacts.length}
				onConfirm={() => bulkUnsubscribeMutation.mutate()}
				isLoading={bulkUnsubscribeMutation.isPending}
			/>

			<Dialog
				open={isDeleteDialogOpen && hasSelection}
				onOpenChange={(open) => {
					setIsDeleteDialogOpen(open)
					if (!open) setDeleteConfirmation('')
				}}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Delete selected contacts</DialogTitle>
						<DialogDescription>
							This action removes the selected contacts. Type{' '}
							<span className="font-semibold text-destructive">DELETE</span> to confirm.
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-3">
						<p className="text-sm text-muted-foreground">
							{selectedContacts.length} contact
							{selectedContacts.length === 1 ? '' : 's'} selected.
						</p>
						<Input
							value={deleteConfirmation}
							onChange={(e) => setDeleteConfirmation(e.target.value)}
							placeholder="Type DELETE to confirm"
							autoFocus
						/>
					</div>
					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => {
								setIsDeleteDialogOpen(false)
								setDeleteConfirmation('')
							}}>
							Cancel
						</Button>
						<Button
							variant="destructive"
							disabled={!isDeleteConfirmationValid || bulkDeleteMutation.isPending}
							onClick={() => bulkDeleteMutation.mutate(selectedContacts)}>
							{bulkDeleteMutation.isPending ? 'Deleting...' : 'Delete contacts'}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</PageChrome>
	)
}
