import type { Locale } from "../types/domain";

export type EmailActionMode = "resetPassword" | "verifyEmail" | "recoverEmail";
export type EmailActionState = "success" | "invalid" | "expired" | "used" | "unavailable";

export interface ParsedEmailAction {
  mode: EmailActionMode;
  code: string;
  continuePath: string;
  locale: Locale;
  requestedLanguage?: string;
  apiKey?: string;
}

interface ActionCodeInformation {
  operation: string;
}

const CANONICAL_ORIGIN = "https://mujahiz.com";
const APPROVED_CONTINUE_ORIGINS = new Set([
  CANONICAL_ORIGIN,
  "https://www.mujahiz.com",
  "https://mujahiziq.web.app",
]);

const EXPECTED_OPERATIONS: Record<Exclude<EmailActionMode, "resetPassword">, string> = {
  verifyEmail: "VERIFY_EMAIL",
  recoverEmail: "RECOVER_EMAIL",
};

function emailActionError(code: string) {
  const error = new Error(code) as Error & { code: string };
  error.code = code;
  return error;
}

function errorCode(error: unknown) {
  if (!error || typeof error !== "object" || !("code" in error)) return "";
  return String((error as { code?: unknown }).code || "");
}

function parseRequestedLanguage(value: string | null, fallback: Locale) {
  const requestedLanguage = value?.trim() || "";
  if (!/^(?:ar|en)(?:-[a-z0-9]{1,8})*$/i.test(requestedLanguage)) {
    return { locale: fallback };
  }
  return {
    locale: requestedLanguage.toLowerCase().startsWith("ar") ? "ar" as const : "en" as const,
    requestedLanguage,
  };
}

export function safeContinuePath(value: string | null | undefined, fallback = "/login") {
  if (!value) return fallback;

  try {
    const isInternalPath = value.startsWith("/") && !value.startsWith("//") && !value.includes("\\");
    const parsed = isInternalPath ? new URL(value, `${CANONICAL_ORIGIN}/`) : new URL(value);

    if (
      parsed.protocol !== "https:"
      || !APPROVED_CONTINUE_ORIGINS.has(parsed.origin)
      || parsed.username
      || parsed.password
    ) {
      return fallback;
    }

    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}

export function parseEmailAction(search: string, fallbackLocale: Locale = "en"): ParsedEmailAction {
  const parameters = new URLSearchParams(search);
  const mode = parameters.get("mode");
  const code = parameters.get("oobCode") || "";

  if (mode !== "resetPassword" && mode !== "verifyEmail" && mode !== "recoverEmail") {
    throw emailActionError("email-action/invalid-mode");
  }
  if (!code) throw emailActionError("email-action/missing-code");

  const language = parseRequestedLanguage(parameters.get("lang"), fallbackLocale);
  const apiKey = parameters.get("apiKey") || undefined;

  return {
    mode,
    code,
    continuePath: safeContinuePath(parameters.get("continueUrl")),
    ...language,
    ...(apiKey ? { apiKey } : {}),
  };
}

export function buildResetPasswordSearch(action: ParsedEmailAction) {
  if (action.mode !== "resetPassword") {
    throw emailActionError("email-action/invalid-mode");
  }

  const parameters = new URLSearchParams({
    mode: action.mode,
    oobCode: action.code,
    continueUrl: action.continuePath,
  });
  if (action.requestedLanguage) parameters.set("lang", action.requestedLanguage);
  return `?${parameters.toString()}`;
}

export function emailActionErrorState(
  error: unknown,
  phase: "check" | "apply" = "check",
): EmailActionState {
  const code = errorCode(error);
  if (code === "auth/expired-action-code") return "expired";
  if (code === "auth/invalid-action-code") return phase === "apply" ? "used" : "invalid";
  if (
    code === "email-action/invalid-mode"
    || code === "email-action/missing-code"
    || code === "email-action/mismatched-mode"
  ) {
    return "invalid";
  }
  return "unavailable";
}

export async function completeEmailAction({
  action,
  checkCode,
  applyCode,
}: {
  action: ParsedEmailAction;
  checkCode: (code: string) => Promise<ActionCodeInformation>;
  applyCode: (code: string) => Promise<void>;
}): Promise<EmailActionState> {
  if (action.mode === "resetPassword") return "invalid";

  let information: ActionCodeInformation;
  try {
    information = await checkCode(action.code);
  } catch (error) {
    return emailActionErrorState(error, "check");
  }

  if (information.operation !== EXPECTED_OPERATIONS[action.mode]) return "invalid";

  try {
    await applyCode(action.code);
    return "success";
  } catch (error) {
    return emailActionErrorState(error, "apply");
  }
}
