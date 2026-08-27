import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  signTransactionMock,
  sendTransactionMock,
  pollTransactionMock,
  waitForTransactionMock,
  getSorobanServerMock,
} = vi.hoisted(() => ({
  signTransactionMock: vi.fn(),
  sendTransactionMock: vi.fn(),
  pollTransactionMock: vi.fn(),
  waitForTransactionMock: vi.fn(),
  getSorobanServerMock: vi.fn(),
}));

vi.mock("@stellar/stellar-sdk", () => ({
  TransactionBuilder: {
    fromXDR: vi.fn(() => ({})),
  },
}));

vi.mock("../sorobanServer", () => ({
  getSorobanServer: getSorobanServerMock,
}));

vi.mock("../waitForTransaction", () => ({
  waitForTransaction: waitForTransactionMock,
}));

import { executeTransaction } from "../executeTransaction";

const server = {
  sendTransaction: sendTransactionMock,
  pollTransaction: pollTransactionMock,
};

beforeEach(() => {
  vi.clearAllMocks();
  getSorobanServerMock.mockReturnValue(server);
  signTransactionMock.mockResolvedValue({ signedTxXdr: "SIGNED" });
  sendTransactionMock.mockResolvedValue({ hash: "HASH123", status: "PENDING" });
  waitForTransactionMock.mockResolvedValue({ status: "SUCCESS" });
  pollTransactionMock.mockResolvedValue({ status: "SUCCESS" });
});

describe("executeTransaction", () => {
  const baseOptions = {
    xdr: "XDR",
    signTransaction: signTransactionMock,
    networkPassphrase: "Test SDF Network ; September 2015",
    address: "GTEST",
  };

  it("returns success after wait confirmation", async () => {
    const result = await executeTransaction(baseOptions);
    expect(result).toEqual({
      status: "success",
      hash: "HASH123",
      confirmation: { status: "SUCCESS" },
    });
    expect(waitForTransactionMock).toHaveBeenCalledWith(
      "HASH123",
      server,
      undefined
    );
  });

  it("returns success without confirmation when confirmation is none", async () => {
    const result = await executeTransaction({
      ...baseOptions,
      confirmation: "none",
    });
    expect(result).toEqual({ status: "success", hash: "HASH123" });
    expect(waitForTransactionMock).not.toHaveBeenCalled();
  });

  it("returns contract_error for on-chain contract failures", async () => {
    waitForTransactionMock.mockRejectedValue(
      new Error("HostError: Error(Contract, #72)")
    );

    const result = await executeTransaction({
      ...baseOptions,
      contractName: "rwa-lending",
    });

    expect(result.status).toBe("contract_error");
    if (result.status === "contract_error") {
      expect(result.error.kind).toBe("withdrawal_queue_not_expired");
    }
  });

  it("returns network_error for submission ERROR status without contract mapping", async () => {
    sendTransactionMock.mockResolvedValue({ hash: "HASH123", status: "ERROR" });

    const result = await executeTransaction(baseOptions);
    expect(result.status).toBe("network_error");
  });

  it("returns user_rejected when the wallet rejects signing", async () => {
    signTransactionMock.mockRejectedValue(
      new Error("User rejected the request")
    );

    const result = await executeTransaction(baseOptions);
    expect(result).toEqual({ status: "user_rejected" });
  });

  it("uses poll confirmation when configured", async () => {
    const result = await executeTransaction({
      ...baseOptions,
      confirmation: "poll",
      pollOptions: { attempts: 30 },
    });

    expect(result.status).toBe("success");
    expect(pollTransactionMock).toHaveBeenCalledWith("HASH123", {
      attempts: 30,
    });
    expect(waitForTransactionMock).not.toHaveBeenCalled();
  });
});
