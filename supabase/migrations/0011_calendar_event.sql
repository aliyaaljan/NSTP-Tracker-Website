-- ============================================================
-- Calendar events / reminders (e.g. "Basic First Aid Training").
--
-- Admin-managed, per term, visible on every student's and adviser's
-- calendar. Same access model as `holiday`: any authenticated user can read;
-- writes go through the service role in admin-guarded server actions
-- (lib/admin/settings-actions.ts), so there are no insert/update/delete
-- policies here.
-- ============================================================
create table if not exists calendar_event (
  event_id     uuid primary key default gen_random_uuid(),
  term_id      uuid not null references term(term_id) on delete cascade,
  title        text not null check (char_length(btrim(title)) between 1 and 120),
  event_date   date not null,
  start_time   time,
  end_time     time,
  location     text check (location is null or char_length(location) <= 200),
  description  text check (description is null or char_length(description) <= 1000),
  created_by   uuid references app_user(app_user_id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  check (end_time is null or start_time is null or end_time >= start_time)
);

create index if not exists calendar_event_term_idx on calendar_event(term_id);
create index if not exists calendar_event_date_idx on calendar_event(event_date);

drop trigger if exists set_calendar_event_updated_at on calendar_event;
create trigger set_calendar_event_updated_at before update on calendar_event
  for each row execute procedure moddatetime(updated_at);

alter table calendar_event enable row level security;

drop policy if exists calendar_event_read on calendar_event;
create policy calendar_event_read on calendar_event
  for select to authenticated using (true);
