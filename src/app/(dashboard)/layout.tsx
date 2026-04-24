import Sidebar from '@/components/layout/Sidebar'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div suppressHydrationWarning className="h-screen flex flex-col lg:flex-row overflow-hidden" style={{ backgroundColor: '#0a0c12' }}>
      <Sidebar />
      <main className="flex-1 lg:pl-64 pt-14 lg:pt-0 overflow-y-auto" style={{ backgroundColor: '#0a0c12' }}>
        <div className="p-4 lg:p-7 max-w-[1400px] mx-auto w-full">
          {children}
        </div>
      </main>
    </div>
  )
}
