import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import db from '../config/database.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(__dirname, 'migrations');

async function ensureMigrationsTable() {
  await db.none(`
    CREATE TABLE IF NOT EXISTS migrations (
      id SERIAL PRIMARY KEY,
      filename TEXT NOT NULL UNIQUE,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

async function getAppliedMigrations() {
  const rows = await db.any('SELECT filename FROM migrations ORDER BY id');
  return new Set(rows.map(r => r.filename));
}

async function applyMigration(file) {
  const sql = await fs.readFile(path.join(migrationsDir, file), 'utf8');
  console.log('Applying', file);
  await db.tx(async t => {
    await t.none(sql);
    await t.none('INSERT INTO migrations (filename) VALUES ($1)', [file]);
  });
  console.log('Applied', file);
}

async function run() {
  try {
    const files = (await fs.readdir(migrationsDir)).filter(f => f.endsWith('.sql')).sort();
    if (files.length === 0) {
      console.log('No migration files found');
      return;
    }
    await ensureMigrationsTable();
    const applied = await getAppliedMigrations();
    for (const file of files) {
      if (!applied.has(file)) {
        await applyMigration(file);
      } else {
        console.log('Skipping', file, '(already applied)');
      }
    }
    console.log('Migrations complete.');
  } catch (err) {
    console.error('Migration failed:', err.message || err);
    process.exit(1);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) run();
