// MIGRATION EXAMPLE - Dashboard.tsx

// ❌ OLD CODE (Before):
import { BACKEND_URL } from '@/config/api';

fetch(`${BACKEND_URL}/api/workspaces/${currentWs.id}`, {
  headers: { Authorization: `Bearer ${token}` },
})
  .then((r) => r.json())
  .then((d) => {
    // handle response
  });

// ✅ NEW CODE (After):
import { api } from '@/config/api';

api.get(`/api/workspaces/${currentWs.id}`)
  .then(({ data }) => {
    // handle response - data is already parsed JSON
  })
  .catch((error) => {
    // error handling
  });

// OR with async/await:
try {
  const { data } = await api.get(`/api/workspaces/${currentWs.id}`);
  // handle data
} catch (error) {
  // handle error
}

// ===================================

// ❌ OLD CODE - File Upload:
const fd = new FormData();
fd.append("file", file);
fd.append("to", activeChat.id);

const res = await fetch(`${BACKEND_URL}/api/message/upload`, {
  method: "POST",
  body: fd,
  headers: { Authorization: `Bearer ${token}` },
});

// ✅ NEW CODE - File Upload:
const fd = new FormData();
fd.append("file", file);
fd.append("to", activeChat.id);

const { data } = await api.post('/api/message/upload', fd, {
  headers: { 'Content-Type': 'multipart/form-data' }
});

// ===================================

// ❌ OLD CODE - DELETE:
const endpoint = `${BACKEND_URL}/api/message/${id}`;
await fetch(endpoint, { 
  method: 'DELETE', 
  headers: { Authorization: `Bearer ${token}` } 
});

// ✅ NEW CODE - DELETE:
await api.delete(`/api/message/${id}`);

// ===================================

// ❌ OLD CODE - PUT:
const endpoint = `${BACKEND_URL}/api/message/${id}`;
const res = await fetch(endpoint, { 
  method: 'PUT', 
  headers: { 
    'Content-Type': 'application/json', 
    Authorization: `Bearer ${token}` 
  }, 
  body: JSON.stringify({ content: editingText }) 
});

// ✅ NEW CODE - PUT:
const { data } = await api.put(`/api/message/${id}`, { 
  content: editingText 
});
