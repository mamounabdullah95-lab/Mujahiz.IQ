import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { StatusBadge } from "../../components/StatusBadge";
import { Button, EmptyState, Section, SelectField } from "../../components/ui";
import { useAuth } from "../../contexts/AuthContext";
import { approveUser, getPlatformSettings, grantTemporaryAccess, listUsers, setUserRoleAndStatus } from "../../services/firestore";
import type { AppUser, UserRole, UserStatus } from "../../types/domain";
import { formatDate } from "../../utils/date";

export function AdminUsersPage() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language.startsWith("ar") ? "ar" : "en";
  const { firebaseUser, isOwner } = useAuth();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [busyId, setBusyId] = useState("");

  const load = () => listUsers().then(setUsers);
  useEffect(() => {
    void load();
  }, []);

  async function approve(user: AppUser) {
    if (!firebaseUser) return;
    setBusyId(user.uid);
    await approveUser(user.uid, firebaseUser.uid);
    await load();
    setBusyId("");
  }

  async function updateRoleStatus(user: AppUser, role: UserRole, status: UserStatus) {
    if (!firebaseUser) return;
    setBusyId(user.uid);
    await setUserRoleAndStatus(user.uid, firebaseUser.uid, role, status);
    await load();
    setBusyId("");
  }

  async function grantGrace(user: AppUser) {
    if (!firebaseUser) return;
    setBusyId(user.uid);
    const settings = await getPlatformSettings();
    await grantTemporaryAccess(user.uid, firebaseUser.uid, settings.gracePeriodDays);
    await load();
    setBusyId("");
  }

  return (
    <Section title={t("users")} description={t("pendingUsers")}>
      {!users.length ? <EmptyState title={t("noResults")} /> : null}
      <div className="grid gap-3">
        {users.map((user) => (
          <div className="rounded-md border border-slate-200 p-4" key={user.uid}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-bold text-ink">{user.fullName}</h3>
                <p className="text-sm text-slate-500">{user.email} · {user.organization} · {user.jobTitle}</p>
                <p className="mt-1 text-xs text-slate-500">{t("createdAt")}: {formatDate(user.createdAt, locale)}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <StatusBadge value={user.role} />
                <StatusBadge value={user.status} />
              </div>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-[160px_160px_auto]">
              <SelectField label={t("role")} defaultValue={user.role} disabled={!isOwner && user.role === "owner"} onChange={(event) => void updateRoleStatus(user, event.target.value as UserRole, user.status)}>
                {["owner", "admin", "contributor", "viewer", "suspended"].map((role) => (
                  <option key={role} value={role}>{t(`status_${role}`)}</option>
                ))}
              </SelectField>
              <SelectField label={t("status")} defaultValue={user.status} disabled={user.role === "owner" && !isOwner} onChange={(event) => void updateRoleStatus(user, user.role, event.target.value as UserStatus)}>
                {["pending_approval", "approved", "suspended"].map((status) => (
                  <option key={status} value={status}>{t(`status_${status}`)}</option>
                ))}
              </SelectField>
              <div className="flex items-end">
                <div className="flex flex-wrap gap-2">
                {user.status === "pending_approval" ? (
                  <Button disabled={busyId === user.uid} type="button" onClick={() => void approve(user)}>
                    {t("approve")}
                  </Button>
                ) : null}
                  <Button disabled={busyId === user.uid} type="button" variant="secondary" onClick={() => void grantGrace(user)}>
                    {t("temporary")}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}
