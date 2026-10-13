-- =====================================================
-- 022 - FTO patrola ograde bez logina (anon-safe)
-- =====================================================
-- Za razliku od MING periodičnih pregleda (authenticated, migracija 021),
-- dnevna FTO patrola ograde (PRG.03.02, 3.2.3.3) u papirnom procesu NEMA
-- login - službenik obezbjeđenja se ne loguje na dashboard, samo ide na
-- teren 2-4x dnevno. Isti obrazac kao GSE checkout/checkin: anon poziv
-- ide ISKLJUČIVO kroz SECURITY DEFINER funkciju koja sama radi upis
-- (bypass RLS interno), a direktan anon INSERT na tabele ostaje zabranjen
-- (iz migracije 021) - nema nove rupe, samo kontrolisan prolaz.

create or replace function public.fn_create_fence_patrol(
  p_patroller_name text,
  p_patroller_card_id text default null,
  p_shift text default null,
  p_findings jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inspection_id uuid;
  v_findings_count int := jsonb_array_length(coalesce(p_findings, '[]'::jsonb));
  v_critical_count int := 0;
  v_status text := 'COMPLETED';
  item jsonb;
begin
  if p_patroller_name is null or trim(p_patroller_name) = '' then
    return jsonb_build_object('ok', false, 'error', 'Ime patrolera je obavezno');
  end if;

  if v_findings_count > 0 then
    v_status := 'WITH_FINDINGS';
  end if;

  insert into public.aerodrome_inspections
    (inspection_type, inspection_date, performed_by, performed_by_card_id, shift, status, findings_count, critical_count)
  values
    ('FENCE', now(), trim(p_patroller_name), nullif(trim(coalesce(p_patroller_card_id, '')), ''), p_shift, v_status, v_findings_count, 0)
  returning id into v_inspection_id;

  if v_findings_count > 0 then
    for item in select * from jsonb_array_elements(p_findings)
    loop
      insert into public.inspection_findings
        (inspection_id, category, severity, description, location_code, fence_stub_from, fence_stub_to, is_marked)
      values (
        v_inspection_id,
        coalesce(item->>'category', 'OTHER'),
        coalesce(item->>'severity', 'MEDIUM'),
        coalesce(item->>'description', ''),
        item->>'locationCode',
        nullif(item->>'fenceStubFrom', '')::int,
        nullif(item->>'fenceStubTo', '')::int,
        coalesce((item->>'isMarked')::boolean, false)
      );
    end loop;
  end if;

  return jsonb_build_object('ok', true, 'id', v_inspection_id, 'findingsCount', v_findings_count);
end;
$$;

grant execute on function public.fn_create_fence_patrol(text, text, text, jsonb) to anon, authenticated;
