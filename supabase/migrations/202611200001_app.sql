create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 name text not null default '', settings jsonb not null default '{}', created_at timestamptz not null default now()
);
create table public.jobs (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 payload jsonb not null default '{}', created_at timestamptz not null default now()
);
create index jobs_user_created on public.jobs(user_id,created_at desc);
create or replace function public.is_clippfy_admin() returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from auth.users where id = auth.uid() and lower(email) = 'ritam73592@gmail.com' and email_confirmed_at is not null)
$$;
revoke all on function public.is_clippfy_admin() from public;
grant execute on function public.is_clippfy_admin() to authenticated;
alter table public.profiles enable row level security;
alter table public.jobs enable row level security;
create policy profiles_read on public.profiles for select to authenticated using (id = auth.uid() or public.is_clippfy_admin());
create policy profiles_insert on public.profiles for insert to authenticated with check(id = auth.uid());
create policy profiles_update on public.profiles for update to authenticated using(id = auth.uid()) with check(id = auth.uid());
create policy jobs_read on public.jobs for select to authenticated using(user_id = auth.uid() or public.is_clippfy_admin());
create policy jobs_insert on public.jobs for insert to authenticated with check(user_id = auth.uid());
create policy jobs_update on public.jobs for update to authenticated using(user_id = auth.uid()) with check(user_id = auth.uid());
create policy jobs_delete on public.jobs for delete to authenticated using(user_id = auth.uid());
grant select,insert,update on public.profiles to authenticated;
grant select,insert,update,delete on public.jobs to authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values ('videos','videos',false,52428800,array['video/mp4','video/webm','video/quicktime','video/x-matroska','application/octet-stream','image/jpeg']) on conflict(id) do nothing;
create policy videos_read on storage.objects for select to authenticated using(bucket_id = 'videos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy videos_insert on storage.objects for insert to authenticated with check(bucket_id = 'videos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy videos_update on storage.objects for update to authenticated using(bucket_id = 'videos' and (storage.foldername(name))[1] = auth.uid()::text) with check(bucket_id = 'videos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy videos_delete on storage.objects for delete to authenticated using(bucket_id = 'videos' and (storage.foldername(name))[1] = auth.uid()::text);
