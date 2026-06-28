'use server';

// Задаем ID каналов
const CHANNELS = [
  'UCCqV-0k_T-tVzC40kGzU-lA', // Замените на реальный Channel ID Fullkamen
  'UC5QkQ32B-m4gB0w1i0A-aTQ'  // Замените на реальный Channel ID Battlestate Games
];

export interface YouTubeVideo {
  id: string;
  url: string;
  title: string;
  publishedAt: string;
}

export async function fetchLatestYouTubeVideos(): Promise<YouTubeVideo[]> {
  const apiKey = process.env.YOUTUBE_API_KEY;

  if (!apiKey) {
    console.warn("YouTube API Key не найден. Используются резервные видео.");
    return [];
  }

  try {
    type YtItem = { id: { videoId: string }; snippet: { title: string; publishedAt: string } };
    const videoPromises = CHANNELS.map(async (channelId) => {
      // Ищем последние 3 видео с каждого канала. revalidate: 3600 кэширует ответ на 1 час (3600 секунд)
      const res = await fetch(
        `https://www.googleapis.com/youtube/v3/search?key=${apiKey}&channelId=${channelId}&part=snippet,id&order=date&maxResults=3&type=video`,
        { next: { revalidate: 3600 } }
      );
      const data = (await res.json()) as { items?: YtItem[] };
      return data.items ?? [];
    });

    const results = await Promise.all(videoPromises);
    
    // Объединяем результаты с обоих каналов
    const allVideos = results.flat().map((item) => ({
      id: item.id.videoId,
      url: `https://www.youtube.com/embed/${item.id.videoId}`,
      title: item.snippet.title,
      publishedAt: item.snippet.publishedAt,
    }));

    // Сортируем по дате публикации (от новых к старым) и берем ровно 5 штук для нашей тактической сетки
    return allVideos.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()).slice(0, 5);

  } catch (error) {
    console.error("Ошибка при получении видео с YouTube:", error);
    return [];
  }
}
