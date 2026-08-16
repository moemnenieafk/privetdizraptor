'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Settings2, Check, RotateCcw, Plus, Pin, X, Square, RectangleHorizontal, LayoutGrid, Lock } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { usePlayerStore } from '@/store/usePlayerStore';
import { useRoleStore, effectiveRoleFor } from '@/store/useRoleStore';
import {
  FEATURE_CATALOG,
  computeHomeFeatures,
  type HomeFeature,
} from '@/data/feature-catalog';
import { useHomeLayoutStore } from '@/store/useHomeLayoutStore';
import { useSubscription } from '@/hooks/useSubscription';
import { HubCard } from '@/components/ui/HubCard';
import { useXpStore } from '@/store/useXpStore';
import { suggestFeatures } from '@/lib/xp';

// Главная EFT (Слой 1 — конструктор): авто-набор архетипа + ручной override (useHomeLayoutStore).
// Вычисление показа — чистый computeHomeFeatures (§4.7), не JSX. Режим правки за PRO (tier !== 'free');
// free видит кнопку с апселлом на /account. Роль живёт в localStorage → регидрация skipHydration-стора.

// Маппинг размера → variant HubCard: big→square (2×2), middle→rectangle (2×1), mini→mini (1×1).
const sizeToVariant = (size: HomeFeature['size']) =>
  size === 'big' ? 'square' : size === 'mini' ? 'mini' : 'rectangle';

// Габариты edit-превью (те же span'ы, что рендерит HubCard соответствующего variant).
const dimsFor = (size: HomeFeature['size']) =>
  size === 'big'
    ? 'w-full aspect-square md:col-span-2 md:row-span-2'
    : size === 'mini'
      ? 'w-full aspect-square'
      : 'w-full aspect-[348/160] md:col-span-2';

// Цикл ресайза: big → middle → mini → big.
const nextSize = (size: HomeFeature['size']): HomeFeature['size'] =>
  size === 'big' ? 'middle' : size === 'middle' ? 'mini' : 'big';

// Иконка тумблера по текущему размеру.
const sizeIcon = (size: HomeFeature['size']) =>
  size === 'big' ? Square : size === 'middle' ? RectangleHorizontal : LayoutGrid;

export function EftHomeHubClient() {
  useEffect(() => {
    void useRoleStore.persist.rehydrate();
    void useHomeLayoutStore.persist.rehydrate();
    void useXpStore.persist.rehydrate();
  }, []);

  const hydrated = useRoleStore((s) => s._hasHydrated);
  const activeId = usePlayerStore((s) => s.activeProfileId);
  // Дефолт rookie зашит в effectiveRoleFor: аноним/нет данных → осмысленный набор новичка, не пусто.
  const role = useRoleStore((s) => effectiveRoleFor(s, activeId));

  const { tier } = useSubscription();
  const isPro = tier !== 'free';
  const [editing, setEditing] = useState(false);
  const [showAdd, setShowAdd] = useState(false);

  // Override из стора (Слой 1). До монтирования пуст → авто-база (норм).
  const hidden = useHomeLayoutStore((s) => s.hidden);
  const pinned = useHomeLayoutStore((s) => s.pinned);
  const sizes = useHomeLayoutStore((s) => s.sizes);
  const added = useHomeLayoutStore((s) => s.added);
  const toggleHidden = useHomeLayoutStore((s) => s.toggleHidden);
  const togglePinned = useHomeLayoutStore((s) => s.togglePinned);
  const setSize = useHomeLayoutStore((s) => s.setSize);
  const addFeature = useHomeLayoutStore((s) => s.addFeature);
  const reset = useHomeLayoutStore((s) => s.reset);

  const items = computeHomeFeatures(role, { hidden, pinned, sizes, added });

  // XP-слой: запись клика по плитке + подсказки «Крутые фичи для тебя».
  // Собственный mount-гейт (skipHydration): до регидрации xp-стора подсказки не рендерим (§8/§4.5).
  const xpHydrated = useXpStore((s) => s._hasHydrated);
  const discovered = useXpStore((s) => s.discovered);
  const recordFeatureUse = useXpStore((s) => s.recordFeatureUse);
  // onGrid: id плиток, уже показанных на главной — подсказки их не дублируют.
  const onGrid = new Set(items.map((it) => it.feature.id));
  const suggestions = xpHydrated ? suggestFeatures(role, new Set(discovered), onGrid) : [];

  // До регидрации роль ещё не известна → скелетон формы будущей сетки (§8: форма контента,
  // animate-pulse, не спиннер). Число и форма ячеек = вычисленному списку.
  if (!hydrated) {
    return (
      <>
        <PageHeader pageId="eft" dense />
        <div className="home-grid">
          {items.map(({ feature, size }) => (
            <div
              key={feature.id}
              className={`animate-pulse rounded-lg bg-lines-hover ${dimsFor(size)}`}
            />
          ))}
        </div>
      </>
    );
  }

  // Каталог для панели «Добавить»: скрытые + фичи не в наборе; action-фичи (feedback) не добавляемы.
  const addable = FEATURE_CATALOG.filter(
    (f) => f.action === undefined && (!onGrid.has(f.id) || hidden.includes(f.id)),
  );

  // Edit-контролы шапки → в action-слот PageHeader (PRO), либо апселл-CTA (free).
  const headerAction = isPro ? (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {editing && (
        <>
          <button
            type="button"
            onClick={() => setShowAdd((v) => !v)}
            title="Добавить раздел"
            className={`inline-flex items-center gap-2 rounded-sm border px-3 h-9 font-blender-medium text-type-caption uppercase tracking-widest transition-colors ${
              showAdd
                ? 'border-(--primary) bg-(--primary)/12 text-(--primary)'
                : 'border-lines-hover bg-card-menu text-text-secondary hover:border-(--primary) hover:text-(--primary)'
            }`}
          >
            <Plus className="h-4 w-4" />
            Добавить
          </button>
          <button
            type="button"
            onClick={() => reset()}
            title="Сбросить к авто"
            className="inline-flex items-center gap-2 rounded-sm border border-lines-hover bg-card-menu px-3 h-9 font-blender-medium text-type-caption uppercase tracking-widest text-text-secondary transition-colors hover:border-danger hover:text-danger"
          >
            <RotateCcw className="h-4 w-4" />
            Сбросить
          </button>
        </>
      )}
      <button
        type="button"
        onClick={() => {
          setEditing((v) => !v);
          setShowAdd(false);
        }}
        className={`inline-flex items-center gap-2 rounded-sm border px-3 h-9 font-blender-medium text-type-caption uppercase tracking-widest transition-colors ${
          editing
            ? 'border-(--primary) bg-(--primary)/12 text-(--primary)'
            : 'border-lines-hover bg-card-menu text-text-secondary hover:border-(--primary) hover:text-(--primary)'
        }`}
      >
        {editing ? <Check className="h-4 w-4" /> : <Settings2 className="h-4 w-4" />}
        {editing ? 'Готово' : 'Настроить'}
      </button>
    </div>
  ) : (
    // free → апселл-CTA (стиль ProLockTooltip): PRO-бейдж, клик → /account.
    <Link
      href="/account"
      className="inline-flex items-center gap-2 rounded-sm border border-tactical-amber/40 bg-tactical-amber/10 px-3 h-9 font-blender-medium text-type-caption uppercase tracking-widest text-tactical-amber transition-colors hover:bg-tactical-amber/20"
    >
      <Lock className="h-4 w-4 shrink-0 text-tactical-amber" />
      Настрой главную под себя — открой в PRO
    </Link>
  );

  return (
    <>
      <PageHeader pageId="eft" action={headerAction} dense />

      {/* Панель «Добавить раздел» — скрытые + каталог не в наборе (транзиентно, под шапкой) */}
      {editing && showAdd && (
        <div className="mb-8 rounded-lg border border-lines-hover bg-card-menu p-4">
          <div className="mb-3 text-type-micro font-blender-medium uppercase tracking-widest text-text-muted">
            Добавить раздел
          </div>
          {addable.length === 0 ? (
            <p className="font-blender-book text-type-caption text-text-secondary">
              Все разделы уже на главной.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {addable.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => addFeature(f.id)}
                  className="inline-flex items-center gap-1.5 rounded-sm border border-lines-hover bg-(--color-base) px-2.5 py-1.5 font-blender-book text-type-caption text-text-secondary transition-colors hover:border-(--primary) hover:text-(--primary)"
                >
                  <Plus className="h-3.5 w-3.5" />
                  {f.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Сетка плиток (фикс-160 колонки, центрованы — см. .home-grid) */}
      <div className="home-grid">
        {items.map(({ feature, size }, index) => {
          const ResizeIcon = sizeIcon(size);
          return editing ? (
            <div
              key={feature.id}
              className={`group relative flex flex-col rounded-lg border border-(--primary)/40 bg-card-menu overflow-hidden ${dimsFor(size)}`}
            >
              {/* Оверлей-контролы правки — клик не навигирует (карточка не Link в edit) */}
              <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-end gap-1.5 p-2.5">
                <EditControl
                  active={pinned.includes(feature.id)}
                  title={pinned.includes(feature.id) ? 'Открепить' : 'Закрепить вверх'}
                  onClick={() => togglePinned(feature.id)}
                >
                  <Pin className="h-4 w-4" />
                </EditControl>
                <EditControl
                  title="Размер (Big → Middle → Mini)"
                  onClick={() => setSize(feature.id, nextSize(size))}
                >
                  <ResizeIcon className="h-4 w-4" />
                </EditControl>
                <EditControl title="Скрыть" onClick={() => toggleHidden(feature.id)}>
                  <X className="h-4 w-4" />
                </EditControl>
              </div>

              {/* Текст плитки (статичный превью) — для mini подпись компактная по центру снизу */}
              {size === 'mini' ? (
                <div className="absolute inset-x-2 bottom-3 text-center">
                  <span className="font-blender-medium text-type-micro uppercase tracking-widest text-text-primary">
                    {feature.name}
                  </span>
                </div>
              ) : (
                <div className="absolute bottom-6 left-6 right-6 flex flex-col gap-1">
                  <h3 className="text-xl font-blender-medium uppercase tracking-wide text-text-primary">
                    {feature.name}
                  </h3>
                  <p
                    className={`text-xs text-text-secondary leading-relaxed ${
                      size === 'big' ? 'line-clamp-4' : 'line-clamp-2'
                    }`}
                  >
                    {feature.description}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <HubCard
              key={feature.id}
              gameId="eft"
              id={feature.id}
              title={feature.name}
              description={feature.description}
              href={feature.href}
              iconPath={feature.iconPath}
              variant={sizeToVariant(size)}
              index={index}
              onSelect={() => recordFeatureUse(feature.id, role)}
            />
          );
        })}
      </div>

      {/* Подсказки «Крутые фичи для тебя» — нетронутые фичи по релевантности архетипу.
          §4.5: пусто (всё открыто) → не рендерим. В режиме правки прячем (не мешать конструктору). */}
      {!editing && suggestions.length > 0 && (
        <section className="mt-6 flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <h2 className="shrink-0 text-type-micro font-blender-medium uppercase tracking-widest text-text-muted">
              Крутые фичи для тебя
            </h2>
            <div className="h-px flex-1 bg-lines-hover" />
          </div>
          <div className="home-grid">
            {suggestions.map((feature) => (
              <HubCard
                key={feature.id}
                gameId="eft"
                id={feature.id}
                title={feature.name}
                description={feature.description}
                href={feature.href}
                iconPath={feature.iconPath}
                variant="rectangle"
                onSelect={() => recordFeatureUse(feature.id, role)}
              />
            ))}
          </div>
        </section>
      )}
    </>
  );
}

/** Иконка-кнопка оверлея правки. Активная (закреплено) — tactical-amber. */
function EditControl({
  children,
  onClick,
  title,
  active = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick();
      }}
      className={`inline-flex h-7 w-7 items-center justify-center rounded-sm border transition-colors ${
        active
          ? 'border-tactical-amber/60 bg-tactical-amber/15 text-tactical-amber'
          : 'border-lines-hover bg-(--color-base)/80 text-text-secondary hover:border-(--primary) hover:text-(--primary)'
      }`}
    >
      {children}
    </button>
  );
}
