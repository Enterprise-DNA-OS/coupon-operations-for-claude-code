insert into campaigns(id,name,currency,status,owner,terms,price_evidence,review_due,reviewed_by,reviewed_at,min_order_cents,budget_cents,per_customer_limit) values
('10000000-0000-4000-8000-000000000001','Winter return','NZD','ACTIVE','Mara','Ten percent off orders of at least 50.00 NZD; one use per customer; ends at the code expiry. Maximum discount 20.00 NZD.','Synthetic price-book review, demo only',current_date+14,'Demo reviewer',now(),5000,50000,1),
('10000000-0000-4000-8000-000000000002','Outlet weekend','AUD','DRAFT','Hemi','','',current_date-3,'',null,0,20000,1),
('10000000-0000-4000-8000-000000000003','Partner welcome','NZD','ACTIVE','Inez','Fixed 5.00 NZD discount. One use per customer. Expires at the recorded date.','Synthetic offer comparison, demo only',current_date+14,'Demo reviewer',now(),2000,10000,1)
on conflict do nothing;
insert into coupons(id,campaign_id,code,kind,value,max_discount_cents,starts_at,expires_at,redemption_limit,reviewed_by,review_note,reviewed_at) values
('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','RETURN10','PERCENT',1000,2000,now()-interval '30 days',now()+interval '5 days',100,'Demo reviewer','Synthetic percent offer',now()),
('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002','OUTLET500','AMOUNT',500,500,now()-interval '2 days',now()+interval '3 days',20,'','',null),
('20000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000003','PARTNER5','AMOUNT',500,500,now()-interval '60 days',now()+interval '30 days',50,'Demo reviewer','Synthetic welcome offer',now()),
('20000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000001','WINTEROLD','PERCENT',500,1000,now()-interval '60 days',now()-interval '5 days',50,'Demo reviewer','Expired synthetic offer',now())
on conflict do nothing;
insert into redemptions(id,coupon_id,order_ref,customer_ref,currency,order_cents,discount_cents,policy_snapshot,actor,created_at) values
('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','DEMO-ORDER-1','demo-customer-1','NZD',8000,800,'{"source":"synthetic demo"}','demo',now()-interval '2 days'),
('30000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000003','DEMO-ORDER-2','demo-customer-2','NZD',5000,500,'{"source":"synthetic demo"}','demo',now()-interval '20 days')
on conflict do nothing;
