import axios from 'axios';

export const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('tf_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('tf_token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

// Auth
export const authApi = {
  register: (data: { email: string; name: string; password: string }) =>
    api.post('/auth/register', data).then((r) => r.data),
  login: (data: { email: string; password: string }) =>
    api.post('/auth/login', data).then((r) => r.data),
  me: () => api.get('/auth/me').then((r) => r.data),
};

// Boards
export const boardsApi = {
  list: () => api.get('/boards').then((r) => r.data),
  create: (data: { name: string; description?: string; color?: string; icon?: string }) =>
    api.post('/boards', data).then((r) => r.data),
  get: (id: string) => api.get(`/boards/${id}`).then((r) => r.data),
  update: (id: string, data: Partial<{ name: string; description: string; color: string; icon: string }>) =>
    api.put(`/boards/${id}`, data).then((r) => r.data),
  delete: (id: string) => api.delete(`/boards/${id}`).then((r) => r.data),
};

// Groups
export const groupsApi = {
  list: (boardId: string) => api.get(`/boards/${boardId}/groups`).then((r) => r.data),
  create: (boardId: string, data: { name: string; color?: string }) =>
    api.post(`/boards/${boardId}/groups`, data).then((r) => r.data),
  update: (boardId: string, id: string, data: Partial<{ name: string; color: string }>) =>
    api.put(`/boards/${boardId}/groups/${id}`, data).then((r) => r.data),
  delete: (boardId: string, id: string) =>
    api.delete(`/boards/${boardId}/groups/${id}`).then((r) => r.data),
};

// Items
export const itemsApi = {
  list: (boardId: string, groupId?: string) =>
    api.get(`/boards/${boardId}/items${groupId ? `?group_id=${groupId}` : ''}`).then((r) => r.data),
  create: (boardId: string, data: { name: string; group_id: string }) =>
    api.post(`/boards/${boardId}/items`, data).then((r) => r.data),
  update: (boardId: string, id: string, data: Partial<{ name: string; group_id: string }>) =>
    api.put(`/boards/${boardId}/items/${id}`, data).then((r) => r.data),
  setValue: (boardId: string, id: string, data: { column_id: string; value: string }) =>
    api.put(`/boards/${boardId}/items/${id}/values`, data).then((r) => r.data),
  delete: (boardId: string, id: string) =>
    api.delete(`/boards/${boardId}/items/${id}`).then((r) => r.data),
  comments: (boardId: string, id: string) =>
    api.get(`/boards/${boardId}/items/${id}/comments`).then((r) => r.data),
  addComment: (boardId: string, id: string, text: string) =>
    api.post(`/boards/${boardId}/items/${id}/comments`, { text }).then((r) => r.data),
};

// Columns
export const columnsApi = {
  list: (boardId: string) => api.get(`/boards/${boardId}/columns`).then((r) => r.data),
  create: (boardId: string, data: { name: string; type: string }) =>
    api.post(`/boards/${boardId}/columns`, data).then((r) => r.data),
  update: (boardId: string, id: string, data: Partial<{ name: string }>) =>
    api.put(`/boards/${boardId}/columns/${id}`, data).then((r) => r.data),
  delete: (boardId: string, id: string) =>
    api.delete(`/boards/${boardId}/columns/${id}`).then((r) => r.data),
};
