-- ============================================================================
-- Migration 04 — Côté de l'invité (marié / mariée) + import de la liste d'invités
-- Idempotent : ré-exécutable sans risque, ne modifie aucun invité existant.
-- ============================================================================

-- 1. De quel côté vient l'invité : 'partner1', 'partner2', ou null (non précisé).
--    Les invités déjà présents restent à null : rien ne change pour eux.
alter table guests add column if not exists side text;

alter table guests drop constraint if exists guests_side_check;
alter table guests
  add constraint guests_side_check check (side is null or side in ('partner1', 'partner2'));

-- 2. Import de la liste d'invités dans le foyer le plus ancien.
--    Un prénom déjà présent dans le foyer n'est pas ré-inséré.
insert into guests (household_id, first_name, last_name, type, rsvp)
select h.id, n.first_name, '', 'adult', 'pending'
from (select id from households order by created_at asc limit 1) h
cross join (values
    ('Rafiq (+ mere + hamza + zouina)'),
    ('Rayane'),
    ('Kantra'),
    ('Moussa'),
    ('Peter'),
    ('Oussama'),
    ('Selal'),
    ('Rx'),
    ('Isma'),
    ('B2k'),
    ('Croco'),
    ('Papis'),
    ('Hassan'),
    ('Arold'),
    ('Gaby'),
    ('Titoux'),
    ('Yannick'),
    ('Mdamba'),
    ('Fatou sissoko'),
    ('Larissa'),
    ('Razm'),
    ('Yatte'),
    ('Fnk'),
    ('Sharky'),
    ('Dex'),
    ('Boucher'),
    ('Momox'),
    ('Klx'),
    ('Diamyo'),
    ('Mamadou'),
    ('Hawa'),
    ('Khadja'),
    ('Billaly'),
    ('Ismael'),
    ('Mariame'),
    ('Omar'),
    ('Larra'),
    ('Ma'),
    ('Mamad'),
    ('Fatou'),
    ('Mama'),
    ('Djibi'),
    ('Amy'),
    ('Mariamme'),
    ('Fatima'),
    ('Marole tombe'),
    ('Marole djele'),
    ('Issa'),
    ('Daouda'),
    ('Bilali'),
    ('Mariam'),
    ('Fouley'),
    ('Phili'),
    ('Samba'),
    ('Tacko')
) as n(first_name)
where not exists (
  select 1 from guests g
  where g.household_id = h.id and lower(g.first_name) = lower(n.first_name)
);

select 'migration 04 terminée' as status;
