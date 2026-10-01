-- Run in Supabase SQL Editor after schema-v2.sql
-- Live event poster support + seed YAWASABI featured show.

alter table rooms add column if not exists image_url text not null default '';

create or replace function public.update_room_event(
  p_code text,
  p_host_id uuid,
  p_title text,
  p_subtitle text,
  p_venue text,
  p_date_text text,
  p_sale_at timestamptz,
  p_max_per_order int,
  p_fail_chance double precision,
  p_featured boolean,
  p_total_tickets int,
  p_image_url text default null
)
returns rooms
language plpgsql
security definer
as $$
declare
  r rooms;
  total int;
begin
  select * into r from rooms where code = upper(p_code);
  if not found then
    raise exception '找不到房間';
  end if;

  if p_featured then
    update rooms set is_featured = false where is_featured = true and code <> r.code;
  end if;

  update rooms set
    title = left(coalesce(p_title, title), 80),
    subtitle = left(coalesce(p_subtitle, subtitle), 80),
    venue = left(coalesce(p_venue, venue), 80),
    date_text = left(coalesce(p_date_text, date_text), 80),
    sale_at = coalesce(p_sale_at, sale_at),
    sale_open = case when coalesce(p_sale_at, sale_at) > now() then false else sale_open end,
    max_per_order = least(4, greatest(1, coalesce(p_max_per_order, max_per_order))),
    fail_chance = least(0.6, greatest(0, coalesce(p_fail_chance, fail_chance))),
    is_featured = coalesce(p_featured, is_featured),
    image_url = coalesce(p_image_url, image_url)
  where code = r.code
  returning * into r;

  if p_total_tickets is not null and p_total_tickets > 0 then
    total := greatest(1, p_total_tickets);
    delete from areas where room_code = r.code;
    insert into areas (room_code, id, name, price, total, remaining, color)
    values (r.code, 'general', '全票區', 3800, total, total, '#e11d48');
  end if;

  return r;
end;
$$;

-- Upsert the main rush event as YAWASABI SUPER PLANET (featured)
do $$
declare
  host uuid;
  sale timestamptz := timestamptz '2026-10-10 10:00:00+08';
begin
  select host_id into host from rooms where code = 'PARTY0';
  if host is null then
    host := gen_random_uuid();
  end if;

  update rooms set is_featured = false where is_featured = true and code <> 'PARTY0';

  insert into rooms (
    code, host_id, title, subtitle, venue, date_text,
    sale_at, sale_open, max_per_order, queue_delay_ms, fail_chance, notices, is_featured, image_url
  ) values (
    'PARTY0',
    host,
    'YAWASABI 「SUPER PLANET」 in TAIPEI',
    '10-city Dome & Stadium Tour 2026-2027',
    'TAIPEI DOME 台北大巨蛋',
    '2026/10/10（六）～10/11（日）',
    sale,
    false,
    2,
    2200,
    0.15,
    array[
      '本系統為派對娛樂用假搶票，一切票券皆為假的，沒有真實效力。',
      '為避免開賣時「登入逾時」，請於開賣前重新整理頁面確認連線狀態。',
      '每筆訂單限購張數以主辦設定為準。流量控管中請耐心等候。'
    ],
    true,
    '/events/yawasabi-super-planet.jpg'
  )
  on conflict (code) do update set
    title = excluded.title,
    subtitle = excluded.subtitle,
    venue = excluded.venue,
    date_text = excluded.date_text,
    sale_at = excluded.sale_at,
    sale_open = false,
    max_per_order = excluded.max_per_order,
    fail_chance = excluded.fail_chance,
    is_featured = true,
    image_url = excluded.image_url;

  delete from areas where room_code = 'PARTY0';
  insert into areas (room_code, id, name, price, total, remaining, color) values
    ('PARTY0', 'vip', 'VIP 搖滾區', 6800, 6, 6, '#e11d48'),
    ('PARTY0', 'a', '特 A 區', 4800, 10, 10, '#ea580c'),
    ('PARTY0', 'b', '特 B 區', 3800, 14, 14, '#ca8a04'),
    ('PARTY0', 'c', '二樓座席', 2800, 20, 20, '#16a34a');
end $$;
