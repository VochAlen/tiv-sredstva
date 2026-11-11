import type { Metadata } from 'next'
import { CompetenceTest } from '@/components/competence/competence-test'

export const metadata: Metadata = {
  title: 'Provjera znanja | GSE Control',
  robots: { index: false, follow: false },
}

// Javna stranica: radnik se identifikuje ID karticom (kao pri zaduživanju), bez prijave.
export default function ProvjeraPage() {
  return <CompetenceTest />
}
