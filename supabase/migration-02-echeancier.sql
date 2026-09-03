-- ============================================================================
-- Migration 02 — Échéancier réel, contacts prestataires, réglages du mariage,
-- partage entre les deux mariés, notifications push.
-- Idempotent : peut être ré-exécuté sans risque.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Réglages du mariage (page Paramètres)
-- ----------------------------------------------------------------------------
alter table households add column if not exists partner1_name text;
alter table households add column if not exists partner2_name text;
alter table households add column if not exists budget_target numeric;

-- ----------------------------------------------------------------------------
-- 2. Coordonnées des prestataires
-- ----------------------------------------------------------------------------
alter table vendors add column if not exists contact_name text;
alter table vendors add column if not exists contact_phone text;
alter table vendors add column if not exists contact_email text;

-- Taille des tables sur le plan (agrandir / rétrécir)
alter table wedding_tables add column if not exists scale float not null default 1;

-- ----------------------------------------------------------------------------
-- 3. Échéancier : plusieurs versements datés par prestataire
--    Remplace l'ancien couple (deposit_paid / due_date) qui ne permettait
--    qu'un seul acompte et une seule échéance.
-- ----------------------------------------------------------------------------
create table if not exists vendor_payments (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  vendor_id uuid not null references vendors(id) on delete cascade,
  label text not null default 'Versement',
  amount numeric not null default 0,
  due_date date,
  due_on_wedding_day boolean not null default false,
  paid boolean not null default false,
  paid_at date,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create index if not exists vendor_payments_household_idx on vendor_payments(household_id);
create index if not exists vendor_payments_vendor_idx on vendor_payments(vendor_id);
create index if not exists vendor_payments_due_idx on vendor_payments(due_date) where paid = false;

-- Reprise des données existantes : l'ancien acompte et l'ancien solde
-- deviennent deux lignes d'échéancier (une seule fois).
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_name = 'vendors' and column_name = 'deposit_paid'
  ) and not exists (select 1 from vendor_payments limit 1) then

    insert into vendor_payments (household_id, vendor_id, label, amount, paid, paid_at)
    select household_id, id, 'Acompte', deposit_paid, true, created_at::date
    from vendors where coalesce(deposit_paid, 0) > 0;

    insert into vendor_payments (household_id, vendor_id, label, amount, due_date, due_on_wedding_day, paid)
    select household_id, id, 'Solde',
           greatest(coalesce(total_amount, 0) - coalesce(deposit_paid, 0), 0),
           due_date, coalesce(due_on_wedding_day, false), false
    from vendors where greatest(coalesce(total_amount, 0) - coalesce(deposit_paid, 0), 0) > 0;
  end if;
end $$;

alter table vendors drop column if exists deposit_paid;
alter table vendors drop column if exists due_date;
alter table vendors drop column if exists due_on_wedding_day;

-- ----------------------------------------------------------------------------
-- 4. Abonnements aux notifications push (rappels d'échéance)
-- ----------------------------------------------------------------------------
create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamp with time zone default now()
);

create index if not exists push_subscriptions_household_idx on push_subscriptions(household_id);

-- ----------------------------------------------------------------------------
-- 5. RLS
-- ----------------------------------------------------------------------------
alter table vendor_payments enable row level security;
alter table push_subscriptions enable row level security;

drop policy if exists "vendor_payments: all by member" on vendor_payments;
create policy "vendor_payments: all by member" on vendor_payments
  for all using (is_household_member(household_id))
  with check (is_household_member(household_id));

drop policy if exists "push_subscriptions: all by member" on push_subscriptions;
create policy "push_subscriptions: all by member" on push_subscriptions
  for all using (is_household_member(household_id))
  with check (is_household_member(household_id));

drop trigger if exists vendor_payments_set_updated_at on vendor_payments;
create trigger vendor_payments_set_updated_at before update on vendor_payments
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- 6. Realtime
-- ----------------------------------------------------------------------------
alter table vendor_payments replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'vendor_payments'
  ) then
    alter publication supabase_realtime add table vendor_payments;
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- 7. Partage entre les deux mariés
--    Le second conjoint ouvre le lien d'invitation : sa session anonyme est
--    rattachée au foyer existant. SECURITY DEFINER car il n'est pas encore
--    membre et ne peut donc pas lire households via la policy de select.
-- ----------------------------------------------------------------------------
-- Le type de retour passe de uuid à households : CREATE OR REPLACE ne peut pas
-- le changer, il faut supprimer l'ancienne version d'abord.
drop function if exists join_household_by_code(text, text);

create function join_household_by_code(code text, member_name text default null)
returns households
language plpgsql
security definer
set search_path = public
as $$
declare
  target households;
begin
  select * into target from households where invite_code = lower(trim(code));
  if target.id is null then
    raise exception 'Code d''invitation invalide';
  end if;

  insert into household_members (household_id, user_id, display_name)
  values (target.id, auth.uid(), member_name)
  on conflict (household_id, user_id) do update set display_name = coalesce(excluded.display_name, household_members.display_name);

  -- On quitte l'éventuel foyer vide créé automatiquement pour cette session.
  delete from household_members hm
  where hm.user_id = auth.uid()
    and hm.household_id <> target.id
    and not exists (select 1 from vendors v where v.household_id = hm.household_id)
    and not exists (select 1 from guests g where g.household_id = hm.household_id)
    and not exists (select 1 from wedding_tables t where t.household_id = hm.household_id);

  return target;
end;
$$;

-- Aperçu public d'une invitation (nom du mariage) sans être encore membre.
create or replace function household_preview(code text)
returns table (name text, wedding_date date)
language sql
security definer
set search_path = public
stable
as $$
  select h.name, h.wedding_date from households h where h.invite_code = lower(trim(code));
$$;

select 'migration 02 terminée' as status;
