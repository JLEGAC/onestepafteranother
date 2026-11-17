-- Pas à Pas. Run once in the Supabase SQL editor (or supabase db push).
create table if not exists public.user_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  deletion_pending boolean not null default false,
  created_at timestamptz not null default now()
);
create table if not exists public.user_app_state (
  user_id uuid primary key references public.user_accounts(user_id) on delete cascade,
  schema_version integer not null default 4,
  data jsonb not null,
  revision bigint not null default 1 check (revision > 0),
  updated_at timestamptz not null default now()
);
alter table public.user_accounts enable row level security;
alter table public.user_app_state enable row level security;
revoke all on public.user_accounts, public.user_app_state from anon, authenticated;
grant select on public.user_accounts, public.user_app_state to authenticated;

create or replace function public.upa_account_active() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.user_accounts a join auth.users u on u.id=a.user_id
    where a.user_id=auth.uid() and not a.deletion_pending);
$$;
revoke all on function public.upa_account_active() from public, anon;
grant execute on function public.upa_account_active() to authenticated;
create policy "account_owner_read" on public.user_accounts for select to authenticated using (user_id=(select auth.uid()));
create policy "state_owner_read" on public.user_app_state for select to authenticated
  using (user_id=(select auth.uid()) and (select public.upa_account_active()));

create or replace function public.upa_ensure_account() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not exists(select 1 from auth.users where id=auth.uid()) then
    raise exception 'Compte supprimé ou session invalide';
  end if;
  insert into public.user_accounts(user_id) values(auth.uid()) on conflict do nothing;
  if not public.upa_account_active() then raise exception 'Suppression de compte en cours'; end if;
end;
$$;
revoke all on function public.upa_ensure_account() from public, anon;
grant execute on function public.upa_ensure_account() to authenticated;

-- Compare-and-swap. Never use a plain upsert for synchronized snapshots.
create or replace function public.upa_save_state(p_data jsonb, p_expected_revision bigint, p_schema_version integer, p_owner uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_current bigint; v_next bigint;
begin
  if p_owner is distinct from auth.uid() then raise exception 'Compte différent'; end if;
  -- This lock also serializes the start of account deletion.
  perform 1 from public.user_accounts where user_id=auth.uid() and not deletion_pending for update;
  if not found or not public.upa_account_active() then raise exception 'Compte indisponible'; end if;
  if p_schema_version <> 4 or jsonb_typeof(p_data) <> 'object'
    or jsonb_typeof(p_data->'actions') is distinct from 'array'
    or jsonb_typeof(p_data->'stones') is distinct from 'array'
    or p_expected_revision is null or p_expected_revision < 0 then raise exception 'Format invalide'; end if;
  if octet_length(p_data::text) > 10485760 then raise exception 'Données trop volumineuses (10 Mio hors images)'; end if;
  select revision into v_current from public.user_app_state where user_id=auth.uid();
  if coalesce(v_current,0) <> p_expected_revision then return jsonb_build_object('ok',false,'revision',coalesce(v_current,0)); end if;
  v_next := coalesce(v_current,0)+1;
  insert into public.user_app_state(user_id,schema_version,data,revision) values(auth.uid(),p_schema_version,p_data,v_next)
    on conflict(user_id) do update set data=excluded.data,schema_version=excluded.schema_version,revision=excluded.revision,updated_at=now();
  return jsonb_build_object('ok',true,'revision',v_next);
end;
$$;
revoke all on function public.upa_save_state(jsonb,bigint,integer,uuid) from public, anon;
grant execute on function public.upa_save_state(jsonb,bigint,integer,uuid) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('vision-images','vision-images',false,5242880,array['image/jpeg','image/png','image/webp']) on conflict(id) do nothing;
create policy "vision_owner_select" on storage.objects for select to authenticated
  using(bucket_id='vision-images' and (storage.foldername(name))[1]=(select auth.uid())::text and (select public.upa_account_active()));
create policy "vision_owner_insert" on storage.objects for insert to authenticated
  with check(bucket_id='vision-images' and (storage.foldername(name))[1]=(select auth.uid())::text and (select public.upa_account_active()));
-- Immutable content-addressed images: no update permission is needed.
create policy "vision_owner_delete" on storage.objects for delete to authenticated
  using(bucket_id='vision-images' and (storage.foldername(name))[1]=(select auth.uid())::text and (select public.upa_account_active()));
