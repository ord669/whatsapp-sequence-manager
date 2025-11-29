import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { prisma } from '@/lib/prisma'
import { Users, FileText, GitBranch, MessageSquare } from 'lucide-react'
import { PageChrome } from '@/components/layout/PageChrome'
import { Input } from '@/components/ui/input'

async function getDashboardStats() {
  const [contactsCount, templatesCount, sequencesCount, messagesCount] = await Promise.all([
    prisma.contact.count(),
    prisma.template.count({ where: { status: 'APPROVED' } }),
    prisma.sequence.count({ where: { isActive: true } }),
    prisma.sentMessage.count(),
  ])

  return {
    contactsCount,
    templatesCount,
    sequencesCount,
    messagesCount,
  }
}

export default async function DashboardPage() {
  const stats = await getDashboardStats()

  return (
    <PageChrome
      title="Dashboard"
      description="A snapshot of your WhatsApp automation performance"
      searchContent={
        <Input
          placeholder="Search metrics (coming soon)"
          disabled
          className="h-11 rounded-2xl border-slate-200 text-muted-foreground"
        />
      }>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="rounded-3xl border border-slate-200 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Contacts</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.contactsCount}</div>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border border-slate-200 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Approved Templates</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.templatesCount}</div>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border border-slate-200 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Sequences</CardTitle>
            <GitBranch className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.sequencesCount}</div>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border border-slate-200 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Messages Sent</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.messagesCount}</div>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-[28px] border border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle>Welcome to WhatsApp Sequence Manager</CardTitle>
          <CardDescription>
            Manage your WhatsApp marketing campaigns with automated sequences
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Get started by:</p>
            <ol className="list-decimal space-y-2 pl-5 text-sm">
              <li>Connecting your Meta/WhatsApp Business Account</li>
              <li>Creating message templates and getting them approved</li>
              <li>Adding your contacts</li>
              <li>Building automated sequences with our visual flowchart builder</li>
              <li>Subscribing contacts to sequences</li>
            </ol>
          </div>
        </CardContent>
      </Card>
    </PageChrome>
  )
}

