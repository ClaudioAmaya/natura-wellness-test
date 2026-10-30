import { formatMoney } from "../part-a/subscriptionView";
import { copy } from "./copy";

export type Purchase = "subscribe" | "oneTime";

export const MIN_QUANTITY = 1;
export const MAX_QUANTITY = 10;

export const unitCents = (purchase: Purchase) =>
  purchase === "subscribe" ? copy.subscribe.priceCents : copy.oneTime.priceCents;

export function clampQuantity(n: number): number {
  if (!Number.isFinite(n)) return MIN_QUANTITY;
  return Math.min(MAX_QUANTITY, Math.max(MIN_QUANTITY, Math.round(n)));
}

/** The unit price is already rounded to cents (2546), so the total is unit x quantity. */
export const totalCents = (purchase: Purchase, quantity: number) => unitCents(purchase) * clampQuantity(quantity);

// copy.finePrint is written for the default selection; swap in the current frequency and total.
const DEFAULT_FREQUENCY = copy.subscribe.frequencyOptions[0];
const DEFAULT_PRICE = formatMoney(copy.subscribe.priceCents);

export function finePrint(purchase: Purchase, frequency: string, quantity: number): string | null {
  if (purchase !== "subscribe") return null;
  return copy.finePrint
    .replace(DEFAULT_FREQUENCY, frequency)
    .replace(DEFAULT_PRICE, formatMoney(totalCents(purchase, quantity)));
}
