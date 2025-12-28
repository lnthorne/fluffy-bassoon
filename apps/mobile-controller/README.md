# Party Jukebox Mobile Controller

A mobile-first React web application that allows party guests to search for music and add tracks to the shared queue.

## Features

- **Mobile-First Design**: Optimized for touch interfaces and small screens
- **Music Search**: Search YouTube for tracks to add to the queue
- **Real-time Updates**: Live queue updates via WebSocket connection
- **Session Persistence**: Remember user nickname and preferences
- **Rate Limiting**: Respect server rate limits with visual feedback
- **Responsive Design**: Works in portrait and landscape orientations

## Development

### Prerequisites

- Node.js 18+ (see `.nvmrc` in project root)
- npm 8+

### Getting Started

```bash
# Install dependencies (from project root)
npm install

# Start development server
npm run dev:mobile-controller

# Or from this directory
cd apps/mobile-controller
npm run dev
```

The development server will start at `http://localhost:5173` with API proxy configured to connect to the Party Jukebox server at `http://localhost:3000`.

### Building

```bash
# Build for production
npm run build

# Clean build
npm run build:clean
```

Built files are output to `../server/dist/mobile-controller` for serving by the Party Jukebox server.

### Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run property-based tests only
npm run test:pbt
```

## Architecture

The mobile controller follows a clean architecture with:

- **Components**: React UI components optimized for mobile
- **Services**: API communication, WebSocket handling, local storage
- **Contexts**: React context providers for state management
- **Types**: TypeScript type definitions

### Key Services

- **APIService**: HTTP communication with server APIs
- **WebSocketService**: Real-time updates via WebSocket
- **StorageService**: Session persistence in localStorage
- **DeviceIdentityService**: Unique device ID generation

### Mobile Optimizations

- Touch-friendly interface with large tap targets (44px minimum)
- Responsive design for various screen sizes
- Safe area support for notched devices
- Optimized for party lighting conditions (dark theme)
- Minimal scrolling for core functionality

## Integration

The mobile controller integrates with the Party Jukebox server:

- **REST API**: Search, queue operations, rate limiting
- **WebSocket**: Real-time queue and playback updates
- **Static Serving**: Built files served by server at root path (`/`)

## Browser Support

- Modern mobile browsers (iOS Safari, Chrome, Firefox)
- Progressive Web App features for mobile optimization
- Graceful degradation for older browsers