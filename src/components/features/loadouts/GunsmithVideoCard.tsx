// Видео-гайд к квесту. Не встраиваем плеер: iframe YouTube тянет ~700 КБ скриптов
// и трекеров, а на мобиле это заметно. Показываем превью-карточку со ссылкой —
// человек откроет в приложении YouTube, где ему удобнее.
//
// Серверный компонент: ничего интерактивного, лишний JS не нужен.
import { Play } from 'lucide-react';
import type { GunsmithVideo } from '@/lib/gunsmith-videos';

export function GunsmithVideoCard({ video }: { video: GunsmithVideo }) {
  return (
    <a
      href={video.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-center gap-3 rounded-sm border border-lines-hover bg-(--color-base) p-3 transition-colors hover:border-(--primary)"
    >
      <div className="relative h-16 w-28 shrink-0 overflow-hidden rounded-xs bg-(--color-darkbase)">
        {video.thumbnailUrl && (
          <img
            src={video.thumbnailUrl}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover"
          />
        )}
        <span className="absolute inset-0 flex items-center justify-center bg-black/40 transition-colors group-hover:bg-black/20">
          <Play className="h-5 w-5 text-(--primary)" aria-hidden="true" />
        </span>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="font-blender-medium text-xs uppercase tracking-widest text-(--primary)">
          Видео-гайд · ФУЛЛ КАМЕНЬ
        </span>
        <span className="line-clamp-2 font-blender-book text-sm text-text-primary">
          {video.title}
        </span>
      </div>
    </a>
  );
}