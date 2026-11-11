// Poziv AI servisa (OpenAI-kompatibilan /chat/completions, npr. Kilo gateway). Samo na serveru.
// Bez dodatnih biblioteka: jedan fetch, vremensko ograničenje i čitanje odgovora.
// Ključ i model dolaze iz promjenljivih okruženja, nikad iz koda:
//   KILO_API_KEY   ključ sa app.kilo.ai
//   KILO_MODEL     tačan naziv modela iz Kilo liste (npr. onaj sa ":free" na kraju)
//   KILO_BASE_URL  (opciono) podrazumijevano https://ai-gateway.kilo.ai/api/v1
//   AI_ENABLED     "false" = glavni prekidač, gasi AI potpuno

const DEFAULT_BASE = 'https://ai-gateway.kilo.ai/api/v1'

export function aiEnv() {
  const apiKey = (process.env.KILO_API_KEY ?? '').trim()
  const model = (process.env.KILO_MODEL ?? '').trim()
  const baseUrl = (process.env.KILO_BASE_URL ?? DEFAULT_BASE).trim().replace(/\/+$/, '')
  const masterOff = (process.env.AI_ENABLED ?? '').trim().toLowerCase() === 'false'
  return { apiKey, model, baseUrl, masterOff, configured: !!apiKey && !!model && !masterOff }
}

/** Jedan upit modelu. Baca grešku bez detalja (ne ispisuje sadržaj upita ni ključ). */
export async function aiChat(p: { system: string; user: string; maxTokens?: number; temperature?: number; timeoutMs?: number }): Promise<string> {
  const env = aiEnv()
  if (!env.configured) throw new Error('AI nije podešen')
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), p.timeoutMs ?? 25_000)
  try {
    const res = await fetch(`${env.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.apiKey}` },
      body: JSON.stringify({
        model: env.model,
        messages: [{ role: 'system', content: p.system }, { role: 'user', content: p.user }],
        max_tokens: p.maxTokens ?? 1000,
        temperature: p.temperature ?? 0.2,
      }),
      signal: ctrl.signal,
    })
    if (!res.ok) { console.error('AI gateway status', res.status); throw new Error(res.status === 401 || res.status === 403 ? 'AI ključ nije prihvaćen' : res.status === 429 ? 'AI je trenutno preopterećen, pokušajte kasnije' : 'AI nije dostupan') }
    const data: any = await res.json().catch(() => null)
    const choice = data?.choices?.[0]
    const c = choice?.message?.content
    // Neki modeli vraćaju sadržaj kao niz dijelova: [{type:"text", text:"..."}]
    const out = typeof c === 'string' ? c : Array.isArray(c) ? c.map((x: any) => (typeof x?.text === 'string' ? x.text : '')).join('') : ''
    if (!out.trim()) {
      const apiMsg = typeof data?.error?.message === 'string' ? data.error.message.slice(0, 120) : ''
      console.error('AI empty response', { finish: choice?.finish_reason, hasReasoning: !!choice?.message?.reasoning || !!choice?.message?.reasoning_content, apiMsg })
      if (apiMsg) throw new Error(`AI greška: ${apiMsg}`)
      if (choice?.finish_reason === 'length') throw new Error('AI model je potrošio sav prostor na razmišljanje. Izaberite model bez „reasoning“ načina ili probajte ponovo.')
      throw new Error('AI nije vratio odgovor (provjerite naziv modela u KILO_MODEL)')
    }
    return out
  } catch (e) {
    if (e instanceof Error && /^AI /.test(e.message)) throw e
    console.error('AI gateway error', e instanceof Error ? e.name : 'unknown')
    throw new Error('AI nije dostupan')
  } finally {
    clearTimeout(timer)
  }
}
