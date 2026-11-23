// An App Check token for our own API calls (the server verifies it when APP_CHECK_ENFORCE=true)
export async function appCheckToken(): Promise<string | null> {
  if (typeof window === "undefined" || !process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY) return null
  try {
    const [{ appCheck }, { getToken }] = await Promise.all([import("@/lib/firebase"), import("firebase/app-check")])
    if (!appCheck) return null
    return (await getToken(appCheck)).token
  } catch {
    return null
  }
}
