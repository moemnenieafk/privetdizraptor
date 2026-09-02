// cta-mapper — типы палитры (подмножество types.ts ветки feat/cta-mapper; при мердже
// ветки файл расширится, эти два типа остаются как есть).

/** Матовый кей фона генерации — из гистограммы кропа, НИКОГДА из ответа модели. */
export type Matte = 'magenta' | 'green';

/** Материальное семейство: база + тень (в тени) + засвет (на солнце). Решение 4b. */
export interface MaterialFamily {
  id: string; // стем токена, напр. 'cnt-blue'
  usage: string; // человеческая метка, напр. 'Blue Metal Containers'
  shadow: string; // #rrggbb — в тени
  default: string; // #rrggbb — база
  highlight: string; // #rrggbb — на солнце
}
