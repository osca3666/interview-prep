begin;

create or replace function private.v1_stable_hash(p_value text)
returns bigint
language plpgsql
stable
strict
set search_path = ''
as $$
declare
  v_hash bigint := 2166136261;
  v_bytes bytea := pg_catalog.convert_to(p_value, 'UTF8');
begin
  for v_index in 0..pg_catalog.length(v_bytes) - 1 loop
    v_hash := ((v_hash # pg_catalog.get_byte(v_bytes, v_index)) * 16777619) % 4294967296;
  end loop;
  return v_hash;
end;
$$;

alter function private.calculate_v1_review_transition(text, integer, integer, timestamptz)
  stable;

revoke all on function private.v1_stable_hash(text) from public, anon, authenticated;

commit;
