// Backward-compatible entry point. The shared fixture now seeds all eight
// deterministic internal Emulator identities and fails closed without both hosts.
await import("./seed-internal-emulator-accounts.mjs");
