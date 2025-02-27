'use client';

import dynamic from 'next/dynamic';
import { ErrorBoundary } from './ErrorBoundary';

const ClientApp = dynamic(
  () => import('./ClientApp').then(mod => ({ default: mod.ClientApp })),
  { ssr: false }
);

export function ClientWrapper() {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg overflow-hidden">
      <ErrorBoundary>
        <ClientApp />
      </ErrorBoundary>
    </div>
  );
}