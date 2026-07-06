import Link from 'next/link';
import Image from 'next/image';

export function PlatformLogo() {
  return (
    <div className="shrink-0 animate-[fade-in_0.5s_ease-out]">
      <Link href="/" className="block transition-transform hover:brightness-125 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm">
        <div className="relative h-14 w-40">
          <Image
            src="/icons/CTA-logo-hover.svg"
            alt="ЦТА Лого"
            fill
            className="object-contain"
            priority
          />
        </div>
      </Link>
    </div>
  );
}