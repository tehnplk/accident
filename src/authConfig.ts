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
              name: (credentials.username as string) || "health-id",
              profile: rawProfile!,
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
