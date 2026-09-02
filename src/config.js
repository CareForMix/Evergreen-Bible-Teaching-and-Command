import 'dotenv/config';

const bool = (v) => String(v).toLowerCase() === 'true';

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 4100),
  frontendOrigin: process.env.FRONTEND_ORIGIN || 'http://localhost:3000',
  databaseUrl: process.env.DATABASE_URL || '',
  databaseSsl: bool(process.env.DATABASE_SSL),
  jwtSecret: process.env.JWT_SECRET || 'development-only-change-me',
  adminEmail: process.env.ADMIN_EMAIL || '',
  adminPassword: process.env.ADMIN_PASSWORD || '',
  youtubeApiKey: process.env.YOUTUBE_API_KEY || '',
  youtubeChannelId: process.env.YOUTUBE_CHANNEL_ID || '',
  youtubeChannelUrl: process.env.YOUTUBE_CHANNEL_URL || 'https://www.youtube.com/@CareForMix',
  youtubeCacheSeconds: Number(process.env.YOUTUBE_CACHE_SECONDS || 300)
};

if (config.env === 'production' && config.jwtSecret.length < 32) {
  throw new Error('JWT_SECRET must be at least 32 characters in production.');
}
