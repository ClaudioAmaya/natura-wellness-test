import type { CSSProperties } from "react";
import { SubscriptionCard } from "./part-a/SubscriptionCard";
import { BuyBox } from "./part-b/BuyBox";

const part = new URLSearchParams(window.location.search).get("part") === "b" ? "b" : "a";

const navStyle: CSSProperties = { display: "flex", gap: 16, padding: "8px 16px", fontFamily: "Inter, sans-serif", fontSize: 13 };
// Part B: the nav floats (max 32px) so the buy box starts at y=0 like the reference screenshot.
const fixedNavStyle: CSSProperties = {
  ...navStyle,
  position: "fixed",
  inset: "0 0 auto 0",
  zIndex: 1,
  boxSizing: "border-box",
  height: 32,
  alignItems: "center",
  padding: "0 16px",
  background: "var(--page)",
};

export function App() {
  return (
    <>
      <nav style={part === "b" ? fixedNavStyle : navStyle}>
        <a href="?part=a&fixture=active">Part A: Subscription card</a>
        <a href="?part=b">Part B: Buy box</a>
      </nav>
      {part === "a" ? <SubscriptionCard /> : <BuyBox />}
    </>
  );
}
