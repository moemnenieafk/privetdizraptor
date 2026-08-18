// Курируемая правка списка предметов Коллекционера (Kappa) ПОВЕРХ устаревшего зеркала tarkov.dev по
// этому квесту. Источник правды — docs/eft/Квест - Коллекционер.md (сверен V4DYA на актуальном патче 2026).
// Зеркало квеста ещё держит Evasion-повязку и НЕ содержит 4 стример-предмета патча.
// Паттерн §4.11 / game-data-ingest: данных нет/неверны во внешнем API → курируем сами; когда крон
// синканёт корректные objectives — этот оверрайд убрать.

/** Убрать из списка: item id «Повязка на плечо Evasion» (в objectives есть, в актуальном Kappa НЕТ). */
export const COLLECTOR_DROP_ITEM_IDS = new Set<string>(['60b0f988c4449e4cb624c1da']);

/** Добавить: стример-предметы патча (нет в objectives квеста). id/редкость резолвим по slug из нашего
 * зеркала цен; name/shortName — отсюда, т.к. в зеркале shortName задан неверно (заметка V4DYA в docs). */
export interface CollectorExtra {
  /** normalizedName (slug страницы предмета) — по нему резолвим inGameId из зеркала. */
  slug: string;
  name: string;
  shortName: string;
}
export const COLLECTOR_EXTRA_ITEMS: CollectorExtra[] = [
  { slug: 'can-of-gigabeef-meat', name: 'Консервированное мясо GigaBeef', shortName: 'GigaBeef' },
  { slug: 'lm-kc-130-model-aircraft', name: 'Модель самолёта LM KC-130', shortName: 'KC-130' },
  { slug: 'french-bakery-baguette', name: 'Багет из французской пекарни', shortName: 'Cocaoo_' },
  { slug: 'bottle-of-ymxc-water', name: 'Бутылка воды YMXC', shortName: 'YMXC' },
];
