'use client'

import { Button } from '@/components/ui/button'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog'

interface BulkUnsubscribeDialogProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	contactCount: number
	onConfirm: () => void
	isLoading: boolean
}

export function BulkUnsubscribeDialog({
	open,
	onOpenChange,
	contactCount,
	onConfirm,
	isLoading,
}: BulkUnsubscribeDialogProps) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Unsubscribe contacts</DialogTitle>
					<DialogDescription>
						This will cancel all active sequences for the selected contacts. They will stop receiving any further messages.
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4">
					<p className="text-sm">
						You are about to unsubscribe <strong>{contactCount}</strong> contact
						{contactCount === 1 ? '' : 's'} from all sequences.
					</p>
					<div className="flex justify-end gap-2">
						<Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
							Cancel
						</Button>
						<Button type="button" variant="destructive" onClick={onConfirm} disabled={isLoading}>
							{isLoading ? 'Unsubscribing...' : 'Unsubscribe'}
						</Button>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	)
}

