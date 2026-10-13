// Offline queue za worker kiosk (check-out/check-in)
//
// ZAŠTO NE service worker: postojeći public/sw.js presreće samo GET
// zahtjeve (cache statike/stranica). Next.js Server Actions idu kao
// specifično enkodiran POST sa build-vezanim ID-jem akcije - presretanje i
// "replay" takvog zahtjeva u service worker-u je krhko i lomi se na svakom
// buildu. Umjesto toga, red čekanja se vodi ovdje na klijentu (IndexedDB) i
// worker-view.tsx ga prazni pozivajući iste server action funkcije kad se
// veza vrati - jednostavnije i pouzdanije za ovaj slučaj upotrebe.

const DB_NAME = 'gse-control-offline'
const DB_VERSION = 1
const STORE_NAME = 'pending-submissions'

export type QueuedSubmissionType = 'CHECK_OUT' | 'CHECK_IN'

export interface QueuedSubmission {
  id: string
  type: QueuedSubmissionType
  payload: Record<string, unknown>
  equipmentCode: string
  createdAt: string
  attempts: number
  lastError?: string
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB nije dostupan'))
      return
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function addToQueue(item: Omit<QueuedSubmission, 'id' | 'createdAt' | 'attempts'>): Promise<QueuedSubmission> {
  const full: QueuedSubmission = {
    ...item,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    createdAt: new Date().toISOString(),
    attempts: 0,
  }
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).put(full)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
  return full
}

export async function getQueue(): Promise<QueuedSubmission[]> {
  try {
    const db = await openDb()
    const items = await new Promise<QueuedSubmission[]>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const req = tx.objectStore(STORE_NAME).getAll()
      req.onsuccess = () => resolve(req.result as QueuedSubmission[])
      req.onerror = () => reject(req.error)
    })
    db.close()
    return items.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  } catch {
    return []
  }
}

export async function removeFromQueue(id: string): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}

export async function updateQueueItem(id: string, patch: Partial<QueuedSubmission>): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const getReq = store.get(id)
    getReq.onsuccess = () => {
      const existing = getReq.result as QueuedSubmission | undefined
      if (existing) store.put({ ...existing, ...patch })
    }
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}

// Heuristika: da li greška IZGLEDA kao problem sa mrežom (a ne odbijanje
// od strane servera - npr. "niste kvalifikovani" NIJE mrežna greška i ne
// smije se čekirati, mora se odmah pokazati radniku)
export function looksLikeNetworkError(e: unknown): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true
  if (e instanceof TypeError) return true // fetch failed
  const msg = e instanceof Error ? e.message.toLowerCase() : String(e).toLowerCase()
  return msg.includes('fetch') || msg.includes('network') || msg.includes('failed to fetch') || msg.includes('load failed')
}
