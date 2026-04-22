import fs from "node:fs";
import path from "node:path";
import type { KycEntry } from "@/types";

const STORE_FILE = path.join(process.cwd(), ".kyc-store.json");

/** Keyed by (sessionId and stellarAddress once linked) */
interface StoreShape {
  sessions: Record<
    string,
    {
      sessionId: string;
      stellarAddress: string;
      status: "pending" | "approved" | "rejected";
      kycLevel: KycEntry["kycLevel"];
      country?: string;
      createdAt: number;
      approvedAt?: number;
      contractsAdded: string[];
    }
  >;
  byAddress: Record<string, string>;
}

function read(): StoreShape {
  if (!fs.existsSync(STORE_FILE)) {
    return { sessions: {}, byAddress: {} };
  }
  try {
    return JSON.parse(fs.readFileSync(STORE_FILE, "utf8"));
  } catch {
    return { sessions: {}, byAddress: {} };
  }
}

function write(data: StoreShape) {
  fs.writeFileSync(STORE_FILE, JSON.stringify(data, null, 2));
}

export const kycStore = {
  createSession(input: {
    sessionId: string;
    stellarAddress: string;
    kycLevel: KycEntry["kycLevel"];
  }) {
    const data = read();
    data.sessions[input.sessionId] = {
      ...input,
      status: "pending",
      createdAt: Date.now(),
      contractsAdded: [],
    };
    data.byAddress[input.stellarAddress] = input.sessionId;
    write(data);
  },
  approve(sessionId: string, country: string) {
    const data = read();
    const s = data.sessions[sessionId];
    if (!s) return null;
    s.status = "approved";
    s.country = country;
    s.approvedAt = Date.now();
    write(data);
    return s;
  },
  reject(sessionId: string) {
    const data = read();
    const s = data.sessions[sessionId];
    if (!s) return null;
    s.status = "rejected";
    write(data);
    return s;
  },
  getByAddress(address: string) {
    const data = read();
    const id = data.byAddress[address];
    if (!id) return null;
    return data.sessions[id] ?? null;
  },
  get(sessionId: string) {
    return read().sessions[sessionId] ?? null;
  },
  markContractAdded(sessionId: string, contractId: string) {
    const data = read();
    const s = data.sessions[sessionId];
    if (!s) return;
    if (!s.contractsAdded.includes(contractId)) {
      s.contractsAdded.push(contractId);
    }
    write(data);
  },
};
