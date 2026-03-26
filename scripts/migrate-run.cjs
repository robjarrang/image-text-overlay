const { neon } = require('@neondatabase/serverless');

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

const sql = neon(DATABASE_URL);

async function migrate() {
  console.log('Creating folders table...');
  await sql`
    CREATE TABLE IF NOT EXISTS folders (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  console.log('Creating projects table...');
  await sql`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL DEFAULT 'Untitled Project',
      folder_id TEXT REFERENCES folders(id) ON DELETE SET NULL,
      data JSONB NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  console.log('Creating indexes...');
  await sql`CREATE INDEX IF NOT EXISTS idx_projects_created_at ON projects (created_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_projects_folder_id ON projects (folder_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_folders_created_at ON folders (created_at DESC)`;

  console.log('Dropping edit_token column if exists...');
  await sql`ALTER TABLE projects DROP COLUMN IF EXISTS edit_token`;

  console.log('Migration complete!');
}

migrate().catch(e => { console.error('FAILED:', e); process.exit(1); });
