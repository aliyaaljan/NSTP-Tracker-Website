import type { SupabaseClient } from "@supabase/supabase-js"
import { formatEventTimeRange } from "@/lib/admin/settings"

/** An admin-created calendar event / reminder, as the student and adviser calendars show it. */
export interface PublishedCalendarEvent {
  eventId: string
  title: string
  /** ISO date YYYY-MM-DD */
  date: string
  /** "8:00 AM – 12:00 PM", "8:00 AM", or "" for all-day */
  timeLabel: string
  location: string | null
  description: string | null
}

/**
 * Events for the active term (table `calendar_event`, readable by any signed-in user).
 * Returns [] on any error — e.g. migration 0011 not applied yet — so calendars still render.
 */
export async function fetchActiveTermEvents(
  supabase: SupabaseClient
): Promise<PublishedCalendarEvent[]> {
  const { data, error } = await supabase
    .from("calendar_event")
    .select(
      "event_id, title, event_date, start_time, end_time, location, description, term!inner(is_active)"
    )
    .eq("term.is_active", true)
    .order("event_date", { ascending: true })
    .order("start_time", { ascending: true, nullsFirst: true })

  if (error) {
    console.error("Failed to load calendar events:", error)
    return []
  }

  return (data ?? []).map((row) => ({
    eventId: row.event_id as string,
    title: row.title as string,
    date: row.event_date as string,
    timeLabel: formatEventTimeRange(
      row.start_time ? String(row.start_time).slice(0, 5) : null,
      row.end_time ? String(row.end_time).slice(0, 5) : null
    ),
    location: (row.location as string | null) ?? null,
    description: (row.description as string | null) ?? null,
  }))
}

/** "8:00 AM – 12:00 PM · UP Baguio Gym" — time and place on one line. */
export function eventSubtitle(event: PublishedCalendarEvent): string {
  return [event.timeLabel || "All day", event.location].filter(Boolean).join(" · ")
}
