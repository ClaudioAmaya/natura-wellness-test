import { useEffect, useId, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { getSubscription, skipNextShipment } from "../api/mockApi";
import { ApiError, type Subscription } from "../api/types";
import styles from "./SubscriptionCard.module.css";
import { formatDate, formatMoney, formatShortDate, toView, type ItemView, type SubscriptionView } from "./subscriptionView";

type Notice = null | "success" | "conflict" | "skipError";
type Ready = {
  kind: "ready";
  raw: { id: string; updatedAt: string };
  view: SubscriptionView;
  phase: "idle" | "confirming" | "submitting";
  slow: boolean;
  notice: Notice;
};
type State = { kind: "loading"; slow: boolean } | { kind: "loadError" } | Ready;
type FocusTarget = "skip" | "panel" | "reload";

const LOAD_ERROR = "We couldn't load your subscription right now. Please try again in a moment.";
const CONFLICT =
  "Your subscription was updated elsewhere. We've refreshed it. Please check the details and try again if you still want to skip.";
const SKIP_ERROR = "We couldn't skip your shipment, and nothing has changed. Please try again.";
const SLOW =
  "This is taking longer than usual. Keep this page open: the result will appear here, so there's no need to tap again.";
// A 400 or 404 on skip also means the subscription changed since it was loaded: handle it like a 409.
const CHANGED_ELSEWHERE = [400, 404, 409];
const SLOW_AFTER_MS = 4000;
const STATUS_LABEL = { active: "Active", paused: "Paused", cancelled: "Cancelled" };

// Invalid data from the server lands in loadError, whichever call returned it.
function ready(sub: Subscription, notice: Notice): State {
  try {
    const view = toView(sub);
    return { kind: "ready", raw: { id: sub.id, updatedAt: sub.updatedAt }, view, phase: "idle", slow: false, notice };
  } catch {
    return { kind: "loadError" };
  }
}

export function SubscriptionCard() {
  const headingId = useId();
  const [state, setState] = useState<State>({ kind: "loading", slow: false });
  const [attempt, setAttempt] = useState(0);
  // Set after mount, so "Loading…" is a change to the live region rather than initial content.
  const [announceLoading, setAnnounceLoading] = useState(false);

  const inFlight = useRef(false); // double-submit guard: set synchronously, before any re-render
  const slowTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const focusNext = useRef<FocusTarget | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const skipRef = useRef<HTMLButtonElement>(null);
  const panelHeadingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => setAnnounceLoading(true), []);

  useEffect(() => {
    let ignore = false; // StrictMode and retries: only the latest request may set state
    const slow = setTimeout(() => setState((s) => (s.kind === "loading" ? { ...s, slow: true } : s)), SLOW_AFTER_MS);
    getSubscription()
      .then((sub) => !ignore && setState(ready(sub, null)))
      .catch(() => !ignore && setState({ kind: "loadError" }))
      .finally(() => clearTimeout(slow));
    return () => {
      ignore = true;
      clearTimeout(slow);
    };
  }, [attempt]);

  // Move focus after the render that shows the target; Skip falls back to the card heading.
  // Layout effect: runs inside the commit, so focus never sits on <body> for a task or a frame.
  useLayoutEffect(() => {
    const next = focusNext.current;
    if (!next) return;
    if (next === "reload") {
      // Try again unmounts itself: hold focus on the heading while loading, then move to the result,
      // unless the customer has already moved focus somewhere else.
      const lost = document.activeElement === document.body || document.activeElement === headingRef.current;
      if (state.kind === "loading") {
        if (lost) headingRef.current?.focus();
        return;
      }
      focusNext.current = null;
      if (lost) (skipRef.current ?? headingRef.current)?.focus();
      return;
    }
    const target = next === "panel" ? panelHeadingRef.current : (skipRef.current ?? headingRef.current);
    focusNext.current = null;
    target?.focus();
  });

  useEffect(() => () => clearTimeout(slowTimer.current), []);

  const updateReady = (patch: Partial<Ready>) => setState((s) => (s.kind === "ready" ? { ...s, ...patch } : s));

  const retry = () => {
    focusNext.current = "reload";
    setState({ kind: "loading", slow: false });
    setAttempt((n) => n + 1);
  };

  const openPanel = () => {
    focusNext.current = "panel";
    updateReady({ phase: "confirming", notice: null });
  };

  const keep = () => {
    if (inFlight.current) return;
    focusNext.current = "skip";
    updateReady({ phase: "idle" });
  };

  const confirmSkip = async () => {
    if (inFlight.current || state.kind !== "ready") return;
    inFlight.current = true;
    const { raw } = state;
    updateReady({ phase: "submitting" });
    // Covers the whole submitting phase, including the refetch after a 409.
    slowTimer.current = setTimeout(() => updateReady({ slow: true }), SLOW_AFTER_MS);

    let next: State | null = null; // null: keep the current data and show the skip error
    try {
      next = ready(await skipNextShipment({ subscriptionId: raw.id, expectedUpdatedAt: raw.updatedAt }), "success");
    } catch (error) {
      if (error instanceof ApiError && CHANGED_ELSEWHERE.includes(error.status)) {
        // Changed elsewhere: show the fresh data and let the customer decide again. No automatic retry.
        next = await getSubscription().then(
          (fresh) => ready(fresh, "conflict"),
          (): State => ({ kind: "loadError" }),
        );
      }
    }

    clearTimeout(slowTimer.current);
    inFlight.current = false;
    focusNext.current = "skip";
    if (next) setState(next);
    else updateReady({ phase: "idle", slow: false, notice: "skipError" });
  };

  const view = state.kind === "ready" ? state.view : null;
  const { alert, status } = notices(state, announceLoading);

  return (
    <main className={styles.page}>
      <section
        aria-labelledby={headingId}
        className={`${styles.card} ${view && view.status !== "active" ? styles.inactive : ""}`}
      >
        <div className={styles.header}>
          <h2 id={headingId} ref={headingRef} tabIndex={-1} className={styles.heading}>
            Manage my subscription
          </h2>
          {view && <span className={`${styles.pill} ${styles[view.status]}`}>{STATUS_LABEL[view.status]}</span>}
          {state.kind === "loading" && <span aria-hidden="true" className={`${styles.pill} ${styles.pillBar}`} />}
        </div>

        {state.kind === "loading" && <Skeleton />}
        {state.kind === "ready" && <Details view={state.view} />}

        {/* Always mounted, in the same place: below the items, right above where the customer acts. */}
        <LiveRegion role="alert" {...alert} />
        <LiveRegion role="status" {...status} />

        {state.kind === "loadError" && (
          <button type="button" className={`${styles.button} ${styles.primary}`} onClick={retry}>
            Try again
          </button>
        )}
        {state.kind === "ready" &&
          state.view.status === "active" &&
          (state.phase === "idle" ? (
            <button ref={skipRef} type="button" className={`${styles.button} ${styles.secondary}`} onClick={openPanel}>
              Skip next shipment
            </button>
          ) : (
            <SkipPanel
              view={state.view}
              submitting={state.phase === "submitting"}
              headingRef={panelHeadingRef}
              onConfirm={confirmSkip}
              onKeep={keep}
            />
          ))}
      </section>
    </main>
  );
}

type Tone = "plain" | "success" | "warning" | "hidden";
type RegionContent = { text: string; tone: Tone };

function notices(state: State, announceLoading: boolean): { alert: RegionContent; status: RegionContent } {
  const none: RegionContent = { text: "", tone: "plain" };
  if (state.kind === "loading") {
    if (state.slow) return { alert: none, status: { text: SLOW, tone: "plain" } };
    // For screen readers only; the skeleton shows loading visually.
    return { alert: none, status: { text: announceLoading ? "Loading your subscription…" : "", tone: "hidden" } };
  }
  if (state.kind === "loadError") return { alert: { text: LOAD_ERROR, tone: "plain" }, status: none };

  const alert: RegionContent =
    state.notice === "conflict" ? { text: CONFLICT, tone: "warning" }
    : state.notice === "skipError" ? { text: SKIP_ERROR, tone: "warning" }
    : none;
  if (state.phase === "submitting") return { alert, status: state.slow ? { text: SLOW, tone: "plain" } : none };
  if (state.notice === "success" && state.view.status === "active") {
    const { nextChargeAt, totalCents } = state.view;
    const text = `Done. Your next charge is now ${formatDate(nextChargeAt)}. The amount stays ${formatMoney(totalCents)}.`;
    return { alert, status: { text, tone: "success" } };
  }
  return { alert, status: none };
}

// The region element itself never unmounts; only its content and styling change.
function LiveRegion({ role, text, tone }: RegionContent & { role: "alert" | "status" }) {
  const className = tone === "hidden" ? styles.srOnly : text ? `${styles.notice} ${styles[tone]}` : undefined;
  return (
    <div role={role} className={className}>
      {text && (tone === "success" || tone === "warning") && <NoticeIcon tone={tone} />}
      {text}
    </div>
  );
}

// The icon carries the meaning too, so the notices don't rely on colour alone.
function NoticeIcon({ tone }: { tone: "success" | "warning" }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" width="20" height="20" className={styles.noticeIcon}>
      <circle cx="10" cy="10" r="8.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
      {tone === "success" ? (
        <path d="M6.5 10.25l2.25 2.25 4.75-5" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <>
          <path d="M10 5.75v5.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
          <circle cx="10" cy="14" r="1.1" fill="currentColor" />
        </>
      )}
    </svg>
  );
}

type Active = Extract<SubscriptionView, { status: "active" }>;

function SkipPanel(props: {
  view: Active;
  submitting: boolean;
  headingRef: RefObject<HTMLHeadingElement | null>;
  onConfirm: () => void;
  onKeep: () => void;
}) {
  const { view, submitting, headingRef, onConfirm, onKeep } = props;
  const headingId = useId();
  return (
    // Heading and consequence come first, where the Skip button was, so a double tap lands on text.
    <div role="group" aria-labelledby={headingId} className={styles.panel}>
      <h3 id={headingId} ref={headingRef} tabIndex={-1} className={styles.panelHeading}>
        Skip the {formatDate(view.nextChargeAt)} shipment?
      </h3>
      <p className={styles.panelText}>
        Your next shipment and charge move to {formatDate(view.skipTo)}. The amount stays {formatMoney(view.totalCents)}.
      </p>
      <div className={styles.actions}>
        {/* aria-disabled, not disabled, so focus stays on the button while the request runs. */}
        <button type="button" aria-disabled={submitting} className={`${styles.button} ${styles.primary}`} onClick={onConfirm}>
          {submitting ? "Skipping…" : "Yes, skip it"}
        </button>
        <button type="button" aria-disabled={submitting} className={`${styles.button} ${styles.secondary}`} onClick={onKeep}>
          Keep my shipment
        </button>
      </div>
    </div>
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
