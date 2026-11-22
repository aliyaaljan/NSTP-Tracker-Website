/**
 * Support tickets — facilitator → NSTP admin (tables `support_ticket`,
 * `support_ticket_message`; migration 0012). Shared by the server actions in
 * `ticket-actions.ts` and the client components.
 */

export type TicketStatus = "open" | "in_progress" | "resolved" | "closed"
export type TicketCategory = "account" | "attendance" | "class" | "forms" | "bug" | "other"

export const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
  open: "Open",
  in_progress: "In Progress",
  resolved: "Resolved",
  closed: "Closed",
}

export const TICKET_CATEGORY_OPTIONS: { value: TicketCategory; label: string }[] = [
  { value: "account", label: "Account / Access" },
  { value: "attendance", label: "Attendance / Hours" },
  { value: "class", label: "Class / Roster" },
  { value: "forms", label: "Forms" },
  { value: "bug", label: "Bug / Technical Issue" },
  { value: "other", label: "Other" },
]

export const TICKET_CATEGORY_LABELS: Record<TicketCategory, string> = Object.fromEntries(
  TICKET_CATEGORY_OPTIONS.map((o) => [o.value, o.label])
) as Record<TicketCategory, string>

export const TICKET_SUBJECT_MAX = 150
export const TICKET_MESSAGE_MAX = 5000

export interface TicketSummary {
  ticketId: string
  subject: string
  category: TicketCategory
  status: TicketStatus
  requesterName: string
  requesterEmail: string
  createdAt: string
  lastActivityAt: string
  messageCount: number
}

export interface TicketMessage {
  messageId: string
  senderName: string
  senderIsAdmin: boolean
  isMine: boolean
  body: string
  createdAt: string
}

export interface TicketDetail extends TicketSummary {
  messages: TicketMessage[]
  /** Admins can set any status; the requester can only close their own ticket. */
  viewerIsAdmin: boolean
}

export interface CreateTicketPayload {
  subject: string
  category: TicketCategory
  body: string
}

export type TicketResult<T = null> = { ok: true; data: T } | { ok: false; error: string }

/** A student request (`appeal`) as the admin's read-only overview shows it. */
export interface AdminStudentRequestRow {
  appealId: string
  title: string
  details: string
  typeName: string
  statusCode: string
  statusName: string
  studentName: string
  studentNumber: string
  classLabel: string
  adviserName: string
  termIsActive: boolean
  requestedTimeIn: string | null
  requestedTimeOut: string | null
  resolutionNote: string | null
  createdAt: string
}

export function validateCreateTicket(payload: CreateTicketPayload): string | null {
  const subject = payload.subject.trim()
  if (!subject) return "Subject is required."
  if (subject.length > TICKET_SUBJECT_MAX) return `Subject must be at most ${TICKET_SUBJECT_MAX} characters.`
  if (!TICKET_CATEGORY_OPTIONS.some((o) => o.value === payload.category)) return "Pick a category."
  return validateTicketMessage(payload.body)
}

export function validateTicketMessage(body: string): string | null {
  const text = body.trim()
  if (!text) return "Message is required."
  if (text.length > TICKET_MESSAGE_MAX) return `Message must be at most ${TICKET_MESSAGE_MAX} characters.`
  return null
}
