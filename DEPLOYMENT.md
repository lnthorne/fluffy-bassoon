# Party Jukebox Deployment Guide

## Build Process

The Party Jukebox uses a monorepo structure with three main applications:

1. **Mobile Controller** (`apps/mobile-controller`) - React app for party guests
2. **TV Display UI** (`apps/tv-ui`) - React app for TV display
3. **Server** (`apps/server`) - Node.js backend with API and WebSocket support

### Build Commands

```bash
# Build all applications
npm run build:all

# Build individual applications
npm run build:mobile-controller
npm run build:tv-ui
npm run build:server

# Production build
npm run build:production
```

### Build Output

- Mobile Controller builds to: `apps/server/dist/mobile-controller/`
- TV Display UI builds to: `apps/server/dist/tv-ui/`
- Server builds to: `apps/server/dist/`

## Server Configuration

The server serves both React applications:

- **Mobile Controller**: Served at root path (`/`)
- **TV Display UI**: Served at `/display`
- **API Endpoints**: Available under `/api/` prefix
- **WebSocket**: Available at `/ws`

### Static File Serving

- Mobile Controller assets are served directly from the root path
- TV Display UI assets are served under `/display/` prefix
- Both applications support SPA routing
- API routes are protected and don't conflict with static serving

### Development

```bash
# Start development server
npm run dev:server

# Start individual development servers
npm run dev:mobile-controller  # Port 5173
npm run dev:tv-ui              # Port 5174
```

### Production Deployment

1. Build all applications: `npm run build:all`
2. Set environment variables (see `apps/server/.env`)
3. Start the server: `node apps/server/dist/main.js`

The server will serve both React applications and provide all backend functionality.

## Network Access

- Server binds to `0.0.0.0:3000` for local network access
- Accessible via `jukebox.local:3000` (mDNS)
- Mobile Controller: `http://jukebox.local:3000/`
- TV Display: `http://jukebox.local:3000/display`
- API: `http://jukebox.local:3000/api/`

## Requirements

- Node.js 18+
- YouTube Data API v3 key (set in `YOUTUBE_API_KEY` environment variable)
- External dependencies: `yt-dlp`, `mpv` (for playback functionality)