create function touch_updated_at() returns trigger language plpgsql as $$ begin new.updated_at=now(); return new; end $$;
create function immutable_record() returns trigger language plpgsql as $$ begin raise exception 'History is append-only'; end $$;
create table campaigns (
 id uuid primary key default gen_random_uuid(), name text not null check(length(trim(name))>0),
 currency text not null check(currency in ('NZD','AUD','USD','EUR','GBP')),
 status text not null default 'DRAFT' check(status in ('DRAFT','ACTIVE','PAUSED','CLOSED')),
 owner text not null default '', terms text not null default '', price_evidence text not null default '',
 review_due date, reviewed_by text not null default '', reviewed_at timestamptz,
 min_order_cents bigint not null default 0 check(min_order_cents between 0 and 100000000000),
 budget_cents bigint not null default 100000 check(budget_cents between 1 and 100000000000),
 per_customer_limit integer not null default 1 check(per_customer_limit between 1 and 1000000),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index campaign_name_unique on campaigns(lower(name));
create table imports (
 id uuid primary key default gen_random_uuid(), fingerprint text not null unique, source_name text not null,
 currency text not null, raw_csv text not null, row_count integer not null, actor text not null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table coupons (
 id uuid primary key default gen_random_uuid(), campaign_id uuid not null references campaigns,
 code text not null check(length(trim(code))>0), kind text not null check(kind in ('AMOUNT','PERCENT')),
 value integer not null check(value>0 and value<=100000000),
 max_discount_cents bigint not null check(max_discount_cents between 1 and 100000000000),
 starts_at timestamptz not null, expires_at timestamptz not null, active boolean not null default true,
 redemption_limit integer not null check(redemption_limit between 1 and 100000000),
 imported_count integer not null default 0 check(imported_count>=0),
 reviewed_by text not null default '', review_note text not null default '', reviewed_at timestamptz,
 import_id uuid references imports, source_row jsonb,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(expires_at>starts_at), check(kind<>'PERCENT' or value<=10000), check(imported_count<=redemption_limit)
);
create unique index coupon_code_unique on coupons(lower(code));
create table redemptions (
 id uuid primary key default gen_random_uuid(), coupon_id uuid not null references coupons,
 order_ref text not null unique, customer_ref text not null, currency text not null,
 order_cents bigint not null check(order_cents>0), discount_cents bigint not null check(discount_cents>0 and discount_cents<=order_cents),
 policy_snapshot jsonb not null, actor text not null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table reversals (
 id uuid primary key default gen_random_uuid(), redemption_id uuid not null unique references redemptions,
 reason text not null check(length(trim(reason))>0), actor text not null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table activity (
 id uuid primary key default gen_random_uuid(), action text not null, record_id uuid, actor text not null, detail jsonb not null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index redemptions_coupon on redemptions(coupon_id);
create index coupons_campaign on coupons(campaign_id);
create view net_redemptions as select r.* from redemptions r where not exists(select 1 from reversals x where x.redemption_id=r.id);
create view coupon_usage as
 select c.id,c.campaign_id,c.code,c.kind,c.value,c.active,c.expires_at,c.reviewed_at,
 c.redemption_limit,c.imported_count,count(r.id)::integer as local_uses,
 c.redemption_limit-c.imported_count-count(r.id)::integer as remaining_uses,
 coalesce(sum(r.discount_cents),0)::bigint as discount_cents
 from coupons c left join net_redemptions r on r.coupon_id=c.id group by c.id;
create view campaign_budget as
 select c.id,c.name,c.currency,c.status,c.budget_cents,coalesce(sum(u.discount_cents),0)::bigint as used_cents,
 c.budget_cents-coalesce(sum(u.discount_cents),0)::bigint as remaining_cents,count(u.id)::integer as coupon_count,
 coalesce(sum(u.local_uses),0)::integer as local_uses
 from campaigns c left join coupon_usage u on u.campaign_id=c.id group by c.id;
create view compliance_findings as
 select id as campaign_id,name,'OFFER_TERMS'::text as rule,'Terms or reference-price evidence missing'::text as finding from campaigns where terms='' or price_evidence=''
 union all select id,name,'REVIEW_OWNER','Owner, reviewer or review date missing' from campaigns where owner='' or reviewed_by='' or reviewed_at is null or review_due is null
 union all select id,name,'REVIEW_DUE','Campaign review overdue' from campaigns where review_due<current_date
 union all select c.id,c.name,'IMPORTED_RULES','Coupon '||v.code||' needs explicit rule review' from campaigns c join coupons v on v.campaign_id=c.id where v.reviewed_at is null;
create view attention as
 select name as campaign,rule as reason,finding as detail from compliance_findings
 union all select c.name,'EXPIRING','Coupon '||v.code||' expires '||v.expires_at::date from coupons v join campaigns c on c.id=v.campaign_id where v.expires_at>now() and v.expires_at<=now()+interval '7 days'
 union all select name,'BUDGET','Local discount budget has less than 20 percent remaining' from campaign_budget where remaining_cents*5<budget_cents
 union all select c.name,'QUIET','Active campaign has no local redemption in 14 days' from campaigns c where c.status='ACTIVE' and not exists(select 1 from coupons v join net_redemptions r on r.coupon_id=v.id where v.campaign_id=c.id and r.created_at>now()-interval '14 days');
do $$ declare t text; begin
 foreach t in array array['campaigns','coupons','imports','redemptions','reversals','activity'] loop
 execute format('alter table %I enable row level security',t);
 execute format('revoke all on %I from public',t);
 if t in ('campaigns','coupons') then
 execute format('create trigger touch before update on %I for each row execute function touch_updated_at()',t);
 else
 execute format('create trigger immutable before update or delete on %I for each row execute function immutable_record()',t);
 end if;
 end loop;
end $$;
revoke all on net_redemptions,coupon_usage,campaign_budget,compliance_findings,attention from public;
