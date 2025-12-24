import { describe, it, expect } from "vitest";
import {
  cooldownSeconds,
  calculateAmount,
  applyHpChange,
  isCooldownActive,
  isDuelExpired,
  isWinningHit,
} from "./duel.logic";

describe("duel logic test", () => {
  it("cooldownSeconds: attack=1, cast/heal=2", () => {
    expect(cooldownSeconds("attack")).toBe(1);
    expect(cooldownSeconds("cast")).toBe(2);
    expect(cooldownSeconds("heal")).toBe(2);
  });

  it("calculate amount", () => {
    const stats = { strength: 3, agility: 4, intelligence: 5, faith: 6 };
    expect(calculateAmount("attack", stats)).toBe(7);
    expect(calculateAmount("cast", stats)).toBe(10);
    expect(calculateAmount("heal", stats)).toBe(6);
  });

  it("applyHpChange: heal increases selfHp", () => {
    const r = applyHpChange("heal", 10, 20, 6);
    expect(r.selfHp).toBe(16);
    expect(r.enemyHp).toBe(20);
  });

  it("applyHpChange: attack reduces enemyHp but not below 0", () => {
    expect(applyHpChange("attack", 10, 20, 6).enemyHp).toBe(14);
    expect(applyHpChange("attack", 10, 5, 999).enemyHp).toBe(0);
  });

  it("is cooldown active", () => {
    const now = new Date("2025-01-01T00:00:10Z");
    const last = new Date("2025-01-01T00:00:09Z");

    expect(isCooldownActive(last, now, 2)).toBe(true);
    expect(isCooldownActive(last, now, 1)).toBe(false);
    expect(isCooldownActive(null, now, 2)).toBe(false);
  });

  it("is duel expired", () => {
    const startedAt = new Date(Date.now() - 10_000);
    expect(isDuelExpired(startedAt, 5_000)).toBe(true);
    expect(isDuelExpired(startedAt, 20_000)).toBe(false);
  });

  it("is winning hit", () => {
    expect(isWinningHit("attack", 0)).toBe(true);
    expect(isWinningHit("cast", 0)).toBe(true);
    expect(isWinningHit("heal", 0)).toBe(false);
    expect(isWinningHit("attack", 5)).toBe(false);
  });
});
