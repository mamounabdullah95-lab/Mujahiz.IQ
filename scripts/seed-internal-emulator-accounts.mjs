import {
  createInternalEmulatorTestEnvironment,
  internalEmulatorAccountList,
  resetInternalEmulatorState,
  seedInternalEmulatorAccounts,
} from "../tests/helpers/internal-emulator-accounts.mjs";

const environment = await createInternalEmulatorTestEnvironment();
try {
  await resetInternalEmulatorState(environment);
  await seedInternalEmulatorAccounts(environment);
  console.log(JSON.stringify({
    target: "Firebase Auth and Firestore Emulators only",
    accounts: internalEmulatorAccountList.map(({ uid, email, accountType, fixtureState, supplierProfileId }) => ({
      uid,
      email,
      accountType,
      fixtureState,
      ...(supplierProfileId ? { supplierProfileId } : {}),
    })),
  }, null, 2));
} finally {
  await environment.cleanup();
}
