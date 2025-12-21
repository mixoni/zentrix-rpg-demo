import { computeItemDisplayName } from "./logic";

test("item display name suffix", () => {
  expect(computeItemDisplayName("Sword", { strength: 3, agility: 0, intelligence: 0, faith: 0 })).toBe("Sword of Strength");
  expect(computeItemDisplayName("Ring", { strength: 1, agility: 1, intelligence: 0, faith: 0 })).toBe("Ring of Balance");
  expect(computeItemDisplayName("Stick", { strength: 0, agility: 0, intelligence: 0, faith: 0 })).toBe("Stick");
});
