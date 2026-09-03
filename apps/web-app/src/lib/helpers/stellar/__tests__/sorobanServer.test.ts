import { describe, it, expect, vi, beforeEach } from "vitest";

const { ServerMock, stellarNetworkMock } = vi.hoisted(() => {
  const instances: Array<{ url: string; options: { allowHttp?: boolean } }> =
    [];
  class ServerMock {
    url: string;
    options: { allowHttp?: boolean };
    constructor(url: string, options: { allowHttp?: boolean } = {}) {
      this.url = url;
      this.options = options;
      instances.push({ url, options });
    }
  }
  return {
    ServerMock,
    instances,
    stellarNetworkMock: vi.fn(() => "TESTNET"),
  };
});

vi.mock("@stellar/stellar-sdk", () => ({
  rpc: { Server: ServerMock },
}));

vi.mock("@/lib/config/stellar.config", () => ({
  rpcUrl: "https://soroban-testnet.stellar.org",
  get stellarNetwork() {
    return stellarNetworkMock();
  },
}));

import { getSorobanServer, resetSorobanServerCache } from "../sorobanServer";

beforeEach(() => {
  resetSorobanServerCache();
  stellarNetworkMock.mockReturnValue("TESTNET");
});

describe("getSorobanServer", () => {
  it("returns a memoized singleton for the same URL", () => {
    const a = getSorobanServer();
    const b = getSorobanServer();
    expect(a).toBe(b);
  });

  it("creates separate instances for different URLs", () => {
    const defaultServer = getSorobanServer();
    const customServer = getSorobanServer("https://custom-rpc.example");
    expect(defaultServer).not.toBe(customServer);
  });

  it("sets allowHttp when stellarNetwork is LOCAL", () => {
    stellarNetworkMock.mockReturnValue("LOCAL");
    resetSorobanServerCache();
    const server = getSorobanServer("http://localhost:8000/rpc");
    expect(
      (server as { options: { allowHttp?: boolean } }).options.allowHttp
    ).toBe(true);
  });

  it("does not set allowHttp for non-LOCAL networks", () => {
    const server = getSorobanServer();
    expect(
      (server as { options: { allowHttp?: boolean } }).options.allowHttp
    ).toBe(false);
  });
});
