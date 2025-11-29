'use client'

import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface SequenceOption {
  id: string
  name: string
  isActive: boolean
  metaAccount?: {
    displayName: string | null
  } | null
  _count?: {
    subscriptions: number
  }
}

interface BulkSubscribeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  contactIds: string[]
  onComplete?: () => void
}

export function BulkSubscribeDialog({
  open,
  onOpenChange,
  contactIds,
  onComplete,
}: BulkSubscribeDialogProps) {
  const [selectedSequenceIds, setSelectedSequenceIds] = useState<string[]>([])
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const { data: sequences, isLoading, isError } = useQuery<SequenceOption[]>({
    queryKey: ['sequences', 'bulk-subscribe'],
    queryFn: async () => {
      const res = await fetch('/api/sequences')
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to fetch sequences')
      }
      return res.json()
    },
    enabled: open,
  })

  useEffect(() => {
    if (!open) {
      setSelectedSequenceIds([])
      setSubmitError(null)
      setIsSubmitting(false)
    }
  }, [open])

  const activeSequences = useMemo(
    () => sequences?.filter((sequence) => sequence.isActive) ?? [],
    [sequences]
  )

  const handleToggleSequence = (sequenceId: string, checked: boolean) => {
    setSelectedSequenceIds((prev) => {
      if (checked) {
        return Array.from(new Set([...prev, sequenceId]))
      }
      return prev.filter((id) => id !== sequenceId)
    })
  }

  const handleSubscribe = async () => {
    if (contactIds.length === 0) {
      setSubmitError('Select at least one contact from the list.')
      return
    }

    if (selectedSequenceIds.length === 0) {
      setSubmitError('Select at least one sequence.')
      return
    }

    setIsSubmitting(true)
    setSubmitError(null)

    let successCount = 0
    const uniqueErrors = new Set<string>()

    for (const contactId of contactIds) {
      for (const sequenceId of selectedSequenceIds) {
        try {
          const res = await fetch('/api/subscriptions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contactId, sequenceId }),
          })

          if (!res.ok) {
            const data = await res.json().catch(() => ({}))
            uniqueErrors.add(
              data.error ||
                `Failed to subscribe contact ${contactId} to sequence ${sequenceId}`
            )
            continue
          }

          successCount++
        } catch (error) {
          uniqueErrors.add(
            error instanceof Error ? error.message : 'Unexpected error'
          )
        }
      }
    }

    if (successCount > 0) {
      onComplete?.()
    }

    if (uniqueErrors.size === 0) {
      onOpenChange(false)
      setSelectedSequenceIds([])
    } else {
      const [firstError] = Array.from(uniqueErrors)
      setSubmitError(
        `${successCount} subscription(s) created but some failed. Latest error: ${firstError}`
      )
    }

    setIsSubmitting(false)
  }

  const contactCount = contactIds.length

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Subscribe contacts to sequences</DialogTitle>
          <DialogDescription>
            {contactCount > 0
              ? `Selected contacts: ${contactCount}`
              : 'Select contacts from the list to begin.'}
          </DialogDescription>
        </DialogHeader>

        {isLoading && (
          <p className="text-sm text-muted-foreground">Loading sequences...</p>
        )}

        {isError && (
          <p className="text-sm text-destructive">
            Failed to load sequences. Please try again.
          </p>
        )}

        {!isLoading && !isError && activeSequences.length === 0 && (
          <p className="text-sm text-muted-foreground">
            You do not have any active sequences yet. Activate a sequence first.
          </p>
        )}

        {!isLoading && !isError && activeSequences.length > 0 && (
          <div className="space-y-3 rounded-md border px-3 py-2 max-h-64 overflow-y-auto">
            {activeSequences.map((sequence) => {
              const inputId = `sequence-${sequence.id}`
              return (
                <div
                  key={sequence.id}
                  className="flex items-start gap-3 rounded-md px-2 py-2 hover:bg-muted/50"
                >
                  <Checkbox
                    id={inputId}
                    checked={selectedSequenceIds.includes(sequence.id)}
                    onCheckedChange={(checked) =>
                      handleToggleSequence(sequence.id, Boolean(checked))
                    }
                  />
                  <div className="space-y-1">
                    <Label htmlFor={inputId} className="cursor-pointer">
                      {sequence.name}
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      {sequence.metaAccount?.displayName
                        ? sequence.metaAccount.displayName
                        : 'No associated Meta account'}
                    </p>
                    {typeof sequence._count?.subscriptions === 'number' && (
                      <p className="text-xs text-muted-foreground">
                        {sequence._count.subscriptions} active subscriber
                        {sequence._count.subscriptions === 1 ? '' : 's'}
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {submitError && (
          <p className="text-sm text-destructive">{submitError}</p>
        )}

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubscribe}
            disabled={
              isSubmitting ||
              contactIds.length === 0 ||
              selectedSequenceIds.length === 0 ||
              activeSequences.length === 0
            }
          >
            {isSubmitting ? 'Subscribing...' : 'Subscribe'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}


