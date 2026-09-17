import { ConvexError } from "convex/values";
import { mutation, query } from "./_generated/server";
import { api } from "./_generated/api.js";

export const updateCurrentUser = mutation({
  args: {},
  handler: async (ctx): Promise<string> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "User not logged in",
      });
    }

    // Check if we've already stored this identity before.
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();
    if (user !== null) {
      // Sync name/email in case they changed
      await ctx.db.patch("users", user._id, {
        name: identity.name,
        email: identity.email,
      });
      return user._id;
    }

    // New user — only allowed if this is the very first sign-in ever (bootstraps
    // the account owner) or the email has a pending team invite from an owner.
    // Everyone else is blocked from creating an account.
    const anyExistingUser = await ctx.db.query("users").take(1);
    if (anyExistingUser.length > 0) {
      const email = identity.email?.toLowerCase();
      const invite = email
        ? await ctx.db
            .query("teamMembers")
            .withIndex("by_email", (q) => q.eq("email", email))
            .first()
        : null;
      if (!invite) {
        throw new ConvexError({
          code: "FORBIDDEN",
          message:
            "Access restricted. Your account has not been authorized. Please contact the administrator for access.",
        });
      }
    }

    const newId = await ctx.db.insert("users", {
      name: identity.name,
      email: identity.email,
      tokenIdentifier: identity.tokenIdentifier,
    });

    // Attempt to auto-accept a pending team invite
    await ctx.runMutation(api.team.acceptInvite, {});

    return newId;
  },
});

export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "Called getCurrentUser without authentication present",
      });
    }
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();
    return user;
  },
});
