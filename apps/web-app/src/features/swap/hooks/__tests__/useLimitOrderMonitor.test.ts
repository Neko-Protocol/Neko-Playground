import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const store = vi.hoisted(() => {
  const actions = {
    incrementConfirmation: vi.fn(),
    resetConfirmation: vi.fn(),
    markReady: vi.fn(),
  };
  return { orders: [], confirmations: new Map(), actions };
});
const activity = vi.hoisted(() => ({ addActivity: vi.fn() }));
const { getQuote } = vi.hoisted(() => ({ getQuote: vi.fn() }));
vi.mock('../../constants/swapConfig', () => ({ LIMIT_ORDER_CONFIRM_POLLS: 2, LIMIT_ORDER_POLL_INTERVAL_MS: 15000 }));
vi.mock('../../../../lib/helpers/stellar/soroswap/utils', () => ({ getQuote }));
vi.mock('../useLimitOrders', () => ({
  useLimitOrders: () => ({
    orders: store.orders,
    incrementConfirmation: store.actions.incrementConfirmation,
    resetConfirmation: store.actions.resetConfirmation,
    markReady: store.actions.markReady,
  }),
}));
vi.mock('../../../../stores/activityStore', () => ({
  addActivity: activity.addActivity,
  useActivityStore: () => ({ addActivity: activity.addActivity }),
}));
import { useLimitOrderMonitor } from '../useLimitOrderMonitor';
const POLL_INTERVAV = 15000;
const createOrder = (overrides = {}) => ({
  id: 'order-1',
  status: 'open',
  limitPrice: 100,
  amount: '10',
  sourceAsset: 'XLM',
  destAsset: 'USDC',
  ...overrides,
});
describe('useLimitOrderMonitor', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    store.orders = [];
    store.confirmations.clear();
    store.actions.incrementConfirmation.mockReset();
    store.actions.resetConfirmation.mockReset();
    store.actions.markReady.mockReset();
    store.actions.incrementConfirmation.mockImplementation((id) => {
      const current = store.confirmations.get(id) ?? 0;
      const next = current + 1;
      store.confirmations.set(id, next);
      return next;
    });
    store.actions.resetConfirmation.mockImplementation((id) => {
      store.confirmations.set(id, 0);
    });
    store.actions.markReady.mockImplementation((id) => {
      const order = store.orders.find((o) => o.id === id);
      if (order) order.status = 'ready';
    });
    getQuote.mockReset();
    activity.addActivity.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not mark ready after a single confirming poll', async () => {
    store.orders = [createOrder()];
    getQuote.mockResolvedValue({ averagePrice: 105, price: 105 });
    const onOrderReady = vi.fn();
    renderHook(() => useLimitOrderMonitor(onOrderReady));
    await act(async () => { await vi.advanceTimersAsync(POLL_INTERVAL); });
    expect(store.actions.incrementConfirmation).toHaveBeenCalledTimes(1);
    expect(store.actions.markReady).not.toHaveBeenCalled();
    expect(onOrderReady).not.toHaveBeenCalled();
  });

  it('marks ready after two consecutive confirming polls', async () => {
    store.orders = [createOrder()];
    getQuote.mockResolvedValue({ averagePrice: 105, price: 105 });
    const onOrderReady = vi.fn();
    renderHook(() => useLimitOrderMonitor(onOrderReady));
    await act(async () => { await vi.advanceTimersAsync(POLL_INTERVAL); });
    await act(async () => { await vi.advanceTimersAsync(POLL_INTERVAL); });
    expect(store.actions.markReady).toHaveBeenCalledTimes(1);
    expect(onOrderReady).toHaveBeenCalledTimes(1);
  });

  it('resets the counter when a non-confirming poll interrupts', async () => {
    store.orders = [createOrder()];
    getQuote.mockResolvedValueOnce({ averagePrice: 105 })
      .mockResolvedValueOnce({ averagePrice: 95 })
      .mockResolvedValueOnce({ averagePrice: 105 })
      .mockResolvedValueOnce({ averagePrice: 105 });
    const onOrderReady = vi.fn();
    renderHook(() => useLimitOrderMonitor(onOrderReady));
    await act(async () => { await vi.advanceTimersAsync(POLL_INTERVAL); });
    expect(store.actions.incrementConfirmation).toHaveBeenCalledTimes(1);
    await act(async () => { await vi.advanceTimersAsync(POLL_INTERVAL); });
    expect(store.actions.resetConfirmation).toHaveBeenCalledWith('order-1');
    await act(async () => { await vi.advanceTimersAsync(POLL_INTERVAL); });
    expect(store.actions.incrementConfirmation).toHaveBeenCalledTimes(2);
    await act(async () => { await vi.advanceTimersAsync(POLL_INTERVAL); });
    expect(store.actions.markReady).toHaveBeenCalledTimes(1);
  });

  it('fires the ready transition, activity event, and onOrderReady exactly once', async () => {
    store.orders = [createOrder()];
    getQuote.mockResolvedValue({ averagePrice: 105 });
    const onOrderReady = vi.fn();
    const { rerender } = renderHook(() => useLimitOrderMonitor(onOrderReady));
    await act(async () => { await vi.advanceTime