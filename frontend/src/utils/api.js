/**
 * api.js — Centralized API helper for Super Gelatto frontend.
 *
 * Automatically attaches the Authorization: Bearer <token> header to every
 * request. On 401 responses it clears the session and redirects to /login,
 * preventing stale/expired tokens from leaving the user in a broken state.
 */

const BASE_URL = import.meta.env.VITE_API_URL || '';

/**
 * Retrieve the stored JWT token from sessionStorage.
 */
export function getToken() {
  return localStorage.getItem('superGelatto_token') || sessionStorage.getItem('superGelatto_token') || null;
}

/**
 * Persist the JWT token returned by the backend.
 */
export function setToken(token) {
  if (token) {
    localStorage.setItem('superGelatto_token', token);
    sessionStorage.setItem('superGelatto_token', token);
  }
}

/**
 * Remove session data (token + user) and redirect to the login page.
 * Called automatically on 401 responses.
 */
export function clearSessionAndRedirect() {
  localStorage.removeItem('superGelatto_token');
  localStorage.removeItem('superGelatto_user');
  sessionStorage.removeItem('superGelatto_token');
  sessionStorage.removeItem('superGelatto_user');
  // Use window.location so it works outside React component tree too
  window.location.href = '/login';
}

/**
 * Drop-in replacement for fetch() that:
 *  - Prepends BASE_URL to relative paths
 *  - Adds `Content-Type: application/json` by default
 *  - Attaches `Authorization: Bearer <token>` when a token exists
 *  - Calls clearSessionAndRedirect() on 401 responses
 *
 * @param {string} path  - API path (e.g. '/api/admin/dashboard')
 * @param {RequestInit} options - Standard fetch options
 * @returns {Promise<Response>}
 */
export async function apiFetch(path, options = {}) {
  const token = getToken();
  const savedUser = localStorage.getItem('superGelatto_user') || sessionStorage.getItem('superGelatto_user');
  let userRole = null;
  try {
    if (savedUser) {
      const parsed = JSON.parse(savedUser);
      userRole = parsed?.rol;
    }
  } catch (e) {}

  const headers = {
    'Content-Type': 'application/json',
    ...(userRole ? { 'x-user-role': userRole } : {}),
    ...(options.headers || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    clearSessionAndRedirect();
    // Return the response anyway so callers can inspect it if needed
  }

  return response;
}
