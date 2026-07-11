import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { canAccessPortalRole, portalHome, resolvePortalRole, type PortalRole } from "../utils/authorization";
import { AuthLoadingScreen } from "./AuthLoadingScreen";

export function RoleProtectedRoute({
  allowedRoles,
  requireAccess = false,
  allowPending = false,
}: {
  allowedRoles?: readonly PortalRole[];
  requireAccess?: boolean;
  allowPending?: boolean;
}) {
  const { firebaseUser, appUser, loading, hasActiveAccess } = useAuth();
  const location = useLocation();

  if (loading) return <AuthLoadingScreen />;

  if (!firebaseUser) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!appUser) {
    return <Navigate to="/no-access?reason=missing-profile" replace />;
  }

  const portalRole = resolvePortalRole(appUser);
  if (!portalRole && location.pathname !== "/no-access") {
    return <Navigate to="/no-access?reason=invalid-account-type" replace />;
  }

  if (appUser.status === "suspended") {
    return <Navigate to="/no-access?reason=suspended" replace />;
  }

  if (appUser.status === "pending_approval" && !allowPending && portalRole !== "admin" && portalRole !== "super_admin") {
    return <Navigate to="/pending-approval" replace />;
  }

  if (allowedRoles && !canAccessPortalRole(portalRole, allowedRoles)) {
    return <Navigate to={portalHome(portalRole)} replace />;
  }

  if (requireAccess && !hasActiveAccess) {
    return <Navigate to="/no-access?reason=inactive-access" replace />;
  }

  return <Outlet />;
}
