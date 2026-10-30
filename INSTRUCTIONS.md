# Skills test: two small builds (about 1 hour)

Natura Wellness is a fictional online supplement brand made up for this test (any real company with a similar name is unrelated). Customers buy once or subscribe and save 15%, with a refill every 30 days. This test has two builds: one from business requirements with no design, and one from a finished design you match as closely as you can.

Use any tools or AI you like. Use React with TypeScript; the starter is already set up.

We expect you to use AI, and we'll ask for a link to the conversation. We want to see how you directed it and checked its work, not just what it produced.

This folder is a Vite + React + TypeScript starter. Run `npm install && npm run dev`.

## Part A: build from requirements (about 30 minutes)

Build the "Manage my subscription" card in `src/part-a/SubscriptionCard.tsx`, using the mock API in `src/api/`. There's no design; the design decisions are yours.

Our customer service team gave us these requirements:

- Customers should see at a glance what's coming next: which products, when they'll be charged, and how much.
- Customers should be able to skip their next shipment without contacting us. Skipping moves the next charge to the following cycle.
- Accidental skips create support tickets, so make sure the customer means it.
- Paused and cancelled subscriptions shouldn't look like active ones, and they shouldn't offer a skip.
- Most customers open this on their phone (375px wide), so it must work well there first.
- The API is sometimes slow and sometimes rejects a skip because the subscription changed elsewhere. The customer should always know what happened and what to do next.

Switch between test cases with the URL: `?fixture=active`, `?fixture=paused`, `?fixture=cancelled`, `?fixture=error`. Add `&conflict=always` to force the "subscription changed" error.

## Part B: match the design (about 30 minutes)

Rebuild the product purchase box shown in `public/reference/buy-box.png` in `src/part-b/BuyBox.tsx`, as close to pixel-perfect as you can. The image is a 2x screenshot of a 1200px-wide browser window. The product photo, fonts, and copy (`src/part-b/copy.ts`) are provided; match spacing, sizes, and colors from the image. Selecting a purchase option and changing the quantity should work; adding to the cart doesn't need to do anything.

## To submit

A public GitHub repo and a live link.

The easiest free way to get a live link: sign in to Vercel (vercel.com) with GitHub, click Add New → Project, pick your repo, and click Deploy. No settings to change. If you can't deploy, use `https://stackblitz.com/github/<your-username>/<your-repo>` as your live link instead.

In the application form you'll give:

1. A link to your GitHub repo
2. Your live link (your Vercel URL, or the StackBlitz link above)
3. A link to your AI conversation(s): a share link from ChatGPT, Claude, Gemini, etc. If you worked in an editor like Cursor or Copilot, export the chat into your repo and give the file path. If you didn't use AI, write "none".
