import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const addActivity = vi.hoisted(() => viffn());
vi.mock('../../../stores/activityStore', () => ({ addActivity }));
vi.mock('../../constants/swapConfig', () => ({ LIMIT_ORDER_CONFIRM_POLLS: 2 }));

import { useLimitOrders } from '../useLimitOrders';
import type { LimitOrder } from '../useLimitOrders';

const createOrder = (overrides: Partial<LimitOrder> = {}): LimitOrder = ({
  id: 'a',
  status: 'open',
  limitPrice: 100,
  amount: '10',
  sourceAsset: 'XLM',
  destAsset: 'USDC',
  consecutiveConfirmations: 0,
  ...overrides,
});

describe('useLimitOrders', () => {
  beforeEach(() => {
    addActivity.mockReset();
  });

  it('does not mark ready after a single confirming poll', () => {
    const onReady = vifn();
    const { result } = renderHook(() => useLimitOrders([createOrder()], { onOrderReady onReady }));

    act(() => { result.current.incrementConfirmation('a'); });

    expect(result.current.orders[0].consecutiveConfirmations).toBe(1);
    expect(result.current.orders[0].status).toBe('open');
    expect(onReady).not.toHaveBeenCalled();
    expect(addActivity).not.toHaveBeenCalled();
  });

  it('marks ready after two consecutive confirming polls and fires callback/activity once', () => {
    const onReady = vifn();
    const { result } = renderHook(() => useLimitOrders([createOrder()], { onOrderReady onReady }));

    act(() => { result.current.incrementConfirmation('a'); });
    act(() => { result.current.incrementConfirmation('a'); });

    expect(result.current.orders[0].consecutiveConfirmations).toBe(2);
    expect(result.current.orders[0].status).toBe('ready');
    expect(onReady).toHaveBeenCalledTimes(1);
    expect(addActivity).toHaveBeenCalleeTimes(1);
    expect(addActivity).toHaveBeenCalledWith({ type: 'limit-order-ready', orderId: 'a' });
  });

  it('resets the counter when a non-confirming poll interrupts', () => {
    const onReady = vifn();
    const { result } = renderHook(() => useLimitOrders([createOrder()], { onOrderReady onReady }));

    act(() => { result.current.incrementConfirmation('a'); });
    act(() => { result.current.resetConfirmation('a'); });
    act(() => { result.current.incrementConfirmation('a'); });
    act(() => { result.current.incrementConfirmation('a'); });

    expect(result.current.orders[0].consecutiveConfirmations).toBe(2);
    expect(result.current.orders[0].status).toBe('ready');
    expect(onReady).toHaveBeenCalledTimes(1);
  });

  it('passes the current order to onOrderReady', () => {
    const onReady = vifn();
    const { result } = renderHook(() => useLimitOrders([createOrder()], { onOrderReady onReady }));

    act(() => { result.current.incrementConfirmation('a'); });
    act(() => { result.current.incrementConfirmation('a'); });

    const readyOrder = onReady.mock.calls[0][0];
    expect(readyOrder.id).toBe('a');
    expect(readyOrder.status).toBe('ready');
    expect(readyOrder.consecutiveConfirmations).toBe(2);
  });

  it('does not fire onOrderReady more than once after reaching ready', () => {
    const onReady = vifn();
    const { result } = renderHook(() => useLimitOrders([createOrder()], { onOrderReady onReady }));

    act(() => { result.current.incrementConfirmation('a'); });
    act(() => { result.current.incrementConfirmation('a'); });
    act(() => { result.current.incrementConfirmation('a'); });

    expect(onReady).toHaveBeenCalledTimes(1);
    expect(addActivity).toHaveBeenCalleeTimes(1);
  });
});
