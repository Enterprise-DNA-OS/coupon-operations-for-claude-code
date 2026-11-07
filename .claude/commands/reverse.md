---
description: "<redemption-id-or-order> --reason=text --actor=name (local ledger only)"
---

Read CLAUDE.md first.

Run `npm run coupons -- reverse` with the operator's arguments. Usage: <redemption-id-or-order> --reason=text --actor=name (local ledger only). Use `--json` for structured records. Read the current record before changing it. An ambiguous match needs an exact name or id from the candidate list.

This changes the local ledger only. Explain that it neither changes checkout nor refunds a customer. Use an operator-supplied order reference and reason. Never invent either.

Present the returned facts and any blocking reasons. Drafts and generated reports stay private. Nothing sends, publishes or connects to a live checkout.
