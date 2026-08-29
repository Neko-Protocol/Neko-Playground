import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const store = vi.hoisted(() => {
  const actions = {
    incrementConfirmation: vifn(),
    resetConfirmation: vifn(),
    markReady: vifn(),
  };
  return { orders: [], actions };
});
const { getQuote } = vi.hoisted(() => ({ getQuote: vifn() }));
const { addActivity } = vi.hoisted(() => ({ addActivity: vifn() }));

vi.mock('../../constants/swapConfig', () => ({ LIMIT_ORDER_CONFIRM_POLLS: 2, LIMIT_ORDER_POLL_INTERVAL_MS: 15000 }));
vi.mock('../../../lib/helpers/stellar/soroswap/utils', () => ({ getQuote }));
vi.mock('../useLimitOrders', () => ({ useLimitOrders: () => ({ orders: store.orders, incrementConfirmation: store.actions.incrementConfirmation, resetConfirmation: store.actions.resetConfirmation, markReady: store.actions.markReady }) }));
vi.mock('../../../stores/activityStore', () => ({ addActivity }));

import { useLimitOrderMonitor } from '../useLimitOrderMonitor';

const POLL_INTERVAL = 15000;

const createOrder = (overrides: Record<string, unknown> = {}) => ({
  id: 'order-1',
  status: 'open',
  limitPrice: 100,
  amount: '10',
  sourceAsset: 'XLM',
  destAsset: 'USDC',
  consecutiveConfirmations: 0,
  ...overrides,
});

describe('useLimitOrderMonitor', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    store.orders = [];
    store.actions.incrementConfirmation.mockReset();
    store.actions.resetConfirmation.mockReset();
    store.actions.markReady.mockReset();
    getQuote.mockReset();
    addActivity.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('calls incrementConfirmation for a confirming poll', async () => {
    store.orders = [createOrder()];
    getQuote.mockResolvedValue({ averagePrice: 105, price: 105 });

    renderHook(() => useLimitOrderMonitor());

    await act(async () => {
      await vi.advanceTimersAsync(0);
    });

    expect(store.actions.incrementConfirmation).toHaveBeenCalledTimes(1);
    expect(store.actions.resetConfirmation).not.toHaveBeenCalled();
    expect(store.actions.markReady).not.toHaveBeenCalled();
  });

  it('calls resetConfirmation for a non-confirming poll', async () => {
    store.orders = [createOrder()];
    getQuote.mockResolvedValue({ averagePrice: 95, price: 95 });

    renderHook(() => useLimitOrderMonitor());

    await act(async () => {
      await vi.advanceTimersAsync(0);
    });

    expect(store.actions.resetConfirmation).toHaveBeenCalledWith('order-1');
    expect(store.actions.incrementConfirmation).not.toHaveBeenCalled();
  });

  it('does not mark ready or fire onOrderReady after a single confirming poll', async () => {
    store.orders = [createOrder()];
    getQuote.mockResolvedValue({ averagePrice: 105, price: 105 });
    const onReady = vifn();

    renderHook(() => useLimitOrderMonitor(onReady));

    await act(async () => {
      await vi.advanceTimersAsync(0);
    });

    expect(store.actions.markReady).not.toHaveBeenCalled();
    expect(onReady).not.toHaveBeenCalled();
  });

  it('skips overlapping polls while a poll is in flight', async () => {
    store.orders = [createOrder()];
    let resolveQuote: (value: { averagePrice: number; price: number }) => void;
    getQuote.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveQuote = resolve;
        }),
    );

    renderHook(() => useLimitOrderMonitor());

    await act(async () => {
      await vi.advanceTimersAsync(0);
    });
    expect(getQuote).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersAsync(POLL_INTERVAL);
    });
    expect(getQuote).toHaveBeenCalledTimes(1);

    resolveQuote({ averagePrice: 105, price: 105 });
    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      await vi.advanceTimersAsync(POLL_INTERVAL);
    });
    expect(getQuote).toHaveBeenCalledTimes(2);
  });
});
