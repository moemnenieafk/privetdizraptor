import type { Metadata } from 'next';
import { AccountCenter } from './AccountCenter';

export const metadata: Metadata = {
  title: 'Аккаунт Центр — CTA',
  description: 'Управление профилем, безопасностью и подпиской CTA.',
};

export default function AccountPage() {
  return <AccountCenter />;
}
