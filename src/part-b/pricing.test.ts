import { describe, expect, test } from "vitest";
import { copy } from "./copy";
import { clampQuantity, finePrint, MAX_QUANTITY, MIN_QUANTITY, totalCents, unitCents } from "./pricing";

describe("unitCents", () => {
  test("comes from copy.ts for each purchase type", () => {
    expect(unitCents("subscribe")).toBe(2546);
    expect(unitCents("oneTime")).toBe(2995);
  });
});

describe("totalCents", () => {
  test("is the rounded unit price times the quantity: 3 x 2546 = 7638, not round(3 x 2995 x 0.85) = 7637", () => {
    expect(totalCents("subscribe", 3)).toBe(7638);
  });

  test("one-time is the list price times the quantity", () => {
    expect(totalCents("oneTime", 2)).toBe(5990);
  });

  test("clamps the quantity before multiplying", () => {
    expect(totalCents("subscribe", 0)).toBe(2546);
    expect(totalCents("subscribe", 99)).toBe(2546 * MAX_QUANTITY);
  });
});

describe("clampQuantity", () => {
  test("keeps the quantity between 1 and 10", () => {
    expect([MIN_QUANTITY, MAX_QUANTITY]).toEqual([1, 10]);
    expect(clampQuantity(0)).toBe(1);
    expect(clampQuantity(-3)).toBe(1);
    expect(clampQuantity(1)).toBe(1);
    expect(clampQuantity(10)).toBe(10);
    expect(clampQuantity(11)).toBe(10);
  });

  test("rounds fractions and treats non-numbers as the minimum", () => {
    expect(clampQuantity(2.6)).toBe(3);
    expect(clampQuantity(Number.NaN)).toBe(1);
  });
});

describe("finePrint", () => {
  test("for 60 days at quantity 2 names the new frequency and the total", () => {
    expect(finePrint("subscribe", "60 days", 2)).toBe(
      "Your subscription renews every 60 days at $50.92 until you cancel. Skip or cancel anytime from your account.",
    );
  });

  test("for the default selection is exactly the provided copy", () => {
    expect(finePrint("subscribe", "30 days", 1)).toBe(copy.finePrint);
  });

  test("is null for a one-time purchase", () => {
    expect(finePrint("oneTime", "30 days", 1)).toBeNull();
  });

  test("copy.finePrint still contains the default frequency and price it is derived from", () => {
    expect(copy.finePrint).toContain(copy.subscribe.frequencyOptions[0]);
    expect(copy.finePrint).toContain("$25.46");
  });
});
