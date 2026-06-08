/**
 * Read/write auth in localStorage with sessionStorage fallback.
 * Helps when browser tracking prevention blocks localStorage (e.g. Edge strict mode).
 */

export function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const t = localStorage.getItem('lms-token');
    if (t) return t;
  } catch {
    /* storage blocked */
  }
  try {
    return sessionStorage.getItem('lms-token');
  } catch {
    return null;
  }
}

export function getStoredUserJson(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const u = localStorage.getItem('lms-user');
    if (u) return u;
  } catch {
    /* storage blocked */
  }
  try {
    return sessionStorage.getItem('lms-user');
  } catch {
    return null;
  }
}

export function persistLoginCredentials(token: string, userJson: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem('lms-token', token);
    localStorage.setItem('lms-user', userJson);
  } catch {
    /* localStorage may be blocked */
  }
  try {
    sessionStorage.setItem('lms-token', token);
    sessionStorage.setItem('lms-user', userJson);
  } catch {
    /* sessionStorage may be blocked */
  }
}

export function clearAuthStorage(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem('lms-token');
    localStorage.removeItem('lms-user');
  } catch {
    /* ignore */
  }
  try {
    sessionStorage.removeItem('lms-token');
    sessionStorage.removeItem('lms-user');
  } catch {
    /* ignore */
  }
}

/** After JWT refresh — same token in both storages when possible. */
export function persistTokenAfterRefresh(token: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem('lms-token', token);
  } catch {
    /* ignore */
  }
  try {
    sessionStorage.setItem('lms-token', token);
  } catch {
    /* ignore */
  }
}
