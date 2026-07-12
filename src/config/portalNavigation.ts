import {
  BarChart3,
  Bell,
  BookOpen,
  Boxes,
  Building2,
  ClipboardCheck,
  FileClock,
  FileSpreadsheet,
  FileText,
  Gauge,
  History,
  Inbox,
  LifeBuoy,
  MessageSquare,
  PackageSearch,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Star,
  Tags,
  UserCog,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { PortalRole } from "../utils/authorization";

export interface PortalNavItem {
  to: string;
  label: { ar: string; en: string };
  icon: LucideIcon;
  end?: boolean;
}

export const portalRoleLabels: Record<PortalRole, { ar: string; en: string }> = {
  buyer: { ar: "حساب مشتري", en: "Buyer account" },
  supplier: { ar: "حساب مجهز", en: "Supplier account" },
  admin: { ar: "مدير النظام", en: "Platform admin" },
  super_admin: { ar: "الحساب الرئيسي", en: "Super admin" },
};

export const portalNavigation: Record<PortalRole, PortalNavItem[]> = {
  buyer: [
    { to: "/buyer", label: { ar: "نظرة عامة", en: "Overview" }, icon: Gauge, end: true },
    { to: "/directory", label: { ar: "دليل المجهزين", en: "Supplier directory" }, icon: BookOpen },
    { to: "/suppliers/import", label: { ar: "استيراد مجهزين", en: "Import suppliers" }, icon: FileSpreadsheet },
    { to: "/buyer/categories", label: { ar: "التصنيفات", en: "Categories" }, icon: Tags },
    { to: "/buyer/favorites", label: { ar: "المفضلة", en: "Favorites" }, icon: Star },
    { to: "/buyer/rfqs", label: { ar: "طلبات عروض الأسعار", en: "RFQ requests" }, icon: FileClock },
    { to: "/buyer/messages", label: { ar: "الرسائل", en: "Messages" }, icon: MessageSquare },
    { to: "/buyer/notifications", label: { ar: "الإشعارات", en: "Notifications" }, icon: Bell },
    { to: "/profile", label: { ar: "الملف الشخصي", en: "Profile" }, icon: UserRound },
    { to: "/buyer/settings", label: { ar: "إعدادات الحساب", en: "Account settings" }, icon: Settings },
  ],
  supplier: [
    { to: "/supplier", label: { ar: "نظرة عامة", en: "Overview" }, icon: Gauge, end: true },
    { to: "/suppliers/new", label: { ar: "ملف الشركة", en: "Company profile" }, icon: Building2 },
    { to: "/supplier/products", label: { ar: "المنتجات والخدمات", en: "Products & services" }, icon: Boxes },
    { to: "/supplier/categories", label: { ar: "التصنيفات", en: "Categories" }, icon: Tags },
    { to: "/supplier/documents", label: { ar: "المستندات والشهادات", en: "Documents" }, icon: FileText },
    { to: "/supplier/rfqs", label: { ar: "طلبات عروض الأسعار", en: "RFQ requests" }, icon: FileClock },
    { to: "/supplier/messages", label: { ar: "الرسائل", en: "Messages" }, icon: MessageSquare },
    { to: "/supplier/analytics", label: { ar: "إحصائيات الملف", en: "Profile analytics" }, icon: BarChart3 },
    { to: "/supplier/notifications", label: { ar: "الإشعارات", en: "Notifications" }, icon: Bell },
    { to: "/supplier/settings", label: { ar: "إعدادات الحساب", en: "Account settings" }, icon: Settings },
  ],
  admin: [
    { to: "/admin", label: { ar: "نظرة عامة", en: "Overview" }, icon: Gauge, end: true },
    { to: "/admin/suppliers", label: { ar: "إدارة المجهزين", en: "Suppliers" }, icon: Building2 },
    { to: "/suppliers/import", label: { ar: "استيراد مجهزين", en: "Import suppliers" }, icon: FileSpreadsheet },
    { to: "/admin/submissions", label: { ar: "طلبات اعتماد الشركات", en: "Company approvals" }, icon: ClipboardCheck },
    { to: "/admin/buyers", label: { ar: "إدارة المشترين", en: "Buyers" }, icon: Users },
    { to: "/admin/users", label: { ar: "إدارة المستخدمين", en: "Users" }, icon: UserCog },
    { to: "/admin/categories", label: { ar: "التصنيفات", en: "Categories" }, icon: Tags },
    { to: "/admin/material-dictionary", label: { ar: "قاموس المواد", en: "Material dictionary" }, icon: PackageSearch },
    { to: "/admin/reviews", label: { ar: "مراجعة التقييمات", en: "Review moderation" }, icon: Star },
    { to: "/admin/supplier-feedback", label: { ar: "البلاغات والدعم", en: "Reports & support" }, icon: LifeBuoy },
    { to: "/admin/reports", label: { ar: "التقارير", en: "Reports" }, icon: BarChart3 },
    { to: "/admin/settings", label: { ar: "الإعدادات", en: "Settings" }, icon: Settings },
  ],
  super_admin: [
    { to: "/super-admin", label: { ar: "نظرة عامة", en: "Overview" }, icon: ShieldCheck, end: true },
    { to: "/suppliers/import", label: { ar: "استيراد مجهزين", en: "Import suppliers" }, icon: FileSpreadsheet },
    { to: "/super-admin/admins", label: { ar: "حسابات المديرين", en: "Admin accounts" }, icon: UserCog },
    { to: "/super-admin/users", label: { ar: "جميع المستخدمين", en: "All users" }, icon: Users },
    { to: "/super-admin/roles", label: { ar: "الأدوار والصلاحيات", en: "Roles & permissions" }, icon: SlidersHorizontal },
    { to: "/super-admin/audit-logs", label: { ar: "سجل الإجراءات", en: "Audit log" }, icon: History },
    { to: "/super-admin/settings", label: { ar: "إعدادات المنصة", en: "Platform settings" }, icon: Settings },
    { to: "/super-admin/branding", label: { ar: "الهوية البصرية", en: "Branding" }, icon: Building2 },
    { to: "/super-admin/content", label: { ar: "الصفحات والمحتوى", en: "Pages & content" }, icon: FileText },
    { to: "/super-admin/categories", label: { ar: "التصنيفات الرئيسية", en: "Main categories" }, icon: Tags },
    { to: "/super-admin/integrations", label: { ar: "التكاملات", en: "Integrations" }, icon: Inbox },
    { to: "/super-admin/backups", label: { ar: "النسخ الاحتياطي", en: "Backups" }, icon: ClipboardCheck },
  ],
};
