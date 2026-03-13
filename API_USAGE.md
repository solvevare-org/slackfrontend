# API Configuration - Usage Examples

## Setup Complete ✅

### Environment Files Created:
- `.env` - Default configuration
- `.env.development` - Development environment (https://localhost:9000)
- `.env.production` - Production environment (https://72.60.97.98:6004)

### Centralized API Configuration:
- Location: `src/config/api.ts`
- Exports: `api` (axios instance), `BACKEND_URL`

---

## How to Use

### Before (❌ Old Way):
```typescript
const token = localStorage.getItem('token');
const response = await fetch('https://localhost:9000/api/workspaces/123', {
  headers: { Authorization: `Bearer ${token}` }
});
```

### After (✅ New Way):
```typescript
import { api } from '@/config/api';

const response = await api.get('/api/workspaces/123');
```

---

## Common API Calls

### GET Request:
```typescript
import { api } from '@/config/api';

const { data } = await api.get('/api/workspaces/123');
```

### POST Request:
```typescript
import { api } from '@/config/api';

const { data } = await api.post('/api/message/upload', formData, {
  headers: { 'Content-Type': 'multipart/form-data' }
});
```

### PUT Request:
```typescript
import { api } from '@/config/api';

const { data } = await api.put('/api/message/123', { content: 'Updated' });
```

### DELETE Request:
```typescript
import { api } from '@/config/api';

await api.delete('/api/message/123');
```

---

## Socket.IO Configuration

### Before (❌):
```typescript
const socket = io('https://localhost:9000', { auth: { token } });
```

### After (✅):
```typescript
import { BACKEND_URL } from '@/config/api';

const socket = io(BACKEND_URL, { auth: { token } });
```

---

## Files to Update

Replace all instances of hardcoded URLs in:
- `src/pages/Dashboard.tsx`
- `src/pages/DirectMessage.tsx`
- `src/pages/GroupChat.tsx`
- `src/pages/massage.tsx`
- `src/components/layout/Header.tsx`

### Find and Replace:
1. `https://localhost:9000` → Use `api` instance or `BACKEND_URL`
2. `https://72.60.97.98:6004` → Use `api` instance or `BACKEND_URL`
3. `fetch(...)` → `api.get/post/put/delete(...)`

---

## Restart Steps

1. Stop the dev server (Ctrl+C)
2. Run: `npm run dev` or `vite`
3. Access: `https://72.60.97.98:6007`

For production build:
```bash
npm run build
```

---

## Benefits

✅ Single source of truth for backend URL
✅ Automatic token injection
✅ Automatic 401 handling (logout)
✅ Environment-specific configuration
✅ Cleaner, shorter code
✅ Easier to maintain
