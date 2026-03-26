/**
 * Database migration script for the projects and folders tables.
 * 
 * Run this once to set up the database schema:
 *   npx tsx scripts/migrate.ts
 * 
 * Or run the SQL directly in the Neon console.
 * 
 * Requires DATABASE_URL environment variable to be set.
 */

import { neon } from '@neondatabase/serverless';

async function migrate() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('ERROR: DATABASE_URL environment variable is not set.');
    console.error('Run `vercel env pull .env.local` to get your database credentials,');
    console.error('then run: source .env.local && npx tsx scripts/migrate.ts');
    process.exit(1);
  }

  const sql = neon(databaseUrl);

  // --- Folders table ---
  console.log('Creating folders table...');
  await sql`
    CREATE TABLE IF NOT EXISTS folders (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  // --- Projects table ---
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
  
  await sql`
    CREATE INDEX IF NOT EXISTS idx_projects_created_at 
    ON projects (created_at DESC)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_projects_folder_id 
    ON projects (folder_id)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_folders_created_at 
    ON folders (created_at DESC)
  `;

  // --- Add columns to existing tables (safe to re-run) ---
  // These use DO blocks so they won't fail if the columns already exist.
  console.log('Ensuring name and folder_id columns exist on projects...');

  await sql`
    DO $$ BEGIN
      ALTER TABLE projects ADD COLUMN IF NOT EXISTS name TEXT NOT NULL DEFAULT 'Untitled Project';
    EXCEPTION WHEN duplicate_column THEN NULL;
    END $$
  `;

  await sql`
    DO $$ BEGIN
      ALTER TABLE projects ADD COLUMN IF NOT EXISTS folder_id TEXT REFERENCES folders(id) ON DELETE SET NULL;
    EXCEPTION WHEN duplicate_column THEN NULL;
    END $$
  `;

  // --- Drop edit_token column if it exists (no longer used) ---
  console.log('Dropping edit_token column if it exists...');
  await sql`
    DO $$ BEGIN
      ALTER TABLE projects DROP COLUMN IF EXISTS edit_token;
    EXCEPTION WHEN undefined_column THEN NULL;
    END $$
  `;

  // --- Add parent_id for nested folders ---
  console.log('Adding parent_id column to folders for subfolder support...');
  await sql`
    ALTER TABLE folders ADD COLUMN IF NOT EXISTS parent_id TEXT REFERENCES folders(id) ON DELETE CASCADE
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_folders_parent_id ON folders (parent_id)
  `;

  console.log('Migration complete! The folders and projects tables are ready.');
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
