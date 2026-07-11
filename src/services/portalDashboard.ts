import { collection, getCountFromServer, query, where, type Query } from "firebase/firestore";
import { db, isFirebaseConfigured } from "../config/firebase";
import {
  getPlatformSettings,
  listPendingReviews,
  listSupplierFeedback,
  listSupplierSubmissions,
  listSuppliers,
  listTermSuggestions,
  listUsers,
} from "./firestore";

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

async function count(ref: Query) {
  return (await getCountFromServer(ref)).data().count;
}

export async function getPortalMetrics(): Promise<PortalMetrics> {
  if (!isFirebaseConfigured) {
    const [users, suppliers, pendingCompanies, rejectedCompanies, reviews, feedback, terms, settings] = await Promise.all([
      listUsers(),
      listSuppliers(),
      listSupplierSubmissions(),
      listSupplierSubmissions(["rejected"]),
      listPendingReviews(),
      listSupplierFeedback(),
      listTermSuggestions("pending"),
      getPlatformSettings(),
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
      categories: settings.taxonomy?.supplierCategories.length || 0,
    };
  }

  const users = collection(db, "users");
  const suppliers = collection(db, "suppliers");
  const submissions = collection(db, "supplierSubmissions");
  const reviews = collection(db, "reviews");
  const feedback = collection(db, "supplierFeedback");
  const terms = collection(db, "termSuggestions");

  const [
    totalUsers,
    supplierAccounts,
    admins,
    superAdmins,
    pendingUsers,
    approvedSuppliers,
    pendingReview,
    possibleDuplicate,
    rejectedCompanies,
    pendingReviews,
    pendingFeedback,
    inReviewFeedback,
    pendingTerms,
    categoryCount,
  ] = await Promise.all([
    count(query(users)),
    count(query(users, where("accountType", "==", "supplier"))),
    count(query(users, where("role", "==", "admin"))),
    count(query(users, where("role", "==", "owner"))),
    count(query(users, where("status", "==", "pending_approval"))),
    count(query(suppliers, where("status", "==", "approved"))),
    count(query(submissions, where("submissionStatus", "==", "pending_review"))),
    count(query(submissions, where("submissionStatus", "==", "possible_duplicate"))),
    count(query(submissions, where("submissionStatus", "==", "rejected"))),
    count(query(reviews, where("status", "==", "pending_review"))),
    count(query(feedback, where("status", "==", "pending"))),
    count(query(feedback, where("status", "==", "in_review"))),
    count(query(terms, where("status", "==", "pending"))),
    getPlatformSettings().then((settings) => settings.taxonomy?.supplierCategories.length || 0),
  ]);

  return {
    totalUsers,
    buyerAccounts: Math.max(0, totalUsers - supplierAccounts - admins - superAdmins),
    supplierAccounts,
    admins,
    superAdmins,
    pendingUsers,
    approvedSuppliers,
    pendingCompanies: pendingReview + possibleDuplicate,
    rejectedCompanies,
    pendingReviews,
    pendingFeedback: pendingFeedback + inReviewFeedback,
    pendingTerms,
    categories: categoryCount,
  };
}
