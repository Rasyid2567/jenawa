const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api').replace(/\/$/, '');

export async function apiRequest(path, { method = 'GET', body, token } = {}) {
  const headers = { Accept: 'application/json' };
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
  if (body !== undefined && !isFormData) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : (isFormData ? body : JSON.stringify(body)),
    });
  } catch {
    throw new Error('Tidak dapat terhubung ke server. Periksa backend dan alamat API.');
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const validation = Array.isArray(payload.errors)
      ? payload.errors.map((item) => `${item.field}: ${item.message}`).join('; ')
      : '';
    throw new Error(validation || payload.message || `Permintaan gagal (${response.status}).`);
  }
  return payload;
}

export const authApi = {
  register: (form) => apiRequest('/auth/register', { method: 'POST', body: form }),
  login: (form) => apiRequest('/auth/login', { method: 'POST', body: form }),
  me: (token) => apiRequest('/auth/me', { token }),
  logout: (token) => apiRequest('/auth/logout', { method: 'POST', token }),
};

export const emotionsApi = {
  categories: (token) => apiRequest('/emotions/categories', { token }),
  triggers: (token) => apiRequest('/emotions/triggers', { token }),
  create: (form, token) => apiRequest('/emotions', { method: 'POST', body: form, token }),
  list: (token, params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiRequest(`/emotions${query ? `?${query}` : ''}`, { token });
  },
};

export const journalsApi = {
  create: (form, token) => apiRequest('/journals', { method: 'POST', body: form, token }),
  list: (token, params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiRequest(`/journals${query ? `?${query}` : ''}`, { token });
  },
  detail: (id, token) => apiRequest(`/journals/${id}`, { token }),
  update: (id, form, token) => apiRequest(`/journals/${id}`, { method: 'PATCH', body: form, token }),
  remove: (id, token) => apiRequest(`/journals/${id}`, { method: 'DELETE', token }),
};

export const sessionsApi = {
  create: (form, token) => apiRequest('/sessions', { method: 'POST', body: form, token }),
  list: (token, params = {}) => {
    const query = new URLSearchParams(params).toString();
    return apiRequest(`/sessions${query ? `?${query}` : ''}`, { token });
  },
};


const API_ORIGIN = API_BASE.replace(/\/api\/?$/, '');

export function profileAssetUrl(path) {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_ORIGIN}${String(path).startsWith('/') ? '' : '/'}${path}`;
}

export const profileApi = {
  get: (token) => apiRequest('/profile', { token }),
  update: (form, token) => apiRequest('/profile', { method: 'PATCH', body: form, token }),
  uploadPhoto: (file, token) => {
    const body = new FormData();
    body.append('photo', file);
    return apiRequest('/profile/photo', { method: 'POST', body, token });
  },
  removePhoto: (token) => apiRequest('/profile/photo', { method: 'DELETE', token }),
};
