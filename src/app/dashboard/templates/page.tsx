'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
	Plus,
	Search,
	FileText,
	FolderPlus,
	RefreshCw,
	Folder,
	MoreVertical,
	Trash2,
	Check,
	Clock3,
	X,
	ChevronRight,
} from 'lucide-react'
import { AddTemplateDialog } from '@/components/templates/AddTemplateDialog'
import { AddFolderDialog } from '@/components/templates/AddFolderDialog'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { PageChrome } from '@/components/layout/PageChrome'

interface Template {
	id: string
	name: string
	metaTemplateName: string
	category: string
	status: 'PENDING' | 'APPROVED' | 'REJECTED'
	bodyText: string
	variables: any
	language: string
	metaAccount: {
		phoneNumber: string
		displayName: string
	}
	createdAt: string
	folderId?: string | null
	folder?: {
		id: string
		name: string
	} | null
}

interface TemplateFolder {
	id: string
	name: string
	sortOrder: number
	_count?: {
		templates: number
	}
}

type FolderRow = {
	id: string
	name: string
	description: string
	count: number
}

export default function TemplatesPage() {
	const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
	const [isAddFolderDialogOpen, setIsAddFolderDialogOpen] = useState(false)
	const [searchQuery, setSearchQuery] = useState('')
	const [currentFolderId, setCurrentFolderId] = useState<string | null>(null)
	const [selectedTemplates, setSelectedTemplates] = useState<Set<string>>(
		new Set()
	)
	const [isBulkMoving, setIsBulkMoving] = useState(false)
	const [folderDeleteTarget, setFolderDeleteTarget] = useState<string | null>(
		null
	)
	const queryClient = useQueryClient()

	const { data: templates, isLoading } = useQuery<Template[]>({
		queryKey: ['templates', searchQuery],
		queryFn: async () => {
			const params = new URLSearchParams()
			if (searchQuery) params.append('search', searchQuery)

			const res = await fetch(`/api/templates?${params}`)
			if (!res.ok) throw new Error('Failed to fetch templates')
			return res.json()
		},
		staleTime: 0,
		refetchOnMount: 'always',
		refetchOnWindowFocus: true,
		refetchOnReconnect: true,
	})

	const { data: folders, isLoading: isFoldersLoading } = useQuery<
		TemplateFolder[]
	>({
		queryKey: ['template-folders'],
		queryFn: async () => {
			const res = await fetch('/api/templates/folders')
			if (!res.ok) throw new Error('Failed to fetch template folders')
			return res.json()
		},
		staleTime: 0,
		refetchOnMount: 'always',
		refetchOnWindowFocus: true,
		refetchOnReconnect: true,
	})

	const deleteTemplateMutation = useMutation({
		mutationFn: async (id: string) => {
			const res = await fetch(`/api/templates/${id}`, {
				method: 'DELETE',
			})
			if (!res.ok) throw new Error('Failed to delete template')
			return res.json()
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['templates'] })
			queryClient.invalidateQueries({ queryKey: ['template-folders'] })
		},
	})

	const updateTemplateFolderMutation = useMutation({
		mutationFn: async ({
			templateId,
			folderId,
		}: {
			templateId: string
			folderId: string | null
		}) => {
			const res = await fetch(`/api/templates/${templateId}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ folderId }),
			})
			if (!res.ok) {
				const data = await res.json()
				throw new Error(data.error || 'Failed to update template')
			}
			return res.json()
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['templates'] })
			queryClient.invalidateQueries({ queryKey: ['template-folders'] })
		},
	})

	const deleteFolderMutation = useMutation({
		mutationFn: async (folderId: string) => {
			const res = await fetch(`/api/templates/folders/${folderId}`, {
				method: 'DELETE',
			})
			if (!res.ok) {
				const data = await res.json().catch(() => ({}))
				throw new Error(data.error || 'Failed to delete folder')
			}
			return res.json()
		},
		onMutate: (folderId) => {
			setFolderDeleteTarget(folderId)
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['templates'] })
			queryClient.invalidateQueries({ queryKey: ['template-folders'] })
		},
		onSettled: () => {
			setFolderDeleteTarget(null)
		},
	})

	const syncTemplatesMutation = useMutation({
		mutationFn: async () => {
			const res = await fetch('/api/templates/sync', {
				method: 'POST',
			})
			if (!res.ok) {
				const data = await res.json().catch(() => ({}))
				throw new Error(data.error || 'Failed to sync templates with Meta')
			}
			return res.json()
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['templates'] })
			queryClient.invalidateQueries({ queryKey: ['template-folders'] })
		},
	})

	const folderOptionsForDialog = useMemo(
		() => (folders ?? []).map(({ id, name }) => ({ id, name })),
		[folders]
	)

	const folderRows: FolderRow[] = useMemo(() => {
		return (folders ?? []).map((folder) => ({
			id: folder.id,
			name: folder.name,
			description: `${folder._count?.templates ?? 0} template${
				(folder._count?.templates ?? 0) === 1 ? '' : 's'
			}`,
			count: folder._count?.templates ?? 0,
		}))
	}, [folders])

	const isHomeView = currentFolderId === null
	const searchActive = Boolean(searchQuery.trim())
	const canMultiSelect = true
	const selectedCount = selectedTemplates.size

	const visibleTemplates = useMemo(() => {
		if (!templates) return []

		if (searchActive) {
			const query = searchQuery.toLowerCase()
			return templates.filter(
				(template) =>
					template.name.toLowerCase().includes(query) ||
					template.metaTemplateName.toLowerCase().includes(query)
			)
		}

		if (isHomeView) {
			return templates.filter((template) => !template.folderId)
		}

		return templates.filter((template) => template.folderId === currentFolderId)
	}, [templates, currentFolderId, isHomeView, searchActive, searchQuery])

	const visibleTemplateIds = useMemo(
		() => visibleTemplates.map((template) => template.id),
		[visibleTemplates]
	)
	const isAllSelected =
		canMultiSelect &&
		visibleTemplateIds.length > 0 &&
		visibleTemplateIds.every((id) => selectedTemplates.has(id))
	const headerCheckboxState = isAllSelected
		? true
		: selectedCount > 0
		? ('indeterminate' as const)
		: false

	const combinedRows = useMemo(() => {
		const templateRows = visibleTemplates.map((template) => ({
			type: 'template' as const,
			template,
		}))

		if (!isHomeView) {
			return templateRows
		}

		const foldersAsRows = folderRows.map((folder) => ({
			type: 'folder' as const,
			folder,
		}))
		return searchActive ? templateRows : [...foldersAsRows, ...templateRows]
	}, [folderRows, visibleTemplates, isHomeView, searchActive])

	const toggleTemplateSelection = useCallback(
		(templateId: string, checked: boolean) => {
			setSelectedTemplates((prev) => {
				const next = new Set(prev)
				if (checked) {
					next.add(templateId)
				} else {
					next.delete(templateId)
				}
				return next
			})
		},
		[]
	)

	const handleSelectAllVisible = useCallback(
		(checked: boolean) => {
			if (!canMultiSelect) return
			if (checked) {
				setSelectedTemplates(new Set(visibleTemplateIds))
			} else {
				setSelectedTemplates(new Set())
			}
		},
		[canMultiSelect, visibleTemplateIds]
	)

	const clearSelection = useCallback(() => setSelectedTemplates(new Set()), [])

	const handleBulkMove = useCallback(
		async (folderId: string | null) => {
			if (selectedTemplates.size === 0) return
			setIsBulkMoving(true)
			try {
				await Promise.all(
					Array.from(selectedTemplates).map((templateId) =>
						updateTemplateFolderMutation.mutateAsync({ templateId, folderId })
					)
				)
				setSelectedTemplates(new Set())
			} finally {
				setIsBulkMoving(false)
			}
		},
		[selectedTemplates, updateTemplateFolderMutation]
	)

	const breadcrumbLabel = useMemo(() => {
		if (isHomeView) return 'Home'
		return (
			folders?.find((folder) => folder.id === currentFolderId)?.name ?? 'Folder'
		)
	}, [folders, currentFolderId, isHomeView])

	const handleMoveTemplate = useCallback(
		(templateId: string, folderId: string | null) => {
			updateTemplateFolderMutation.mutate({ templateId, folderId })
		},
		[updateTemplateFolderMutation]
	)

	const statusPill = (status: Template['status']) => {
		const config: Record<
			Template['status'],
			{ label: string; icon: React.ElementType; className: string }
		> = {
			APPROVED: {
				label: 'Active',
				icon: Check,
				className: 'bg-blue-50 text-blue-600',
			},
			PENDING: {
				label: 'Pending',
				icon: Clock3,
				className: 'bg-amber-50 text-amber-700',
			},
			REJECTED: {
				label: 'Rejected',
				icon: X,
				className: 'bg-red-50 text-red-600',
			},
		}

		const Icon = config[status].icon
		return (
			<span
				className={cn(
					'inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium',
					config[status].className
				)}>
				<Icon className="h-3 w-3" />
				{config[status].label}
			</span>
		)
	}

	const loadingState = isLoading || isFoldersLoading
	const totalTemplates = templates?.length ?? 0

	const footerContent = (
		<div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
			<div className="flex flex-wrap items-center gap-3">
				<Button
					variant="outline"
					className="rounded-full"
					onClick={() => setIsAddFolderDialogOpen(true)}>
					<FolderPlus className="mr-2 h-4 w-4" />
					Create Folder
				</Button>
				<Button className="rounded-full" onClick={() => setIsAddDialogOpen(true)}>
					<Plus className="mr-2 h-4 w-4" />
					Create Template
				</Button>
			</div>

			<div className="flex flex-1 flex-col gap-3 text-sm lg:flex-row lg:items-center lg:justify-end">
				<div className="flex flex-col gap-1">
					<span className="font-medium text-foreground">
						{selectedCount > 0
							? `${selectedCount} template${selectedCount === 1 ? '' : 's'} selected`
							: 'No templates selected'}
					</span>
					{selectedCount === 0 && (
						<span className="text-muted-foreground">
							Select templates to enable move or deletion actions.
						</span>
					)}
				</div>
				{canMultiSelect && selectedCount > 0 && (
					<div className="flex flex-wrap items-center gap-2">
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button size="sm" disabled={isBulkMoving}>
									{isBulkMoving ? 'Moving…' : 'Move to Folder'}
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end" className="w-52">
								<DropdownMenuLabel>Move selected to</DropdownMenuLabel>
								<DropdownMenuItem
									onClick={() => handleBulkMove(null)}
									disabled={isBulkMoving}>
									No folder
								</DropdownMenuItem>
								<DropdownMenuSeparator />
								{folderOptionsForDialog.length === 0 ? (
									<DropdownMenuItem disabled>No folders available</DropdownMenuItem>
								) : (
									folderOptionsForDialog.map((folder) => (
										<DropdownMenuItem
											key={`bulk-${folder.id}`}
											onClick={() => handleBulkMove(folder.id)}
											disabled={isBulkMoving}>
											{folder.name}
										</DropdownMenuItem>
									))
								)}
							</DropdownMenuContent>
						</DropdownMenu>
						<Button
							variant="ghost"
							size="sm"
							onClick={clearSelection}
							disabled={isBulkMoving}>
							Clear
						</Button>
					</div>
				)}
				<div className="flex flex-wrap gap-2">
					<Button
						variant="secondary"
						onClick={() => syncTemplatesMutation.mutate()}
						disabled={syncTemplatesMutation.isPending}>
						<RefreshCw
							className={`mr-2 h-4 w-4 ${
								syncTemplatesMutation.isPending ? 'animate-spin' : ''
							}`}
						/>
						{syncTemplatesMutation.isPending ? 'Syncing…' : 'Sync with Meta'}
					</Button>
				</div>
			</div>
		</div>
	)

	return (
		<PageChrome
			title="Message Templates"
			badge={
				<Badge
					variant="outline"
					className="rounded-full border-primary/30 bg-primary/5 text-primary">
					{totalTemplates} Templates
				</Badge>
			}
			searchContent={
				<div className="relative w-full">
					<Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
					<Input
						placeholder="Search by name"
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						className="h-12 w-full rounded-2xl border-slate-200 pl-12"
					/>
				</div>
			}
			footerContent={footerContent}>
			<div className="flex h-full min-h-0 flex-col gap-6">
				<div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
					<button
						className="font-medium text-foreground"
						onClick={() => setCurrentFolderId(null)}>
						Home
					</button>
					{!isHomeView && (
						<>
							<ChevronRight className="h-4 w-4" />
							<span className="font-medium text-foreground">{breadcrumbLabel}</span>
						</>
					)}
				</div>

				<Card className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
					<CardContent className="flex min-h-0 flex-1 flex-col p-0">
						{updateTemplateFolderMutation.isError && (
							<p className="px-6 pt-4 text-sm text-destructive">
								{(updateTemplateFolderMutation.error as Error).message}
							</p>
						)}
						{syncTemplatesMutation.isError && (
							<p className="px-6 pt-4 text-sm text-destructive">
								{(syncTemplatesMutation.error as Error).message}
							</p>
						)}
						{deleteFolderMutation.isError && (
							<p className="px-6 pt-4 text-sm text-destructive">
								{(deleteFolderMutation.error as Error).message}
							</p>
						)}

						{loadingState ? (
							<div className="py-12 text-center text-muted-foreground">
								Loading templates…
							</div>
						) : combinedRows.length === 0 ? (
							<div className="py-12 text-center">
								<FileText className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
								<p className="text-sm text-muted-foreground">
									{isHomeView
										? 'No templates yet. Create your first template to get started.'
										: 'No templates inside this folder.'}
								</p>
							</div>
						) : (
							<div className="flex min-h-0 flex-1 flex-col overflow-hidden">
								<div className="flex-none overflow-x-auto">
									<table className="w-full text-sm">
										<thead className="border-b bg-muted/30 text-xs uppercase text-muted-foreground">
											<tr>
												{canMultiSelect && (
													<th className="w-12 px-4 py-3">
														<Checkbox
															checked={headerCheckboxState}
															onCheckedChange={(value) =>
																handleSelectAllVisible(value === true)
															}
															aria-label="Select all templates"
														/>
													</th>
												)}
												<th className="px-6 py-3 text-left font-medium">Name / Language</th>
												<th className="px-4 py-3 text-left font-medium">Category</th>
												<th className="px-4 py-3 text-left font-medium">Message</th>
												<th className="px-4 py-3 text-left font-medium">Status</th>
												<th className="px-6 py-3 text-right font-medium">Actions</th>
											</tr>
										</thead>
									</table>
								</div>
								<div className="flex-1 overflow-auto max-h-[380px] rounded-b-lg">
									<table className="w-full text-sm">
										<tbody>
											{combinedRows.map((row) => {
												if (row.type === 'folder') {
													return (
														<tr
															key={row.folder.id}
															className="cursor-pointer border-b last:border-b-0 transition-colors hover:bg-muted/20"
															onClick={() => setCurrentFolderId(row.folder.id)}>
															{canMultiSelect && <td className="px-4 py-4" />}
															<td className="px-6 py-4">
																<div className="flex items-center gap-3">
																	<div className="rounded-md border bg-background p-2 text-muted-foreground">
																		<Folder className="h-4 w-4" />
																	</div>
																	<div>
																		<p className="font-medium capitalize">{row.folder.name}</p>
																		<p className="text-xs text-muted-foreground">
																			{row.folder.description}
																		</p>
																	</div>
																</div>
															</td>
															<td className="px-4 py-4 text-muted-foreground">
																{row.folder.count} templates
															</td>
															<td className="px-4 py-4 text-muted-foreground">—</td>
															<td className="px-4 py-4 text-muted-foreground">—</td>
															<td
																className="px-6 py-4 text-right"
																onClick={(event) => event.stopPropagation()}>
																{row.folder.count > 0 ? (
																	<Button
																		variant="ghost"
																		size="icon"
																		disabled
																		aria-label="Folder actions">
																		<MoreVertical className="h-4 w-4" />
																	</Button>
																) : (
																	<DropdownMenu>
																		<DropdownMenuTrigger asChild>
																			<Button
																				variant="ghost"
																				size="icon"
																				aria-label="Folder actions"
																				disabled={
																					deleteFolderMutation.isPending &&
																					folderDeleteTarget !== row.folder.id
																				}>
																				<MoreVertical className="h-4 w-4" />
																			</Button>
																		</DropdownMenuTrigger>
																		<DropdownMenuContent align="end">
																			<DropdownMenuLabel>Folder actions</DropdownMenuLabel>
																			<DropdownMenuItem
																				className="text-destructive focus:text-destructive"
																				disabled={
																					deleteFolderMutation.isPending &&
																					folderDeleteTarget !== row.folder.id
																				}
																				onClick={() => deleteFolderMutation.mutate(row.folder.id)}>
																				<Trash2 className="mr-2 h-4 w-4" />
																				Delete folder
																			</DropdownMenuItem>
																		</DropdownMenuContent>
																	</DropdownMenu>
																)}
															</td>
														</tr>
													)
												}

												const template = row.template
												return (
													<tr key={template.id} className="border-b last:border-b-0">
														{canMultiSelect && (
															<td className="px-4 py-4 align-top">
																<Checkbox
																	checked={selectedTemplates.has(template.id)}
																	onCheckedChange={(value) =>
																		toggleTemplateSelection(template.id, value === true)
																	}
																	aria-label={`Select ${template.name}`}
																/>
															</td>
														)}
														<td className="px-6 py-4">
															<div>
																<p className="font-medium">{template.name}</p>
																<p className="text-xs uppercase text-muted-foreground">
																	{template.language || 'en'}
																</p>
															</div>
														</td>
														<td className="px-4 py-4">
															<Badge variant="outline" className="bg-amber-50 text-amber-700">
																{template.category}
															</Badge>
														</td>
														<td className="px-4 py-4 text-muted-foreground">
															<p className="line-clamp-1 md:line-clamp-2">
																{template.bodyText}
															</p>
														</td>
														<td className="px-4 py-4">{statusPill(template.status)}</td>
														<td
															className="px-6 py-4 text-right"
															onClick={(event) => event.stopPropagation()}>
															<DropdownMenu>
																<DropdownMenuTrigger asChild>
																	<Button
																		variant="ghost"
																		size="icon"
																		aria-label="Template actions">
																		<MoreVertical className="h-4 w-4" />
																	</Button>
																</DropdownMenuTrigger>
																<DropdownMenuContent align="end">
																	<DropdownMenuLabel>Manage template</DropdownMenuLabel>
																	<DropdownMenuItem disabled>Preview</DropdownMenuItem>
																	<DropdownMenuSub>
																		<DropdownMenuSubTrigger>
																			Move to folder
																		</DropdownMenuSubTrigger>
																		<DropdownMenuSubContent className="w-48">
																			<DropdownMenuItem
																				onClick={() => handleMoveTemplate(template.id, null)}>
																				No folder
																			</DropdownMenuItem>
																			{folderOptionsForDialog.map((folder) => (
																				<DropdownMenuItem
																					key={folder.id}
																					onClick={() => handleMoveTemplate(template.id, folder.id)}>
																					{folder.name}
																				</DropdownMenuItem>
																			))}
																		</DropdownMenuSubContent>
																	</DropdownMenuSub>
																	<DropdownMenuSeparator />
																	<DropdownMenuItem
																		className="text-destructive focus:text-destructive"
																		onClick={() => deleteTemplateMutation.mutate(template.id)}>
																		<Trash2 className="mr-2 h-4 w-4" />
																		Delete
																	</DropdownMenuItem>
																</DropdownMenuContent>
															</DropdownMenu>
														</td>
													</tr>
												)
											})}
										</tbody>
									</table>
								</div>
							</div>
						)}

						<div className="flex items-center justify-between border-t px-6 py-4 text-xs text-muted-foreground">
							<span>Page 1 of 1</span>
							<div className="flex items-center gap-2">
								<Button variant="outline" size="sm" disabled>
									Previous
								</Button>
								<Button variant="outline" size="sm" disabled>
									Next
								</Button>
							</div>
						</div>
					</CardContent>
				</Card>
			</div>

			<AddTemplateDialog
				open={isAddDialogOpen}
				onOpenChange={setIsAddDialogOpen}
				folders={folderOptionsForDialog}
			/>
			<AddFolderDialog
				open={isAddFolderDialogOpen}
				onOpenChange={setIsAddFolderDialogOpen}
			/>
		</PageChrome>
	)
}
