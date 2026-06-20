import { Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AddSupplierPage } from "./pages/AddSupplierPage";
import { DashboardPage } from "./pages/DashboardPage";
import { DirectoryPage } from "./pages/DirectoryPage";
import { LandingPage } from "./pages/LandingPage";
import { LoginPage } from "./pages/LoginPage";
import { MyAccessPage } from "./pages/MyAccessPage";
import { MyReviewsPage } from "./pages/MyReviewsPage";
import { MySubmissionsPage } from "./pages/MySubmissionsPage";
import { NoAccessPage } from "./pages/NoAccessPage";
import { PendingApprovalPage } from "./pages/PendingApprovalPage";
import { ProfileSettingsPage } from "./pages/ProfileSettingsPage";
import { RegisterPage } from "./pages/RegisterPage";
import { SupplierProfilePage } from "./pages/SupplierProfilePage";
import { AdminApprovedSuppliersPage } from "./pages/admin/AdminApprovedSuppliersPage";
import { AdminAuditLogsPage } from "./pages/admin/AdminAuditLogsPage";
import { AdminCategoriesPage } from "./pages/admin/AdminCategoriesPage";
import { AdminDashboardPage } from "./pages/admin/AdminDashboardPage";
import { AdminReviewModerationPage } from "./pages/admin/AdminReviewModerationPage";
import { AdminSettingsPage } from "./pages/admin/AdminSettingsPage";
import { AdminSubmissionsPage } from "./pages/admin/AdminSubmissionsPage";
import { AdminUsersPage } from "./pages/admin/AdminUsersPage";
import { SupplierSubmissionDetailPage } from "./pages/admin/SupplierSubmissionDetailPage";

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<LandingPage />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />

        <Route element={<ProtectedRoute allowPending />}>
          <Route path="pending-approval" element={<PendingApprovalPage />} />
          <Route path="no-access" element={<NoAccessPage />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="suppliers/new" element={<AddSupplierPage />} />
          <Route path="suppliers/submissions/:submissionId/edit" element={<AddSupplierPage />} />
          <Route path="my-submissions" element={<MySubmissionsPage />} />
          <Route path="my-access" element={<MyAccessPage />} />
          <Route path="my-reviews" element={<MyReviewsPage />} />
          <Route path="profile" element={<ProfileSettingsPage />} />
        </Route>

        <Route element={<ProtectedRoute requireAccess />}>
          <Route path="directory" element={<DirectoryPage />} />
          <Route path="suppliers/:id" element={<SupplierProfilePage />} />
        </Route>

        <Route element={<ProtectedRoute requireAdmin />}>
          <Route path="admin" element={<AdminDashboardPage />} />
          <Route path="admin/users" element={<AdminUsersPage />} />
          <Route path="admin/submissions" element={<AdminSubmissionsPage />} />
          <Route path="admin/submissions/:id" element={<SupplierSubmissionDetailPage />} />
          <Route path="admin/reviews" element={<AdminReviewModerationPage />} />
          <Route path="admin/suppliers" element={<AdminApprovedSuppliersPage />} />
          <Route path="admin/suppliers/:supplierId/edit" element={<AddSupplierPage />} />
          <Route path="admin/categories" element={<AdminCategoriesPage />} />
          <Route path="admin/settings" element={<AdminSettingsPage />} />
          <Route path="admin/audit-logs" element={<AdminAuditLogsPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
