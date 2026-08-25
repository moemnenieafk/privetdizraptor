-- CTA Vision (Ф1): распознавание инвентаря по скриншоту.
-- Аддитивно и идемпотентно. НЕ через db:push (TTY + сброс RLS — гоча).
-- Колонки/типы 1:1 с src/db/schema/vision.ts.

-- Эталонные dHash иконок предметов (индекс совпадений pHash).
CREATE TABLE IF NOT EXISTS item_icon_hashes (
  item_id         text        PRIMARY KEY,
  name            text        NOT NULL,
  normalized_name text        NOT NULL,
  grid_w          smallint    NOT NULL,
  grid_h          smallint    NOT NULL,
  dhash           text        NOT NULL,
  icon_url        text        NOT NULL,
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Фильтр кандидатов по габаритам ячеек.
CREATE INDEX IF NOT EXISTS item_icon_hashes_dims_idx
  ON item_icon_hashes (grid_w, grid_h);

-- Кэш результатов скана: sha256 скриншота → один скриншот не биллится дважды.
CREATE TABLE IF NOT EXISTS inventory_scans (
  image_hash   text        PRIMARY KEY,
  user_id      text,
  result       jsonb       NOT NULL,
  cell_pitch   integer     NOT NULL,
  vision_calls smallint    NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now()
);
