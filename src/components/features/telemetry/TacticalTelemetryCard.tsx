// TacticalTelemetryCard.tsx
import { Suspense } from 'react';
import TelemetryDetailsClient from './TelemetryDetailsClient';

interface TelemetryData {
  id: string;
  designation: string;
  status: 'ACTIVE' | 'OFFLINE' | 'COMPROMISED';
  ping: number;
}

interface TacticalTelemetryCardProps {
  data: TelemetryData;
}

export async function TacticalTelemetryCard({ data }: TacticalTelemetryCardProps) {
  return (
    <article className="relative flex w-full max-w-md flex-col p-4 bg-zinc-950 border border-zinc-800 text-zinc-200 shadow-md">
      <header className="flex items-center justify-between mb-4 border-b border-zinc-800 pb-2">
        <h2 className="text-lg font-bold uppercase tracking-widest text-zinc-100">
          {data.designation}
        </h2>
        <span className="font-mono text-xs text-zinc-500">
          SYS_ID:{data.id}
        </span>
      </header>

      <div className="flex flex-col gap-2 font-mono text-sm">
        <div className="flex items-center justify-between">
          <span className="text-zinc-500">STATUS</span>
          <span
            className={`font-bold ${
              data.status === 'ACTIVE'
                ? 'text-lime-400'
                : data.status === 'OFFLINE'
                ? 'text-zinc-500'
                : 'text-rose-500'
            }`}
          >
            {data.status}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-zinc-500">LATENCY</span>
          <span className="text-zinc-300">{data.ping}ms</span>
        </div>
      </div>

      <Suspense fallback={<div className="mt-4 h-9 w-full animate-pulse bg-zinc-900 border border-zinc-800" />}>
        <TelemetryDetailsClient id={data.id} />
      </Suspense>
    </article>
  );
}
