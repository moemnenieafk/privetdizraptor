'use client';

/**
 * Переключатель-пилюля. Вынесен в атом, потому что понадобился во втором месте:
 * системные тумблеры админки (`/admin/billing`) и автопродление в кабинете.
 * До этого разметка жила инлайном в SystemTogglesClient — копировать её второй раз
 * значило бы развести два тумблера, которые со временем разъедутся.
 *
 * Управляемый: состояние держит родитель, сюда приходит `checked` + `onChange`.
 */
interface SwitchProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  /** Доступное имя — у пилюли нет видимой подписи внутри. */
  label: string;
}

export function Switch({ checked, onChange, disabled = false, label }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full border transition-colors disabled:opacity-50 ${
        checked
          ? 'border-(--primary) bg-[color-mix(in_srgb,var(--primary)_35%,transparent)]'
          : 'border-lines-hover bg-(--color-base)'
      }`}
    >
      <span
        className={`absolute top-0.5 h-4.5 w-4.5 rounded-full transition-all ${
          checked ? 'left-5.5 bg-(--primary)' : 'left-0.5 bg-text-muted'
        }`}
      />
    </button>
  );
}
