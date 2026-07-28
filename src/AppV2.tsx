import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppLayoutV2 } from "./components/AppLayoutV2";
import { AuthLoadingScreen } from "./components/AuthLoadingScreen";
import { RoleProtectedRoute } from "./components/RoleProtectedRoute";
import { features } from "./config/features";

const AddSupplierPage = lazy(() => import("./pages/AddSupplierPage").then((m) => ({ default: m.AddSupplierPage })));
const SupplierExcelImportPage = lazy(() => import("./pages/SupplierExcelImportPage").then((m) => ({ default: m.SupplierExcelImportPage })));
const AdminApprovedSuppliersPage = lazy(() => import("./pages/admin/AdminApprovedSuppliersPage").then((m) => ({ default: m.AdminApprovedSuppliersPage })));
const AdminAuditLogsPage = lazy(() => import("./pages/admin/AdminAuditLogsPage").then((m) => ({ default: m.AdminAuditLogsPage })));
const AdminCategoriesPage = lazy(() => import("./pages/admin/AdminCategoriesPage").then((m) => ({ default: m.AdminCategoriesPage })));
const AdminMaterialDictionaryPage = lazy(() => import("./pages/admin/AdminMaterialDictionaryPage").then((m) => ({ default: m.AdminMaterialDictionaryPage })));
const AdminReviewModerationPage = lazy(() => import("./pages/admin/AdminReviewModerationPage").then((m) => ({ default: m.AdminReviewModerationPage })));
const AdminSettingsPage = lazy(() => import("./pages/admin/AdminSettingsPage").then((m) => ({ default: m.AdminSettingsPage })));
const AdminSubmissionsPage = lazy(() => import("./pages/admin/AdminSubmissionsPage").then((m) => ({ default: m.AdminSubmissionsPage })));
const AdminSupplierFeedbackPage = lazy(() => import("./pages/admin/AdminSupplierFeedbackPage").then((m) => ({ default: m.AdminSupplierFeedbackPage })));
const SupplierSubmissionDetailPage = lazy(() => import("./pages/admin/SupplierSubmissionDetailPage").then((m) => ({ default: m.SupplierSubmissionDetailPage })));
const BuyerDashboardPage = lazy(() => import("./pages/BuyerDashboardPage").then((m) => ({ default: m.BuyerDashboardPage })));
const SupplierDashboardPage = lazy(() => import("./pages/SupplierDashboardPage").then((m) => ({ default: m.SupplierDashboardPage })));
const AdminOperationsDashboardPage = lazy(() => import("./pages/AdminOperationsDashboardPage").then((m) => ({ default: m.AdminOperationsDashboardPage })));
const SuperAdminDashboardPage = lazy(() => import("./pages/SuperAdminDashboardPage").then((m) => ({ default: m.SuperAdminDashboardPage })));
const AdminUsersTablePage = lazy(() => import("./pages/AdminUsersTablePage").then((m) => ({ default: m.AdminUsersTablePage })));
const DashboardRouterPage = lazy(() => import("./pages/DashboardRouterPage").then((m) => ({ default: m.DashboardRouterPage })));
const DirectoryPage = lazy(() => import("./pages/DirectoryPage").then((m) => ({ default: m.DirectoryPage })));
const LandingPage = lazy(() => import("./pages/LandingPage").then((m) => ({ default: m.LandingPage })));
const LoginPage = lazy(() => import("./pages/LoginPage").then((m) => ({ default: m.LoginPage })));
const ForgotPasswordPage = lazy(() => import("./pages/ForgotPasswordPage").then((m) => ({ default: m.ForgotPasswordPage })));
const ResetPasswordPage = lazy(() => import("./pages/ResetPasswordPage").then((m) => ({ default: m.ResetPasswordPage })));
const EmailActionPage = lazy(() => import("./pages/EmailActionPage").then((m) => ({ default: m.EmailActionPage })));
const MyAccessPage = lazy(() => import("./pages/MyAccessPage").then((m) => ({ default: m.MyAccessPage })));
const MyReviewsPage = lazy(() => import("./pages/MyReviewsPage").then((m) => ({ default: m.MyReviewsPage })));
const MySubmissionsPage = lazy(() => import("./pages/MySubmissionsPage").then((m) => ({ default: m.MySubmissionsPage })));
const NoAccessPage = lazy(() => import("./pages/NoAccessPage").then((m) => ({ default: m.NoAccessPage })));
const PendingApprovalPage = lazy(() => import("./pages/PendingApprovalPage").then((m) => ({ default: m.PendingApprovalPage })));
const ProfileSettingsPage = lazy(() => import("./pages/ProfileSettingsPage").then((m) => ({ default: m.ProfileSettingsPage })));
const PublicContentPage = lazy(() => import("./pages/PublicContentPage").then((m) => ({ default: m.PublicContentPage })));
const RegisterPage = lazy(() => import("./pages/RegisterPage").then((m) => ({ default: m.RegisterPage })));
const SupplierProfilePage = lazy(() => import("./pages/SupplierProfilePage").then((m) => ({ default: m.SupplierProfilePage })));
const SupplierOwnedProfilePreviewPage = lazy(() => import("./pages/SupplierProfilePage").then((m) => ({ default: m.SupplierOwnedProfilePreviewPage })));
const VerifyEmailPage = lazy(() => import("./pages/VerifyEmailPage").then((m) => ({ default: m.VerifyEmailPage })));
const CompleteProfilePage = lazy(() => import("./pages/CompleteProfilePage").then((m) => ({ default: m.CompleteProfilePage })));
const BuyerCategoriesPage = lazy(() => import("./pages/workspace/BuyerWorkspacePages").then((m) => ({ default: m.BuyerCategoriesPage })));
const BuyerFavoritesPage = lazy(() => import("./pages/workspace/BuyerWorkspacePages").then((m) => ({ default: m.BuyerFavoritesPage })));
const BuyerRfqsPage = lazy(() => import("./pages/workspace/BuyerWorkspacePages").then((m) => ({ default: m.BuyerRfqsPage })));
const WorkspaceMessagesPage = lazy(() => import("./pages/workspace/BuyerWorkspacePages").then((m) => ({ default: m.WorkspaceMessagesPage })));
const WorkspaceNotificationsPage = lazy(() => import("./pages/workspace/BuyerWorkspacePages").then((m) => ({ default: m.WorkspaceNotificationsPage })));
const AccountSettingsPage = lazy(() => import("./pages/workspace/BuyerWorkspacePages").then((m) => ({ default: m.AccountSettingsPage })));
const SupplierProductsPage = lazy(() => import("./pages/workspace/SupplierWorkspacePages").then((m) => ({ default: m.SupplierProductsPage })));
const SupplierCategoriesPage = lazy(() => import("./pages/workspace/SupplierWorkspacePages").then((m) => ({ default: m.SupplierCategoriesPage })));
const SupplierDocumentsPage = lazy(() => import("./pages/workspace/SupplierWorkspacePages").then((m) => ({ default: m.SupplierDocumentsPage })));
const SupplierRfqsPage = lazy(() => import("./pages/workspace/SupplierWorkspacePages").then((m) => ({ default: m.SupplierRfqsPage })));
const SupplierMessagesPage = lazy(() => import("./pages/workspace/SupplierWorkspacePages").then((m) => ({ default: m.SupplierMessagesPage })));
const SupplierAnalyticsPage = lazy(() => import("./pages/workspace/SupplierWorkspacePages").then((m) => ({ default: m.SupplierAnalyticsPage })));
const SupplierNotificationsPage = lazy(() => import("./pages/workspace/SupplierWorkspacePages").then((m) => ({ default: m.SupplierNotificationsPage })));
const SupplierSettingsPage = lazy(() => import("./pages/workspace/SupplierWorkspacePages").then((m) => ({ default: m.SupplierSettingsPage })));
const AdminOperationalSettingsPage = lazy(() => import("./pages/workspace/AdminWorkspacePages").then((m) => ({ default: m.AdminOperationalSettingsPage })));
const AdminReportsPage = lazy(() => import("./pages/workspace/AdminWorkspacePages").then((m) => ({ default: m.AdminReportsPage })));
const RegistrationSectorsPage = lazy(() => import("./pages/workspace/AdminWorkspacePages").then((m) => ({ default: m.RegistrationSectorsPage })));
const OwnerRolesPage = lazy(() => import("./pages/workspace/AdminWorkspacePages").then((m) => ({ default: m.OwnerRolesPage })));
const OwnerBrandingPage = lazy(() => import("./pages/workspace/AdminWorkspacePages").then((m) => ({ default: m.OwnerBrandingPage })));
const OwnerContentPage = lazy(() => import("./pages/workspace/AdminWorkspacePages").then((m) => ({ default: m.OwnerContentPage })));
const OwnerIntegrationsPage = lazy(() => import("./pages/workspace/AdminWorkspacePages").then((m) => ({ default: m.OwnerIntegrationsPage })));
const OwnerBackupsPage = lazy(() => import("./pages/workspace/AdminWorkspacePages").then((m) => ({ default: m.OwnerBackupsPage })));

const allRoles = ["buyer", "supplier", "admin", "super_admin"] as const;
const contributorRoles = ["buyer", "supplier", "admin", "super_admin"] as const;
const buyerRoles = ["buyer", "admin", "super_admin"] as const;
const supplierExcelImporterRoles = ["buyer", "admin", "super_admin"] as const;
const supplierRoles = ["supplier"] as const;
const adminRoles = ["admin", "super_admin"] as const;
const superAdminRoles = ["super_admin"] as const;

export function AppV2() {
  return <Suspense fallback={<AuthLoadingScreen />}><Routes><Route element={<AppLayoutV2 />}>
    <Route index element={<LandingPage />} />
    <Route path="login" element={<LoginPage />} />
    <Route path="forgot-password" element={<ForgotPasswordPage />} />
    <Route path="reset-password" element={<ResetPasswordPage />} />
    <Route path="auth/action" element={<EmailActionPage />} />
    <Route path="register" element={<RegisterPage />} />
    <Route path="verify-email" element={<VerifyEmailPage />} />
    <Route path="complete-profile" element={<CompleteProfilePage />} />
    <Route path="about" element={<PublicContentPage pageKey="about" />} />
    <Route path="suppliers" element={<PublicContentPage pageKey="suppliers" />} />
    <Route path="buyers" element={<PublicContentPage pageKey="buyers" />} />
    <Route path="how-it-works" element={<PublicContentPage pageKey="how_it_works" />} />
    <Route path="supplier-directory" element={<PublicContentPage pageKey="supplier_directory" />} />
    <Route path="join" element={<Navigate to="/register" replace />} />
    <Route path="contact" element={<PublicContentPage pageKey="contact" />} />
    <Route path="faq" element={<PublicContentPage pageKey="faq" />} />
    <Route path="resources" element={<PublicContentPage pageKey="resources" />} />
    <Route path="terms" element={<PublicContentPage pageKey="terms" />} />
    <Route path="privacy" element={<PublicContentPage pageKey="privacy" />} />
    <Route path="security" element={<PublicContentPage pageKey="security" />} />
    <Route path="no-access" element={<NoAccessPage />} />

    <Route element={<RoleProtectedRoute allowedRoles={allRoles} allowPending />}>
      <Route path="dashboard" element={<DashboardRouterPage />} />
      <Route path="pending-approval" element={<PendingApprovalPage />} />
      <Route path="profile" element={<ProfileSettingsPage />} />
      <Route path="notifications" element={<WorkspaceNotificationsPage />} />
    </Route>

    <Route element={<RoleProtectedRoute allowedRoles={contributorRoles} allowPending />}>
      <Route path="suppliers/new" element={<AddSupplierPage />} />
      <Route path="suppliers/submissions/:submissionId/edit" element={<AddSupplierPage />} />
    </Route>

    {features.supplierExcelImport ? (
      <Route element={<RoleProtectedRoute allowedRoles={supplierExcelImporterRoles} allowPending />}>
        <Route path="suppliers/import" element={<SupplierExcelImportPage />} />
      </Route>
    ) : null}

    <Route element={<RoleProtectedRoute allowedRoles={["buyer"]} allowPending />}>
      <Route path="buyer" element={<BuyerDashboardPage />} />
      <Route path="buyer/categories" element={<BuyerCategoriesPage />} />
      <Route path="buyer/favorites" element={<BuyerFavoritesPage />} />
      <Route path="buyer/rfqs" element={<BuyerRfqsPage />} />
      <Route path="buyer/messages" element={<WorkspaceMessagesPage />} />
      <Route path="buyer/notifications" element={<WorkspaceNotificationsPage />} />
      <Route path="buyer/settings" element={<AccountSettingsPage />} />
      <Route path="buyer/suppliers/submit" element={<AddSupplierPage />} />
      <Route path="buyer/suppliers/submissions" element={<MySubmissionsPage />} />
      <Route path="my-access" element={<MyAccessPage />} />
      <Route path="my-reviews" element={<MyReviewsPage />} />
      <Route path="my-submissions" element={<MySubmissionsPage />} />
    </Route>

    <Route element={<RoleProtectedRoute allowedRoles={buyerRoles} requireAccess />}>
      <Route path="directory" element={<DirectoryPage />} />
      <Route path="suppliers/:id" element={<SupplierProfilePage />} />
    </Route>

    <Route element={<RoleProtectedRoute allowedRoles={supplierRoles} allowPending />}>
      <Route path="supplier" element={<SupplierDashboardPage />} />
      <Route path="supplier/company-preview" element={<SupplierOwnedProfilePreviewPage />} />
      <Route path="my-submissions" element={<MySubmissionsPage />} />
      <Route path="supplier/products" element={<SupplierProductsPage />} />
      <Route path="supplier/categories" element={<SupplierCategoriesPage />} />
      <Route path="supplier/documents" element={<SupplierDocumentsPage />} />
      <Route path="supplier/rfqs" element={<SupplierRfqsPage />} />
      <Route path="supplier/messages" element={<SupplierMessagesPage />} />
      <Route path="supplier/analytics" element={<SupplierAnalyticsPage />} />
      <Route path="supplier/notifications" element={<SupplierNotificationsPage />} />
      <Route path="supplier/settings" element={<SupplierSettingsPage />} />
    </Route>

    <Route element={<RoleProtectedRoute allowedRoles={adminRoles} />}>
      <Route path="admin" element={<AdminOperationsDashboardPage />} />
      <Route path="admin/users" element={<AdminUsersTablePage />} />
      <Route path="admin/buyers" element={<AdminUsersTablePage scope="buyers" />} />
      <Route path="admin/submissions" element={<AdminSubmissionsPage />} />
      <Route path="admin/submissions/:id" element={<SupplierSubmissionDetailPage />} />
      <Route path="admin/reviews" element={<AdminReviewModerationPage />} />
      <Route path="admin/supplier-feedback" element={<AdminSupplierFeedbackPage />} />
      <Route path="admin/suppliers" element={<AdminApprovedSuppliersPage />} />
      <Route path="admin/suppliers/new" element={<AddSupplierPage />} />
      <Route path="admin/suppliers/:supplierId/edit" element={<AddSupplierPage />} />
      <Route path="admin/categories" element={<AdminCategoriesPage />} />
      <Route path="admin/material-dictionary" element={<AdminMaterialDictionaryPage />} />
      <Route path="admin/settings" element={<AdminOperationalSettingsPage />} />
      <Route path="admin/reports" element={<AdminReportsPage />} />
      <Route path="admin/audit-logs" element={<AdminAuditLogsPage />} />
    </Route>

    <Route element={<RoleProtectedRoute allowedRoles={superAdminRoles} />}>
      <Route path="super-admin" element={<SuperAdminDashboardPage />} />
      <Route path="super-admin/admins" element={<AdminUsersTablePage scope="admins" />} />
      <Route path="super-admin/users" element={<AdminUsersTablePage />} />
      <Route path="super-admin/audit-logs" element={<AdminAuditLogsPage />} />
      <Route path="super-admin/settings" element={<AdminSettingsPage />} />
      <Route path="super-admin/categories" element={<AdminCategoriesPage />} />
      <Route path="super-admin/registration-sectors" element={<RegistrationSectorsPage />} />
      <Route path="super-admin/roles" element={<OwnerRolesPage />} />
      <Route path="super-admin/branding" element={<OwnerBrandingPage />} />
      <Route path="super-admin/content" element={<OwnerContentPage />} />
      <Route path="super-admin/integrations" element={<OwnerIntegrationsPage />} />
      <Route path="super-admin/backups" element={<OwnerBackupsPage />} />
    </Route>
  </Route></Routes></Suspense>;
}
