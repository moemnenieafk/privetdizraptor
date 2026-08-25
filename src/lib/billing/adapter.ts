// Провайдер-независимый каркас приёма платежей. Реестр адаптеров ПУСТ: реальный
// платёжный провайдер (рельс) подключит Дима позже одним файлом-адаптером. Здесь —
// только контракт (что вебхук-роут ждёт от адаптера) и резолвер по имени.
//
// Каркас не ходит наружу и не хранит ключей (§4.11). Идемпотентность записи в
// леджер обеспечивает writeBillingEvent (unique provider+external_id) — адаптеру
// достаточно вернуть стабильный externalId из тела вебхука.

import type { BillingEventType } from "@/db/billing";

/**
 * Нормализованное событие биллинга, которое адаптер извлекает из тела вебхука.
 * Ложится в writeBillingEvent; при начисляющем типе (grant/payment/renewal) роут
 * дополнительно двигает тир через setUserTier.
 *
 * Идентификация юзера: либо готовый userId, либо usernameHint (роут резолвит логин
 * → profiles.id). Реальный адаптер выберет то, что отдаёт его рельс.
 */
export interface BillingEventInput {
  /** UUID профиля, если провайдер знает его напрямую. */
  userId?: string;
  /** Логин для резолва в profiles.id, если userId неизвестен. */
  usernameHint?: string;
  /** Имя провайдера (совпадает с ключом в ADAPTERS / сегментом маршрута). */
  provider: string;
  /** Стабильный идентификатор транзакции у провайдера — ключ идемпотентности. */
  externalId?: string;
  /** Тип события в терминах леджера. */
  type: BillingEventType;
  /** Целевой тир (slug) при начислении. */
  tier?: string;
  /** Сумма платежа (в рублях по умолчанию). */
  amount?: number;
  /** Валюта ISO-4217; дефолт RUB на уровне writeBillingEvent. */
  currency?: string;
  /** Статус транзакции у провайдера (succeeded/pending/…). */
  status?: string;
  /** Срок подписки в месяцах (>0 → valid_until, 0/undefined → бессрочно). */
  months?: number;
  /** Сырое тело вебхука для аудита. */
  raw?: unknown;
}

/**
 * Контракт платёжного адаптера. verify — проверка подписи/секрета вебхука (нет →
 * 401). parse — извлечение нормализованного события из запроса. Обе — по одному
 * объекту Request (тело читается адаптером).
 */
export interface PaymentAdapter {
  /** Имя рельса (yookassa/prodamus/…); совпадает с ключом реестра. */
  name: string;
  /** Проверка аутентичности вебхука (подпись/секрет). false → роут вернёт 401. */
  verify(req: Request): Promise<boolean>;
  /** Разбор тела вебхука в нормализованное событие. */
  parse(req: Request): Promise<BillingEventInput>;
}

/**
 * Реестр адаптеров — ПУСТ.
 *
 * TODO(Дима): выбрать платёжный рельс (ЮKassa / Prodamus / …) и добавить адаптер
 * сюда одним ключом, например:
 *
 *   ADAPTERS.yookassa = {
 *     name: "yookassa",
 *     async verify(req) { … проверка подписи по секрету из .env … },
 *     async parse(req) { … вернуть BillingEventInput из тела вебхука … },
 *   };
 *
 * Ключи/секреты провайдера — только в .env (никогда в коде). Больше ничего трогать
 * не нужно: вебхук-роут и запись в леджер уже готовы.
 */
export const ADAPTERS: Record<string, PaymentAdapter> = {};

/** Адаптер по имени провайдера или null, если рельс ещё не подключён. */
export function getAdapter(name: string): PaymentAdapter | null {
  return ADAPTERS[name] ?? null;
}
