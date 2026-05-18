// Centralized API Configuration
// In development: Vite proxy handles /api -> localhost:3001
// In production: Backend serves both static files and API on same port

// Always use relative paths - the Vite proxy (dev) or same-origin (prod) handles routing
export const API_URL = '';

// For Discord OAuth login, we need the actual backend URL since it's a redirect (not an API call)
// In dev: Vite dev server proxy won't help with redirects, so use current hostname + port 3001
// In prod: Backend serves frontend, so same origin works
export const getBackendUrl = (): string => {
  // If we're in development (Vite dev server on port 5173), redirect to backend on 3001
  if (window.location.port === '5173' || window.location.port === '5174') {
    return `${window.location.protocol}//${window.location.hostname}:3001`;
  }
  // In production, backend and frontend are on same origin
  return `${window.location.protocol}//${window.location.host}`;
};
