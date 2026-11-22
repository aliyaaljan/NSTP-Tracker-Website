-- ============================================================
-- Support tickets: facilitator (adviser) → NSTP admin, with threaded replies.
--
-- Kept separate from `appeal` (student requests) on purpose: adviser RPCs
-- (get_adviser_dashboard_data, get_students_stats, get_summary), the adviser
-- request list and the email/push notifications all count every `appeal`
-- row on a student, so admin-bound tickets stored there would surface in
-- adviser views. Admins see student requests through the existing `appeal`
-- table (read-only overview on /admin/tickets).
--
-- Access model matches holiday / calendar_event: reads go through RLS,
-- writes go through the service role in role-checked server actions
-- (lib/tickets/ticket-actions.ts), so there are no insert/update/delete
-- policies.
-- ============================================================
create table if not exists support_ticket (
  ticket_id          uuid primary key default gen_random_uuid(),
  requester_user_id  uuid not null references app_user(app_user_id) on delete cascade,
  subject            text not null check (char_length(btrim(subject)) between 1 and 150),
  category           text not null default 'other'
                       check (category in ('account', 'attendance', 'class', 'forms', 'bug', 'other')),
  status             text not null default 'open'
                       check (status in ('open', 'in_progress', 'resolved', 'closed')),
  -- Bumped on every new message so inboxes can sort by latest activity.
  last_activity_at   timestamptz not null default now(),
  resolved_at        timestamptz,
  resolved_by_user_id uuid references app_user(app_user_id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- The first message holds the ticket's description; replies follow.
create table if not exists support_ticket_message (
  message_id      uuid primary key default gen_random_uuid(),
  ticket_id       uuid not null references support_ticket(ticket_id) on delete cascade,
  sender_user_id  uuid not null references app_user(app_user_id) on delete cascade,
  body            text not null check (char_length(btrim(body)) between 1 and 5000),
  created_at      timestamptz not null default now()
);

create index if not exists support_ticket_requester_idx on support_ticket(requester_user_id);
create index if not exists support_ticket_status_idx    on support_ticket(status);
create index if not exists support_ticket_activity_idx  on support_ticket(last_activity_at desc);
create index if not exists support_ticket_message_ticket_idx
  on support_ticket_message(ticket_id, created_at);

drop trigger if exists set_support_ticket_updated_at on support_ticket;
create trigger set_support_ticket_updated_at before update on support_ticket
  for each row execute procedure moddatetime(updated_at);

alter table support_ticket enable row level security;
alter table support_ticket_message enable row level security;

drop policy if exists support_ticket_read on support_ticket;
create policy support_ticket_read on support_ticket
  for select to authenticated
  using (requester_user_id = (select auth.uid()) or public.app_is_admin());

drop policy if exists support_ticket_message_read on support_ticket_message;
create policy support_ticket_message_read on support_ticket_message
  for select to authenticated
  using (exists (
    select 1 from public.support_ticket t
    where t.ticket_id = support_ticket_message.ticket_id
      and (t.requester_user_id = (select auth.uid()) or public.app_is_admin())
  ));
