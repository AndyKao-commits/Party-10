-- Run after schema-v4.sql. Admin order cancellation and sale-history clearing.
begin;

create or replace function public.cancel_ticket_order(p_order_id uuid, p_host_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.orders;
  r public.rooms;
  released int := 0;
begin
  select * into o from public.orders where id = p_order_id for update;
  if o.id is null then raise exception '找不到訂單'; end if;

  select * into r from public.rooms where code = o.room_code for update;
  if p_host_id is null or r.host_id is distinct from p_host_id then
    raise exception '只有主辦可以取消訂單';
  end if;

  -- New orders match by label. Migrated legacy orders may not, so fall back
  -- to the same number of sold real seats in the original area.
  update ticket_private.seats
  set sold = false
  where id in (
    select id
    from ticket_private.seats
    where room_code = o.room_code
      and area_id = o.area_id
      and is_real
      and sold
    order by (label = any(o.seats)) desc, position
    limit o.qty
  );
  get diagnostics released = row_count;

  update public.areas
  set remaining = least(real_seats, remaining + released)
  where room_code = o.room_code and id = o.area_id;

  delete from public.orders where id = o.id;
end;
$$;

create or replace function public.clear_ticket_orders(p_code text, p_host_id uuid)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.rooms;
  removed int;
begin
  select * into r from public.rooms where code = upper(p_code) for update;
  if r.code is null then raise exception '找不到活動'; end if;
  if p_host_id is null or r.host_id is distinct from p_host_id then
    raise exception '只有主辦可以清除購票紀錄';
  end if;

  select count(*) into removed from public.orders where room_code = r.code;
  update ticket_private.seats set sold = false where room_code = r.code and is_real;
  update public.areas set remaining = real_seats where room_code = r.code;
  delete from public.orders where room_code = r.code;
  return removed;
end;
$$;

revoke all on function public.cancel_ticket_order(uuid,uuid) from public, anon, authenticated;
revoke all on function public.clear_ticket_orders(text,uuid) from public, anon, authenticated;
grant execute on function public.cancel_ticket_order(uuid,uuid) to anon, authenticated;
grant execute on function public.clear_ticket_orders(text,uuid) to anon, authenticated;

commit;
