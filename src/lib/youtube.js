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

function textOf(video) {
  return `${video?.title || ''} ${video?.description || ''}`
    .toLowerCase();
}

function hasAny(text, words) {
  return words.some((word) =>
    text.includes(word)
  );
}

function isBlockedBusinessVideo(video) {
  const text = textOf(video);

  return hasAny(text, [
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
  ]);
}

function isTestimony(video) {
  const text = textOf(video);

  return hasAny(text, [
    'testimony',
    'testimonies',
    'my testimony',
    'personal testimony',
    'christian testimony',
    'faith testimony',
    'real life testimony',
    'life testimony',
    'healing testimony',
    'miracle testimony',
    'answered prayer',
    'god answered',
    'faith story',
    'life story',
    'true story',
    'my story',
    'spiritual journey',
    'faith journey',
    'personal journey',
    'journey in christ',
    'the faith room',
    'faith room',
    "my soul's call",
    'मेरी आत्मा की पुकार',
    'गवाही'
  ]);
}

function isWorship(video) {
  const text = textOf(video);

  return hasAny(text, [
    'worship',
    'worship song',
    'christian worship',
    'praise',
    'praise song',
    'praise and worship',
    'christian music',
    'devotional song',
    'आराधना',
    'उपासना',
    'स्तुति',
    'गीत'
  ]);
}

function isBiblicalDrama(video) {
  const text = textOf(video);

  return hasAny(text, [
    // Movies
    'movie',
    'movies',
    'christian movie',
    'christian movies',
    'biblical movie',
    'biblical movies',
    'bible movie',
    'bible movies',

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

    // Series / serial / episode
    'series',
    'drama series',
    'christian series',
    'biblical series',
    'serial',
    'serials',
    'episode',
    'episodes',

    // Known Evergreen productions
    'christmas movie',
    'christmas movies',
    'timeless faith',
    'timeless faith walk',
    'when a child prays',
    'child prays',
    'child play',
    'two brothers one father',
    'two brothers, one father'
  ]);
}

function isEvergreenMinistryVideo(video) {
  if (isBlockedBusinessVideo(video)) {
    return false;
  }

  const text = textOf(video);

  return hasAny(text, [
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

    'testimony',
    'testimonies',
    'worship',
    'praise',

    'movie',
    'movies',
    'film',
    'films',
    'drama',
    'dramas',
    'series',
    'serial',
    'serials',
    'episode',
    'episodes',

    'timeless faith',
    'when a child prays',
    'two brothers one father',
    'two brothers, one father',

    'आराधना',
    'प्रार्थना',
    'परमेश्वर',
    'यीशु',
    'प्रभु',
    'मसीह',
    'गवाही',
    'गीत'
  ]);
}

function matchesCategory(video, category) {
  if (isBlockedBusinessVideo(video)) {
    return false;
  }

  switch (category) {
    case 'testimonies':
    case 'testimony':
      return isTestimony(video);

    case 'worship':
      return isWorship(video);

    case 'biblical-drama':
    case 'movies':
    case 'movie':
    case 'drama':
      return isBiblicalDrama(video);

    case 'watch-evergreen':
      return isEvergreenMinistryVideo(video);

    case 'latest':
    default:
      return isEvergreenMinistryVideo(video);
  }
}

function mapVideo(x) {
  const videoId =
    x.contentDetails?.videoId ||
    x.snippet?.resourceId?.videoId;

  if (!videoId) {
    return null;
  }

  return {
    videoId,

    title:
      x.snippet?.title || '',

    description:
      (
        x.snippet?.description ||
        ''
      ).slice(0, 1200),

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
}

export async function latestVideos(
  maxResults = 8,
  category = 'latest'
) {
  const safeLimit = Math.min(
    Math.max(
      Number(maxResults) || 8,
      1
    ),
    100
  );

  const safeCategory =
    String(category || 'latest')
      .toLowerCase();

  return cached(
    `youtube:v5:${safeCategory}:${safeLimit}`,
    async () => {
      if (
        !config.youtubeApiKey ||
        !config.youtubeChannelId
      ) {
        return {
          configured: false,
          category: safeCategory,
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
          category: safeCategory,
          channelUrl:
            config.youtubeChannelUrl,
          items: []
        };
      }

      /*
       * Fetch up to 200 uploads first.
       * Then filter by category.
       * Then apply result limit.
       *
       * This lets older testimonies and movies appear.
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
        .map(mapVideo)
        .filter(Boolean)
        .filter((video) =>
          matchesCategory(
            video,
            safeCategory
          )
        )
        .sort(
          (a, b) =>
            new Date(
              b.publishedAt || 0
            ).getTime() -
            new Date(
              a.publishedAt || 0
            ).getTime()
        )
        .slice(0, safeLimit);

      return {
        configured: true,
        category: safeCategory,
        channelUrl:
          config.youtubeChannelUrl,
        items
      };
    }
  );
}

export async function liveVideo() {
  return cached(
    'live:v2',
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
