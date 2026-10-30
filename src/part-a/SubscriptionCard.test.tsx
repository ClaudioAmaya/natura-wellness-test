import { StrictMode } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { fixtures } from "../api/fixtures";
import { getSubscription, skipNextShipment } from "../api/mockApi";
import { ApiError, type Subscription } from "../api/types";
import { SubscriptionCard } from "./SubscriptionCard";
import { formatDate, formatMoney, formatShortDate } from "./subscriptionView";

vi.mock("../api/mockApi", () => ({ getSubscription: vi.fn(), skipNextShipment: vi.fn() }));
const getSub = vi.mocked(getSubscription);
const skip = vi.mocked(skipNextShipment);

const DAY_MS = 24 * 60 * 60 * 1000;
const LOAD_ERROR = "We couldn't load your subscription right now. Please try again in a moment.";
const CONFLICT =
  "Your subscription was updated elsewhere. We've refreshed it. Please check the details and try again if you still want to skip.";
const SKIP_ERROR = "We couldn't skip your shipment, and nothing has changed. Please try again.";
const SLOW = "This is taking longer than usual…";
const card = () => screen.getByRole("region", { name: "Manage my subscription" });
// Matches a sentence even when part of it is wrapped in markup (e.g. a bold amount).
const sentence = (text: string) => (_: string, el: Element | null) => el?.tagName === "P" && el.textContent === text;

afterEach(() => {
  vi.useRealTimers();
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

describe("skip flow", () => {
  async function renderActive(sub: Subscription = fixtures.active()) {
    getSub.mockResolvedValueOnce(sub);
    render(<SubscriptionCard />);
    await screen.findByText(formatShortDate(new Date(sub.nextChargeAt!)));
    return sub;
  }
  // What the server returns after a successful skip.
  const skipped = (sub: Subscription): Subscription => ({
    ...sub,
    nextChargeAt: new Date(Date.parse(sub.nextChargeAt!) + sub.intervalDays * DAY_MS).toISOString(),
    updatedAt: new Date(Date.parse(sub.updatedAt) + 1000).toISOString(),
  });
  // The same subscription after someone else changed it.
  const changedElsewhere = (sub: Subscription, days: number): Subscription => ({
    ...sub,
    nextChargeAt: new Date(Date.parse(sub.nextChargeAt!) + days * DAY_MS).toISOString(),
    updatedAt: new Date(Date.parse(sub.updatedAt) + 2000).toISOString(),
  });
  const skipButton = () => screen.getByRole("button", { name: "Skip next shipment" });
  const confirmButton = () => screen.getByRole("button", { name: "Yes, skip it" });
  const keepButton = () => screen.getByRole("button", { name: "Keep my shipment" });
  const panelHeading = () => screen.queryByRole("heading", { name: /^Skip the .* shipment\?$/ });
  const statusText = () => screen.getByRole("status").textContent;
  const alertText = () => screen.getByRole("alert").textContent;

  test("Skip opens the panel in its place, focuses its heading and names the new date and unchanged amount", async () => {
    const sub = await renderActive();
    fireEvent.click(skipButton());

    const heading = screen.getByRole("heading", { name: `Skip the ${formatDate(new Date(sub.nextChargeAt!))} shipment?` });
    expect(document.activeElement).toBe(heading);
    const skipTo = new Date(Date.parse(sub.nextChargeAt!) + sub.intervalDays * DAY_MS);
    expect(
      screen.getByText(
        `Your next shipment and charge move to ${formatDate(skipTo)}. The amount stays ${formatMoney(sub.nextChargeTotalCents!)}.`,
      ),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Skip next shipment" })).toBeNull();
    expect(skip).not.toHaveBeenCalled();
  });

  test.each([
    ["a success", "Skip next shipment", (sub: Subscription) => skip.mockResolvedValueOnce(skipped(sub))],
    ["a skip error", "Skip next shipment", () => skip.mockRejectedValueOnce(new ApiError(500, "Internal server error"))],
    [
      "a 409",
      "Skip next shipment",
      (sub: Subscription) => {
        skip.mockRejectedValueOnce(new ApiError(409, "Subscription was modified since it was loaded"));
        getSub.mockResolvedValueOnce(changedElsewhere(sub, 1));
      },
    ],
    [
      "a 409 whose refetch also fails",
      "Try again",
      () => {
        skip.mockRejectedValueOnce(new ApiError(409, "Subscription was modified since it was loaded"));
        getSub.mockRejectedValueOnce(new ApiError(500, "Internal server error"));
      },
    ],
  ] as const)("after %s, focus has already moved when the %s button appears (never left on <body>)", async (_, appears, arrange) => {
    const sub = await renderActive();
    arrange(sub);
    fireEvent.click(skipButton());

    // Records focus in the same microtask checkpoint as the DOM change, before any later task
    // (such as a passive effect) can run. A focus move that lands a task later fails this.
    let focusedWhenItAppeared: Element | null | undefined;
    const observer = new MutationObserver(() => {
      const button = screen.queryByRole("button", { name: appears });
      if (button && focusedWhenItAppeared === undefined) focusedWhenItAppeared = document.activeElement;
    });
    observer.observe(document.body, { childList: true, subtree: true });
    fireEvent.click(confirmButton());
    await waitFor(() => expect(focusedWhenItAppeared).toBeDefined());
    observer.disconnect();

    const expected =
      appears === "Try again" ? screen.getByRole("heading", { name: "Manage my subscription" }) : skipButton();
    expect(focusedWhenItAppeared).toBe(expected);
  });

  test("Keep my shipment closes the panel and returns focus to Skip without calling the API", async () => {
    await renderActive();
    fireEvent.click(skipButton());
    fireEvent.click(keepButton());

    expect(panelHeading()).toBeNull();
    expect(document.activeElement).toBe(skipButton());
    expect(skip).not.toHaveBeenCalled();
  });

  test("Yes, skip it sends one request, shows the server's new date and the success notice, and focuses Skip", async () => {
    const sub = await renderActive();
    const after = skipped(sub);
    skip.mockResolvedValueOnce(after);
    fireEvent.click(skipButton());
    fireEvent.click(confirmButton());

    const newDate = new Date(after.nextChargeAt!);
    expect(await screen.findByText(formatShortDate(newDate))).toBeTruthy();
    expect(skip).toHaveBeenCalledTimes(1);
    expect(skip).toHaveBeenCalledWith({ subscriptionId: sub.id, expectedUpdatedAt: sub.updatedAt });
    expect(statusText()).toBe(
      `Done. Your next charge is now ${formatDate(newDate)}. The amount stays ${formatMoney(after.nextChargeTotalCents!)}.`,
    );
    expect(panelHeading()).toBeNull();
    expect(document.activeElement).toBe(skipButton());

    // Skip stays available, and a second skip needs a fresh confirmation.
    fireEvent.click(skipButton());
    expect(panelHeading()).not.toBeNull();
    expect(statusText()).toBe("");
    expect(skip).toHaveBeenCalledTimes(1);
  });

  test("a 409 refetches, shows the conflict copy, returns to idle with fresh data and focuses Skip, without retrying", async () => {
    const sub = await renderActive();
    const fresh = changedElsewhere(sub, 2);
    skip.mockRejectedValueOnce(new ApiError(409, "Subscription was modified since it was loaded"));
    getSub.mockResolvedValueOnce(fresh);
    fireEvent.click(skipButton());
    fireEvent.click(confirmButton());

    expect(await screen.findByText(formatShortDate(new Date(fresh.nextChargeAt!)))).toBeTruthy();
    expect(alertText()).toBe(CONFLICT);
    expect(panelHeading()).toBeNull();
    expect(document.activeElement).toBe(skipButton());
    expect(getSub).toHaveBeenCalledTimes(2);
    expect(skip).toHaveBeenCalledTimes(1);
  });

  test("a second skip that also gets a 409 uses the fresh updatedAt and still does not loop", async () => {
    const sub = await renderActive();
    const fresh1 = changedElsewhere(sub, 1);
    const fresh2 = changedElsewhere(fresh1, 1);
    skip.mockRejectedValue(new ApiError(409, "Subscription was modified since it was loaded"));
    getSub.mockResolvedValueOnce(fresh1).mockResolvedValueOnce(fresh2);

    fireEvent.click(skipButton());
    fireEvent.click(confirmButton());
    await screen.findByText(formatShortDate(new Date(fresh1.nextChargeAt!)));
    fireEvent.click(skipButton());
    fireEvent.click(confirmButton());
    await screen.findByText(formatShortDate(new Date(fresh2.nextChargeAt!)));

    expect(skip).toHaveBeenCalledTimes(2);
    expect(skip).toHaveBeenNthCalledWith(1, { subscriptionId: sub.id, expectedUpdatedAt: sub.updatedAt });
    expect(skip).toHaveBeenNthCalledWith(2, { subscriptionId: sub.id, expectedUpdatedAt: fresh1.updatedAt });
    expect(getSub).toHaveBeenCalledTimes(3);
    expect(alertText()).toBe(CONFLICT);
    expect(document.activeElement).toBe(skipButton());
  });

  test("a 409 whose refetch also fails shows the load-error state and focuses the card heading", async () => {
    await renderActive();
    skip.mockRejectedValueOnce(new ApiError(409, "Subscription was modified since it was loaded"));
    getSub.mockRejectedValueOnce(new ApiError(500, "Internal server error"));
    fireEvent.click(skipButton());
    fireEvent.click(confirmButton());

    await screen.findByText(LOAD_ERROR);
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Skip next shipment" })).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "Manage my subscription" }));
    expect(skip).toHaveBeenCalledTimes(1);
  });

  test.each([
    ["a 500", new ApiError(500, "Internal server error")],
    ["a network failure", new TypeError("Failed to fetch")],
  ])("%s on skip shows the skip-error copy, keeps the data, and focuses Skip", async (_, error) => {
    const sub = await renderActive();
    skip.mockRejectedValueOnce(error);
    fireEvent.click(skipButton());
    fireEvent.click(confirmButton());

    await screen.findByText(SKIP_ERROR);
    expect(alertText()).toBe(SKIP_ERROR);
    expect(screen.getByText(formatShortDate(new Date(sub.nextChargeAt!)))).toBeTruthy();
    expect(getSub).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(skipButton());
  });

  test("two clicks on Yes in the same tick send one request; while submitting both buttons are aria-disabled", async () => {
    await renderActive();
    skip.mockReturnValueOnce(new Promise(() => {}));
    fireEvent.click(skipButton());
    const confirm = confirmButton();

    // One act() batches both clicks before any re-render, so only a ref (not state) can stop the second.
    act(() => {
      confirm.click();
      confirm.click();
    });
    expect(skip).toHaveBeenCalledTimes(1);

    const submitting = screen.getByRole("button", { name: "Skipping…" });
    expect(submitting.getAttribute("aria-disabled")).toBe("true");
    expect(submitting.hasAttribute("disabled")).toBe(false);
    expect(keepButton().getAttribute("aria-disabled")).toBe("true");
    expect(keepButton().hasAttribute("disabled")).toBe(false);

    fireEvent.click(keepButton());
    expect(panelHeading()).not.toBeNull();
  });

  test("after 4s of submitting the card says it is taking longer; the message clears when the skip finishes", async () => {
    const sub = await renderActive();
    let resolveSkip!: (s: Subscription) => void;
    skip.mockReturnValueOnce(new Promise((resolve) => (resolveSkip = resolve)));
    fireEvent.click(skipButton());

    vi.useFakeTimers();
    fireEvent.click(confirmButton());
    await act(() => vi.advanceTimersByTimeAsync(3999));
    expect(statusText()).toBe("");
    await act(() => vi.advanceTimersByTimeAsync(1));
    expect(statusText()).toBe(SLOW);

    await act(async () => resolveSkip(skipped(sub)));
    expect(statusText()).not.toBe(SLOW);
    vi.useRealTimers();
  });

  test("the slow message also covers the refetch after a 409", async () => {
    const sub = await renderActive();
    let rejectSkip!: (e: unknown) => void;
    let resolveRefetch!: (s: Subscription) => void;
    skip.mockReturnValueOnce(new Promise((_, reject) => (rejectSkip = reject)));
    getSub.mockReturnValueOnce(new Promise((resolve) => (resolveRefetch = resolve)));
    fireEvent.click(skipButton());

    vi.useFakeTimers();
    fireEvent.click(confirmButton());
    await act(() => vi.advanceTimersByTimeAsync(3000));
    await act(async () => rejectSkip(new ApiError(409, "Subscription was modified since it was loaded")));
    expect(statusText()).toBe("");
    expect(screen.getByRole("button", { name: "Skipping…" })).toBeTruthy();

    await act(() => vi.advanceTimersByTimeAsync(1000));
    expect(statusText()).toBe(SLOW);

    await act(async () => resolveRefetch(changedElsewhere(sub, 1)));
    expect(statusText()).toBe("");
    expect(alertText()).toBe(CONFLICT);
    vi.useRealTimers();
  });
});

describe("notice placement", () => {
  const isBefore = (a: Node, b: Node) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

  test.each([
    ["conflict", "alert"],
    ["success", "status"],
  ] as const)("the %s notice sits below the items and directly above the Skip button", async (kind, role) => {
    const sub = fixtures.active();
    getSub.mockResolvedValueOnce(sub).mockResolvedValueOnce({ ...sub, updatedAt: new Date().toISOString() });
    if (kind === "conflict") skip.mockRejectedValueOnce(new ApiError(409, "Subscription was modified since it was loaded"));
    else skip.mockResolvedValueOnce({ ...sub, updatedAt: new Date().toISOString() });
    render(<SubscriptionCard />);
    fireEvent.click(await screen.findByRole("button", { name: "Skip next shipment" }));
    fireEvent.click(screen.getByRole("button", { name: "Yes, skip it" }));
    await screen.findByText(kind === "conflict" ? CONFLICT : /^Done\./);

    const list = screen.getByRole("list");
    const region = screen.getByRole(role);
    const skipBtn = screen.getByRole("button", { name: "Skip next shipment" });
    expect(isBefore(list, region)).toBe(true);
    expect(isBefore(region, skipBtn)).toBe(true);
  });

  test("both live regions stay mounted as the same nodes from loading to a conflict", async () => {
    const sub = fixtures.active();
    getSub.mockResolvedValueOnce(sub).mockResolvedValueOnce({ ...sub, updatedAt: new Date().toISOString() });
    skip.mockRejectedValueOnce(new ApiError(409, "Subscription was modified since it was loaded"));
    render(<SubscriptionCard />);
    const alertNode = screen.getByRole("alert");
    const statusNode = screen.getByRole("status");

    fireEvent.click(await screen.findByRole("button", { name: "Skip next shipment" }));
    fireEvent.click(screen.getByRole("button", { name: "Yes, skip it" }));
    await screen.findByText(CONFLICT);

    expect(screen.getByRole("alert")).toBe(alertNode);
    expect(screen.getByRole("status")).toBe(statusNode);
  });

  test("the load-error message still comes before Try again", async () => {
    getSub.mockRejectedValueOnce(new ApiError(500, "Internal server error"));
    render(<SubscriptionCard />);
    const tryAgain = await screen.findByRole("button", { name: "Try again" });
    expect(isBefore(screen.getByRole("alert"), tryAgain)).toBe(true);
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
