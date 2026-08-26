export const APP_ROLES = ['admin'] as const;

export type AppRole = (typeof APP_ROLES)[number];

export type SessionUser = {
  userId: string;
  username: string;
  role: string;
};

export function normalizeRole(role: string | null | undefined): AppRole | null {
  if (!role) return null;

  const normalized = role.toLowerCase();
  return APP_ROLES.includes(normalized as AppRole) ? (normalized as AppRole) : null;
}

export function hasRoleAccess(role: string | null | undefined, allowedRoles: readonly AppRole[]) {
  const normalizedRole = normalizeRole(role);
  return normalizedRole ? allowedRoles.includes(normalizedRole) : false;
}

export function getRequiredRolesForAppPath(pathname: string): readonly AppRole[] | null {
  if (pathname.startsWith('/app/users')) return ['admin'];
  if (pathname.startsWith('/app/settings')) return ['admin'];
  if (pathname.startsWith('/app/history')) return ['admin'];
  if (pathname.startsWith('/app/generator')) return ['admin'];
  if (pathname.startsWith('/app/verify')) return ['admin'];
  if (pathname.startsWith('/app/dashboard')) return ['admin'];
  if (pathname === '/app') return ['admin'];
  return null;
}

export function getRequiredRolesForApiPath(pathname: string, method: string): readonly AppRole[] | null {
  if (pathname === '/api/users' && method === 'GET') return ['admin'];
  if (pathname === '/api/users' && method === 'POST') return ['admin'];
  if (pathname.startsWith('/api/users/')) return ['admin'];

  if (pathname === '/api/patterns' && method === 'GET') return null;
  if (pathname.endsWith('/image') && method === 'GET') return null;

  if (pathname === '/api/patterns' && method === 'POST') return ['admin'];
  if (pathname === '/api/patterns/batch') return ['admin'];
  if (pathname === '/api/patterns/next-index') return ['admin'];
  if (pathname.startsWith('/api/patterns/')) return ['admin'];

  return null;
}