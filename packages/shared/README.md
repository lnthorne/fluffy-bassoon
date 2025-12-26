# @jukebox/shared

Shared types and domain logic for the Party Jukebox Queue Management system.

## Overview

This package contains the core domain entities, validation logic, and error handling for the Queue Management system. It provides a clean interface between the domain logic and infrastructure concerns, following clean architecture principles.

## Core Types

### Domain Entities

- **Track**: Music item with metadata (title, artist, sourceUrl, duration)
- **User**: Party guest with ID and nickname
- **QueueItem**: Track in queue with user context and timestamp
- **QueueState**: Complete queue state representation

### Validation

All domain entities include validation logic:

```typescript
import { TrackValidator, UserValidator, QueueItemValidator } from '@jukebox/shared';

// Create and validate a track
const trackResult = TrackValidator.create({
  title: 'My Song',
  artist: 'My Artist', 
  sourceUrl: 'https://youtube.com/watch?v=dQw4w9WgXcQ',
  duration: 180
});

if (trackResult.success) {
  console.log('Track created:', trackResult.value);
} else {
  console.error('Validation failed:', trackResult.error);
}
```

### Error Handling

Comprehensive error types with descriptive messages:

```typescript
import { ErrorFactory } from '@jukebox/shared';

const errorDetails = ErrorFactory.createTrackError('INVALID_TITLE', { 
  providedTitle: '' 
});
console.log(errorDetails.message); // "Track title must be a non-empty string"
```

## Testing

The package includes comprehensive tests using Jest and fast-check for property-based testing:

```bash
npm test              # Run all tests
npm run test:watch    # Run tests in watch mode
npm run test:pbt      # Run only property-based tests
```

## Building

```bash
npm run build         # Compile TypeScript to dist/
```

## Requirements Validation

This package validates the following requirements:

- **1.1**: Track creation with required metadata
- **1.3**: YouTube URL format validation  
- **1.4**: Non-empty string validation for title and artist
- **2.1**: Queue item creation with track and user information
- **2.5**: Timestamp recording for queue items
- **6.3**: User validation with non-empty identifiers