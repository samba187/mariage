-- ============================================================================
-- Wedding Planner — schéma complet (installation neuve)
-- À exécuter dans l'éditeur SQL Supabase : SQL Editor > New query.
-- Pour une base déjà créée avec une version antérieure, utiliser plutôt
-- migration-02-echeancier.sql.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- Foyers : un foyer = un couple. Les deux conjoints le partagent via le lien
-- d'invitation ; toutes les données sont cloisonnées par household_id + RLS.
-- ----------------------------------------------------------------------------
create table households (
  id uuid primary key default gen_random_uuid(),
  name text,
  wedding_date date,
  partner1_name text,
  partner2_name text,
  budget_target numeric,
  invite_code text not null unique default substr(replace(gen_random_uuid()::text, '-', ''), 1, 8),
  room_shape text check (room_shape in ('rectangle', 'square', 'free')) default 'rectangle',
  room_width float default 1000,
  room_height float default 700,
  landmarks jsonb not null default '[]'::jsonb, -- [{id, type, label, pos_x, pos_y, w, h, rotation}]
  created_at timestamp with time zone default now()
);

create table household_members (
  household_id uuid not null references households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamp with time zone default now(),
  primary key (household_id, user_id)
);

-- ----------------------------------------------------------------------------
-- Prestataires
-- ----------------------------------------------------------------------------
create table vendors (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  name text not null,
  category text not null,
  total_amount numeric not null default 0,
  contact_name text,
  contact_phone text,
  contact_email text,
  notes text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- ----------------------------------------------------------------------------
-- Échéancier : plusieurs versements datés par prestataire.
-- due_on_wedding_day = l'échéance tombe le jour du mariage ; la date réelle
-- est alors households.wedding_date.
-- ----------------------------------------------------------------------------
create table vendor_payments (
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

-- ----------------------------------------------------------------------------
-- Plan de salle
-- ----------------------------------------------------------------------------
create table wedding_tables (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  name text not null,
  type text check (type in ('round', 'rectangular')) not null default 'round',
  capacity integer not null default 8,
  pos_x float not null default 0,
  pos_y float not null default 0,
  rotation float not null default 0,
  scale float not null default 1,
  created_at timestamp with time zone default now()
);

-- ----------------------------------------------------------------------------
-- Invités
-- ----------------------------------------------------------------------------
create table guests (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  type text check (type in ('adult', 'child', 'baby')) not null default 'adult',
  rsvp text check (rsvp in ('pending', 'confirmed', 'declined')) not null default 'pending',
  group_tag text,
  table_id uuid references wedding_tables(id) on delete set null,
  seat_index integer,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- ----------------------------------------------------------------------------
-- Notifications push (rappels d'échéance)
-- ----------------------------------------------------------------------------
create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamp with time zone default now()
);

create index guests_household_idx on guests(household_id);
create index guests_table_idx on guests(table_id);
create index vendors_household_idx on vendors(household_id);
create index vendor_payments_household_idx on vendor_payments(household_id);
create index vendor_payments_vendor_idx on vendor_payments(vendor_id);
create index vendor_payments_due_idx on vendor_payments(due_date) where paid = false;
create index wedding_tables_household_idx on wedding_tables(household_id);
create index push_subscriptions_household_idx on push_subscriptions(household_id);

-- ----------------------------------------------------------------------------
-- Row Level Security : un utilisateur ne voit que les données des foyers
-- dont il est membre.
-- ----------------------------------------------------------------------------
alter table households enable row level security;
alter table household_members enable row level security;
alter table vendors enable row level security;
alter table vendor_payments enable row level security;
alter table wedding_tables enable row level security;
alter table guests enable row level security;
alter table push_subscriptions enable row level security;

create or replace function is_household_member(hid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from household_members
    where household_id = hid and user_id = auth.uid()
  );
$$;

create policy "households: select own" on households
  for select using (is_household_member(id));
create policy "households: insert authenticated" on households
  for insert with check (auth.uid() is not null);
create policy "households: update by member" on households
  for update using (is_household_member(id));

create policy "members: select own household" on household_members
  for select using (is_household_member(household_id));
create policy "members: insert self" on household_members
  for insert with check (user_id = auth.uid());
create policy "members: delete self" on household_members
  for delete using (user_id = auth.uid());

create policy "vendors: all by member" on vendors
  for all using (is_household_member(household_id))
  with check (is_household_member(household_id));

create policy "vendor_payments: all by member" on vendor_payments
  for all using (is_household_member(household_id))
  with check (is_household_member(household_id));

create policy "tables: all by member" on wedding_tables
  for all using (is_household_member(household_id))
  with check (is_household_member(household_id));

create policy "guests: all by member" on guests
  for all using (is_household_member(household_id))
  with check (is_household_member(household_id));

create policy "push_subscriptions: all by member" on push_subscriptions
  for all using (is_household_member(household_id))
  with check (is_household_member(household_id));

-- ----------------------------------------------------------------------------
-- updated_at automatique
-- ----------------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger vendors_set_updated_at before update on vendors
  for each row execute function set_updated_at();
create trigger vendor_payments_set_updated_at before update on vendor_payments
  for each row execute function set_updated_at();
create trigger guests_set_updated_at before update on guests
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- Realtime. REPLICA IDENTITY FULL est nécessaire pour que les évènements
-- UPDATE/DELETE portent la ligne complète (dont household_id) : sans ça,
-- Supabase ne peut pas évaluer la policy RLS et n'envoie pas l'évènement.
-- ----------------------------------------------------------------------------
alter table vendors replica identity full;
alter table vendor_payments replica identity full;
alter table wedding_tables replica identity full;
alter table guests replica identity full;
alter table households replica identity full;

alter publication supabase_realtime add table vendors;
alter publication supabase_realtime add table vendor_payments;
alter publication supabase_realtime add table wedding_tables;
alter publication supabase_realtime add table guests;
alter publication supabase_realtime add table households;

-- ----------------------------------------------------------------------------
-- Création d'un foyer + rattachement de l'utilisateur, en une opération.
-- SECURITY DEFINER : sinon la policy de select (« être déjà membre ») empêche
-- de relire la ligne tout juste insérée.
-- ----------------------------------------------------------------------------
create or replace function create_household()
returns households
language plpgsql
security definer
set search_path = public
as $$
declare
  new_household households;
begin
  insert into households default values returning * into new_household;
  insert into household_members (household_id, user_id) values (new_household.id, auth.uid());
  return new_household;
end;
$$;

-- ----------------------------------------------------------------------------
-- Partage : le second conjoint rejoint le foyer via le lien d'invitation.
-- ----------------------------------------------------------------------------
create or replace function join_household_by_code(code text, member_name text default null)
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

-- Aperçu d'une invitation (nom, date) avant d'être membre.
create or replace function household_preview(code text)
returns table (name text, wedding_date date)
language sql
security definer
set search_path = public
stable
as $$
  select h.name, h.wedding_date from households h where h.invite_code = lower(trim(code));
$$;
