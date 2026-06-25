// Detektuje da li je Supabase konfigurisan
// Ako nije, aplikacija radi u "demo mode" sa hardcoded korisnicima

export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  // Provjeri i staro i novo ime env varijable
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  return !!url && !!key && url.startsWith('http') && !url.includes('placeholder')
}

export function isDemoMode(): boolean {
  // Ako je MOCK_DATA=true, uvijek demo mode
  if (process.env.MOCK_DATA === 'true') return true
  if (process.env.MOCK_DATA === 'false') return false
  // Inače, demo mode ako Supabase nije konfigurisan
  return !isSupabaseConfigured()
}

// Demo korisnici (samo za development/preview bez pravog Supabase)
export type DemoUser = {
  id: string
  email: string
  full_name: string
  card_id: string
  role: 'operator' | 'engineer' | 'admin'
  department: string
}

export const DEMO_USERS: DemoUser[] = [
  {
    id: 'demo-operator-001',
    email: 'operator@gse.control',
    full_name: 'Vukan Vojvodić',
    card_id: 'EMP-1001',
    role: 'operator',
    department: 'Ramp',
  },
  {
    id: 'demo-engineer-001',
    email: 'engineer@gse.control',
    full_name: 'Milica Medenica',
    card_id: 'EMP-1004',
    role: 'engineer',
    department: 'Maintenance',
  },
  {
    id: 'demo-admin-001',
    email: 'admin@gse.control',
    full_name: 'Blažo Adžić',
    card_id: 'EMP-1005',
    role: 'admin',
    department: 'Operations',
  },
]

// Password za sve demo korisnike
export const DEMO_PASSWORD = 'DemoPass123!'

export function findDemoUserByEmail(email: string): DemoUser | undefined {
  return DEMO_USERS.find((u) => u.email.toLowerCase() === email.toLowerCase())
}
