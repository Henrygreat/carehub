import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authenticateCredentials } from "@/lib/authenticate";
import { db } from "@/lib/db";

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt", maxAge: 60 * 60 * 8 },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, request) {
        const forwardedFor =
          request.headers.get("x-forwarded-for")?.split(",")[0]?.trim().slice(0, 64) ??
          "unknown";
        return authenticateCredentials(credentials, forwardedFor);
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) {
        const authenticatedUser = await db.user.findUnique({
          where: { id: user.id },
          select: { sessionVersion: true, disabledAt: true },
        });
        if (!authenticatedUser || authenticatedUser.disabledAt) {
          return { ...token, sub: undefined, sessionVersion: undefined };
        }
        token.sub = user.id;
        token.sessionVersion = authenticatedUser.sessionVersion;
      } else if (token.sub && typeof token.sessionVersion === "number") {
        const currentUser = await db.user.findUnique({
          where: { id: token.sub },
          select: { sessionVersion: true, disabledAt: true },
        });
        if (
          !currentUser ||
          currentUser.disabledAt ||
          currentUser.sessionVersion !== token.sessionVersion
        ) {
          return { ...token, sub: undefined, sessionVersion: undefined };
        }
      }
      return token;
    },
    session({ session, token }) {
      if (session.user && token.sub) session.user.id = token.sub;
      return session;
    },
  },
});
