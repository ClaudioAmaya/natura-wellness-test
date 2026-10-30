import { useEffect, useId, useState } from "react";
import { getSubscription } from "../api/mockApi";
import styles from "./SubscriptionCard.module.css";
import { formatMoney, formatShortDate, toView, type ItemView, type SubscriptionView } from "./subscriptionView";

type State =
  | { kind: "loading" }
  | { kind: "loadError" }
  | { kind: "ready"; raw: { id: string; updatedAt: string }; view: SubscriptionView };

const LOAD_ERROR = "We couldn't load your subscription right now. Please try again in a moment.";
const STATUS_LABEL = { active: "Active", paused: "Paused", cancelled: "Cancelled" };

export function SubscriptionCard() {
  const headingId = useId();
  const [state, setState] = useState<State>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let ignore = false; // StrictMode and retries: only the latest request may set state
    getSubscription()
      .then((sub) => {
        const view = toView(sub); // throws on invalid data, which lands in loadError
        if (!ignore) setState({ kind: "ready", raw: { id: sub.id, updatedAt: sub.updatedAt }, view });
      })
      .catch(() => {
        if (!ignore) setState({ kind: "loadError" });
      });
    return () => {
      ignore = true;
    };
  }, [attempt]);

  const retry = () => {
    setState({ kind: "loading" });
    setAttempt((n) => n + 1);
  };

  const view = state.kind === "ready" ? state.view : null;

  return (
    <main className={styles.page}>
      <section
        aria-labelledby={headingId}
        aria-busy={state.kind === "loading"}
        className={`${styles.card} ${view && view.status !== "active" ? styles.inactive : ""}`}
      >
        <div className={styles.header}>
          <h2 id={headingId} tabIndex={-1} className={styles.heading}>
            Manage my subscription
          </h2>
          {view && <span className={`${styles.pill} ${styles[view.status]}`}>{STATUS_LABEL[view.status]}</span>}
          {state.kind === "loading" && <span aria-hidden="true" className={`${styles.pill} ${styles.pillBar}`} />}
        </div>

        <div role="alert" className={styles.alert}>
          {state.kind === "loadError" ? LOAD_ERROR : ""}
        </div>
        <div role="status" className={styles.srOnly}>
          {state.kind === "loading" ? "Loading your subscription…" : ""}
        </div>

        {state.kind === "loading" && <Skeleton />}
        {state.kind === "loadError" && (
          <div className={styles.body}>
            <button type="button" className={`${styles.button} ${styles.primary}`} onClick={retry}>
              Try again
            </button>
          </div>
        )}
        {view && <Details view={view} />}
      </section>
    </main>
  );
}

function Details({ view }: { view: SubscriptionView }) {
  return (
    <div className={styles.body}>
      {view.status === "active" && (
        <div>
          <p className={styles.label}>Next charge</p>
          <p className={styles.date}>{formatShortDate(view.nextChargeAt)}</p>
          <p className={styles.amount}>
            You'll be charged <strong>{formatMoney(view.totalCents)}</strong>
          </p>
          <p className={styles.meta}>
            Every {view.intervalDays} days with your {view.discountPercent}% discount
          </p>
        </div>
      )}
      {view.status === "paused" && view.pausedUntil && (
        <p className={styles.date}>Paused until {formatShortDate(view.pausedUntil)}</p>
      )}
      {view.status === "cancelled" && view.cancelledAt && (
        <p className={styles.date}>Cancelled on {formatShortDate(view.cancelledAt)}</p>
      )}

      <ul className={styles.items}>
        {view.items.map((item) => (
          <Item key={item.sku} item={item} />
        ))}
      </ul>

      {view.status === "active" && (
        <button type="button" className={`${styles.button} ${styles.secondary}`}>
          Skip next shipment
        </button>
      )}
    </div>
  );
}

function Item({ item }: { item: ItemView }) {
  return (
    <li className={styles.item}>
      {item.imageUrl ? (
        <img src={item.imageUrl} alt="" width={48} height={48} className={styles.thumb} />
      ) : (
        <span aria-hidden="true" className={`${styles.thumb} ${styles.placeholder}`}>
          {item.name.charAt(0)}
        </span>
      )}
      <span className={styles.itemText}>
        <span className={styles.itemName}>{item.name}</span>
        <span className={styles.qty}>Qty {item.quantity}</span>
      </span>
    </li>
  );
}

// Same classes as the active view, so every line box keeps its real height when data arrives.
function Skeleton() {
  const bar = (width: string) => <span className={styles.bar} style={{ width }} />;
  return (
    <div aria-hidden="true" className={`${styles.body} ${styles.skeleton}`}>
      <p className={styles.label}>{bar("30%")}</p>
      <p className={styles.date}>{bar("75%")}</p>
      <p className={styles.amount}>{bar("55%")}</p>
      <p className={styles.meta}>{bar("65%")}</p>
      <ul className={styles.items}>
        {["70%", "80%"].map((width) => (
          <li key={width} className={styles.item}>
            <span className={`${styles.thumb} ${styles.thumbBar}`} />
            <span className={styles.itemText} style={{ flex: 1 }}>
              <span className={styles.itemName}>{bar(width)}</span>
              <span className={styles.qty}>{bar("25%")}</span>
            </span>
          </li>
        ))}
      </ul>
      <div className={`${styles.button} ${styles.buttonBar}`} />
    </div>
  );
}
