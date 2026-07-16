export type FirebaseRuntimeTarget = "firebase" | "emulator" | "demo" | "configuration_error";

export interface FirebaseWebConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

interface ResolveFirebaseRuntimeInput {
  config: FirebaseWebConfig;
  forceDemo?: string;
  isDevelopment: boolean;
  useFirebaseEmulators?: string;
}

export function isStrictlyEnabled(value: string | undefined) {
  return value === "true";
}

function isValidApiKey(value: string) {
  return /^AIza[A-Za-z0-9_-]{20,}$/.test(value.trim());
}

function isValidAuthDomain(value: string) {
  return /^(?=.{1,253}$)(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,63}$/.test(value.trim());
}

function isValidProjectId(value: string) {
  return /^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(value.trim());
}

function isValidStorageBucket(value: string) {
  return /^(?=.{1,253}$)(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,63}$/.test(value.trim());
}

function isValidMessagingSenderId(value: string) {
  return /^\d{6,20}$/.test(value.trim());
}

function isValidAppId(value: string) {
  return /^\d+:\d+:web:[A-Za-z0-9_-]{8,}$/.test(value.trim());
}

export function hasRequiredFirebaseConfig(config: FirebaseWebConfig) {
  return isValidApiKey(config.apiKey)
    && isValidAuthDomain(config.authDomain)
    && isValidProjectId(config.projectId)
    && isValidStorageBucket(config.storageBucket)
    && isValidMessagingSenderId(config.messagingSenderId)
    && isValidAppId(config.appId);
}

export function resolveFirebaseRuntime({
  config,
  forceDemo,
  isDevelopment,
  useFirebaseEmulators,
}: ResolveFirebaseRuntimeInput): FirebaseRuntimeTarget {
  if (isDevelopment && isStrictlyEnabled(useFirebaseEmulators)) return "emulator";
  if (isDevelopment && isStrictlyEnabled(forceDemo)) return "demo";
  if (hasRequiredFirebaseConfig(config)) return "firebase";
  return "configuration_error";
}
