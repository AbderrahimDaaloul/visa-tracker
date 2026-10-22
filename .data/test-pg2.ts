import { PGlite } from '@electric-sql/pglite';
async function main() {
  try { const db = new PGlite('.data/pglite'); console.log('open ok'); await db.close(); } catch (e) { console.error('MSG:', e.message); console.error('CAUSE:', e?.cause?.message ?? JSON.stringify(e?.cause)); }
}
main();
