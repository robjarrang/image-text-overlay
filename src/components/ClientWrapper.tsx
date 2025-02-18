'use client';

import dynamic from 'next/dynamic';
import { ErrorBoundary } from './ErrorBoundary';

const ClientApp = dynamic(
  () => import('./ClientApp').then(mod => ({ default: mod.ClientApp })),
  { ssr: false }
);

export function ClientWrapper() {
  return (
    <ErrorBoundary>
      <ClientApp />
    </ErrorBoundary>
  );
}