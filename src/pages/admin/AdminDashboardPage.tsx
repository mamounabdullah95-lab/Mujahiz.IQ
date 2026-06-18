import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Section, StatCard } from "../../components/ui";
import { listPendingReviews, listSupplierSubmissions, listSuppliers, listUsers } from "../../services/firestore";

export function AdminDashboardPage() {
  const { t } = useTranslation();
  const [stats, setStats] = useState({ submissions: 0, reviews: 0, pendingUsers: 0, suppliers: 0 });

  useEffect(() => {
    void Promise.all([
      listSupplierSubmissions(),
      listPendingReviews(),
      listUsers("pending_approval"),
      listSuppliers(),
    ]).then(([submissions, reviews, users, suppliers]) => {
      setStats({
        submissions: submissions.length,
        reviews: reviews.length,
        pendingUsers: users.length,
        suppliers: suppliers.length,
      });
    });
  }, []);

  return (
    <Section title={t("adminDashboard")} description={t("adminOnly")}>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Link to="/admin/submissions"><StatCard label={t("reviewQueue")} value={stats.submissions} tone="warning" /></Link>
        <Link to="/admin/reviews"><StatCard label={t("reviewModeration")} value={stats.reviews} tone="warning" /></Link>
        <Link to="/admin/users"><StatCard label={t("pendingUsers")} value={stats.pendingUsers} /></Link>
        <Link to="/admin/suppliers"><StatCard label={t("approvedSuppliers")} value={stats.suppliers} tone="good" /></Link>
      </div>
    </Section>
  );
}
