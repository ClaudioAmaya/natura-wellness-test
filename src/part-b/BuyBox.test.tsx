import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { formatMoney } from "../part-a/subscriptionView";
import { BuyBox } from "./BuyBox";
import { copy } from "./copy";
import { finePrint } from "./pricing";

afterEach(cleanup);

const subscribeRadio = () => screen.getByRole<HTMLInputElement>("radio", { name: new RegExp(copy.subscribe.label) });
const oneTimeRadio = () => screen.getByRole<HTMLInputElement>("radio", { name: new RegExp(copy.oneTime.label) });
const addToCart = () => screen.getByRole("button", { name: new RegExp(`^${copy.addToCart}`) });
const quantity = () => screen.getByRole("group", { name: "Quantity" });
const decrease = () => within(quantity()).getByRole("button", { name: "Decrease quantity" });
const increase = () => within(quantity()).getByRole("button", { name: "Increase quantity" });
// The visible number; the output also holds visually hidden "Quantity " for screen readers.
const quantityValue = () => within(quantity()).getByRole("status").textContent?.replace(/^Quantity /, "");
const frequency = () => screen.queryByRole<HTMLSelectElement>("combobox", { name: copy.subscribe.frequencyLabel });

describe("purchase options", () => {
  test("subscribe is selected by default, with its frequency select, perks and fine print", () => {
    render(<BuyBox />);
    expect(subscribeRadio().checked).toBe(true);
    expect(oneTimeRadio().checked).toBe(false);
    expect(frequency()?.value).toBe(copy.subscribe.frequencyOptions[0]);
    for (const perk of copy.subscribe.perks) expect(screen.getByText(perk)).toBeTruthy();
    expect(screen.getByText(copy.finePrint)).toBeTruthy();
  });

  test("switching to one-time updates the total, collapses the subscribe extras and hides the fine print", () => {
    render(<BuyBox />);
    fireEvent.click(oneTimeRadio());

    expect(oneTimeRadio().checked).toBe(true);
    expect(addToCart().textContent).toContain(formatMoney(copy.oneTime.priceCents));
    // Not rendered at all, so not reachable by keyboard either.
    expect(frequency()).toBeNull();
    for (const perk of copy.subscribe.perks) expect(screen.queryByText(perk)).toBeNull();
    expect(screen.queryByText(copy.finePrint)).toBeNull();

    fireEvent.click(subscribeRadio());
    expect(frequency()).not.toBeNull();
    expect(screen.getByText(copy.finePrint)).toBeTruthy();
  });

  test("the fine print follows the chosen frequency and quantity", () => {
    render(<BuyBox />);
    fireEvent.change(frequency()!, { target: { value: "60 days" } });
    fireEvent.click(increase());
    expect(screen.getByText(finePrint("subscribe", "60 days", 2)!)).toBeTruthy();
  });
});

describe("quantity", () => {
  test("starts at 1 and cannot go below it; decrease is aria-disabled there, not disabled", () => {
    render(<BuyBox />);
    expect(quantityValue()).toBe("1");
    expect(decrease().getAttribute("aria-disabled")).toBe("true");
    expect(decrease().hasAttribute("disabled")).toBe(false);
    fireEvent.click(decrease());
    expect(quantityValue()).toBe("1");
  });

  test("stops at 10; increase is aria-disabled there", () => {
    render(<BuyBox />);
    for (let i = 0; i < 12; i++) fireEvent.click(increase());
    expect(quantityValue()).toBe("10");
    expect(increase().getAttribute("aria-disabled")).toBe("true");
    expect(decrease().getAttribute("aria-disabled")).toBe("false");
  });
});

describe("review fixes", () => {
  test("the buy box is inside a main landmark", () => {
    render(<BuyBox />);
    expect(within(screen.getByRole("main")).getByRole("heading", { level: 1, name: copy.title })).toBeTruthy();
  });

  test("the quantity output announces 'Quantity 2' while the hidden part stays out of the visible number", () => {
    render(<BuyBox />);
    fireEvent.click(increase());
    const output = within(quantity()).getByRole("status");
    expect(output.textContent).toBe("Quantity 2");
    expect(output.querySelector('[class*="srOnly"]')?.textContent).toBe("Quantity ");
  });

  test("the rating reads '4.8 out of 5' for screen readers", () => {
    render(<BuyBox />);
    expect(screen.getByText((_, el) => el?.tagName === "SPAN" && el.textContent === `${copy.rating} out of 5`)).toBeTruthy();
  });

  test("the product image has a descriptive alt that does not just repeat the title", () => {
    render(<BuyBox />);
    const alt = screen.getByRole("img").getAttribute("alt") ?? "";
    expect(alt).not.toBe(copy.title);
    expect(alt).toContain(copy.title);
    expect(alt).toMatch(/60 softgels/i);
  });
});

describe("add to cart", () => {
  test("its accessible name includes the total for the selection and quantity", () => {
    render(<BuyBox />);
    expect(screen.getByRole("button", { name: `${copy.addToCart} ${formatMoney(2546)}` })).toBeTruthy();
    fireEvent.click(increase());
    fireEvent.click(increase());
    expect(screen.getByRole("button", { name: `${copy.addToCart} ${formatMoney(7638)}` })).toBeTruthy();
    fireEvent.click(oneTimeRadio());
    expect(screen.getByRole("button", { name: `${copy.addToCart} ${formatMoney(3 * 2995)}` })).toBeTruthy();
  });
});
