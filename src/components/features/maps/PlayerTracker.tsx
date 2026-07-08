'use client';

import type { MutableRefObject } from 'react';
import { useCallback, useEffect, useRef } from 'react';
import L from 'leaflet';
import { Crosshair, Navigation } from 'lucide-react';
import type { EftMapConfig, MapFloor } from '@/data/eft-map-config';
import { useTrackingStore } from '@/store/useTrackingStore';
import {
  ensureReadPermission,
  floorIndexForHeight,
  loadDirHandle,
  parseScreenshotName,
  readNewestScreenshot,
  saveDirHandle,
  type ScreenshotPose,
} from '@/lib/eft-screenshot';

const POLL_MS = 1000;

function playerIcon(rotationDeg: number): L.DivIcon {
  return L.divIcon({
    className: 'cta-player-marker',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    html:
      `<div style="width:28px;height:28px;transform:rotate(${rotationDeg}deg);` +
      `filter:drop-shadow(0 0 4px rgba(0,0,0,.6))">` +
      `<svg viewBox="0 0 24 24" width="28" height="28" fill="var(--primary)">` +
      `<path d="M12 2 L20 21 L12 16 L4 21 Z"/></svg></div>`,
  });
}

interface TrackerOpts {
  mapRef: MutableRefObject<L.Map | null>;
  config: EftMapConfig;
  floors: MapFloor[];
  onRequestFloor?: (idx: number) => void;
}

function useEftTracker({ mapRef, config, floors, onRequestFloor }: TrackerOpts) {
  const { active, follow, status, setActive, setFollow, setStatus, setPose } = useTrackingStore();

  const markerRef = useRef<L.Marker | null>(null);
  const intervalRef = useRef<number | null>(null);
  const lastNameRef = useRef<string | null>(null);
  const floorRef = useRef(-1);

  // Свежие значения в рефах — интервал не пересоздаём, замыкание не устаревает.
  const followRef = useRef(follow);
  const onFloorRef = useRef(onRequestFloor);
  useEffect(() => {
    followRef.current = follow;
  }, [follow]);
  useEffect(() => {
    onFloorRef.current = onRequestFloor;
  }, [onRequestFloor]);

  const place = useCallback(
    (pose: ScreenshotPose) => {
      const map = mapRef.current;
      if (!map) return;
      const ll = L.latLng(pose.z, pose.x); // сырые game-координаты; CRS сам проецирует+вращает
      const rot = pose.yaw + config.coordinateRotation;
      if (!markerRef.current) {
        markerRef.current = L.marker(ll, {
          icon: playerIcon(rot),
          zIndexOffset: 10000,
          interactive: false,
        }).addTo(map);
      } else {
        markerRef.current.setLatLng(ll);
        markerRef.current.setIcon(playerIcon(rot));
      }
      setPose(pose);
      if (followRef.current) map.panTo(ll, { animate: true, duration: 0.4 });
      const idx = floorIndexForHeight(floors, pose.y);
      if (followRef.current && idx !== floorRef.current) {
        floorRef.current = idx;
        onFloorRef.current?.(idx);
      }
    },
    [mapRef, config.coordinateRotation, floors, setPose],
  );

  const tick = useCallback(
    async (handle: FileSystemDirectoryHandle) => {
      const shot = await readNewestScreenshot(handle);
      if (!shot || shot.name === lastNameRef.current) return;
      lastNameRef.current = shot.name;
      const pose = parseScreenshotName(shot.name);
      if (pose) place(pose);
    },
    [place],
  );

  const stop = useCallback(() => {
    if (intervalRef.current != null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    markerRef.current?.remove();
    markerRef.current = null;
    lastNameRef.current = null;
    floorRef.current = -1;
    setActive(false);
    setStatus({ kind: 'idle' });
    setPose(null);
  }, [setActive, setStatus, setPose]);

  const start = useCallback(async () => {
    if (typeof window === 'undefined' || !('showDirectoryPicker' in window)) {
      setStatus({ kind: 'unsupported' });
      return;
    }
    if (!config.transform) {
      setStatus({ kind: 'error', message: 'На этой карте нет проекции координат' });
      return;
    }
    setStatus({ kind: 'requesting' });
    try {
      let handle = await loadDirHandle();
      if (handle && !(await ensureReadPermission(handle))) handle = null;
      if (!handle) {
        const picker = window as unknown as {
          showDirectoryPicker: () => Promise<FileSystemDirectoryHandle>;
        };
        handle = await picker.showDirectoryPicker();
        await ensureReadPermission(handle);
        await saveDirHandle(handle);
      }
      const h = handle;
      setActive(true);
      setStatus({ kind: 'tracking' });
      void tick(h);
      intervalRef.current = window.setInterval(() => void tick(h), POLL_MS);
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') {
        setStatus({ kind: 'idle' });
        return;
      }
      setStatus({ kind: 'error', message: e instanceof Error ? e.message : 'Не удалось прочитать папку' });
    }
  }, [config.transform, tick, setActive, setStatus]);

  const toggle = useCallback(() => {
    if (active) stop();
    else void start();
  }, [active, stop, start]);

  useEffect(
    () => () => {
      if (intervalRef.current != null) window.clearInterval(intervalRef.current);
      markerRef.current?.remove();
    },
    [],
  );

  return { active, follow, status, toggle, toggleFollow: () => setFollow(!follow) };
}

export function PlayerTrackerButton(props: TrackerOpts) {
  const { active, follow, status, toggle, toggleFollow } = useEftTracker(props);
  const supported =
    typeof window !== 'undefined' && 'showDirectoryPicker' in window && Boolean(props.config.transform);
  const requesting = status.kind === 'requesting';

  return (
    <div className="absolute top-3 right-28 z-[550] flex items-center gap-2">
      {active && (
        <button
          type="button"
          onClick={toggleFollow}
          aria-label="Следовать за игроком"
          className={`flex h-8 w-8 items-center justify-center rounded-sm border backdrop-blur-md transition-colors ${
            follow
              ? 'border-(--primary) bg-(--primary) text-(--color-base)'
              : 'border-lines-hover bg-(--color-base)/80 text-text-secondary hover:text-(--primary)'
          }`}
        >
          <Navigation className="h-3.5 w-3.5" />
        </button>
      )}
      <button
        type="button"
        onClick={toggle}
        disabled={!supported && !active}
        title={!supported ? 'Нужен Chrome/Edge на ПК и карта с координатами' : undefined}
        className={`flex items-center gap-1.5 rounded-sm border px-3 py-1.5 font-blender-medium text-type-caption uppercase tracking-widest backdrop-blur-md transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
          active
            ? 'border-(--primary) bg-(--primary) text-(--color-base)'
            : 'border-lines-hover bg-(--color-base)/80 text-text-secondary hover:text-(--primary)'
        }`}
      >
        <Crosshair className={`h-3.5 w-3.5 ${requesting ? 'animate-pulse' : ''}`} />
        {active ? 'Слежу' : 'Позиция'}
      </button>
    </div>
  );
}
