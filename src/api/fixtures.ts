import type { Subscription, SubscriptionItem } from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;
const daysFromNow = (days: number) => new Date(Date.now() + days * DAY_MS).toISOString();

const items: SubscriptionItem[] = [
  { sku: "NW-VITD-60", name: "Vitamin D, 60 softgels", quantity: 1, unitPriceCents: 2995, imageUrl: "/product.jpg" },
  { sku: "NW-MULTI-30", name: "Multivitamin, 30 tablets", quantity: 2, unitPriceCents: 4495, imageUrl: null },
];

export function totalAfterDiscount(items: SubscriptionItem[], discountPercent: number): number {
  const subtotal = items.reduce((sum, item) => sum + item.unitPriceCents * item.quantity, 0);
  return Math.round((subtotal * (100 - discountPercent)) / 100);
}

const base = {
  id: "sub_8F2K41",
  items,
  discountPercent: 15,
  intervalDays: 30,
  nextChargeAt: null,
  nextChargeTotalCents: null,
  pausedUntil: null,
  cancelledAt: null,
  updatedAt: daysFromNow(-3),
} satisfies Omit<Subscription, "status">;

export const fixtures: Record<"active" | "paused" | "cancelled", () => Subscription> = {
  active: () => ({
    ...base,
    status: "active",
    nextChargeAt: daysFromNow(6),
    nextChargeTotalCents: totalAfterDiscount(items, base.discountPercent),
  }),
  paused: () => ({ ...base, status: "paused", pausedUntil: daysFromNow(24) }),
  cancelled: () => ({ ...base, status: "cancelled", cancelledAt: daysFromNow(-10) }),
};
