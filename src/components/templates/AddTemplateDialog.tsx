'use client'

import { useState, useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AlertCircle, Info } from 'lucide-react'

interface AddTemplateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  folders?: TemplateFolderOption[]
}

interface MetaAccount {
  id: string
  phoneNumber: string
  displayName: string
  wabaName: string
  isActive: boolean
}

interface TemplateFolderOption {
  id: string
  name: string
}

export function AddTemplateDialog({
  open,
  onOpenChange,
  folders = [],
}: AddTemplateDialogProps) {
  const queryClient = useQueryClient()
  const [formData, setFormData] = useState({
    name: '',
    metaTemplateName: '',
    metaAccountId: '',
    category: 'MARKETING',
    language: 'en',
    bodyText: '',
    footerText: '',
    variables: [] as Array<{ name: string; example: string }>,
    folderId: '',
  })

  const { data: metaAccounts } = useQuery<MetaAccount[]>({
    queryKey: ['meta-accounts'],
    queryFn: async () => {
      const res = await fetch('/api/meta-accounts')
      if (!res.ok) throw new Error('Failed to fetch accounts')
      return res.json()
    },
  })

  const createMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        ...formData,
        folderId: formData.folderId || null,
      }

      const res = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to create template')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] })
      onOpenChange(false)
      resetForm()
    },
  })

  const resetForm = () => {
    setFormData({
      name: '',
      metaTemplateName: '',
      metaAccountId: '',
      category: 'MARKETING',
      language: 'en',
      bodyText: '',
      footerText: '',
      variables: [],
      folderId: '',
    })
  }

  // Auto-detect variables from body text
  useEffect(() => {
    const matches = formData.bodyText.match(/\{\{\d+\}\}/g) || []
    const uniqueMatches = [...new Set(matches)]
    const newVariables = uniqueMatches.map((match) => ({
      name: match,
      example: formData.variables.find((v) => v.name === match)?.example || '',
    }))
    setFormData((prev) => ({ ...prev, variables: newVariables }))
  }, [formData.bodyText])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    createMutation.mutate()
  }

  const activeAccounts = metaAccounts?.filter((acc) => acc.isActive) || []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create WhatsApp Template</DialogTitle>
          <DialogDescription>
            Create a new message template and submit it to Meta for approval
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="rounded-md bg-blue-50 p-3 text-sm text-blue-900">
            <div className="flex gap-2">
              <Info className="h-5 w-5 flex-shrink-0" />
              <div>
                <p className="font-medium">Template Guidelines</p>
                <ul className="mt-1 list-disc pl-5 space-y-1 text-xs">
                  <li>Use {'{  {1}}'}, {'{  {2}}'} for variables (no spaces)</li>
                  <li>Templates must be approved by Meta before use</li>
                  <li>Approval usually takes 24 hours</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Template Name (Display) *</Label>
              <Input
                id="name"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Welcome Message"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="metaTemplateName">Meta Template Name *</Label>
              <Input
                id="metaTemplateName"
                required
                value={formData.metaTemplateName}
                onChange={(e) =>
                  setFormData({ ...formData, metaTemplateName: e.target.value })
                }
                placeholder="welcome_message_v1"
              />
              <p className="text-xs text-muted-foreground">
                Lowercase, underscores only, no spaces
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="metaAccountId">WhatsApp Account *</Label>
              <Select
                value={formData.metaAccountId}
                onValueChange={(value) =>
                  setFormData({ ...formData, metaAccountId: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select account" />
                </SelectTrigger>
                <SelectContent>
                  {activeAccounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.phoneNumber} - {account.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Category *</Label>
              <Select
                value={formData.category}
                onValueChange={(value) => setFormData({ ...formData, category: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MARKETING">Marketing</SelectItem>
                  <SelectItem value="UTILITY">Utility</SelectItem>
                  <SelectItem value="AUTHENTICATION">Authentication</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="bodyText">Message Body *</Label>
            <textarea
              id="bodyText"
              required
              value={formData.bodyText}
              onChange={(e) => setFormData({ ...formData, bodyText: e.target.value })}
              placeholder="Hi {{1}}, welcome to {{2}}! We're excited to have you."
              rows={4}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
            <p className="text-xs text-muted-foreground">
              Use {'{  {1}}'}, {'{  {2}}'}, etc. for variables (no spaces between braces)
            </p>
          </div>

          {formData.variables.length > 0 && (
            <div className="space-y-3">
              <Label>Variables Detected ({formData.variables.length})</Label>
              <div className="grid gap-3">
                {formData.variables.map((variable, index) => (
                  <div key={variable.name} className="grid gap-2 grid-cols-2">
                    <div>
                      <Input value={variable.name} disabled />
                    </div>
                    <div>
                      <Input
                        placeholder="Example value"
                        value={variable.example}
                        onChange={(e) => {
                          const newVars = [...formData.variables]
                          newVars[index].example = e.target.value
                          setFormData({ ...formData, variables: newVars })
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="footerText">Footer Text (Optional)</Label>
            <Input
              id="footerText"
              value={formData.footerText}
              onChange={(e) => setFormData({ ...formData, footerText: e.target.value })}
              placeholder="Reply STOP to unsubscribe"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="folder">Folder (Optional)</Label>
            <Select
              value={formData.folderId}
              onValueChange={(value) => setFormData({ ...formData, folderId: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="No folder selected" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">No folder</SelectItem>
                {folders.map((folderOption) => (
                  <SelectItem key={folderOption.id} value={folderOption.id}>
                    {folderOption.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Choose an existing folder or create a new one from the dashboard
            </p>
          </div>

          {createMutation.isError && (
            <div className="flex items-center gap-2 rounded-md bg-red-50 p-3 text-sm text-red-900">
              <AlertCircle className="h-5 w-5" />
              <p>{(createMutation.error as Error).message}</p>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                onOpenChange(false)
                resetForm()
              }}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending || !formData.metaAccountId}>
              {createMutation.isPending ? 'Submitting...' : 'Create & Submit to Meta'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

