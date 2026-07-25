// Кэш спрайтов для канвас-игры. Грузим WebP в HTMLImageElement (drawable в 2D-контекст),
// decode() гарантирует готовность к первому кадру без мигания.

export class SpriteCache {
  private readonly map = new Map<string, HTMLImageElement>();

  get(src: string): HTMLImageElement | null {
    const img = this.map.get(src);
    return img && img.complete && img.naturalWidth > 0 ? img : null;
  }

  /** Загрузить набор источников. Ошибки отдельных файлов не роняют игру. */
  async load(srcs: readonly string[]): Promise<void> {
    await Promise.all(
      srcs.map(async (src) => {
        if (this.map.has(src)) return;
        const img = new Image();
        img.decoding = 'async';
        img.src = src;
        this.map.set(src, img);
        try {
          await img.decode();
        } catch {
          /* битый/недогруженный файл — get() вернёт null, кадр просто без спрайта */
        }
      }),
    );
  }
}
