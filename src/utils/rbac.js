// src/utils/rbac.js
// Permissions are now driven by app_roles table flags (fetched at login).
// This module provides a helper to derive permissions from an appRole object.

/**
 * Build a permissions object from an app_roles row.
 * Falls back to zero permissions if role not found.
 */
export function buildPermissions(appRole) {
  if (!appRole) return {
    canBroadcast: false,
    canManageUsers: false,
    canViewOrgInfo: false,
    canViewAudit: false,
    canViewAuditLogs: false,
    canManageRoles: false,
    canViewAll: false,
  }
  return {
    canBroadcast:    appRole.can_broadcast     || appRole.is_super_admin || false,
    canManageUsers:  appRole.can_manage_users   || appRole.is_super_admin || false,
    canViewOrgInfo:  appRole.can_view_org_info  || appRole.is_super_admin || false,
    canViewAudit:    appRole.can_view_audit     || appRole.is_super_admin || false,
    canViewAuditLogs:appRole.can_view_audit     || appRole.is_super_admin || false,
    canManageRoles:  appRole.is_super_admin     || false,
    canViewAll:      appRole.is_super_admin     || false,
  }
}

/**
 * can(permissions, permission) — check a single permission
 * permissions = result of buildPermissions()
 */
export function can(permissions, permission) {
  if (!permissions) return false
  return permissions[permission] ?? false
}
