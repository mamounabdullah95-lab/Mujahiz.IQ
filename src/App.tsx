import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { ProtectedRoute } from "./components/ProtectedRoute";

const AddSupplierPage = lazy(() => import("./pages/AddSupplierPage").then((module) => ({ default: module.AddSupplierPage })));
const DashboardPage = lazy(() => import("./pages/DashboardPage").then((module) => ({ default: module.DashboardPage })));
const DirectoryPage = lazy(() => import("./pages/DirectoryPage").then((module) => ({ default: module.DirectoryPage })));
const LandingPage = lazy(() => import("./pages/LandingPage").then((module) => ({ default: module.LandingPage })));
const LoginPage = lazy(() => import("./pages/LoginPage").then((module) => ({ default: module.LoginPage })));
const MyAccessPage = lazy(() => import("./pages/MyAccessPage").then((module) => ({ default: module.MyAccessPage })));
const MyReviewsPage = lazy(() => import("./pages/MyReviewsPage").then((module) => ({ default: module.MyReviewsPage })));
const MySubmissionsPage = lazy(() => import("./pages/MySubmissionsPage").then((module) => ({ default: module.MySubmissionsPage })));
const NoAccessPage = lazy(() => import("./pages/NoAccessPage").then((module) => ({ default: module.NoAccessPage })));
const PendingApprovalPage = lazy(() => import("./pages/PendingApprovalPage").then((module) => ({ default: module.PendingApprovalPage })));
const ProfileSettingsPage = lazy(() => import("./pages/ProfileSettingsPage").then((module) => ({ default: module.ProfileSettingsPage })));
const RegisterPage = lazy(() => import("./pages/RegisterPage").then((module) => ({ default: module.RegisterPage })));
const SupplierProfilePage = lazy(() => import("./pages/SupplierProfilePage").then((module) => ({ default: module.SupplierProfilePage })));
const AdminApprovedSuppliersPage = lazy(() => import("./pages/admin/AdminApprovedSuppliersPage").then((module) => ({ default: module.AdminApprovedSuppliersPage })));
const AdminAuditLogsPage = lazy(() => import("./pages/admin/AdminAuditLogsPage").then((module) => ({ default: module.AdminAuditLogsPage })));
const AdminCategoriesPage = lazy(() => import("./pages/admin/AdminCategoriesPage").then((module) => ({ default: module.AdminCategoriesPage })));
const AdminDashboardPage = lazy(() => import("./pages/admin/AdminDashboardPage").then((module) => ({ default: module.AdminDashboardPage })));
const AdminMaterialDictionaryPage = lazy(() => import("./pages/admin/AdminMaterialDictionaryPage").then((module) => ({ default: module.AdminMaterialDictionaryPage })));
const AdminReviewModerationPage = lazy(() => import("./pages/admin/AdminReviewModerationPage").then((module) => ({ default: module.AdminReviewModerationPage })));
const AdminSettingsPage = lazy(() => import("./pages/admin/AdminSettingsPage").then((module) => ({ default: module.AdminSettingsPage })));
const AdminSubmissionsPage = lazy(() => import("./pages/admin/AdminSubmissionsPage").then((module) => ({ default: module.AdminSubmissionsPage })));
const AdminSupplierFeedbackPage = lazy(() => import("./pages/admin/AdminSupplierFeedbackPage").then((module) => ({ default: module.AdminSupplierFeedbackPage })));
const AdminUsersPage = lazy(() => import("./pages/admin/AdminUsersPage").then((module) => ({ default: module.AdminUsersPage })));
const SupplierSubmissionDetailPage = lazy(() => import("./pages/admin/SupplierSubmissionDetailPage").then((module) => ({ default: module.SupplierSubmissionDetailPage })));

export function App() {
  return (
    <Suspense fallback={<div className="grid min-h-screen place-items-center bg-slate-50 text-sm font-semibold text-slate-600">Loading...</div>}>
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
            <Route path="admin/supplier-feedback" element={<AdminSupplierFeedbackPage />} />
            <Route path="admin/suppliers" element={<AdminApprovedSuppliersPage />} />
            <Route path="admin/suppliers/:supplierId/edit" element={<AddSupplierPage />} />
            <Route path="admin/categories" element={<AdminCategoriesPage />} />
            <Route path="admin/material-dictionary" element={<AdminMaterialDictionaryPage />} />
            <Route path="admin/settings" element={<AdminSettingsPage />} />
            <Route path="admin/audit-logs" element={<AdminAuditLogsPage />} />
          </Route>
        </Route>
      </Routes>
    </Suspense>
  );
}
