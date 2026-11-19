/**
 * Nome del file .mtcbook proposto dal titolo del libro: minuscolo, spazi in trattini bassi,
 * senza i caratteri vietati da Windows e dagli altri sistemi. Un titolo vuoto diventa "libro".
 */
export function bookFileName(title: string): string {
  const base = title
    .toLowerCase()
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .replace(/^[._]+|[._]+$/g, '')
    .slice(0, 120)
  return `${base || 'libro'}.mtcbook`
}
