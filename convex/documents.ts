import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server.js";
import { requireUser } from "./lib/auth.ts";
import { docTypeValidator, docLinkedTypeValidator } from "./schema/documents.ts";

// ── Upload URL ────────────────────────────────────────────────────────────────

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireUser(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

// ── Save document record after upload ────────────────────────────────────────

export const saveDocument = mutation({
  args: {
    linkedType: docLinkedTypeValidator,
    linkedId: v.string(),
    linkedName: v.optional(v.string()),
    storageId: v.id("_storage"),
    fileName: v.string(),
    contentType: v.optional(v.string()),
    size: v.optional(v.number()),
    docType: docTypeValidator,
    label: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const docId = await ctx.db.insert("documents", {
      ownerId: user._id,
      linkedType: args.linkedType,
      linkedId: args.linkedId,
      linkedName: args.linkedName,
      storageId: args.storageId,
      fileName: args.fileName,
      contentType: args.contentType,
      size: args.size,
      docType: args.docType,
      label: args.label ?? args.fileName,
      notes: args.notes,
      uploadedAt: new Date().toISOString(),
    });
    return docId;
  },
});

// ── List documents for an entity ─────────────────────────────────────────────

export const listForEntity = query({
  args: {
    linkedType: docLinkedTypeValidator,
    linkedId: v.string(),
  },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    const docs = await ctx.db
      .query("documents")
      .withIndex("by_linked", (q) =>
        q.eq("linkedType", args.linkedType).eq("linkedId", args.linkedId),
      )
      .order("desc")
      .collect();

    return await Promise.all(
      docs.map(async (doc) => ({
        ...doc,
        url: await ctx.storage.getUrl(doc.storageId),
      })),
    );
  },
});

// ── List all documents (for the /documents page) ──────────────────────────────

export const listAll = query({
  args: {
    search: v.optional(v.string()),
    docType: v.optional(docTypeValidator),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    let docs;
    if (args.search?.trim()) {
      docs = await ctx.db
        .query("documents")
        .withSearchIndex("search_label", (q) =>
          q.search("label", args.search!.trim()).eq("ownerId", user._id),
        )
        .take(100);
    } else {
      docs = await ctx.db
        .query("documents")
        .withIndex("by_owner", (q) => q.eq("ownerId", user._id))
        .order("desc")
        .take(200);
    }

    if (args.docType) {
      docs = docs.filter((d) => d.docType === args.docType);
    }

    return await Promise.all(
      docs.map(async (doc) => ({
        ...doc,
        url: await ctx.storage.getUrl(doc.storageId),
      })),
    );
  },
});

// ── Update document metadata ──────────────────────────────────────────────────

export const updateDocument = mutation({
  args: {
    documentId: v.id("documents"),
    label: v.optional(v.string()),
    docType: v.optional(docTypeValidator),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const doc = await ctx.db.get("documents", args.documentId);
    if (!doc) throw new ConvexError({ message: "Document not found", code: "NOT_FOUND" });
    if (doc.ownerId !== user._id) {
      throw new ConvexError({ message: "Not authorised", code: "FORBIDDEN" });
    }
    await ctx.db.patch("documents", args.documentId, {
      ...(args.label !== undefined ? { label: args.label } : {}),
      ...(args.docType !== undefined ? { docType: args.docType } : {}),
      ...(args.notes !== undefined ? { notes: args.notes } : {}),
    });
  },
});

// ── Delete document ───────────────────────────────────────────────────────────

export const deleteDocument = mutation({
  args: { documentId: v.id("documents") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const doc = await ctx.db.get("documents", args.documentId);
    if (!doc) throw new ConvexError({ message: "Document not found", code: "NOT_FOUND" });
    if (doc.ownerId !== user._id) {
      throw new ConvexError({ message: "Not authorised", code: "FORBIDDEN" });
    }
    // Delete from Convex Storage
    await ctx.storage.delete(doc.storageId);
    await ctx.db.delete("documents", args.documentId);
  },
});
