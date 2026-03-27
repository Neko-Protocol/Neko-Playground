"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getFiatAccounts, registerFiatAccount } from "../utils/rampApi";
import type { AnchorProvider } from "@/lib/anchors/types";

export function useFiatAccounts(
  provider: AnchorProvider,
  customerId: string | null
) {
  const queryClient = useQueryClient();
  const queryKey = ["fiat-accounts", provider, customerId];

  const { data: accounts = [], isLoading } = useQuery({
    queryKey,
    queryFn: () => getFiatAccounts(provider, customerId!),
    enabled: !!customerId,
    staleTime: 60_000,
  });

  const { mutateAsync: addFiatAccount, isPending: isRegistering } = useMutation(
    {
      mutationFn: (data: {
        clabe: string;
        beneficiary: string;
        bankName?: string;
        publicKey?: string;
      }) =>
        registerFiatAccount(provider, {
          customerId: customerId!,
          ...data,
        }),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey });
      },
    }
  );

  return { accounts, isLoading, addFiatAccount, isRegistering };
}
