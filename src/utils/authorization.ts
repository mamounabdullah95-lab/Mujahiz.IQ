import type { AppUser } from "../types/domain";

export type PortalRole = "buyer" | "supplier" | "admin" | "super_admin";

export function resolvePortalRole(user: AppUser | null | undefined): PortalRole | null {
  if (!user) return null;
  if (user.role === "owner") return "super_admin";
  if (user.role === "admin") return "admin";
  if (user.accountType === "buyer" || user.accountType === "supplier") return user.accountType;
  if (user.accountType == null && user.role === "contributor") return "buyer";
  return null;
}

export function portalHome(roleOrUser: PortalRole | AppUser | null | undefined) {
  const role = typeof roleOrUser === "string" ? roleOrUser : resolvePortalRole(roleOrUser);
  if (role === "buyer") return "/buyer";
  if (role === "supplier") return "/supplier";
  if (role === "admin") return "/admin";
  if (role === "super_admin") return "/super-admin";
  return "/no-access?reason=invalid-account-type";
}

export function isAdminPortalRole(role: PortalRole | null): role is "admin" | "super_admin" {
  return role === "admin" || role === "super_admin";
}

export function canAccessPortalRole(role: PortalRole | null, allowedRoles: readonly PortalRole[]) {
  return Boolean(role && allowedRoles.includes(role));
}
