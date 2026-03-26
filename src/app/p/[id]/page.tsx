import { notFound } from 'next/navigation';
import { neon } from '@neondatabase/serverless';
import { ClientWrapper } from '../../../components/ClientWrapper';

interface ProjectPageProps {
  params: Promise<{ id: string }>;
}

async function getProject(id: string) {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    return null;
  }

  try {
    const sql = neon(databaseUrl);
    const rows = await sql`
      SELECT name, data, created_at, updated_at FROM projects WHERE id = ${id}
    `;

    if (rows.length === 0) {
      return null;
    }

    return {
      id,
      name: rows[0].name,
      data: rows[0].data,
      createdAt: rows[0].created_at,
      updatedAt: rows[0].updated_at,
    };
  } catch (error) {
    console.error('Error fetching project:', error);
    return null;
  }
}

export default async function ProjectPage({ params }: ProjectPageProps) {
  const { id } = await params;
  const project = await getProject(id);

  if (!project) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="container mx-auto px-4 py-8 max-w-[1600px]">
        <ClientWrapper
          projectId={project.id}
          projectName={project.name}
          projectData={project.data}
        />
      </div>
    </main>
  );
}
