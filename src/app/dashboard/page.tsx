import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth-server'
import { isDemoMode } from '@/lib/auth-mode'
import { DashboardContent } from './dashboard-content'

export default async function DashboardPage() {
  const user = await getCurrentUser()
  if (!user) {
    redirect('/login?redirect=/dashboard')
  }
  return <DashboardContent user={user} demoMode={isDemoMode()} />
}
