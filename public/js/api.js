/* global API client */
const BASE = '/api';

async function request(method, path, body = null, isFormData = false) {
  const token = localStorage.getItem('token');
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (body && !isFormData) headers['Content-Type'] = 'application/json';

  const opts = { method, headers };
  if (body) opts.body = isFormData ? body : JSON.stringify(body);

  const res = await fetch(`${BASE}${path}`, opts);
  const data = await res.json().catch(() => ({}));

  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

const api = {
  // Auth
  register: (body) => request('POST', '/auth/register', body),
  login:    (body) => request('POST', '/auth/login', body),
  me:       ()     => request('GET', '/auth/me'),
  updateProfile: (body) => request('PUT', '/auth/profile', body),
  changePassword: (body) => request('PUT', '/auth/password', body),

  // Notes
  getNotes:  (params = {}) => request('GET', `/notes?${new URLSearchParams(params)}`),
  getNote:   (id)          => request('GET', `/notes/${id}`),
  uploadNote:(form)        => request('POST', '/notes', form, true),
  updateNote:(id, body)    => request('PUT', `/notes/${id}`, body),
  deleteNote:(id)          => request('DELETE', `/notes/${id}`),
  flagNote:  (id, reason)  => request('POST', `/notes/${id}/flag`, { reason }),
  getStats:  ()            => request('GET', '/notes/stats'),
  getSubjects: ()          => request('GET', '/notes/subjects'),

  // Users
  getUser:      (id) => request('GET', `/users/${id}`),
  getUserNotes: (id, params = {}) => request('GET', `/users/${id}/notes?${new URLSearchParams(params)}`),
  getMyDownloads: () => request('GET', '/users/me/downloads'),

  // Ratings
  getRatings:    (noteId, params = {}) => request('GET', `/ratings/notes/${noteId}?${new URLSearchParams(params)}`),
  submitRating:  (noteId, body)        => request('POST', `/ratings/notes/${noteId}`, body),
  deleteRating:  (noteId)              => request('DELETE', `/ratings/notes/${noteId}`),

  // Collections
  getCollections:       ()           => request('GET', '/collections'),
  createCollection:     (body)       => request('POST', '/collections', body),
  updateCollection:     (id, body)   => request('PUT', `/collections/${id}`, body),
  deleteCollection:     (id)         => request('DELETE', `/collections/${id}`),
  getCollectionNotes:   (id)         => request('GET', `/collections/${id}/notes`),
  addToCollection:      (id, noteId) => request('POST', `/collections/${id}/notes`, { noteId }),
  removeFromCollection: (id, noteId) => request('DELETE', `/collections/${id}/notes/${noteId}`),
  bookmark:             (noteId)     => request('POST', `/collections/bookmark/${noteId}`),

  // Admin
  adminStats:      ()           => request('GET', '/admin/stats'),
  adminUsers:      (params = {})=> request('GET', `/admin/users?${new URLSearchParams(params)}`),
  adminNotes:      (params = {})=> request('GET', `/admin/notes?${new URLSearchParams(params)}`),
  adminDeleteUser: (id)         => request('DELETE', `/admin/users/${id}`),
  adminDeleteNote: (id)         => request('DELETE', `/admin/notes/${id}`),
  adminUnflagNote: (id)         => request('PUT', `/admin/notes/${id}/unflag`),
  adminSetRole:    (id, role)   => request('PUT', `/admin/users/${id}/role`, { role }),
};

window.api = api;
