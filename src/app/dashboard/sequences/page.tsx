'use client'

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select'
import {
	Plus,
	GitBranch,
	Eye,
	Edit,
	Calendar,
	Trash2,
	Search,
	Filter,
	Play,
	Copy,
} from 'lucide-react'
import Link from 'next/link'
import { DeleteConfirmDialog } from '@/components/sequences/DeleteConfirmDialog'
import { PageChrome } from '@/components/layout/PageChrome'

export default function SequencesPage() {
	const queryClient = useQueryClient()
	const [searchQuery, setSearchQuery] = useState('')
	const [statusFilter, setStatusFilter] = useState<string>('all')
	const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

	const { data: sequences, isLoading } = useQuery({
		queryKey: ['sequences'],
		queryFn: async () => {
			const res = await fetch('/api/sequences')
			if (!res.ok) throw new Error('Failed to fetch sequences')
			return res.json()
		},
	})

	const deleteMutation = useMutation({
		mutationFn: async () => {
			const ids = Array.from(selectedIds)
			const res = await fetch('/api/sequences/bulk-delete', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ ids }),
			})
			if (!res.ok) throw new Error('Failed to delete sequences')
			return res.json()
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['sequences'] })
			setSelectedIds(new Set())
			setDeleteDialogOpen(false)
		},
	})

	const activateMutation = useMutation({
		mutationFn: async () => {
			const ids = Array.from(selectedIds)
			const res = await fetch('/api/sequences/bulk-activate', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ ids }),
			})
			if (!res.ok) throw new Error('Failed to activate sequences')
			return res.json()
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['sequences'] })
			setSelectedIds(new Set())
		},
	})

	const duplicateMutation = useMutation({
		mutationFn: async () => {
			const ids = Array.from(selectedIds)
			const res = await fetch('/api/sequences/bulk-duplicate', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ ids }),
			})
			if (!res.ok) throw new Error('Failed to duplicate sequences')
			return res.json()
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['sequences'] })
			setSelectedIds(new Set())
		},
	})

	// Filter and search sequences
	const filteredSequences = useMemo(() => {
		if (!sequences) return []

		return sequences.filter((seq: any) => {
			// Search filter
			const matchesSearch =
				searchQuery === '' ||
				seq.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
				seq.description?.toLowerCase().includes(searchQuery.toLowerCase())

			// Status filter
			const matchesStatus = statusFilter === 'all' || seq.status === statusFilter

			return matchesSearch && matchesStatus
		})
	}, [sequences, searchQuery, statusFilter])

	const selectedSequences = useMemo(() => {
		if (!sequences) return []
		return sequences.filter((seq: any) => selectedIds.has(seq.id))
	}, [sequences, selectedIds])

	const activatableCount = useMemo(() => {
		return selectedSequences.reduce(
			(count: number, seq: any) => count + (seq.status !== 'ACTIVE' ? 1 : 0),
			0
		)
	}, [selectedSequences])

	const hasActivatableSequences = activatableCount > 0

	const toggleSelectAll = () => {
		if (selectedIds.size === filteredSequences.length) {
			setSelectedIds(new Set())
		} else {
			setSelectedIds(new Set(filteredSequences.map((s: any) => s.id)))
		}
	}

	const toggleSelect = (id: string) => {
		const newSelected = new Set(selectedIds)
		if (newSelected.has(id)) {
			newSelected.delete(id)
		} else {
			newSelected.add(id)
		}
		setSelectedIds(newSelected)
	}

	const handleDelete = () => {
		if (selectedIds.size > 0) {
			setDeleteDialogOpen(true)
		}
	}

	const handleActivate = () => {
		if (selectedIds.size === 0 || !hasActivatableSequences) return
		activateMutation.mutate()
	}

	const handleDuplicate = () => {
		if (selectedIds.size === 0 || duplicateMutation.isPending) return
		duplicateMutation.mutate()
	}

	const footerContent = (
		<div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
			<div className="flex flex-wrap items-center gap-2">
				<Link href="/dashboard/sequences/create">
					<Button className="rounded-full">
						<Plus className="mr-2 h-4 w-4" />
						Create Sequence
					</Button>
				</Link>
			</div>
			<div className="flex flex-1 flex-col gap-3 text-sm lg:flex-row lg:items-center lg:justify-end">
				<div>
					<span className="font-medium text-foreground">
						{selectedIds.size > 0
							? `${selectedIds.size} sequence(s) selected`
							: 'No sequences selected'}
					</span>
					<span className="ml-2 text-muted-foreground">
						{selectedIds.size > 0
							? 'Bulk actions apply to the current selection.'
							: 'Select sequences to enable bulk actions.'}
					</span>
				</div>
				<div className="flex flex-wrap justify-end gap-2">
					<Button
						onClick={handleActivate}
						disabled={
							selectedIds.size === 0 ||
							activateMutation.isPending ||
							!hasActivatableSequences
						}
						className="rounded-full"
						variant="secondary">
						<Play className="mr-2 h-4 w-4" />
						Activate ({activatableCount})
					</Button>
					<Button
						onClick={handleDuplicate}
						disabled={selectedIds.size === 0 || duplicateMutation.isPending}
						variant="outline"
						className="rounded-full">
						<Copy className="mr-2 h-4 w-4" />
						Duplicate ({selectedIds.size})
					</Button>
					<Button
						variant="destructive"
						onClick={handleDelete}
						disabled={selectedIds.size === 0 || deleteMutation.isPending}
						className="rounded-full">
						<Trash2 className="mr-2 h-4 w-4" />
						Delete ({selectedIds.size})
					</Button>
				</div>
			</div>
		</div>
	)

	return (
		<PageChrome
			title="Sequences"
			description="Build automated WhatsApp message sequences with visual flowcharts"
			searchContent={
				<div className="relative w-full">
					<Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
					<Input
						placeholder="Search sequences by name or description..."
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						className="h-11 w-full rounded-2xl border-slate-200 pl-12"
					/>
				</div>
			}
			filtersContent={
				<Select value={statusFilter} onValueChange={setStatusFilter}>
					<SelectTrigger className="w-[190px] rounded-2xl border-slate-200">
						<Filter className="mr-2 h-4 w-4" />
						<SelectValue placeholder="All status" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">All Status</SelectItem>
						<SelectItem value="ACTIVE">Active</SelectItem>
						<SelectItem value="DRAFT">Draft</SelectItem>
						<SelectItem value="INACTIVE">Inactive</SelectItem>
					</SelectContent>
				</Select>
			}
			footerContent={footerContent}>
			<div className="flex h-full min-h-0 flex-1 flex-col gap-6">
				{/* Select All Checkbox */}
				{filteredSequences.length > 0 && (
					<div className="flex items-center gap-2 px-1">
						<Checkbox
							checked={
								selectedIds.size === filteredSequences.length &&
								filteredSequences.length > 0
							}
							onCheckedChange={toggleSelectAll}
						/>
						<label className="text-sm text-muted-foreground">
							{selectedIds.size > 0 ? `${selectedIds.size} selected` : 'Select all'}
						</label>
					</div>
				)}

				<div className="min-h-0 flex-1 overflow-hidden">
					{isLoading ? (
						<div className="py-12 text-center">
							<p className="text-muted-foreground">Loading sequences...</p>
						</div>
					) : !sequences || sequences.length === 0 ? (
						<Card className="rounded-[24px] border border-slate-200 shadow-sm">
							<CardContent className="py-12 text-center">
								<GitBranch className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
								<h3 className="mb-2 text-lg font-semibold">No sequences yet</h3>
								<p className="mb-4 text-muted-foreground">
									Create your first automated sequence with our visual flowchart builder
								</p>
								<Link href="/dashboard/sequences/create">
									<Button>
										<Plus className="mr-2 h-4 w-4" />
										Create Sequence
									</Button>
								</Link>
							</CardContent>
						</Card>
					) : filteredSequences.length === 0 ? (
						<Card className="rounded-[24px] border border-slate-200 shadow-sm">
							<CardContent className="py-12 text-center">
								<Search className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
								<h3 className="mb-2 text-lg font-semibold">No results found</h3>
								<p className="mb-4 text-muted-foreground">
									Try adjusting your search or filter criteria
								</p>
							</CardContent>
						</Card>
					) : (
						<div className="h-full max-h-full overflow-y-auto max-h-[470px] pr-1">
							<div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
								{filteredSequences.map((sequence: any) => (
									<Card
										key={sequence.id}
										className="relative rounded-[24px] border border-slate-200 shadow-sm">
										<div className="absolute top-4 left-4 z-10">
											<Checkbox
												checked={selectedIds.has(sequence.id)}
												onCheckedChange={() => toggleSelect(sequence.id)}
											/>
										</div>
										<CardHeader className="pl-12">
											<div className="flex items-start justify-between">
												<div className="flex-1">
													<CardTitle className="text-lg">{sequence.name}</CardTitle>
													<div className="mt-2 flex items-center gap-2">
														<Badge
															variant={
																sequence.status === 'ACTIVE'
																	? 'default'
																	: sequence.status === 'DRAFT'
																	? 'outline'
																	: 'secondary'
															}>
															{sequence.status || 'Draft'}
														</Badge>
														<Badge variant="outline" className="text-xs">
															{sequence.steps?.length || 0} steps
														</Badge>
													</div>
												</div>
											</div>
										</CardHeader>
										<CardContent className="pl-12">
											{sequence.description && (
												<p className="mb-4 line-clamp-2 text-sm text-muted-foreground">
													{sequence.description}
												</p>
											)}

											<div className="mb-4 flex items-center gap-2 text-xs text-muted-foreground">
												<Calendar className="h-3 w-3" />
												<span>
													Created {new Date(sequence.createdAt).toLocaleDateString()}
												</span>
											</div>

											<div className="flex gap-2">
												<Link
													href={`/dashboard/sequences/${sequence.id}`}
													className="flex-1">
													<Button variant="outline" size="sm" className="w-full">
														<Eye className="mr-2 h-4 w-4" />
														View
													</Button>
												</Link>
												<Link
													href={`/dashboard/sequences/${sequence.id}/edit`}
													className="flex-1">
													<Button size="sm" className="w-full">
														<Edit className="mr-2 h-4 w-4" />
														Edit
													</Button>
												</Link>
											</div>
										</CardContent>
									</Card>
								))}
							</div>
						</div>
					)}
				</div>
			</div>

			{/* Delete Confirmation Dialog */}
			<DeleteConfirmDialog
				open={deleteDialogOpen}
				onOpenChange={setDeleteDialogOpen}
				onConfirm={() => deleteMutation.mutate()}
				title="Delete Sequences"
				itemCount={selectedIds.size}
				isLoading={deleteMutation.isPending}
			/>
		</PageChrome>
	)
}
