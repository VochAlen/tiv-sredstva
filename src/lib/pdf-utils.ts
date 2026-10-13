// Helper za PDF generaciju - transliteracija hrvatskih dijakritika
// pdf-lib sa StandardFonts.Helvetica ne podržava č, ć, đ, ž, š

export function transliterate(text: string): string {
  if (!text) return ''
  return text
    .replace(/č/g, 'c').replace(/Č/g, 'C')
    .replace(/ć/g, 'c').replace(/Ć/g, 'C')
    .replace(/ž/g, 'z').replace(/Ž/g, 'Z')
    .replace(/š/g, 's').replace(/Š/g, 'S')
    .replace(/đ/g, 'dj').replace(/Đ/g, 'Dj')
    // Tipografski znakovi koji se često koriste u izvještajima (crtice,
    // tačke-razdjelnici, navodnici) - StandardFonts font ih ne podržava,
    // a BEZ ove mape bi (iako slova č/ć/š/ž/đ rade) ovi znakovi padali u
    // catch-all ispod i pretvarali se u "?" - to je bio uzrok upitnika u
    // CAA izvještaju.
    .replace(/[‒-―]/g, '-')   // em/en dash varijante (—, –)
    .replace(/·/g, '.')            // middle dot (·)
    .replace(/[•●]/g, '-')    // bullet (•)
    .replace(/[‘’]/g, "'")    // ‘ ’
    .replace(/[“”]/g, '"')    // “ ”
    .replace(/…/g, '...')          // ellipsis (…)
    .replace(/ /g, ' ')            // non-breaking space
    // Ostali ne-ASCII karakteri → ? (sigurnost, da pdf-lib ne baci grešku)
    .replace(/[^\x00-\x7F]/g, '?')
}
