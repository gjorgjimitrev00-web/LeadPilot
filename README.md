# Client Contact Finder

A SaaS-style browser app for finding potential business clients by category and location.

It uses public OpenStreetMap/Nominatim/Overpass data to extract:

- business name
- category tags
- email
- phone
- whether a website is listed
- address
- distance
- source record

When `Save this search` is enabled in the dashboard, the server stores per-user search progress in Supabase. Searching the same category, city, and radius again skips leads that were already shown and returns the next available batch. When the saved list is exhausted, the next run starts a fresh cycle.

## Export for Quo

Use the CSV format selector before exporting:

- `Lead list` keeps the research spreadsheet format.
- `Quo contacts` creates a Quo-friendly import file with `First Name`, `Last Name`, `Company`, `Title`, `Phone`, `Email`, `Website`, `Location`, and extra mappable lead fields.

Set the country code field before exporting if your results use local phone numbers. Quo recommends phone numbers with country codes and CSV uploads with headings. The app limits Quo export rows to 3,000 to match Quo's recommended upload size.

## Run

Start the SaaS server from this folder:

```bash
npm start
```

For checks:

```bash
npm test
npm run check
```

Open:

```text
http://localhost:4173
```

Pages:

- Landing page: `http://localhost:4173/`
- Login/sign-up: `http://localhost:4173/auth.html`
- Dashboard app: `http://localhost:4173/app.html`

Do not use the old `file://` page for the SaaS version. Accounts, subscriptions, billing, and search quota enforcement all run through the Node server.

## Supabase setup

1. Create a Supabase project.
2. Open the SQL editor and run [supabase-schema.sql](./supabase-schema.sql).
3. Copy `.env.example` to `.env`.
4. Fill in:

```text
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

The server uses Supabase Auth for account creation and login. It stores account profile, usage, saved search progress, Stripe customer ID, Stripe subscription ID, plan, and subscription status in Supabase tables. Keep the service role key server-only.

## Stripe setup

1. Create recurring Stripe Products and Prices for Starter, Growth, and Agency.
2. Copy `.env.example` to `.env`.
3. Fill in `STRIPE_SECRET_KEY`, `STRIPE_PRICE_STARTER`, `STRIPE_PRICE_GROWTH`, and `STRIPE_PRICE_AGENCY`.
4. Configure the Stripe Billing Portal in the Stripe Dashboard.
5. During local testing, forward webhooks:

```bash
stripe listen --forward-to localhost:4173/api/stripe/webhook
```

6. Put the printed `whsec_...` value into `STRIPE_WEBHOOK_SECRET`.

The app handles `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, and `customer.subscription.deleted`.

## Notes

The app reports whether a website is listed in the public source data. Missing contact fields can mean the data is incomplete, so verify leads before outreach.

Large radius values and high limits are supported, but public map APIs can slow down or time out on very broad searches. Narrow the category or location if a large search returns too slowly.

Search is progressive: the app checks smaller radius bands first, then expands toward the selected radius and only uses broader keyword fallbacks when needed. Results are deduped before trimming to the selected limit and ranked so leads with phone, email, website, and address details appear first.
