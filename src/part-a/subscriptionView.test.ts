import { afterEach, describe, expect, test, vi } from "vitest";
import { fixtures } from "../api/fixtures";
import type { Subscription } from "../api/types";
import { formatDate, formatMoney, formatShortDate, toView, type SubscriptionView } from "./subscriptionView";

const DAY_MS = 24 * 60 * 60 * 1000;

function asActive(view: SubscriptionView) {
  if (view.status !== "active") throw new Error(`expected active view, got ${view.status}`);
  return view;
}

afterEach(() => {
  vi.useRealTimers();
});

describe("toView: active", () => {
  test("total is the server's nextChargeTotalCents, not a per-item sum", () => {
    // Per-item rounding of the fixture would give 10188; the server says 10187.
    expect(asActive(toView(fixtures.active())).totalCents).toBe(10187);
    expect(asActive(toView({ ...fixtures.active(), nextChargeTotalCents: 12345 })).totalCents).toBe(12345);
  });

  test("skipTo is nextChargeAt plus intervalDays", () => {
    const sub = { ...fixtures.active(), intervalDays: 60 };
    const view = asActive(toView(sub));
    expect(view.nextChargeAt.getTime()).toBe(Date.parse(sub.nextChargeAt!));
    expect(view.skipTo.getTime()).toBe(Date.parse(sub.nextChargeAt!) + 60 * DAY_MS);
  });

  test("intervalDays and discountPercent come from the data", () => {
    const view = asActive(toView({ ...fixtures.active(), intervalDays: 45, discountPercent: 20 }));
    expect(view.intervalDays).toBe(45);
    expect(view.discountPercent).toBe(20);
  });

  test("items keep name, quantity and a nullable image, without prices", () => {
    const view = toView(fixtures.active());
    expect(view.items).toEqual([
      { sku: "NW-VITD-60", name: "Vitamin D, 60 softgels", quantity: 1, imageUrl: "/product.jpg" },
      { sku: "NW-MULTI-30", name: "Multivitamin, 30 tablets", quantity: 2, imageUrl: null },
    ]);
  });

  test("throws when an active subscription has no nextChargeAt", () => {
    const sub: Subscription = { ...fixtures.active(), nextChargeAt: null };
    expect(() => toView(sub)).toThrow(/active subscription/i);
  });

  test("throws when an active subscription has no nextChargeTotalCents", () => {
    const sub: Subscription = { ...fixtures.active(), nextChargeTotalCents: null };
    expect(() => toView(sub)).toThrow(/active subscription/i);
  });

  test("throws when an active subscription has a malformed nextChargeAt", () => {
    const sub: Subscription = { ...fixtures.active(), nextChargeAt: "not-a-date" };
    expect(() => toView(sub)).toThrow(/active subscription/i);
  });
});

describe("toView: paused and cancelled", () => {
  test("paused maps pausedUntil to a Date", () => {
    const sub = fixtures.paused();
    expect(toView(sub)).toMatchObject({ status: "paused", pausedUntil: new Date(sub.pausedUntil!) });
  });

  test("cancelled maps cancelledAt to a Date", () => {
    const sub = fixtures.cancelled();
    expect(toView(sub)).toMatchObject({ status: "cancelled", cancelledAt: new Date(sub.cancelledAt!) });
  });

  test("a missing date does not throw; it becomes null", () => {
    expect(toView({ ...fixtures.paused(), pausedUntil: null })).toMatchObject({ status: "paused", pausedUntil: null });
    expect(toView({ ...fixtures.cancelled(), cancelledAt: null })).toMatchObject({ status: "cancelled", cancelledAt: null });
  });

  test("a malformed date does not throw; it becomes null", () => {
    expect(toView({ ...fixtures.paused(), pausedUntil: "not-a-date" })).toMatchObject({ status: "paused", pausedUntil: null });
    expect(toView({ ...fixtures.cancelled(), cancelledAt: "not-a-date" })).toMatchObject({ status: "cancelled", cancelledAt: null });
  });
});

describe("formatDate", () => {
  test("omits the year within the current year", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 11, 20, 12));
    expect(formatDate(new Date(2026, 11, 28, 12))).toBe("Monday, December 28");
  });

  test("a skip from December into January shows the year", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 11, 20, 12));
    const sub: Subscription = { ...fixtures.active(), nextChargeAt: new Date(2026, 11, 28, 12).toISOString(), intervalDays: 30 };
    const view = asActive(toView(sub));
    expect(formatDate(view.nextChargeAt)).toBe("Monday, December 28");
    expect(formatDate(view.skipTo)).toBe("Wednesday, January 27, 2027");
  });
});

describe("formatShortDate", () => {
  test("is month and day, without the weekday, within the current year", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 11, 20, 12));
    expect(formatShortDate(new Date(2026, 11, 28, 12))).toBe("December 28");
  });

  test("adds the year when it differs from the current year", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 11, 20, 12));
    expect(formatShortDate(new Date(2027, 0, 27, 12))).toBe("January 27, 2027");
  });
});

describe("formatMoney", () => {
  test("formats cents as USD", () => {
    expect(formatMoney(10187)).toBe("$101.87");
    expect(formatMoney(2546)).toBe("$25.46");
  });
});
