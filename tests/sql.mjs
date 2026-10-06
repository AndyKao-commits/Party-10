import {PGlite} from '@electric-sql/pglite'
import {readFileSync} from 'node:fs'
import assert from 'node:assert/strict'
const root=new URL('..',import.meta.url).pathname
const db=new PGlite()
await db.exec('create role anon;create role authenticated;create publication supabase_realtime;')
await db.exec(readFileSync(root+'/supabase/schema.sql','utf8').replace('create extension if not exists "pgcrypto";',''))
await db.exec(readFileSync(root+'/supabase/schema-v2.sql','utf8'))
await db.exec(readFileSync(root+'/supabase/schema-v3.sql','utf8'))
const sql=readFileSync(root+'/supabase/schema-v4.sql','utf8')
await db.exec(sql)
await db.exec(readFileSync(root+'/supabase/schema-v5.sql','utf8'))
await db.exec('create schema if not exists extensions;create function extensions.crypt(text,text) returns text language sql immutable as $$select $1$$;create function extensions.gen_salt(text) returns text language sql immutable as $$select $1$$;create function extensions.digest(text,text) returns bytea language sql immutable as $$select convert_to($1,\'UTF8\')$$;create function extensions.gen_random_bytes(int) returns bytea language sql volatile as $$select decode(md5(random()::text)||md5(random()::text),\'hex\')$$;')
await db.exec(readFileSync(root+'/supabase/schema-v6.sql','utf8'))
const q=async (s,p=[]) => (await db.query(s,p)).rows
const c='BBQ1011'
const seats=await q('select * from ticket_private.seats where room_code=$1',[c]);assert.equal(seats.length,36)
const host=(await q('select host_id from public.rooms where code=$1',[c]))[0].host_id
const player=(await q("insert into players(room_code,nickname) values($1,'測試') returning id",[c]))[0].id
await db.exec("update rooms set sale_open=true where code='BBQ1011'")
await db.exec("update ticket_private.site_settings set purchase_open=true")
const registration=(await q("select public.register_party_member('測試會員','0912345678','tester') result"))[0].result
const memberToken=registration.token
assert.equal((await q('select public.get_site_status(null,$1) status',[memberToken]))[0].status.member.account,'tester')
await assert.rejects(q("select public.register_party_member('測試會員','0988888888','other')"),/名字已經註冊/)
await assert.rejects(q("select public.login_party_member('tester','0900000000')"),/帳號或電話不正確/)
assert.equal((await q("select public.login_party_member('tester','0912345678') result"))[0].result.member.name,'測試會員')
assert.equal((await q("select jsonb_array_length(public.admin_list_party_members('party2026')) n"))[0].n,1)
const fake=seats.find(s=>!s.is_real), real=seats.find(s=>s.is_real)
const buy=(id) => q('select public.purchase_selected_seats($1,$2,$3,$4,$5,$6::uuid[],$7) result',[c,player,'general',1,'測試',[id],memberToken])
await assert.rejects(q('select public.purchase_selected_seats($1,$2,$3,$4,$5,$6::uuid[],$7)',[c,player,'general',1,'測試',[real?.id || seats[0].id],'bad']),/請先登入會員/)
await assert.rejects(buy(fake.id),/你是黃牛不賣你 請重新購票/)
assert.equal((await q("select count(*)::int n from orders where room_code='BBQ1011'"))[0].n,0)
assert.equal((await q("select remaining from areas where room_code='BBQ1011'"))[0].remaining,18)
const simultaneous=await Promise.allSettled([buy(real.id),buy(real.id)])
assert.equal(simultaneous.filter(r=>r.status==='fulfilled').length,1)
assert.equal((await q("select remaining from areas where room_code='BBQ1011'"))[0].remaining,17)
const before=await q('select id from ticket_private.seats where room_code=$1 order by id',[c])
const cfg=[{id:'general',name:'烤肉席',price:950,realSeats:18,fakeSeats:18,color:'#16a34a'}]
await q('select public.save_ticket_event($1,$2,$3::jsonb,$4::jsonb)',[c,host,JSON.stringify({title:'改標題'}),JSON.stringify(cfg)])
assert.deepEqual(await q('select id from ticket_private.seats where room_code=$1 order by id',[c]),before)
assert.equal((await q("select remaining,price from areas where room_code='BBQ1011'"))[0].remaining,17)
assert.equal((await q("select unit_price from orders where room_code='BBQ1011'"))[0].unit_price,700)
await assert.rejects(q('select public.save_ticket_event($1,$2,$3::jsonb,$4::jsonb)',[c,host,'{}',JSON.stringify([{...cfg[0],realSeats:0}])]),/已售/)
await assert.rejects(q('select public.purchase_tickets($1,$2,$3,1,$4)',[c,player,'general','測試']),/自行選位/)
const purchasedOrder=(await q("select id from orders where room_code='BBQ1011'"))[0].id
await assert.rejects(q('select public.cancel_ticket_order($1,$2)',[purchasedOrder,'00000000-0000-0000-0000-000000000000']),/只有主辦/)
await q('select public.cancel_ticket_order($1,$2)',[purchasedOrder,host])
assert.equal((await q("select count(*)::int n from orders where room_code='BBQ1011'"))[0].n,0)
assert.equal((await q("select remaining from areas where room_code='BBQ1011'"))[0].remaining,18)
assert.equal((await q("select count(*)::int n from ticket_private.seats where room_code='BBQ1011' and sold"))[0].n,0)
await db.exec("update rooms set sale_open=true where code='BBQ1011'")
await buy(real.id)
assert.equal((await q('select public.clear_ticket_orders($1,$2) n',[c,host]))[0].n,1)
assert.equal((await q("select count(*)::int n from orders where room_code='BBQ1011'"))[0].n,0)
assert.equal((await q("select remaining from areas where room_code='BBQ1011'"))[0].remaining,18)
const pub=(await q('select public.list_ticket_seats($1) seats',[c]))[0].seats
assert.ok(pub.every(s=>!('isReal' in s)&&!('is_real' in s)))
await db.exec('set role anon')
await assert.rejects(q('select * from ticket_private.seats'),/permission denied/)
await assert.rejects(q("insert into orders(room_code,nickname,area_id,area_name,qty,code) values('BBQ1011','bad','general','a',1,'bad')"),/permission denied/)
await db.exec('reset role')
await q('select public.delete_ticket_event($1,$2)',[c,host])
assert.equal((await q('select count(*)::int n from ticket_private.seats where room_code=$1',[c]))[0].n,0)
assert.equal((await q('select count(*)::int n from orders where room_code=$1',[c]))[0].n,0)
await q('select public.ensure_featured_room()')
assert.equal((await q('select count(*)::int n from rooms where code=$1',[c]))[0].n,0)
console.log('PASS SQL migration, fake-seat rollback, double-purchase serialization, price snapshot, inventory preservation, anti-bypass, private truth, delete cascades/no resurrection')
await db.close()
