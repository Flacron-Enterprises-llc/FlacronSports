export default function Loading() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
      <div className="w-full max-w-md px-8 py-12 bg-white rounded-xl shadow-lg flex flex-col items-center">
        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden mb-6">
          <div className="h-full bg-[var(--color-primary)] animate-pulse" style={{ width: '80%' }} />
        </div>
        <p className="text-lg font-semibold text-[var(--color-primary)]">Translating blog post...</p>
      </div>
    </div>
  );
} 