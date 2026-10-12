import { APPROVAL_STEPS, ROLE_PERMISSIONS, type Permission, type Role } from './constants';

/** ¿El usuario (con estos roles) puede ejecutar el permiso? PRD §3.2. */
export function hasPermission(permission: Permission, roles: readonly Role[]): boolean {
  return roles.some((role) => ROLE_PERMISSIONS[role].includes(permission));
}

/** Pasos de aprobación según roles: el mínimo de pasos entre los roles que aprueban. */
export function approvalSteps(permission: Permission, roles: readonly Role[]): number | null {
  const steps = roles
    .map((role) => APPROVAL_STEPS[permission][role])
    .filter((s): s is number => s !== undefined);
  return steps.length ? Math.min(...steps) : null;
}
