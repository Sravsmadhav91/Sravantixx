import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

/** Resolves the signed-in end user's row. Throws when unauthenticated. */
export async function requireUser(
  ctx: QueryCtx | MutationCtx,
): Promise<Doc<"users">> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new ConvexError({
      code: "UNAUTHENTICATED",
      message: "Please sign in to continue",
    });
  }
  const user = await ctx.db
    .query("users")
    .withIndex("by_token", (q) =>
      q.eq("tokenIdentifier", identity.tokenIdentifier),
    )
    .unique();
  if (!user) {
    throw new ConvexError({
      code: "NOT_FOUND",
      message: "Your account is still being set up. Please refresh.",
    });
  }
  return user;
}

/**
 * Returns the "data owner" ID to scope all DB queries.
 * - Owner users: their own _id.
 * - Non-owner users (staff and all scoped roles): the linkedOwnerId they were invited under.
 */
export function effectiveOwnerId(user: Doc<"users">): Id<"users"> {
  if (user.role && user.role !== "owner" && user.linkedOwnerId) {
    return user.linkedOwnerId;
  }
  return user._id;
}

/** Requires the user to be an owner (not staff or any scoped role). Throws FORBIDDEN otherwise. */
export async function requireOwner(
  ctx: QueryCtx | MutationCtx,
): Promise<Doc<"users">> {
  const user = await requireUser(ctx);
  if (user.role && user.role !== "owner") {
    throw new ConvexError({
      code: "FORBIDDEN",
      message: "Only the account owner can perform this action",
    });
  }
  return user;
}

/** Loads a project and asserts the effective owner owns it. */
export async function requireOwnedProject(
  ctx: QueryCtx | MutationCtx,
  projectId: Id<"projects">,
  ownerId: Id<"users">,
): Promise<Doc<"projects">> {
  const project = await ctx.db.get("projects", projectId);
  if (!project) {
    throw new ConvexError({ code: "NOT_FOUND", message: "Project not found" });
  }
  if (project.ownerId !== ownerId) {
    throw new ConvexError({
      code: "FORBIDDEN",
      message: "You do not have access to this project",
    });
  }
  return project;
}

/** Loads a unit and asserts the effective owner owns it. */
export async function requireOwnedUnit(
  ctx: QueryCtx | MutationCtx,
  unitId: Id<"units">,
  ownerId: Id<"users">,
): Promise<Doc<"units">> {
  const unit = await ctx.db.get("units", unitId);
  if (!unit) {
    throw new ConvexError({ code: "NOT_FOUND", message: "Unit not found" });
  }
  if (unit.ownerId !== ownerId) {
    throw new ConvexError({
      code: "FORBIDDEN",
      message: "You do not have access to this unit",
    });
  }
  return unit;
}
