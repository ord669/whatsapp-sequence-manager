'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AlertCircle, CheckCircle2 } from 'lucide-react'

interface AddMetaAccountDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AddMetaAccountDialog({ open, onOpenChange }: AddMetaAccountDialogProps) {
  const queryClient = useQueryClient()
  const [formData, setFormData] = useState({
    businessManagerName: '',
    wabaId: '',
    wabaName: '',
    phoneNumberId: '',
    phoneNumber: '',
    displayName: '',
    appId: '',
    appSecret: '',
    accessToken: '',
    chatwootAccountId: '',
    chatwootInboxId: '',
    chatwootApiAccessToken: '',
  })
  const [verificationResult, setVerificationResult] = useState<{
    success: boolean
    message: string
  } | null>(null)

  const verifyMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/meta-accounts/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumberId: formData.phoneNumberId,
          accessToken: formData.accessToken,
          wabaId: formData.wabaId,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Verification failed')
      return data
    },
    onSuccess: (data) => {
      setVerificationResult({
        success: true,
        message: 'Connection verified successfully!',
      })
      // Update form with verified data from Meta API
      setFormData((prev) => ({
        ...prev,
        displayName: data.displayName || prev.displayName,
        phoneNumber: data.phoneNumber || prev.phoneNumber,
        wabaName: data.wabaName || prev.wabaName,
        businessManagerName: data.businessManagerName || prev.businessManagerName,
      }))
    },
    onError: (error: Error) => {
      setVerificationResult({
        success: false,
        message: error.message,
      })
    },
  })

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/meta-accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to create account')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meta-accounts'] })
      onOpenChange(false)
      resetForm()
    },
  })

  const resetForm = () => {
    setFormData({
      businessManagerName: '',
      wabaId: '',
      wabaName: '',
      phoneNumberId: '',
      phoneNumber: '',
      displayName: '',
      appId: '',
      appSecret: '',
      accessToken: '',
      chatwootAccountId: '',
      chatwootInboxId: '',
      chatwootApiAccessToken: '',
    })
    setVerificationResult(null)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    createMutation.mutate()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Connect Meta Account</DialogTitle>
          <DialogDescription>
            Enter your WhatsApp Business API credentials to connect your account
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="businessManagerName">
                Business Manager Name (Optional)
              </Label>
              <Input
                id="businessManagerName"
                value={formData.businessManagerName}
                onChange={(e) =>
                  setFormData({ ...formData, businessManagerName: e.target.value })
                }
                placeholder="My Company"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="wabaId">WABA ID *</Label>
              <Input
                id="wabaId"
                required
                value={formData.wabaId}
                onChange={(e) => setFormData({ ...formData, wabaId: e.target.value })}
                placeholder="100159753113031"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="wabaName">WABA Name *</Label>
              <Input
                id="wabaName"
                required
                value={formData.wabaName}
                onChange={(e) => setFormData({ ...formData, wabaName: e.target.value })}
                placeholder="Customer Support"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phoneNumberId">Phone Number ID *</Label>
              <Input
                id="phoneNumberId"
                required
                value={formData.phoneNumberId}
                onChange={(e) =>
                  setFormData({ ...formData, phoneNumberId: e.target.value })
                }
                placeholder="107598685692688"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phoneNumber">Phone Number *</Label>
              <Input
                id="phoneNumber"
                required
                value={formData.phoneNumber}
                onChange={(e) =>
                  setFormData({ ...formData, phoneNumber: e.target.value })
                }
                placeholder="+1 555 040 3052"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="displayName">Display Name *</Label>
              <Input
                id="displayName"
                required
                value={formData.displayName}
                onChange={(e) =>
                  setFormData({ ...formData, displayName: e.target.value })
                }
                placeholder="Test Number"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="appId">App ID *</Label>
              <Input
                id="appId"
                required
                value={formData.appId}
                onChange={(e) => setFormData({ ...formData, appId: e.target.value })}
                placeholder="2323410871437816"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="appSecret">App Secret *</Label>
              <Input
                id="appSecret"
                required
                type="password"
                value={formData.appSecret}
                onChange={(e) =>
                  setFormData({ ...formData, appSecret: e.target.value })
                }
                placeholder="••••••••"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="accessToken">System User Access Token *</Label>
            <textarea
              id="accessToken"
              required
              value={formData.accessToken}
              onChange={(e) =>
                setFormData({ ...formData, accessToken: e.target.value })
              }
              placeholder="EAADja5yQVqoBACBk4YnIb9q6..."
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          <div className="space-y-4 rounded-md border p-4">
            <div>
              <p className="text-sm font-medium">Chatwoot Configuration (Optional)</p>
              <p className="text-xs text-muted-foreground">
                Provide these details if you want sequence messages to be sent via your Chatwoot workspace.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="chatwootAccountId">Chatwoot Account ID</Label>
                <Input
                  id="chatwootAccountId"
                  value={formData.chatwootAccountId}
                  onChange={(e) =>
                    setFormData({ ...formData, chatwootAccountId: e.target.value })
                  }
                  placeholder="2"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="chatwootInboxId">Chatwoot Inbox ID</Label>
                <Input
                  id="chatwootInboxId"
                  value={formData.chatwootInboxId}
                  onChange={(e) =>
                    setFormData({ ...formData, chatwootInboxId: e.target.value })
                  }
                  placeholder="5"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="chatwootApiAccessToken">Chatwoot API Access Token</Label>
              <textarea
                id="chatwootApiAccessToken"
                value={formData.chatwootApiAccessToken}
                onChange={(e) =>
                  setFormData({ ...formData, chatwootApiAccessToken: e.target.value })
                }
                placeholder="Paste the Api-Access-Token from Chatwoot profile"
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
          </div>

          {verificationResult && (
            <div
              className={`flex items-center gap-2 rounded-md p-3 ${
                verificationResult.success
                  ? 'bg-green-50 text-green-900'
                  : 'bg-red-50 text-red-900'
              }`}
            >
              {verificationResult.success ? (
                <CheckCircle2 className="h-5 w-5" />
              ) : (
                <AlertCircle className="h-5 w-5" />
              )}
              <p className="text-sm">{verificationResult.message}</p>
            </div>
          )}

          <div className="flex justify-between gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => verifyMutation.mutate()}
              disabled={verifyMutation.isPending}
            >
              {verifyMutation.isPending ? 'Verifying...' : 'Verify Connection'}
            </Button>
            <div className="flex gap-2">
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
              <Button
                type="submit"
                disabled={createMutation.isPending || !verificationResult?.success}
              >
                {createMutation.isPending ? 'Creating...' : 'Save Account'}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

