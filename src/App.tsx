import { SubscriptionCard } from "./part-a/SubscriptionCard";
import { BuyBox } from "./part-b/BuyBox";

const part = new URLSearchParams(window.location.search).get("part") === "b" ? "b" : "a";

export function App() {
  return (
    <>
      <nav style={{ display: "flex", gap: 16, padding: "8px 16px", fontFamily: "Inter, sans-serif", fontSize: 13 }}>
        <a href="?part=a&fixture=active">Part A: Subscription card</a>
        <a href="?part=b">Part B: Buy box</a>
      </nav>
      {part === "a" ? <SubscriptionCard /> : <BuyBox />}
    </>
  );
}
