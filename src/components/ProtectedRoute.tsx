import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { EmptyState } from "./ui";

export function ProtectedRoute({
  requireAdmin = false,
  requireAccess = false,
  allowPending = false,
}: {
  requireAdmin?: boolean;
  requireAccess?: boolean;
  allowPending?: boolean;
}) {
  const { firebaseUser, appUser, loading, isAdmin, hasActiveAccess } = useAuth();
  const location = useLocation();

  if (loading) {
    return <EmptyState title="Loading" />;
  }

  if (!firebaseUser) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!appUser) {
    return <Navigate to="/register" replace />;
  }

  if (appUser.status === "pending_approval" && !requireAdmin && !allowPending && location.pathname !== "/pending-approval") {
    return <Navigate to="/pending-approval" replace />;
  }

  if (requireAdmin && !isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  if (requireAccess && !hasActiveAccess) {
    return <Navigate to="/no-access" replace />;
  }

  return <Outlet />;
}
