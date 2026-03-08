"use client";

import React, { useState, useTransition } from "react";
import { useToast } from "@/hooks/useToast";
import { useWallet } from "@/hooks/useWallet";
import { useSorobanTokenBalances } from "@/hooks/useSorobanTokenBalances";
import { Button, Tooltip } from "@stellar/design-system";
import {
  buildFaucetTransaction,
  getFaucetTokens,
} from "@/lib/constants/faucet";
import { addFaucetTokensToFreighter } from "@/lib/helpers/stellar/freighter";
import { signAndSendTransaction } from "@/lib/helpers/stellar/transaction";
import {
  rpcUrl,
  networkPassphrase,
  horizonUrl,
} from "@/lib/config/stellar.config";

const MintTestTokensButton: React.FC = () => {
  const { addNotification } = useToast();
  const [isPending, startTransition] = useTransition();
  const [isTooltipVisible, setIsTooltipVisible] = useState(false);
  const { address, signTransaction } = useWallet();
  const { invalidate } = useSorobanTokenBalances();

  if (!address) return null;

  const handleMintTokens = () => {
    startTransition(async () => {
      try {
        const txXdr = await buildFaucetTransaction(
          address,
          rpcUrl,
          horizonUrl,
          networkPassphrase
        );

        await signAndSendTransaction(txXdr, signTransaction, {
          networkPassphrase,
          rpcUrl,
          address,
        });

        const tokens = getFaucetTokens();
        addNotification(
          `Minted test tokens: ${tokens.map((t) => t.symbol).join(", ")}`,
          "success"
        );

        await invalidate();

        try {
          addNotification("Adding tokens to Freighter…", "info");
          await addFaucetTokensToFreighter(networkPassphrase);
          addNotification("Tokens added to Freighter", "success");
        } catch {
          addNotification(
            "Mint succeeded but adding to Freighter failed. Use Settings to add tokens manually.",
            "warning"
          );
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        addNotification(`Failed to mint test tokens: ${msg}`, "error");
      }
    });
  };

  return (
    <div
      onMouseEnter={() => setIsTooltipVisible(true)}
      onMouseLeave={() => setIsTooltipVisible(false)}
    >
      <Tooltip
        isVisible={isTooltipVisible}
        isContrast
        title="Get Test Tokens"
        placement="bottom"
        triggerEl={
          <Button
            disabled={isPending}
            onClick={handleMintTokens}
            variant="secondary"
            size="md"
          >
            {isPending ? "Minting..." : "Get Test Tokens"}
          </Button>
        }
      >
        <div style={{ width: "16em" }}>
          Mint USTRY, TESOURO, CETES, USDY & PYUSD to your wallet
        </div>
      </Tooltip>
    </div>
  );
};

export default MintTestTokensButton;
