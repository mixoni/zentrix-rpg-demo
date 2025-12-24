export type DuelAction = "attack" | "cast" | "heal";

export type Stats = {
  strength: number;
  agility: number;
  intelligence: number;
  faith: number;
};

export function cooldownSeconds(action: DuelAction): number {
  return action === "attack" ? 1 : 2;
}

function assertNever(x: never): never {
  throw new Error(`Unhandled DuelAction: ${x}`);
}

export function calculateAmount(action: DuelAction, stats: Stats): number {
  switch (action) {
    case "attack":
      return stats.strength + stats.agility;
    case "cast":
      return 2 * stats.intelligence;
    case "heal":
      return stats.faith;
    default:
      return assertNever(action);
  }
}

export function applyHpChange(
  action: DuelAction,
  selfHp: number,
  enemyHp: number,
  amount: number
): { selfHp: number; enemyHp: number } {
  if (action === "heal") {
    return { selfHp: selfHp + amount, enemyHp };
  }
  return { selfHp, enemyHp: Math.max(0, enemyHp - amount) };
}

export function isCooldownActive(
  lastActionAt: Date | null,
  now: Date,
  cooldownSeconds: number
): boolean {
  if (!lastActionAt) return false;
  return (now.getTime() - lastActionAt.getTime()) / 1000 < cooldownSeconds;
}

export function isDuelExpired(startedAt: Date, timeoutMs: number): boolean {
  return Date.now() - startedAt.getTime() > timeoutMs;
}

export function isWinningHit(action: DuelAction, enemyHpAfter: number): boolean {
  return action !== "heal" && enemyHpAfter === 0;
}
