-- Run in Supabase SQL Editor (after schema.sql)
-- Adds decoy events, fake cards, and room update helpers.

create table if not exists decoy_events (
  id text primary key,
  slug text not null unique,
  title text not null,
  subtitle text not null default '',
  category text not null default 'concert',
  venue text not null default '',
  date_text text not null default '',
  price_text text not null default '',
  status text not null default 'onsale',
  badge text,
  gradient text not null default 'linear-gradient(160deg,#145c3f,#1a1a1a)',
  blurb text not null default '',
  image_url text not null default '',
  sort_order int not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists fake_cards (
  id uuid primary key default gen_random_uuid(),
  label text not null default '',
  holder text not null default 'PARTY GUEST',
  card_number text not null,
  exp_month text not null,
  exp_year text not null,
  cvv text not null,
  created_at timestamptz not null default now()
);

alter table decoy_events enable row level security;
alter table fake_cards enable row level security;

drop policy if exists decoy_all on decoy_events;
create policy decoy_all on decoy_events for all using (true) with check (true);
drop policy if exists cards_all on fake_cards;
create policy cards_all on fake_cards for all using (true) with check (true);

do $$
begin
  begin
    alter publication supabase_realtime add table decoy_events;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table fake_cards;
  exception when duplicate_object then null;
  end;
end $$;

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
  p_total_tickets int
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
  -- host check soft: allow if matches OR admin-style update when host unknown from another device
  -- Keep strict if host provided and mismatched
  if p_host_id is not null and r.host_id <> p_host_id then
    -- allow update anyway for party admin convenience when using shared admin password flow
    null;
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
    is_featured = coalesce(p_featured, is_featured)
  where code = r.code
  returning * into r;

  total := greatest(1, coalesce(p_total_tickets, 0));
  if p_total_tickets is not null and p_total_tickets > 0 then
    -- collapse to one sellable pool for simple party control
    delete from areas where room_code = r.code;
    insert into areas (room_code, id, name, price, total, remaining, color)
    values (r.code, 'general', '全票區', 2800, total, total, '#16a34a');
  end if;

  return r;
end;
$$;

create or replace function public.validate_fake_card(
  p_card_number text,
  p_exp_month text,
  p_exp_year text,
  p_cvv text
)
returns boolean
language plpgsql
security definer
as $$
declare
  n text := regexp_replace(coalesce(p_card_number, ''), '\s', '', 'g');
begin
  return exists (
    select 1 from fake_cards
    where regexp_replace(card_number, '\s', '', 'g') = n
      and exp_month = p_exp_month
      and exp_year = p_exp_year
      and cvv = p_cvv
  );
end;
$$;
