import { collection, getCountFromServer, query, where, type Query } from "firebase/firestore";
import { db, isFirebaseConfigured } from "../config/firebase";
import {
  listPendingReviews,
  listSupplierFeedback,
  listSupplierSubmissions,
  listSuppliers,
  listTermSuggestions,
  listUsers,
} from "./firestore";
import { ReadThroughCache, type CacheReadOptions } from "../utils/readThroughCache";

export interface PortalMetrics {
  totalUsers: number;
  buyerAccounts: number;
  supplierAccounts: number;
  admins: number;
  superAdmins: number;
  pendingUsers: number;
  approvedSuppliers: number;
  pendingCompanies: number;
  rejectedCompanies: number;
  pendingReviews: number;
  pendingFeedback: number;
  pendingTerms: number;
  categories: number;
}

export type PortalMetricScope = "admin" | "owner";

const portalMetricCache = new ReadThroughCache<PortalMetrics>(60_000);

async function count(ref: Query) {
  return (await getCountFromServer(ref)).data().count;
}

async function loadLocalMetrics(categories: number): Promise<PortalMetrics> {
  const [users, suppliers, pendingCompanies, rejectedCompanies, reviews, feedback, terms] = await Promise.all([
    listUsers(),
    listSuppliers(),
    listSupplierSubmissions(),
    listSupplierSubmissions(["rejected"]),
    listPendingReviews(),
    listSupplierFeedback(),
    listTermSuggestions("pending"),
  ]);
  const admins = users.filter((user) => user.role === "admin").length;
  const superAdmins = users.filter((user) => user.role === "owner").length;
  const supplierAccounts = users.filter((user) => user.accountType === "supplier" && user.role !== "admin" && user.role !== "owner").length;
  const buyerAccounts = users.filter((user) => user.accountType !== "supplier" && user.role !== "admin" && user.role !== "owner").length;
  return {
    totalUsers: users.length,
    buyerAccounts,
    supplierAccounts,
    admins,
    superAdmins,
    pendingUsers: users.filter((user) => user.status === "pending_approval").length,
    approvedSuppliers: suppliers.length,
    pendingCompanies: pendingCompanies.length,
    rejectedCompanies: rejectedCompanies.length,
    pendingReviews: reviews.length,
    pendingFeedback: feedback.length,
    pendingTerms: terms.length,
    categories,
  };
}

async function loadAdminMetrics(categories: number): Promise<PortalMetrics> {
  const users = collection(db, "users");
  const suppliers = collection(db, "suppliers");
  const submissions = collection(db, "supplierSubmissions");
  const reviews = collection(db, "reviews");
  const feedback = collection(db, "supplierFeedback");
  const [
    totalUsers,
    buyerAccounts,
    supplierAccounts,
    approvedSuppliers,
    pendingCompanies,
    pendingReviews,
    pendingFeedback,
  ] = await Promise.all([
    count(query(users)),
    count(query(users, where("accountType", "==", "buyer"))),
    count(query(users, where("accountType", "==", "supplier"))),
    count(query(suppliers, where("status", "==", "approved"))),
    count(query(submissions, where("submissionStatus", "in", ["pending_review", "possible_duplicate"]))),
    count(query(reviews, where("status", "==", "pending_review"))),
    count(query(feedback, where("status", "in", ["pending", "in_review"]))),
  ]);
  return {
    totalUsers,
    buyerAccounts,
    supplierAccounts,
    admins: 0,
    superAdmins: 0,
    pendingUsers: 0,
    approvedSuppliers,
    pendingCompanies,
    rejectedCompanies: 0,
    pendingReviews,
    pendingFeedback,
    pendingTerms: 0,
    categories,
  };
}

async function loadOwnerMetrics(categories: number): Promise<PortalMetrics> {
  const users = collection(db, "users");
  const suppliers = collection(db, "suppliers");
  const submissions = collection(db, "supplierSubmissions");
  const [totalUsers, admins, superAdmins, approvedSuppliers, pendingCompanies] = await Promise.all([
    count(query(users)),
    count(query(users, where("role", "==", "admin"))),
    count(query(users, where("role", "==", "owner"))),
    count(query(suppliers, where("status", "==", "approved"))),
    count(query(submissions, where("submissionStatus", "in", ["pending_review", "possible_duplicate"]))),
  ]);
  return {
    totalUsers,
    buyerAccounts: 0,
    supplierAccounts: 0,
    admins,
    superAdmins,
    pendingUsers: 0,
    approvedSuppliers,
    pendingCompanies,
    rejectedCompanies: 0,
    pendingReviews: 0,
    pendingFeedback: 0,
    pendingTerms: 0,
    categories,
  };
}

export function getPortalMetrics(
  scope: PortalMetricScope,
  categories: number,
  options: CacheReadOptions = {},
) {
  const cacheKey = `${scope}:${categories}`;
  return portalMetricCache.read(cacheKey, () => {
    if (!isFirebaseConfigured) return loadLocalMetrics(categories);
    return scope === "owner" ? loadOwnerMetrics(categories) : loadAdminMetrics(categories);
  }, options);
}
