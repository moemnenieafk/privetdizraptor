import type { MapFloor } from '@/data/eft-map-config';

/** Разобранная поза игрока из имени скриншота EFT. */
export interface ScreenshotPose {
  x: number;
  y: number;
  z: number;
  /** Курс, градусы (game-yaw вокруг вертикали Y). */
  yaw: number;
}

export interface NewestShot {
  name: string;
  lastModified: number;
}

// EFT запекает позицию в имя PNG:
//   2024-05-01[19-42]_-146.3, 5.2, -217.8_0.0, 0.6, 0.0, 0.8_0.00 (0).png
//                     └── x, y, z ──┘ └───── qx, qy, qz, qw ─────┘
const N = '(-?\\d+(?:\\.\\d+)?)';
const POSE_RE = new RegExp(`_${N}, ${N}, ${N}_${N}, ${N}, ${N}, ${N}_`);

/** yaw (градусы) из кватерниона Unity (Y — вверх). */
export function quatToYawDeg(qx: number, qy: number, qz: number, qw: number): number {
  const siny = 2 * (qw * qy + qz * qx);
  const cosy = 1 - 2 * (qy * qy + qx * qx);
  return (Math.atan2(siny, cosy) * 180) / Math.PI;
}

/** Разобрать имя скриншота EFT в позу. null — формат не совпал. */
export function parseScreenshotName(name: string): ScreenshotPose | null {
  const m = POSE_RE.exec(name);
  if (!m) return null;
  const nums = m.slice(1).map((s) => Number(s));
  if (nums.length < 7 || nums.some((v) => !Number.isFinite(v))) return null;
  const [x, y, z, qx, qy, qz, qw] = nums;
  return { x, y, z, yaw: quatToYawDeg(qx, qy, qz, qw) };
}

/** Индекс этажа по игровой высоте: самый узкий диапазон, содержащий y (ground=0 — фолбэк). */
export function floorIndexForHeight(floors: MapFloor[], y: number): number {
  let best = 0;
  let bestWidth = Number.POSITIVE_INFINITY;
  floors.forEach((f, i) => {
    const h = f.height;
    if (!h || y < h[0] || y > h[1]) return;
    const width = h[1] - h[0];
    if (width < bestWidth) {
      bestWidth = width;
      best = i;
    }
  });
  return best;
}

/** Самый свежий .png в папке (по lastModified). */
export async function readNewestScreenshot(
  handle: FileSystemDirectoryHandle,
): Promise<NewestShot | null> {
  let newest: NewestShot | null = null;
  for await (const entry of handle.values()) {
    if (entry.kind !== 'file' || !entry.name.toLowerCase().endsWith('.png')) continue;
    const file = await entry.getFile();
    if (!newest || file.lastModified > newest.lastModified) {
      newest = { name: entry.name, lastModified: file.lastModified };
    }
  }
  return newest;
}

// queryPermission/requestPermission ещё не в стандартных DOM-типах — узкий интерфейс без any.
interface PermissionCapableHandle {
  queryPermission(desc: { mode: 'read' | 'readwrite' }): Promise<PermissionState>;
  requestPermission(desc: { mode: 'read' | 'readwrite' }): Promise<PermissionState>;
}

export async function ensureReadPermission(handle: FileSystemDirectoryHandle): Promise<boolean> {
  const h = handle as unknown as PermissionCapableHandle;
  if ((await h.queryPermission({ mode: 'read' })) === 'granted') return true;
  return (await h.requestPermission({ mode: 'read' })) === 'granted';
}

// --- Персист хендла папки в IndexedDB (FileSystemDirectoryHandle не сериализуется в JSON) ---
const DB_NAME = 'cta-tracker';
const STORE = 'handles';
const KEY = 'eft-screenshots-dir';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveDirHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  const db = await openDb();
  await new Promise<void>((res, rej) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(handle, KEY);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
  db.close();
}

export async function loadDirHandle(): Promise<FileSystemDirectoryHandle | null> {
  const db = await openDb();
  const handle = await new Promise<FileSystemDirectoryHandle | null>((res, rej) => {
    const tx = db.transaction(STORE, 'readonly');
    const rq = tx.objectStore(STORE).get(KEY);
    rq.onsuccess = () => res((rq.result as FileSystemDirectoryHandle) ?? null);
    rq.onerror = () => rej(rq.error);
  });
  db.close();
  return handle;
}
