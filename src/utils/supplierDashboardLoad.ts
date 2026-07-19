import type { SupplierSubmission } from "../types/domain";

export type SupplierDashboardScope = "submissions" | "rfqs" | "documents" | "conversations";

export interface SupplierDashboardLoaders {
  submissions: () => Promise<SupplierSubmission[]>;
  rfqs: () => Promise<unknown[]>;
  documents: () => Promise<unknown[]>;
  conversations: () => Promise<unknown[]>;
}

export interface SupplierDashboardLoadError {
  scope: SupplierDashboardScope;
  code: string;
  critical: boolean;
}

export interface SupplierDashboardLoadResult {
  submissions: SupplierSubmission[];
  rfqCount: number;
  documentCount: number;
  conversationCount: number;
  errors: SupplierDashboardLoadError[];
}

function errorCode(reason: unknown) {
  if (reason && typeof reason === "object" && "code" in reason) {
    return String((reason as { code?: unknown }).code || "unknown");
  }
  return reason instanceof Error && reason.name ? reason.name : "unknown";
}

export async function loadSupplierDashboardData(loaders: SupplierDashboardLoaders): Promise<SupplierDashboardLoadResult> {
  const scopes: SupplierDashboardScope[] = ["submissions", "rfqs", "documents", "conversations"];
  const results = await Promise.allSettled([
    loaders.submissions(),
    loaders.rfqs(),
    loaders.documents(),
    loaders.conversations(),
  ]);
  const errors = results.flatMap((result, index) => result.status === "rejected" ? [{
    scope: scopes[index],
    code: errorCode(result.reason),
    critical: scopes[index] === "submissions",
  }] : []);

  return {
    submissions: results[0].status === "fulfilled" ? results[0].value : [],
    rfqCount: results[1].status === "fulfilled" ? results[1].value.length : 0,
    documentCount: results[2].status === "fulfilled" ? results[2].value.length : 0,
    conversationCount: results[3].status === "fulfilled" ? results[3].value.length : 0,
    errors,
  };
}
