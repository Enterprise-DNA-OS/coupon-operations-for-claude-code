---
description: "voucherify --file=export.csv --currency=NZD --actor=name [--amount-unit=minor|major] [--dry-run]"
---

Read CLAUDE.md first.

Run `npm run coupons -- import` with the operator's arguments. Usage: voucherify --file=export.csv --currency=NZD --actor=name [--amount-unit=minor|major] [--dry-run]. Use `--json` for structured records. Read the current record before changing it. An ambiguous match needs an exact name or id from the candidate list.

Read docs/replace-voucherify.md. Test with --dry-run first, reconcile source counts and explain unreviewed rules before activation.

Present the returned facts and any blocking reasons. Drafts and generated reports stay private. Nothing sends, publishes or connects to a live checkout.
