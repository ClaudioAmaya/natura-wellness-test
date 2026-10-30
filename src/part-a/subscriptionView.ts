import type { Subscription } from "../api/types";

const DAY_MS = 24 * 60 * 60 * 1000;

export type ItemView = { sku: string; name: string; quantity: number; imageUrl: string | null };

// The API's nullable fields resolved per status, so rendering code never null-checks.
export type SubscriptionView =
  | {
      status: "active";
      items: ItemView[];
      nextChargeAt: Date;
      totalCents: number;
      skipTo: Date;
      intervalDays: number;
      discountPercent: number;
    }
  | { status: "paused"; items: ItemView[]; pausedUntil: Date | null }
  | { status: "cancelled"; items: ItemView[]; cancelledAt: Date | null };

// Missing or unparseable timestamps both become null.
function toDate(iso: string | null): Date | null {
  const date = iso ? new Date(iso) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
}

export function toView(sub: Subscription): SubscriptionView {
  // Prices are dropped on purpose: per-item discounted prices don't add up to the server total.
  const items = sub.items.map(({ sku, name, quantity, imageUrl }) => ({ sku, name, quantity, imageUrl }));

  switch (sub.status) {
    case "active": {
      const nextChargeAt = toDate(sub.nextChargeAt);
      if (!nextChargeAt || sub.nextChargeTotalCents === null) {
        throw new Error("Active subscription is missing its next charge");
      }
      return {
        status: "active",
        items,
        nextChargeAt,
        totalCents: sub.nextChargeTotalCents,
        skipTo: new Date(nextChargeAt.getTime() + sub.intervalDays * DAY_MS),
        intervalDays: sub.intervalDays,
        discountPercent: sub.discountPercent,
      };
    }
    case "paused":
      return { status: "paused", items, pausedUntil: toDate(sub.pausedUntil) };
    case "cancelled":
      return { status: "cancelled", items, cancelledAt: toDate(sub.cancelledAt) };
  }
}

function format(date: Date, options: Intl.DateTimeFormatOptions): string {
  const otherYear = date.getFullYear() !== new Date().getFullYear();
  return date.toLocaleDateString("en-US", { ...options, ...(otherYear && { year: "numeric" }) });
}

/** "Thursday, November 5": for sentences where the exact day matters (confirmation, success). */
export const formatDate = (date: Date) => format(date, { weekday: "long", month: "long", day: "numeric" });

/** "November 5": for the big date lines, so their length barely varies. */
export const formatShortDate = (date: Date) => format(date, { month: "long", day: "numeric" });

export const formatMoney = (cents: number) =>
  (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
