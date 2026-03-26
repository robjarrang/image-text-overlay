'use client';

import dynamic from 'next/dynamic';
import { ErrorBoundary } from './ErrorBoundary';

const ClientApp = dynamic(
  () => import('./ClientApp').then(mod => ({ default: mod.ClientApp })),
  { ssr: false }
);

interface ClientWrapperProps {
  projectId?: string;
  projectName?: string;
  projectData?: any;
}

export function ClientWrapper({ projectId, projectName, projectData }: ClientWrapperProps = {}) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg overflow-hidden">
      <ErrorBoundary>
        <ClientApp projectId={projectId} projectName={projectName} projectData={projectData} />
      </ErrorBoundary>
    </div>
  );
}