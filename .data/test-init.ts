import { ensureSchema } from '../src/lib/db/ddl'; import { seedDemoData } from '../src/lib/db/seed';
ensureSchema().then(() => { console.log('SCHEMA_OK'); return seedDemoData(); }).then(() => { console.log('SEED_OK'); process.exit(0); }).catch((e) => { console.error('FAIL:', e?.cause?.message ?? e?.message ?? e); if (e?.cause?.detail) console.error(e.cause.detail); process.exit(1); });
