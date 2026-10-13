import { describe, it, expect, vi, beforeEach } from "vitest";

const state = { admin: false, product: { id: "r1", title: "R1", price_cents: 2900, is_free: false, is_published: true } as Record<string, unknown>, ent: null as unknown };

vi.mock("@/integrations/supabase/client.server", () => {
  const q = (table: string) => {
    const chain: Record<string, unknown> = {};
    chain.select = () => chain;
    chain.eq = () => chain;
    chain.upsert = async () => ({});
    chain.maybeSingle = async () => ({ data: table === "report_products" ? state.product : state.ent, error: null });
    return chain;
  };
  return { supabaseAdmin: { rpc: async () => ({ data: state.admin, error: null }), from: q } };
});

import { resolveReportAccess } from "./access.server";

beforeEach(() => { state.admin = false; state.ent = null; state.product.is_published = true; });

describe("report access", () => {
  it("admin gets a paid report free without any entitlement", async () => {
    state.admin = true;
    expect((await resolveReportAccess("u", "r1")).reason).toBe("admin");
  });
  it("admin can open unpublished reports", async () => {
    state.admin = true; state.product.is_published = false;
    expect((await resolveReportAccess("u", "r1")).allowed).toBe(true);
  });
  it("ordinary user without entitlement is locked from a paid report", async () => {
    expect((await resolveReportAccess("u", "r1")).reason).toBe("locked");
  });
});
