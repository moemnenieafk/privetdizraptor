import { AccountHeader } from './AccountHeader';

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <AccountHeader />
      <main className="grow flex flex-col w-full">
        {children}
      </main>
    </div>
  );
}
