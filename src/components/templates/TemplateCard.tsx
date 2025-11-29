'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Eye, MoreVertical, Trash2, Phone, Folder } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { formatPhoneNumber } from '@/lib/utils'

interface TemplateCardProps {
  template: {
    id: string
    name: string
    metaTemplateName: string
    category: string
    status: 'PENDING' | 'APPROVED' | 'REJECTED'
    bodyText: string
    variables: any
    metaAccount: {
      phoneNumber: string
      displayName: string
    }
    folder?: {
      id: string
      name: string
    } | null
  }
  onDelete: () => void
}

export function TemplateCard({ template, onDelete }: TemplateCardProps) {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return <Badge variant="success">✓ Approved</Badge>
      case 'PENDING':
        return <Badge variant="warning">⏳ Pending</Badge>
      case 'REJECTED':
        return <Badge variant="destructive">✗ Rejected</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const getCategoryBadge = (category: string) => {
    switch (category) {
      case 'MARKETING':
        return <Badge variant="info">Marketing</Badge>
      case 'UTILITY':
        return <Badge variant="secondary">Utility</Badge>
      case 'AUTHENTICATION':
        return <Badge variant="outline">Authentication</Badge>
      default:
        return <Badge variant="outline">{category}</Badge>
    }
  }

  // Extract variable placeholders from body text
  const variableCount = (template.bodyText.match(/\{\{\d+\}\}/g) || []).length

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg">{template.name}</CardTitle>
            <CardDescription className="mt-1 flex items-center gap-1 text-xs">
              <Phone className="h-3 w-3" />
              {formatPhoneNumber(template.metaAccount.phoneNumber)}
            </CardDescription>
            {template.folder?.name && (
              <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                <Folder className="h-3 w-3" />
                {template.folder.name}
              </p>
            )}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>
                <Eye className="mr-2 h-4 w-4" />
                Preview
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={onDelete}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {getStatusBadge(template.status)}
          {getCategoryBadge(template.category)}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-1">
              Template Name
            </p>
            <p className="text-sm font-mono">{template.metaTemplateName}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-1">
              Message Body
            </p>
            <p className="text-sm line-clamp-3">{template.bodyText}</p>
          </div>
          {variableCount > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground">
                Variables: {variableCount}
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

