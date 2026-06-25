#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * GSE Control - Setup skripta
 * Pokreće se nakon `npm install` da pripremi lokalnu bazu sa mock podacima.
 *
 * Upotreba:
 *   npm run setup     # sa npm
 *   bun run setup     # sa bun
 *   node scripts\setup.js  # direktno
 *
 * Radi na Windows, Linux i macOS.
 * Automatski detektuje da li je dostupan bun, npm ili npx.
 */

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

function log(msg) {
  console.log(`\n[setup] ${msg}`)
}

// Detektuj koji package manager je dostupan
function detectPackageManager() {
  // Provjeri da li je bun dostupan
  try {
    execSync('bun --version', { stdio: 'pipe' })
    return 'bun'
  } catch {
    // bun nije dostupan, probaj npm
  }

  // Provjeri da li je npm dostupan
  try {
    execSync('npm --version', { stdio: 'pipe' })
    return 'npm'
  } catch {
    // npm nije dostupan
  }

  console.error('\n[setup] GREŠKA: Ni bun ni npm nisu pronađeni.')
  console.error('[setup] Instaliraj Node.js sa https://nodejs.org (uključuje npm)')
  console.error('[setup] Ili instaliraj Bun sa https://bun.sh')
  process.exit(1)
}

// Pokreni komandu i provjeri rezultat
function run(cmd, label) {
  log(`${label}...`)
  log(`  Pokrećem: ${cmd}`)
  try {
    execSync(cmd, { stdio: 'inherit', cwd: path.join(__dirname, '..') })
    console.log(`  ✓ ${label} - uspješno`)
  } catch (e) {
    console.error(`  ✗ ${label} - GREŠKA`)
    if (e.stderr) console.error(e.stderr.toString())
    process.exit(1)
  }
}

// 1. Detektuj package manager
const pkgManager = detectPackageManager()
log(`Koristim package manager: ${pkgManager}`)

// 2. Provjeri da li postoji .env fajl, kreiraj ako ne postoji
const envPath = path.join(__dirname, '..', '.env')
if (!fs.existsSync(envPath)) {
  log('Kreiram .env fajl sa default vrijednostima...')
  fs.writeFileSync(envPath, `# Auto-generisano od setup skripte
DATABASE_URL="file:./db/custom.db"
MOCK_DATA=true
`)
  console.log('  ✓ .env kreiran')
} else {
  log('.env fajl već postoji - provjeravam putanju baze...')

  // Ako .env postoji ali ima staru Linux-specifičnu putanju, ispravi je
  const envContent = fs.readFileSync(envPath, 'utf8')
  if (envContent.includes('/home/z/') || envContent.includes('file:/home/')) {
    log('Detektovana stara Linux putanja - ispravljam na relativnu...')
    const fixedContent = envContent.replace(
      /DATABASE_URL=["']?file:\/home\/[^"'\n]+["']?/g,
      'DATABASE_URL="file:./db/custom.db"'
    )
    fs.writeFileSync(envPath, fixedContent)
    console.log('  ✓ .env ispravljen - sada koristi relativnu putanju')
  } else {
    console.log('  ✓ .env je ispravan')
  }
}

// 3. Kreiraj db direktorijum ako ne postoji
const dbDir = path.join(__dirname, '..', 'db')
if (!fs.existsSync(dbDir)) {
  log('Kreiram db direktorijum...')
  fs.mkdirSync(dbDir, { recursive: true })
  console.log('  ✓ db/ kreiran')
} else {
  log('db/ direktorijum već postoji')
}

// 4. Push Prisma schema (kreira SQLite bazu)
// Koristimo npx prisma jer radi i sa npm i bez globalnog prisma
log('Kreiram bazu podataka (Prisma db:push)...')
log('  Ovo može potrajati 10-30 sekundi...')
try {
  execSync('npx prisma db push', {
    stdio: 'inherit',
    cwd: path.join(__dirname, '..'),
  })
  console.log('  ✓ Baza kreirana')
} catch (e) {
  console.error('  ✗ GREŠKA pri kreiranju baze')
  console.error('\n[setup] Mogući uzroci:')
  console.error('  1. node_modules nije instaliran - pokrenite: npm install')
  console.error('  2. Prisma nije instalirana - pokrenite: npm install prisma @prisma/client')
  console.error('  3. Premali prostor na disku')
  process.exit(1)
}

// 5. Seed mock podaci
log('Ubacujem mock podatke (seed)...')

// Uvijek koristimo JavaScript verziju seed-a jer radi sa Node.js bez tsx/bun
try {
  execSync('node scripts/seed.js', {
    stdio: 'inherit',
    cwd: path.join(__dirname, '..'),
  })
  console.log('  ✓ Seed podaci ubačeni')
} catch (e) {
  console.error('  ✗ GREŠKA pri seed-u')
  console.error('\n[setup] Mogući uzroci:')
  console.error('  1. @prisma/client nije instaliran - pokrenite: npm install')
  console.error('  2. Baza nije kreirana - provjerite prethodni korak')
  console.error('  3. Pokušajte ručno: node scripts/seed.js')
  process.exit(1)
}

console.log(`
╔══════════════════════════════════════════════════════════╗
║                                                          ║
║   ✅ GSE Control je uspješno postavljen!                 ║
║                                                          ║
║   Sljedeći koraci:                                       ║
║   1. Pokreni:  ${pkgManager === 'bun' ? 'bun' : 'npm'} run dev${' '.repeat(Math.max(0, 16 - (pkgManager === 'bun' ? 3 : 3)))}║
║   2. Otvori:   http://localhost:3000${' '.repeat(Math.max(0, 24))}║
║                                                          ║
║   Mock podaci uključuju:                                 ║
║   • 19 GSE vozila (tow tractors, GPUs, belt loaders...) ║
║   • 5 radnika sa PIN-ovima (1001-1005)                  ║
║   • 3 login korisnika (operator/engineer/admin)         ║
║                                                          ║
║   Login korisnici:                                       ║
║   • operator@gse.control / DemoPass123!                  ║
║   • engineer@gse.control / DemoPass123!                  ║
║   • admin@gse.control    / DemoPass123!                  ║
║                                                          ║
║   Worker PIN-ovi (za QR scan bez login-a):              ║
║   • 1001 = Vukan Vojvodić (Operator)                    ║
║   • 1002 = Milena Popović (Operator)                    ║
║   • 1003 = Novak Knežević (Senior Operator)             ║
║   • 1004 = Milica Medenica (Technician)                 ║
║   • 1005 = Blažo Adžić (Supervisor)                     ║
║                                                          ║
║   Za produkciju:                                         ║
║   • Postavi MOCK_DATA=false u .env                       ║
║   • Dodaj NEXT_PUBLIC_SUPABASE_URL                       ║
║   • Dodaj NEXT_PUBLIC_SUPABASE_ANON_KEY                  ║
║                                                          ║
╚══════════════════════════════════════════════════════════╝
`)
