import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import type { Role } from "@/types/auth";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  pages: {
    signIn: "/admin/login",
    error: "/admin/login",
  },
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider !== "google" || !user.email) {
        return false;
      }

      // Look up the user by email in our users table
      const [existingUser] = await db
        .select()
        .from(users)
        .where(eq(users.email, user.email))
        .limit(1);

      if (!existingUser) {
        // Not invited — reject login
        return "/admin/login?error=not-invited";
      }

      if (existingUser.status === "deactivated") {
        return "/admin/login?error=deactivated";
      }

      if (existingUser.status === "invited") {
        // First-time login: activate the account
        await db
          .update(users)
          .set({
            status: "active",
            googleId: account.providerAccountId,
            name: user.name || existingUser.name,
            image: user.image || existingUser.image,
            activatedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(users.id, existingUser.id));
      } else {
        // Returning user: update profile info
        await db
          .update(users)
          .set({
            name: user.name || existingUser.name,
            image: user.image || existingUser.image,
            updatedAt: new Date(),
          })
          .where(eq(users.id, existingUser.id));
      }

      return true;
    },

    async jwt({ token, user, account }) {
      if (account && user?.email) {
        // On initial sign-in, fetch user data from our DB
        const [dbUser] = await db
          .select()
          .from(users)
          .where(eq(users.email, user.email))
          .limit(1);

        if (dbUser) {
          token.userId = dbUser.id;
          token.roles = dbUser.roles as Role[];
        }
      }
      return token;
    },

    async session({ session, token }) {
      if (token.userId) {
        session.user.id = token.userId as string;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (session.user as any).roles = token.roles as Role[];
      }
      return session;
    },
  },
  session: {
    strategy: "jwt",
  },
});
