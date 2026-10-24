-- 아이디어 방: Supabase SQL Editor에 통째로 붙여넣고 Run 하세요.
-- 메모, 서랍 칸 이름, 사진 저장소를 만들고 "로그인한 본인만 읽고 쓰기" 규칙을 켭니다.
-- 여러 번 실행해도 괜찮아요.

-- 1) 메모
create table if not exists public.ideas (
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id         text not null,
  doc        jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);
alter table public.ideas enable row level security;
drop policy if exists "own ideas" on public.ideas;
create policy "own ideas" on public.ideas
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
grant select, insert, update, delete on public.ideas to authenticated;

-- 2) 서랍 칸 이름
create table if not exists public.settings (
  user_id      uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  drawer_names jsonb not null default '{}'::jsonb,
  updated_at   timestamptz not null default now()
);
alter table public.settings enable row level security;
drop policy if exists "own settings" on public.settings;
create policy "own settings" on public.settings
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
grant select, insert, update, delete on public.settings to authenticated;

-- 3) 사진 (비공개 버킷, 사진은 <내 사용자 id>/파일이름.jpg 로 저장)
insert into storage.buckets (id, name, public)
values ('photos', 'photos', false)
on conflict (id) do nothing;

drop policy if exists "own photos read" on storage.objects;
create policy "own photos read" on storage.objects
  for select to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "own photos add" on storage.objects;
create policy "own photos add" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "own photos remove" on storage.objects;
create policy "own photos remove" on storage.objects
  for delete to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
