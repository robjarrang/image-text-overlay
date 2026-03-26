import { neon } from '@neondatabase/serverless';

/**
 * Get a Neon SQL client using the DATABASE_URL environment variable.
 * Neon's serverless driver uses HTTP, which is ideal for Vercel serverless functions.
 */
export function getDb() {
  const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!databaseUrl) {
    throw new Error(
      'DATABASE_URL environment variable is not set. ' +
      'Add a Neon Postgres database to your Vercel project, then run `vercel env pull` to get your .env.local file.'
    );
  }
  return neon(databaseUrl);
}
