import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { listHistoryMock } = vi.hoisted(() => ({ listHistoryMock: vi.fn() }));

vi.mock("@/lib/jobs/automation/ledger", () => ({
  listHistoryForWallet: listHistoryMock,
}));

import { GET } from "../history/route";

const WALLET = "G".padEnd(56, "A");

beforeEach(() => vi.clearAllMocks());

describe("GET /api/automation/history", () => {
  it("rejects a request with no walletAddress", async () => {
    const res = await GET(
      new NextRequest("http://localhost/api/automation/history")
    );
    expect(res.status).toBe(400);
  });

  it("scopes results to the given strategyId", async () => {
    listHistoryMock.mockResolvedValue([
      { strategyId: "s1", id: "a" },
      { strategyId: "s2", id: "b" },
    ]);
    const res = await GET(
      new NextRequest(
        `http://localhost/api/automation/history?walletAddress=${WALLET}&strategyId=s1`
      )
    );
    const json = await res.json();
    expect(json).toEqual([{ strategyId: "s1", id: "a" }]);
  });
});
