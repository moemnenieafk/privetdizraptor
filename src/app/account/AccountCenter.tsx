'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronDown, Check, LogOut, Eye, EyeOff } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { changeEmail, saveSocials, saveNotifications, changeUsername, uploadAvatar, resetCtaProgress } from '@/lib/cta-api';
import type { Me, SocialPlatform, AccountStats } from '@/lib/auth/me';
import { validatePassword, isPasswordValid, PASSWORD_HINT } from '@/lib/auth/password-policy';
import { OAuthLogins } from './OAuthLogins';
import { DiscordIcon, TwitchIcon, YouTubeIcon, SteamIcon } from '@/components/ui/BrandIcons';
import type { AchievementView } from '@/lib/achievement-visuals';
import type { AchievementHint } from '@/lib/achievement-hints';
import type { QuestsDigestData } from '@/lib/tracking-digest';
import type { HideoutNeed, HideoutStationInfo } from '@/db/hideout';
import { PROGRESS_KEYS } from '@/lib/progress-storage';
import { EDITIONS } from '@/components/layout/header-modules/ProfileSettingsModal';
import { TrackingPanel } from './TrackingPanel';
import { tierMeta, type TierId } from '@/data/subscription-tiers';
import type { ShowcaseTier } from '@/lib/gating/showcase';
import type { BillingHistoryEntry } from '@/lib/subscription.server';
import { TierCard, TierCtaPending } from '@/components/features/subscription/TierCard';
import { AccessMatrix } from '@/components/features/subscription/AccessMatrix';

const USERNAME_RE = /^[A-Za-z0-9_-]{3,15}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/; // зеркалит серверный EMAIL_RE
const USERNAME_COOLDOWN_DAYS = 60; // 2 месяца ≈ 60 дней (зеркалит серверный кулдаун)
const DAY_MS = 24 * 60 * 60 * 1000;

// ─── Types ───────────────────────────────────────────────────────────────────

type TabId = 'profile' | 'tracking' | 'security' | 'linking' | 'billing' | 'prostatus';
type ViewId = 'avatar' | 'username' | 'email' | 'subscription' | 'password' | '2fa' | 'plan' | 'social';

interface NavTab {
  id: TabId;
  label: string;
  iconClass: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const NAV_TABS: NavTab[] = [
  { id: 'profile',   label: 'Профиль',      iconClass: 'icon-account_profile_icon' },
  { id: 'tracking',  label: 'Трекинг',      iconClass: 'icon-eft-progress' },
  { id: 'security',  label: 'Безопасность', iconClass: 'icon-account_security_icon' },
  { id: 'linking',   label: 'Спецсвязь',    iconClass: 'icon-account_linking_icon' },
  { id: 'billing',   label: 'Платежи',      iconClass: 'icon-account_billing_icon' },
  { id: 'prostatus', label: 'PRO-статус',   iconClass: 'icon-account_prostatus_icon' },
];

const PLATFORMS = [
  // Бренд-цвета внешних платформ — это ДАННЫЕ, не часть NIGHTFALL → HEX тут ок,
  // рендерим фон inline-стилем. Привязка/хендл — РЕАЛЬНЫЕ из профиля (me.socials).
  { id: 'twitch',  name: 'TWITCH',  color: '#9146FF' },
  { id: 'youtube', name: 'YOUTUBE', color: '#FF0000' },
  { id: 'discord', name: 'DISCORD', color: '#5865F2' },
  { id: 'steam',   name: 'STEAM',   color: '#A3BCCE' },
] as const;

// Бренд-глифы под ручные хендлы (тот же реестр, что у OAuth-входов).
const PLATFORM_ICON: Record<SocialPlatform, typeof DiscordIcon> = {
  twitch: TwitchIcon,
  youtube: YouTubeIcon,
  discord: DiscordIcon,
  steam: SteamIcon,
};

const GAMES = [
  { id: 'eft', logo: '/images/games/eft-logo.webp', title: 'Escape From Tarkov' },
];

// ─── Primitive atoms ──────────────────────────────────────────────────────────

function FlatRow({
  label,
  action,
  children,
}: {
  label: string;
  action?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-4 border-b border-lines-hover py-5 last:border-b-0">
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="font-blender-medium text-type-caption uppercase tracking-widest text-text-muted">
          {label}
        </span>
        {children && (
          <div className="flex flex-wrap items-center gap-2">{children}</div>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

function RowBtn({
  onClick,
  label = 'Изменить',
  variant = 'default',
}: {
  onClick?: () => void;
  label?: string;
  variant?: 'default' | 'danger' | 'active';
}) {
  const cls = {
    default: 'border-lines-hover text-text-muted hover:border-(--primary) hover:text-(--primary)',
    danger:  'border-danger/40 text-danger hover:border-danger hover:bg-danger/10',
    active:  'border-(--primary) text-(--primary) bg-(--primary)/5',
  }[variant];
  return (
    <button
      onClick={onClick}
      className={`flex items-center rounded border px-4 py-2 font-blender-medium text-type-caption uppercase tracking-widest transition-all duration-200 ${cls}`}
    >
      {label}
    </button>
  );
}

function BackBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="mb-6 inline-flex items-center gap-1 rounded border border-lines-hover bg-card-menu px-3 py-1.5 font-blender-medium text-type-caption uppercase tracking-widest text-text-muted transition-colors hover:border-(--primary) hover:text-(--primary)"
    >
      <ChevronLeft className="h-3 w-3" />
      Назад
    </button>
  );
}

function SubTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-1 text-center font-blender-medium text-sm uppercase tracking-widest text-text-primary lg:text-base">
      {children}
    </h2>
  );
}

function FormInput({
  placeholder,
  type = 'text',
  value,
  onChange,
  disabled,
  readOnly,
  maxLength,
  autoComplete,
  inputMode,
}: {
  placeholder: string;
  type?: string;
  value: string;
  onChange?: (v: string) => void;
  disabled?: boolean;
  readOnly?: boolean;
  maxLength?: number;
  autoComplete?: string;
  inputMode?: 'numeric' | 'text' | 'email';
}) {
  const [reveal, setReveal] = useState(false);
  const isPassword = type === 'password';
  const effectiveType = isPassword && reveal ? 'text' : type;
  return (
    <div className="relative w-full">
      <input
        type={effectiveType}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        disabled={disabled}
        readOnly={readOnly}
        maxLength={maxLength}
        autoComplete={autoComplete}
        inputMode={inputMode}
        className={`w-full rounded border border-lines-hover bg-(--color-base) px-4 py-3 ${isPassword ? 'pr-11' : ''} font-blender-book text-sm text-text-primary placeholder:text-text-muted transition-colors focus:border-(--primary) focus:outline-none disabled:opacity-50 read-only:opacity-70`}
      />
      {isPassword && (
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setReveal((r) => !r)}
          aria-label={reveal ? 'Скрыть пароль' : 'Показать пароль'}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted transition-colors hover:text-(--primary)"
        >
          {reveal ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      )}
    </div>
  );
}

function FormActions({
  onCancel,
  submitting,
  disabled,
  label = 'Отправить',
}: {
  onCancel: () => void;
  submitting?: boolean;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-3">
      <button
        type="submit"
        disabled={submitting || disabled}
        className="w-full max-w-45 rounded border border-(--primary) bg-(--primary)/10 px-6 py-2.5 font-blender-medium text-type-caption uppercase tracking-widest text-(--primary) transition-all hover:bg-(--primary)/20 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {submitting ? 'Отправляю…' : label}
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="font-blender-book text-xs text-text-muted underline underline-offset-4 transition-colors hover:text-(--primary)"
      >
        Отменить
      </button>
    </div>
  );
}

function CooldownWarning({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded border border-danger/30 bg-danger/10 px-4 py-2.5 text-center font-blender-book text-xs leading-relaxed text-danger">
      {children}
    </div>
  );
}

// Строка обратной связи под формой: ошибка (danger) или успех (green).
function Feedback({ error, success }: { error?: string | null; success?: string | null }) {
  if (error) {
    return (
      <p className="text-center font-blender-book text-xs leading-relaxed text-danger">{error}</p>
    );
  }
  if (success) {
    return (
      <p className="text-center font-blender-book text-xs leading-relaxed text-green-400">
        {success}
      </p>
    );
  }
  return null;
}

// ─── Edit sub-views ───────────────────────────────────────────────────────────

const AVATAR_OUT = 400; // итоговый размер квадрата (px), webp

function AvatarView({ onBack, me }: { onBack: () => void; me: Me }) {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [scale, setScale] = useState(1);
  const [status, setStatus] = useState<'idle' | 'saving' | 'done'>('idle');
  const [error, setError] = useState<string | null>(null);

  // Чистим отложенный onBack, если вью размонтировали раньше срабатывания.
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  // Перерисовка квадратного кропа при смене картинки/масштаба.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, AVATAR_OUT, AVATAR_OUT);
    const cover = Math.max(AVATAR_OUT / img.width, AVATAR_OUT / img.height);
    const s = cover * scale;
    const w = img.width * s;
    const h = img.height * s;
    ctx.drawImage(img, (AVATAR_OUT - w) / 2, (AVATAR_OUT - h) / 2, w, h);
  }, [img, scale]);

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (!f.type.startsWith('image/')) {
      setError('Только изображения');
      return;
    }
    setError(null);
    const url = URL.createObjectURL(f);
    const image = new Image();
    image.onload = () => {
      setImg(image);
      setScale(1);
      URL.revokeObjectURL(url);
    };
    image.onerror = () => {
      setError('Не удалось прочитать файл');
      URL.revokeObjectURL(url);
    };
    image.src = url;
  };

  const save = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !img) return;
    setError(null);
    setStatus('saving');
    const blob = await new Promise<Blob | null>((res) =>
      canvas.toBlob((b) => res(b), 'image/webp', 0.85),
    );
    if (!blob) {
      setError('Не удалось обработать изображение');
      setStatus('idle');
      return;
    }
    if (blob.size > 500 * 1024) {
      setError('Слишком большой файл — уменьшите масштаб');
      setStatus('idle');
      return;
    }
    const r = await uploadAvatar(blob);
    if (!r.ok) {
      setError(r.error ?? 'Не удалось загрузить');
      setStatus('idle');
      return;
    }
    setStatus('done');
    router.refresh();
    timer.current = setTimeout(onBack, 1000);
  };

  return (
    <div className="flex flex-col">
      <BackBtn onClick={onBack} />
      <div className="flex flex-col items-center gap-5">
        <SubTitle>Сменить аватар</SubTitle>

        {/* Превью: canvas-кроп нового файла ИЛИ текущий аватар/плейсхолдер */}
        {img ? (
          <canvas
            ref={canvasRef}
            width={AVATAR_OUT}
            height={AVATAR_OUT}
            className="h-48 w-48 rounded border border-lines-hover bg-(--color-base) object-cover"
          />
        ) : me.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={me.avatarUrl}
            alt="Текущий аватар"
            className="h-48 w-48 rounded border border-lines-hover object-cover"
          />
        ) : (
          <div className="h-48 w-48 rounded border border-lines-hover bg-(--color-base)" />
        )}

        {img && (
          <div className="flex w-full max-w-xs flex-col gap-1.5">
            <input
              type="range"
              min={1}
              max={3}
              step={0.01}
              value={scale}
              onChange={(e) => setScale(Number(e.target.value))}
              className="h-px w-full cursor-pointer appearance-none bg-lines-hover [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-(--primary)"
            />
            <span className="text-center font-blender-book text-type-caption text-text-muted">
              Масштабирование аватара
            </span>
          </div>
        )}

        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
        <label
          onClick={() => fileRef.current?.click()}
          className="flex w-full max-w-md cursor-pointer flex-col items-center gap-2 rounded border border-dashed border-lines-hover px-6 py-8 text-center transition-colors hover:border-(--primary)/50"
        >
          <p className="font-blender-medium text-xs uppercase tracking-widest text-text-secondary">
            {img ? 'Выбрать другое изображение...' : 'Выберите изображение...'}
          </p>
          <p className="font-blender-book text-xs text-text-muted">
            будет сохранено как квадрат{' '}
            <strong className="text-text-secondary">{AVATAR_OUT}×{AVATAR_OUT}px</strong> webp,
            не более <strong className="text-text-secondary">500 Кб</strong>.
          </p>
        </label>

        <button
          type="button"
          onClick={save}
          disabled={!img || status === 'saving' || status === 'done'}
          className="rounded border border-(--primary) bg-(--primary)/10 px-8 py-2.5 font-blender-medium text-type-caption uppercase tracking-widest text-(--primary) transition-all hover:bg-(--primary)/20 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {status === 'saving' ? 'Сохраняю…' : status === 'done' ? 'Готово' : 'Сохранить'}
        </button>
        <Feedback error={error} success={status === 'done' ? 'Аватар обновлён' : null} />
      </div>
    </div>
  );
}

function UsernameView({ onBack, me }: { onBack: () => void; me: Me }) {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [value, setValue] = useState('');
  const [status, setStatus] = useState<'idle' | 'saving' | 'done'>('idle');
  const [error, setError] = useState<string | null>(null);
  // Снимок «сейчас» на маунте — чистый рендер (Date.now в теле нарушает react-hooks/purity).
  const [now] = useState(() => Date.now());

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  // Кулдаун — зеркалит серверный (60 дней от usernameChangedAt). 0 = можно менять.
  const daysLeft = useMemo(() => {
    if (!me.usernameChangedAt) return 0;
    const elapsed = now - new Date(me.usernameChangedAt).getTime();
    const left = USERNAME_COOLDOWN_DAYS * DAY_MS - elapsed;
    return left > 0 ? Math.ceil(left / DAY_MS) : 0;
  }, [me.usernameChangedAt, now]);

  const valid = USERNAME_RE.test(value.trim());

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setStatus('saving');
    const r = await changeUsername(value.trim());
    if (!r.ok) {
      setError(r.error ?? 'Не удалось сменить логин');
      setStatus('idle');
      return;
    }
    setStatus('done');
    router.refresh();
    timer.current = setTimeout(onBack, 1000);
  };

  return (
    <form onSubmit={submit} className="flex flex-col">
      <BackBtn onClick={onBack} />
      <div className="flex flex-col items-center gap-5">
        <div className="flex flex-col items-center gap-2 text-center">
          <SubTitle>Сменить имя пользователя</SubTitle>
          <p className="font-blender-book text-xs leading-relaxed text-text-muted max-w-xs">
            Поле должно содержать от 3 до 15 символов. Можно использовать латинские буквы, цифры, символ нижнего подчёркивания и дефис.
          </p>
        </div>
        <div className="flex w-full max-w-md flex-col gap-3">
          <FormInput
            placeholder="Введите имя пользователя"
            value={value}
            onChange={setValue}
            disabled={daysLeft > 0 || status === 'done'}
            maxLength={15}
          />
          <CooldownWarning>
            {daysLeft > 0
              ? `Логин менялся недавно — следующая смена через ~${daysLeft} дн.`
              : 'Вы можете изменить логин один раз в 2 месяца.'}
          </CooldownWarning>
          <Feedback error={error} success={status === 'done' ? 'Логин обновлён' : null} />
        </div>
        <FormActions
          onCancel={onBack}
          submitting={status === 'saving'}
          disabled={!valid || daysLeft > 0 || status === 'done'}
          label="Сохранить"
        />
      </div>
    </form>
  );
}

function EmailView({ onBack, me }: { onBack: () => void; me: Me }) {
  const [value, setValue] = useState('');
  const [status, setStatus] = useState<'idle' | 'saving' | 'sent'>('idle');
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setStatus('saving');
    const r = await changeEmail(value.trim());
    if (!r.ok) {
      setError(r.error ?? 'Не удалось сменить e-mail');
      setStatus('idle');
      return;
    }
    setStatus('sent');
  };

  return (
    <form onSubmit={submit} className="flex flex-col">
      <BackBtn onClick={onBack} />
      <div className="flex flex-col items-center gap-5">
        <SubTitle>Сменить E-MAIL</SubTitle>
        <div className="flex w-full max-w-md flex-col gap-3">
          <p className="text-center font-blender-book text-xs text-text-muted">
            Текущий: <span className="text-text-secondary">{me.email ?? '—'}</span>
          </p>
          <FormInput
            placeholder="Введите новый E-mail"
            type="email"
            value={value}
            onChange={setValue}
            disabled={status === 'sent'}
            autoComplete="email"
          />
          <Feedback
            error={error}
            success={
              status === 'sent'
                ? `Письмо для подтверждения отправлено на ${value}. Перейдите по ссылке, чтобы завершить смену.`
                : null
            }
          />
        </div>
        {status !== 'sent' && (
          <FormActions
            onCancel={onBack}
            submitting={status === 'saving'}
            disabled={!EMAIL_RE.test(value.trim())}
            label="Отправить"
          />
        )}
      </div>
    </form>
  );
}

function SubscriptionView({ onBack, me }: { onBack: () => void; me: Me }) {
  const router = useRouter();
  const KEYS = ['account', 'offers', 'news'] as const;
  type NotifyKey = (typeof KEYS)[number];
  const [checks, setChecks] = useState<Record<NotifyKey, boolean>>({
    account: me.notifications.account,
    offers: me.notifications.offers,
    news: me.notifications.news,
  });
  const [status, setStatus] = useState<'idle' | 'saving' | 'done'>('idle');
  const [error, setError] = useState<string | null>(null);
  const toggle = (k: NotifyKey) => setChecks((prev) => ({ ...prev, [k]: !prev[k] }));

  const labels: Record<NotifyKey, string> = {
    account:
      'Отправлять сообщения об изменениях в моей учётной записи. Получать уведомления в случае несанкционированного входа в вашу учётную запись, изменения пароля или настроек безопасности.',
    offers:
      'Получать по электронной почте новостные дайджесты и специальные предложения, касающиеся продуктов и услуг ЦТА Limited.',
    news: 'Получать новости и специальные предложения, связанные с платформой ЦТА.',
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setStatus('saving');
    // Шлём только изменённые флаги — без частичного сохранения на бэке.
    const changed: Partial<Record<NotifyKey, boolean>> = {};
    for (const k of KEYS) {
      if (checks[k] !== me.notifications[k]) changed[k] = checks[k];
    }
    if (Object.keys(changed).length === 0) {
      setStatus('done');
      setTimeout(onBack, 800);
      return;
    }
    const r = await saveNotifications(changed);
    if (!r.ok) {
      setError(r.error ?? 'Не удалось сохранить');
      setStatus('idle');
      return;
    }
    setStatus('done');
    router.refresh();
    setTimeout(onBack, 1000);
  };

  return (
    <form onSubmit={submit} className="flex flex-col">
      <BackBtn onClick={onBack} />
      <div className="flex flex-col items-center gap-5">
        <SubTitle>Параметры подписки</SubTitle>
        <div className="flex w-full max-w-md flex-col gap-4">
          <div className="flex items-center justify-between rounded border border-lines-hover bg-card-menu px-4 py-3">
            <span className="font-blender-book text-sm text-text-secondary">Русский / Russian</span>
            <ChevronDown className="h-4 w-4 text-text-muted" />
          </div>
          {KEYS.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => toggle(k)}
              disabled={status === 'done'}
              className="flex items-start gap-3 text-left disabled:opacity-60"
            >
              <div
                className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-xs border transition-colors ${
                  checks[k]
                    ? 'border-(--primary) bg-(--primary)/20'
                    : 'border-lines-hover bg-(--color-base)'
                }`}
              >
                {checks[k] && <Check className="h-2.5 w-2.5 text-(--primary)" />}
              </div>
              <span className="font-blender-book text-xs leading-relaxed text-text-secondary">
                {labels[k]}
              </span>
            </button>
          ))}
          <Feedback error={error} success={status === 'done' ? 'Сохранено' : null} />
        </div>
        <FormActions
          onCancel={onBack}
          submitting={status === 'saving'}
          disabled={status === 'done'}
          label="Сохранить"
        />
      </div>
    </form>
  );
}

function PasswordView({ onBack }: { onBack: () => void }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [status, setStatus] = useState<'idle' | 'saving' | 'done'>('idle');
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const pwError = validatePassword(password);
    if (pwError) {
      setError(pwError);
      return;
    }
    if (password !== confirm) {
      setError('Пароли не совпадают');
      return;
    }
    setStatus('saving');
    // Ставим пароль напрямую — юзер уже в активной сессии, письмо не нужно.
    const { error: upErr } = await createClient().auth.updateUser({ password });
    if (upErr) {
      setStatus('idle');
      setError(
        /reauthentication|recent/i.test(upErr.message)
          ? 'Требуется свежий вход. Перелогиньтесь и повторите.'
          : 'Не удалось сменить пароль. Попробуйте позже.',
      );
      return;
    }
    setStatus('done');
  };

  return (
    <form onSubmit={submit} className="flex flex-col">
      <BackBtn onClick={onBack} />
      <div className="flex flex-col items-center gap-5">
        <div className="flex flex-col items-center gap-2 text-center">
          <SubTitle>Сменить пароль</SubTitle>
          <p className="font-blender-book text-xs leading-relaxed text-text-muted max-w-xs">
            Задайте пароль для входа на сайт по e-mail и паролю. {PASSWORD_HINT}
          </p>
        </div>
        <div className="flex w-full max-w-md flex-col gap-3">
          <FormInput
            placeholder="Новый пароль"
            type="password"
            value={password}
            onChange={setPassword}
            disabled={status === 'done'}
            autoComplete="new-password"
          />
          <FormInput
            placeholder="Повторите пароль"
            type="password"
            value={confirm}
            onChange={setConfirm}
            disabled={status === 'done'}
            autoComplete="new-password"
          />
          <Feedback error={error} success={status === 'done' ? 'Пароль сохранён' : null} />
        </div>
        {status !== 'done' && (
          <FormActions
            onCancel={onBack}
            submitting={status === 'saving'}
            disabled={!isPasswordValid(password) || password !== confirm}
            label="Сохранить"
          />
        )}
      </div>
    </form>
  );
}

// Реальная 2FA через TOTP (Supabase Auth MFA). Приложение-аутентификатор
// (Google Authenticator / Aegis / 1Password): enroll → QR+секрет → код → verify.
// Для админов вход требует второй фактор (серверный гард getAdmin/getCmsUser, AAL2).
type TotpState = 'loading' | 'off' | 'enrolling' | 'on';

function TwoFAView({ onBack }: { onBack: () => void }) {
  const supabase = useMemo(() => createClient(), []);
  const [state, setState] = useState<TotpState>('loading');
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Определяем, есть ли уже подтверждённый TOTP-фактор.
  const refresh = useCallback(async () => {
    const { data, error: e } = await supabase.auth.mfa.listFactors();
    if (e) { setError('Не удалось загрузить статус 2FA'); setState('off'); return; }
    const verified = (data?.totp ?? []).find((f) => f.status === 'verified');
    if (verified) { setFactorId(verified.id); setState('on'); }
    else { setState('off'); }
  }, [supabase]);

  useEffect(() => { void refresh(); }, [refresh]);

  // Старт привязки: чистим недоподтверждённые факторы, затем enroll → QR.
  const startEnroll = async () => {
    setBusy(true); setError(null);
    try {
      const { data: list } = await supabase.auth.mfa.listFactors();
      for (const f of list?.all ?? []) {
        if (f.status !== 'verified') await supabase.auth.mfa.unenroll({ factorId: f.id });
      }
      const { data, error: e } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: 'CTA Authenticator',
      });
      if (e || !data) { setError('Не удалось начать привязку. Повторите позже.'); return; }
      setFactorId(data.id);
      setQr(data.totp.qr_code);
      setSecret(data.totp.secret);
      setState('enrolling');
      setCode('');
    } finally { setBusy(false); }
  };

  // Подтверждение кода из приложения → фактор verified, сессия поднимается до AAL2.
  const confirmEnroll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!factorId) return;
    setBusy(true); setError(null);
    const { error: verr } = await supabase.auth.mfa.challengeAndVerify({
      factorId,
      code: code.trim(),
    });
    setBusy(false);
    if (verr) { setError('Неверный код. Проверьте время на устройстве и повторите.'); return; }
    await refresh();
  };

  // Отключение 2FA.
  const disable = async () => {
    if (!factorId) return;
    setBusy(true); setError(null);
    const { error: e } = await supabase.auth.mfa.unenroll({ factorId });
    setBusy(false);
    if (e) { setError('Не удалось отключить. Возможно, нужен свежий вход.'); return; }
    setFactorId(null); setQr(null); setSecret(null); setState('off');
  };

  return (
    <div className="flex flex-col">
      <BackBtn onClick={onBack} />
      <div className="flex flex-col items-center gap-5">
        <SubTitle>Двухфакторная аутентификация</SubTitle>

        <div className="flex w-full max-w-md flex-col gap-4">
          {state === 'loading' && (
            <div className="h-24 animate-pulse rounded border border-lines-hover bg-card-menu" />
          )}

          {state === 'off' && (
            <>
              <p className="font-blender-book text-xs leading-relaxed text-text-muted text-center">
                Приложение-аутентификатор (Google Authenticator, Aegis, 1Password) добавит
                второй шаг ко входу — украденного пароля станет недостаточно.
                Для администраторов второй фактор обязателен.
              </p>
              <Feedback error={error} success={null} />
              <button
                type="button"
                onClick={startEnroll}
                disabled={busy}
                className="mx-auto w-full max-w-45 rounded border border-(--primary) bg-(--primary)/10 px-6 py-2.5 font-blender-medium text-type-caption uppercase tracking-widest text-(--primary) transition-all hover:bg-(--primary)/20 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {busy ? 'Готовлю…' : 'Включить 2FA'}
              </button>
            </>
          )}

          {state === 'enrolling' && (
            <form onSubmit={confirmEnroll} className="flex flex-col items-center gap-4">
              <p className="font-blender-book text-xs leading-relaxed text-text-muted text-center">
                Отсканируйте QR-код приложением-аутентификатором, затем введите
                6-значный код из приложения.
              </p>
              {qr && (
                <img src={qr} alt="QR для 2FA" className="h-44 w-44 rounded bg-white p-2" />
              )}
              {secret && (
                <p className="font-blender-book text-type-caption text-text-muted text-center break-all">
                  Или введите ключ вручную:{' '}
                  <span className="font-blender-medium text-text-secondary">{secret}</span>
                </p>
              )}
              <FormInput
                placeholder="6-значный код"
                value={code}
                onChange={setCode}
                autoComplete="one-time-code"
                inputMode="numeric"
              />
              <Feedback error={error} success={null} />
              <FormActions
                onCancel={onBack}
                submitting={busy}
                disabled={busy || code.trim().length < 6}
                label="Подтвердить"
              />
            </form>
          )}

          {state === 'on' && (
            <>
              <div className="flex items-center justify-between rounded border border-(--primary) bg-(--primary)/5 px-4 py-3">
                <span className="font-blender-medium text-sm text-(--primary)">
                  Приложение-аутентификатор
                </span>
                <span className="font-blender-medium text-type-caption uppercase tracking-widest text-(--primary)">
                  Включено
                </span>
              </div>
              <Feedback error={error} success={null} />
              <button
                type="button"
                onClick={disable}
                disabled={busy}
                className="rounded-xs border border-danger/40 px-3 py-2 font-blender-medium text-xs uppercase tracking-widest text-danger transition-colors hover:bg-danger/10 disabled:opacity-50"
              >
                {busy ? 'Отключаю…' : 'Отключить 2FA'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Экран смены тарифа. Состав карточек считается из матрицы гейтов (lib/gating/showcase),
 * поэтому совпадает с тем, что реально закрывает пейвол, и меняется из админки без деплоя.
 * Кнопка оплаты неактивна: платёжный адаптер — отдельная задача, а рисовать экран заранее
 * дешевле, чем верстать его в момент интеграции.
 */
function PlanView({
  onBack,
  showcase,
  currentTier,
  currentRank,
  pricingPublished,
  validUntil,
}: {
  onBack: () => void;
  showcase: ShowcaseTier[];
  currentTier: TierId;
  currentRank: number;
  pricingPublished: boolean;
  validUntil: string | null;
}) {
  return (
    <div className="flex flex-col">
      <BackBtn onClick={onBack} />
      <div className="flex flex-col gap-1 pb-5">
        <SubTitle>Уровень допуска</SubTitle>
        <p className="text-center font-blender-book text-xs leading-relaxed text-text-muted">
          Ядро портала остаётся бесплатным. Подписка открывает удобства.
        </p>
      </div>

      {showcase.length === 0 ? (
        <p className="font-blender-book text-xs text-text-muted">Тарифы пока не настроены.</p>
      ) : (
        <div className="flex flex-col gap-8">
          {/* Те же плитки, что на /pricing — компонент один на оба места. */}
          <div className="grid gap-4 lg:grid-cols-2">
            {showcase.map((t) => (
              <TierCard
                key={t.slug}
                tier={t}
                pricingPublished={pricingPublished}
                isCurrent={t.slug === currentTier}
                validUntil={t.slug === currentTier ? validUntil : null}
                action={
                  t.rank > 0 && t.slug !== currentTier ? <TierCtaPending tierName={t.name} /> : undefined
                }
              />
            ))}
          </div>
          <AccessMatrix showcase={showcase} currentRank={currentRank} />
        </div>
      )}
    </div>
  );
}

// ─── Tab panels ───────────────────────────────────────────────────────────────

// Сброс прогресса по игре. 2-кликовый confirm (необратимо): клик → «Точно?» → сброс.
// Чистит БД (route) + localStorage-сторы прогресса + reload — иначе localStorage вернёт прогресс.
// Ключи — общий модуль progress-storage (тот же список у заглавного сброса в «Трекинге»).

function GameResetCard({ game }: { game: (typeof GAMES)[number] }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const onReset = async () => {
    if (busy) return;
    if (!confirming) {
      setConfirming(true);
      timer.current = setTimeout(() => setConfirming(false), 4000);
      return;
    }
    setBusy(true);
    const r = await resetCtaProgress();
    if (r.ok) {
      PROGRESS_KEYS.forEach((k) => localStorage.removeItem(k));
      window.location.reload();
      return;
    }
    setBusy(false);
    setConfirming(false);
  };

  return (
    <div className="flex w-52 flex-col gap-3 rounded border border-lines-hover bg-(--color-base) p-4">
      <div className="flex h-10 items-center justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={game.logo}
          alt={game.title}
          className="max-h-full w-auto object-contain opacity-70"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
            const next = e.currentTarget.nextElementSibling as HTMLElement | null;
            if (next) next.style.removeProperty('display');
          }}
        />
        <span className="hidden font-blender-medium text-xs uppercase tracking-widest text-text-muted">
          {game.title}
        </span>
      </div>
      <RowBtn
        label={busy ? 'Сброс…' : confirming ? 'Точно сбросить?' : 'Сброс прогресса'}
        variant="danger"
        onClick={onReset}
      />
      <p className="font-blender-book text-type-caption leading-relaxed text-text-muted opacity-70">
        Внимание! После сброса данные нельзя восстановить. Прогресс ЧВК: задания, бартер, настройки в игре.
      </p>
    </div>
  );
}

function ProfilePanel({ onNavigate, me, stats, tier }: { onNavigate: (v: ViewId) => void; me: Me; stats: AccountStats; tier: TierId }) {
  const isPro = tier !== 'free';
  const tierName = tierMeta(tier).name;

  return (
    <div className="flex flex-col gap-4">

      {/* Main rows */}
      <div className="rounded border border-lines-hover bg-card-menu px-6">
        <FlatRow
          label="Аватар профиля"
          action={<RowBtn onClick={() => onNavigate('avatar')} />}
        >
          {me.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={me.avatarUrl}
              alt="Аватар"
              className="h-10 w-10 rounded border border-lines-hover object-cover"
            />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded border border-lines-hover bg-(--color-base)">
              <div className="h-5 w-5 icon-mask icon-account_profile_icon bg-lines-hover" />
            </div>
          )}
        </FlatRow>

        <FlatRow
          label="Имя пользователя"
          action={<RowBtn onClick={() => onNavigate('username')} />}
        >
          <span className="font-blender-book text-type-caption text-text-muted">Текущий логин:</span>
          <span className="font-blender-medium text-sm text-text-secondary">
            {me.username ?? '(не задан)'}
          </span>
        </FlatRow>

        <FlatRow
          label="Email"
          action={<RowBtn onClick={() => onNavigate('email')} />}
        >
          <span className="font-blender-book text-type-caption text-text-muted">Текущий E-mail:</span>
          <span className="font-blender-book text-sm text-text-secondary">
            {me.email ?? '—'}
          </span>
        </FlatRow>

        <FlatRow
          label="Ваш статус"
          action={<RowBtn onClick={() => onNavigate('plan')} />}
        >
          {isPro ? (
            <>
              <div className="flex h-5 items-center gap-1 rounded border border-tactical-amber/30 bg-tactical-amber/10 px-1.5">
                <div className="h-3 w-3 icon-mask icon-account_prostatus_icon bg-tactical-amber" />
                <span className="font-blender-medium text-type-caption tracking-wider text-tactical-amber">PRO</span>
              </div>
              <span className="font-blender-book text-sm text-tactical-amber">
                {tierName} — полный доступ ко всем функциям
              </span>
            </>
          ) : (
            <span className="font-blender-book text-sm text-text-muted">{tierName} — стандартный доступ</span>
          )}
        </FlatRow>

        <FlatRow label="Участник с">
          <span className="font-blender-medium text-sm text-text-secondary">
            {me.createdAt ? new Date(me.createdAt).toLocaleDateString('ru-RU') : '—'}
          </span>
        </FlatRow>

        <FlatRow label="Статистика">
          <span className="font-blender-book text-type-caption text-text-muted">Квестов:</span>
          <span className="font-blender-medium text-sm text-text-secondary">{stats.questsCompleted}</span>
          <span className="font-blender-book text-type-caption text-text-muted">· Бартеров:</span>
          <span className="font-blender-medium text-sm text-text-secondary">{stats.bartersConfirmed}</span>
          <span className="font-blender-book text-type-caption text-text-muted">· Достижений:</span>
          <span className="font-blender-medium text-sm text-text-secondary">{stats.achievementsCompleted}</span>
        </FlatRow>
      </div>

      {/* ЧВК Reset */}
      <div className="rounded border border-lines-hover bg-card-menu p-6">
        <h2 className="mb-1 font-blender-medium text-sm uppercase tracking-widest text-text-primary">
          Сброс прогресса ЧВК
        </h2>
        <p className="mb-5 font-blender-book text-xs leading-relaxed text-text-secondary">
          С помощью данной функции вы можете сбросить{' '}
          <strong className="text-text-primary">ВЕСЬ</strong> прогресс вашего профиля ЧВК
          в различных играх на нашем сайте. Пожалуйста, выберите игру и нажмите рядом с ней кнопку сброса.
        </p>
        <div className="flex flex-wrap gap-4">
          {GAMES.map((game) => (
            <GameResetCard key={game.id} game={game} />
          ))}
        </div>
      </div>

      {/* Subscription */}
      <div className="rounded border border-lines-hover bg-card-menu px-6">
        <FlatRow
          label="Параметры подписки"
          action={<RowBtn onClick={() => onNavigate('subscription')} />}
        >
          <span className="font-blender-book text-sm text-text-secondary">
            Управляйте рассылками: новости, предложения и уведомления
          </span>
        </FlatRow>
      </div>

    </div>
  );
}

function SecurityPanel({ onNavigate }: { onNavigate: (v: ViewId) => void }) {
  return (
    <div className="rounded border border-lines-hover bg-card-menu px-6">
      <FlatRow
        label="Пароль"
        action={<RowBtn onClick={() => onNavigate('password')} />}
      >
        <span className="font-blender-book text-type-caption text-text-muted">Последнее изменение:</span>
        <span className="font-blender-medium text-xs text-text-muted">—</span>
      </FlatRow>

      <FlatRow
        label="Двухфакторная аутентификация"
        action={<RowBtn onClick={() => onNavigate('2fa')} />}
      >
        <span className="font-blender-medium text-xs text-text-muted">Не настроено</span>
      </FlatRow>
    </div>
  );
}

function LinkingPanel({ me, onNavigate }: { me: Me; onNavigate: (v: ViewId) => void }) {
  return (
    <div className="flex flex-col gap-4">
      {/* Реальные OAuth-входы (Discord/Twitch) — привязка/отвязка. */}
      <OAuthLogins />

      <div className="rounded border border-lines-hover bg-card-menu px-6 py-5">
        <h2 className="font-blender-medium text-sm uppercase tracking-widest text-text-primary">
          Публичные хендлы
        </h2>
        <p className="mt-1 font-blender-book text-xs text-text-secondary">
          Ники соцсетей для профиля и Комлинка. Это витрина, не способ входа.
        </p>
      </div>

      <div className="rounded border border-lines-hover bg-card-menu px-6">
        {PLATFORMS.map((platform) => {
          const handle = me.socials[platform.id];
          const linked = !!handle;
          const Icon = PLATFORM_ICON[platform.id];
          return (
            <div
              key={platform.id}
              className="flex items-center gap-4 border-b border-lines-hover py-5 last:border-b-0"
            >
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded border border-lines-hover"
                style={{ backgroundColor: `${platform.color}1a`, color: platform.color }}
              >
                <Icon size={18} />
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="font-blender-medium text-type-caption uppercase tracking-widest text-text-muted">
                  {platform.name}
                </span>
                <span className="font-blender-book text-sm text-text-secondary">
                  {linked ? (
                    <>
                      Аккаунт привязан:{' '}
                      <span className="text-(--primary)">{handle}</span>
                    </>
                  ) : (
                    'Аккаунт не привязан'
                  )}
                </span>
              </div>
              <RowBtn
                label={linked ? 'Изменить' : 'Привязать'}
                variant="default"
                onClick={() => onNavigate('social')}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Как подписался пользователь — человекочитаемо. */
const SOURCE_LABEL: Record<string, string> = {
  manual: 'Выдана администратором',
  yookassa: 'ЮKassa',
  boosty: 'Boosty',
};

/** Типы записей леджера. Ручная выдача — БЕЗ суммы: иначе юзер видит «платёж 0 ₽». */
const BILLING_TYPE_LABEL: Record<string, string> = {
  grant: 'Выдано администратором',
  payment: 'Оплата',
  renewal: 'Продление',
  refund: 'Возврат',
  downgrade: 'Понижение тарифа',
};

function BillingPanel({
  onNavigate,
  tier,
  validUntil,
  source,
  history,
  showcase,
  pricingPublished,
}: {
  onNavigate: (v: ViewId) => void;
  tier: TierId;
  validUntil: string | null;
  source: string | null;
  history: BillingHistoryEntry[];
  showcase: ShowcaseTier[];
  pricingPublished: boolean;
}) {
  // Имя тира берём из витрины (живые данные БД), иначе — из дефолтного каталога.
  // Архивный тир в витрину не попадает, но у пользователя остаться может — тогда tierMeta.
  const nameOfTier = (slug: string) =>
    showcase.find((t) => t.slug === slug)?.name ?? tierMeta(slug).name;
  const tierName = nameOfTier(tier);
  const price = showcase.find((t) => t.slug === tier)?.price ?? 0;
  const until = validUntil ? new Date(validUntil).toLocaleDateString('ru-RU') : null;
  const isPaid = tier !== 'free';

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded border border-lines-hover bg-card-menu px-6">
        <FlatRow label="Выбранный тариф" action={<RowBtn onClick={() => onNavigate('plan')} />}>
          <span className="font-blender-medium text-xs text-text-primary">{tierName}</span>
          {isPaid && pricingPublished && price > 0 ? (
            <span className="font-blender-medium text-xs text-text-muted">{price} ₽/мес</span>
          ) : null}
        </FlatRow>

        <FlatRow label="Срок действия">
          <span className="font-blender-medium text-xs text-text-muted">
            {!isPaid ? 'Бессрочно' : until ? `Активен до ${until}` : 'Бессрочно'}
          </span>
        </FlatRow>

        {isPaid ? (
          <FlatRow label="Способ подключения">
            <span className="font-blender-medium text-xs text-text-muted">
              {source ? (SOURCE_LABEL[source] ?? source) : '—'}
            </span>
          </FlatRow>
        ) : null}
      </div>

      {/* История начислений — свои строки леджера (RLS). Пусто ≠ ошибка. */}
      <div className="rounded border border-lines-hover bg-card-menu px-6 py-5">
        <h2 className="font-blender-medium text-sm uppercase tracking-widest text-text-primary">
          История платежей
        </h2>
        {history.length === 0 ? (
          <p className="mt-2 font-blender-book text-xs text-text-muted">
            Операций пока не было.
          </p>
        ) : (
          <div className="mt-4 flex flex-col">
            {history.map((h) => {
              // Ручную выдачу суммой не подписываем — денег не было.
              const showAmount = h.type !== 'grant' && h.amount !== null && h.amount > 0;
              return (
                <div
                  key={h.id}
                  className="flex items-center justify-between gap-4 border-b border-lines-hover py-3 last:border-b-0"
                >
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="font-blender-medium text-xs text-text-secondary">
                      {BILLING_TYPE_LABEL[h.type] ?? h.type}
                      {/* Тот же фолбэк, что у заголовка: архивный тир выпал из витрины,
                          но показывать сырой слаг «veteran» вместо «Ветеран» нельзя. */}
                      {h.tier ? ` — ${nameOfTier(h.tier)}` : ''}
                    </span>
                    <span className="font-blender-book text-type-micro text-text-muted">
                      {new Date(h.createdAt).toLocaleDateString('ru-RU')}
                    </span>
                  </div>
                  <span className="shrink-0 font-blender-medium text-xs text-text-muted">
                    {showAmount ? `${h.amount} ${h.currency ?? 'RUB'}` : '—'}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function ProStatusPanel({
  tier,
  validUntil,
  onNavigate,
  showcase,
}: {
  tier: TierId;
  validUntil: string | null;
  onNavigate: (v: ViewId) => void;
  showcase: ShowcaseTier[];
}) {
  const isPro = tier !== 'free';
  // Имя — из живой витрины; tierMeta остаётся запасным для архивных тиров, которых в
  // витрине нет, но у пользователя остаться могут.
  const tierName = showcase.find((t) => t.slug === tier)?.name ?? tierMeta(tier).name;
  const until = validUntil ? new Date(validUntil).toLocaleDateString('ru-RU') : null;

  // Что даёт подписка — берём из витрины, а не из текста в разметке: иначе список
  // разъедется с матрицей гейтов при первой же правке порога в админке.
  const firstPaid = showcase.find((t) => t.rank > 0);
  const sample = firstPaid?.features.slice(0, 3).map((f) => f.label.toLowerCase()) ?? [];

  if (!isPro) {
    return (
      <div className="rounded border border-lines-hover bg-card-menu p-6">
        <div className="flex flex-col items-center gap-4 py-10 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded border border-lines-hover bg-(--color-base)">
            <div className="h-8 w-8 icon-mask icon-account_prostatus_icon bg-text-muted" />
          </div>
          <span className="font-blender-medium text-2xl uppercase tracking-widest text-text-secondary">
            {tierName}
          </span>
          <p className="max-w-xs font-blender-book text-sm leading-relaxed text-text-muted">
            {sample.length > 0 && firstPaid
              ? `У вас стандартный доступ. Подписка «${firstPaid.name}» открывает ${sample.join(', ')} и другие удобства.`
              : 'У вас стандартный доступ. Ядро портала бесплатно; подписка открывает дополнительные удобства.'}
          </p>
          <button
            onClick={() => onNavigate('plan')}
            className="rounded border border-(--primary) bg-(--primary)/10 px-8 py-2.5 font-blender-medium text-type-caption uppercase tracking-widest text-(--primary) transition-all hover:bg-(--primary)/20"
          >
            Оформить подписку
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded border border-lines-hover bg-card-menu p-6">
      <div className="flex flex-col items-center gap-4 py-10 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded border border-tactical-amber/30 bg-tactical-amber/5">
          <div className="h-8 w-8 icon-mask icon-account_prostatus_icon bg-tactical-amber" />
        </div>
        <div className="flex items-center gap-2">
          <span className="font-blender-medium text-2xl uppercase tracking-widest text-tactical-amber">
            {tierName}
          </span>
          <div className="flex h-5 items-center rounded border border-tactical-amber/40 bg-tactical-amber/10 px-2">
            <span className="font-blender-medium text-type-caption tracking-widest text-tactical-amber">
              Активен
            </span>
          </div>
        </div>
        {until && (
          <span className="font-blender-medium text-xs text-text-muted">Активен до {until}</span>
        )}
        <p className="max-w-xs font-blender-book text-sm leading-relaxed text-text-secondary">
          PRO-статус «{tierName}» даёт полный доступ ко всем функциям платформы ЦТА.
        </p>
        <button
          onClick={() => onNavigate('plan')}
          className="rounded border border-lines-hover bg-(--color-base) px-8 py-2.5 font-blender-medium text-type-caption uppercase tracking-widest text-text-secondary transition-all hover:border-(--primary) hover:text-(--primary)"
        >
          Управление подпиской
        </button>
      </div>
    </div>
  );
}

// Связанные аккаунты: ручные хендлы соцсетей. Пустое поле = отвязать.
function SocialView({ onBack, me }: { onBack: () => void; me: Me }) {
  const router = useRouter();
  const PLATS: SocialPlatform[] = ['twitch', 'youtube', 'discord', 'steam'];
  const [handles, setHandles] = useState<Record<SocialPlatform, string>>({
    twitch: me.socials.twitch ?? '',
    youtube: me.socials.youtube ?? '',
    discord: me.socials.discord ?? '',
    steam: me.socials.steam ?? '',
  });
  const [status, setStatus] = useState<'idle' | 'saving' | 'done'>('idle');
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setStatus('saving');
    // Собираем только изменённые площадки и шлём одним атомарным запросом — без частичного сохранения.
    const changed: Partial<Record<SocialPlatform, string>> = {};
    for (const p of PLATS) {
      const next = handles[p].trim();
      if (next !== (me.socials[p] ?? '')) changed[p] = next;
    }
    if (Object.keys(changed).length === 0) {
      setStatus('done');
      setTimeout(onBack, 800);
      return;
    }
    const r = await saveSocials(changed);
    if (!r.ok) {
      setError(r.error ?? 'Не удалось сохранить');
      setStatus('idle');
      return;
    }
    setStatus('done');
    router.refresh();
    setTimeout(onBack, 1000);
  };

  return (
    <form onSubmit={submit} className="flex flex-col">
      <BackBtn onClick={onBack} />
      <div className="flex flex-col items-center gap-5">
        <div className="flex flex-col items-center gap-2 text-center">
          <SubTitle>Связанные аккаунты</SubTitle>
          <p className="font-blender-book text-xs leading-relaxed text-text-muted max-w-xs">
            Введите ваши хендлы. Пустое поле отвяжет аккаунт.
          </p>
        </div>
        <div className="flex w-full max-w-md flex-col gap-3">
          {PLATS.map((p) => (
            <FormInput
              key={p}
              placeholder={`${p} — ваш хендл`}
              value={handles[p]}
              onChange={(v) => setHandles((h) => ({ ...h, [p]: v }))}
              disabled={status === 'done'}
              maxLength={32}
            />
          ))}
          <Feedback error={error} success={status === 'done' ? 'Сохранено' : null} />
        </div>
        <FormActions
          onCancel={onBack}
          submitting={status === 'saving'}
          disabled={status === 'done'}
          label="Сохранить"
        />
      </div>
    </form>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function AccountCenter({
  me,
  stats,
  achievements,
  hints,
  questsDigest,
  hideoutNeeds,
  hideoutStations,
  tier,
  validUntil,
  subSource,
  billingHistory,
  showcase,
  pricingPublished,
  currentRank,
  effectiveTier,
}: {
  me: Me;
  tier: TierId;
  validUntil: string | null;
  subSource: string | null;
  billingHistory: BillingHistoryEntry[];
  showcase: ShowcaseTier[];
  pricingPublished: boolean;
  /** Эффективный ранг пользователя — по нему матрица решает, что открыто. */
  currentRank: number;
  /**
   * Эффективный тир. От `tier` отличается только под админским превью: `tier` — запись
   * биллинга (её показывают «Платежи» и PRO-статус), а экран выбора и матрица должны
   * говорить о ФАКТИЧЕСКОМ доступе, иначе плитка «Активен» спорит с замками в матрице.
   */
  effectiveTier: TierId;
  stats: AccountStats;
  achievements: AchievementView[];
  hints: Record<string, AchievementHint>;
  questsDigest: QuestsDigestData;
  hideoutNeeds: HideoutNeed[];
  hideoutStations: HideoutStationInfo[];
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabId>('profile');
  const [activeView, setActiveView] = useState<ViewId | null>(null);

  const handleTabChange = (tab: TabId) => {
    setActiveTab(tab);
    setActiveView(null);
  };

  const navigate = (view: ViewId) => setActiveView(view);
  const goBack = () => setActiveView(null);

  const handleSignOut = async () => {
    await createClient().auth.signOut();
    router.push('/login'); // кабинет под server-гардом — уходим на логин
  };

  const renderContent = () => {
    if (activeView === 'avatar')        return <AvatarView onBack={goBack} me={me} />;
    if (activeView === 'username')      return <UsernameView onBack={goBack} me={me} />;
    if (activeView === 'email')         return <EmailView onBack={goBack} me={me} />;
    if (activeView === 'subscription')  return <SubscriptionView onBack={goBack} me={me} />;
    if (activeView === 'password')      return <PasswordView onBack={goBack} />;
    if (activeView === '2fa')           return <TwoFAView onBack={goBack} />;
    if (activeView === 'plan')          return <PlanView onBack={goBack} showcase={showcase} currentTier={effectiveTier} currentRank={currentRank} pricingPublished={pricingPublished} validUntil={effectiveTier === tier ? validUntil : null} />;
    if (activeView === 'social')        return <SocialView onBack={goBack} me={me} />;

    switch (activeTab) {
      case 'profile':   return <ProfilePanel onNavigate={navigate} me={me} stats={stats} tier={tier} />;
      case 'tracking':  return <TrackingPanel achievements={achievements} hints={hints} questsDigest={questsDigest} hideoutNeeds={hideoutNeeds} hideoutStations={hideoutStations} />;
      case 'security':  return <SecurityPanel onNavigate={navigate} />;
      case 'linking':   return <LinkingPanel onNavigate={navigate} me={me} />;
      case 'billing':   return <BillingPanel onNavigate={navigate} tier={tier} validUntil={validUntil} source={subSource} history={billingHistory} showcase={showcase} pricingPublished={pricingPublished} />;
      case 'prostatus': return <ProStatusPanel tier={tier} validUntil={validUntil} onNavigate={navigate} showcase={showcase} />;
    }
  };

  return (
    <div className="flex w-full flex-col items-center py-8 animate-[fade-in-up_0.4s_ease-out_both]">
      <div className="mx-auto w-full max-w-275 px-4 xl:px-0">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">

          {/* Sidebar */}
          <aside className="flex shrink-0 flex-row gap-1 overflow-x-auto pb-1 lg:w-60 lg:flex-col lg:pb-0">
            {NAV_TABS.map((tab) => {
              const isActive = activeTab === tab.id && activeView === null;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={`group flex shrink-0 items-center gap-3 rounded border px-3 py-3.5 text-left transition-all duration-200 lg:w-full lg:px-4 ${
                    isActive
                      ? 'border-(--primary) bg-[color-mix(in_srgb,var(--primary)_8%,transparent)] text-(--primary)'
                      : 'border-lines-hover bg-card-menu text-text-muted hover:border-text-secondary hover:text-text-primary'
                  }`}
                >
                  <div
                    className={`h-5 w-5 shrink-0 icon-mask ${tab.iconClass} transition-colors ${
                      isActive ? 'bg-(--primary)' : 'bg-text-muted group-hover:bg-text-primary'
                    }`}
                  />
                  <span className="whitespace-nowrap font-blender-medium text-type-caption uppercase tracking-widest transition-colors lg:text-xs">
                    {tab.label}
                  </span>
                </button>
              );
            })}

            <button
              onClick={handleSignOut}
              className="group flex shrink-0 items-center gap-3 rounded border border-lines-hover bg-card-menu px-3 py-3.5 text-left text-text-muted transition-all duration-200 hover:border-danger hover:text-danger lg:mt-2 lg:w-full lg:px-4"
            >
              <LogOut className="h-5 w-5 shrink-0" />
              <span className="whitespace-nowrap font-blender-medium text-type-caption uppercase tracking-widest lg:text-xs">
                Выйти
              </span>
            </button>
          </aside>

          {/* Content */}
          <div className="min-w-0 flex-1">
            {renderContent()}
          </div>

        </div>
      </div>
    </div>
  );
}
