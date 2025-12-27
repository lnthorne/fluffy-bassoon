# TV UI Build Configuration

## Overview

The TV Display Interface is built using Vite and React, configured to output static assets that are served by the Party Jukebox server.

## Build Process

### Development
```bash
# Start development server with hot reload
npm run dev

# Run tests
npm run test
npm run test:watch
```

### Production Build
```bash
# Build for production
npm run build

# Build with clean (removes previous build)
npm run build:clean

# Production optimized build
npm run build:prod
```

## Build Configuration

### Output Directory
- **Development**: `dist/` (local development)
- **Production**: `../server/dist/tv-ui/` (served by server)

### Server Integration
- Built assets are served at `/display/` route
- Static files served by `@fastify/static` plugin
- Fallback to placeholder page if build not available

### Asset Optimization
- **Minification**: esbuild (fast, reliable)
- **Code Splitting**: Disabled for simplicity
- **Source Maps**: Disabled in production
- **Target**: ES2015 for broad compatibility

### Development Proxy
- API calls proxied to `http://localhost:3000/api`
- WebSocket connections proxied to `ws://localhost:3000/ws`

## File Structure

```
apps/tv-ui/
├── src/                    # Source code
├── dist/                   # Development build output
├── ../server/dist/tv-ui/   # Production build output (served by server)
├── vite.config.ts          # Build configuration
├── package.json            # Dependencies and scripts
└── BUILD.md               # This file
```

## Integration with Server

The server automatically serves the built TV UI:

1. **Static Files**: Served from `/display/` prefix
2. **Index Route**: `/display` serves `index.html`
3. **Fallback**: Placeholder page if build not available
4. **Assets**: CSS, JS, and other assets served with cache headers

## Build Scripts (Root Level)

From the project root:

```bash
# Build TV UI only
npm run build:tv-ui

# Build server only  
npm run build:server

# Build everything
npm run build:all

# Development servers
npm run dev:tv-ui
npm run dev:server
```

## Deployment Notes

1. **Build Order**: TV UI must be built before server starts
2. **Static Assets**: Automatically served by server
3. **Cache Headers**: Configured for optimal performance
4. **Error Handling**: Graceful fallback to placeholder page
5. **Hot Reload**: Available in development mode only