import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";
import { AppLayoutV2 } from "./components/AppLayoutV2";
import { AuthLoadingScreen } from "./components/AuthLoadingScreen";
import { RoleProtectedRoute } from "./components/RoleProtectedRoute";

const AddSupplierPage = lazy(() => import("./pages/AddSupplierPage").then((module) => ({ default: module.AddSupplierPage })));
const AdminApprovedSuppliersPage = lazy(() => import("./pages/admin/AdminApprovedSuppliersPage").then((module) => ({ default: module.AdminApprovedSuppliersPage })));
const AdminAuditLogsPage = lazy(() => import("./pages/admin/AdminAuditLogsPage").then((module) => ({ default: module.AdminAuditLogsPage })));
const AdminCategoriesPage = lazy(() => import("./pages/admin/AdminCategoriesPage").then((module) => ({ default: module.AdminCategoriesPage })));
const AdminMaterialDictionaryPage = lazy(() => import("./pages/admin/AdminMaterialDictionaryPage").then((module) => ({ default: module.AdminMaterialDictionaryPage })));
const AdminReviewModerationPage = lazy(() => import("./pages/admin/AdminReviewModerationPage").then((module) => ({ default: module.AdminReviewModerationPage })));
const AdminSettingsPage = lazy(() => import("./pages/admin/AdminSettingsPage").then((module) => ({ default: module.AdminSettingsPage })));
const AdminSubmissionsPage = lazy(() => import("./pages/admin/AdminSubmissionsPage").then((module) => ({ default: module.AdminSubmissionsPage })));
const AdminSupplierFeedbackPage = lazy(() => import("./pages/admin/AdminSupplierFeedbackPage").then((module) => ({ default: module.AdminSupplierFeedbackPage })));
const SupplierSubmissionDetailPage = lazy(() => import("./pages/admin/SupplierSubmissionDetailPage").then((module) => ({ default: module.SupplierSubmissionDetailPage })));
const BuyerDashboardPage = lazy(() => import("./pages/BuyerDashboardPage").then((module) => ({ default: module.BuyerDashboardPage })));
const SupplierDashboardPage = lazy(() => import("./pages/SupplierDashboardPage").then((module) => ({ default: module.SupplierDashboardPage })));
const AdminOperationsDashboardPage = lazy(() => import("./pages/AdminOperationsDashboardPage").then((module) => ({ default: module.AdminOperationsDashboardPage })));
const SuperAdminDashboardPage = lazy(() => import("./pages/SuperAdminDashboardPage").then((module) => ({ default: module.SuperAdminDashboardPage })));
const AdminUsersTablePage = lazy(() => import("./pages/AdminUsersTablePage").then((module) => ({ default: module.AdminUsersTablePage })));
const ComingSoonPage = lazy(() => import("./pages/ComingSoonPage").then((module) => ({ default: module.ComingSoonPage })));
const DashboardRouterPage = lazy(() => import("./pages/DashboardRouterPage").then((module) => ({ default: module.DashboardRouterPage })));
const DirectoryPage = lazy(() => import("./pages/DirectoryPage").then((module) => ({ default: module.DirectoryPage })));
const LandingPage = lazy(() => import("./pages/LandingPage").then((module) => ({ default: module.LandingPage })));
const LoginPage = lazy(() => import("./pages/LoginPage").then((module) => ({ default: module.LoginPage })));
const MyAccessPage = lazy(() => import("./pages/MyAccessPage").then((module) => ({ default: module.MyAccessPage })));
const MyReviewsPage = lazy(() => import("./pages/MyReviewsPage").then((module) => ({ default: module.MyReviewsPage })));
const MySubmissionsPage = lazy(() => import("./pages/MySubmissionsPage").then((module) => ({ default: module.MySubmissionsPage })));
const NoAccessPage = lazy(() => import("./pages/NoAccessPage").then((module) => ({ default: module.NoAccessPage })));
const PendingApprovalPage = lazy(() => import("./pages/PendingApprovalPage").then((module) => ({ default: module.PendingApprovalPage })));
const ProfileSettingsPage = lazy(() => import("./pages/ProfileSettingsPage").then((module) => ({ default: module.ProfileSettingsPage })));
const PublicContentPage = lazy(() => import("./pages/PublicContentPage").then((module) => ({ default: module.PublicContentPage })));
const RegisterPage = lazy(() => import("./pages/RegisterPage").then((module) => ({ default: module.RegisterPage })));
const SupplierProfilePage = lazy(() => import("./pages/SupplierProfilePage").then((module) => ({ default: module.SupplierProfilePage })));

const allRoles = ["buyer", "supplier", "admin", "super_admin"] as const;
const buyerRoles = ["buyer", "admin", "super_admin"] as const;
const supplierRoles = ["supplier"] as const;
const adminRoles = ["admin", "super_admin"] as const;
const superAdminRoles = ["super_admin"] as const;

const soon = (ar: string, en: string, bodyAr?: string, bodyEn?: string) => (
  <ComingSoonPage title={{ ar, en }} description={bodyAr && bodyEn ? { ar: bodyAr, en: bodyEn } : undefined} />
);

export function AppV2() {
  return (
    <Suspense fallback={<AuthLoadingScreen />}>
      <Routes>
        <Route element={<AppLayoutV2 />}>
          <Route index element={<LandingPage />} />
          <Route path="login" element={<LoginPage />} />
          <Route path="register" element={<RegisterPage />} />
          <Route path="about" element={<PublicContentPage pageKey="about" />} />
          <Route path="suppliers" element={<PublicContentPage pageKey="suppliers" />} />
          <Route path="buyers" element={<PublicContentPage pageKey="buyers" />} />
          <Route path="how-it-works" element={<PublicContentPage pageKey="how_it_works" />} />
          <Route path="supplier-directory" element={<PublicContentPage pageKey="supplier_directory" />} />
          <Route path="join" element={<PublicContentPage pageKey="join_request" />} />
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
          </Route>

          <Route element={<RoleProtectedRoute allowedRoles={["buyer"]} allowPending />}>
            <Route path="buyer" element={<BuyerDashboardPage />} />
            <Route path="buyer/categories" element={soon("التصنيفات", "Categories")} />
            <Route path="buyer/favorites" element={soon("المفضلة", "Favorites")} />
            <Route path="buyer/rfqs" element={soon("طلبات عروض الأسعار", "RFQ requests")} />
            <Route path="buyer/messages" element={soon("الرسائل", "Messages")} />
            <Route path="buyer/notifications" element={soon("الإشعارات", "Notifications")} />
            <Route path="buyer/settings" element={soon("إعدادات الحساب", "Account settings")} />
            <Route path="my-access" element={<MyAccessPage />} />
            <Route path="my-reviews" element={<MyReviewsPage />} />
          </Route>

          <Route element={<RoleProtectedRoute allowedRoles={buyerRoles} requireAccess />}>
            <Route path="directory" element={<DirectoryPage />} />
            <Route path="suppliers/:id" element={<SupplierProfilePage />} />
          </Route>

          <Route element={<RoleProtectedRoute allowedRoles={supplierRoles} allowPending />}>
            <Route path="supplier" element={<SupplierDashboardPage />} />
            <Route path="suppliers/new" element={<AddSupplierPage />} />
            <Route path="suppliers/submissions/:submissionId/edit" element={<AddSupplierPage />} />
            <Route path="my-submissions" element={<MySubmissionsPage />} />
            <Route path="supplier/products" element={soon("المنتجات والخدمات", "Products & services")} />
            <Route path="supplier/categories" element={soon("تصنيفات الشركة", "Company categories")} />
            <Route path="supplier/documents" element={soon("المستندات والشهادات", "Documents & certificates")} />
            <Route path="supplier/rfqs" element={soon("طلبات عروض الأسعار", "RFQ requests")} />
            <Route path="supplier/messages" element={soon("الرسائل", "Messages")} />
            <Route path="supplier/analytics" element={soon("إحصائيات الملف", "Profile analytics")} />
            <Route path="supplier/notifications" element={soon("الإشعارات", "Notifications")} />
            <Route path="supplier/settings" element={soon("إعدادات الحساب", "Account settings")} />
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
            <Route path="admin/suppliers/:supplierId/edit" element={<AddSupplierPage />} />
            <Route path="admin/categories" element={<AdminCategoriesPage />} />
            <Route path="admin/material-dictionary" element={<AdminMaterialDictionaryPage />} />
            <Route path="admin/settings" element={soon("إعدادات الإدارة", "Admin settings", "إعدادات التشغيل العامة محفوظة للحساب الرئيسي. ستضاف هنا إعدادات يومية خاصة بمدير النظام.", "Global operating settings are restricted to the Super Admin. Daily admin preferences will be added here.")} />
            <Route path="admin/reports" element={soon("التقارير", "Reports")} />
          </Route>

          <Route element={<RoleProtectedRoute allowedRoles={superAdminRoles} />}>
            <Route path="super-admin" element={<SuperAdminDashboardPage />} />
            <Route path="super-admin/admins" element={<AdminUsersTablePage scope="admins" />} />
            <Route path="super-admin/users" element={<AdminUsersTablePage />} />
            <Route path="super-admin/audit-logs" element={<AdminAuditLogsPage />} />
            <Route path="super-admin/settings" element={<AdminSettingsPage />} />
            <Route path="super-admin/categories" element={<AdminCategoriesPage />} />
            <Route path="super-admin/roles" element={soon("الأدوار والصلاحيات", "Roles & permissions", "تعريف الصلاحيات مطبق حالياً في المسارات وقواعد Firestore. واجهة التخصيص الدقيقة ستضاف بعد اعتماد مصفوفة الصلاحيات.", "Role enforcement is active in routes and Firestore rules. Fine-grained customization will follow an approved permission matrix.")} />
            <Route path="super-admin/branding" element={soon("الهوية البصرية", "Branding")} />
            <Route path="super-admin/content" element={soon("الصفحات والمحتوى", "Pages & content")} />
            <Route path="super-admin/integrations" element={soon("التكاملات", "Integrations")} />
            <Route path="super-admin/backups" element={soon("النسخ الاحتياطي", "Backups", "تعتمد هذه الوظيفة على إعداد النسخ الاحتياطي في Google Cloud قبل تفعيلها من الواجهة.", "This feature depends on Google Cloud backup configuration before it can be enabled in the interface.")} />
          </Route>
        </Route>
      </Routes>
    </Suspense>
  );
}
