import { config } from '../config.js';

let cache = new Map();

async function yt(endpoint, params) {
  if (!config.youtubeApiKey || !config.youtubeChannelId) {
    return { configured: false, channelUrl: config.youtubeChannelUrl, items: [] };
  }
  const qs = new URLSearchParams({ ...params, key: config.youtubeApiKey });
  const url = `https://www.googleapis.com/youtube/v3/${endpoint}?${qs}`;
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok) {
    const message = data?.error?.message || `YouTube API error ${res.status}`;
    throw Object.assign(new Error(message), { status: 502 });
  }
  return data;
}

async function cached(key, fn) {
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && hit.expires > now) return hit.value;
  const value = await fn();
  cache.set(key, { value, expires: now + config.youtubeCacheSeconds * 1000 });
  return value;
}

export async function latestVideos(maxResults = 8) {
  return cached(`latest:${maxResults}`, async () => {
    const data = await yt('search', {
      part: 'snippet',
      channelId: config.youtubeChannelId,
      order: 'date',
      type: 'video',
      maxResults: String(maxResults)
    });
    if (data.configured === false) return data;
    return {
      configured: true,
      channelUrl: config.youtubeChannelUrl,
      items: (data.items || []).map(x => ({
        videoId: x.id.videoId,
        title: x.snippet.title,
        description: x.snippet.description,
        publishedAt: x.snippet.publishedAt,
        thumbnail: x.snippet.thumbnails?.high?.url || x.snippet.thumbnails?.medium?.url,
        watchUrl: `https://www.youtube.com/watch?v=${x.id.videoId}`
      }))
    };
  });
}

export async function liveVideo() {
  return cached('live', async () => {
    const data = await yt('search', {
      part: 'snippet',
      channelId: config.youtubeChannelId,
      eventType: 'live',
      type: 'video',
      maxResults: '1'
    });
    if (data.configured === false) return data;
    const x = data.items?.[0];
    return {
      configured: true,
      live: Boolean(x),
      channelUrl: config.youtubeChannelUrl,
      item: x ? {
        videoId: x.id.videoId,
        title: x.snippet.title,
        thumbnail: x.snippet.thumbnails?.high?.url,
        watchUrl: `https://www.youtube.com/watch?v=${x.id.videoId}`
      } : null
    };
  });
}
