"""
Транскрибация голосовых заметок (docs/voice-notes/*.ogg) через faster-whisper.

- Локально, без облака: движок faster-whisper (CTranslate2), декодирование через PyAV.
- GPU (RTX 3080) + large-v3 по умолчанию; авто-фолбэк на CPU int8, если CUDA не поднялась.
- На выход: docs/voice-notes/transcripts/<имя>.md — дословный текст с таймкодами.

Запуск:  python scripts/transcribe-voice-notes.py
"""

from __future__ import annotations

import glob
import os
import site
import sys
import time
from pathlib import Path

# Windows-консоль (cp1251) не кодирует юникод-вывод → форсим UTF-8
for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

# --- Пути ---------------------------------------------------------------
REPO = Path(__file__).resolve().parents[1]
SRC_DIR = REPO / "docs" / "voice-notes"
OUT_DIR = SRC_DIR / "transcripts"

# --- Windows: подцепить CUDA-DLL (cuBLAS/cuDNN) из site-packages --------
def _register_cuda_dlls() -> None:
    if not hasattr(os, "add_dll_directory"):
        return
    site_dirs = set()
    try:
        site_dirs.update(site.getsitepackages())
    except Exception:
        pass
    try:
        site_dirs.add(site.getusersitepackages())
    except Exception:
        pass
    added = []
    for sp in site_dirs:
        for bindir in glob.glob(os.path.join(sp, "nvidia", "*", "bin")):
            if os.path.isdir(bindir):
                try:
                    os.add_dll_directory(bindir)
                    added.append(bindir)
                except Exception:
                    pass
    if added:
        print(f"[cuda] DLL dirs: {len(added)} шт.")


_register_cuda_dlls()

try:
    from faster_whisper import WhisperModel
except Exception as e:  # noqa: BLE001
    sys.exit(f"[fatal] faster-whisper не установлен: {e}")

# --- Доменный словарь: помогает large-v3 верно писать термины -----------
INITIAL_PROMPT = (
    "Голосовая заметка о веб-портале ЦТА (Центр Тактической Адаптации) "
    "для игры Escape from Tarkov. Термины: бартер, квест, задание, убежище, "
    "лут, рейд, экстракт, лоадаут, сборка, барахолка, торговец, спавн, босс, "
    "маркер, фильтр, карта заданий, меченые комнаты, калькулятор, прогресс."
)

MODEL_SIZE = os.environ.get("WHISPER_MODEL", "large-v3")


def load_model():
    """CUDA float16 → авто-фолбэк на CPU int8."""
    try:
        m = WhisperModel(MODEL_SIZE, device="cuda", compute_type="float16")
        print(f"[model] {MODEL_SIZE} на CUDA (float16)")
        return m, "cuda/float16"
    except Exception as e:  # noqa: BLE001
        print(f"[model] CUDA недоступна ({e}); фолбэк на CPU int8")
        m = WhisperModel(MODEL_SIZE, device="cpu", compute_type="int8")
        print(f"[model] {MODEL_SIZE} на CPU (int8)")
        return m, "cpu/int8"


def ts(seconds: float) -> str:
    m, s = divmod(int(seconds), 60)
    h, m = divmod(m, 60)
    return f"{h:d}:{m:02d}:{s:02d}" if h else f"{m:d}:{s:02d}"


def transcribe_file(model, path: Path) -> dict:
    t0 = time.time()
    segments, info = model.transcribe(
        str(path),
        language="ru",
        beam_size=5,
        vad_filter=True,
        vad_parameters={"min_silence_duration_ms": 500},
        initial_prompt=INITIAL_PROMPT,
    )
    lines_stamped: list[str] = []
    lines_plain: list[str] = []
    for seg in segments:  # генератор — реальная работа тут
        text = seg.text.strip()
        lines_stamped.append(f"`[{ts(seg.start)}]` {text}")
        lines_plain.append(text)
        # живой прогресс в консоль
        print(f"    [{ts(seg.start)}] {text[:70]}")
    dt = time.time() - t0
    return {
        "duration": info.duration,
        "elapsed": dt,
        "stamped": lines_stamped,
        "plain": lines_plain,
    }


def main() -> None:
    args = sys.argv[1:]
    if args:  # конкретные файлы (смоук-тест): по имени из docs/voice-notes/
        files = [SRC_DIR / a for a in args]
        missing = [f for f in files if not f.exists()]
        if missing:
            sys.exit(f"[fatal] нет файлов: {[m.name for m in missing]}")
    else:
        files = sorted(SRC_DIR.glob("*.ogg"))
    if not files:
        sys.exit(f"[fatal] нет .ogg в {SRC_DIR}")
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    print(f"[start] файлов: {len(files)} → {OUT_DIR}")
    model, backend = load_model()

    index_rows = []
    grand_t0 = time.time()
    for i, path in enumerate(files, 1):
        print(f"\n[{i}/{len(files)}] {path.name}")
        r = transcribe_file(model, path)

        md = OUT_DIR / f"{path.stem}.md"
        header = (
            f"# {path.name}\n\n"
            f"> Транскрипт · движок faster-whisper `{MODEL_SIZE}` ({backend}) · "
            f"длительность {ts(r['duration'])} · распознано за {ts(r['elapsed'])}\n\n"
            f"## Дословно (с таймкодами)\n\n"
        )
        body_stamped = "\n\n".join(r["stamped"])
        body_plain = " ".join(r["plain"])
        md.write_text(
            header + body_stamped + "\n\n## Сплошным текстом\n\n" + body_plain + "\n",
            encoding="utf-8",
        )
        print(f"    → {md.relative_to(REPO)}  ({r['elapsed']:.0f}с)")
        index_rows.append(
            f"| [{path.stem}]({path.stem}.md) | {ts(r['duration'])} | {ts(r['elapsed'])} |"
        )

    total = time.time() - grand_t0
    index = (
        "# Транскрипты голосовых заметок\n\n"
        f"> Движок `faster-whisper {MODEL_SIZE}` ({backend}). "
        f"Всего {len(files)} файлов, распознано за {ts(total)}.\n\n"
        "| Файл | Длительность | Распознано за |\n|---|---|---|\n"
        + "\n".join(index_rows)
        + "\n"
    )
    (OUT_DIR / "_INDEX.md").write_text(index, encoding="utf-8")
    print(f"\n[done] всё за {ts(total)} → {(OUT_DIR / '_INDEX.md').relative_to(REPO)}")


if __name__ == "__main__":
    main()
