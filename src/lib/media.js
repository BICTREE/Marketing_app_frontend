const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api/v1';
const API_HOST = API_BASE.replace(/\/api\/v1\/?$/, '');

export function getMediaUrl(url) {
  if (!url) return '';
  const href = typeof url === 'string' ? url : (url.url || '');
  if (!href) return '';
  if (href.startsWith('http://') || href.startsWith('https://')) return href;
  const path = href.startsWith('/') ? href : `/${href}`;
  return `${API_HOST}${path}`;
}
