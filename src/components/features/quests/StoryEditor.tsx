'use client';

// Конструктор сюжетного гайда (E10, фаза 5).
//
// Это НЕ WYSIWYG: гайд — дерево (шаг → под-этап → ветка-развилка), и текстовый
// редактор его не выразит. Форма правит то, что реально меняется руками: тексты,
// порядок шагов, медиа (видео + скриншоты из библиотеки), версию сверки, статус.
//
// СЛОЖНЫЕ УЗЛЫ (условия с BSG-id предметов, станции убежища, priceNote) форма не
// трогает — они уходят на сервер как есть и валидируются санитайзером. Их правка
// требует подбора id из каталога; это отдельная итерация, а ломать их «пустой формой»
// нельзя — именно так теряется контент.
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowDown, ArrowUp, Check, ImageIcon, Loader2, Plus, Trash2, X } from 'lucide-react';
import { MediaPicker } from '@/components/features/media/MediaPicker';
import type {
  StoryMedia,
  StoryWalkthrough,
  WalkthroughStep,
} from '@/data/story-walkthroughs/types';

interface Props {
  story: StoryWalkthrough;
  published: boolean;
  fromStatic: boolean;
  onClose: () => void;
}

const field =
  'w-full rounded-xs border border-lines-hover bg-(--color-darkbase) px-3 py-2 font-blender-book text-sm text-text-primary outline-none focus:border-(--primary)';
const label = 'font-blender-medium text-type-micro uppercase tracking-widest text-text-muted';
const btn =
  'flex h-11 items-center gap-2 rounded-xs border border-lines-hover px-4 font-blender-medium text-xs uppercase tracking-widest text-text-secondary transition-colors hover:border-(--primary) hover:text-(--primary)';

/** Текст блока в форме: абзацы построчно (пустая строка = новый абзац). */
const joinText = (v?: string[]) => (v ?? []).join('\n\n');
const splitText = (v: string) => v.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
const joinList = (v?: string[]) => (v ?? []).join('\n');
const splitList = (v: string) => v.split('\n').map((p) => p.trim()).filter(Boolean);

export function StoryEditor({ story, published: initialPublished, fromStatic, onClose }: Props) {
  const router = useRouter();

  const [doc, setDoc] = useState<StoryWalkthrough>(story);
  const [published, setPublished] = useState(initialPublished);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Куда вернётся выбранная картинка: скриншоты шага N или hero-арт. */
  const [picking, setPicking] = useState<{ target: 'hero' | number } | null>(null);

  const setStep = (i: number, patch: Partial<WalkthroughStep>) =>
    setDoc((d) => ({
      ...d,
      steps: d.steps.map((s, n) => (n === i ? { ...s, ...patch } : s)),
    }));

  const setMedia = (i: number, patch: Partial<StoryMedia>) =>
    setDoc((d) => ({
      ...d,
      steps: d.steps.map((s, n) => {
        if (n !== i) return s;
        const base: StoryMedia = s.media ?? {
          poster: '',
          posterTitle: d.title.toUpperCase(),
          posterSub: 'ПРОХОЖДЕНИЕ СЮЖЕТА',
          screenshots: [],
        };
        return { ...s, media: { ...base, ...patch } };
      }),
    }));

  const moveStep = (i: number, delta: number) =>
    setDoc((d) => {
      const j = i + delta;
      if (j < 0 || j >= d.steps.length) return d;
      const steps = [...d.steps];
      [steps[i], steps[j]] = [steps[j], steps[i]];
      // n — номер шага в интерфейсе, он должен следовать порядку, а не переезжать вместе с шагом.
      return { ...d, steps: steps.map((s, k) => ({ ...s, n: k + 1 })) };
    });

  const addStep = () =>
    setDoc((d) => ({
      ...d,
      steps: [...d.steps, { n: d.steps.length + 1, title: '', blocks: [] }],
    }));

  const removeStep = (i: number) =>
    setDoc((d) => ({
      ...d,
      steps: d.steps.filter((_, n) => n !== i).map((s, k) => ({ ...s, n: k + 1 })),
    }));

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/stories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...doc, published }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? 'Не удалось сохранить');
        return;
      }
      onClose();
      router.refresh();
    } catch {
      setError('Сеть недоступна');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex w-full flex-col gap-5 rounded-sm border border-(--primary)/40 bg-(--color-base) p-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-blender-medium text-base uppercase tracking-widest text-(--primary)">
          Правка гайда · {doc.slug}
        </h2>
        <button type="button" onClick={onClose} className={btn}>
          <X className="h-4 w-4" aria-hidden="true" />
          Отмена
        </button>
      </header>

      {fromStatic && (
        <p className="rounded-xs border border-tactical-amber/40 bg-tactical-amber/10 px-3 py-2 font-blender-book text-xs text-tactical-amber">
          Гайд пока хранится в коде. Сохранение перенесёт его в базу — дальше правки
          применяются сразу, без деплоя.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <span className={label}>Название</span>
          <input
            className={field}
            value={doc.title}
            onChange={(e) => setDoc((d) => ({ ...d, title: e.target.value }))}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <span className={label}>Сложность</span>
          <div className="flex gap-2">
            <input
              type="number"
              min={0}
              max={7}
              className={`${field} w-20`}
              value={doc.difficulty.skulls}
              onChange={(e) =>
                setDoc((d) => ({
                  ...d,
                  difficulty: { ...d.difficulty, skulls: Number(e.target.value) },
                }))
              }
            />
            <input
              className={field}
              value={doc.difficulty.label}
              onChange={(e) =>
                setDoc((d) => ({ ...d, difficulty: { ...d.difficulty, label: e.target.value } }))
              }
            />
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className={label}>Hero-арт</span>
        <div className="flex gap-2">
          <input
            className={field}
            placeholder="URL баннера"
            value={doc.heroImage ?? ''}
            onChange={(e) => setDoc((d) => ({ ...d, heroImage: e.target.value }))}
          />
          <button type="button" onClick={() => setPicking({ target: 'hero' })} className={`${btn} shrink-0`}>
            <ImageIcon className="h-4 w-4" aria-hidden="true" />
            Выбрать
          </button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <span className={label}>Сверено · дата</span>
          <input
            className={field}
            value={doc.verifiedAt.date}
            onChange={(e) =>
              setDoc((d) => ({ ...d, verifiedAt: { ...d.verifiedAt, date: e.target.value } }))
            }
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <span className={label}>Время</span>
          <input
            className={field}
            value={doc.verifiedAt.time}
            onChange={(e) =>
              setDoc((d) => ({ ...d, verifiedAt: { ...d.verifiedAt, time: e.target.value } }))
            }
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <span className={label}>Версия игры</span>
          <input
            className={field}
            value={doc.verifiedAt.gameVersion}
            onChange={(e) =>
              setDoc((d) => ({
                ...d,
                verifiedAt: { ...d.verifiedAt, gameVersion: e.target.value },
              }))
            }
          />
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <span className={label}>Шаги ({doc.steps.length})</span>

        {doc.steps.map((s, i) => (
          <div key={i} className="flex flex-col gap-3 rounded-xs border border-lines-hover p-3">
            <div className="flex items-center gap-2">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-xs border border-(--primary)/40 font-blender-medium text-xs text-(--primary)">
                {s.n}
              </span>
              <input
                className={field}
                placeholder="Заголовок шага"
                value={s.title}
                onChange={(e) => setStep(i, { title: e.target.value })}
              />
              <button
                type="button"
                onClick={() => moveStep(i, -1)}
                aria-label="Выше"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xs border border-lines-hover text-text-muted transition-colors hover:border-(--primary) hover:text-(--primary)"
              >
                <ArrowUp className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => moveStep(i, 1)}
                aria-label="Ниже"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xs border border-lines-hover text-text-muted transition-colors hover:border-(--primary) hover:text-(--primary)"
              >
                <ArrowDown className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => removeStep(i)}
                aria-label="Удалить шаг"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xs border border-danger/40 text-danger transition-colors hover:bg-danger/10"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>

            <textarea
              rows={3}
              className={field}
              placeholder="Вступление шага"
              value={s.intro ?? ''}
              onChange={(e) => setStep(i, { intro: e.target.value })}
            />

            {/* Блоки: текст и предупреждение. Условия/цены форма не трогает — см. шапку файла. */}
            {s.blocks.map((b, bi) => (
              <div key={bi} className="flex flex-col gap-2 rounded-xs border border-lines-hover/60 p-2">
                <textarea
                  rows={3}
                  className={field}
                  placeholder="Абзацы (пустая строка разделяет)"
                  value={joinText(b.text)}
                  onChange={(e) =>
                    setStep(i, {
                      blocks: s.blocks.map((x, n) =>
                        n === bi ? { ...x, text: splitText(e.target.value) } : x,
                      ),
                    })
                  }
                />
                <textarea
                  rows={2}
                  className={field}
                  placeholder="Под-список: по пункту на строку"
                  value={joinList(b.subList)}
                  onChange={(e) =>
                    setStep(i, {
                      blocks: s.blocks.map((x, n) =>
                        n === bi ? { ...x, subList: splitList(e.target.value) } : x,
                      ),
                    })
                  }
                />
                <input
                  className={field}
                  placeholder="Предупреждение (⚠)"
                  value={b.warning ?? ''}
                  onChange={(e) =>
                    setStep(i, {
                      blocks: s.blocks.map((x, n) =>
                        n === bi ? { ...x, warning: e.target.value } : x,
                      ),
                    })
                  }
                />
                {(b.condition || b.priceNote) && (
                  <p className="font-blender-book text-xs text-text-muted">
                    В блоке есть условие или цена предмета — они сохранятся без изменений.
                  </p>
                )}
              </div>
            ))}

            <button
              type="button"
              onClick={() => setStep(i, { blocks: [...s.blocks, { text: [] }] })}
              className={`${btn} w-fit`}
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Блок текста
            </button>

            {/* Медиа шага */}
            <div className="flex flex-col gap-2 rounded-xs border border-lines-hover/60 p-2">
              <span className={label}>Медиа шага</span>
              <input
                className={field}
                placeholder="Ссылка на видеогайд (YouTube)"
                value={s.media?.videoUrl ?? ''}
                onChange={(e) => setMedia(i, { videoUrl: e.target.value, video: true })}
              />

              {(s.media?.screenshots.length ?? 0) > 0 && (
                <div className="flex flex-wrap gap-2">
                  {s.media?.screenshots.map((url, si) => (
                    <span key={si} className="relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={url}
                        alt=""
                        className="h-16 w-24 rounded-xs border border-lines-hover object-cover"
                      />
                      <button
                        type="button"
                        aria-label="Убрать скриншот"
                        onClick={() =>
                          setMedia(i, {
                            screenshots: (s.media?.screenshots ?? []).filter((_, n) => n !== si),
                          })
                        }
                        className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full border border-danger/60 bg-(--color-base) text-danger"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              <button type="button" onClick={() => setPicking({ target: i })} className={`${btn} w-fit`}>
                <ImageIcon className="h-4 w-4" aria-hidden="true" />
                Добавить скриншот
              </button>
            </div>

            {(s.substeps?.length || s.branches?.length) && (
              <p className="font-blender-book text-xs text-text-muted">
                У шага есть {s.substeps?.length ? `под-этапы (${s.substeps.length})` : ''}
                {s.substeps?.length && s.branches?.length ? ' и ' : ''}
                {s.branches?.length ? `развилки (${s.branches.length})` : ''} — они сохранятся
                без изменений.
              </p>
            )}
          </div>
        ))}

        <button type="button" onClick={addStep} className={`${btn} w-fit`}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Добавить шаг
        </button>
      </div>

      <label className="flex items-center gap-2 font-blender-book text-sm text-text-secondary">
        <input
          type="checkbox"
          checked={published}
          onChange={(e) => setPublished(e.target.checked)}
          className="size-4 accent-[var(--primary)]"
        />
        Опубликовано (снимите — гайд станет черновиком и пропадёт с сайта)
      </label>

      {error && (
        <p className="rounded-xs border border-danger/40 bg-danger/10 px-3 py-2 font-blender-book text-sm text-danger">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={() => void save()}
        disabled={busy}
        className="flex h-11 w-fit items-center gap-2 rounded-xs border border-(--primary) px-5 font-blender-medium text-xs uppercase tracking-widest text-(--primary) transition-colors hover:bg-[color-mix(in_srgb,var(--primary)_12%,transparent)] disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
        Сохранить
      </button>

      {picking && (
        <MediaPicker
          onPick={(url) => {
            if (picking.target === 'hero') setDoc((d) => ({ ...d, heroImage: url }));
            else {
              const i = picking.target;
              const current = doc.steps[i]?.media?.screenshots ?? [];
              setMedia(i, { screenshots: [...current, url], screenshotsSoon: false });
            }
          }}
          onClose={() => setPicking(null)}
        />
      )}
    </div>
  );
}
