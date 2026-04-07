import NextAuth, { type Session, type NextAuthConfig } from "next-auth";
import type { JWT } from "next-auth/jwt";
import CredentialsProvider from "next-auth/providers/credentials";
import { profileHasActiveHoscode } from "@/lib/hospital-access";

const authOptions: NextAuthConfig = {
  trustHost: true,
  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 24, // 24 ชั่วโมง
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      async authorize(credentials) {
        if (credentials["cred-way"] === "health-id") {
          try {
            const rawProfile = credentials.profile;
            const profile = typeof rawProfile === "string" ? JSON.parse(rawProfile) : rawProfile;

            if (!(await profileHasActiveHoscode(profile))) {
              return null;
            }

            return {
              id: (credentials.username as string) || "health-id",
              name: (credentials.username as string) || "health-id",
              profile: rawProfile!,
            };
          } catch {
            return null;
          }
        }

        if (credentials["cred-way"] === "user-pass") {
          try {
            const username = (credentials.username as string)?.trim();
            const password = credentials.password as string;
            if (!username || !password) return null;

            // Lazy import to avoid pg in edge runtime
            const { verifyUserPassword } = await import("@/lib/user-auth");
            const user = await verifyUserPassword(username, password);
            if (!user) return null;

            // Build profile matching OAuth structure
            const profile = JSON.stringify({
              provider_id: "",
              account_id: "",
              title_th: "",
              firstname_th: "",
              lastname_th: "",
              name_th: user.username,
              hcode: user.hcode,
              login_type: "user-pass",
              username: user.username,
              organization: [
                JSON.stringify({
                  hcode: user.hcode,
                  hname_th: user.hname,
                  position: "",
                  affiliation: "",
                }),
              ],
            });

            return {
              id: String(user.id),
              name: user.username,
              profile,
            };
          } catch {
            return null;
          }
        }

        return null;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }: { token: JWT; user?: any }) {
      if (user) {
        token.profile = (user as any).profile;
      }
      return token;
    },
    async session({ session, token }: { session: Session; token: JWT }) {
      if (token && session.user) {
        (session.user as any).profile = (token as any).profile;
      }
      return session;
    },
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(authOptions);
