import Image from 'next/image';
import Link from 'next/link';
import type { Boss } from '@/types/boss';
import { BossBodyDamage } from './BossBodyDamage';
import { BossItemLoadout } from './BossItemLoadout';

function InfoRow({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-type-caption font-blender-medium uppercase tracking-widest text-text-muted">{label}</span>
      <span className="text-sm text-text-primary font-blender-book">{value}</span>
    </div>
  );
}

export function BossDetail({ boss }: { boss: Boss }) {
  return (
    <main className="flex w-full flex-col items-center justify-start animate-[fade-in_0.5s_ease-out_both] pt-7 pb-16">
      <div className="w-full max-w-275 px-4 xl:px-0">

        <Link href="/eft/gamesetting/bosses" className="mb-6 inline-block text-type-caption font-blender-medium uppercase tracking-widest text-text-muted transition-colors hover:text-(--primary)">
          ← Все боссы
        </Link>

        {/* Шапка: портрет + основное */}
        <div className="mb-10 grid gap-6 md:grid-cols-[280px_1fr]">
          <div className="relative aspect-[3/4] w-full overflow-hidden rounded-md border border-lines-hover bg-(--color-darkbase)">
            <Image src={boss.portrait} alt={boss.nameRu} fill className="object-cover object-top" sizes="280px" priority />
          </div>

          <div className="flex flex-col gap-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-blender-medium uppercase tracking-widest text-text-primary">{boss.nameRu}</h1>
              <p className="text-sm uppercase tracking-widest text-text-muted">{boss.nameEn}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {boss.threat && (
                <span className="rounded border border-(--primary)/40 bg-[color-mix(in_srgb,var(--primary)_14%,transparent)] px-2 py-0.5 text-type-caption font-blender-medium uppercase tracking-widest text-(--primary)">
                  Угроза: {boss.threat}
                </span>
              )}
              {boss.totalHp != null && (
                <span className="rounded border border-lines-hover bg-card-menu px-2 py-0.5 text-type-caption font-blender-medium uppercase tracking-widest text-text-secondary">
                  Σ HP: {boss.totalHp}
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <InfoRow label="Роль" value={boss.role} />
              <InfoRow label="Локация" value={boss.location} />
              <InfoRow label="Броня" value={boss.armor} />
              <InfoRow label="Оружие" value={boss.weapon} />
              <InfoRow label="Сопровождение" value={boss.followers} />
            </div>
            {((boss.armorItems && boss.armorItems.length > 0) || (boss.weaponItems && boss.weaponItems.length > 0)) && (
              <div className="flex flex-col gap-4 sm:flex-row sm:gap-8">
                {boss.armorItems && boss.armorItems.length > 0 && (
                  <BossItemLoadout slugs={boss.armorItems} caption="Носимая броня" />
                )}
                {boss.weaponItems && boss.weaponItems.length > 0 && (
                  <BossItemLoadout slugs={boss.weaponItems} caption="Оружие" />
                )}
              </div>
            )}
          </div>
        </div>

        {/* HP по зонам */}
        {boss.health && boss.health.length > 0 && (
          <section className="mb-10">
            <h2 className="mb-1 text-lg font-blender-medium uppercase tracking-widest text-text-primary">HP по частям тела</h2>
            <p className="mb-4 text-type-caption text-text-muted font-blender-book">По данным tarkov.dev / сообщества (актуально для текущего патча).</p>
            <BossBodyDamage health={boss.health} />
          </section>
        )}

        {/* Лор */}
        <section className="mb-8 rounded-md border border-lines-hover bg-card-menu p-6">
          <h2 className="mb-3 text-lg font-blender-medium uppercase tracking-widest text-text-primary">Предыстория</h2>
          <p className="text-sm leading-relaxed text-text-secondary font-blender-book">{boss.lore}</p>
          <h3 className="mt-5 mb-2 text-type-caption font-blender-medium uppercase tracking-widest text-(--primary)">Почему стал таким</h3>
          <p className="text-sm leading-relaxed text-text-secondary font-blender-book">{boss.motivation}</p>
          {boss.loreConfidence === 'sparse' && (
            <p className="mt-4 text-type-caption text-text-muted font-blender-book">⚠ Официальный лор по этому персонажу ограничен — часть деталей реконструирована из доступных источников.</p>
          )}
        </section>

      </div>
    </main>
  );
}
