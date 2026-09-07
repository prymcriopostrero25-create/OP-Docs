export function normalizeRole(role) {
  const value = String(role || '').trim().toLowerCase().replace(/[ _-]+/g, '')
  if (value === 'superadmin' || value === 'superadministrator') return 'super admin'
  if (value === 'admin' || value === 'administrator') return 'admin'
  return 'user'
}

export function permissionsFor(user) {
  const role = normalizeRole(user?.role)
  return { changeStatus: role !== 'user', fullAccess: role === 'super admin' }
}

export function canAccessPage(user, page) {
  return ['Overview', 'Documents'].includes(page) || permissionsFor(user).fullAccess
}
