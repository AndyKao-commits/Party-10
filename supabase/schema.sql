-- pbon party ticket schema for Supabase
-- Run this in Supabase SQL Editor once.

create extension if not exists "pgcrypto";

create table if not exists rooms (
  code text primary key,
  host_id uuid not null,
  title text not null,
  subtitle text not null default '',
  venue text not null default '',
  date_text text not null default '',
  sale_at timestamptz not null,
  sale_open boolean not null default false,
  max_per_order int not null default 2,
  queue_delay_ms int not null default 2500,
  fail_chance double precision not null default 0.15,
  notices text[] not null default '{}',
  is_featured boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists areas (
  room_code text not null references rooms(code) on delete cascade,
  id text not null,
  name text not null,
  price int not null,
  total int not null,
  remaining int not null,
  color text not null default '#16a34a',
  primary key (room_code, id)
);

create table if not exists players (
  id uuid primary key default gen_random_uuid(),
  room_code text not null references rooms(code) on delete cascade,
  nickname text not null,
  is_host boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  room_code text not null references rooms(code) on delete cascade,
  player_id uuid,
  nickname text not null,
  area_id text not null,
  area_name text not null,
  qty int not null,
  seats text[] not null default '{}',
  code text not null,
  created_at timestamptz not null default now()
);

create index if not exists orders_room_created_idx on orders (room_code, created_at desc);
create index if not exists players_room_idx on players (room_code);
create index if not exists rooms_featured_idx on rooms (is_featured);

alter table rooms enable row level security;
alter table areas enable row level security;
alter table players enable row level security;
alter table orders enable row level security;

-- Party demo: public read/write with anon key (no real money / personal data)
drop policy if exists rooms_all on rooms;
create policy rooms_all on rooms for all using (true) with check (true);
drop policy if exists areas_all on areas;
create policy areas_all on areas for all using (true) with check (true);
drop policy if exists players_all on players;
create policy players_all on players for all using (true) with check (true);
drop policy if exists orders_all on orders;
create policy orders_all on orders for all using (true) with check (true);

do $$
begin
  begin
    alter publication supabase_realtime add table rooms;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table areas;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table players;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table orders;
  exception when duplicate_object then null;
  end;
end $$;

create or replace function public.ensure_featured_room()
returns rooms
language plpgsql
security definer
as $$
declare
  r rooms;
  host uuid := gen_random_uuid();
begin
  select * into r from rooms where is_featured = true limit 1;
  if found then
    return r;
  end if;

  insert into rooms (
    code, host_id, title, subtitle, venue, date_text,
    sale_at, sale_open, max_per_order, queue_delay_ms, fail_chance, notices, is_featured
  ) values (
    'PARTY0',
    host,
    'PARTY HOUSE 2026 小派對 WORLD TOUR',
    '＜FUN ONLY＞ in LIVING ROOM',
    '你家客廳・派對主舞台',
    '今晚・派對開演',
    now() + interval '365 days',
    false,
    2,
    2200,
    0.12,
    array[
      '本系統為派對娛樂用假搶票，一切票券皆為假的，沒有真實效力。',
      '為避免開賣時「登入逾時」，請於開賣前重新整理頁面確認連線狀態。',
      '每筆訂單限購張數以主辦設定為準。流量控管中請耐心等候。',
      '首頁其他活動皆為裝飾用假頁，僅本場可購票。'
    ],
    true
  ) returning * into r;

  insert into areas (room_code, id, name, price, total, remaining, color) values
    (r.code, 'vip', 'VIP 搖滾區', 5800, 4, 4, '#e11d48'),
    (r.code, 'a', '特 A 區', 4800, 8, 8, '#ea580c'),
    (r.code, 'b', '特 B 區', 3800, 12, 12, '#ca8a04'),
    (r.code, 'c', '二樓座席', 2800, 16, 16, '#16a34a');

  insert into players (id, room_code, nickname, is_host) values (host, r.code, '系統', true);
  return r;
end;
$$;

create or replace function public.claim_featured_host(p_nickname text)
returns jsonb
language plpgsql
security definer
as $$
declare
  r rooms;
  new_host uuid := gen_random_uuid();
  nick text := left(coalesce(nullif(trim(p_nickname), ''), '主辦人'), 20);
begin
  r := public.ensure_featured_room();
  update players set is_host = false where room_code = r.code;
  delete from players where room_code = r.code and nickname = '系統' and is_host = false;
  insert into players (id, room_code, nickname, is_host) values (new_host, r.code, nick, true);
  update rooms set host_id = new_host where code = r.code;
  return jsonb_build_object('hostId', new_host, 'code', r.code);
end;
$$;

create or replace function public.reset_room_stock(p_code text, p_host_id uuid, p_sale_in_sec int default 20)
returns rooms
language plpgsql
security definer
as $$
declare
  r rooms;
begin
  select * into r from rooms where code = upper(p_code);
  if not found then
    raise exception '找不到房間';
  end if;
  if r.host_id <> p_host_id then
    raise exception '只有主辦可以重置';
  end if;

  update areas set remaining = total where room_code = r.code;
  delete from orders where room_code = r.code;
  update rooms
    set sale_open = false,
        sale_at = now() + make_interval(secs => greatest(5, coalesce(p_sale_in_sec, 20)))
    where code = r.code
    returning * into r;
  return r;
end;
$$;

create or replace function public.open_room_sale(p_code text, p_host_id uuid)
returns rooms
language plpgsql
security definer
as $$
declare
  r rooms;
begin
  select * into r from rooms where code = upper(p_code);
  if not found then
    raise exception '找不到房間';
  end if;
  if r.host_id <> p_host_id then
    raise exception '只有主辦可以開賣';
  end if;
  update rooms set sale_open = true, sale_at = now() where code = r.code returning * into r;
  return r;
end;
$$;

create or replace function public.purchase_tickets(
  p_code text,
  p_player_id uuid,
  p_area_id text,
  p_qty int,
  p_nickname text
)
returns jsonb
language plpgsql
security definer
as $$
declare
  r rooms;
  a areas;
  n int;
  nick text := left(coalesce(nullif(trim(p_nickname), ''), '訪客'), 20);
  seat_row text;
  seat_start int;
  seat_list text[] := '{}';
  i int;
  order_code text;
  new_order orders;
begin
  select * into r from rooms where code = upper(p_code) for update;
  if not found then
    raise exception '找不到房間' using errcode = 'P0001';
  end if;

  if not (r.sale_open or r.sale_at <= now()) then
    raise exception '尚未開賣' using errcode = 'P0002';
  end if;

  if random() < r.fail_chance then
    raise exception '目前購票人數過多，系統忙碌中，請重新再試' using errcode = 'P0003';
  end if;

  n := least(r.max_per_order, greatest(1, coalesce(p_qty, 1)));

  select * into a from areas where room_code = r.code and id = p_area_id for update;
  if not found then
    raise exception '票區不存在' using errcode = 'P0004';
  end if;

  if a.remaining < n then
    if a.remaining <= 0 then
      raise exception '該票區已售完' using errcode = 'P0005';
    end if;
    raise exception '剩餘座位不足（剩 %）', a.remaining using errcode = 'P0005';
  end if;

  update areas set remaining = remaining - n where room_code = r.code and id = a.id;

  seat_row := chr(65 + floor(random() * 8)::int);
  seat_start := 1 + floor(random() * 20)::int;
  for i in 0..n-1 loop
    seat_list := array_append(seat_list, seat_row || '排' || (seat_start + i)::text || '號');
  end loop;

  order_code := 'P' || to_char(now(), 'MMDDHH24MISS') || lpad((floor(random()*90)+10)::int::text, 2, '0');

  insert into orders (room_code, player_id, nickname, area_id, area_name, qty, seats, code)
  values (r.code, p_player_id, nick, a.id, a.name, n, seat_list, order_code)
  returning * into new_order;

  update rooms set sale_open = true where code = r.code and sale_open = false;

  return jsonb_build_object(
    'order', jsonb_build_object(
      'id', new_order.id,
      'nickname', new_order.nickname,
      'areaName', new_order.area_name,
      'qty', new_order.qty,
      'seats', new_order.seats,
      'code', new_order.code,
      'createdAt', (extract(epoch from new_order.created_at) * 1000)::bigint
    )
  );
end;
$$;

-- bootstrap featured room
select public.ensure_featured_room();
