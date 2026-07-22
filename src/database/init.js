import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import db from '../config/database.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const schemaFile = join(__dirname, 'schema.sql');

export async function initializeDatabase() {
  const sql = await readFile(schemaFile, 'utf8');
  await db.none(sql);
  console.log('Database schema and seed loaded.');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  initializeDatabase()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Error initializing database:', error);
      process.exit(1);
    });
}
