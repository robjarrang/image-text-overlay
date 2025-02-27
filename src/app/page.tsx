import { ClientWrapper } from '../components/ClientWrapper';

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="container mx-auto px-4 py-8 max-w-[1440px]">
        <ClientWrapper />
      </div>
    </main>
  );
}