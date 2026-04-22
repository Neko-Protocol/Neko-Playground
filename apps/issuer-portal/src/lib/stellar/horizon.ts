import { Horizon } from "@stellar/stellar-sdk";
import { HORIZON_URL } from "@/lib/constants";

export const horizonServer = new Horizon.Server(HORIZON_URL);
