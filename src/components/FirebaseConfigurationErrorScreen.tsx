export function FirebaseConfigurationErrorScreen() {
  return (
    <main className="min-h-screen bg-[#fffaf4] px-6 py-16 text-[#062b4d]">
      <section
        role="alert"
        className="mx-auto max-w-xl rounded-lg border border-[#f3d7bf] bg-white p-8 text-center shadow-sm"
      >
        <h1 className="text-2xl font-bold">Platform configuration unavailable</h1>
        <p className="mt-4 leading-7 text-[#49647c]">
          Mujahiz IQ cannot start because its secure Firebase configuration is unavailable.
          Please contact the platform administrator.
        </p>
        <p className="mt-5 border-t border-[#f3d7bf] pt-5 leading-7" dir="rtl">
          لا يمكن تشغيل منصة مجهز حالياً لعدم توفر إعدادات Firebase الآمنة. يرجى التواصل مع إدارة المنصة.
        </p>
        <p className="mt-5 text-sm font-semibold text-[#f37021]">
          Error code: FIREBASE_CONFIGURATION_REQUIRED
        </p>
      </section>
    </main>
  );
}
