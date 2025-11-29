'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
	DialogFooter,
} from '@/components/ui/dialog'
import { AlertTriangle } from 'lucide-react'

interface DeleteConfirmDialogProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	onConfirm: () => void
	title: string
	description?: string
	itemCount?: number
	isLoading?: boolean
}

export function DeleteConfirmDialog({
	open,
	onOpenChange,
	onConfirm,
	title,
	description,
	itemCount = 1,
	isLoading = false,
}: DeleteConfirmDialogProps) {
	const [confirmText, setConfirmText] = useState('')

	const handleConfirm = () => {
		if (confirmText === 'DELETE') {
			onConfirm()
		}
	}

	const handleOpenChange = (open: boolean) => {
		if (!open) {
			setConfirmText('')
		}
		onOpenChange(open)
	}

	const isConfirmDisabled = confirmText !== 'DELETE' || isLoading

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent className="sm:max-w-[425px]">
				<DialogHeader>
					<div className="flex items-center gap-3">
						<div className="rounded-full bg-red-100 p-2">
							<AlertTriangle className="h-6 w-6 text-red-600" />
						</div>
						<DialogTitle>{title}</DialogTitle>
					</div>
					<DialogDescription className="pt-3">
						{description ||
							`This will permanently delete ${
								itemCount === 1 ? 'this sequence' : `${itemCount} sequences`
							}. This action cannot be undone.`}
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4 py-4">
					<div className="space-y-2">
						<Label htmlFor="confirm-text">
							Type <span className="font-mono font-bold text-red-600">DELETE</span> to
							confirm
						</Label>
						<Input
							id="confirm-text"
							value={confirmText}
							onChange={(e) => setConfirmText(e.target.value)}
							placeholder="Type DELETE here"
							autoComplete="off"
							disabled={isLoading}
						/>
					</div>

					{itemCount > 1 && (
						<div className="rounded-md bg-amber-50 border border-amber-200 p-3">
							<p className="text-sm text-amber-800">
								You are about to delete <strong>{itemCount} sequences</strong>
							</p>
						</div>
					)}
				</div>

				<DialogFooter>
					<Button
						type="button"
						variant="outline"
						onClick={() => handleOpenChange(false)}
						disabled={isLoading}>
						Cancel
					</Button>
					<Button
						type="button"
						variant="destructive"
						onClick={handleConfirm}
						disabled={isConfirmDisabled}>
						{isLoading ? 'Deleting...' : 'Delete Permanently'}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}

