"use client";

import { useReducer } from "react";
import type { RampState, RampAction } from "../types/ramp";
import { DEFAULT_PROVIDER } from "../constants/ramp.config";

const initialState: RampState = {
  provider: DEFAULT_PROVIDER,
  direction: "on",
  step: "select",
  amount: "",
  customerId: null,
  quoteId: null,
  transactionId: null,
  quote: null,
  onRampTransaction: null,
  offRampTransaction: null,
  selectedFiatAccount: null,
  error: null,
};

function rampReducer(state: RampState, action: RampAction): RampState {
  switch (action.type) {
    case "SET_PROVIDER":
      return { ...initialState, provider: action.provider };
    case "SET_DIRECTION":
      return {
        ...state,
        direction: action.direction,
        step: "select",
        amount: "",
        quote: null,
        onRampTransaction: null,
        offRampTransaction: null,
        error: null,
      };
    case "SET_AMOUNT":
      return { ...state, amount: action.amount };
    case "SET_STEP":
      return { ...state, step: action.step, error: null };
    case "SET_CUSTOMER_ID":
      return { ...state, customerId: action.customerId };
    case "SET_QUOTE":
      return {
        ...state,
        quote: action.quote,
        quoteId: action.quote.id,
        step: "quote",
      };
    case "SET_ON_RAMP_TX":
      return {
        ...state,
        onRampTransaction: action.transaction,
        transactionId: action.transaction.id,
        step: "payment",
      };
    case "SET_OFF_RAMP_TX":
      return {
        ...state,
        offRampTransaction: action.transaction,
        transactionId: action.transaction.id,
      };
    case "SET_FIAT_ACCOUNT":
      return { ...state, selectedFiatAccount: action.account };
    case "SET_ERROR":
      return { ...state, step: "error", error: action.error };
    case "RESET":
      return { ...initialState, provider: state.provider };
    default:
      return state;
  }
}

export function useRampState() {
  const [state, dispatch] = useReducer(rampReducer, initialState);
  return { state, dispatch };
}
