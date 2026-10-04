-- Soft-unpublish support: rows that fail the meal standard (or await verification) stay in the
-- table (so discovery dedupe still sees them) but are hidden from every public read.
alter table public.locations
  add column is_published boolean not null default true,
  add column unpublished_reason text,
  add column unpublished_at timestamptz;

alter table public.locations
  add constraint locations_unpublished_reason_check
    check (unpublished_reason is null or unpublished_reason in
      ('fails_meal_standard', 'no_meal_evidence', 'borderline_pending_verification')),
  add constraint locations_unpublished_consistency_check
    check ((is_published and unpublished_reason is null and unpublished_at is null)
        or (not is_published and unpublished_reason is not null and unpublished_at is not null));

create index locations_is_published_idx on public.locations (is_published);

-- Public (anon/authenticated) reads see published rows only; the service role bypasses RLS.
drop policy "Public read access" on public.locations;
create policy "Public read access" on public.locations for select using (is_published = true);
