import { draftMode } from 'next/headers';
import { getCmsUser } from '@/lib/auth/admin';
import { DraftToggle } from './DraftToggle';

// Монтируется в корневом layout. Обычный посетитель не получает ничего —
// ни разметки, ни клиентского кода: решение принимает сервер.
export async function DraftLayer() {
  const cms = await getCmsUser();
  if (!cms?.canEditContent) return null;

  const { isEnabled } = await draftMode();
  return <DraftToggle enabled={isEnabled} />;
}
