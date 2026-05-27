export default function Loading() {
  return (
    <div className="min-h-screen bg-base flex flex-col">
      <div className="flex-grow flex items-center justify-center">
        <div className="text-primary font-black animate-pulse tracking-widest uppercase italic">Синхронизация данных...</div>
      </div>
    </div>
  );
}