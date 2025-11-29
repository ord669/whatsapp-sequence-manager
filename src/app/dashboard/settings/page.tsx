'use client'

import { useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { TimeFormatPreference, useTimeFormat } from '@/contexts/TimeFormatContext'
import { PageChrome } from '@/components/layout/PageChrome'
import { Input } from '@/components/ui/input'

export default function SettingsPage() {
  const { timeFormat, setTimeFormat, formatTime } = useTimeFormat()
  const previewExample = `18:30 → ${formatTime('18:30')}`
  const [searchQuery, setSearchQuery] = useState('')
  const normalizedQuery = searchQuery.trim().toLowerCase()

  const sections = useMemo(
    () => [
      {
        key: 'time',
        searchable: 'time display clock format preferences 24h 12h business hours preview',
        content: (
          <Card className="rounded-[24px] border border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle>Time Display</CardTitle>
              <CardDescription>
                Decide whether times across the app use 24-hour or AM/PM notation
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="time-format">Preferred format</Label>
                <Select
                  value={timeFormat}
                  onValueChange={(value) => setTimeFormat(value as TimeFormatPreference)}>
                  <SelectTrigger id="time-format">
                    <SelectValue placeholder="Choose format" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="24h">24-hour (18:30)</SelectItem>
                    <SelectItem value="12h">12-hour (6:30 PM)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <p className="text-sm text-muted-foreground">Example: {previewExample}</p>
            </CardContent>
          </Card>
        ),
      },
      {
        key: 'business-hours',
        searchable: 'business hours scheduling availability windows automation',
        content: (
          <Card className="rounded-[24px] border border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle>Business Hours</CardTitle>
              <CardDescription>
                Configure your business hours for message scheduling
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Business hours configuration coming soon...
              </p>
            </CardContent>
          </Card>
        ),
      },
      {
        key: 'webhooks',
        searchable: 'webhook configuration integrations meta whatsapp callbacks',
        content: (
          <Card className="rounded-[24px] border border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle>Webhook Configuration</CardTitle>
              <CardDescription>
                Setup webhooks for receiving Meta/WhatsApp updates
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Webhook settings coming soon...</p>
            </CardContent>
          </Card>
        ),
      },
    ],
    [previewExample, setTimeFormat, timeFormat]
  )

  const visibleSections = sections.filter((section) =>
    normalizedQuery === '' ? true : section.searchable.toLowerCase().includes(normalizedQuery)
  )

  return (
    <PageChrome
      title="Settings"
      description="Fine tune global preferences for your workspace"
      searchContent={
        <Input
          placeholder="Search settings..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="h-11 rounded-2xl border-slate-200"
        />
      }>
      {visibleSections.length === 0 ? (
        <div className="rounded-[24px] border border-dashed border-slate-300 bg-white/60 p-10 text-center text-sm text-muted-foreground">
          No settings match your search.
        </div>
      ) : (
        <div className="space-y-6">
          {visibleSections.map((section) => (
            <div key={section.key}>{section.content}</div>
          ))}
        </div>
      )}
    </PageChrome>
  )
}

