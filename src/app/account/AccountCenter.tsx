'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronDown, Check, LogOut, Eye, EyeOff } from 'lucide-react';
import { usePlayerStore } from '@/store/usePlayerStore';
import { createClient } from '@/lib/supabase/client';
import { changeEmail, saveSocials, changeUsername, uploadAvatar, resetCtaProgress } from '@/lib/cta-api';
import type { Me, SocialPlatform, AccountStats } from '@/lib/auth/me';
import type { AchievementView } from '@/lib/achievement-visuals';
import type { AchievementHint } from '@/lib/achievement-hints';
import type { QuestsDigestData } from '@/lib/tracking-digest';
import type { HideoutNeed, HideoutStationInfo } from '@/db/hideout';
import { PROGRESS_KEYS } from '@/lib/progress-storage';
import { EDITIONS } from '@/components/layout/header-modules/ProfileSettingsModal';
import { TrackingPanel } from './TrackingPanel';

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
}: {
  placeholder: string;
  type?: string;
  value: string;
  onChange?: (v: string) => void;
  disabled?: boolean;
  readOnly?: boolean;
  maxLength?: number;
  autoComplete?: string;
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

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  // Кулдаун — зеркалит серверный (60 дней от usernameChangedAt). 0 = можно менять.
  const daysLeft = useMemo(() => {
    if (!me.usernameChangedAt) return 0;
    const elapsed = Date.now() - new Date(me.usernameChangedAt).getTime();
    const left = USERNAME_COOLDOWN_DAYS * DAY_MS - elapsed;
    return left > 0 ? Math.ceil(left / DAY_MS) : 0;
  }, [me.usernameChangedAt]);

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

function SubscriptionView({ onBack }: { onBack: () => void }) {
  const [checks, setChecks] = useState([true, true, true]);
  const toggle = (i: number) =>
    setChecks((prev) => prev.map((v, idx) => (idx === i ? !v : v)));

  const labels = [
    'Отправлять сообщения об изменениях в моей учётной записи. Получать уведомления в случае несанкционированного входа в вашу учётную запись, изменения пароля или настроек безопасности.',
    'Получать по электронной почте новостные дайджесты и специальные предложения, касающиеся продуктов и услуг ЦТА Limited.',
    'Получать новости и специальные предложения, связанные с платформой ЦТА.',
  ];

  return (
    <div className="flex flex-col">
      <BackBtn onClick={onBack} />
      <div className="flex flex-col items-center gap-5">
        <SubTitle>Параметры подписки</SubTitle>
        <div className="flex w-full max-w-md flex-col gap-4">
          <button className="flex items-center justify-between rounded border border-lines-hover bg-card-menu px-4 py-3 transition-colors hover:border-(--primary)">
            <span className="font-blender-book text-sm text-text-secondary">Русский / Russian</span>
            <ChevronDown className="h-4 w-4 text-text-muted" />
          </button>
          {labels.map((label, i) => (
            <button
              key={i}
              onClick={() => toggle(i)}
              className="flex items-start gap-3 text-left"
            >
              <div
                className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-xs border transition-colors ${
                  checks[i]
                    ? 'border-(--primary) bg-(--primary)/20'
                    : 'border-lines-hover bg-(--color-base)'
                }`}
              >
                {checks[i] && <Check className="h-2.5 w-2.5 text-(--primary)" />}
              </div>
              <span className="font-blender-book text-xs leading-relaxed text-text-secondary">
                {label}
              </span>
            </button>
          ))}
        </div>
        <button className="rounded border border-(--primary) bg-(--primary)/10 px-8 py-2.5 font-blender-medium text-type-caption uppercase tracking-widest text-(--primary) transition-all hover:bg-(--primary)/20">
          Сохранить
        </button>
      </div>
    </div>
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
    if (password.length < 8) {
      setError('Пароль не короче 8 символов');
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
            Задайте пароль для входа на сайт по e-mail и паролю. Не короче 8 символов.
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
            disabled={password.length < 8 || password !== confirm}
            label="Сохранить"
          />
        )}
      </div>
    </form>
  );
}

function TwoFAView({ onBack }: { onBack: () => void }) {
  const methods = [
    { label: 'Резервный e-mail',           status: null,       action: 'Настроить' },
    { label: 'Одноразовые коды',           status: 'Включено', action: null },
    { label: 'Секретный вопрос',           status: 'Включено', action: null },
    { label: 'Приложение аутентификатор',  status: 'Включено', action: null },
  ];

  return (
    <div className="flex flex-col">
      <BackBtn onClick={onBack} />
      <div className="flex flex-col items-center gap-5">
        <SubTitle>Двухфакторная аутентификация</SubTitle>

        <div className="flex w-full max-w-md flex-col gap-4">
          <div>
            <p className="mb-2 font-blender-medium text-type-caption uppercase tracking-widest text-text-muted">
              Текущий способ защиты учётной записи
            </p>
            <div className="flex items-center justify-between rounded border border-(--primary) bg-(--primary)/5 px-4 py-3">
              <span className="font-blender-medium text-sm text-(--primary)">Приложение аутентификатор</span>
              <RowBtn label="Изменить" variant="active" />
            </div>
          </div>

          <div>
            <p className="mb-2 font-blender-medium text-type-caption uppercase tracking-widest text-text-muted">
              Доступные способы защиты учётной записи
            </p>
            <div className="flex flex-col divide-y divide-lines-hover rounded border border-lines-hover">
              {methods.map((m) => (
                <div key={m.label} className="flex items-center justify-between px-4 py-3">
                  <span className="font-blender-book text-sm text-text-secondary">{m.label}</span>
                  {m.status && (
                    <span className="font-blender-medium text-type-caption uppercase tracking-widest text-text-muted">
                      {m.status}
                    </span>
                  )}
                  {m.action && <RowBtn label={m.action} />}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded border border-accent-frago/20 bg-accent-frago/5 px-4 py-3 text-center">
            <p className="font-blender-book text-xs leading-relaxed text-accent-frago/80">
              Вы не можете выбрать другой способ входа, пока активен текущий метод защиты учётной записи.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function PlanView({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex flex-col">
      <BackBtn onClick={onBack} />
      <div className="flex flex-col items-center gap-4 py-8 text-center">
        <SubTitle>Выбранный тариф</SubTitle>
        <p className="font-blender-book text-xs leading-relaxed text-text-muted max-w-xs">
          Управление тарифными планами будет доступно после запуска платёжного модуля.
        </p>
      </div>
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

function ProfilePanel({ onNavigate, me, stats }: { onNavigate: (v: ViewId) => void; me: Me; stats: AccountStats }) {
  const profiles = usePlayerStore((s) => s.profiles);
  const activeProfileId = usePlayerStore((s) => s.activeProfileId);
  const activeProfile = profiles.find((p) => p.id === activeProfileId) ?? profiles[0];
  const isPro = activeProfile?.edition === 'TUE' || activeProfile?.edition === 'EOD';

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
          action={<RowBtn />}
        >
          {isPro ? (
            <>
              <div className="flex h-5 items-center gap-1 rounded border border-tactical-amber/30 bg-tactical-amber/10 px-1.5">
                <div className="h-3 w-3 icon-mask icon-account_prostatus_icon bg-tactical-amber" />
                <span className="font-blender-medium text-type-caption tracking-wider text-tactical-amber">PRO</span>
              </div>
              <span className="font-blender-book text-sm text-tactical-amber">
                Полный доступ ко всем функциям
              </span>
            </>
          ) : (
            <span className="font-blender-book text-sm text-text-muted">Стандартный доступ</span>
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
      <div className="rounded border border-lines-hover bg-card-menu px-6 py-5">
        <h2 className="font-blender-medium text-sm uppercase tracking-widest text-text-primary">
          Связанные аккаунты
        </h2>
        <p className="mt-1 font-blender-book text-xs text-text-secondary">
          Возможность и статус привязки аккаунтов сторонних ресурсов
        </p>
      </div>

      <div className="rounded border border-lines-hover bg-card-menu px-6">
        {PLATFORMS.map((platform) => {
          const handle = me.socials[platform.id];
          const linked = !!handle;
          return (
            <div
              key={platform.id}
              className="flex items-center gap-4 border-b border-lines-hover py-5 last:border-b-0"
            >
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded border border-lines-hover"
                style={{ backgroundColor: `${platform.color}1a` }}
              >
                <span
                  className="font-blender-medium text-xs"
                  style={{ color: platform.color }}
                >
                  {platform.name.slice(0, 2)}
                </span>
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

function BillingPanel({ onNavigate }: { onNavigate: (v: ViewId) => void }) {
  return (
    <div className="rounded border border-lines-hover bg-card-menu px-6">
      <FlatRow
        label="Выбранный тариф"
        action={<RowBtn onClick={() => onNavigate('plan')} />}
      >
        <span className="font-blender-medium text-xs text-text-muted">Не настроено</span>
      </FlatRow>
    </div>
  );
}

function ProStatusPanel() {
  return (
    <div className="rounded border border-lines-hover bg-card-menu p-6">
      <div className="flex flex-col items-center gap-4 py-10 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded border border-tactical-amber/30 bg-tactical-amber/5">
          <div className="h-8 w-8 icon-mask icon-account_prostatus_icon bg-tactical-amber" />
        </div>
        <div className="flex items-center gap-2">
          <span className="font-blender-medium text-2xl uppercase tracking-widest text-tactical-amber">
            PRO
          </span>
          <div className="flex h-5 items-center rounded border border-tactical-amber/40 bg-tactical-amber/10 px-2">
            <span className="font-blender-medium text-type-caption tracking-widest text-tactical-amber">
              Активен
            </span>
          </div>
        </div>
        <p className="font-blender-book text-sm leading-relaxed text-text-secondary max-w-xs">
          PRO-статус даёт полный доступ ко всем функциям платформы ЦТА. Осуществляется с помощью подписки.
        </p>
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
}: {
  me: Me;
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
    if (activeView === 'subscription')  return <SubscriptionView onBack={goBack} />;
    if (activeView === 'password')      return <PasswordView onBack={goBack} />;
    if (activeView === '2fa')           return <TwoFAView onBack={goBack} />;
    if (activeView === 'plan')          return <PlanView onBack={goBack} />;
    if (activeView === 'social')        return <SocialView onBack={goBack} me={me} />;

    switch (activeTab) {
      case 'profile':   return <ProfilePanel onNavigate={navigate} me={me} stats={stats} />;
      case 'tracking':  return <TrackingPanel achievements={achievements} hints={hints} questsDigest={questsDigest} hideoutNeeds={hideoutNeeds} hideoutStations={hideoutStations} />;
      case 'security':  return <SecurityPanel onNavigate={navigate} />;
      case 'linking':   return <LinkingPanel onNavigate={navigate} me={me} />;
      case 'billing':   return <BillingPanel onNavigate={navigate} />;
      case 'prostatus': return <ProStatusPanel />;
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
