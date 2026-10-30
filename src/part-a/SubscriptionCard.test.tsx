import { StrictMode } from "react";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { fixtures } from "../api/fixtures";
import { getSubscription } from "../api/mockApi";
import { ApiError, type Subscription } from "../api/types";
import { SubscriptionCard } from "./SubscriptionCard";
import { formatMoney, formatShortDate } from "./subscriptionView";

vi.mock("../api/mockApi", () => ({ getSubscription: vi.fn(), skipNextShipment: vi.fn() }));
const getSub = vi.mocked(getSubscription);

const LOAD_ERROR = "We couldn't load your subscription right now. Please try again in a moment.";
const card = () => screen.getByRole("region", { name: "Manage my subscription" });
// Matches a sentence even when part of it is wrapped in markup (e.g. a bold amount).
const sentence = (text: string) => (_: string, el: Element | null) => el?.tagName === "P" && el.textContent === text;

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
  vi.restoreAllMocks();
});

describe("loading and active", () => {
  test("shows a busy skeleton first, then the next charge, total, cadence and items", async () => {
    const sub = fixtures.active();
    getSub.mockResolvedValue(sub);
    render(<SubscriptionCard />);

    expect(card().getAttribute("aria-busy")).toBe("true");
    expect(screen.getByRole("status").textContent).toBe("Loading your subscription…");

    expect(await screen.findByText(formatShortDate(new Date(sub.nextChargeAt!)))).toBeTruthy();
    expect(card().getAttribute("aria-busy")).not.toBe("true");
    expect(screen.getByRole("status").textContent).toBe("");
    expect(screen.getByText("Active")).toBeTruthy();
    expect(screen.getByText(sentence(`You'll be charged ${formatMoney(sub.nextChargeTotalCents!)}`))).toBeTruthy();
    expect(screen.getByText(`Every ${sub.intervalDays} days with your ${sub.discountPercent}% discount`)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Skip next shipment" })).toBeTruthy();

    const rows = within(screen.getByRole("list")).getAllByRole("listitem");
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining("Vitamin D, 60 softgels"),
      expect.stringContaining("Multivitamin, 30 tablets"),
    ]);
    expect(rows[0].textContent).toContain("Qty 1");
    expect(rows[1].textContent).toContain("Qty 2");
  });

  test("an item without an image gets a placeholder initial hidden from assistive tech", async () => {
    getSub.mockResolvedValue(fixtures.active());
    render(<SubscriptionCard />);
    const row = (await screen.findByText("Multivitamin, 30 tablets")).closest("li")!;
    expect(row.querySelector("img")).toBeNull();
    expect(within(row).getByText("M").closest("[aria-hidden='true']")).not.toBeNull();
  });
});

describe("paused and cancelled", () => {
  test("paused shows its status and date, no charge and no skip", async () => {
    const sub = fixtures.paused();
    getSub.mockResolvedValue(sub);
    render(<SubscriptionCard />);
    expect(await screen.findByText(`Paused until ${formatShortDate(new Date(sub.pausedUntil!))}`)).toBeTruthy();
    expect(screen.getByText("Paused")).toBeTruthy();
    expect(screen.queryByText(/You'll be charged/)).toBeNull();
    expect(screen.queryByRole("button", { name: "Skip next shipment" })).toBeNull();
  });

  test("cancelled shows its status and date, no charge and no skip", async () => {
    const sub = fixtures.cancelled();
    getSub.mockResolvedValue(sub);
    render(<SubscriptionCard />);
    expect(await screen.findByText(`Cancelled on ${formatShortDate(new Date(sub.cancelledAt!))}`)).toBeTruthy();
    expect(screen.getByText("Cancelled")).toBeTruthy();
    expect(screen.queryByText(/You'll be charged/)).toBeNull();
    expect(screen.queryByRole("button", { name: "Skip next shipment" })).toBeNull();
  });

  test("paused without a date shows the status alone", async () => {
    getSub.mockResolvedValue({ ...fixtures.paused(), pausedUntil: null });
    render(<SubscriptionCard />);
    expect(await screen.findByText("Paused")).toBeTruthy();
    expect(screen.queryByText(/Paused until/)).toBeNull();
  });
});

describe("load error", () => {
  test.each([
    ["a 500", () => Promise.reject(new ApiError(500, "Internal server error"))],
    ["a 404", () => Promise.reject(new ApiError(404, "Subscription not found"))],
    ["invalid data", () => Promise.resolve<Subscription>({ ...fixtures.active(), nextChargeAt: null })],
  ])("%s shows the fixed message, and Try again reloads", async (_, firstCall) => {
    const sub = fixtures.active();
    getSub.mockImplementationOnce(firstCall).mockResolvedValueOnce(sub);
    render(<SubscriptionCard />);

    await screen.findByText(LOAD_ERROR);
    expect(screen.getByRole("alert").textContent).toBe(LOAD_ERROR);
    expect(screen.queryByText(/Internal server error|Subscription not found/)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(screen.getByRole("status").textContent).toBe("Loading your subscription…");
    expect(await screen.findByText(formatShortDate(new Date(sub.nextChargeAt!)))).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toBe("");
    expect(getSub).toHaveBeenCalledTimes(2);
  });
});

describe("StrictMode", () => {
  test("ignores the stale first load and renders one card without errors", async () => {
    const consoleError = vi.spyOn(console, "error");
    let resolveFirst!: (sub: Subscription) => void;
    const sub = fixtures.active();
    getSub.mockImplementationOnce(() => new Promise((resolve) => (resolveFirst = resolve))).mockResolvedValueOnce(sub);

    render(
      <StrictMode>
        <SubscriptionCard />
      </StrictMode>,
    );
    await screen.findByText(formatShortDate(new Date(sub.nextChargeAt!)));
    // The first (discarded) effect's request resolves late with different data; it must be ignored.
    await act(async () => resolveFirst(fixtures.paused()));

    expect(getSub).toHaveBeenCalledTimes(2);
    expect(screen.getAllByRole("region", { name: "Manage my subscription" })).toHaveLength(1);
    expect(screen.queryByText("Paused")).toBeNull();
    expect(screen.getAllByRole("button", { name: "Skip next shipment" })).toHaveLength(1);
    expect(consoleError).not.toHaveBeenCalled();
  });
});
