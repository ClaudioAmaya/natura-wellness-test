# Natura Wellness frontend test

React + TypeScript + Vite. Part A is the "Manage my subscription" card, Part B is the pixel-matched buy box.

Live: https://natura-wellness-test.vercel.app/

## Run

```
npm install
npm run dev        # Vite dev server
npm test           # Vitest (vitest run)
npm run typecheck  # tsc --noEmit
npm run build      # tsc --noEmit && vite build
```

## URLs

| State | URL |
|---|---|
| Part A, active | `/?part=a&fixture=active` (also the default: `/`) |
| Part A, paused | `/?part=a&fixture=paused` |
| Part A, cancelled | `/?part=a&fixture=cancelled` |
| Part A, server error (500) | `/?part=a&fixture=error` |
| Part A, not found (404) | any other fixture value, e.g. `/?part=a&fixture=missing` |
| Part A, skip always conflicts (409) | `/?part=a&fixture=active&conflict=always` |
| Part A, skip never conflicts | `/?part=a&fixture=active&conflict=never` (default: random, about 1 in 3) |
| Part B | `/?part=b` |

## Decisions

Part A
- Inline confirmation panel instead of `window.confirm`. It states the new date and that the amount stays the same, and focus moves to its heading.
- No optimistic updates. The card only changes after the server answers.
- A 409, 400 or 404 on skip refetches the subscription, shows a notice and requires a new confirmation. There is no automatic retry.
- Paused and cancelled subscriptions show their status and date only, with no actions the API doesn't support.
- The total shown is the server's `nextChargeTotalCents`. I don't add up per-item prices, because the rounding differs (10188 vs 10187 cents).
- The double-submit guard is a `useRef`, so two clicks in the same tick send one request.
- Focus moves in a layout effect, so it never sits on `<body>` between a commit and the next frame.

Part B
- Total = the rounded unit price × quantity (3 × $25.46 = $76.38, not a rounded 3 × $29.95 × 0.85).
- The fine print is built from the selected frequency and total, and hidden for one-time purchases.
- The subscribe extras (frequency select, perks) are not rendered when one-time is selected, so they're not reachable by keyboard.
- The purchase options are a native radio group in a fieldset (arrow keys work out of the box).
- The layout stacks at 960px and below, centered with a max width of 540px.

## Deviations from the reference

| Element | Reference | Mine | Contrast |
|---|---|---|---|
| Eyebrow, reviews link, fine print | #6B7A70 | #65736A | 4.27 → 4.70:1 on #FBF8F3 |
| Struck price | #8A948E | #687069 | 2.87 → 4.69:1 on #F3F6F2 |
| Unselected radio ring | #9AA59E | #87918B | 2.55 → 3.25:1 on white (non-text, needs 3:1) |
| Stepper −/+ at a limit | full colour | glyph at 40% opacity | visible disabled cue |
| Whole page at 1200px, 2x | – | 1.69% of pixels differ (tolerance 24) | the contrast changes add about 0.01 points; the rest is font rendering and 0.5–1px offsets |

## Checked by hand

- Keyboard in a real browser, Parts A and B: Tab order, arrow keys on the radios, Enter and Space on the stepper.
- Real device: iPhone 16, Chrome.
- 200% browser zoom: Chrome, Parts A and B.

## Not tested

- A real screen reader. The live regions and focus announcements are covered by tests and the accessibility tree, but I never heard them.
- The slow-load message on screen. It is covered by tests only.

## Known limitations

- Part A's card grows 20px at 320px, because the cadence line wraps.
- The loading skeleton is shaped like an active card, so paused and cancelled cards shrink when data arrives.
- After a 400 the refreshed card is paused, but the notice still says "try again if you still want to skip".
- "2,316 reviews" links to a placeholder anchor (`#reviews`).
- Some screen-reader-only strings ("Purchase options", "Regular price", "Quantity", "out of 5", the stepper labels) and the image alt are not from `copy.ts`.

## Time

I went over the suggested hour. The extra time went into tests, accessibility and a measured visual comparison against the reference. 2 hours of focused work. For a one-hour version I would skip the pixel-diff tuning, the narrow-screen pass and most of the focus-management tests.

## How I used AI

I directed Claude Code step by step (read, plan, build, review) and approved every file write. It never committed or pushed; I did. Tests for the logic and behavior were written first and shown failing before the implementation. When I re-ran the suite myself I found a flaky focus test that the AI had reported as passing, which led to a real accessibility fix (focus restoration moved to a layout effect). The full conversation is at: ai-conversation/claude-code-session.txt.

## Where to look in the conversation

The conversation is long (about 7,500 lines). These are the moments that show how I directed and checked the work:

**Part A**
- [Taking charge and the first read-only pass](ai-conversation/claude-code-session.txt#L5-L60)
- [Part A plan, approved after three revisions](ai-conversation/claude-code-session.txt#L423)
- [Tests first: a stub that throws and 12 failing tests](ai-conversation/claude-code-session.txt#L850-L966)
- [A flaky test I found myself, the root cause, and the fix](ai-conversation/claude-code-session.txt#L3630-L3800) (result: 0 failures in 20 runs, [line 4046](ai-conversation/claude-code-session.txt#L4046))
- [Strict review of Part A, and my call on a conflicting instruction](ai-conversation/claude-code-session.txt#L4199-L4280)

**Part B**
- [Part B decisions: collapsed extras and five contrast fixes](ai-conversation/claude-code-session.txt#L4994-L5002)
- [Part B plan, approved before building](ai-conversation/claude-code-session.txt#L5068-L5071)
- [Comparison with the reference: 3.98% down to 1.72% of pixels different](ai-conversation/claude-code-session.txt#L6003-L6010)
- [Reverting a worse tuning round and choosing the title weight with measurements](ai-conversation/claude-code-session.txt#L6220-L6405)
- [A mistake by the AI (a blank capture), admitted and fixed](ai-conversation/claude-code-session.txt#L6996-L7007)