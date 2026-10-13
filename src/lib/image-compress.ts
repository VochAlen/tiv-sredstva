// Smanjenje fotografije na uređaju prije slanja (tablet/telefon rade slike
// od 3–8 MB; u bazi je base64, pa ciljamo ~100–150 KB).
// Vraća JPEG data URL; baca grešku ako se slika ne može učitati.

export async function compressImage(file: File, maxSide = 1024, quality = 0.7): Promise<string> {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error('Slika se ne može učitati'))
      el.src = url
    })
    const scale = Math.min(1, maxSide / Math.max(img.width, img.height))
    const w = Math.max(1, Math.round(img.width * scale))
    const h = Math.max(1, Math.round(img.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas nije dostupan')
    ctx.drawImage(img, 0, 0, w, h)
    let q = quality
    let out = canvas.toDataURL('image/jpeg', q)
    // Ako je i dalje preveliko za server (limit 400k znakova), smanji kvalitet
    while (out.length > 380_000 && q > 0.3) {
      q -= 0.1
      out = canvas.toDataURL('image/jpeg', q)
    }
    return out
  } finally {
    URL.revokeObjectURL(url)
  }
}
