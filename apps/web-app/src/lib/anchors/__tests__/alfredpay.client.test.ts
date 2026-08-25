import { describe, it, expect, vi, beforeEach } from "vitest";
import { AlfredPayClient } from "../alfredpay/client";
import { AnchorTimeoutError } from "../types";

const anchorRequestMock = vi.hoisted(() => vi.fn());

vi.mock("../http", () => ({
  anchorRequest: anchorRequestMock,
  ANCHOR_REQUEST_TIMEOUT_MS: 15_000,
}));

describe("AlfredPayClient", () => {
  const client = new AlfredPayClient({
    baseUrl: "https://api.alfredpay.io",
    apiKey: "key",
    apiSecret: "secret",
  });

  beforeEach(() => {
    anchorRequestMock.mockReset();
  });

  it("routes request() through anchorRequest", async () => {
    anchorRequestMock.mockResolvedValue(
      new Response(JSON.stringify({ status: "APPROVED" }), { status: 200 })
    );

    await client.getKycStatus("cust-1");

    expect(anchorRequestMock).toHaveBeenCalledTimes(1);
    expect(anchorRequestMock.mock.calls[0]?.[0]).toContain(
      "https://api.alfredpay.io"
    );
  });

  it("routes submitKycFile through anchorRequest", async () => {
    anchorRequestMock.mockResolvedValue(
      new Response(JSON.stringify({ fileId: "file-1" }), { status: 200 })
    );

    const file = new File(["content"], "id.pdf", { type: "application/pdf" });
    await client.submitKycFile(
      "cust-1",
      "sub-1",
      "NATIONAL_ID_FRONT",
      file,
      "id.pdf"
    );

    expect(anchorRequestMock).toHaveBeenCalledWith(
      expect.stringContaining("/customers/cust-1/kyc/sub-1/files"),
      expect.objectContaining({ method: "POST" }),
      expect.any(Object)
    );
  });

  it("surfaces AnchorTimeoutError from anchorRequest", async () => {
    anchorRequestMock.mockRejectedValue(new AnchorTimeoutError());

    await expect(client.getKycStatus("cust-1")).rejects.toBeInstanceOf(
      AnchorTimeoutError
    );
  });
});
