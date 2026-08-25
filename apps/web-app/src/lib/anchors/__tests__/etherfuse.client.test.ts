import { describe, it, expect, vi, beforeEach } from "vitest";
import { EtherfuseClient } from "../etherfuse/client";
import { AnchorTimeoutError } from "../types";

const anchorRequestMock = vi.hoisted(() => vi.fn());

vi.mock("../http", () => ({
  anchorRequest: anchorRequestMock,
  ANCHOR_REQUEST_TIMEOUT_MS: 15_000,
}));

describe("EtherfuseClient", () => {
  const client = new EtherfuseClient({
    baseUrl: "https://sand.etherfuse.com/api",
    apiKey: "test-key",
    defaultBlockchain: "stellar",
  });

  beforeEach(() => {
    anchorRequestMock.mockReset();
  });

  it("routes request() through anchorRequest", async () => {
    anchorRequestMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "cust-1",
          email: "a@b.com",
          kycStatus: "approved",
          createdAt: "2024-01-01T00:00:00Z",
          updatedAt: "2024-01-01T00:00:00Z",
        }),
        { status: 200 }
      )
    );

    await client.getCustomer({ customerId: "cust-1" });

    expect(anchorRequestMock).toHaveBeenCalledTimes(1);
    expect(anchorRequestMock.mock.calls[0]?.[0]).toContain(
      "https://sand.etherfuse.com/api"
    );
  });

  it("routes simulateFiatReceived through anchorRequest", async () => {
    anchorRequestMock.mockResolvedValue(new Response(null, { status: 200 }));

    const status = await client.simulateFiatReceived("order-1");

    expect(status).toBe(200);
    expect(anchorRequestMock).toHaveBeenCalledWith(
      "https://sand.etherfuse.com/api/ramp/order/fiat_received",
      expect.objectContaining({ method: "POST" }),
      expect.any(Object)
    );
  });

  it("surfaces AnchorTimeoutError from anchorRequest", async () => {
    anchorRequestMock.mockRejectedValue(new AnchorTimeoutError());

    await expect(
      client.getCustomer({ customerId: "cust-1" })
    ).rejects.toBeInstanceOf(AnchorTimeoutError);
  });
});
