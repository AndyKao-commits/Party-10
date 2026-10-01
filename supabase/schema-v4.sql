-- Run after schema-v3.sql. Seat truth lives outside the exposed public schema.
begin;
create schema if not exists ticket_private;
revoke all on schema ticket_private from public, anon, authenticated;
create table if not exists ticket_private.seats (
 id uuid primary key default gen_random_uuid(), room_code text not null,
 area_id text not null, position int not null check(position > 0),
 label text not null, is_real boolean not null, sold boolean not null default false,
 foreign key(room_code,area_id) references public.areas(room_code,id) on delete cascade,
 unique(room_code,area_id,position)
);
alter table ticket_private.seats enable row level security;
revoke all on ticket_private.seats from public,anon,authenticated;
alter table public.areas add column if not exists real_seats int;
alter table public.areas add column if not exists fake_seats int not null default 0;
update public.areas set real_seats=total where real_seats is null;
alter table public.areas alter column real_seats set not null;
alter table public.areas alter column real_seats set default 0;
alter table public.orders add column if not exists unit_price int;

create or replace function ticket_private.configure_seats(p_code text,p_area text,p_real int,p_fake int)
returns void language plpgsql security definer set search_path='' as $$
declare sold_count int; start_at int; item record;
begin
 if p_real < 0 or p_fake < 0 or p_real+p_fake < 1 or p_real+p_fake > 1998 then raise exception '每區真、假座位各限 0～999，合計至少 1 個'; end if;
 select count(*) into sold_count from ticket_private.seats where room_code=p_code and area_id=p_area and sold;
 if p_real < sold_count then raise exception '真座位數不得少於已售張數（已售 %）',sold_count; end if;
 delete from ticket_private.seats where room_code=p_code and area_id=p_area and not sold;
 select coalesce(max(position),0) into start_at from ticket_private.seats where room_code=p_code and area_id=p_area;
 for item in select (i <= p_real-sold_count) as real, row_number() over(order by random()) as offset_no from generate_series(1,p_real-sold_count+p_fake) i loop
   insert into ticket_private.seats(room_code,area_id,position,label,is_real)
   values(p_code,p_area,start_at+item.offset_no, '第'||(((start_at+item.offset_no-1)/8)::int+1)||'排'||((start_at+item.offset_no-1)%8+1)||'號',item.real);
 end loop;
 update public.areas set real_seats=p_real,fake_seats=p_fake,total=p_real,remaining=p_real-sold_count where room_code=p_code and id=p_area;
end $$;
revoke all on function ticket_private.configure_seats(text,text,int,int) from public,anon,authenticated;

-- Backfill only once. Existing sold seats and orders survive this migration.
do $$ declare a record; sold_count int; begin
 for a in select * from public.areas loop
  if not exists(select 1 from ticket_private.seats where room_code=a.room_code and area_id=a.id) then
   perform ticket_private.configure_seats(a.room_code,a.id,a.real_seats,a.fake_seats);
   sold_count:=greatest(0,a.total-a.remaining);
   update ticket_private.seats set sold=true where id in (select id from ticket_private.seats where room_code=a.room_code and area_id=a.id and is_real order by position limit sold_count);
   update public.areas set remaining=a.remaining where room_code=a.room_code and id=a.id;
  end if;
 end loop;
end $$;

create or replace function public.list_ticket_seats(p_code text) returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'areaId',area_id,'label',label,'position',position,'sold',sold) order by area_id,position),'[]'::jsonb)
 from ticket_private.seats where room_code=upper(p_code);
$$;

create or replace function public.save_ticket_event(p_code text,p_host_id uuid,p_event jsonb,p_areas jsonb)
returns text language plpgsql security definer set search_path='' as $$
declare r public.rooms; item jsonb; a public.areas; real_count int; fake_count int; ids text[]:='{}'; c text:=upper(p_code);
begin
 if p_host_id is null or c !~ '^[A-Z0-9]{4,12}$' then raise exception '活動代碼或主辦資料錯誤'; end if;
 if p_areas is null or jsonb_typeof(p_areas) <> 'array' or jsonb_array_length(p_areas) < 1 or jsonb_array_length(p_areas)>20 then raise exception '請設定 1～20 個票區'; end if;
 select * into r from public.rooms where code=c for update;
 if found and r.host_id is distinct from p_host_id then raise exception '只有主辦可以編輯'; end if;
 if r.code is null then
  insert into public.rooms(code,host_id,title,sale_at,image_url) values(c,p_host_id,coalesce(p_event->>'title','新活動'),coalesce((p_event->>'saleAt')::timestamptz,now()+interval '30 seconds'),coalesce(p_event->>'imageUrl','')) returning * into r;
  insert into public.players(id,room_code,nickname,is_host) values(p_host_id,c,coalesce(p_event->>'hostName','主辦'),true);
 end if;
 if coalesce((p_event->>'featured')::boolean,false) then update public.rooms set is_featured=false where is_featured and code<>c; end if;
 update public.rooms set title=left(coalesce(p_event->>'title',title),80),subtitle=left(coalesce(p_event->>'subtitle',subtitle),80),venue=left(coalesce(p_event->>'venue',venue),80),date_text=left(coalesce(p_event->>'dateText',date_text),80),
 sale_at=coalesce((p_event->>'saleAt')::timestamptz,sale_at),
 sale_open=case when coalesce((p_event->>'saleAt')::timestamptz,sale_at)>now() then false else sale_open end,
 max_per_order=least(4,greatest(1,coalesce((p_event->>'maxPerOrder')::int,max_per_order))),fail_chance=least(0.6,greatest(0,coalesce((p_event->>'failChance')::float,fail_chance))),
 image_url=coalesce(p_event->>'imageUrl',image_url),is_featured=coalesce((p_event->>'featured')::boolean,is_featured)
 where code=c;
 for item in select value from jsonb_array_elements(p_areas) loop
  if coalesce(item->>'id','')='' or item->>'id'=any(ids) then raise exception '票區代碼重複或空白'; end if;
  ids:=array_append(ids,item->>'id');
  real_count:=(item->>'realSeats')::int; fake_count:=(item->>'fakeSeats')::int;
  if real_count is null or fake_count is null or real_count not between 0 and 999 or fake_count not between 0 and 999 or real_count+fake_count<1 or (item->>'price')::int not between 0 and 999999 then raise exception '票價或座位數格式錯誤'; end if;
  select * into a from public.areas where room_code=c and id=item->>'id';
  insert into public.areas(room_code,id,name,price,total,remaining,color,real_seats,fake_seats) values(c,item->>'id',left(coalesce(item->>'name','全票區'),80),(item->>'price')::int,real_count,real_count,coalesce(item->>'color','#16a34a'),real_count,fake_count)
  on conflict(room_code,id) do update set name=excluded.name,price=excluded.price,color=excluded.color;
  if a.id is null or a.real_seats<>real_count or a.fake_seats<>fake_count then perform ticket_private.configure_seats(c,item->>'id',real_count,fake_count); end if;
 end loop;
 if exists(select 1 from ticket_private.seats where room_code=c and not(area_id=any(ids)) and sold) then raise exception '已售出票區不可移除，可修改名稱與票價'; end if;
 delete from public.areas where room_code=c and not(id=any(ids));
 return c;
end $$;

create or replace function public.delete_ticket_event(p_code text,p_host_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare r public.rooms; begin
 select * into r from public.rooms where code=upper(p_code) for update;
 if r.code is null then raise exception '找不到活動'; end if;
 if p_host_id is null or r.host_id is distinct from p_host_id then raise exception '只有主辦可以刪除'; end if;
 delete from public.rooms where code=r.code;
end $$;

create or replace function public.purchase_selected_seats(p_code text,p_player_id uuid,p_area_id text,p_qty int,p_nickname text,p_seat_ids uuid[]) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r public.rooms; a public.areas; o public.orders; n int; labels text[];
begin
 -- A shared room lock serializes purchase/edit/delete/reset in the same order.
 select * into r from public.rooms where code=upper(p_code) for update;
 if r.code is null then raise exception '找不到活動'; end if;
 if not(r.sale_open or r.sale_at<=now()) then raise exception '尚未開賣'; end if;
 if p_player_id is null or not exists(select 1 from public.players where id=p_player_id and room_code=r.code) then raise exception '請先加入活動'; end if;
 n:=cardinality(p_seat_ids);
 if n is null or n<1 or n<>p_qty or n>r.max_per_order or n<>(select count(distinct id) from unnest(p_seat_ids) id) then raise exception '請重新選擇座位'; end if;
 select * into a from public.areas where room_code=r.code and id=p_area_id for update;
 if a.id is null then raise exception '票區不存在'; end if;
 if n<>(select count(*) from ticket_private.seats where room_code=r.code and area_id=a.id and id=any(p_seat_ids)) then raise exception '座位資料失效，請重新選位'; end if;
 if exists(select 1 from ticket_private.seats where id=any(p_seat_ids) and sold) then raise exception '座位已被購買，請重新選位'; end if;
 if exists(select 1 from ticket_private.seats where id=any(p_seat_ids) and not is_real) then raise exception '你是黃牛不賣你 請重新購票'; end if;
 if a.remaining<n then raise exception '剩餘座位不足'; end if;
 if random()<r.fail_chance then raise exception '系統忙碌中，請重新再試'; end if;
 select array_agg(label order by position) into labels from ticket_private.seats where id=any(p_seat_ids);
 update ticket_private.seats set sold=true where id=any(p_seat_ids);
 update public.areas set remaining=remaining-n where room_code=r.code and id=a.id;
 insert into public.orders(room_code,player_id,nickname,area_id,area_name,qty,seats,code,unit_price) values(r.code,p_player_id,left(coalesce(nullif(p_nickname,''),'訪客'),20),a.id,a.name,n,labels,'P'||replace(gen_random_uuid()::text,'-',''),a.price) returning * into o;
 return jsonb_build_object('order',jsonb_build_object('id',o.id,'nickname',o.nickname,'areaName',o.area_name,'qty',o.qty,'seats',o.seats,'code',o.code,'unitPrice',o.unit_price,'createdAt',(extract(epoch from o.created_at)*1000)::bigint));
end $$;

-- Old endpoints cannot bypass seat validation or erase inventory during edits.
create or replace function public.purchase_tickets(p_code text,p_player_id uuid,p_area_id text,p_qty int,p_nickname text) returns jsonb
language plpgsql set search_path='' as $$ begin raise exception '請更新頁面並自行選位'; end $$;
create or replace function public.update_room_event(p_code text,p_host_id uuid,p_title text,p_subtitle text,p_venue text,p_date_text text,p_sale_at timestamptz,p_max_per_order int,p_fail_chance double precision,p_featured boolean,p_total_tickets int,p_image_url text default null) returns public.rooms
language plpgsql set search_path='' as $$ begin raise exception '請更新後台頁面再編輯'; end $$;
create or replace function public.reset_room_stock(p_code text,p_host_id uuid,p_sale_in_sec int default 20) returns public.rooms
language plpgsql security definer set search_path='' as $$ declare r public.rooms; begin
 select * into r from public.rooms where code=upper(p_code) for update;
 if r.code is null or p_host_id is null or r.host_id is distinct from p_host_id then raise exception '只有主辦可以重置'; end if;
 update ticket_private.seats set sold=false where room_code=r.code;
 update public.areas set remaining=real_seats where room_code=r.code;
 delete from public.orders where room_code=r.code;
 update public.rooms set sale_open=false,sale_at=now()+make_interval(secs=>greatest(5,p_sale_in_sec)) where code=r.code returning * into r;
 return r;
end $$;
-- Do not resurrect an activity after it has been deleted.
create or replace function public.ensure_featured_room() returns public.rooms
language sql stable security definer set search_path='' as $$ select r from public.rooms r order by is_featured desc,created_at limit 1 $$;
-- Ticket mutations go through the functions above, never direct anonymous writes.
drop policy if exists orders_all on public.orders;
drop policy if exists orders_read on public.orders;
create policy orders_read on public.orders for select using(true);
drop policy if exists areas_all on public.areas;
drop policy if exists areas_read on public.areas;
create policy areas_read on public.areas for select using(true);
revoke insert,update,delete on public.orders,public.areas from anon,authenticated;
grant execute on function public.list_ticket_seats(text),public.save_ticket_event(text,uuid,jsonb,jsonb),public.delete_ticket_event(text,uuid),public.purchase_selected_seats(text,uuid,text,int,text,uuid[]) to anon,authenticated;
-- Add a new BBQ activity without overwriting any existing event or inventory.
do $$ begin
 if not exists(select 1 from public.rooms where code='BBQ1011') then
  perform public.save_ticket_event('BBQ1011',gen_random_uuid(),
   '{"title":"下班烤肉派對","subtitle":"好朋友限定・屋頂炭火之夜","venue":"屋頂派對主場","dateText":"2026/10/11（日）16:00","saleAt":"2026-10-10T10:00:00+08:00","imageUrl":"/events/bbq-party.jpg","maxPerOrder":1,"failChance":0,"featured":false}'::jsonb,
   '[{"id":"general","name":"烤肉席","price":700,"realSeats":18,"fakeSeats":18,"color":"#16a34a"}]'::jsonb);
 end if;
end $$;
commit;
