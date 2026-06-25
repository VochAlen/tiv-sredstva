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
    // Ostali ne-ASCII karakteri → ? (sigurnost)
    .replace(/[^\x00-\x7F]/g, '?')
}
