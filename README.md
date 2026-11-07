# Coupon Operations for Claude Code

Own your discount codes, eligibility checks and offer reviews in one database. Review expiring offers, record local coupon use and reverse a cancellation without losing its history.

## Three ways to own it

- **Do it yourself:** use the free MIT-licensed base with Claude Code, Codex, OpenCode or Cursor. Hosting and agent subscriptions are separate.
- **We customise it:** Enterprise DNA maps your Voucherify records, adds your exclusions and connects your checkout. Your version can include a web front end or a different stack. One setup fee, then a retainer for ongoing work.
- **We run it for you:** Omni by Enterprise DNA installs the system, manages backups and access, and maintains your connections and weekly reviews. One setup fee, then a retainer.

[Book a 30-minute call with Sam](https://enterprisedna.co/omni/book/?offer=replace-software&utm_source=github&utm_medium=readme&utm_campaign=voucherify).

## Try it

Node 20 or newer. No cloud account or payment system is needed.

```sh
npm install
npm test
npm run demo
npm run coupons -- attention
npm run coupons -- budget
npm run coupons -- quote RETURN10 --order-cents=10000 --currency=NZD --customer=demo-check
npm run view
npm run docs
```

Everything in the demo is synthetic. It includes an overdue offer review, an unreviewed code, an expired offer and a campaign with no recent activity. Seeding is idempotent and preserves existing edits. For real work, use a fresh DATA_DIR with npm run migrate. DATABASE_URL selects PostgreSQL; otherwise the database is embedded PGlite in .data/db.

## What works

The single CLI holds campaigns, discount coupons, source imports, redemptions, reversals and activity. Percentage values use basis points: 1000 means 10%. Fixed amounts, caps, minimum orders and budgets use minor currency units: 500 means 5.00. NZD, AUD, USD, EUR and GBP are supported. No foreign-exchange conversions occur. Percentage discounts round down to the nearest minor unit and are capped by the code and order value.

A quote checks current review evidence, campaign state, code activity, start and expiry, currency, minimum order, lifetime code count, local customer count and local campaign budget. A redemption reruns those checks inside a transaction. Campaign row locks serialize budget and customer-limit decisions on PostgreSQL. A repeated order reference with identical details returns the original decision; changed details fail. A reversal restores local capacity once and retains both records. A reversed order reference cannot be reused for a new redemption.

Imported codes stay unreviewed and campaigns stay DRAFT. The original file and all its fields are kept. Review-coupon requires explicit local values and a review note; set-policy records disclosed terms and price evidence. Both put the campaign back in DRAFT. Activate refuses incomplete or overdue reviews. Human review must establish whether imported restrictions fit the supported rules; text presence alone cannot establish that.

This is a local coupon desk, not the whole hosted Voucherify service. It does not send codes, alter a live checkout, process payments, issue stored-value cards, manage loyalty points or reproduce every vendor validation rule. Checkout connections, product exclusions and customer-facing screens are custom work. The import's prior-use baseline covers each code only; customer limits and financial budgets cover local use after cutover. See the switching guide before carrying over lifetime restrictions. Do not use the same codes in two unconnected systems.

## Import the documented export

```sh
npm run coupons -- import voucherify --file=imports/vouchers.csv --currency=NZD --amount-unit=minor --actor=operator --dry-run
npm run coupons -- import voucherify --file=imports/vouchers.csv --currency=NZD --amount-unit=minor --actor=operator
npm run coupons -- export --out=exports/coupons-snapshot.json
```

Read [the switching guide](docs/replace-voucherify.md) for the required CSV fields and reconciliation. The four default vendor columns are not enough. An identical file is a no-op; a malformed row, duplicate code or unsupported voucher type rejects the entire file. Existing campaigns are never merged silently. Currency and amount units must be checked by the operator.

## Ten questions for your records

1. Which offers need a decision before the weekend? (`attention`)
2. Which offers lack disclosed terms or price evidence? (`compliance`)
3. Which codes expire within a week or have already expired? (`expiry`)
4. What discount and payable amount does this order qualify for? (`quote`)
5. Which rule stops this customer using a code again? (`quote`)
6. Which campaign is closest to its local discount budget? (`budget`)
7. Which active campaign has no local redemption in two weeks? (`quiet`)
8. Which recorded orders were reversed? (`redemptions`)
9. What was the exact policy when an order used a code? (`export`, policy_snapshot)
10. Who changed an offer and what did they record? (`activity`)

These questions all run today. We do not claim the incumbent cannot answer them. The owner's own terms, price evidence and correction history make the analysis useful.

## Your first hour: ten things to ask for

1. Put our name, logo and colours in brand.json.
2. Explain the synthetic overdue offer.
3. Show the codes that expire this week.
4. Try an eligible order and an order below the minimum.
5. Create our campaign in a fresh database.
6. Test an export without saving it.
7. Reconcile its dates, discounts and baseline counts.
8. Review our supported rules and the terms people will see.
9. Draft our offer brief and weekly review.
10. Add our own evidence field with a tested migration.

## Recurring jobs

The commands below live in .claude/commands. Every CLI command supports --json. Use --name=value flags; names match case-insensitively or by a unique id prefix. Ambiguity returns candidates and exits with status 1. Use help for the full argument list.

- /campaigns: Read campaigns
- /coupons: Read coupons
- /redemptions: Read redemptions
- /reversals: Read reversals
- /activity: Read activity
- /imports: Read imports
- /attention: Read attention
- /compliance: Read compliance
- /expiry: Read expiry
- /budget: Read budget
- /quiet: Read quiet
- /campaign: <name-or-id> Full campaign policy, coupons and budget
- /add-campaign: --name=name --currency=NZD --actor=name
- /set-policy: <campaign> --owner=name --terms=text --evidence=text --review-due=YYYY-MM-DD --min-cents=0 --budget-cents=100000 --customer-limit=1 --actor=name (returns to DRAFT)
- /add-coupon: --campaign=name --code=CODE --kind=PERCENT|AMOUNT --value=1000 --cap-cents=2000 --starts=ISO --expires=ISO --limit=100 --actor=name (unreviewed)
- /review-coupon: <coupon> --kind=PERCENT|AMOUNT --value=1000 --cap-cents=2000 --starts=ISO --expires=ISO --limit=100 --active=true|false --note=text --actor=name (returns campaign to DRAFT)
- /activate: <campaign> --actor=name (requires complete current reviews)
- /pause: <campaign> --reason=text --actor=name
- /quote: <coupon> --order-cents=10000 --currency=NZD --customer=opaque-id (read-only)
- /redeem: <coupon> --order-cents=10000 --currency=NZD --customer=opaque-id --order=unique-order --actor=name (local ledger only)
- /reverse: <redemption-id-or-order> --reason=text --actor=name (local ledger only)
- /import: voucherify --file=export.csv --currency=NZD --actor=name [--amount-unit=minor|major] [--dry-run]
- /export: --out=new-file.json (all records and original imports)
- /weekly-review: Write private review from attention, budget and compliance
- /draft-offer: <campaign> Write private offer terms and evidence brief
- /help: Every command supports --json; flags use --name=value
- /customise: add fields or rules with a migration and tests.
- /new-view: add a branded read-only report.

26 CLI commands and 28 slash commands.

## Reports and records

npm run view writes three read-only HTML reports: week, expiry and compliance. npm run docs renders offer briefs and redemption statements per campaign. Edit brand.json for the business identity. /new-view adds another report, and /customise writes a migration and updates the CLI and tests. Weekly reviews and offer drafts stay in drafts; nothing sends.

The CLI is for a trusted operator. Actor names are not authentication. Tables enable row-level security and revoke PUBLIC access, but a database owner can bypass protections. Deployment permissions, backup schedules, retention and access controls need a tested design. Imports, redemptions, reversals and activity are append-only through database triggers. Export uses a consistent snapshot and refuses to overwrite files. Keep database-native backups; automatic JSON restore is not provided. Protect generated HTML and source exports as business records.

## Verification

npm test uses temporary storage and exercises every CLI handler, seed and migration idempotency, real command-line output, invalid imports, held rules, currency and expiry failures, minimum orders, use limits, budget limits, repeat requests, reversals, history protection and HTML escaping. The workflow runs Node 20 and 22 on Ubuntu and Windows, plus PostgreSQL 16 against an empty disposable database. A workflow definition is not proof of a successful run; inspect its actual result.

Read [compliance scope](docs/compliance.md), [why no front end](docs/why-no-front-end.md) and [source notes](docs/research.md).

## Licence

MIT. Copyright 2026 Enterprise DNA. Voucherify belongs to its owner. This independent project uses no vendor code or brand assets.
