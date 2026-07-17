// Разведка статик-индекса players.tarkov.dev (карта aid↔ник) — открыт ли он и какого
// размера/формата. Нужна, чтобы решить, реально ли собрать свой поиск (вариант B).
// Защита — CRON_SECRET (fail-closed). Ничего не пишет, только зовёт кандидатов и
// репортит: статус, content-type, размер, форму JSON и мини-сэмпл.
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const CANDIDATES = [
  "https://players.tarkov.dev/",
  "https://players.tarkov.dev/players.json",
  "https://players.tarkov.dev/index.json",
];

const READ_CAP = 60 * 1024 * 1024; // 60 МБ — выше просто фиксируем «слишком большой»

interface ProbeResult {
  url: string;
  status?: number;
  contentType?: string | null;
  bytes?: number;
  json?: { kind: "array" | "object" | "other"; count?: number; sample?: unknown };
  error?: string;
}

async function probe(url: string): Promise<ProbeResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        accept: "application/json, text/plain, */*",
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
      },
    });
    const contentType = res.headers.get("content-type");
    const buf = await res.arrayBuffer();
    const bytes = buf.byteLength;
    const out: ProbeResult = { url, status: res.status, contentType, bytes };

    if (res.status === 200 && bytes <= READ_CAP) {
      const text = new TextDecoder().decode(buf);
      try {
        const parsed: unknown = JSON.parse(text);
        if (Array.isArray(parsed)) {
          out.json = { kind: "array", count: parsed.length, sample: parsed.slice(0, 3) };
        } else if (parsed && typeof parsed === "object") {
          const keys = Object.keys(parsed as Record<string, unknown>);
          const sample: Record<string, unknown> = {};
          for (const k of keys.slice(0, 3)) sample[k] = (parsed as Record<string, unknown>)[k];
          out.json = { kind: "object", count: keys.length, sample };
        } else {
          out.json = { kind: "other", sample: String(parsed).slice(0, 120) };
        }
      } catch {
        out.error = `не JSON (первые 120 символов: ${text.slice(0, 120)})`;
      }
    } else if (bytes > READ_CAP) {
      out.error = `слишком большой для парса (${bytes} байт)`;
    }
    return out;
  } catch (e) {
    return { url, error: (e as Error).message };
  } finally {
    clearTimeout(timer);
  }
}

export async function GET(req: Request): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const results: ProbeResult[] = [];
  for (const url of CANDIDATES) results.push(await probe(url));
  return NextResponse.json({ at: new Date().toISOString(), results });
}
