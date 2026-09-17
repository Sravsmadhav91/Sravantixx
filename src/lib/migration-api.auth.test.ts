import { describe, expect, it, vi } from "vitest";

const supabaseAuthGetSession = vi.fn();

vi.mock("@/lib/supabase.ts", () => ({
  supabase: {
    auth: {
      getSession: supabaseAuthGetSession,
    },
  },
}));

describe("migrationHeaders", () => {
  it("falls back to X-Owner-Id in development-safe mode", async () => {
    vi.resetModules();
    vi.stubEnv("VITE_MIGRATION_API", "true");
    vi.stubEnv("VITE_MIGRATION_OWNER_ID", "owner-123");
    vi.stubEnv("VITE_MIGRATION_ALLOW_OWNER_FALLBACK", "true");
    vi.stubEnv("MODE", "development");
    supabaseAuthGetSession.mockResolvedValue({ data: { session: null } });

    const { migrationHeaders } = await import("./migration-api.ts");
    await expect(migrationHeaders()).resolves.toMatchObject({ "X-Owner-Id": "owner-123" });
  });

  it("requires a bearer token in production mode without fallback", async () => {
    vi.resetModules();
    vi.stubEnv("VITE_MIGRATION_API", "true");
    vi.stubEnv("VITE_MIGRATION_OWNER_ID", "owner-123");
    vi.stubEnv("VITE_MIGRATION_ALLOW_OWNER_FALLBACK", "false");
    vi.stubEnv("MODE", "production");
    supabaseAuthGetSession.mockResolvedValue({ data: { session: null } });

    const { migrationHeaders } = await import("./migration-api.ts");
    await expect(migrationHeaders()).rejects.toThrow(/Supabase session or a development-safe migration owner header is required/i);
  });
});
