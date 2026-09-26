import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import type { VenueCandidate } from "@/features/automation/types/automation";

const buildCandidatesMock = vi.fn();

vi.mock("@/lib/services/candidates.service", () => ({
  buildCandidates: (...args: unknown[]) => buildCandidatesMock(...args),
}));

const { GET } = await import("../route");

function req(qs: string) {
  return new NextRequest(
    `http://localhost/api/automation/candidates${qs}`
  );
}

function sampleCandidate(
  overrides: Partial<VenueCandidate> = {}
): VenueCandidate {
  return {
    id: "neko-vault",
    kind: "vault",
    name: "Neko Vault",
    asset: "USDC",
    grossApyBps: 850,
    borrowCostBps: 0,
    protocolFeeBps: 30,
    amortizedGasBps: 5,
    netApyBps: 815,
    availableLiquidityUsd: null,
    currentAllocationPct: 40,
    availability: "partial",
    unavailableReason: "Vault TVL not exposed by a public getter",
    ...overrides,
  };
}

describe("GET /api/automation/candidates", () => {
  beforeEach(() => {
    buildCandidatesMock.mockReset();
  });

  it("400s when walletAddress is missing", async () => {
    const res = await GET(req(""));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/walletAddress/);
    expect(buildCandidatesMock).not.toHaveBeenCalled();
  });

  it("passes the wallet address to the service and returns its result", async () => {
    const payload = [sampleCandidate()];
    buildCandidatesMock.mockResolvedValueOnce(payload);

    const res = await GET(req("?walletAddress=GWALLET"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as VenueCandidate[];
    expect(body).toHaveLength(1);
    expect(body[0].id).toBe("neko-vault");
    expect(buildCandidatesMock).toHaveBeenCalledWith("GWALLET");
  });

  it("marks unavailable venues explicitly in the response", async () => {
    const payload = [
      sampleCandidate({
        id: "neko-lending-usdc",
        kind: "lending",
        availability: "unavailable",
        grossApyBps: null,
        netApyBps: null,
        availableLiquidityUsd: null,
        unavailableReason: "RPC unreachable",
      }),
    ];
    buildCandidatesMock.mockResolvedValueOnce(payload);

    const res = await GET(req("?walletAddress=GWALLET"));
    const body = (await res.json()) as VenueCandidate[];
    expect(body[0].availability).toBe("unavailable");
    expect(body[0].netApyBps).toBeNull();
    expect(body[0].unavailableReason).toBeTruthy();
  });

  it("returns 500 when the service throws", async () => {
    buildCandidatesMock.mockRejectedValueOnce(new Error("boom"));
    const res = await GET(req("?walletAddress=GWALLET"));
    expect(res.status).toBe(500);
  });
});
