# Why this starts without a front end

Coupon operations is a repeated set of questions: which offers expire, which codes have capacity, what did an order qualify for, and what needs a review? The CLI reads and writes those records. Claude Code, Codex, OpenCode or Cursor can run it from a plain-language brief.

Read-only HTML gives the owner a weekly review, an expiry report, offer terms briefs and redemption statements. Change brand.json once for the business name, logo and colours. Print these files to PDF. They have no editing controls or public customer portal.

A checkout screen provides immediate customer feedback, access control and a connection to the order system. A mobile scanner makes an in-store code quick to redeem. This base supplies neither. It does not collect orders automatically or provide Voucherify's hosted API, delivery infrastructure, global performance or uptime commitments. Its local quote and redemption commands support a trusted operator and tested business connections built separately. An owner who needs a new screen, scanner or a store connection can have Enterprise DNA build that into their version.

Use PostgreSQL for a shared deployment. The embedded store is for one local process at a time. No concurrency or availability promises are made for an embedded database opened by several processes. Keep generated reports private: they can include customer references and internal offer evidence.
