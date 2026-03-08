"use client";

import React from "react";
import { stellarNetwork } from "@/lib/constants/network";
import FundAccountButton from "./FundAccountButton";
import MintTestTokensButton from "./MintTestTokensButton";
import NetworkPill from "./NetworkPill";

const ConnectAccount: React.FC = () => {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        gap: "10px",
        verticalAlign: "middle",
      }}
    >
      {stellarNetwork !== "PUBLIC" && (
        <>
          <FundAccountButton />
          <MintTestTokensButton />
        </>
      )}
      <NetworkPill />
    </div>
  );
};

export default ConnectAccount;
