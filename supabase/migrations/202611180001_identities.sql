-- À exécuter avant la mise en ligne de la version 0.4.0. Ne supprime aucune donnée.
begin;
create or replace function public.upa_save_state(p_data jsonb, p_expected_revision bigint, p_schema_version integer, p_owner uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_current bigint; v_next bigint;
begin
  if p_owner is distinct from auth.uid() then raise exception 'Compte différent'; end if;
  -- This lock also serializes the start of account deletion.
  perform 1 from public.user_accounts where user_id=auth.uid() and not deletion_pending for update;
  if not found or not public.upa_account_active() then raise exception 'Compte indisponible'; end if;
  if p_schema_version not in (4,5) or p_schema_version is null or jsonb_typeof(p_data) <> 'object'
    or jsonb_typeof(p_data->'actions') is distinct from 'array'
    or jsonb_typeof(p_data->'stones') is distinct from 'array'
    or p_expected_revision is null or p_expected_revision < 0 then raise exception 'Format invalide'; end if;
  if octet_length(p_data::text) > 10485760 then raise exception 'Données trop volumineuses (10 Mio hors images)'; end if;
  select revision into v_current from public.user_app_state where user_id=auth.uid();
  if coalesce(v_current,0) <> p_expected_revision then return jsonb_build_object('ok',false,'revision',coalesce(v_current,0)); end if;
  if exists(select 1 from public.user_app_state where user_id=auth.uid() and schema_version > p_schema_version) then raise exception 'Mets à jour Pas à Pas avant de synchroniser'; end if;
  if (p_data->>'schemaVersion')::integer is distinct from p_schema_version then raise exception 'Version incohérente'; end if;
  if p_schema_version=5 and (jsonb_typeof(p_data->'pillars') is distinct from 'array' or jsonb_typeof(p_data->'steps') is distinct from 'array') then raise exception 'Structure incomplète'; end if;
  v_next := coalesce(v_current,0)+1;
  insert into public.user_app_state(user_id,schema_version,data,revision) values(auth.uid(),p_schema_version,p_data,v_next)
    on conflict(user_id) do update set data=excluded.data,schema_version=excluded.schema_version,revision=excluded.revision,updated_at=now();
  return jsonb_build_object('ok',true,'revision',v_next);
end;
$$;
revoke all on function public.upa_save_state(jsonb,bigint,integer,uuid) from public, anon;
grant execute on function public.upa_save_state(jsonb,bigint,integer,uuid) to authenticated;

commit;
