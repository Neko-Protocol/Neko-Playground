import type {
  ActionLogEntry,
  RebalancePlan,
  Strategy,
} from "@/features/automation/types/automation";
import { redisGet, redisSet } from "@/lib/auth/redis";

function strategiesKey(publicKey: string): string {
  return `automation:${publicKey}:strategies`;
}

function plansKey(publicKey: string): string {
  return `automation:${publicKey}:plans`;
}

function historyKey(publicKey: string): string {
  return `automation:${publicKey}:history`;
}

async function readJson<T>(key: string, fallback: T): Promise<T> {
  const raw = await redisGet(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function listStrategies(publicKey: string): Promise<Strategy[]> {
  const map = await readJson<Record<string, Strategy>>(strategiesKey(publicKey), {});
  return Object.values(map);
}

export async function getStrategy(
  publicKey: string,
  id: string
): Promise<Strategy | null> {
  const map = await readJson<Record<string, Strategy>>(strategiesKey(publicKey), {});
  return map[id] ?? null;
}

export async function saveStrategy(
  publicKey: string,
  strategy: Strategy
): Promise<void> {
  const map = await readJson<Record<string, Strategy>>(strategiesKey(publicKey), {});
  map[strategy.id] = strategy;
  await redisSet(strategiesKey(publicKey), JSON.stringify(map));
}

export async function deleteStrategy(
  publicKey: string,
  id: string
): Promise<boolean> {
  const map = await readJson<Record<string, Strategy>>(strategiesKey(publicKey), {});
  if (!map[id]) return false;
  delete map[id];
  await redisSet(strategiesKey(publicKey), JSON.stringify(map));
  return true;
}

export async function listPlans(
  publicKey: string,
  strategyId?: string | null
): Promise<RebalancePlan[]> {
  const map = await readJson<Record<string, RebalancePlan>>(plansKey(publicKey), {});
  const plans = Object.values(map);
  if (!strategyId) return plans;
  return plans.filter((plan) => plan.strategyId === strategyId);
}

export async function getPlan(
  publicKey: string,
  planId: string
): Promise<RebalancePlan | null> {
  const map = await readJson<Record<string, RebalancePlan>>(plansKey(publicKey), {});
  return map[planId] ?? null;
}

export async function savePlan(
  publicKey: string,
  plan: RebalancePlan
): Promise<void> {
  const map = await readJson<Record<string, RebalancePlan>>(plansKey(publicKey), {});
  map[plan.id] = plan;
  await redisSet(plansKey(publicKey), JSON.stringify(map));
}

export async function listHistory(
  publicKey: string,
  strategyId?: string | null
): Promise<ActionLogEntry[]> {
  const entries = await readJson<ActionLogEntry[]>(historyKey(publicKey), []);
  if (!strategyId) return entries;
  return entries.filter((entry) => entry.strategyId === strategyId);
}

export async function appendHistory(
  publicKey: string,
  entry: ActionLogEntry
): Promise<void> {
  const entries = await readJson<ActionLogEntry[]>(historyKey(publicKey), []);
  entries.push(entry);
  await redisSet(historyKey(publicKey), JSON.stringify(entries));
}
