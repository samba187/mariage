-- ============================================================================
-- Migration 03 — Redimensionnement des tables, nettoyage, et rappels d'échéance
-- sans clé service_role : le cron appelle des fonctions SECURITY DEFINER
-- protégées par un secret partagé.
-- Idempotent : ré-exécutable sans risque.
-- ============================================================================

-- 1. Taille des tables sur le plan de salle
alter table wedding_tables add column if not exists scale float not null default 1;

-- 2. Colonne devenue inutile (régimes alimentaires retirés de l'application)
alter table guests drop column if exists diet;

-- ----------------------------------------------------------------------------
-- 3. Secret partagé du cron.
-- RLS activée sans aucune policy : la table est totalement inaccessible via
-- l'API REST (anon comme authenticated). Seules les fonctions SECURITY DEFINER
-- ci-dessous peuvent la lire.
-- ----------------------------------------------------------------------------
create table if not exists app_secrets (
  key text primary key,
  value text not null
);

alter table app_secrets enable row level security;

insert into app_secrets (key, value)
values ('cron_secret', '1355597706f407040ecf5056c9bb783121e9e157f3720871')
on conflict (key) do update set value = excluded.value;

create or replace function assert_cron_secret(secret text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if secret is null or secret is distinct from (select value from app_secrets where key = 'cron_secret') then
    raise exception 'unauthorized';
  end if;
end;
$$;

-- ----------------------------------------------------------------------------
-- 4. Échéances à rappeler.
-- Renvoie une ligne par couple (versement dû, abonnement push du foyer).
-- « Jour du mariage » est résolu ici avec households.wedding_date.
-- ----------------------------------------------------------------------------
create or replace function due_payment_reminders(secret text, day_offsets int[])
returns table (
  payment_id uuid,
  vendor_name text,
  payment_label text,
  amount numeric,
  due_on date,
  days_left int,
  endpoint text,
  p256dh text,
  auth_key text
)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  perform assert_cron_secret(secret);

  return query
  select
    p.id,
    v.name,
    p.label,
    p.amount,
    d.due_on,
    (d.due_on - current_date)::int,
    s.endpoint,
    s.p256dh,
    s.auth
  from vendor_payments p
  join vendors v on v.id = p.vendor_id
  join households h on h.id = p.household_id
  cross join lateral (
    select case when p.due_on_wedding_day then h.wedding_date else p.due_date end as due_on
  ) d
  join push_subscriptions s on s.household_id = p.household_id
  where p.paid = false
    and d.due_on is not null
    and (d.due_on - current_date)::int = any(day_offsets);
end;
$$;

-- ----------------------------------------------------------------------------
-- 5. Suppression d'un abonnement push devenu invalide (410/404 côté navigateur)
-- ----------------------------------------------------------------------------
create or replace function prune_push_subscription(secret text, target_endpoint text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform assert_cron_secret(secret);
  delete from push_subscriptions where endpoint = target_endpoint;
end;
$$;

-- Ces fonctions sont appelables par le rôle anonyme mais refusent tout appel
-- sans le bon secret.
grant execute on function due_payment_reminders(text, int[]) to anon, authenticated;
grant execute on function prune_push_subscription(text, text) to anon, authenticated;
revoke execute on function assert_cron_secret(text) from anon, authenticated;

select 'migration 03 terminée' as status;
