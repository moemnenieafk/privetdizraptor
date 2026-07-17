export default function PlayerProfileLoading() {
  return (
    <main className="flex w-full flex-col items-center justify-start pt-7 pb-14" aria-hidden="true">
      <div className="w-full max-w-4xl px-4 xl:px-0">
        <div className="mb-6 h-4 w-20 animate-pulse bg-card-menu" />
        <div className="mb-8 h-32 w-full animate-pulse border border-lines-hover bg-card-menu" />
        <div className="mb-3 h-4 w-24 animate-pulse bg-card-menu" />
        <div className="mb-8 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-20 animate-pulse border border-lines-hover bg-card-menu" />
          ))}
        </div>
        <div className="h-48 w-full animate-pulse border border-lines-hover bg-card-menu" />
      </div>
    </main>
  );
}
