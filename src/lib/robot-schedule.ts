/**
 * Shared robot schedule. The admin switches the robot on (robot_settings.running + started_at);
 * every client derives the same cycles and signals from those values, so all users see the
 * same signal at the same time without any server job.
 */
import {
  detectSignal,
  rollRound,
  seedHistory,
  type Round,
  type Side,
  type Signal,
} from "./bacbo-engine";

export const SIGNAL_MS = 20_000;
const BASE_ROUNDS = 40;
const MAX_EXTRA_ROUNDS = 60;

export interface ScheduleConfig {
  startedAt: number;
  analysisMs: number;
  minConfidence: number;
  signalMs?: number;
}

export type RobotPhase = "off" | "analyzing" | "signal";

export interface RobotView {
  phase: RobotPhase;
  cycle: number;
  phaseStart: number;
  phaseEnd: number;
  signal: Signal | null;
  history: Round[];
}

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seedFor(startedAt: number, cycle: number) {
  let h = 2166136261;
  for (const ch of `${startedAt}:${cycle}`) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const cache = new Map<string, { history: Round[]; signal: Signal | null }>();

/** Simulated rounds and resulting signal for one cycle. Deterministic for the same config. */
export function cycleData(cfg: ScheduleConfig, cycle: number) {
  const key = `${cfg.startedAt}:${cfg.minConfidence}:${cycle}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const rng = mulberry32(seedFor(cfg.startedAt, cycle));
  const history = seedHistory(BASE_ROUNDS, rng);
  let signal: Signal | null = null;
  for (let i = 0; i <= MAX_EXTRA_ROUNDS; i++) {
    signal = detectSignal(history, cfg.minConfidence);
    if (signal) break;
    if (i < MAX_EXTRA_ROUNDS) history.push(rollRound(rng));
  }
  const data = { history, signal };
  if (cache.size > 200) cache.clear();
  cache.set(key, data);
  return data;
}

const cycleLength = (cfg: ScheduleConfig) => cfg.analysisMs + (cfg.signalMs ?? SIGNAL_MS);

export function robotView(cfg: ScheduleConfig | null, now: number): RobotView {
  if (!cfg)
    return {
      phase: "off",
      cycle: -1,
      phaseStart: now,
      phaseEnd: Infinity,
      signal: null,
      history: [],
    };
  const len = cycleLength(cfg);
  const elapsed = Math.max(0, now - cfg.startedAt);
  const cycle = Math.floor(elapsed / len);
  const start = cfg.startedAt + cycle * len;
  const { history, signal } = cycleData(cfg, cycle);
  const signalAt = start + cfg.analysisMs;
  if (signal && now >= signalAt) {
    return { phase: "signal", cycle, phaseStart: signalAt, phaseEnd: start + len, signal, history };
  }
  // No strong pattern this cycle: keep analyzing until the next cycle starts.
  return {
    phase: "analyzing",
    cycle,
    phaseStart: start,
    phaseEnd: signal ? signalAt : start + len,
    signal: null,
    history,
  };
}

export interface SessionSignal {
  key: string;
  side: Side;
  at: number;
}

/** Signals whose reveal time falls in [from, to], newest first (at most `limit`). */
export function signalsBetween(
  cfg: ScheduleConfig,
  from: number,
  to: number,
  limit = 60,
): SessionSignal[] {
  const len = cycleLength(cfg);
  const out: SessionSignal[] = [];
  const last = Math.floor(Math.max(0, to - cfg.startedAt) / len);
  for (let c = last; c >= 0 && out.length < limit; c--) {
    const at = cfg.startedAt + c * len + cfg.analysisMs;
    if (at > to) continue;
    if (at < from) break;
    const { signal } = cycleData(cfg, c);
    if (signal) out.push({ key: `${cfg.startedAt}:${c}`, side: signal.side, at });
  }
  return out;
}

/** Merges new signals into the session list: deduped by key, newest first. */
export function mergeSignals(
  existing: SessionSignal[],
  incoming: SessionSignal[],
  limit = 60,
): SessionSignal[] {
  const map = new Map<string, SessionSignal>();
  for (const s of [...existing, ...incoming]) map.set(s.key, s);
  return [...map.values()].sort((a, b) => b.at - a.at).slice(0, limit);
}
