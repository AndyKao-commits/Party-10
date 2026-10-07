begin;

-- Remember decoy seats that have already caught a buyer without exposing their truth.
alter table ticket_private.seats add column if not exists triggered boolean not null default false;

create or replace function public.list_ticket_seats(p_code text) returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'areaId',area_id,'label',label,'position',position,'sold',(sold or triggered)) order by area_id,position),'[]'::jsonb)
 from ticket_private.seats where room_code=upper(p_code);
$$;

create or replace function public.purchase_selected_seats(p_code text,p_player_id uuid,p_area_id text,p_qty int,p_nickname text,p_seat_ids uuid[],p_member_token text) returns jsonb
language plpgsql security definer set search_path=''
as $$ declare r public.rooms;a public.areas;o public.orders;n int;labels text[];m ticket_private.party_members;s ticket_private.site_settings;begin
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
  return jsonb_build_object('error','你是黃牛不賣你 請重新購票','code','FAKE_SEAT');
 end if;
 if a.remaining<n then raise exception '剩餘座位不足';end if;if random()<r.fail_chance then raise exception '系統忙碌中，請重新再試';end if;
 select array_agg(label order by position) into labels from ticket_private.seats where id=any(p_seat_ids);update ticket_private.seats set sold=true where id=any(p_seat_ids);update public.areas set remaining=remaining-n where room_code=r.code and id=a.id;
 insert into public.orders(room_code,player_id,nickname,area_id,area_name,qty,seats,code,unit_price,member_id,member_account,member_phone) values(r.code,p_player_id,m.name,a.id,a.name,n,labels,'P'||replace(gen_random_uuid()::text,'-',''),a.price,m.id,m.account,m.phone) returning * into o;
 return jsonb_build_object('order',jsonb_build_object('id',o.id,'nickname',o.nickname,'areaName',o.area_name,'qty',o.qty,'seats',o.seats,'code',o.code,'unitPrice',o.unit_price,'createdAt',(extract(epoch from o.created_at)*1000)::bigint));
end $$;

create or replace function public.reset_room_stock(p_code text,p_host_id uuid,p_sale_in_sec int default 20) returns public.rooms
language plpgsql security definer set search_path='' as $$ declare r public.rooms; begin
 select * into r from public.rooms where code=upper(p_code) for update;
 if r.code is null or p_host_id is null or r.host_id is distinct from p_host_id then raise exception '只有主辦可以重置'; end if;
 update ticket_private.seats set sold=false,triggered=false where room_code=r.code;
 update public.areas set remaining=real_seats where room_code=r.code;
 delete from public.orders where room_code=r.code;
 update public.rooms set sale_open=false,sale_at=now()+make_interval(secs=>greatest(5,p_sale_in_sec)) where code=r.code returning * into r;
 return r;
end $$;

create or replace function public.admin_clear_party_members(p_admin_key text,p_mode text) returns jsonb
language plpgsql security definer set search_path=''
as $$ declare removed int; begin
 perform ticket_private.assert_admin(p_admin_key);
 if p_mode='unpurchased' then delete from ticket_private.party_members m where not exists(select 1 from public.orders o where o.member_id=m.id);
 elsif p_mode='members' then delete from ticket_private.party_members where true;
 elsif p_mode='full' then
  delete from public.orders where true;update ticket_private.seats set sold=false,triggered=false;update public.areas set remaining=real_seats;delete from public.players where not is_host;delete from ticket_private.party_members where true;
 else raise exception '未知的清除模式'; end if;
 get diagnostics removed=row_count;return jsonb_build_object('removed',removed);
end $$;

commit;
