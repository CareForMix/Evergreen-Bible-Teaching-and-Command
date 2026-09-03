import { config } from ‘../config.js’;

let cache = new Map();

async function yt(endpoint, params) { if (!config.youtubeApiKey ||
!config.youtubeChannelId) { return { configured: false, channelUrl:
config.youtubeChannelUrl, items: [] }; }

const qs = new URLSearchParams({ …params, key: config.youtubeApiKey });
const url = https://www.googleapis.com/youtube/v3/${endpoint}?${qs};
const res = await fetch(url); const data = await res.json();

if (!res.ok) { const message = data?.error?.message ||
YouTube API error ${res.status}; throw Object.assign(new Error(message),
{ status: 502 }); }

return data; }

async function cached(key, fn, ttlSeconds = config.youtubeCacheSeconds)
{ const now = Date.now(); const hit = cache.get(key);

if (hit && hit.expires > now) return hit.value;

const value = await fn(); cache.set(key, { value, expires: now +
ttlSeconds * 1000, });

return value; }

async function uploadsPlaylistId() { const data = await yt(‘channels’, {
part: ‘contentDetails’, id: config.youtubeChannelId, maxResults: ‘1’,
});

if (data.configured === false) return null;

return data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads ||
null; }

async function fetchUploadPool(playlistId, wanted = 200) { const
collected = []; let pageToken = ’’; let safetyPages = 0;

while (collected.length < wanted && safetyPages < 10) { const params = {
part: ‘snippet,contentDetails’, playlistId, maxResults: ‘50’, };

    if (pageToken) params.pageToken = pageToken;

    const data = await yt('playlistItems', params);

    if (data.configured === false) return data;

    collected.push(...(data.items || []));
    pageToken = data.nextPageToken || '';
    safetyPages += 1;

    if (!pageToken) break;

}

return collected; }

export async function latestVideos(maxResults = 8) { return
cached(latest:${maxResults}, async () => { if (!config.youtubeApiKey ||
!config.youtubeChannelId) { return { configured: false, channelUrl:
config.youtubeChannelUrl, items: [], }; }

    const playlistId = await uploadsPlaylistId();

    if (!playlistId) {
      return {
        configured: true,
        channelUrl: config.youtubeChannelUrl,
        items: [],
      };
    }

    /*
     * Read older uploads without search.list so Biblical Drama can still
     * discover movies, series and episodes while using much less quota.
     */
    const data = await fetchUploadPool(playlistId, 200);

    if (data?.configured === false) return data;

    const items = (data || [])
      .map((x) => {
        const videoId =
          x.contentDetails?.videoId ||
          x.snippet?.resourceId?.videoId;

        if (!videoId) return null;

        // Keep only a short description for frontend classification.
        // This greatly reduces JSON transferred through Render.
        const description = (x.snippet?.description || '').slice(0, 600);

        return {
          videoId,
          title: x.snippet?.title || '',
          description,
          publishedAt:
            x.contentDetails?.videoPublishedAt ||
            x.snippet?.publishedAt ||
            null,
          thumbnail:
            x.snippet?.thumbnails?.high?.url ||
            x.snippet?.thumbnails?.medium?.url ||
            x.snippet?.thumbnails?.default?.url ||
            null,
          watchUrl: `https://www.youtube.com/watch?v=${videoId}`,
        };
      })
      .filter(Boolean)
      .sort(
        (a, b) =>
          new Date(b.publishedAt || 0).getTime() -
          new Date(a.publishedAt || 0).getTime()
      );

    return {
      configured: true,
      channelUrl: config.youtubeChannelUrl,
      items,
    };

}); }

export async function liveVideo() { / Keep the live-search result for 30
minutes. * The frontend may poll frequently, but the backend will not
repeatedly * call YouTube search.list during this cache window. */
return cached(‘live’, async () => { const data = await yt(‘search’, {
part: ‘snippet’, channelId: config.youtubeChannelId, eventType: ‘live’,
type: ‘video’, maxResults: ‘1’, });

    if (data.configured === false) return data;

    const x = data.items?.[0];

    return {
      configured: true,
      live: Boolean(x),
      channelUrl: config.youtubeChannelUrl,
      item: x
        ? {
            videoId: x.id.videoId,
            title: x.snippet.title,
            thumbnail: x.snippet.thumbnails?.high?.url,
            watchUrl: `https://www.youtube.com/watch?v=${x.id.videoId}`,
          }
        : null,
    };

}, 1800); }
