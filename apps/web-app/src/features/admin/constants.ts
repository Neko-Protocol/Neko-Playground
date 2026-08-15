import { getContracts } from "@/lib/constants/contractsByNetwork";

const contracts = getContracts();

export const POOL1_CONTRACT_ID = contracts.lendingPool1;
export const POOL2_CONTRACT_ID = contracts.lendingPool2;

export const POOL1_ASSETS = ["USDC", "XLM"];
export const POOL2_ASSETS = [
  "USTRY",
  "TESOURO",
  "CETES",
  "USDY",
  "PYUSD",
  "KTB",
];

/** Pool 2 collateral (USDC, XLM) - used for set_collateral_factor */
export const POOL2_COLLATERAL_ASSETS = ["USDC", "XLM"];

export const POOLS = [
  {
    id: "pool1",
    name: "Pool 1 (RWA → USDC/XLM)",
    contractId: POOL1_CONTRACT_ID,
    assets: POOL1_ASSETS,
  },
  {
    id: "pool2",
    name: "Pool 2 (USDC/XLM → RWA)",
    contractId: POOL2_CONTRACT_ID,
    assets: POOL2_ASSETS,
  },
] as const;
