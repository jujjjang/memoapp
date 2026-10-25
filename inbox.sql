-- 단축어로 바로 걸기: Supabase SQL Editor에 통째로 붙여넣고 Run 하세요. 여러 번 실행해도 괜찮아요.
-- 공유 버튼 한 번으로 행거에 걸 때 쓰는 "나만의 연결 키"를 저장하고,
-- 그 키를 가진 요청만 내 행거에 위시를 하나 걸 수 있게 해요.

create table if not exists public.inbox_keys (
  user_id    uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  key        text not null unique,
  created_at timestamptz not null default now()
);
alter table public.inbox_keys enable row level security;
drop policy if exists "own inbox key" on public.inbox_keys;
create policy "own inbox key" on public.inbox_keys
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
grant select, insert, update, delete on public.inbox_keys to authenticated;

create or replace function public.inbox_add(p_key text, p_doc jsonb)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid;
  new_id text := p_doc->>'id';
begin
  if p_key is null or length(p_key) < 24 or new_id is null or coalesce(p_doc->>'place', '') <> 'wish' then
    raise exception 'bad request';
  end if;
  select k.user_id into uid from public.inbox_keys k where k.key = p_key;
  if uid is null then
    raise exception 'bad key';
  end if;
  insert into public.ideas (user_id, id, doc) values (uid, new_id, p_doc)
  on conflict (user_id, id) do nothing;
  return new_id;
end;
$$;
revoke all on function public.inbox_add(text, jsonb) from public;
grant execute on function public.inbox_add(text, jsonb) to anon, authenticated;
