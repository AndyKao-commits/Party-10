-- Run after schema-v5.sql. Site gate, preregistration and member-only checkout.
begin;

create table if not exists ticket_private.site_settings (
  id boolean primary key default true check (id),
  site_open boolean not null default false,
  registration_open boolean not null default true,
  purchase_open boolean not null default false,
  closed_message text not null default '平台尚未開放，請洽活動方',
  staff_password_hash text not null,
  admin_password_hash text not null,
  access_revision int not null default 1,
  updated_at timestamptz not null default now()
);

insert into ticket_private.site_settings(id,staff_password_hash,admin_password_hash)
values(true,extensions.crypt('preview2026',extensions.gen_salt('bf')),extensions.crypt('party2026',extensions.gen_salt('bf')))
on conflict(id) do nothing;

create table if not exists ticket_private.party_members (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  account text not null,
  failed_attempts int not null default 0,
  locked_until timestamptz,
  created_at timestamptz not null default now()
);
create unique index if not exists party_members_name_unique on ticket_private.party_members(lower(btrim(name)));
create unique index if not exists party_members_phone_unique on ticket_private.party_members(phone);
create unique index if not exists party_members_account_unique on ticket_private.party_members(lower(btrim(account)));

create table if not exists ticket_private.member_sessions (
  token_hash text primary key,
  member_id uuid not null references ticket_private.party_members(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists member_sessions_member_idx on ticket_private.member_sessions(member_id);

create table if not exists ticket_private.staff_sessions (
  token_hash text primary key,
  revision int not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

alter table ticket_private.site_settings enable row level security;
alter table ticket_private.party_members enable row level security;
alter table ticket_private.member_sessions enable row level security;
alter table ticket_private.staff_sessions enable row level security;
revoke all on ticket_private.site_settings,ticket_private.party_members,ticket_private.member_sessions,ticket_private.staff_sessions from public,anon,authenticated;

alter table public.orders add column if not exists member_id uuid references ticket_private.party_members(id) on delete set null;
alter table public.orders add column if not exists member_account text;
alter table public.orders add column if not exists member_phone text;
create index if not exists orders_member_id_idx on public.orders(member_id);

create or replace function ticket_private.token_hash(p_token text) returns text
language sql immutable security definer set search_path=''
as $$ select encode(extensions.digest(coalesce(p_token,''),'sha256'),'hex') $$;
revoke all on function ticket_private.token_hash(text) from public,anon,authenticated;

create or replace function ticket_private.assert_admin(p_key text) returns void
language plpgsql security definer set search_path=''
as $$ declare s ticket_private.site_settings; begin
 select * into s from ticket_private.site_settings where id=true;
 if p_key is null or extensions.crypt(p_key,s.admin_password_hash)<>s.admin_password_hash then raise exception '後台驗證失敗'; end if;
end $$;
revoke all on function ticket_private.assert_admin(text) from public,anon,authenticated;

create or replace function ticket_private.current_member(p_token text) returns ticket_private.party_members
language sql stable security definer set search_path=''
as $$
 select m from ticket_private.party_members m join ticket_private.member_sessions s on s.member_id=m.id
 where s.token_hash=ticket_private.token_hash(p_token) and s.expires_at>now() limit 1
$$;
revoke all on function ticket_private.current_member(text) from public,anon,authenticated;

create or replace function public.get_site_status(p_staff_token text default null,p_member_token text default null) returns jsonb
language plpgsql security definer set search_path=''
as $$ declare s ticket_private.site_settings; m ticket_private.party_members; staff_ok boolean:=false; begin
 select * into s from ticket_private.site_settings where id=true;
 if p_staff_token is not null then
  staff_ok:=exists(select 1 from ticket_private.staff_sessions x where x.token_hash=ticket_private.token_hash(p_staff_token) and x.revision=s.access_revision and x.expires_at>now());
 end if;
 if p_member_token is not null then select * into m from ticket_private.current_member(p_member_token); end if;
 return jsonb_build_object('siteOpen',s.site_open,'effectiveOpen',s.site_open or staff_ok,'registrationOpen',s.registration_open,'purchaseOpen',s.purchase_open,'closedMessage',s.closed_message,'staffAccess',staff_ok,'member',case when m.id is null then null else jsonb_build_object('id',m.id,'name',m.name,'phone',m.phone,'account',m.account,'createdAt',(extract(epoch from m.created_at)*1000)::bigint) end);
end $$;

create or replace function public.verify_staff_access(p_password text) returns jsonb
language plpgsql security definer set search_path=''
as $$ declare s ticket_private.site_settings; token text; begin
 select * into s from ticket_private.site_settings where id=true;
 if p_password is null or extensions.crypt(p_password,s.staff_password_hash)<>s.staff_password_hash then raise exception '瀏覽密碼不正確'; end if;
 token:=encode(extensions.gen_random_bytes(32),'hex');
 delete from ticket_private.staff_sessions where expires_at<=now();
 insert into ticket_private.staff_sessions(token_hash,revision,expires_at) values(ticket_private.token_hash(token),s.access_revision,now()+interval '12 hours');
 return jsonb_build_object('token',token,'expiresAt',(extract(epoch from now()+interval '12 hours')*1000)::bigint);
end $$;

create or replace function public.register_party_member(p_name text,p_phone text,p_account text) returns jsonb
language plpgsql security definer set search_path=''
as $$ declare s ticket_private.site_settings; m ticket_private.party_members; v_phone text:=regexp_replace(coalesce(p_phone,''),'[^0-9]','','g'); v_account text:=lower(btrim(coalesce(p_account,''))); token text; begin
 select * into s from ticket_private.site_settings where id=true;
 if not s.registration_open then raise exception '目前未開放註冊'; end if;
 if char_length(btrim(coalesce(p_name,''))) not between 1 and 30 then raise exception '請輸入正確名字'; end if;
 if v_phone !~ '^[0-9]{8,15}$' then raise exception '請輸入正確電話號碼'; end if;
 if v_account !~ '^[a-z0-9._-]{3,30}$' then raise exception '帳號限 3～30 位英文、數字、句點、底線或連字號'; end if;
 begin
  insert into ticket_private.party_members(name,phone,account) values(btrim(p_name),v_phone,v_account) returning * into m;
 exception when unique_violation then
  if exists(select 1 from ticket_private.party_members where lower(btrim(name))=lower(btrim(p_name))) then raise exception '這個名字已經註冊過'; end if;
  if exists(select 1 from ticket_private.party_members where phone=v_phone) then raise exception '這支電話已經註冊過'; end if;
  raise exception '這個帳號已經註冊過';
 end;
 token:=encode(extensions.gen_random_bytes(32),'hex');
 insert into ticket_private.member_sessions(token_hash,member_id,expires_at) values(ticket_private.token_hash(token),m.id,now()+interval '30 days');
 return jsonb_build_object('token',token,'member',jsonb_build_object('id',m.id,'name',m.name,'phone',m.phone,'account',m.account,'createdAt',(extract(epoch from m.created_at)*1000)::bigint));
end $$;

create or replace function public.login_party_member(p_account text,p_phone text) returns jsonb
language plpgsql security definer set search_path=''
as $$ declare m ticket_private.party_members; v_phone text:=regexp_replace(coalesce(p_phone,''),'[^0-9]','','g'); token text; begin
 select * into m from ticket_private.party_members where account=lower(btrim(coalesce(p_account,''))) for update;
 if m.id is not null and m.locked_until>now() then raise exception '登入錯誤次數過多，請稍後再試'; end if;
 if m.id is null or m.phone<>v_phone then
  if m.id is not null then update ticket_private.party_members set failed_attempts=failed_attempts+1,locked_until=case when failed_attempts+1>=5 then now()+interval '10 minutes' else null end where id=m.id; end if;
  raise exception '帳號或電話不正確';
 end if;
 update ticket_private.party_members set failed_attempts=0,locked_until=null where id=m.id;
 token:=encode(extensions.gen_random_bytes(32),'hex');
 insert into ticket_private.member_sessions(token_hash,member_id,expires_at) values(ticket_private.token_hash(token),m.id,now()+interval '30 days');
 return jsonb_build_object('token',token,'member',jsonb_build_object('id',m.id,'name',m.name,'phone',m.phone,'account',m.account,'createdAt',(extract(epoch from m.created_at)*1000)::bigint));
end $$;

create or replace function public.logout_party_member(p_token text) returns void
language sql security definer set search_path='' as $$ delete from ticket_private.member_sessions where token_hash=ticket_private.token_hash(p_token) $$;

create or replace function public.admin_get_site_settings(p_admin_key text) returns jsonb
language plpgsql security definer set search_path=''
as $$ declare s ticket_private.site_settings; begin perform ticket_private.assert_admin(p_admin_key);select * into s from ticket_private.site_settings where id=true;return jsonb_build_object('siteOpen',s.site_open,'registrationOpen',s.registration_open,'purchaseOpen',s.purchase_open,'closedMessage',s.closed_message,'updatedAt',(extract(epoch from s.updated_at)*1000)::bigint);end $$;

create or replace function public.admin_update_site_settings(p_admin_key text,p_site_open boolean,p_registration_open boolean,p_purchase_open boolean,p_closed_message text,p_staff_password text default null) returns jsonb
language plpgsql security definer set search_path=''
as $$ begin
 perform ticket_private.assert_admin(p_admin_key);
 if nullif(p_staff_password,'') is not null and char_length(p_staff_password)<4 then raise exception '瀏覽密碼至少需要 4 個字元'; end if;
 update ticket_private.site_settings set site_open=p_site_open,registration_open=p_registration_open,purchase_open=p_purchase_open,closed_message=left(coalesce(nullif(btrim(p_closed_message),''),'平台尚未開放，請洽活動方'),100),staff_password_hash=case when nullif(p_staff_password,'') is null then staff_password_hash else extensions.crypt(p_staff_password,extensions.gen_salt('bf')) end,access_revision=access_revision+case when nullif(p_staff_password,'') is null then 0 else 1 end,updated_at=now() where id=true;
 if nullif(p_staff_password,'') is not null then delete from ticket_private.staff_sessions where true; end if;
 return public.admin_get_site_settings(p_admin_key);
end $$;

create or replace function public.admin_list_party_members(p_admin_key text) returns jsonb
language plpgsql security definer set search_path=''
as $$ begin perform ticket_private.assert_admin(p_admin_key);return coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'name',m.name,'phone',m.phone,'account',m.account,'createdAt',(extract(epoch from m.created_at)*1000)::bigint,'orderCount',(select count(*) from public.orders o where o.member_id=m.id)) order by m.created_at desc) from ticket_private.party_members m),'[]'::jsonb);end $$;

create or replace function public.admin_delete_party_member(p_admin_key text,p_member_id uuid) returns void
language plpgsql security definer set search_path='' as $$ begin perform ticket_private.assert_admin(p_admin_key);delete from ticket_private.party_members where id=p_member_id;end $$;

create or replace function public.admin_clear_party_members(p_admin_key text,p_mode text) returns jsonb
language plpgsql security definer set search_path=''
as $$ declare removed int; begin
 perform ticket_private.assert_admin(p_admin_key);
 if p_mode='unpurchased' then delete from ticket_private.party_members m where not exists(select 1 from public.orders o where o.member_id=m.id);
 elsif p_mode='members' then delete from ticket_private.party_members where true;
 elsif p_mode='full' then
  delete from public.orders where true;update ticket_private.seats set sold=false where is_real;update public.areas set remaining=real_seats;delete from public.players where not is_host;delete from ticket_private.party_members where true;
 else raise exception '未知的清除模式'; end if;
 get diagnostics removed=row_count;return jsonb_build_object('removed',removed);
end $$;

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
 if exists(select 1 from ticket_private.seats where id=any(p_seat_ids) and sold) then raise exception '座位已被購買，請重新選位';end if;
 if exists(select 1 from ticket_private.seats where id=any(p_seat_ids) and not is_real) then raise exception '你是黃牛不賣你 請重新購票';end if;
 if a.remaining<n then raise exception '剩餘座位不足';end if;if random()<r.fail_chance then raise exception '系統忙碌中，請重新再試';end if;
 select array_agg(label order by position) into labels from ticket_private.seats where id=any(p_seat_ids);update ticket_private.seats set sold=true where id=any(p_seat_ids);update public.areas set remaining=remaining-n where room_code=r.code and id=a.id;
 insert into public.orders(room_code,player_id,nickname,area_id,area_name,qty,seats,code,unit_price,member_id,member_account,member_phone) values(r.code,p_player_id,m.name,a.id,a.name,n,labels,'P'||replace(gen_random_uuid()::text,'-',''),a.price,m.id,m.account,m.phone) returning * into o;
 return jsonb_build_object('order',jsonb_build_object('id',o.id,'nickname',o.nickname,'areaName',o.area_name,'qty',o.qty,'seats',o.seats,'code',o.code,'unitPrice',o.unit_price,'createdAt',(extract(epoch from o.created_at)*1000)::bigint));
end $$;

revoke all on function public.purchase_selected_seats(text,uuid,text,int,text,uuid[]) from public,anon,authenticated;

do $$ declare f regprocedure;begin
 foreach f in array array[
  'public.get_site_status(text,text)'::regprocedure,'public.verify_staff_access(text)'::regprocedure,'public.register_party_member(text,text,text)'::regprocedure,'public.login_party_member(text,text)'::regprocedure,'public.logout_party_member(text)'::regprocedure,
  'public.admin_get_site_settings(text)'::regprocedure,'public.admin_update_site_settings(text,boolean,boolean,boolean,text,text)'::regprocedure,'public.admin_list_party_members(text)'::regprocedure,'public.admin_delete_party_member(text,uuid)'::regprocedure,'public.admin_clear_party_members(text,text)'::regprocedure,'public.purchase_selected_seats(text,uuid,text,int,text,uuid[],text)'::regprocedure
 ] loop execute format('revoke all on function %s from public,anon,authenticated',f);execute format('grant execute on function %s to anon,authenticated',f);end loop;
end $$;

commit;
