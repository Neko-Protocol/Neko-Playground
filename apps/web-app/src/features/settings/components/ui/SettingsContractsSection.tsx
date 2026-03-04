"use client";

import React from "react";
import { SectionCard } from "@/components/ui/SectionCard";
import { ReadonlyRow } from "@/components/ui/ReadonlyRow";
import {
  LENDING_CONTRACT_ID,
  ORACLE_CONTRACT_ID,
} from "@/lib/constants/contracts";
import { network } from "@/lib/constants/network";
import { getStellarExpertContractUrl } from "@/lib/helpers/stellarExplorer";

export function SettingsContractsSection() {
  return (
    <SectionCard title="Contracts">
      <ReadonlyRow
        label="RWA Lending"
        value={LENDING_CONTRACT_ID}
        href={getStellarExpertContractUrl(LENDING_CONTRACT_ID, network.id)}
      />
      <ReadonlyRow
        label="RWA Oracle"
        value={ORACLE_CONTRACT_ID}
        href={getStellarExpertContractUrl(ORACLE_CONTRACT_ID, network.id)}
      />
    </SectionCard>
  );
}
