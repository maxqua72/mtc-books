// Uso: node scripts/render-payload.mjs <payload.json> <rotta> <uscita.pdf> [porta]
// rotta: /api/pdf/generate  oppure  /api/pdf/generate-book
import { readFile, writeFile } from 'node:fs/promises';

const [payload, route, out, port = '3002'] = process.argv.slice(2);
if (!payload || !route || !out) {
  console.error('Uso: node scripts/render-payload.mjs <payload.json> <rotta> <uscita.pdf> [porta]');
  process.exit(2);
}
const res = await fetch(`http://localhost:${port}${route}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: await readFile(payload),
});
if (!res.ok) {
  console.error('Errore', res.status, await res.text());
  process.exit(1);
}
await writeFile(out, Buffer.from(await res.arrayBuffer()));
console.log('Scritto', out);