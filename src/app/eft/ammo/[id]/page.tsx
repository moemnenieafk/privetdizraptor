"use client";
import React from 'react';
import { useRouter } from 'next/navigation';

// Define the type for the data we expect from the API
interface AmmoDetails {
  id: string;
  name: string;
  shortName: string;
  description: string;
  image512pxLink: string;
  properties: {
    damage: number;
    penetrationPower: number;
    fragmentationChance: number;
    recoilModifier: number;
    initialSpeed: number;
  };
  buyFor: {
    price: number;
    currency: string;
    vendor: { name: string };
  }[];
}

// Create a separate client component for the back button
function BackButton() {
  const router = useRouter();
  return (
    <button 
      onClick={() => router.back()}
      className="mb-12 text-[10px] font-black uppercase tracking-[0.3em] text-text-muted hover:text-text-primary transition-colors border-b border-lines-hover pb-1"
    >
      ← Назад к таблице
    </button>
  );
}

// Server-side function to fetch data
async function getAmmoDetails(id: string): Promise<AmmoDetails | null> {
  const query = `
    {
      item(id: "${id}") {
        id
        name
        shortName
        description
        image512pxLink
        properties {
          ... on ItemPropertiesAmmo {
            damage
            penetrationPower
            fragmentationChance
            recoilModifier
            initialSpeed
          }
        }
        buyFor {
          price
          currency
          vendor { name }
        }
      }
    }
  `;
  try {
    const res = await fetch('https://api.tarkov.dev/graphql', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ query }),
      next: { revalidate: 3600 } // Revalidate data every hour
    });
    const json = await res.json();
    return json.data?.item || null;
  } catch (err) {
    console.error("Ошибка загрузки патрона:", err);
    return null;
  }
}

export default async function AmmoIdPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const item = await getAmmoDetails(resolvedParams.id);

  if (!item) return (
    <div className="min-h-screen bg-base text-text-primary flex flex-col">
      <div className="flex-grow flex items-center justify-center">
        <p className="text-text-muted font-black uppercase tracking-tighter">Патрон не найден</p>
      </div>
    </div>
  );

  return (
    <main className="min-h-screen bg-base text-text-primary flex flex-col pt-[28px] pb-[56px]">
      
      <div className="flex-grow max-w-4xl mx-auto px-6 py-20 w-full">
        <BackButton />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-start">
          <div className="relative group mx-auto md:mx-0 w-full max-w-sm">
            <div className="absolute -inset-1 bg-primary/10 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>
            <div className="relative bg-card-menu/30 border border-lines-hover p-10 rounded-2xl flex items-center justify-center backdrop-blur-sm">
              <img src={item.image512pxLink} alt={item.name} className="w-full h-auto drop-shadow-[0_20px_50px_rgba(0,0,0,0.8)]" draggable="false" />
            </div>
          </div>

          <div className="flex flex-col">
            <h1 className="text-5xl font-black uppercase italic tracking-tighter mb-4 leading-none text-text-primary">{item.shortName}</h1>
            <p className="text-text-muted text-[11px] font-bold uppercase tracking-[0.2em] mb-10">{item.name}</p>

            <div className="grid grid-cols-2 gap-6 mb-10">
              <div className="bg-card-menu/40 border border-lines-hover p-6 rounded-lg">
                <span className="block text-[9px] text-text-muted font-black uppercase mb-2 tracking-widest">Урон</span>
                <span className="text-5xl font-black italic text-text-primary leading-none">{item.properties?.damage}</span>
              </div>
              <div className="bg-card-menu/40 border border-lines-hover p-6 rounded-lg">
                <span className="block text-[9px] text-text-muted font-black uppercase mb-2 tracking-widest">Пробитие</span>
                <span className="text-5xl font-black italic text-primary leading-none">{item.properties?.penetrationPower}</span>
              </div>
            </div>

            <div className="space-y-4 text-[10px] font-black uppercase tracking-[0.2em] text-text-muted">
              <div className="flex justify-between border-b border-lines-hover pb-3">
                <span>Начальная скорость</span>
                <span className="text-text-primary italic">{item.properties?.initialSpeed} м/с</span>
              </div>
              <div className="flex justify-between border-b border-lines-hover pb-3">
                <span>Фрагментация</span>
                <span className="text-text-primary italic">{((item.properties?.fragmentationChance || 0) * 100).toFixed(0)}%</span>
              </div>
              <div className="flex justify-between border-b border-lines-hover pb-3">
                <span>Модификатор отдачи</span>
                <span className="text-text-primary italic">{item.properties?.recoilModifier}%</span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-20">
          <h2 className="text-2xl font-black uppercase italic mb-8 tracking-tighter border-l-4 border-primary pl-4">Где приобрести</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {item.buyFor?.filter(offer => offer.vendor?.name !== 'Flea Market').map((offer, i) => (
              <div key={i} className="flex justify-between items-center bg-card-menu/20 border border-lines-hover p-5 rounded-lg hover:bg-card-menu/40 transition-all group">
                <span className="text-[11px] font-black uppercase tracking-widest text-text-secondary group-hover:text-text-primary">{offer.vendor?.name}</span>
                <span className="text-xl font-black text-primary italic">
                  {offer.price?.toLocaleString()} {offer.currency === 'RUB' ? '₽' : offer.currency}
                </span>
              </div>
            ))}
            {(!item.buyFor || item.buyFor.filter(offer => offer.vendor?.name !== 'Flea Market').length === 0) && (
              <div className="col-span-full py-8 text-center border-2 border-dashed border-lines-hover rounded-xl">
                <p className="text-text-muted italic uppercase text-[10px] font-black tracking-widest">Только находка в рейде / Крафт</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}