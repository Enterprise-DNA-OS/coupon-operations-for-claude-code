#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { getDb, REPO_ROOT } from './lib/db.mjs';
import { parseCsv } from './lib/csv.mjs';
import { table } from './lib/format.mjs';

export const READS = {
 campaigns: 'select id,name,currency,status,owner,review_due from campaigns order by name',
 coupons: 'select c.id,c.code,p.name as campaign,c.kind,c.value,c.expires_at,c.reviewed_at is not null as reviewed from coupons c join campaigns p on p.id=c.campaign_id order by c.code',
 redemptions: 'select r.id,c.code,r.order_ref,r.customer_ref,r.currency,r.order_cents,r.discount_cents,r.created_at,exists(select 1 from reversals x where x.redemption_id=r.id) as reversed from redemptions r join coupons c on c.id=r.coupon_id order by r.created_at desc',
 reversals: 'select * from reversals order by created_at desc',
 activity: 'select action,record_id,actor,detail,created_at from activity order by created_at desc,id',
 imports: 'select id,source_name,currency,row_count,actor,created_at from imports order by created_at desc',
 attention: 'select * from attention order by campaign,reason',
 compliance: 'select name,rule,finding from compliance_findings order by name,rule',
 expiry: 'select code,expires_at,remaining_uses from coupon_usage where expires_at<=now()+interval \'7 days\' order by expires_at',
 budget: 'select name,currency,status,budget_cents,used_cents,remaining_cents,local_uses from campaign_budget order by name',
 quiet: "select * from attention where reason='QUIET' order by campaign"
};
export const HELP = {
 ...Object.fromEntries(Object.keys(READS).map(k=>[k,'Read '+k])),
 campaign:'<name-or-id> Full campaign policy, coupons and budget',
 'add-campaign':'--name=name --currency=NZD --actor=name',
 'set-policy':'<campaign> --owner=name --terms=text --evidence=text --review-due=YYYY-MM-DD --min-cents=0 --budget-cents=100000 --customer-limit=1 --actor=name (returns to DRAFT)',
 'add-coupon':'--campaign=name --code=CODE --kind=PERCENT|AMOUNT --value=1000 --cap-cents=2000 --starts=ISO --expires=ISO --limit=100 --actor=name (unreviewed)',
 'review-coupon':'<coupon> --kind=PERCENT|AMOUNT --value=1000 --cap-cents=2000 --starts=ISO --expires=ISO --limit=100 --active=true|false --note=text --actor=name (returns campaign to DRAFT)',
 activate:'<campaign> --actor=name (requires complete current reviews)',
 pause:'<campaign> --reason=text --actor=name',
 quote:'<coupon> --order-cents=10000 --currency=NZD --customer=opaque-id (read-only)',
 redeem:'<coupon> --order-cents=10000 --currency=NZD --customer=opaque-id --order=unique-order --actor=name (local ledger only)',
 reverse:'<redemption-id-or-order> --reason=text --actor=name (local ledger only)',
 import:'voucherify --file=export.csv --currency=NZD --actor=name [--amount-unit=minor|major] [--dry-run]',
 export:'--out=new-file.json (all records and original imports)',
 'weekly-review':'Write private review from attention, budget and compliance',
 'draft-offer':'<campaign> Write private offer terms and evidence brief',
 help:'Every command supports --json; flags use --name=value'
};
const need=(o,k)=>{const v=o[k];if(typeof v!=='string'||!v.trim())throw Error(`--${k} is required`);return v.trim();};
const integer=(v,label,min=0,max=100000000000)=>{if(!/^\d+$/.test(String(v))||!Number.isSafeInteger(Number(v))||Number(v)<min||Number(v)>max)throw Error(`${label}: expected integer ${min}..${max}`);return Number(v);};
const bool=(v)=>{if(!['true','false'].includes(String(v)))throw Error('Expected true or false');return v==='true';};
const currency=(s)=>{if(!['NZD','AUD','USD','EUR','GBP'].includes(s))throw Error('Currency must be NZD, AUD, USD, EUR or GBP');return s;};
function timestamp(v,label){if(!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?(?:Z|[+-]\d\d:\d\d)$/.test(String(v))||!Number.isFinite(Date.parse(v)))throw Error(`${label}: ISO timestamp with timezone required`);const date=String(v).slice(0,10);if(new Date(date).toISOString().slice(0,10)!==date)throw Error(`${label}: invalid calendar date`);return new Date(v).toISOString();}
function date(v){if(!/^\d{4}-\d\d-\d\d$/.test(String(v))||!Number.isFinite(Date.parse(v))||new Date(v).toISOString().slice(0,10)!==v)throw Error('Review date must be YYYY-MM-DD');return v;}
async function transaction(db,fn){await db.exec('BEGIN');try{const out=await fn();await db.exec('COMMIT');return out;}catch(e){await db.exec('ROLLBACK');throw e;}}
async function audit(db,action,id,actor,detail){await db.query('insert into activity(action,record_id,actor,detail) values($1,$2,$3,$4)',[action,id,actor,JSON.stringify(detail)]);}
async function resolve(db,tableName,key,ref){
 if(!ref)throw Error(`A ${tableName} name or id is required`);
 const exact=await db.query(`select * from ${tableName} where lower(${key})=lower($1) or id::text=$1`,[ref]);
 if(exact.length===1)return exact[0];
 const rows=await db.query(`select * from ${tableName} where id::text like $1 or position(lower($2) in lower(${key}))>0 order by ${key}`,[ref+'%',ref]);
 if(rows.length!==1){const e=Error(rows.length?'Ambiguous match; choose an exact name or id':'No matching record');e.candidates=rows.map(r=>({id:r.id,name:r[key]}));throw e;}return rows[0];
}
function couponInput(o){
 const kind=need(o,'kind');if(!['AMOUNT','PERCENT'].includes(kind))throw Error('Only AMOUNT and PERCENT discounts are supported');
 const value=integer(need(o,'value'),'value',1,kind==='PERCENT'?10000:100000000);
 const cap=integer(need(o,'cap-cents'),'cap-cents',1);const starts=timestamp(need(o,'starts'),'starts'),expires=timestamp(need(o,'expires'),'expires');
 if(expires<=starts)throw Error('Expiry must be after start');
 return {kind,value,cap,starts,expires,limit:integer(need(o,'limit'),'limit',1,100000000)};
}
async function lockCampaign(db,id){return (await db.query('select * from campaigns where id=$1 for update',[id]))[0];}
async function decision(db,c,p,o){
 const order=integer(need(o,'order-cents'),'order-cents',1),cur=currency(need(o,'currency')),customer=need(o,'customer');
 const reasons=[],now=Date.now();
 if(p.status!=='ACTIVE')reasons.push('CAMPAIGN_NOT_ACTIVE');
 if(!c.active)reasons.push('CODE_INACTIVE');
 if(!c.reviewed_at)reasons.push('CODE_NOT_REVIEWED');
 if(!p.owner||!p.terms||!p.price_evidence||!p.reviewed_by||!p.reviewed_at||!p.review_due)reasons.push('CAMPAIGN_EVIDENCE_MISSING');
 if(p.review_due&&String(p.review_due).slice(0,10)<new Date().toISOString().slice(0,10))reasons.push('REVIEW_OVERDUE');
 if(now<Date.parse(c.starts_at))reasons.push('NOT_STARTED');
 if(now>=Date.parse(c.expires_at))reasons.push('EXPIRED');
 if(cur!==p.currency)reasons.push('CURRENCY_MISMATCH');
 if(order<p.min_order_cents)reasons.push('MINIMUM_ORDER');
 const [usage]=await db.query('select * from coupon_usage where id=$1',[c.id]);
 if(usage.remaining_uses<=0)reasons.push('CODE_LIMIT');
 const [{n}]=await db.query('select count(*)::integer as n from net_redemptions r join coupons c on c.id=r.coupon_id where c.campaign_id=$1 and r.customer_ref=$2',[p.id,customer]);
 if(n>=p.per_customer_limit)reasons.push('CUSTOMER_LIMIT');
 const [budget]=await db.query('select * from campaign_budget where id=$1',[p.id]);
 // BigInt prevents rounding error at large order amounts. Percent values use basis points.
 const raw=c.kind==='AMOUNT'?c.value:Number(BigInt(order)*BigInt(c.value)/10000n);
 const discount=Math.min(order,c.max_discount_cents,raw);
 if(discount<=0)reasons.push('ZERO_DISCOUNT');
 if(discount>budget.remaining_cents)reasons.push('BUDGET_LIMIT');
 return {eligible:reasons.length===0,code:c.code,order_cents:order,currency:cur,customer_ref:customer,discount_cents:discount,payable_cents:order-discount,reasons};
}
function parseImport(raw,o){
 const rows=parseCsv(raw);if(!rows.length)throw Error('Empty import');const cur=currency(need(o,'currency'));
 const required=['code','voucher_type','value','discount_type','campaign','start_date','expiration_date','redemption_quantity','redemption_count','active'];
 const codes=new Set();
 return rows.map((r,i)=>{
  for(const k of required)if(!(k in r)||r[k]==='')throw Error(`Row ${i+2}: required export column ${k} is missing or empty`);
  if(r.voucher_type!=='DISCOUNT_VOUCHER')throw Error(`Row ${i+2}: gift cards and loyalty cards are outside this build`);
  if(!['AMOUNT','PERCENT'].includes(r.discount_type))throw Error(`Row ${i+2}: unsupported discount type ${r.discount_type}`);
  const code=r.code.trim();if(!code||codes.has(code.toLowerCase()))throw Error(`Row ${i+2}: empty or duplicate code`);codes.add(code.toLowerCase());
  let value;
  if(r.discount_type==='PERCENT'){
   if(!/^\d+(?:\.\d{1,2})?$/.test(r.value))throw Error('Percent must have at most two decimals');
   value=Math.round(Number(r.value)*100);
  }else{
   if(!['minor','major'].includes(o['amount-unit']))throw Error('AMOUNT import requires --amount-unit=minor|major after checking the export against Voucherify');
   if(!/^\d+(?:\.\d{1,2})?$/.test(r.value))throw Error('Invalid amount');
   value=o['amount-unit']==='major'?Math.round(Number(r.value)*100):integer(r.value,'amount',1,100000000);
  }
  const input=couponInput({kind:r.discount_type,value:String(value),'cap-cents':String(r.discount_type==='AMOUNT'?value:100000000),starts:r.start_date,expires:r.expiration_date,limit:r.redemption_quantity});
  const count=integer(r.redemption_count,'redemption_count',0,input.limit);
  return {...input,code,name:r.campaign.trim(),count,active:bool(r.active),currency:cur,row:r};
 });
}
function privateFile(dir,prefix,body){const out=path.resolve(process.env.OUTPUT_DIR||REPO_ROOT,dir);fs.mkdirSync(out,{recursive:true,mode:0o700});const file=path.join(out,`${prefix}-${randomUUID()}.md`);fs.writeFileSync(file,body,{flag:'wx',mode:0o600});return {file};}
export async function run(db,cmd,args=[],o={}){
 if(cmd==='help')return Object.entries(HELP).map(([command,usage])=>({command,usage}));
 if(READS[cmd])return db.query(READS[cmd]);
 if(cmd==='campaign'){
  const c=await resolve(db,'campaigns','name',args[0]);return {campaign:c,coupons:await db.query('select * from coupon_usage where campaign_id=$1 order by code',[c.id]),budget:(await db.query('select * from campaign_budget where id=$1',[c.id]))[0]};
 }
 if(cmd==='weekly-review'){
  const sections=[];for(const k of ['attention','budget','compliance'])sections.push(`## ${k}\n\n${JSON.stringify(await db.query(READS[k]),null,2)}`);
  return privateFile('drafts','weekly-review',`# Coupon review\n\nPrivate working draft. Local ledger only; reconcile with checkout records.\n\n${sections.join('\n\n')}\n`);
 }
 if(cmd==='draft-offer'){
  const c=await resolve(db,'campaigns','name',args[0]);const codes=await db.query('select code,kind,value,max_discount_cents,starts_at,expires_at,redemption_limit,reviewed_at from coupons where campaign_id=$1 order by code',[c.id]);
  return privateFile('drafts','offer',`# ${c.name}\n\nPRIVATE DRAFT. Review the real advertised offer before use.\n\n${c.terms||'Terms missing. Do not distribute.'}\n\nCurrency: ${c.currency}\nOwner: ${c.owner}\nEvidence: ${c.price_evidence}\nReview due: ${c.review_due}\n\n${JSON.stringify(codes,null,2)}\n`);
 }
 if(cmd==='export'){
  const file=path.resolve(need(o,'out'));const data={format:'coupon-operations-v1',exported_at:new Date().toISOString(),records:{}};
  await db.exec('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');try{for(const t of ['campaigns','coupons','imports','redemptions','reversals','activity'])data.records[t]=await db.query(`select * from ${t} order by id`);}finally{await db.exec('ROLLBACK');}
  fs.mkdirSync(path.dirname(file),{recursive:true,mode:0o700});fs.writeFileSync(file,JSON.stringify(data,null,2)+'\n',{flag:'wx',mode:0o600});return {file,counts:Object.fromEntries(Object.entries(data.records).map(([k,v])=>[k,v.length]))};
 }
 if(cmd==='quote'){
  await db.exec('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');try{const c=await resolve(db,'coupons','code',args[0]);const p=(await db.query('select * from campaigns where id=$1',[c.campaign_id]))[0];return await decision(db,c,p,o);}finally{await db.exec('ROLLBACK');}
 }
 if(!HELP[cmd])throw Error(`Unknown command ${cmd}. Run help.`);
 const actor=need(o,'actor');
 return transaction(db,async()=>{
  if(cmd==='add-campaign'){
   const [c]=await db.query('insert into campaigns(name,currency) values($1,$2) returning *',[need(o,'name'),currency(need(o,'currency'))]);await audit(db,cmd,c.id,actor,{name:c.name});return c;
  }
  if(['set-policy','activate','pause'].includes(cmd)){
   let c=await resolve(db,'campaigns','name',args[0]);c=await lockCampaign(db,c.id);
   if(cmd==='set-policy'){
    const due=date(need(o,'review-due'));if(due<new Date().toISOString().slice(0,10))throw Error('Review due cannot be in the past');
    [c]=await db.query("update campaigns set owner=$2,terms=$3,price_evidence=$4,review_due=$5,min_order_cents=$6,budget_cents=$7,per_customer_limit=$8,reviewed_by=$9,reviewed_at=now(),status='DRAFT' where id=$1 returning *",[c.id,need(o,'owner'),need(o,'terms'),need(o,'evidence'),due,integer(need(o,'min-cents'),'min-cents'),integer(need(o,'budget-cents'),'budget-cents',1),integer(need(o,'customer-limit'),'customer-limit',1,1000000),actor]);
   }else if(cmd==='activate'){
    const findings=await db.query('select rule,finding from compliance_findings where campaign_id=$1',[c.id]);
    if(findings.length)throw Error('Activation blocked: '+JSON.stringify(findings));
    const [{n}]=await db.query('select count(*)::integer as n from coupons where campaign_id=$1',[c.id]);if(!n)throw Error('Activation needs at least one reviewed coupon');
    [c]=await db.query("update campaigns set status='ACTIVE' where id=$1 returning *",[c.id]);
   }else{need(o,'reason');[c]=await db.query("update campaigns set status='PAUSED' where id=$1 returning *",[c.id]);}
   await audit(db,cmd,c.id,actor,{policy:c,reason:o.reason||null});return c;
  }
  if(cmd==='add-coupon'||cmd==='review-coupon'){
   const p=couponInput(o);let c;
   if(cmd==='add-coupon'){
    const campaign=await resolve(db,'campaigns','name',need(o,'campaign'));await lockCampaign(db,campaign.id);
    [c]=await db.query('insert into coupons(campaign_id,code,kind,value,max_discount_cents,starts_at,expires_at,redemption_limit) values($1,$2,$3,$4,$5,$6,$7,$8) returning *',[campaign.id,need(o,'code'),p.kind,p.value,p.cap,p.starts,p.expires,p.limit]);
   }else{
    c=await resolve(db,'coupons','code',args[0]);await lockCampaign(db,c.campaign_id);
    const [usage]=await db.query('select * from coupon_usage where id=$1',[c.id]);if(p.limit<c.imported_count+usage.local_uses)throw Error('Limit cannot be below existing net use');
    [c]=await db.query('update coupons set kind=$2,value=$3,max_discount_cents=$4,starts_at=$5,expires_at=$6,redemption_limit=$7,active=$8,reviewed_by=$9,review_note=$10,reviewed_at=now() where id=$1 returning *',[c.id,p.kind,p.value,p.cap,p.starts,p.expires,p.limit,bool(need(o,'active')),actor,need(o,'note')]);
   }
   await db.query("update campaigns set status='DRAFT' where id=$1",[c.campaign_id]);await audit(db,cmd,c.id,actor,{coupon:c});return c;
  }
  if(cmd==='redeem'){
   let c=await resolve(db,'coupons','code',args[0]);const p=await lockCampaign(db,c.campaign_id);c=(await db.query('select * from coupons where id=$1',[c.id]))[0];
   const order=need(o,'order');const prior=(await db.query('select * from redemptions where order_ref=$1',[order]))[0];
   if(prior){
    if(prior.coupon_id!==c.id||prior.customer_ref!==need(o,'customer')||prior.currency!==need(o,'currency')||prior.order_cents!==integer(need(o,'order-cents'),'order-cents',1))throw Error('Order reference already used with a different request');
    const reversed=(await db.query('select id from reversals where redemption_id=$1',[prior.id])).length>0;return {...prior,replay:true,reversed};
   }
   const d=await decision(db,c,p,o);if(!d.eligible){const e=Error('Redemption blocked: '+d.reasons.join(', '));e.decision=d;throw e;}
   const [r]=await db.query('insert into redemptions(coupon_id,order_ref,customer_ref,currency,order_cents,discount_cents,policy_snapshot,actor) values($1,$2,$3,$4,$5,$6,$7,$8) returning *',[c.id,order,d.customer_ref,d.currency,d.order_cents,d.discount_cents,JSON.stringify({campaign:p,coupon:c}),actor]);
   await audit(db,cmd,r.id,actor,{order_ref:order,discount_cents:d.discount_cents});return r;
  }
  if(cmd==='reverse'){
   const r=await resolve(db,'redemptions','order_ref',args[0]);const [c]=await db.query('select * from coupons where id=$1',[r.coupon_id]);await lockCampaign(db,c.campaign_id);const reason=need(o,'reason');
   const [old]=await db.query('select * from reversals where redemption_id=$1',[r.id]);if(old)return {...old,replay:true};
   const [x]=await db.query('insert into reversals(redemption_id,reason,actor) values($1,$2,$3) returning *',[r.id,reason,actor]);await audit(db,cmd,x.id,actor,{redemption_id:r.id,reason});return x;
  }
  if(cmd==='import'){
   if(args[0]!=='voucherify')throw Error('Use import voucherify');
   const file=need(o,'file'),raw=fs.readFileSync(file,'utf8');const rows=parseImport(raw,o);
   const fingerprint=createHash('sha256').update(JSON.stringify({raw,currency:o.currency,amountUnit:o['amount-unit']||null})).digest('hex');
   const [old]=await db.query('select id,row_count from imports where fingerprint=$1',[fingerprint]);if(old)return {...old,replay:true};
   for(const r of rows){const [existing]=await db.query('select id from coupons where lower(code)=lower($1)',[r.code]);if(existing)throw Error(`Existing code ${r.code}: import refuses to overwrite history`);const [p]=await db.query('select id from campaigns where lower(name)=lower($1)',[r.name]);if(p)throw Error(`Existing campaign ${r.name}: use one complete export in a fresh campaign, never merge silently`);}
   if(o['dry-run'])return {dry_run:true,rows:rows.length,campaigns:[...new Set(rows.map(r=>r.name))],review_required:true};
   const [batch]=await db.query('insert into imports(fingerprint,source_name,currency,raw_csv,row_count,actor) values($1,$2,$3,$4,$5,$6) returning id',[fingerprint,path.basename(file),o.currency,raw,rows.length,actor]);
   const campaigns=new Map();
   for(const r of rows){
    const key=r.name.toLowerCase();let p=campaigns.get(key);if(!p){[p]=await db.query('insert into campaigns(name,currency) values($1,$2) returning id',[r.name,r.currency]);campaigns.set(key,p);}
    await db.query('insert into coupons(campaign_id,code,kind,value,max_discount_cents,starts_at,expires_at,redemption_limit,imported_count,active,import_id,source_row) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)',[p.id,r.code,r.kind,r.value,r.cap,r.starts,r.expires,r.limit,r.count,r.active,batch.id,JSON.stringify(r.row)]);
   }
   await audit(db,cmd,batch.id,actor,{rows:rows.length,review_required:true});return {id:batch.id,rows:rows.length,campaigns:campaigns.size,review_required:true};
  }
  throw Error('Unhandled command');
 });
}
export function parseArgs(argv){const args=[],options={};for(const x of argv){if(x.startsWith('--')){const i=x.indexOf('=');const key=x.slice(2,i<0?undefined:i);if(Object.hasOwn(options,key))throw Error(`Duplicate flag ${key}`);options[key]=i<0?true:x.slice(i+1);}else args.push(x);}return {command:args.shift()||'help',args,options};}
export function humanOutput(out) {
 const format=(rows)=>table(rows,Object.keys(rows[0]||{}).map(key=>({key,label:key.replace(/_cents$/, ' amount').replaceAll('_',' '),width:100,format:(v,r)=>v instanceof Date?v.toISOString():v===null?'':key.endsWith('_cents')?`${r.currency||''} ${(Number(v)/100).toFixed(2)}`.trim():typeof v==='object'?JSON.stringify(v):v})));
 if(Array.isArray(out))return format(out);
 if(out && Object.hasOwn(out,'eligible'))return format([{code:out.code,eligible:out.eligible,currency:out.currency,order_cents:out.order_cents,discount_cents:out.discount_cents,payable_cents:out.payable_cents,reasons:out.reasons.join(', ')||'None'}]);
 const scalar=Object.fromEntries(Object.entries(out||{}).filter(([,v])=>v===null||typeof v!=='object'||v instanceof Date));
 const blocks=[format(Object.entries(scalar).map(([field,value])=>({field,value})))];
 for(const [key,value] of Object.entries(out||{}))if(value&&typeof value==='object'&&!(value instanceof Date))blocks.push(key+'\n'+humanOutput(value));
 return blocks.join('\n\n');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 let db;const json=process.argv.includes('--json');
 try{const a=parseArgs(process.argv.slice(2));db=await getDb();const out=await run(db,a.command,a.args,a.options);if(json)console.log(JSON.stringify(out,null,2));else console.log(humanOutput(out));}
 catch(e){console.error(JSON.stringify({error:e.message,...(e.candidates?{candidates:e.candidates}:{}),...(e.decision?{decision:e.decision}:{})}));process.exitCode=1;}
 finally{if(db)await db.close();}
}
