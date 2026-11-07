# Coupon Operations for Claude Code

This is a trusted operator's local discount coupon desk. All demo records are synthetic. Read current records through the CLI before answering.

## Rules

Use npm run coupons -- help for arguments. Every handler supports --json and --name=value flags. Resolve ambiguity with the candidate list, never a guess.

Use a fresh DATA_DIR for a real business or an operator-controlled DATABASE_URL. Never seed a working database. Do not read, print or commit credentials. Actor labels are audit context, not authentication. PostgreSQL is for shared use; embedded PGlite is for a single local process.

No command sends codes, changes checkout, issues stored value or processes refunds. Drafts stay private in drafts/. Use opaque customer references. Preserve and protect original imports; they can contain personal data. JSON exports are archives; database backups and restore testing are separate.

Read docs/replace-voucherify.md before imports. Test first, reconcile counts, then explicitly review every imported restriction. Unsupported rules stay held until implemented and tested. Imported baseline counts cover codes only; budget and customer limits are local after cutover. Do not imply continuity for unimported history. Do not run codes concurrently in unconnected systems.

A passing compliance command is a record check, not a legal approval. Evidence must come from the operator. No invented reviews, price histories, terms or customer actions. Read docs/compliance.md.

Any field or rule change goes through a new migration and meaningful tests. Retain history. Add no parallel command library. Reports are read-only; /new-view uses the existing renderer.

## Routes

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

## Files

scripts/coupons.mjs is the one domain CLI. supabase/migrations and supabase/seed.sql hold the schema and synthetic demo. brand.json, views.json and documents.json drive the shared renderers. npm test uses disposable storage and ignores normal database credentials.

Omni by Enterprise DNA can customise, install and run this: https://enterprisedna.co/omni/book/?offer=replace-software&utm_medium=repo
