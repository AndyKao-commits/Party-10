-- Ticket pickup, short collection codes and per-area ticket notes.
begin;

alter table public.areas add column if not exists ticket_content text not null default '';
alter table public.orders add column if not exists picked_up_at timestamptz;

-- Existing UUID-style codes are shortened without changing the order identity.
update public.orders
set code = left(regexp_replace(upper(room_code), '[^A-Z0-9]', '', 'g'), 4)
  || '-' || upper(substr(md5(id::text), 1, 6))
where char_length(code) > 16;

create or replace function public.save_ticket_event(p_code text,p_host_id uuid,p_event jsonb,p_areas jsonb) returns text
language plpgsql security definer set search_path=''
as $$
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
 sale_at=coalesce((p_event->>'saleAt')::timestamptz,sale_at),sale_open=case when coalesce((p_event->>'saleAt')::timestamptz,sale_at)>now() then false else sale_open end,
 max_per_order=least(4,greatest(1,coalesce((p_event->>'maxPerOrder')::int,max_per_order))),fail_chance=least(0.6,greatest(0,coalesce((p_event->>'failChance')::float,fail_chance))),
 image_url=coalesce(p_event->>'imageUrl',image_url),is_featured=coalesce((p_event->>'featured')::boolean,is_featured)
 where code=c;
 for item in select value from jsonb_array_elements(p_areas) loop
  if coalesce(item->>'id','')='' or item->>'id'=any(ids) then raise exception '票區代碼重複或空白'; end if;
  ids:=array_append(ids,item->>'id'); real_count:=(item->>'realSeats')::int; fake_count:=(item->>'fakeSeats')::int;
  if real_count is null or fake_count is null or real_count not between 0 and 999 or fake_count not between 0 and 999 or real_count+fake_count<1 or (item->>'price')::int not between 0 and 999999 then raise exception '票價或座位數格式錯誤'; end if;
  select * into a from public.areas where room_code=c and id=item->>'id';
  insert into public.areas(room_code,id,name,price,total,remaining,color,real_seats,fake_seats,ticket_content)
  values(c,item->>'id',left(coalesce(item->>'name','全票區'),80),(item->>'price')::int,real_count,real_count,coalesce(item->>'color','#16a34a'),real_count,fake_count,left(coalesce(item->>'ticketContent',''),500))
  on conflict(room_code,id) do update set name=excluded.name,price=excluded.price,color=excluded.color,ticket_content=excluded.ticket_content;
  if a.id is null or a.real_seats<>real_count or a.fake_seats<>fake_count then perform ticket_private.configure_seats(c,item->>'id',real_count,fake_count); end if;
 end loop;
 if exists(select 1 from ticket_private.seats where room_code=c and not(area_id=any(ids)) and sold) then raise exception '已售出票區不可移除，可修改名稱與票價'; end if;
 delete from public.areas where room_code=c and not(id=any(ids)); return c;
end $$;

create or replace function public.purchase_selected_seats(p_code text,p_player_id uuid,p_area_id text,p_qty int,p_nickname text,p_seat_ids uuid[],p_member_token text) returns jsonb
language plpgsql security definer set search_path=''
as $$ declare r public.rooms;a public.areas;o public.orders;n int;labels text[];m ticket_private.party_members;s ticket_private.site_settings;warning_text text;short_code text;begin
 select * into m from ticket_private.current_member(p_member_token);if m.id is null then raise exception '請先登入會員';end if;
 select * into s from ticket_private.site_settings where id=true;if not s.purchase_open then raise exception '目前尚未開放購票';end if;
 select * into r from public.rooms where code=upper(p_code) for update;if r.code is null then raise exception '找不到活動';end if;if not(r.sale_open or r.sale_at<=now()) then raise exception '尚未開賣';end if;
 if p_player_id is null or not exists(select 1 from public.players where id=p_player_id and room_code=r.code) then raise exception '請重新進入活動';end if;
 n:=cardinality(p_seat_ids);if n is null or n<1 or n<>p_qty or n>r.max_per_order or n<>(select count(distinct id) from unnest(p_seat_ids) id) then raise exception '請重新選擇座位';end if;
 select * into a from public.areas where room_code=r.code and id=p_area_id for update;if a.id is null then raise exception '票區不存在';end if;
 if n<>(select count(*) from ticket_private.seats where room_code=r.code and area_id=a.id and id=any(p_seat_ids)) then raise exception '座位資料失效，請重新選位';end if;
 if exists(select 1 from ticket_private.seats where id=any(p_seat_ids) and (sold or triggered)) then raise exception '座位已被購買，請重新選位';end if;
 if exists(select 1 from ticket_private.seats where id=any(p_seat_ids) and not is_real) then
  update ticket_private.seats set triggered=true where id=any(p_seat_ids) and not is_real;
  warning_text:=case floor(random()*10)::int when 0 then '你是黃牛不讓你買，請重新選位' when 1 then '此座位已被其他人搶先購買' when 2 then '此座位已被神秘嘉賓預留' when 3 then '系統偵測到可疑手速，本席暫不出售' when 4 then '這個位置已經有主人了，換一個吧' when 5 then '很抱歉，你與這個座位緣分未到' when 6 then '此座位正在裝忙，暫時不接客' when 7 then '手速很快，但命運更快' when 8 then '工作人員偷偷保留了這個位置' else '系統判定：這張票不屬於你' end;
  return jsonb_build_object('error',warning_text,'code','FAKE_SEAT');
 end if;
 if a.remaining<n then raise exception '剩餘座位不足';end if;if random()<r.fail_chance then raise exception '系統忙碌中，請重新再試';end if;
 short_code:=left(regexp_replace(upper(r.code),'[^A-Z0-9]','','g'),4)||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));
 select array_agg(label order by position) into labels from ticket_private.seats where id=any(p_seat_ids);update ticket_private.seats set sold=true where id=any(p_seat_ids);update public.areas set remaining=remaining-n where room_code=r.code and id=a.id;
 insert into public.orders(room_code,player_id,nickname,area_id,area_name,qty,seats,code,unit_price,member_id,member_account,member_phone) values(r.code,p_player_id,m.name,a.id,a.name,n,labels,short_code,a.price,m.id,m.account,m.phone) returning * into o;
 return jsonb_build_object('order',jsonb_build_object('id',o.id,'nickname',o.nickname,'areaName',o.area_name,'qty',o.qty,'seats',o.seats,'code',o.code,'unitPrice',o.unit_price,'createdAt',(extract(epoch from o.created_at)*1000)::bigint));
end $$;

create or replace function public.lookup_ticket_orders(p_phone text) returns jsonb
language plpgsql security definer set search_path=''
as $$ declare v_phone text:=regexp_replace(coalesce(p_phone,''),'[^0-9]','','g'); begin
 if v_phone !~ '^[0-9]{8,15}$' then raise exception '請輸入正確電話號碼'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object(
  'id',o.id,'eventCode',o.room_code,'eventTitle',r.title,'eventDate',r.date_text,'eventImage',r.image_url,
  'buyerName',o.nickname,'areaName',o.area_name,'qty',o.qty,'unitPrice',o.unit_price,'orderCode',o.code,
  'createdAt',(extract(epoch from o.created_at)*1000)::bigint,'pickedUpAt',case when o.picked_up_at is null then null else (extract(epoch from o.picked_up_at)*1000)::bigint end,
  'ticketContent',a.ticket_content,'tickets',(select jsonb_agg(jsonb_build_object('seat',x.seat,'ticketCode',o.code||'-'||lpad(x.n::text,2,'0')) order by x.n) from unnest(o.seats) with ordinality x(seat,n))
 ) order by o.created_at desc) from public.orders o join public.rooms r on r.code=o.room_code join public.areas a on a.room_code=o.room_code and a.id=o.area_id where o.member_phone=v_phone),'[]'::jsonb);
end $$;

create or replace function public.pickup_ticket_order(p_phone text,p_order_id uuid) returns bigint
language plpgsql security definer set search_path=''
as $$ declare v_phone text:=regexp_replace(coalesce(p_phone,''),'[^0-9]','','g'); picked timestamptz; begin
 if v_phone !~ '^[0-9]{8,15}$' then raise exception '請輸入正確電話號碼'; end if;
 update public.orders set picked_up_at=coalesce(picked_up_at,now()) where id=p_order_id and member_phone=v_phone returning picked_up_at into picked;
 if picked is null then raise exception '找不到這筆訂單'; end if;
 return (extract(epoch from picked)*1000)::bigint;
end $$;

revoke all on function public.lookup_ticket_orders(text),public.pickup_ticket_order(text,uuid) from public,anon,authenticated;
grant execute on function public.lookup_ticket_orders(text),public.pickup_ticket_order(text,uuid) to anon,authenticated;

commit;
