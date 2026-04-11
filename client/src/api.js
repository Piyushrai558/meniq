const API_BASE = '/api';

function getToken() {
  return localStorage.getItem('menuqr_token') || '';
}

function setToken(token) {
  localStorage.setItem('menuqr_token', token);
}

function clearToken() {
  localStorage.removeItem('menuqr_token');
}

async function api(method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(`${API_BASE}${path}`, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export { api, getToken, setToken, clearToken };
