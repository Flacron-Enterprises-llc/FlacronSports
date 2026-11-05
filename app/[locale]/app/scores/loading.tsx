export default function Loading() {
  return (
    <main id="main" aria-busy="true" className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <div className="fs-skeleton h-10 w-56" />
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => <div key={index} className="fs-skeleton h-40" />)}
      </div>
    </main>
  )
}
