'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AlertCircle } from 'lucide-react'

interface AddFolderDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AddFolderDialog({ open, onOpenChange }: AddFolderDialogProps) {
  const queryClient = useQueryClient()
  const [name, setName] = useState('')

  const createFolderMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/templates/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to create folder')
      }

      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['template-folders'] })
      setName('')
      onOpenChange(false)
    },
  })

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    createFolderMutation.mutate()
  }

  return (
    <Dialog open={open} onOpenChange={(value) => {
      onOpenChange(value)
      if (!value) {
        setName('')
      }
    }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create Template Folder</DialogTitle>
          <DialogDescription>
            Organize your templates by creating folders and dragging templates into them.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="folder-name">Folder Name</Label>
            <Input
              id="folder-name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Onboarding, Promotions"
            />
          </div>

          {createFolderMutation.isError && (
            <div className="flex items-center gap-2 rounded-md bg-red-50 p-3 text-sm text-red-900">
              <AlertCircle className="h-5 w-5" />
              <p>{(createFolderMutation.error as Error).message}</p>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                onOpenChange(false)
                setName('')
              }}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || createFolderMutation.isPending}>
              {createFolderMutation.isPending ? 'Creating...' : 'Create Folder'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

