import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Section, StatCard } from "../../components/ui";
import { listPendingReviews, listSupplierFeedback, listSupplierSubmissions, listSuppliers, listTermSuggestions, listUsers } from "../../services/firestore";

export function AdminDashboardPage() {
  const { t } = useTranslation();
  const [stats, setStats] = useState({ submissions: 0, reviews: 0, feedback: 0, pendingTerms: 0, pendingUsers: 0, suppliers: 0 });

  useEffect(() => {
    void Promise.all([
      listSupplierSubmissions(),
      listPendingReviews(),
      listSupplierFeedback(),
      listTermSuggestions("pending"),
      listUsers("pending_approval"),
      listSuppliers(),
    ]).then(([submissions, reviews, feedback, pendingTerms, users, suppliers]) => {
      setStats({
        submissions: submissions.length,
        reviews: reviews.length,
        feedback: feedback.length,
        pendingTerms: pendingTerms.length,
        pendingUsers: users.length,
        suppliers: suppliers.length,
      });
    });
  }, []);

  return (
    <Section title={t("adminDashboard")} description={t("adminOnly")}>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <Link to="/admin/submissions"><StatCard label={t("reviewQueue")} value={stats.submissions} tone="warning" /></Link>
        <Link to="/admin/reviews"><StatCard label={t("reviewModeration")} value={stats.reviews} tone="warning" /></Link>
        <Link to="/admin/supplier-feedback"><StatCard label={t("supplierFeedbackAdmin")} value={stats.feedback} tone="warning" /></Link>
        <Link to="/admin/material-dictionary"><StatCard label={t("pendingTermSuggestions")} value={stats.pendingTerms} tone="warning" /></Link>
        <Link to="/admin/users"><StatCard label={t("pendingUsers")} value={stats.pendingUsers} /></Link>
        <Link to="/admin/suppliers"><StatCard label={t("approvedSuppliers")} value={stats.suppliers} tone="good" /></Link>
      </div>
    </Section>
  );
}
