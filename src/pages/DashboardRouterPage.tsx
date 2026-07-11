import { Navigate } from "react-router-dom";
import { AuthLoadingScreen } from "../components/AuthLoadingScreen";
import { useAuth } from "../contexts/AuthContext";
import { portalHome } from "../utils/authorization";

export function DashboardRouterPage() {
  const { appUser, loading } = useAuth();
  if (loading) return <AuthLoadingScreen />;
  return <Navigate to={portalHome(appUser)} replace />;
}
