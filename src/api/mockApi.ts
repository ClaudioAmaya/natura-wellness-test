import { fixtures } from "./fixtures";
import { ApiError, type Subscription } from "./types";

// Behaves like our real subscription API: variable latency, and changes are rejected with
// a 409 when the subscription was modified elsewhere since you loaded it.
//
// URL parameters:
//   ?fixture=active | paused | cancelled | error   (default: active)
//   &conflict=always | never                       (default: random, about 1 in 3 skips)

const params = new URLSearchParams(window.location.search);
const fixtureName = params.get("fixture") ?? "active";
const conflictMode = params.get("conflict");

const DAY_MS = 24 * 60 * 60 * 1000;

let server: Subscription | null = fixtureName in fixtures ? fixtures[fixtureName as keyof typeof fixtures]() : null;

const wait = () => new Promise((resolve) => setTimeout(resolve, 400 + Math.random() * 2100));
const copy = <T>(value: T): T => structuredClone(value);

export async function getSubscription(): Promise<Subscription> {
  await wait();
  if (fixtureName === "error") throw new ApiError(500, "Internal server error");
  if (!server) throw new ApiError(404, "Subscription not found");
  return copy(server);
}

export async function skipNextShipment(params: { subscriptionId: string; expectedUpdatedAt: string }): Promise<Subscription> {
  await wait();
  if (!server || server.id !== params.subscriptionId) throw new ApiError(404, "Subscription not found");

  const changedElsewhere = conflictMode === "always" || (conflictMode !== "never" && Math.random() < 0.33);
  if (changedElsewhere) {
    server.updatedAt = new Date().toISOString();
  }
  if (params.expectedUpdatedAt !== server.updatedAt) {
    throw new ApiError(409, "Subscription was modified since it was loaded");
  }
  if (server.status !== "active" || !server.nextChargeAt) {
    throw new ApiError(400, "Only active subscriptions can skip a shipment");
  }

  server.nextChargeAt = new Date(Date.parse(server.nextChargeAt) + server.intervalDays * DAY_MS).toISOString();
  server.updatedAt = new Date().toISOString();
  return copy(server);
}
