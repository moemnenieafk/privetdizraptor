'use client';

// Форма анкеты «Связь». Мультивыбор чипами (мобайл-фёрст, 44px), «о себе» с капом,
// сабмит в PUT /api/comlink/profile. 429 (правка раз в час) показываем текстом
// сервера — там уже посчитаны минуты ожидания.
import { useState } from 'react';
import { Check, EyeOff, Loader2 } from 'lucide-react';
import type { ComlinkGoal, ComlinkProfileRow } from '@/db/schema-comlink';
import { EFT_MAP_CONFIG } from '@/data/eft-map-config';

const GOALS: { id: ComlinkGoal; label: string; hint: string }[] = [
  { id: 'partner', label: 'Ищу напарника', hint: 'разовые или регулярные рейды вдвоём-втроём' },
  { id: 'team', label: 'Ищу команду', hint: 'постоянный состав' },
  { id: 'student', label: 'Хочу научиться', hint: 'нужен наставник-шерпа' },
  { id: 'sherpa', label: 'Готов обучать', hint: 'провожу новичков, растим карму' },
];

const TIMES = [
  { id: 'morning', label: 'Утро' },
  { id: 'day', label: 'День' },
  { id: 'evening', label: 'Вечер' },
  { id: 'night', label: 'Ночь' },
];

const STYLES = [
  { id: 'pvp', label: 'ПВП' },
  { id: 'loot', label: 'Лут' },
  { id: 'quests', label: 'Квесты' },
  { id: 'chill', label: 'Чилл' },
];

const MAPS = Object.entries(EFT_MAP_CONFIG).map(([slug, c]) => ({
  slug,
  name: c.displayName ?? slug,
}));

const MAX_ABOUT = 400;

interface ComlinkProfileFormProps {
  initial: ComlinkProfileRow | null;
  onDone: () => void;
  onCancel: () => void;
}

export function ComlinkProfileForm({ initial, onDone, onCancel }: ComlinkProfileFormProps) {
  const [goal, setGoal] = useState<ComlinkGoal>(initial?.goal ?? 'partner');
  const [maps, setMaps] = useState<string[]>(initial?.maps ?? []);
  const [playTime, setPlayTime] = useState<string[]>(initial?.playTime ?? []);
  const [playStyle, setPlayStyle] = useState<string[]>(initial?.playStyle ?? []);
  const [voice, setVoice] = useState(initial?.voice ?? true);
  const [tzOffset, setTzOffset] = useState<number | null>(initial?.tzOffset ?? 0);
  const [about, setAbout] = useState(initial?.about ?? '');
  const [active, setActive] = useState(initial?.active ?? true);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = (list: string[], set: (v: string[]) => void, id: string) =>
    set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/comlink/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal, maps, playTime, playStyle, voice, tzOffset, about, active }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? 'Не удалось сохранить анкету');
        return;
      }
      onDone();
    } catch {
      setError('Сеть недоступна — попробуйте ещё раз');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex w-full flex-col gap-5 rounded-sm border border-lines-hover bg-(--color-base) p-4">
      <h2 className="font-blender-medium text-lg uppercase tracking-widest text-text-primary">
        {initial ? 'Моя анкета' : 'Новая анкета'}
      </h2>

      {/* Цель */}
      <Field label="Цель">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {GOALS.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => setGoal(g.id)}
              className={`flex min-h-14 flex-col items-start justify-center rounded-xs border px-3 py-2 text-left transition-colors ${
                goal === g.id
                  ? 'border-(--primary) bg-[color-mix(in_srgb,var(--primary)_10%,transparent)]'
                  : 'border-lines-hover hover:border-(--primary)'
              }`}
            >
              <span className={`font-blender-medium text-xs uppercase tracking-widest ${goal === g.id ? 'text-(--primary)' : 'text-text-primary'}`}>
                {g.label}
              </span>
              <span className="font-blender-book text-xs text-text-secondary">{g.hint}</span>
            </button>
          ))}
        </div>
      </Field>

      {/* Карты */}
      <Field label="Карты" hint="Пусто = любые">
        <div className="flex flex-wrap gap-1.5">
          {MAPS.map((m) => (
            <Chip
              key={m.slug}
              active={maps.includes(m.slug)}
              onClick={() => toggle(maps, setMaps, m.slug)}
              label={m.name}
            />
          ))}
        </div>
      </Field>

      {/* Время + стиль */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field label="Когда играю">
          <div className="flex flex-wrap gap-1.5">
            {TIMES.map((t) => (
              <Chip key={t.id} active={playTime.includes(t.id)} onClick={() => toggle(playTime, setPlayTime, t.id)} label={t.label} />
            ))}
          </div>
        </Field>

        <Field label="Стиль игры">
          <div className="flex flex-wrap gap-1.5">
            {STYLES.map((s) => (
              <Chip key={s.id} active={playStyle.includes(s.id)} onClick={() => toggle(playStyle, setPlayStyle, s.id)} label={s.label} />
            ))}
          </div>
        </Field>
      </div>

      {/* Голос + часовой пояс */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field label="Голосовая связь">
          <div className="flex gap-1.5">
            <Chip active={voice} onClick={() => setVoice(true)} label="Есть микрофон" />
            <Chip active={!voice} onClick={() => setVoice(false)} label="Без голоса" />
          </div>
        </Field>

        <Field label="Часовой пояс (от МСК)">
          <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
            {[-1, 0, 1, 2, 3, 4, 5, 6, 7].map((tz) => (
              <Chip
                key={tz}
                active={tzOffset === tz}
                onClick={() => setTzOffset(tzOffset === tz ? null : tz)}
                label={`${tz >= 0 ? '+' : ''}${tz}`}
              />
            ))}
          </div>
        </Field>
      </div>

      {/* О себе */}
      <Field label="О себе" hint={`${about.length}/${MAX_ABOUT}`}>
        <textarea
          value={about}
          onChange={(e) => setAbout(e.target.value.slice(0, MAX_ABOUT))}
          rows={3}
          placeholder="Пара слов: опыт, что ищете, на чём общаетесь…"
          className="w-full rounded-sm border border-lines-hover bg-(--color-darkbase) px-3 py-2 font-blender-book text-sm text-text-primary placeholder:text-text-secondary focus:border-(--primary) focus:outline-none"
        />
      </Field>

      {/* Видимость */}
      <button
        type="button"
        onClick={() => setActive((v) => !v)}
        className="flex items-center gap-2 font-blender-book text-sm text-text-secondary"
      >
        <span
          className={`flex h-5 w-5 items-center justify-center rounded-xs border ${
            active ? 'border-(--primary) bg-(--primary)' : 'border-lines-hover'
          }`}
        >
          {active && <Check className="h-3.5 w-3.5 text-(--color-base)" aria-hidden="true" />}
        </span>
        Анкета видна в поиске
        {!active && <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />}
      </button>

      {error && <p className="font-blender-book text-sm text-danger">{error}</p>}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={saving}
          className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xs border border-(--primary) bg-[color-mix(in_srgb,var(--primary)_12%,transparent)] px-5 font-blender-medium text-xs uppercase tracking-widest text-(--primary) transition-colors hover:bg-[color-mix(in_srgb,var(--primary)_20%,transparent)] disabled:pointer-events-none disabled:opacity-40"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Check className="h-4 w-4" aria-hidden="true" />
          )}
          Сохранить
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex h-11 items-center rounded-xs border border-lines-hover px-4 font-blender-medium text-xs uppercase tracking-widest text-text-secondary transition-colors hover:border-(--primary) hover:text-(--primary)"
        >
          Отмена
        </button>
      </div>

      <p className="font-blender-book text-xs text-text-secondary/70">
        Уровень и фракция подтянутся из вашего игрового профиля в трекере ЦТА автоматически.
        Правка анкеты — раз в час. Связь с игроками — через Discord-сервер (ссылка в подвале).
      </p>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <span className="font-blender-medium text-xs uppercase tracking-widest text-text-secondary">
          {label}
        </span>
        {hint && <span className="font-blender-book text-xs text-text-secondary/70">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function Chip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-9 shrink-0 rounded-xs border px-3 font-blender-medium text-xs uppercase tracking-widest transition-colors ${
        active
          ? 'border-(--primary) text-(--primary)'
          : 'border-lines-hover text-text-secondary hover:border-(--primary)'
      }`}
    >
      {label}
    </button>
  );
}
