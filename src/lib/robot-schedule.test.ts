import { describe, expect, it } from "vitest";
import { mergeSignals, robotView, signalsBetween, SIGNAL_MS, type ScheduleConfig } from "./robot-schedule";

const cfg: ScheduleConfig = { startedAt: 1_800_000_000_000, analysisMs: 15_000, minConfidence: 70 };
const cycleMs = cfg.analysisMs + SIGNAL_MS;

describe("shared robot schedule", () => {
  it("sends no signal while the admin has not switched the robot on", () => {
    const v = robotView(null, Date.now());
    expect(v.phase).toBe("off");
    expect(v.signal).toBeNull();
  });

  it("analyzes during the analysis time, before any signal", () => {
    const v = robotView(cfg, cfg.startedAt + 5_000);
    expect(v.phase).toBe("analyzing");
    expect(v.signal).toBeNull();
  });

  it("every user gets the same signal for the same moment", () => {
    for (let c = 0; c < 10; c++) {
      const t = cfg.startedAt + c * cycleMs + cfg.analysisMs + 1_000;
      const a = robotView(cfg, t);
      const b = robotView({ ...cfg }, t);
      expect(a.phase).toBe(b.phase);
      expect(a.signal?.side).toBe(b.signal?.side);
    }
  });

  it("reveals a Jogador or Casa signal after the analysis time", () => {
    const sides = Array.from({ length: 10 }, (_, c) => robotView(cfg, cfg.startedAt + c * cycleMs + cfg.analysisMs + 1).signal?.side);
    const found = sides.filter(Boolean);
    expect(found.length).toBeGreaterThan(0);
    for (const s of found) expect(["player", "banker"]).toContain(s);
  });

  it("session history only includes signals revealed after the user signed in", () => {
    const signIn = cfg.startedAt + 3 * cycleMs;
    const now = cfg.startedAt + 8 * cycleMs;
    const list = signalsBetween(cfg, signIn, now);
    for (const s of list) expect(s.at).toBeGreaterThanOrEqual(signIn);
    expect(list.length).toBeLessThanOrEqual(5);
    expect(signalsBetween(cfg, now + 1, now)).toEqual([]);
  });

  it("merging keeps one entry per signal, newest first", () => {
    const a = { key: "x:1", side: "player" as const, at: 1 };
    const b = { key: "x:2", side: "banker" as const, at: 2 };
    expect(mergeSignals([a], [a, b])).toEqual([b, a]);
  });
});
