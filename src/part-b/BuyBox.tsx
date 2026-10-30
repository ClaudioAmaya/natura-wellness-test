// Part B: rebuild public/reference/buy-box.png here.
// Fonts (Fraunces, Inter) are already loaded in index.html. The product photo is /product.jpg.
import { useId, useState } from "react";
import { formatMoney } from "../part-a/subscriptionView";
import styles from "./BuyBox.module.css";
import { copy } from "./copy";
import { clampQuantity, finePrint, MAX_QUANTITY, MIN_QUANTITY, totalCents, type Purchase } from "./pricing";

export function BuyBox() {
  const titleId = useId();
  const frequencyId = useId();
  const [purchase, setPurchase] = useState<Purchase>("subscribe");
  const [frequency, setFrequency] = useState(copy.subscribe.frequencyOptions[0]);
  const [quantity, setQuantity] = useState(MIN_QUANTITY);

  const subscribe = purchase === "subscribe";
  const fine = finePrint(purchase, frequency, quantity);
  const atMin = quantity <= MIN_QUANTITY;
  const atMax = quantity >= MAX_QUANTITY;

  return (
    <div className={styles.page}>
      <div className={styles.imageCard}>
        <img src="/product.jpg" alt={copy.title} className={styles.photo} />
      </div>

      <section aria-labelledby={titleId} className={styles.details}>
        <p className={styles.eyebrow}>{copy.eyebrow}</p>
        <div className={styles.rating}>
          <span aria-hidden="true" className={styles.stars}>
            {[0, 1, 2, 3, 4].map((i) => (
              <Star key={i} />
            ))}
          </span>
          <span className={styles.ratingValue}>{copy.rating}</span>
          {/* ponytail: no reviews section exists yet; the anchor is a placeholder target. */}
          <a href="#reviews" className={styles.reviews}>
            {copy.reviewCount}
          </a>
        </div>
        <h1 id={titleId} className={styles.title}>
          {copy.title}
        </h1>
        <p className={styles.subtitle}>{copy.subtitle}</p>
        <hr className={styles.divider} />

        <fieldset className={styles.options}>
          <legend className={styles.srOnly}>Purchase options</legend>

          <div className={`${styles.option} ${!subscribe ? styles.selected : ""}`}>
            <label className={styles.optionRow}>
              <input
                type="radio"
                name="purchase"
                value="oneTime"
                checked={!subscribe}
                onChange={() => setPurchase("oneTime")}
                className={styles.radioInput}
              />
              <span aria-hidden="true" className={styles.radio} />
              <span className={styles.optionLabel}>{copy.oneTime.label}</span>
              <span className={styles.prices}>
                <span className={styles.price}>{formatMoney(copy.oneTime.priceCents)}</span>
              </span>
            </label>
          </div>

          <div className={`${styles.option} ${subscribe ? styles.selected : ""}`}>
            <label className={styles.optionRow}>
              <input
                type="radio"
                name="purchase"
                value="subscribe"
                checked={subscribe}
                onChange={() => setPurchase("subscribe")}
                className={styles.radioInput}
              />
              <span aria-hidden="true" className={styles.radio} />
              <span className={styles.optionLabel}>{copy.subscribe.label}</span>
              <span className={styles.badge}>{copy.subscribe.badge}</span>
              <span className={styles.prices}>
                <span className={styles.price}>{formatMoney(copy.subscribe.priceCents)}</span>
                <s className={styles.compare}>
                  <span className={styles.srOnly}>Regular price </span>
                  {formatMoney(copy.subscribe.comparePriceCents)}
                </s>
              </span>
            </label>

            {/* Outside the label (no controls nested in a label); not rendered at all for one-time. */}
            {subscribe && (
              <div className={styles.extras}>
                <div className={styles.frequency}>
                  <label htmlFor={frequencyId}>{copy.subscribe.frequencyLabel}</label>
                  <span className={styles.selectWrap}>
                    <select id={frequencyId} value={frequency} onChange={(e) => setFrequency(e.target.value)}>
                      {copy.subscribe.frequencyOptions.map((option) => (
                        <option key={option}>{option}</option>
                      ))}
                    </select>
                    <Chevron />
                  </span>
                </div>
                <ul className={styles.perks}>
                  {copy.subscribe.perks.map((perk) => (
                    <li key={perk}>
                      <Check />
                      {perk}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </fieldset>

        <div className={styles.purchaseRow}>
          <div role="group" aria-label="Quantity" className={styles.stepper}>
            {/* aria-disabled, not disabled, so focus stays put when a limit is reached. */}
            <button
              type="button"
              aria-label="Decrease quantity"
              aria-disabled={atMin}
              onClick={() => !atMin && setQuantity((q) => clampQuantity(q - 1))}
            >
              <Minus />
            </button>
            {/* <output> is an implicit live region: it is the only quantity announcement. */}
            <output className={styles.quantity}>{quantity}</output>
            <button
              type="button"
              aria-label="Increase quantity"
              aria-disabled={atMax}
              onClick={() => !atMax && setQuantity((q) => clampQuantity(q + 1))}
            >
              <Plus />
            </button>
          </div>
          {/* Adding to the cart doesn't need to do anything (brief). */}
          <button type="button" className={styles.addToCart}>
            {copy.addToCart}{" "}
            <span aria-hidden="true" className={styles.dot}>
              ·
            </span>{" "}
            {formatMoney(totalCents(purchase, quantity))}
          </button>
        </div>

        <ul className={styles.trust}>
          {copy.trust.map((item) => (
            <li key={item}>
              <CheckCircle />
              {item}
            </li>
          ))}
        </ul>

        {fine && <p className={styles.finePrint}>{fine}</p>}
      </section>
    </div>
  );
}

// Inline icons: decorative, sized and coloured by CSS (currentColor).
function Star() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16">
      <path
        fill="currentColor"
        d="M8 1.1l2.03 4.3 4.7.6-3.44 3.25.86 4.66L8 11.63 3.85 13.91l.86-4.66L1.27 6l4.7-.6z"
      />
    </svg>
  );
}

function Check() {
  return (
    <svg aria-hidden="true" viewBox="0 0 12 12" width="14" height="14" className={styles.icon}>
      <path d="M1.75 6.25l2.75 2.75 5.75-6.25" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CheckCircle() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" width="14" height="14" className={styles.icon}>
      <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M5 8.25l2 2 4-4.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Chevron() {
  return (
    <svg aria-hidden="true" viewBox="0 0 12 12" width="13" height="13" className={styles.chevron}>
      <path d="M2.5 4.5L6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Minus() {
  return (
    <svg aria-hidden="true" viewBox="0 0 14 14" width="11" height="11">
      <path d="M2 7h10" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

function Plus() {
  return (
    <svg aria-hidden="true" viewBox="0 0 14 14" width="11" height="11">
      <path d="M2 7h10M7 2v10" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}
