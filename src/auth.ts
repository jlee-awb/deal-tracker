import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

/**
 * Interim, single-user authentication — a shared password gate, not real
 * per-user access control. This exists to close the "anyone with the URL
 * can open this" gap while the Entra ID sign-in conversation with IT is
 * still pending; it is not a substitute for that SSO integration and
 * should be replaced once Entra access exists (see README).
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      credentials: { password: { label: "Password", type: "password" } },
      authorize: async (credentials) => {
        const appPassword = process.env.APP_PASSWORD;
        if (!appPassword) {
          throw new Error("APP_PASSWORD is not set — see .env.local.example");
        }
        if (typeof credentials?.password === "string" && credentials.password === appPassword) {
          return { id: "joseph", name: "Joseph" };
        }
        return null;
      },
    }),
  ],
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  // Required for NextAuth to trust the Host header on Vercel; safe here
  // since this deploys to exactly one known host.
  trustHost: true,
});

/** Server-side guard for anything sensitive — Server Actions and
 * orchestrators. Proxy-level redirects (src/proxy.ts) are the first line
 * of defense, but Next.js's own docs flag that a Server Action is invoked
 * directly and shouldn't rely on proxy alone — see the "Good to know" note
 * under Execution order in the proxy.js reference. */
export async function requireSession() {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Not authenticated");
  }
  return session;
}
