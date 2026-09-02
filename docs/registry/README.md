# Реестр объектов карт (docs/registry)

- `types.json` — типы: `typeId` (T-NNNN), slug, имя (V4DYA), категория, материалы (семейства palette.ts), канонический экземпляр, `vector` (figma-instance | figma-frame | svg | none), карты.
- `objects.json` — экземпляры: `id` = `<map>:<layer>:<slug|hash>`, bbox z6, размер в метрах, кроп 1:1, `typeId`, статус candidate | confirmed | dup | oob.
- Figma: секция `objects-map-registry` (node 3387:9515) — карточка на тип: кроп + id + бейдж вектора.
- Обучение: скилл `.claude/skills/map-object-recognition/` растёт с каждым confirmed-типом.
