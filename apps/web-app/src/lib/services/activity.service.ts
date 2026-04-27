import { Horizon, rpc, xdr, Address, ScVal } from "@stellar/stellar-sdk";
import { horizonUrl, rpcUrl, stellarNetwork } from "@/lib/constants/network";
import { networks } from "@neko/lending";
import { networks as backstopNetworks } from "@neko/backstop";
import type { ActivityEntry, ActivityType } from "@/features/dashboard/types/activity";

const horizonServer = new Horizon.Server(horizonUrl);
const rpcServer = new rpc.Server(rpcUrl, {
  allowHttp: stellarNetwork === "LOCAL",
});

const NEKO_CONTRACTS = [
  networks.testnet.pool1ContractId,
  networks.testnet.pool2ContractId,
  backstopNetworks.testnet.pool1ContractId,
];

export async function fetchAccountActivity(address: string): Promise<ActivityEntry[]> {
  try {
    const activities: ActivityEntry[] = [];

    // 1. Fetch Horizon Operations
    const operations = await horizonServer
      .operations()
      .forAccount(address)
      .order("desc")
      .limit(50)
      .call();

    for (const op of operations.records) {
      const type = mapOperationToActivityType(op);
      if (type === "unknown") continue;

      activities.push({
        id: op.id,
        type: type,
        assetCode: getAssetCodeFromOp(op),
        amount: getAmountFromOp(op),
        timestamp: op.created_at,
        transactionHash: op.transaction_hash,
        status: op.transaction_successful ? "success" : "failed",
        link: getStellarExpertLink(op.transaction_hash),
      });
    }

    // 2. Fetch Soroban Events
    try {
      const { sequence: latestLedger } = await rpcServer.getLatestLedger();
      const startLedger = Math.max(latestLedger - 5000, 1);
      
      const addressScVal = new Address(address).toScVal();
      const addressXdr = addressScVal.toXDR("base64");

      const events = await rpcServer.getEvents({
        startLedger: startLedger,
        filters: [
          {
            type: "contract",
            contractIds: NEKO_CONTRACTS,
          },
          {
            topics: [[addressXdr]],
          }
        ],
      });

      for (const event of events.events) {
        // If we filtered by contractIds and topics separately in the same filter object, it might be OR or AND depending on RPC implementation.
        // Most RPCs do AND. But we also want to catch events where address is NOT the first topic.
        const isRelated = event.topic.some(t => t === addressXdr);
        if (!isRelated) continue;

        const entry = parseSorobanEvent(event);
        if (entry) {
          activities.push(entry);
        }
      }
    } catch (e) {
      console.error("Error fetching Soroban events:", e);
    }

    // De-duplicate by transaction hash + type
    const seen = new Set<string>();
    const unique = activities.filter(a => {
      const key = `${a.transactionHash}-${a.type}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return unique.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 50);
  } catch (error) {
    console.error("Error fetching activity:", error);
    return [];
  }
}

function mapOperationToActivityType(op: any): ActivityType {
  switch (op.type) {
    case "payment":
    case "path_payment_strict_send":
    case "path_payment_strict_receive":
      return "transfer";
    case "manage_buy_offer":
    case "manage_sell_offer":
    case "create_passive_sell_offer":
      return "swap";
    default:
      return "unknown";
  }
}

function getAssetCodeFromOp(op: any): string {
  if (op.asset_code) return op.asset_code;
  if (op.asset_type === "native") return "XLM";
  if (op.buying_asset_code) return op.buying_asset_code;
  if (op.selling_asset_code) return op.selling_asset_code;
  return "Unknown";
}

function getAmountFromOp(op: any): string {
  return op.amount || op.starting_balance || "0";
}

function getStellarExpertLink(hash: string): string {
  const network = stellarNetwork.toLowerCase();
  const domain = network === "public" ? "stellar.expert/explorer/public" : `stellar.expert/explorer/${network}`;
  return `https://${domain}/tx/${hash}`;
}

function parseSorobanEvent(event: any): ActivityEntry | null {
  try {
    // Decode topic[0] which is usually the event name as a symbol
    const eventNameXdr = event.topic[0];
    const eventNameScVal = xdr.ScVal.fromXDR(eventNameXdr, "base64");
    const eventName = eventNameScVal.symbol().toString().toLowerCase();

    let type: ActivityType = "unknown";
    if (eventName.includes("deposit")) type = "deposit";
    else if (eventName.includes("withdraw")) type = "withdraw";
    else if (eventName.includes("borrow")) type = "borrow";
    else if (eventName.includes("repay")) type = "repay";
    else if (eventName.includes("swap")) type = "swap";
    else if (eventName.includes("join")) type = "pool_join";
    else if (eventName.includes("exit")) type = "pool_exit";
    else if (eventName.includes("claim")) type = "claim_rewards";
    
    if (type === "unknown") return null;

    // Try to extract amount and asset from event value if it's a map/struct
    let amount = "0";
    let assetCode = "Soroban";

    if (event.contractId === networks.testnet.pool1ContractId) assetCode = "Pool 1";
    else if (event.contractId === networks.testnet.pool2ContractId) assetCode = "Pool 2";
    else if (event.contractId === backstopNetworks.testnet.pool1ContractId) assetCode = "Backstop";

    try {
      const val = xdr.ScVal.fromXDR(event.value, "base64");
      // This parsing depends heavily on contract implementation
      // For now, we'll return a generic entry if we can't parse deeply
    } catch {
      // ignore
    }

    return {
      id: event.id,
      type: type,
      assetCode: assetCode,
      amount: amount,
      timestamp: new Date().toISOString(), // Fallback
      transactionHash: event.txHash,
      status: "success",
      link: getStellarExpertLink(event.txHash),
    };
  } catch {
    return null;
  }
}
