import { config } from '../config.js';

let cache = new Map();

async function yt(endpoint, params) {
  if (!config.youtubeApiKey || !config.youtubeChannelId) {
    return {
      configured: false,
      channelUrl: config.youtubeChannelUrl,
      items: []
    };
  }

  const qs = new URLSearchParams({
    ...params,
    key: config.youtubeApiKey
  });

  const url =
    `https://www.googleapis.com/youtube/v3/${endpoint}?${qs}`;

  const res = await fetch(url);
  const data = await res.json();

  if (!res.ok) {
    const message =
      data?.error?.message ||
      `YouTube API error ${res.status}`;

    throw Object.assign(
      new Error(message),
      { status: 502 }
    );
  }

  return data;
}

async function cached(
  key,
  fn,
  ttlSeconds = config.youtubeCacheSeconds
) {
  const now = Date.now();
  const hit = cache.get(key);

  if (hit && hit.expires > now) {
    return hit.value;
  }

  const value = await fn();

  cache.set(key, {
    value,
    expires: now + ttlSeconds * 1000
  });

  return value;
}

async function uploadsPlaylistId() {
  const data = await yt('channels', {
    part: 'contentDetails',
    id: config.youtubeChannelId,
    maxResults: '1'
  });

  if (data.configured === false) {
    return null;
  }

  return (
    data.items?.[0]
      ?.contentDetails
      ?.relatedPlaylists
      ?.uploads || null
  );
}

async function fetchUploadPool(
  playlistId,
  wanted = 200
) {
  const collected = [];
  let pageToken = '';
  let safetyPages = 0;

  while (
    collected.length < wanted &&
    safetyPages < 10
  ) {
    const params = {
      part: 'snippet,contentDetails',
      playlistId,
      maxResults: '50'
    };

    if (pageToken) {
      params.pageToken = pageToken;
    }

    const data = await yt(
      'playlistItems',
      params
    );

    if (data.configured === false) {
      return data;
    }

    collected.push(...(data.items || []));

    pageToken =
      data.nextPageToken || '';

    safetyPages += 1;

    if (!pageToken) {
      break;
    }
  }

  return collected;
}

function isEvergreenMinistryVideo(video) {
  const text = `${video?.title || ''} ${video?.description || ''}`
    .toLowerCase();

  /*
   * Block CareForMix / business / promotional content.
   * These videos may exist on the same YouTube channel,
   * but they should not appear on Evergreen ministry feeds.
   */
  const blocked = [
    'careformix',
    'care for mix',
    'careformix media',
    'careformix media ltd',
    'premium digital marketing',
    'digital marketing',
    'marketing service',
    'social media marketing',
    'build your brand',
    'grow with careformix',
    'business promotion',
    'advertisement',
    'advertising',
    'promotional video',
    'promo video',
    'website development',
    'web development',
    'branding service',
    'client project',
    'portfolio'
  ];

  if (
    blocked.some(
      (word) => text.includes(word)
    )
  ) {
    return false;
  }

  /*
   * Evergreen ministry / Christian content.
   * This allows worship, prayer, testimony,
   * sermons, teaching, films, dramas and related
   * faith-based videos.
   */
 const ministry = [
  // Evergreen / Bible / Ministry
  'evergreen',
  'bible',
  'biblical',
  'jesus',
  'christ',
  'christian',
  'god',
  'lord',
  'father',
  'holy spirit',
  'holy ghost',
  'gospel',
  'scripture',
  'prayer',
  'pray',
  'sermon',
  'sunday message',
  'sunday bible message',
  'word of god',
  'bible teaching',
  'biblical teaching',
  'faith',
  'faith journey',
  'spiritual journey',
  'church',
  'ministry',
  'salvation',
  'revelation',
  'heaven',
  'kingdom of god',

  // Testimony
  'testimony',
  'testimonies',
  'my testimony',
  'personal testimony',
  'christian testimony',
  'faith testimony',
  'healing testimony',
  'miracle testimony',
  'answered prayer',
  'faith story',
  'life story',

  // Worship / Praise / Music
  'worship',
  'worship song',
  'christian worship',
  'praise',
  'praise song',
  'christian music',
  'devotional song',

  // Movies
  'movie',
  'movies',
  'christian movie',
  'christian movies',
  'biblical movie',
  'biblical movies',
  'bible movie',
  'bible movies',
  'christmas movie',
  'christmas movies',

  // Films
  'film',
  'films',
  'christian film',
  'christian films',
  'biblical film',
  'biblical films',
  'short film',
  'short films',
  'feature film',
  'feature films',

  // Drama
  'drama',
  'dramas',
  'christian drama',
  'biblical drama',
  'bible drama',
  'faith-based drama',
  'faith based drama',
  'family drama',
  'parable drama',

  // Series / Serial / Episodes
  'series',
  'drama series',
  'christian series',
  'biblical series',
  'serial',
  'serials',
  'episode',
  'episodes',

  // Known Evergreen productions
  'timeless faith',
  'when a child prays',
  'child prays',
  'two brothers one father',
  'two brothers, one father',

  // Hindi
  'आराधना',
  'प्रार्थना',
  'परमेश्वर',
  'यीशु',
  'प्रभु',
  'मसीह',
  'गवाही',
  'गीत'
];
  return ministry.some(
    (word) => text.includes(word)
  );
}

export async function latestVideos(
  maxResults = 8
) {
  return cached(
    `latest:ministry-v2:${maxResults}`,
    async () => {
      if (
        !config.youtubeApiKey ||
        !config.youtubeChannelId
      ) {
        return {
          configured: false,
          channelUrl:
            config.youtubeChannelUrl,
          items: []
        };
      }

      const playlistId =
        await uploadsPlaylistId();

      if (!playlistId) {
        return {
          configured: true,
          channelUrl:
            config.youtubeChannelUrl,
          items: []
        };
      }

      /*
       * Uses uploads playlist rather than search.list,
       * which helps reduce YouTube quota usage.
       */
      const data =
        await fetchUploadPool(
          playlistId,
          200
        );

      if (data?.configured === false) {
        return data;
      }

      const items = (data || [])
        .map((x) => {
          const videoId =
            x.contentDetails?.videoId ||
            x.snippet?.resourceId?.videoId;

          if (!videoId) {
            return null;
          }

          const description =
            (
              x.snippet?.description ||
              ''
            ).slice(0, 600);

          return {
            videoId,

            title:
              x.snippet?.title || '',

            description,

            publishedAt:
              x.contentDetails
                ?.videoPublishedAt ||
              x.snippet?.publishedAt ||
              null,

            thumbnail:
              x.snippet
                ?.thumbnails
                ?.high?.url ||
              x.snippet
                ?.thumbnails
                ?.medium?.url ||
              x.snippet
                ?.thumbnails
                ?.default?.url ||
              null,

            watchUrl:
              `https://www.youtube.com/watch?v=${videoId}`
          };
        })
        .filter(Boolean)
        .filter(isEvergreenMinistryVideo)
        .sort(
          (a, b) =>
            new Date(
              b.publishedAt || 0
            ).getTime() -
            new Date(
              a.publishedAt || 0
            ).getTime()
        )
        .slice(0, maxResults);

      return {
        configured: true,
        channelUrl:
          config.youtubeChannelUrl,
        items
      };
    }
  );
}

export async function liveVideo() {
  /*
   * Cache live lookup for 30 minutes
   * to reduce YouTube search quota usage.
   */
  return cached(
    'live',
    async () => {
      const data = await yt(
        'search',
        {
          part: 'snippet',
          channelId:
            config.youtubeChannelId,
          eventType: 'live',
          type: 'video',
          maxResults: '1'
        }
      );

      if (data.configured === false) {
        return data;
      }

      const x = data.items?.[0];

      return {
        configured: true,
        live: Boolean(x),
        channelUrl:
          config.youtubeChannelUrl,

        item: x
          ? {
              videoId:
                x.id.videoId,

              title:
                x.snippet.title,

              thumbnail:
                x.snippet
                  .thumbnails
                  ?.high?.url,

              watchUrl:
                `https://www.youtube.com/watch?v=${x.id.videoId}`
            }
          : null
      };
    },
    1800
  );
}
