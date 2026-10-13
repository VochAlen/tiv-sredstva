// Štampa jednog ili više QR naljepnica kroz skriveni iframe — štampa se SAMO naljepnica,
// ne cijela stranica dashboarda. Radi na tabletu/telefonu (otvara sistemski dijalog za štampu).

export interface QrLabel {
  svg: string // outerHTML QRCodeSVG elementa
  code: string
  name: string
  location?: string | null
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export function printQrLabels(labels: QrLabel[]): void {
  if (typeof document === 'undefined' || labels.length === 0) return
  const single = labels.length === 1
  const cells = labels
    .map(
      (l) => `<div class="cell">
  <div class="qr">${l.svg}</div>
  <div class="code">${esc(l.code)}</div>
  <div class="name">${esc(l.name)}</div>
  ${l.location ? `<div class="loc">${esc(l.location)}</div>` : ''}
</div>`
    )
    .join('')

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>QR ${single ? esc(labels[0].code) : 'kodovi'}</title>
<style>
  @page { margin: 10mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: Arial, Helvetica, sans-serif; color: #000; }
  .grid { display: grid; grid-template-columns: ${single ? '1fr' : 'repeat(3, 1fr)'}; gap: 6mm; }
  .cell { border: 1px dashed #888; padding: 5mm; text-align: center; break-inside: avoid; ${single ? 'max-width: 90mm; margin: 0 auto;' : ''} }
  .qr svg { width: ${single ? '70mm' : '40mm'}; height: ${single ? '70mm' : '40mm'}; }
  .code { font-family: monospace; font-weight: 700; font-size: ${single ? '16pt' : '11pt'}; margin-top: 3mm; }
  .name { font-size: ${single ? '11pt' : '8pt'}; margin-top: 1mm; }
  .loc { font-size: ${single ? '9pt' : '7pt'}; color: #444; margin-top: 1mm; }
</style></head><body><div class="grid">${cells}</div></body></html>`

  const iframe = document.createElement('iframe')
  iframe.setAttribute('aria-hidden', 'true')
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden'
  document.body.appendChild(iframe)
  const doc = iframe.contentDocument
  const win = iframe.contentWindow
  if (!doc || !win) { iframe.remove(); return }
  doc.open(); doc.write(html); doc.close()
  const cleanup = () => setTimeout(() => iframe.remove(), 1000)
  win.onafterprint = cleanup
  // mali odmak da se SVG iscrta prije dijaloga za štampu
  setTimeout(() => {
    try { win.focus(); win.print() } finally { setTimeout(cleanup, 60000) }
  }, 150)
}

// Pomoćnik: izvuci SVG iz DOM kontejnera u kome je renderovan QRCodeSVG
export function svgOf(container: HTMLElement | null): string {
  return container?.querySelector('svg')?.outerHTML ?? ''
}
