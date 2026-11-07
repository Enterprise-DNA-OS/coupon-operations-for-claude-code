---
description: "<coupon> --kind=PERCENT|AMOUNT --value=1000 --cap-cents=2000 --starts=ISO --expires=ISO --limit=100 --active=true|false --note=text --actor=name (returns campaign to DRAFT)"
---

Read CLAUDE.md first.

Run `npm run coupons -- review-coupon` with the operator's arguments. Usage: <coupon> --kind=PERCENT|AMOUNT --value=1000 --cap-cents=2000 --starts=ISO --expires=ISO --limit=100 --active=true|false --note=text --actor=name (returns campaign to DRAFT). Use `--json` for structured records. Read the current record before changing it. An ambiguous match needs an exact name or id from the candidate list.

Review retained source_row fields and the full vendor restrictions. Leave unsupported restrictions held; implement and test them through /customise before activation. The note must describe the actual review, never a generic approval.

Present the returned facts and any blocking reasons. Drafts and generated reports stay private. Nothing sends, publishes or connects to a live checkout.
