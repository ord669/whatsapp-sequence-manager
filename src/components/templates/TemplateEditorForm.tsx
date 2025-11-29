'use client'

import { useEffect, useMemo, useState } from 'react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { AlertCircle, Info } from 'lucide-react'

export interface TemplateFolderOption {
  id: string
  name: string
}

export interface MetaAccountOption {
  id: string
  phoneNumber: string
  displayName: string
  wabaName?: string
  isActive: boolean
}

export interface TemplateFormValues {
  name: string
  metaTemplateName: string
  metaAccountId: string
  category: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION'
  language: string
  bodyText: string
  footerText: string
  variables: Array<{ name: string; example: string }>
  folderId: string | null
}

export interface TemplateEditorFormProps {
  mode: 'create' | 'edit'
  formId: string
  folders?: TemplateFolderOption[]
  metaAccounts?: MetaAccountOption[]
  initialValues?: Partial<TemplateFormValues>
  isSubmitting?: boolean
  errorMessage?: string | null
  onSubmit: (values: TemplateFormValues) => void | Promise<void>
}

const NO_FOLDER_VALUE = '__NO_FOLDER__'

const defaultValues: TemplateFormValues = {
  name: '',
  metaTemplateName: '',
  metaAccountId: '',
  category: 'MARKETING',
  language: 'en',
  bodyText: '',
  footerText: '',
  variables: [],
  folderId: null,
}

const formatMetaTemplateName = (value: string) =>
  value
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')

export function TemplateEditorForm({
  mode,
  formId,
  folders = [],
  metaAccounts = [],
  initialValues,
  isSubmitting = false,
  errorMessage,
  onSubmit,
}: TemplateEditorFormProps) {
  const [formData, setFormData] = useState<TemplateFormValues>({
    ...defaultValues,
    ...normalizeInitialValues(initialValues),
  })

  useEffect(() => {
    if (initialValues) {
      setFormData((prev) => ({
        ...prev,
        ...normalizeInitialValues(initialValues),
      }))
    }
  }, [initialValues])

  useEffect(() => {
    const matches = formData.bodyText.match(/\{\{\d+\}\}/g) || []
    const uniqueMatches = [...new Set(matches)]
    const newVariables = uniqueMatches.map((match) => ({
      name: match,
      example: formData.variables.find((v) => v.name === match)?.example || '',
    }))
    setFormData((prev) => ({
      ...prev,
      variables: newVariables,
    }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.bodyText])

  const activeAccounts = useMemo(
    () => metaAccounts.filter((account) => account.isActive),
    [metaAccounts]
  )

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const payload: TemplateFormValues = {
      ...formData,
      folderId: formData.folderId || null,
    }
    onSubmit(payload)
  }

  const disableTemplateIdentityFields = mode === 'edit'

  return (
    <form id={formId} onSubmit={handleSubmit} className="space-y-6">
      <fieldset disabled={isSubmitting} className="space-y-6">
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
            <Label htmlFor="templateDisplayName">Template Name (Display) *</Label>
            <Input
              id="templateDisplayName"
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
              disabled={disableTemplateIdentityFields}
              value={formData.metaTemplateName}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  metaTemplateName:
                    mode === 'edit'
                      ? e.target.value
                      : formatMetaTemplateName(e.target.value),
                })
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
              disabled={disableTemplateIdentityFields}
              onValueChange={(value) => setFormData({ ...formData, metaAccountId: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select account" />
              </SelectTrigger>
              <SelectContent>
                {activeAccounts.length === 0 ? (
                  <SelectItem value="__NO_ACCOUNT__" disabled>
                    No active accounts available
                  </SelectItem>
                ) : (
                  activeAccounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.phoneNumber} - {account.displayName}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Category *</Label>
            <Select
              value={formData.category}
              onValueChange={(value) =>
                setFormData({ ...formData, category: value as TemplateFormValues['category'] })
              }
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
          <Label htmlFor="language">Language *</Label>
          <Input
            id="language"
            required
            value={formData.language}
            onChange={(e) => setFormData({ ...formData, language: e.target.value })}
            placeholder="en"
          />
          <p className="text-xs text-muted-foreground">Use Meta language codes, e.g. en, en_US</p>
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
                <div key={variable.name} className="grid gap-2 md:grid-cols-2">
                  <div>
                    <Input value={variable.name} disabled />
                  </div>
                  <div>
                    <Input
                      placeholder="Example value"
                      value={variable.example}
                      onChange={(e) => {
                        const newVars = [...formData.variables]
                        newVars[index] = { ...newVars[index], example: e.target.value }
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
            value={formData.folderId || ''}
            onValueChange={(value) =>
              setFormData({
                ...formData,
                folderId: value === NO_FOLDER_VALUE ? null : value,
              })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="No folder selected" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_FOLDER_VALUE}>No folder</SelectItem>
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
      </fieldset>

      {errorMessage && (
        <div className="flex items-center gap-2 rounded-md bg-red-50 p-3 text-sm text-red-900">
          <AlertCircle className="h-5 w-5" />
          <p>{errorMessage}</p>
        </div>
      )}
    </form>
  )
}

function normalizeInitialValues(values?: Partial<TemplateFormValues>): Partial<TemplateFormValues> {
  if (!values) return {}
  return {
    ...values,
    folderId: values.folderId ?? null,
  }
}


