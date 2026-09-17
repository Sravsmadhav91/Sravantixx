/**
 * Team management: invite team members with a scoped role, accept invites, list/remove members.
 * Only owners can invite/remove/change roles. Non-owners cannot manage the team.
 */
import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireOwner, requireUser, effectiveOwnerId } from "./lib/auth.ts";
import { ROLE_LABELS, ROLE_DESCRIPTIONS, SCOPED_ROLES } from "./lib/rbac.ts";

const teamRoleValidator = v.union(
  v.literal("staff"),
  v.literal("accountant"),
  v.literal("sales"),
  v.literal("site_engineer"),
);

// ── Role catalog (for the invite/edit-role dropdown) ──────────────────────────

export const listRoles = query({
  args: {},
  handler: async () => {
    return [
      { role: "staff" as const, label: ROLE_LABELS.staff, description: ROLE_DESCRIPTIONS.staff },
      ...SCOPED_ROLES.map((role) => ({
        role,
        label: ROLE_LABELS[role],
        description: ROLE_DESCRIPTIONS[role],
      })),
    ];
  },
});

// ── Invite ────────────────────────────────────────────────────────────────────

export const invite = mutation({
  args: { email: v.string(), role: v.optional(teamRoleValidator) },
  handler: async (ctx, args): Promise<{ teamMemberId: string }> => {
    const owner = await requireOwner(ctx);
    const email = args.email.trim().toLowerCase();

    if (!email || !email.includes("@")) {
      throw new ConvexError({ code: "BAD_REQUEST", message: "Enter a valid email address" });
    }

    // Prevent duplicate invite from the same owner
    const existing = await ctx.db
      .query("teamMembers")
      .withIndex("by_owner", (q) => q.eq("ownerId", owner._id))
      .collect();
    const dup = existing.find((m) => m.email === email);
    if (dup) {
      throw new ConvexError({ code: "CONFLICT", message: "This email is already on your team" });
    }

    const id = await ctx.db.insert("teamMembers", {
      ownerId: owner._id,
      email,
      status: "invited",
      invitedAt: new Date().toISOString(),
      role: args.role ?? "staff",
    });

    return { teamMemberId: id };
  },
});

// ── List members ──────────────────────────────────────────────────────────────

export const listMembers = query({
  args: {},
  handler: async (ctx) => {
    const owner = await requireOwner(ctx);
    return ctx.db
      .query("teamMembers")
      .withIndex("by_owner", (q) => q.eq("ownerId", owner._id))
      .order("desc")
      .collect();
  },
});

// ── Change a member's role ────────────────────────────────────────────────────

export const setMemberRole = mutation({
  args: { teamMemberId: v.id("teamMembers"), role: teamRoleValidator },
  handler: async (ctx, args) => {
    const owner = await requireOwner(ctx);
    const member = await ctx.db.get("teamMembers", args.teamMemberId);
    if (!member) throw new ConvexError({ code: "NOT_FOUND", message: "Member not found" });
    if (member.ownerId !== owner._id)
      throw new ConvexError({ code: "FORBIDDEN", message: "Access denied" });

    await ctx.db.patch("teamMembers", args.teamMemberId, { role: args.role });

    // If they've already signed in and are linked, update their live role too
    if (member.status === "active") {
      const linkedUser = await ctx.db
        .query("users")
        .withIndex("by_token")
        .collect()
        .then((rows) =>
          rows.find(
            (u) => u.linkedOwnerId === owner._id && u.email?.toLowerCase() === member.email,
          ),
        );
      if (linkedUser) {
        await ctx.db.patch("users", linkedUser._id, { role: args.role });
      }
    }
    return null;
  },
});

// ── Remove member ─────────────────────────────────────────────────────────────

export const removeMember = mutation({
  args: { teamMemberId: v.id("teamMembers") },
  handler: async (ctx, args) => {
    const owner = await requireOwner(ctx);
    const member = await ctx.db.get("teamMembers", args.teamMemberId);
    if (!member) throw new ConvexError({ code: "NOT_FOUND", message: "Member not found" });
    if (member.ownerId !== owner._id)
      throw new ConvexError({ code: "FORBIDDEN", message: "Access denied" });

    // Unlink the member's account if they've already signed in
    const linkedUser = await ctx.db
      .query("users")
      .withIndex("by_token")
      .collect()
      .then((rows) =>
        rows.find(
          (u) =>
            !!u.role &&
            u.role !== "owner" &&
            u.linkedOwnerId === owner._id &&
            u.email?.toLowerCase() === member.email,
        ),
      );

    if (linkedUser) {
      await ctx.db.patch("users", linkedUser._id, {
        role: "owner",
        linkedOwnerId: undefined,
      });
    }

    await ctx.db.delete("teamMembers", args.teamMemberId);
    return null;
  },
});

// ── Accept invite (called automatically on the team member's first sign-in) ──

export const acceptInvite = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const email = user.email?.toLowerCase();
    if (!email) return { accepted: false };

    // Find a pending invite for this email
    const invite = await ctx.db
      .query("teamMembers")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();

    if (!invite || invite.status === "active") return { accepted: false };

    // Link this user to the owner with their assigned role
    await ctx.db.patch("users", user._id, {
      role: invite.role ?? "staff",
      linkedOwnerId: invite.ownerId,
    });

    // Mark the invite as active
    await ctx.db.patch("teamMembers", invite._id, {
      status: "active",
      memberName: user.name ?? undefined,
    });

    return { accepted: true, ownerId: invite.ownerId };
  },
});

// ── Get current user role (used by frontend hook) ────────────────────────────

export const getMyRole = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    return {
      role: user.role ?? "owner",
      linkedOwnerId: user.linkedOwnerId ?? null,
    };
  },
});

// ── Assignable users (owner + active team members), for lead assignment dropdowns ──

export const listAssignable = query({
  args: {},
  handler: async (ctx): Promise<Array<{ userId: string; name: string }>> => {
    const user = await requireUser(ctx);
    const ownerId = effectiveOwnerId(user);

    const owner = await ctx.db.get("users", ownerId);
    const result: Array<{ userId: string; name: string }> = [];
    if (owner) {
      result.push({ userId: owner._id, name: `${owner.name ?? owner.email ?? "Owner"} (Owner)` });
    }

    const allUsers = await ctx.db
      .query("users")
      .withIndex("by_token")
      .collect();
    for (const member of allUsers) {
      if (member.role && member.role !== "owner" && member.linkedOwnerId === ownerId) {
        result.push({
          userId: member._id,
          name: `${member.name ?? member.email ?? "Team member"} (${ROLE_LABELS[member.role]})`,
        });
      }
    }
    return result;
  },
});
