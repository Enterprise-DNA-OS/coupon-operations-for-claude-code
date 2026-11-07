# Offer evidence checks

The compliance command checks records that support an operator's advertising review. It does not decide whether an actual advertisement is lawful or certify a business. Sources were reopened on 7 November 2026.

| Check | Record test | Source and boundary |
|---|---|---|
| OFFER_TERMS | Terms and reference-price evidence must be recorded | [NZ Commerce Commission: pricing products or services](https://www.comcom.govt.nz/business/dealing-with-typical-situations/selling-goods-and-services/pricing-your-products-or-services/). Special-offer conditions must be disclosed; an advertised sale price must reflect a real comparison. Text presence cannot prove truthful prices or visible disclosure. |
| REVIEW_OWNER | Owner, reviewer, review timestamp and due date required | Local accountability policy, not a statutory interval. |
| REVIEW_DUE | A review date before today blocks new use | Local review policy. There is no legal deadline encoded here. |
| IMPORTED_RULES | Every imported coupon needs an explicit local rule review | [Voucherify export reference](https://docs.voucherify.io/api-reference/exports/create-export). Exports include fields beyond the supported local rules; retained fields do not automatically become enforceable conditions. |

[NSW Government advertising guidance](https://www.nsw.gov.au/business-and-economy/running-a-business/advertising-laws-and-your-business) explains that limited offer periods should be stated. [ACCC guidance on sale advertising](https://www.accc.gov.au/media-release/accc-sweep-finds-concerning-black-friday-sales-advertising) highlights exclusions and qualifications that contradict broad sale claims. The brief displays expiry, minimum order, use limits and the operator's terms together for review. The software cannot inspect an advertisement, confirm historical selling prices or establish stock availability.

Use opaque customer references where possible. The original imported CSV can contain personal data in metadata or assignments. Store imports and exports privately, decide retention periods, and manage access and backups before using real records. No automatic retention deletion is included. Local actor names are audit context, not authentication. The CLI requires a trusted database owner. Row-level security blocks unprivileged access by default; deployment-specific roles must be designed and tested. Database owners can bypass protections, so append-only history is not a tamper-proof audit claim.

No payment processing, gift cards, monetary balances, tax computation, loyalty points, email, public code distribution or automatic checkout changes are included. A local reversal restores local budget and code capacity; it is not a customer refund.
