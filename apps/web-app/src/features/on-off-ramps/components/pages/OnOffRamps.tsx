"use client";

import React, { useState } from "react";
import { useWallet } from "@/hooks/useWallet";
import { useToast } from "@/hooks/useToast";
import { TOAST_CONFIG } from "@/lib/constants/toast.config";
import { BannerPage } from "@/components/ui/BannerPage";
import { PageContainer } from "@/components/ui/PageContainer";
import type { AnchorProvider } from "@/lib/anchors/types";
import type { RampDirection } from "../../types/ramp";
import { RAMP_PROVIDERS } from "../../constants/ramp.config";
import { simulateFiatReceived } from "../../utils/rampApi";

import { useRampState } from "../../hooks/useRampState";
import { useAnchorCustomer } from "../../hooks/useAnchorCustomer";
import { useAnchorQuote } from "../../hooks/useAnchorQuote";
import { useAnchorKyc } from "../../hooks/useAnchorKyc";
import { useOnRamp } from "../../hooks/useOnRamp";
import { useOffRamp } from "../../hooks/useOffRamp";
import { useFiatAccounts } from "../../hooks/useFiatAccounts";
import { useEtherfuseTrustline } from "../../hooks/useEtherfuseTrustline";

import { ProviderSelector } from "../ui/ProviderSelector";
import { RampDirectionTabs } from "../ui/RampDirectionTabs";
import { AmountInput } from "../ui/AmountInput";
import { QuoteDisplay } from "../ui/QuoteDisplay";
import { KycBanner } from "../ui/KycBanner";
import { PaymentInstructionsDisplay } from "../ui/PaymentInstructions";
import { FiatAccountSelector } from "../ui/FiatAccountSelector";
import { TransactionStatusDisplay } from "../ui/TransactionStatus";
import { clientEnv } from "@/lib/env.client";

const isSandbox = clientEnv.stellarNetwork !== "PUBLIC";
const etherfusePortalUrl = isSandbox
  ? "https://devnet.etherfuse.com"
  : "https://app.etherfuse.com";

const OnOffRamps: React.FC = () => {
  const { address, signTransaction } = useWallet();
  const { addNotification } = useToast();
  const { state, dispatch } = useRampState();
  const [isSimulating, setIsSimulating] = useState(false);

  const config = RAMP_PROVIDERS[state.provider];

  // Customer
  const {
    customerId,
    bankAccountId,
    onboardingUrl,
    ensureCustomer,
    isPending: isEnsuring,
  } = useAnchorCustomer(state.provider, address);

  // Quote
  const {
    quote,
    isLoadingQuote,
    isExpired,
    secondsLeft,
    fetchQuote,
    clearQuote,
  } = useAnchorQuote(state.provider);

  // KYC
  const {
    kycStatus,
    isCheckingKyc,
    isKycRequired,
    kycPollOutcome,
    refetchKycStatus,
    retryKycPoll,
    openKycFlow,
  } = useAnchorKyc(
    state.provider,
    customerId,
    address,
    bankAccountId ?? undefined,
    onboardingUrl
  );

  // On-Ramp
  const {
    transaction: onRampTx,
    isCreating: isCreatingOnRamp,
    isPolling: isPollingOnRamp,
    pollOutcome: onRampPollOutcome,
    retryPoll: retryOnRampPoll,
    startOnRamp,
  } = useOnRamp(state.provider);

  // Trustline check (Etherfuse on-ramp only — after order is created)
  const { hasTrustline, isAddingTrustline, addTrustline } =
    useEtherfuseTrustline(
      state.provider,
      address,
      state.direction === "on" && !!quote,
      signTransaction
    );

  // Off-Ramp
  const {
    transaction: offRampTx,
    isCreating: isCreatingOffRamp,
    isWaitingForXdr,
    isSigning,
    isPolling: isPollingOffRamp,
    pollOutcome: offRampPollOutcome,
    retryPoll: retryOffRampPoll,
    startOffRamp,
  } = useOffRamp(state.provider, signTransaction);

  // Fiat Accounts (for off-ramp)
  const { accounts, isLoading: isLoadingAccounts } = useFiatAccounts(
    state.provider,
    customerId
  );

  // Derived
  const isOnRamp = state.direction === "on";
  const fromCurrency = isOnRamp ? "MXN" : config.supportedAssets[0];
  const toCurrency = isOnRamp ? config.supportedAssets[0] : "MXN";
  const canGetQuote =
    !!address && !!state.amount && parseFloat(state.amount) > 0;

  const handleProviderChange = (provider: AnchorProvider) => {
    dispatch({ type: "SET_PROVIDER", provider });
    clearQuote();
  };

  const handleDirectionChange = (direction: RampDirection) => {
    dispatch({ type: "SET_DIRECTION", direction });
    clearQuote();
  };

  const handleGetQuote = async () => {
    if (!canGetQuote) return;

    try {
      let cid = customerId;
      let bid = bankAccountId;
      const isNewCustomer = !cid;

      if (!cid || !bid) {
        // Reuse stored IDs — never generate new ones per request
        const result = await ensureCustomer({ publicKey: address });
        cid = result.customerId;
        bid = result.bankAccountId ?? null;
      }

      if (!cid || !bid) {
        addNotification(
          "Failed to set up account. Please try again.",
          "error",
          TOAST_CONFIG.defaultOpts
        );
        return;
      }

      if (isNewCustomer) {
        // Customer just created — let the KYC query run before quoting.
        // On next render the KYC banner will show; user clicks again to get quote.
        return;
      }

      if (isKycRequired) {
        addNotification(
          "Complete KYC verification before getting a quote",
          "error",
          TOAST_CONFIG.defaultOpts
        );
        return;
      }

      await fetchQuote({
        fromCurrency,
        toCurrency,
        fromAmount: state.amount,
        customerId: cid,
        stellarAddress: address,
        resourceId: bid,
      });
    } catch (err) {
      addNotification("Failed to get quote", "error", {
        ...TOAST_CONFIG.defaultOpts,
        description: err instanceof Error ? err.message : "Please try again",
      });
    }
  };

  const handleConfirmOnRamp = async () => {
    if (!quote || !customerId || !address) return;
    try {
      await startOnRamp({
        customerId,
        quoteId: quote.id,
        stellarAddress: address,
        fromCurrency,
        toCurrency,
        amount: state.amount,
        bankAccountId: bankAccountId || undefined,
      });
    } catch (err) {
      addNotification("Failed to create on-ramp", "error", {
        ...TOAST_CONFIG.defaultOpts,
        description: err instanceof Error ? err.message : "Please try again",
      });
    }
  };

  const handleConfirmOffRamp = async () => {
    if (!quote || !customerId || !address) return;
    if (!state.selectedFiatAccount) {
      addNotification(
        "Please select a bank account",
        "error",
        TOAST_CONFIG.defaultOpts
      );
      return;
    }
    try {
      await startOffRamp({
        customerId,
        quoteId: quote.id,
        stellarAddress: address,
        fromCurrency,
        toCurrency,
        amount: state.amount,
        fiatAccountId: state.selectedFiatAccount.id,
      });
    } catch (err) {
      addNotification("Failed to create off-ramp", "error", {
        ...TOAST_CONFIG.defaultOpts,
        description: err instanceof Error ? err.message : "Please try again",
      });
    }
  };

  const handleSimulateFiat = async () => {
    if (!onRampTx) return;
    setIsSimulating(true);
    try {
      await simulateFiatReceived(state.provider, onRampTx.id);
      addNotification(
        "Fiat received simulated",
        "success",
        TOAST_CONFIG.defaultOpts
      );
    } catch {
      addNotification("Simulation failed", "error", TOAST_CONFIG.defaultOpts);
    } finally {
      setIsSimulating(false);
    }
  };

  const currentTx = isOnRamp ? onRampTx : offRampTx;
  const currentPollOutcome = isOnRamp ? onRampPollOutcome : offRampPollOutcome;
  const retryCurrentPoll = isOnRamp ? retryOnRampPoll : retryOffRampPoll;
  const hasPollFailure =
    currentPollOutcome === "timed-out" || currentPollOutcome === "unreachable";
  const isLoadingTx = isCreatingOnRamp || isCreatingOffRamp;
  const isPollingTx =
    isPollingOnRamp || isPollingOffRamp || isWaitingForXdr || isSigning;

  return (
    <PageContainer maxWidth="4xl">
      <BannerPage
        title="On/Off Ramps"
        subtitle="Convert between MXN and crypto via SPEI"
        badge="Ramps"
        imageSrc="/banners/swap.svg"
        imageAlt="On/Off Ramps illustration"
        className="mb-6"
      />

      {!address && (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-5 text-center text-white/60 text-sm">
          Connect your wallet to use on/off ramps
        </div>
      )}

      <div className="flex flex-col gap-4">
        {/* Provider + Direction Selection */}
        <ProviderSelector
          selected={state.provider}
          onSelect={handleProviderChange}
          disabled={isLoadingTx || isPollingTx}
        />

        <RampDirectionTabs
          direction={state.direction}
          provider={state.provider}
          onChange={handleDirectionChange}
          disabled={isLoadingTx || isPollingTx}
        />

        <div
          id={isOnRamp ? "on-ramp-panel" : "off-ramp-panel"}
          role="tabpanel"
          aria-labelledby={isOnRamp ? "on-ramp-tab" : "off-ramp-tab"}
          tabIndex={0}
          className="flex flex-col gap-4"
        >
          {/* KYC Banner */}
          {address && customerId && (
            <KycBanner
              status={kycStatus}
              onStartKyc={() => void openKycFlow()}
              isLoading={isCheckingKyc}
              pollOutcome={kycPollOutcome}
              onRetryPoll={retryKycPoll}
            />
          )}

          {/* Trustline warning — shown after quote, before confirming on-ramp */}
          {isOnRamp && quote && !currentTx && !hasTrustline && (
            <div className="flex items-center justify-between gap-3 bg-orange-400/10 border border-orange-400/20 rounded-xl px-4 py-3">
              <div>
                <p className="text-orange-400 text-sm font-medium">
                  CETES trustline not enabled
                </p>
                <p className="text-white/40 text-xs">
                  You need a trustline to receive CETES in your wallet.
                </p>
              </div>
              <button
                onClick={() => addTrustline()}
                disabled={isAddingTrustline}
                className="shrink-0 px-4 py-2 rounded-lg bg-orange-400 hover:bg-orange-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
              >
                {isAddingTrustline ? "Enabling..." : "Enable Trustline"}
              </button>
            </div>
          )}

          {/* Polling KYC banner - let user know to refresh */}
          {kycStatus === "pending" && (
            <button
              onClick={() => refetchKycStatus()}
              className="text-xs text-white/40 hover:text-white/60 text-center"
            >
              Refresh KYC status
            </button>
          )}

          {/* Active transaction status */}
          {currentTx &&
            (isPollingTx ||
              hasPollFailure ||
              currentTx.status === "completed" ||
              ["failed", "expired", "cancelled"].includes(
                currentTx.status
              )) && (
              <TransactionStatusDisplay
                status={currentTx.status}
                type={isOnRamp ? "onramp" : "offramp"}
                transactionId={currentTx.id}
                pollOutcome={currentPollOutcome}
                onRetry={retryCurrentPoll}
                onDone={() => {
                  dispatch({ type: "RESET" });
                  clearQuote();
                }}
              />
            )}

          {/* On-ramp: Payment instructions — shown while awaiting payment */}
          {isOnRamp &&
            onRampTx &&
            onRampTx.paymentInstructions &&
            onRampTx.status !== "completed" && (
              <PaymentInstructionsDisplay
                instructions={onRampTx.paymentInstructions}
                statusPage={onRampTx.statusPage}
                onSimulateFiat={isSandbox ? handleSimulateFiat : undefined}
                isSandbox={isSandbox}
                isSimulating={isSimulating}
              />
            )}

          {/* Quote display */}
          {quote && !currentTx && (
            <QuoteDisplay
              quote={quote}
              isExpired={isExpired}
              secondsLeft={secondsLeft}
              onConfirm={isOnRamp ? handleConfirmOnRamp : handleConfirmOffRamp}
              onRefresh={handleGetQuote}
              onCancel={clearQuote}
              isLoading={isLoadingTx}
            />
          )}

          {/* Off-ramp: bank account selector (shown before confirming) */}
          {!isOnRamp && quote && !offRampTx && (
            <FiatAccountSelector
              accounts={accounts}
              selected={state.selectedFiatAccount}
              onSelect={(account) =>
                dispatch({ type: "SET_FIAT_ACCOUNT", account })
              }
              isLoading={isLoadingAccounts}
              addAccountUrl={
                state.provider === "etherfuse" ? etherfusePortalUrl : undefined
              }
            />
          )}

          {/* Amount input + get quote button */}
          {!currentTx && !quote && (
            <>
              <AmountInput
                value={state.amount}
                onChange={(value) =>
                  dispatch({ type: "SET_AMOUNT", amount: value })
                }
                currency={fromCurrency}
                label={
                  isOnRamp
                    ? "You send (MXN)"
                    : `You send (${config.supportedAssets[0]})`
                }
                disabled={!address || isLoadingTx}
              />

              <button
                onClick={handleGetQuote}
                disabled={
                  !canGetQuote ||
                  isLoadingQuote ||
                  isEnsuring ||
                  (isKycRequired && !!customerId)
                }
                className="w-full py-4 rounded-2xl bg-[#229EDF] hover:bg-[#1a8bc7] text-white font-semibold text-base transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {!address
                  ? "Connect Wallet"
                  : isEnsuring
                    ? "Setting up..."
                    : isKycRequired && !!customerId
                      ? "Complete KYC First"
                      : isLoadingQuote
                        ? "Getting quote..."
                        : "Get Quote"}
              </button>
            </>
          )}
        </div>
        <div
          id={isOnRamp ? "off-ramp-panel" : "on-ramp-panel"}
          role="tabpanel"
          aria-labelledby={isOnRamp ? "off-ramp-tab" : "on-ramp-tab"}
          hidden
        />
      </div>
    </PageContainer>
  );
};

export default OnOffRamps;
