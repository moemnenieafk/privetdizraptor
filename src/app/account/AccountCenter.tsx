'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronDown, Check } from 'lucide-react';
import { usePlayerStore } from '@/store/usePlayerStore';
import { EDITIONS } from '@/components/layout/header-modules/ProfileSettingsModal';

// ─── Types ───────────────────────────────────────────────────────────────────

type TabId = 'profile' | 'security' | 'linking' | 'billing' | 'prostatus';
type ViewId = 'avatar' | 'username' | 'email' | 'subscription' | 'password' | '2fa' | 'plan';

interface NavTab {
  id: TabId;
  label: string;
  iconClass: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const NAV_TABS: NavTab[] = [
  { id: 'profile',   label: 'Профиль',      iconClass: 'icon-account_profile_icon' },
  { id: 'security',  label: 'Безопасность', iconClass: 'icon-account_security_icon' },
  { id: 'linking',   label: 'Спецсвязь',    iconClass: 'icon-account_linking_icon' },
  { id: 'billing',   label: 'Платежи',      iconClass: 'icon-account_billing_icon' },
  { id: 'prostatus', label: 'PRO-статус',   iconClass: 'icon-account_prostatus_icon' },
];

const PLATFORMS = [
  { id: 'twitch',  name: 'TWITCH',  linked: true,  handle: 'v4dyatv',     color: '#9146FF', bg: 'bg-[#9146FF]/10' },
  { id: 'youtube', name: 'YOUTUBE', linked: false,  handle: '',            color: '#FF0000', bg: 'bg-[#FF0000]/10' },
  { id: 'discord', name: 'DISCORD', linked: true,   handle: 'V4DYA#2476', color: '#5865F2', bg: 'bg-[#5865F2]/10' },
  { id: 'steam',   name: 'STEAM',   linked: false,  handle: '',            color: '#A3BCCE', bg: 'bg-[#A3BCCE]/10' },
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
        <span className="font-blender-medium text-[10px] uppercase tracking-widest text-text-muted">
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
      className={`flex items-center rounded border px-4 py-2 font-blender-medium text-[10px] uppercase tracking-widest transition-all duration-200 ${cls}`}
    >
      {label}
    </button>
  );
}

function BackBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="mb-6 inline-flex items-center gap-1 rounded border border-lines-hover bg-card-menu px-3 py-1.5 font-blender-medium text-[10px] uppercase tracking-widest text-text-muted transition-colors hover:border-(--primary) hover:text-(--primary)"
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

function FormInput({ placeholder, type = 'text' }: { placeholder: string; type?: string }) {
  return (
    <input
      type={type}
      placeholder={placeholder}
      className="w-full rounded border border-lines-hover bg-(--color-base) px-4 py-3 font-blender-book text-sm text-text-primary placeholder:text-text-muted transition-colors focus:border-(--primary) focus:outline-none"
    />
  );
}

function FormActions({ onCancel }: { onCancel: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3">
      <button className="w-full max-w-45 rounded border border-(--primary) bg-(--primary)/10 px-6 py-2.5 font-blender-medium text-[10px] uppercase tracking-widest text-(--primary) transition-all hover:bg-(--primary)/20">
        Отправить
      </button>
      <button
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

// ─── Edit sub-views ───────────────────────────────────────────────────────────

function AvatarView({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex flex-col">
      <BackBtn onClick={onBack} />
      <div className="flex flex-col items-center gap-5">
        <SubTitle>Сменить аватар</SubTitle>

        <div className="h-48 w-48 rounded border border-lines-hover bg-(--color-base)" />

        <div className="flex w-full max-w-xs flex-col gap-1.5">
          <input
            type="range"
            min={0}
            max={100}
            defaultValue={20}
            className="h-px w-full cursor-pointer appearance-none bg-lines-hover [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-(--primary)"
          />
          <span className="text-center font-blender-book text-[10px] text-text-muted">Масштабирование аватара</span>
        </div>

        <label className="flex w-full max-w-md cursor-pointer flex-col items-center gap-2 rounded border border-dashed border-lines-hover px-6 py-8 text-center transition-colors hover:border-(--primary)/50">
          <input type="file" accept="image/*" className="hidden" />
          <p className="font-blender-medium text-xs uppercase tracking-widest text-text-secondary">
            Переместите или выберите изображение...
          </p>
          <p className="font-blender-book text-xs text-text-muted">
            изображение должно быть не более{' '}
            <strong className="text-text-secondary">500×500px</strong> и{' '}
            <strong className="text-text-secondary">500 Кб</strong>.
          </p>
        </label>

        <button className="rounded border border-(--primary) bg-(--primary)/10 px-8 py-2.5 font-blender-medium text-[10px] uppercase tracking-widest text-(--primary) transition-all hover:bg-(--primary)/20">
          Сохранить
        </button>
      </div>
    </div>
  );
}

function UsernameView({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex flex-col">
      <BackBtn onClick={onBack} />
      <div className="flex flex-col items-center gap-5">
        <div className="flex flex-col items-center gap-2 text-center">
          <SubTitle>Сменить имя пользователя</SubTitle>
          <p className="font-blender-book text-xs leading-relaxed text-text-muted max-w-xs">
            Поле должно содержать от 3 до 15 символов. Можно использовать латинские буквы, цифры, символ нижнего подчёркивания и дефис.
          </p>
        </div>
        <div className="flex w-full max-w-md flex-col gap-3">
          <FormInput placeholder="Введите имя пользователя" />
          <CooldownWarning>Вы можете изменить логин один раз в 2 месяца.</CooldownWarning>
        </div>
        <FormActions onCancel={onBack} />
      </div>
    </div>
  );
}

function EmailView({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex flex-col">
      <BackBtn onClick={onBack} />
      <div className="flex flex-col items-center gap-5">
        <SubTitle>Сменить E-MAIL</SubTitle>
        <div className="flex w-full max-w-md flex-col gap-3">
          <FormInput placeholder="Введите новый E-mail" type="email" />
          <CooldownWarning>Вы можете изменить e-mail один раз в 2 месяца.</CooldownWarning>
        </div>
        <FormActions onCancel={onBack} />
      </div>
    </div>
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
        <button className="rounded border border-(--primary) bg-(--primary)/10 px-8 py-2.5 font-blender-medium text-[10px] uppercase tracking-widest text-(--primary) transition-all hover:bg-(--primary)/20">
          Сохранить
        </button>
      </div>
    </div>
  );
}

function PasswordView({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex flex-col">
      <BackBtn onClick={onBack} />
      <div className="flex flex-col items-center gap-5">
        <div className="flex flex-col items-center gap-2 text-center">
          <SubTitle>Сменить пароль</SubTitle>
          <p className="font-blender-book text-xs leading-relaxed text-text-muted max-w-xs">
            Укажите действующий адрес электронной почты, которой вы используете для входа, и вам будут высланы инструкции по восстановлению пароля.
          </p>
        </div>
        <div className="w-full max-w-md">
          <FormInput placeholder="E-mail" type="email" />
        </div>
        <FormActions onCancel={onBack} />
      </div>
    </div>
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
            <p className="mb-2 font-blender-medium text-[9px] uppercase tracking-widest text-text-muted">
              Текущий способ защиты учётной записи
            </p>
            <div className="flex items-center justify-between rounded border border-(--primary) bg-(--primary)/5 px-4 py-3">
              <span className="font-blender-medium text-sm text-(--primary)">Приложение аутентификатор</span>
              <RowBtn label="Изменить" variant="active" />
            </div>
          </div>

          <div>
            <p className="mb-2 font-blender-medium text-[9px] uppercase tracking-widest text-text-muted">
              Доступные способы защиты учётной записи
            </p>
            <div className="flex flex-col divide-y divide-lines-hover rounded border border-lines-hover">
              {methods.map((m) => (
                <div key={m.label} className="flex items-center justify-between px-4 py-3">
                  <span className="font-blender-book text-sm text-text-secondary">{m.label}</span>
                  {m.status && (
                    <span className="font-blender-medium text-[10px] uppercase tracking-widest text-text-muted">
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

function ProfilePanel({ onNavigate }: { onNavigate: (v: ViewId) => void }) {
  const profiles = usePlayerStore((s) => s.profiles);
  const activeProfileId = usePlayerStore((s) => s.activeProfileId);
  const activeProfile = profiles.find((p) => p.id === activeProfileId) ?? profiles[0];
  const ed = EDITIONS[activeProfile?.edition ?? 'Standard'];
  const isPro = activeProfile?.edition === 'TUE' || activeProfile?.edition === 'EOD';

  return (
    <div className="flex flex-col gap-4">

      {/* Main rows */}
      <div className="rounded border border-lines-hover bg-card-menu px-6">
        <FlatRow
          label="Аватар профиля"
          action={<RowBtn onClick={() => onNavigate('avatar')} />}
        >
          <div className="flex h-10 w-10 items-center justify-center rounded border border-lines-hover bg-(--color-base)">
            <div className="h-5 w-5 icon-mask icon-account_profile_icon bg-lines-hover" />
          </div>
        </FlatRow>

        <FlatRow
          label="Имя пользователя"
          action={<RowBtn onClick={() => onNavigate('username')} />}
        >
          <span className="font-blender-book text-[11px] text-text-muted">Текущий логин:</span>
          <span className={`font-blender-medium text-sm ${ed.color}`}>
            {activeProfile?.nickname ?? '—'}
          </span>
        </FlatRow>

        <FlatRow
          label="Email"
          action={<RowBtn onClick={() => onNavigate('email')} />}
        >
          <span className="font-blender-book text-[11px] text-text-muted">Текущий E-mail:</span>
          <span className="font-blender-book text-sm text-text-secondary">
            vad***re@gmail.com
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
                <span className="font-mono text-[9px] font-bold tracking-wider text-tactical-amber">PRO</span>
              </div>
              <span className="font-blender-book text-sm text-tactical-amber">
                Полный доступ ко всем функциям
              </span>
            </>
          ) : (
            <span className="font-blender-book text-sm text-text-muted">Стандартный доступ</span>
          )}
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
            <div
              key={game.id}
              className="flex w-52 flex-col gap-3 rounded border border-lines-hover bg-(--color-base) p-4"
            >
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
              <RowBtn label="Сброс прогресса" variant="danger" />
              <p className="font-blender-book text-[9px] leading-relaxed text-text-muted opacity-70">
                Внимание! После сброса данные нельзя восстановить. Прогресс ЧВК: задания, бартер, настройки в игре.
              </p>
            </div>
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
        <span className="font-blender-book text-[11px] text-text-muted">Последнее изменение пароля:</span>
        <span className="font-mono text-xs text-text-secondary">10.06.2026</span>
        <span className="font-mono text-xs text-text-muted">15:10</span>
      </FlatRow>

      <FlatRow
        label="Двухфакторная аутентификация"
        action={<RowBtn onClick={() => onNavigate('2fa')} />}
      >
        <span className="font-blender-book text-[11px] text-text-muted">Привязана</span>
        <span className="font-mono text-xs text-text-secondary">10.06.2026</span>
        <span className="font-mono text-xs text-text-muted">15:30</span>
      </FlatRow>
    </div>
  );
}

function LinkingPanel() {
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
        {PLATFORMS.map((platform) => (
          <div
            key={platform.id}
            className="flex items-center gap-4 border-b border-lines-hover py-5 last:border-b-0"
          >
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded border border-lines-hover ${platform.bg}`}
            >
              <span
                className="font-blender-medium text-xs"
                style={{ color: platform.color }}
              >
                {platform.name.slice(0, 2)}
              </span>
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="font-blender-medium text-[10px] uppercase tracking-widest text-text-muted">
                {platform.name}
              </span>
              <span className="font-blender-book text-sm text-text-secondary">
                {platform.linked ? (
                  <>
                    Аккаунт привязан:{' '}
                    <span className="text-(--primary)">{platform.handle}</span>
                  </>
                ) : (
                  'Аккаунт не привязан'
                )}
              </span>
            </div>
            <RowBtn
              label={platform.linked ? 'Отвязать' : 'Привязать'}
              variant={platform.linked ? 'danger' : 'default'}
            />
          </div>
        ))}
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
        <span className="font-blender-book text-[11px] text-text-muted">Последнее изменение:</span>
        <span className="font-mono text-xs text-text-secondary">10.06.2026</span>
        <span className="font-mono text-xs text-text-muted">15:10</span>
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
            <span className="font-mono text-[9px] font-bold tracking-widest text-tactical-amber">
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

// ─── Main component ───────────────────────────────────────────────────────────

export function AccountCenter() {
  const [activeTab, setActiveTab] = useState<TabId>('profile');
  const [activeView, setActiveView] = useState<ViewId | null>(null);

  const handleTabChange = (tab: TabId) => {
    setActiveTab(tab);
    setActiveView(null);
  };

  const navigate = (view: ViewId) => setActiveView(view);
  const goBack = () => setActiveView(null);

  const renderContent = () => {
    if (activeView === 'avatar')        return <AvatarView onBack={goBack} />;
    if (activeView === 'username')      return <UsernameView onBack={goBack} />;
    if (activeView === 'email')         return <EmailView onBack={goBack} />;
    if (activeView === 'subscription')  return <SubscriptionView onBack={goBack} />;
    if (activeView === 'password')      return <PasswordView onBack={goBack} />;
    if (activeView === '2fa')           return <TwoFAView onBack={goBack} />;
    if (activeView === 'plan')          return <PlanView onBack={goBack} />;

    switch (activeTab) {
      case 'profile':   return <ProfilePanel onNavigate={navigate} />;
      case 'security':  return <SecurityPanel onNavigate={navigate} />;
      case 'linking':   return <LinkingPanel />;
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
                  <span className="whitespace-nowrap font-blender-medium text-[10px] uppercase tracking-widest transition-colors lg:text-xs">
                    {tab.label}
                  </span>
                </button>
              );
            })}
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
