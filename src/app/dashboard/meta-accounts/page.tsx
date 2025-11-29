'use client'

import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Plus, Phone, CheckCircle2, AlertCircle } from 'lucide-react'
import { AddMetaAccountDialog } from '@/components/meta-accounts/AddMetaAccountDialog'
import { formatPhoneNumber } from '@/lib/utils'
import { PageChrome } from '@/components/layout/PageChrome'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface MetaAccount {
  id: string
  businessManagerName: string | null
  wabaName: string
  phoneNumber: string
  displayName: string
  qualityRating: string | null
  isActive: boolean
  isVerified: boolean
  createdAt: string
  chatwootAccountId?: string | null
  chatwootInboxId?: string | null
  chatwootApiAccessToken?: string | null
}

export default function MetaAccountsPage() {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const queryClient = useQueryClient()

  const { data: accounts, isLoading } = useQuery<MetaAccount[]>({
    queryKey: ['meta-accounts'],
    queryFn: async () => {
      const res = await fetch('/api/meta-accounts')
      if (!res.ok) throw new Error('Failed to fetch accounts')
      return res.json()
    },
  })

  const testConnectionMutation = useMutation({
    mutationFn: async (accountId: string) => {
      const res = await fetch(`/api/meta-accounts/${accountId}/test`, {
        method: 'POST',
      })
      if (!res.ok) throw new Error('Connection test failed')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meta-accounts'] })
    },
  })

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const res = await fetch(`/api/meta-accounts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !isActive }),
      })
      if (!res.ok) throw new Error('Failed to update account')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meta-accounts'] })
    },
  })

  const filteredAccounts = useMemo(() => {
    if (!accounts) return []
    const query = searchQuery.trim().toLowerCase()
    return accounts.filter((account) => {
      const matchesSearch = query
        ? [account.businessManagerName, account.displayName, account.phoneNumber, account.wabaName]
            .filter(Boolean)
            .some((value) => value!.toLowerCase().includes(query))
        : true
      const matchesStatus =
        statusFilter === 'all'
          ? true
          : statusFilter === 'active'
          ? account.isActive
          : !account.isActive
      return matchesSearch && matchesStatus
    })
  }, [accounts, searchQuery, statusFilter])

  const getQualityBadge = (rating: string | null) => {
    if (!rating) return <Badge variant="outline">Unknown</Badge>

    switch (rating.toUpperCase()) {
      case 'GREEN':
        return <Badge variant="success">🟢 Green</Badge>
      case 'YELLOW':
        return <Badge variant="warning">🟡 Yellow</Badge>
      case 'RED':
        return <Badge variant="destructive">🔴 Red</Badge>
      default:
        return <Badge variant="outline">{rating}</Badge>
    }
  }

  const footerContent = (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-wrap items-center gap-2">
        <Button className="rounded-full" onClick={() => setIsAddDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Connect Account
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        Showing {filteredAccounts.length}/{accounts?.length ?? 0} accounts
      </p>
    </div>
  )

  return (
    <PageChrome
      title="Meta Accounts"
      description="Connect and manage your WhatsApp Business accounts"
      searchContent={
        <Input
          placeholder="Search by name, number, or WABA..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="h-11 rounded-2xl border-slate-200"
        />
      }
      filtersContent={
        <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as typeof statusFilter)}>
          <SelectTrigger className="w-[180px] rounded-2xl border-slate-200">
            <SelectValue placeholder="All accounts" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Accounts</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      }
      footerContent={footerContent}>
      {isLoading ? (
        <div className="py-12 text-center">
          <p className="text-muted-foreground">Loading accounts...</p>
        </div>
      ) : accounts && accounts.length === 0 ? (
        <Card className="rounded-[24px] border border-slate-200 shadow-sm">
          <CardContent className="py-12 text-center">
            <Phone className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <h3 className="mb-2 text-lg font-semibold">No accounts connected</h3>
            <p className="mb-4 text-muted-foreground">
              Connect your first WhatsApp Business account to get started
            </p>
            <Button onClick={() => setIsAddDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Connect Account
            </Button>
          </CardContent>
        </Card>
      ) : filteredAccounts.length === 0 ? (
        <Card className="rounded-[24px] border border-slate-200 shadow-sm">
          <CardContent className="py-12 text-center">
            <AlertCircle className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <h3 className="mb-2 text-lg font-semibold">No results</h3>
            <p className="text-muted-foreground">Adjust your search or filters to see accounts.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredAccounts.map((account) => (
            <Card key={account.id} className="rounded-[24px] border border-slate-200 shadow-sm">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Phone className="h-5 w-5" />
                      {formatPhoneNumber(account.phoneNumber)}
                      {account.isVerified && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                    </CardTitle>
                    <CardDescription className="mt-1">{account.displayName}</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    {account.isActive ? (
                      <Badge variant="success">Active</Badge>
                    ) : (
                      <Badge variant="outline">Inactive</Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  <div>
                    <h4 className="mb-2 text-sm font-semibold">Account Details</h4>
                    <dl className="space-y-1 text-sm">
                      {account.businessManagerName && (
                        <>
                          <dt className="text-muted-foreground">Business Manager</dt>
                          <dd className="font-medium">{account.businessManagerName}</dd>
                        </>
                      )}
                      <dt className="text-muted-foreground">WABA Name</dt>
                      <dd className="font-medium">{account.wabaName}</dd>
                      <dt className="text-muted-foreground">Quality Rating</dt>
                      <dd>{getQualityBadge(account.qualityRating)}</dd>
                    </dl>
                  </div>
                  {account.chatwootAccountId || account.chatwootInboxId ? (
                    <div>
                      <h4 className="mb-2 text-sm font-semibold">Chatwoot</h4>
                      <dl className="space-y-1 text-sm">
                        {account.chatwootAccountId && (
                          <>
                            <dt className="text-muted-foreground">Account ID</dt>
                            <dd className="font-medium">{account.chatwootAccountId}</dd>
                          </>
                        )}
                        {account.chatwootInboxId && (
                          <>
                            <dt className="text-muted-foreground">Inbox ID</dt>
                            <dd className="font-medium">{account.chatwootInboxId}</dd>
                          </>
                        )}
                        {!account.chatwootAccountId && !account.chatwootInboxId && (
                          <dd className="text-muted-foreground">Not configured</dd>
                        )}
                      </dl>
                    </div>
                  ) : (
                    <div className="hidden lg:block" />
                  )}
                  <div className="flex flex-col justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => testConnectionMutation.mutate(account.id)}
                      disabled={testConnectionMutation.isPending}>
                      {testConnectionMutation.isPending ? 'Testing...' : 'Test Connection'}
                    </Button>
                    <Button
                      variant={account.isActive ? 'outline' : 'default'}
                      size="sm"
                      onClick={() =>
                        toggleActiveMutation.mutate({
                          id: account.id,
                          isActive: account.isActive,
                        })
                      }
                      disabled={toggleActiveMutation.isPending}>
                      {account.isActive ? 'Deactivate' : 'Activate'}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AddMetaAccountDialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen} />
    </PageChrome>
  )
}

