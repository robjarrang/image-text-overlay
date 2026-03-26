export default function ProjectNotFound() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-slate-800 dark:text-slate-200 mb-4">
          Project Not Found
        </h1>
        <p className="text-slate-600 dark:text-slate-400 mb-8">
          This project link may be invalid or the project may have been removed.
        </p>
        <a
          href="/"
          className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Go to Editor
        </a>
      </div>
    </main>
  );
}
