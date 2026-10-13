-- =====================================================
-- 018: Sekvenca za brojeve incidenata (INC-YYYY-NNN)
--
-- NALAZ: createIncident() je prethodno računao sljedeći broj incidenta
-- čitajući COUNT(*) iz tabele incidents preko anon klijenta
-- (".select('*', { count: 'exact', head: true })"). Nakon migracije 017,
-- SELECT na incidents je ograničen na authenticated — anon COUNT bi sada
-- uvijek vraćao 0, pa bi svaki anonimni prijavljeni incident dobio broj
-- "INC-<godina>-001" (kolizija/duplikati). Dodatno, i prije 017, brojanje
-- postojećih redova radi generisanja sljedećeg broja ima race-condition
-- (dva istovremena unosa mogu dobiti isti broj).
--
-- RJEŠENJE: sekvenca na nivou baze (atomična, bez race-condition) + mala
-- SECURITY DEFINER funkcija koja vraća formatiran broj. Funkcija ne čita
-- tabelu incidents (samo nextval sekvence), pa joj ne treba SELECT dozvola
-- na incidents - radi i za anon pozivaoca. Sekvenca se ne resetuje po
-- godini (jednostavnije i sigurnije od resetovanja na prvi dan godine);
-- broj je svejedno jedinstven i monoton, što je dovoljno za audit trag.
-- =====================================================

CREATE SEQUENCE IF NOT EXISTS public.incident_number_seq START WITH 1 INCREMENT BY 1;

CREATE OR REPLACE FUNCTION public.next_incident_number()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 'INC-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.incident_number_seq')::text, 3, '0');
$$;

GRANT EXECUTE ON FUNCTION public.next_incident_number() TO anon, authenticated;
