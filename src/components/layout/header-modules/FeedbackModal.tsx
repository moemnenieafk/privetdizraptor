'use client';

// Модалка «Сообщение об ошибке или неточности данных» (Figma 1588:1322).
// Namertvo цепляет текущий URL страницы (pageUrl), шлёт multipart на /api/feedback:
// email, сообщение, до 5 скриншотов (≤500 КБ каждый). SMTP отложен — копим в БД.
import { useState, useRef, useMemo, useEffect } from 'react';
import { AlertTriangle, Paperclip, Check } from 'lucide-react';
import { useModalAnimation } from '@/hooks/useModalAnimation';
import { useUser } from '@/hooks/useUser';

const MAX_FILES = 5;
const MAX_FILE_BYTES = 500 * 1024;
const ALLOWED = ['image/png', 'image/jpeg', 'image/webp', 'image/bmp', 'image/gif'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type SendState = 'idle' | 'sending' | 'success' | 'error';

export default function FeedbackModal({
  isOpen,
  onClose,
  pageUrl,
}: {
  isOpen: boolean;
  onClose: () => void;
  pageUrl: string;
}) {
  const { isRendered, isVisible, modalRef } = useModalAnimation(isOpen, onClose);
  const { user } = useUser();

  const [email, setEmail] = useState('');
  const [emailTouched, setEmailTouched] = useState(false);
  const [message, setMessage] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [consent, setConsent] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [state, setState] = useState<SendState>('idle');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const emailValid = EMAIL_RE.test(email.trim());
  const canSubmit = useMemo(
    () => emailValid && message.trim().length > 0 && consent && state !== 'sending',
    [emailValid, message, consent, state],
  );

  // Автозаполнение email авторизованному — до первой ручной правки (поле остаётся редактируемым).
  useEffect(() => {
    if (!emailTouched && user?.email) setEmail(user.email);
  }, [user?.email, emailTouched]);

  if (!isRendered) return null;

  const pickFiles = (list: FileList | null) => {
    if (!list) return;
    setFileError(null);
    const incoming = Array.from(list);
    const merged = [...files];
    for (const f of incoming) {
      if (!ALLOWED.includes(f.type)) {
        setFileError('Только изображения: png, jpg, webp, bmp, gif');
        continue;
      }
      if (f.size > MAX_FILE_BYTES) {
        setFileError(`Файл «${f.name}» больше 500 Кб`);
        continue;
      }
      if (merged.length >= MAX_FILES) {
        setFileError('Максимум 5 изображений');
        break;
      }
      if (!merged.some((m) => m.name === f.name && m.size === f.size)) merged.push(f);
    }
    setFiles(merged.slice(0, MAX_FILES));
  };

  const submit = async () => {
    if (!canSubmit) return;
    setState('sending');
    try {
      const fd = new FormData();
      fd.set('email', email.trim());
      fd.set('message', message.trim());
      fd.set('pageUrl', pageUrl);
      for (const f of files) fd.append('files', f);
      const res = await fetch('/api/feedback', { method: 'POST', body: fd });
      if (!res.ok) throw new Error('send failed');
      setState('success');
      setTimeout(onClose, 1800);
    } catch {
      setState('error');
    }
  };

  const fileNames = files.map((f) => f.name).join(', ');

  return (
    <div
      className={`fixed inset-0 z-210 flex items-center justify-center bg-black/70 backdrop-blur-sm transition-opacity duration-300 ease-out ${isVisible ? 'opacity-100' : 'opacity-0'}`}
    >
      <div
        ref={modalRef}
        className={`flex max-h-[92vh] w-87 flex-col overflow-hidden shadow-2xl transition-all duration-300 ease-out ${isVisible ? 'translate-y-0 scale-100 opacity-100' : 'translate-y-4 scale-95 opacity-0'}`}
      >
        {/* ШАПКА */}
        <div className="relative flex h-7 w-full shrink-0 items-center gap-1 rounded-t bg-lines-hover">
          <div className="flex h-7 w-7 items-center justify-center p-1.5">
            <AlertTriangle className="h-4 w-4 text-(--primary)" />
          </div>
          <p className="font-blender-medium text-sm leading-none text-text-primary">
            Сообщение об ошибке или неточности данных
          </p>
          <button
            onClick={onClose}
            className="absolute right-0 top-0 flex h-7 w-7 items-center justify-center transition-opacity hover:opacity-80 focus:outline-none"
          >
            <span className="flex h-3 w-4 items-center justify-center rounded-xs bg-danger-dim">
              <span className="h-2 w-2 icon-mask icon-eft-profile-btn-close text-zinc-100" />
            </span>
          </button>
        </div>

        {/* ТЕЛО */}
        <div className="flex w-full flex-col gap-7 overflow-y-auto rounded-b border border-lines-hover bg-card-menu p-7 [scrollbar-width:thin]">
          {/* Раздел ЦТА — намертво привязанный URL */}
          <div className="flex flex-col gap-2">
            <span className="font-blender-medium text-base uppercase text-text-secondary">Раздел ЦТА</span>
            <div className="flex h-10.5 items-center rounded bg-(--color-base) px-3.5">
              <span className="truncate font-blender-book text-sm text-text-muted">{pageUrl}</span>
            </div>
          </div>

          {/* EMAIL* */}
          <div className="flex flex-col gap-2">
            <span className="font-blender-medium text-base uppercase text-text-secondary">
              EMAIL<span className="text-[0.65em] text-danger">*</span>
            </span>
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setEmailTouched(true);
              }}
              placeholder="tarkovcitizen@gmail.com"
              className="h-10.5 rounded border-[0.5px] border-lines-hover bg-(--color-darkbase) px-3.5 font-blender-book text-lg text-(--primary) placeholder:text-text-muted focus:border-(--primary) focus:outline-none"
            />
          </div>

          {/* Скриншот */}
          <div className="flex flex-col gap-2">
            <span className="font-blender-medium text-base uppercase text-text-secondary">Скриншот</span>
            <div className="flex h-10.5 items-center gap-2 rounded border-[0.5px] border-lines-hover bg-(--color-darkbase) py-3.5 pl-3.5 pr-2">
              <span className={`flex-1 truncate font-blender-book text-sm ${fileNames ? 'text-(--primary)' : 'text-text-muted'}`}>
                {fileNames || 'Прикрепите изображения…'}
              </span>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                title="Прикрепить"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-lines-hover bg-card-menu transition-colors hover:border-(--primary) focus:outline-none"
              >
                <Paperclip className="h-4 w-4 text-text-secondary" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept={ALLOWED.join(',')}
                multiple
                hidden
                onChange={(e) => {
                  pickFiles(e.target.files);
                  e.target.value = '';
                }}
              />
            </div>
            <span className={`font-blender-medium text-type-micro ${fileError ? 'text-danger' : 'text-text-muted'}`}>
              {fileError ?? 'Лимит загруженных изображений: 5 шт. каждый не более 500 Кб'}
            </span>
          </div>

          {/* Сообщение* */}
          <div className="flex flex-col gap-2">
            <span className="font-blender-medium text-base uppercase text-text-secondary">
              Сообщение<span className="text-[0.65em] text-danger">*</span>
            </span>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Введите текст сообщения..."
              rows={5}
              maxLength={5000}
              className="h-31.5 resize-none rounded border-[0.5px] border-lines-hover bg-(--color-darkbase) p-3.5 font-blender-book text-sm text-text-primary placeholder:text-text-muted focus:border-(--primary) focus:outline-none"
            />
          </div>

          {/* Согласие */}
          <label className="flex cursor-pointer items-start gap-3.5">
            <button
              type="button"
              onClick={() => setConsent((v) => !v)}
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded border-[0.5px] transition-colors ${consent ? 'border-(--primary) bg-primary/10' : 'border-lines-hover bg-(--color-darkbase)'}`}
            >
              {consent && <Check className="h-4 w-4 text-(--primary)" />}
            </button>
            <span className="font-blender-book text-xs leading-tight text-text-primary">
              Отправляя сообщение об ошибке, вы соглашаетесь с{' '}
              <a href="/legal/terms" target="_blank" rel="noreferrer" className="underline hover:text-(--primary)">
                Условиями использования
              </a>{' '}
              и{' '}
              <a href="/legal/privacy" target="_blank" rel="noreferrer" className="underline hover:text-(--primary)">
                Политикой конфиденциальности ЦТА
              </a>
              .
            </span>
          </label>

          {state === 'error' && (
            <p className="flex items-center gap-2 rounded border border-danger/40 bg-danger/10 p-3 font-blender-medium text-xs uppercase tracking-widest text-danger">
              <AlertTriangle className="h-4 w-4 shrink-0" /> Не удалось отправить. Попробуйте позже.
            </p>
          )}

          {/* Отправить */}
          <button
            type="button"
            onClick={submit}
            disabled={!canSubmit && state !== 'success'}
            className={`flex h-14 items-center justify-center rounded-lg font-blender-medium text-lg uppercase transition-colors ${
              state === 'success'
                ? 'bg-success text-(--color-base)'
                : canSubmit
                  ? 'bg-(--primary) text-(--color-base) hover:opacity-90'
                  : 'cursor-not-allowed bg-text-secondary text-(--color-base) opacity-60'
            }`}
          >
            {state === 'success' ? (
              <span className="flex items-center gap-2">
                <Check className="h-5 w-5" /> Отправлено
              </span>
            ) : state === 'sending' ? (
              'Отправка…'
            ) : (
              'Отправить'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
