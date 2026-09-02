# Evergreen Strong Backend v2

Production-oriented Node.js API for Evergreen Bible Teaching and Command Global Believers Ministry.

## Stack
- Node.js 20+ / Express 5
- PostgreSQL
- JWT admin authentication
- Zod validation
- Helmet security headers
- CORS
- Rate limiting
- YouTube Data API v3 with in-memory cache
- Docker

## Windows quick start

1. Extract this folder.
2. Open Command Prompt inside it.
3. Create your private environment file:

   copy .env.example .env

4. Edit `.env`. Keep `YOUTUBE_API_KEY` private. Set the CareForMix `YOUTUBE_CHANNEL_ID`.
5. Install packages:

   npm install

### Test YouTube without PostgreSQL
You can immediately run:

   npm run dev

Open:
- http://localhost:4100/
- http://localhost:4100/api/health
- http://localhost:4100/api/youtube/latest
- http://localhost:4100/api/youtube/live

### Enable database features
Run PostgreSQL locally or with Docker Desktop:

   docker compose up -d db
   npm run db:init
   npm run dev

## Public API
GET /api/health
GET /api/youtube/latest
GET /api/youtube/live
GET /api/teachings
GET /api/events
GET /api/testimonies
POST /api/prayer-requests
POST /api/contact
POST /api/volunteer-applications

## Admin API
POST /api/admin/login
GET /api/admin/submissions
POST /api/admin/teachings
POST /api/admin/events

Admin endpoints use:
Authorization: Bearer <JWT>

## Important
Never put `.env`, `YOUTUBE_API_KEY`, database passwords, or `JWT_SECRET` in the frontend or Git repository.
For production, use a managed PostgreSQL database and hosting environment variables.
