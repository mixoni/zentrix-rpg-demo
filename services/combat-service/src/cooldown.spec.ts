import { describe, expect, test } from "@jest/globals";

function secondsBetween(a: Date | null, b: Date) {
  if (!a) return Infinity;
  return (b.getTime() - a.getTime()) / 1000;
}

describe("cooldown helper", () => {
  test("infinity when null", () => {
    expect(secondsBetween(null, new Date())).toBe(Infinity);
  });
});
