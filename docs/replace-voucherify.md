# Move discount coupon records from Voucherify

This importer accepts Voucherify's documented voucher CSV export for AMOUNT and PERCENT discount vouchers. It does not import gift cards, loyalty balances, payments or referral programmes. Read the [vendor export reference](https://docs.voucherify.io/api-reference/exports/create-export), checked 7 November 2026.

## Export once, import once

In Voucherify, export the voucher records for each complete campaign. With the Export API, select exported_object `voucher` and request these fields in parameters.fields:

```json
["code","voucher_type","value","discount_type","campaign","start_date","expiration_date","redemption_quantity","redemption_count","active","discount_amount_limit","validation_rules_id","validity_timeframe_interval","validity_timeframe_duration","validity_day_of_week","customer_id","customer_source_id","additional_info","metadata"]
```

The vendor documents that selected fields become CSV headers and timestamps use UTC. Download the completed export using its normal export flow. Keep your original privately. The basic four-column default export is insufficient: the importer rejects missing dates, limits, activity state or campaign names. Export finite limits and explicit validity dates. Unlimited or undated vouchers need a deliberately agreed local policy before migration; the importer never invents one.

Use a new database with migrations applied, not the seeded demo. Place the CSV in the ignored imports directory. A synthetic fixture with the vendor's column names lives in fixtures/voucherify-vouchers.csv; it is not a real customer export.

```sh
npm run migrate
npm run coupons -- import voucherify --file=imports/vouchers.csv --currency=NZD --amount-unit=minor --actor=operator --dry-run
npm run coupons -- import voucherify --file=imports/vouchers.csv --currency=NZD --amount-unit=minor --actor=operator
```

One command imports the complete file atomically. Repeating the identical file with the same currency and unit setting is a no-op. A changed file cannot overwrite existing codes or merge silently into an existing campaign. A bad row rejects the whole file. Archive duplicate or overlapping exports deliberately, then bring one complete campaign export across.

## Mapping and reconciliation

| Vendor field | Local record |
|---|---|
| campaign | Campaign name; new campaign remains DRAFT |
| code | Case-insensitive unique coupon code |
| discount_type | AMOUNT or PERCENT only |
| value | Percentage converted to basis points; amount uses the explicit unit setting |
| start_date, expiration_date | UTC validity timestamps; expiry is exclusive locally |
| redemption_quantity | Lifetime code-use ceiling |
| redemption_count | Imported baseline count, deducted from remaining uses |
| active | Source activity flag; this does not activate an unreviewed coupon |
| Every field | Original CSV and per-row source record retained |

The CSV does not identify the currency. Supply it from the campaign settings, and do not mix currencies in one import. Confirm the AMOUNT value against a known Voucherify code and choose minor units (500 means 5.00) or major units (5 means 5.00). PERCENT 15 becomes 1500 basis points. Only NZD, AUD, USD, EUR and GBP are supported, each using two decimal places.

The import does not recreate external validation rules, product exclusions, customer assignments, recurring validity windows, stacking, referral rules, distribution, webhooks or checkout integrations. It preserves those source fields for review. Every imported coupon is held until a person explicitly sets its local discount, cap, dates, use limit and activity state with review-coupon. The reviewer must confirm that the supported local rules describe the intended offer. If they do not, leave the campaign paused and extend the rules through /customise before activation. Imported percentage caps are provisional and cannot execute before review.

Set-policy records the owner, disclosed terms, reference-price evidence, review due date, minimum order, local discount budget and customer limit. Activate refuses missing or overdue reviews and unreviewed coupons. Review-coupon and set-policy return the campaign to DRAFT, so changed terms require another activation.

The baseline count is not customer-level redemption history. Customer limits and budget totals cover local net redemptions after cutover only. Imported financial totals are unknown. Reconcile historic redemption exports separately, agree a new local budget and customer-limit period, or extend the importer before continuing a lifetime customer restriction. Original baseline uses cannot be reversed here. Do not run the same codes concurrently in both systems: their counters do not communicate.

Before switching, compare all imported codes, source counts, dates, discounts and active flags. Quote representative eligible and ineligible orders. Agree the counter boundary, take a backup, and test the eventual checkout connection separately. This base records local decisions; it neither changes a checkout price nor sends a code. Cancellation of the incumbent is an operator decision after a tested replacement connection and reconciliation.

## Leave again

```sh
npm run coupons -- export --out=exports/coupons-snapshot.json
```

Exports include every domain record, review, original import and policy snapshot. Existing files are never overwritten. Use database-native backups too; JSON export is a portable record archive, not a tested automatic restore facility.
