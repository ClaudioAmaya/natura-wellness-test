export type SubscriptionStatus = "active" | "paused" | "cancelled";

export interface SubscriptionItem {
  sku: string;
  name: string;
  quantity: number;
  /** Price before the subscription discount, in cents. */
  unitPriceCents: number;
  /** Not every product has an image. */
  imageUrl: string | null;
}

export interface Subscription {
  id: string;
  status: SubscriptionStatus;
  items: SubscriptionItem[];
  discountPercent: number;
  intervalDays: number;
  /** ISO timestamp. Null unless the subscription is active. */
  nextChargeAt: string | null;
  /** What the customer will be charged next time, after discount, in cents. Null unless active. */
  nextChargeTotalCents: number | null;
  /** ISO timestamp. Set only when paused. */
  pausedUntil: string | null;
  /** ISO timestamp. Set only when cancelled. */
  cancelledAt: string | null;
  /** Pass this back as expectedUpdatedAt when changing the subscription. */
  updatedAt: string;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}
