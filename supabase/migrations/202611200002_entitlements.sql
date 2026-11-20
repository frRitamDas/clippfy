create table public.clippfy_access (
 user_id uuid primary key references auth.users(id) on delete cascade,
 plan text not null check(plan in ('free','starter','clipper','pro')),
 expires_at timestamptz, updated_at timestamptz not null default now()
);
alter table public.clippfy_access enable row level security;
create policy access_read on public.clippfy_access for select to authenticated using(user_id=auth.uid() or public.is_clippfy_admin());
grant select on public.clippfy_access to authenticated;
create table public.clippfy_access_audit (
 id bigint generated always as identity primary key, actor uuid not null, target uuid not null,
 plan text not null, expires_at timestamptz, created_at timestamptz not null default now()
);
alter table public.clippfy_access_audit enable row level security;
create policy audit_read on public.clippfy_access_audit for select to authenticated using(public.is_clippfy_admin());
grant select on public.clippfy_access_audit to authenticated;
create function public.clippfy_set_access(target_email text, target_plan text, valid_until timestamptz default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare target_id uuid;
begin
 if not public.is_clippfy_admin() then raise exception 'Administrator access required' using errcode='42501'; end if;
 if target_plan is null or target_plan not in ('free','starter','clipper','pro') then raise exception 'Invalid plan'; end if;
 if valid_until is not null and valid_until<=now() then raise exception 'Expiry must be in the future'; end if;
 select id into target_id from auth.users where lower(email)=lower(trim(target_email)) and email_confirmed_at is not null;
 if target_id is null then raise exception 'Verified user not found. Ask them to sign up and verify first.'; end if;
 insert into public.clippfy_access(user_id,plan,expires_at) values(target_id,target_plan,valid_until)
 on conflict(user_id) do update set plan=excluded.plan,expires_at=excluded.expires_at,updated_at=now();
 insert into public.clippfy_access_audit(actor,target,plan,expires_at) values(auth.uid(),target_id,target_plan,valid_until);
 return jsonb_build_object('userId',target_id,'plan',target_plan,'expiresAt',valid_until);
end $$;
revoke all on function public.clippfy_set_access(text,text,timestamptz) from public;
grant execute on function public.clippfy_set_access(text,text,timestamptz) to authenticated;
-- Supabase projects may have permissive default object privileges. Harden explicitly.
revoke all on public.clippfy_access, public.clippfy_access_audit from public, anon, authenticated;
grant select on public.clippfy_access, public.clippfy_access_audit to authenticated;
revoke all on function public.clippfy_set_access(text,text,timestamptz) from public, anon, authenticated;
grant execute on function public.clippfy_set_access(text,text,timestamptz) to authenticated;
