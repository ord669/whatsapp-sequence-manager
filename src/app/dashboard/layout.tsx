import { Sidebar } from '@/components/layout/Sidebar'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen w-full overflow-hidden bg-secondary">
      <Sidebar />
      <main className="flex flex-1 flex-col overflow-hidden">
        <div className="flex-1 overflow-hidden bg-muted/30">
          <div className="flex h-full min-h-0 flex-col overflow-hidden px-8 py-10">
            <div className="mx-auto flex h-full min-h-0 w-full max-w-7xl flex-1 flex-col gap-6">
              {children}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

