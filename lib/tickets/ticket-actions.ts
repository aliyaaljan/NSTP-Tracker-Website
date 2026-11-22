"use server"

import { getAppUserRole } from "@/lib/auth-actions"
import { createSupabaseServerClient } from "@/lib/supabase/server-client"
import { createSupabaseServiceClient } from "@/lib/supabase/service-client"
import { formatClassLabel } from "@/lib/shared/class-label"
import {
  validateCreateTicket,
  validateTicketMessage,
  type AdminStudentRequestRow,
  type CreateTicketPayload,
  type TicketCategory,
  type TicketDetail,
  type TicketResult,
  type TicketStatus,
  type TicketSummary,
} from "@/lib/tickets/ticket-types"

const MISSING_TABLE_CODES = new Set(["42P01", "PGRST205"])
const MISSING_TABLE_ERROR =
  "Tickets aren't set up yet — run migration 0012_support_ticket.sql on the database."

type Caller = { userId: string; role: string }

async function getCaller(): Promise<Caller | null> {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  const role = await getAppUserRole()
  if (!role) return null
  return { userId: user.id, role }
}

function tableError(context: string, error: { code?: string; message?: string }): string {
  console.error(`[tickets] ${context}`, error)
  if (error.code && MISSING_TABLE_CODES.has(error.code)) return MISSING_TABLE_ERROR
  return `Failed to ${context}.`
}

const SUMMARY_SELECT = `
  ticket_id, subject, category, status, created_at, last_activity_at,
  requester:requester_user_id (full_name, email),
  support_ticket_message (count)
`

type SummaryDbRow = {
  ticket_id: string
  subject: string
  category: TicketCategory
  status: TicketStatus
  created_at: string
  last_activity_at: string
  requester: { full_name: string | null; email: string | null } | null
  support_ticket_message: { count: number }[] | null
}

function mapSummary(row: SummaryDbRow): TicketSummary {
  return {
    ticketId: row.ticket_id,
    subject: row.subject,
    category: row.category,
    status: row.status,
    requesterName: row.requester?.full_name || "Unknown",
    requesterEmail: row.requester?.email || "",
    createdAt: row.created_at,
    lastActivityAt: row.last_activity_at,
    messageCount: row.support_ticket_message?.[0]?.count ?? 0,
  }
}

/** Tickets the caller opened (facilitator view). */
export async function getMyTickets(): Promise<TicketResult<TicketSummary[]>> {
  const caller = await getCaller()
  if (!caller) return { ok: false, error: "Not signed in." }

  const service = createSupabaseServiceClient()
  const { data, error } = await service
    .from("support_ticket")
    .select(SUMMARY_SELECT)
    .eq("requester_user_id", caller.userId)
    .order("last_activity_at", { ascending: false })

  if (error) return { ok: false, error: tableError("load your tickets", error) }
  return { ok: true, data: ((data ?? []) as unknown as SummaryDbRow[]).map(mapSummary) }
}

/** Every ticket (admin inbox). */
export async function getAllTickets(): Promise<TicketResult<TicketSummary[]>> {
  const caller = await getCaller()
  if (!caller || caller.role !== "admin") return { ok: false, error: "Unauthorized." }

  const service = createSupabaseServiceClient()
  const { data, error } = await service
    .from("support_ticket")
    .select(SUMMARY_SELECT)
    .order("last_activity_at", { ascending: false })
    .limit(1000)

  if (error) return { ok: false, error: tableError("load tickets", error) }
  return { ok: true, data: ((data ?? []) as unknown as SummaryDbRow[]).map(mapSummary) }
}

/** Loads a ticket the caller may see: their own, or any ticket if they're an admin. */
async function loadAccessibleTicket(caller: Caller, ticketId: string) {
  const service = createSupabaseServiceClient()
  const { data, error } = await service
    .from("support_ticket")
    .select("ticket_id, requester_user_id, status")
    .eq("ticket_id", ticketId)
    .maybeSingle()
  if (error) return { error: tableError("load the ticket", error) } as const
  if (!data) return { error: "Ticket not found." } as const
  const isAdmin = caller.role === "admin"
  const isRequester = data.requester_user_id === caller.userId
  if (!isAdmin && !isRequester) return { error: "Ticket not found." } as const
  return { ticket: data as { ticket_id: string; requester_user_id: string; status: TicketStatus }, isAdmin, isRequester, service } as const
}

export async function getTicket(ticketId: string): Promise<TicketResult<TicketDetail>> {
  const caller = await getCaller()
  if (!caller) return { ok: false, error: "Not signed in." }

  const access = await loadAccessibleTicket(caller, ticketId)
  if ("error" in access) return { ok: false, error: access.error as string }

  const [ticketRes, messagesRes] = await Promise.all([
    access.service.from("support_ticket").select(SUMMARY_SELECT).eq("ticket_id", ticketId).single(),
    access.service
      .from("support_ticket_message")
      .select("message_id, sender_user_id, body, created_at, sender:sender_user_id (full_name, role:role_id (code))")
      .eq("ticket_id", ticketId)
      .order("created_at", { ascending: true }),
  ])

  if (ticketRes.error) return { ok: false, error: tableError("load the ticket", ticketRes.error) }
  if (messagesRes.error) return { ok: false, error: tableError("load messages", messagesRes.error) }

  type MessageDbRow = {
    message_id: string
    sender_user_id: string
    body: string
    created_at: string
    sender: { full_name: string | null; role: { code: string } | null } | null
  }

  const requesterId = access.ticket.requester_user_id
  const messages = ((messagesRes.data ?? []) as unknown as MessageDbRow[]).map((m) => ({
    messageId: m.message_id,
    senderName: m.sender?.full_name || "Unknown",
    // The requester's own messages never count as "admin" (an admin acting as facilitator).
    senderIsAdmin: m.sender_user_id !== requesterId && m.sender?.role?.code === "admin",
    isMine: m.sender_user_id === caller.userId,
    body: m.body,
    createdAt: m.created_at,
  }))

  return {
    ok: true,
    data: {
      ...mapSummary(ticketRes.data as unknown as SummaryDbRow),
      messages,
      viewerIsAdmin: access.isAdmin,
    },
  }
}

/** Facilitators (and admins acting as facilitators) open a ticket to the NSTP admin. */
export async function createTicket(payload: CreateTicketPayload): Promise<TicketResult<{ ticketId: string }>> {
  const caller = await getCaller()
  if (!caller || (caller.role !== "adviser" && caller.role !== "admin")) {
    return { ok: false, error: "Only facilitators can open tickets." }
  }

  const validationError = validateCreateTicket(payload)
  if (validationError) return { ok: false, error: validationError }

  const service = createSupabaseServiceClient()
  const { data, error } = await service
    .from("support_ticket")
    .insert({
      requester_user_id: caller.userId,
      subject: payload.subject.trim(),
      category: payload.category,
    })
    .select("ticket_id")
    .single()

  if (error || !data) return { ok: false, error: tableError("create the ticket", error ?? {}) }

  const { error: messageError } = await service.from("support_ticket_message").insert({
    ticket_id: data.ticket_id,
    sender_user_id: caller.userId,
    body: payload.body.trim(),
  })

  if (messageError) {
    // Don't leave a ticket with no description behind.
    await service.from("support_ticket").delete().eq("ticket_id", data.ticket_id)
    return { ok: false, error: tableError("create the ticket", messageError) }
  }

  return { ok: true, data: { ticketId: data.ticket_id } }
}

export async function replyToTicket(ticketId: string, body: string): Promise<TicketResult> {
  const caller = await getCaller()
  if (!caller) return { ok: false, error: "Not signed in." }

  const validationError = validateTicketMessage(body)
  if (validationError) return { ok: false, error: validationError }

  const access = await loadAccessibleTicket(caller, ticketId)
  if ("error" in access) return { ok: false, error: access.error as string }

  if (access.ticket.status === "closed") {
    return { ok: false, error: "This ticket is closed. Open a new ticket instead." }
  }

  const { error } = await access.service.from("support_ticket_message").insert({
    ticket_id: ticketId,
    sender_user_id: caller.userId,
    body: body.trim(),
  })
  if (error) return { ok: false, error: tableError("send your reply", error) }

  // An admin reply moves an open ticket to "in progress"; a requester reply on a
  // resolved ticket reopens it.
  let nextStatus: TicketStatus = access.ticket.status
  if (access.isAdmin && !access.isRequester && access.ticket.status === "open") nextStatus = "in_progress"
  if (access.isRequester && access.ticket.status === "resolved") nextStatus = "open"

  await access.service
    .from("support_ticket")
    .update({
      last_activity_at: new Date().toISOString(),
      status: nextStatus,
      ...(nextStatus !== "resolved" ? { resolved_at: null, resolved_by_user_id: null } : {}),
    })
    .eq("ticket_id", ticketId)

  return { ok: true, data: null }
}

export async function setTicketStatus(ticketId: string, status: TicketStatus): Promise<TicketResult> {
  const caller = await getCaller()
  if (!caller) return { ok: false, error: "Not signed in." }
  if (!["open", "in_progress", "resolved", "closed"].includes(status)) {
    return { ok: false, error: "Invalid status." }
  }

  const access = await loadAccessibleTicket(caller, ticketId)
  if ("error" in access) return { ok: false, error: access.error as string }

  // Requesters may only close their own ticket; everything else is the admin's call.
  if (!access.isAdmin && status !== "closed") {
    return { ok: false, error: "Only the NSTP admin can change this ticket's status." }
  }

  const { error } = await access.service
    .from("support_ticket")
    .update({
      status,
      last_activity_at: new Date().toISOString(),
      resolved_at: status === "resolved" ? new Date().toISOString() : null,
      resolved_by_user_id: status === "resolved" ? caller.userId : null,
    })
    .eq("ticket_id", ticketId)

  if (error) return { ok: false, error: tableError("update the ticket", error) }
  return { ok: true, data: null }
}

/** Every student request (`appeal`) across all classes — read-only admin overview. */
export async function getAllStudentRequests(): Promise<TicketResult<AdminStudentRequestRow[]>> {
  const caller = await getCaller()
  if (!caller || caller.role !== "admin") return { ok: false, error: "Unauthorized." }

  const service = createSupabaseServiceClient()
  const { data, error } = await service
    .from("appeal")
    .select(
      `
        appeal_id, title, details, resolution_note, requested_time_in, requested_time_out, created_at,
        appeal_status:appeal_status_id (code, name),
        appeal_type:appeal_type_id (name),
        enrollment:enrollment_id (
          app_user:student_user_id (full_name, student_number),
          section:section_id (
            course_code,
            adviser:adviser_user_id (full_name),
            term:term_id (school_year, is_active)
          )
        )
      `
    )
    .order("created_at", { ascending: false })
    .limit(2000)

  if (error) {
    console.error("[tickets] load student requests", error)
    return { ok: false, error: "Failed to load student requests." }
  }

  type AppealDbRow = {
    appeal_id: string
    title: string | null
    details: string | null
    resolution_note: string | null
    requested_time_in: string | null
    requested_time_out: string | null
    created_at: string
    appeal_status: { code: string; name: string } | null
    appeal_type: { name: string } | null
    enrollment: {
      app_user: { full_name: string | null; student_number: string | null } | null
      section: {
        course_code: string | null
        adviser: { full_name: string | null } | null
        term: { school_year: string | null; is_active: boolean } | null
      } | null
    } | null
  }

  const rows = ((data ?? []) as unknown as AppealDbRow[]).map((a) => {
    const section = a.enrollment?.section
    const adviserName = section?.adviser?.full_name || "—"
    return {
      appealId: a.appeal_id,
      title: a.title || "Request",
      details: a.details || "",
      typeName: a.appeal_type?.name || "Others",
      statusCode: a.appeal_status?.code || "pending",
      statusName: a.appeal_status?.name || "Pending Review",
      studentName: a.enrollment?.app_user?.full_name || "Unknown Student",
      studentNumber: a.enrollment?.app_user?.student_number || "—",
      classLabel: section
        ? formatClassLabel({
            courseCode: section.course_code,
            facilitatorName: section.adviser?.full_name,
            schoolYear: section.term?.school_year,
          })
        : "—",
      adviserName,
      termIsActive: Boolean(section?.term?.is_active),
      requestedTimeIn: a.requested_time_in,
      requestedTimeOut: a.requested_time_out,
      resolutionNote: a.resolution_note,
      createdAt: a.created_at,
    }
  })

  return { ok: true, data: rows }
}
