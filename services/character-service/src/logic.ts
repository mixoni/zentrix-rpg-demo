export type Stats = {
  strength: number;
  agility: number;
  intelligence: number;
  faith: number;
};

export function computeItemDisplayName(baseName: string, bonus: Stats): string {
  const entries: Array<[keyof Stats, number]> = [
    ["strength", bonus.strength],
    ["agility", bonus.agility],
    ["intelligence", bonus.intelligence],
    ["faith", bonus.faith],
  ];
  const max = Math.max(...entries.map(([,v]) => v));
  if (max <= 0) return baseName;

  const top = entries.filter(([,v]) => v === max).map(([k]) => k);
  // If tie, keep it generic
  if (top.length !== 1) return baseName + " of Balance";

  const suffixMap: Record<keyof Stats, string> = {
    strength: "of Strength",
    agility: "of Agility",
    intelligence: "of Intelligence",
    faith: "of Faith",
  };
  return baseName + " " + suffixMap[top[0]];
}

export function sumStats(base: Stats, bonuses: Stats[]): Stats {
  return bonuses.reduce((acc, b) => ({
    strength: acc.strength + b.strength,
    agility: acc.agility + b.agility,
    intelligence: acc.intelligence + b.intelligence,
    faith: acc.faith + b.faith,
  }), { ...base });
}
