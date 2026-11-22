import { TICKET_STATUS_LABELS, type TicketStatus } from "@/lib/tickets/ticket-types"

const STATUS_STYLES: Record<TicketStatus, { bg: string; fg: string }> = {
  open: { bg: "#FEF3C7", fg: "#92400E" },
  in_progress: { bg: "#DBEAFE", fg: "#1E40AF" },
  resolved: { bg: "#DCFCE7", fg: "#14532D" },
  closed: { bg: "#E5E7EB", fg: "#374151" },
}

export default function TicketStatusBadge({ status }: { status: TicketStatus }) {
  const s = STATUS_STYLES[status]
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 700,
        background: s.bg,
        color: s.fg,
        whiteSpace: "nowrap",
      }}
    >
      {TICKET_STATUS_LABELS[status]}
    </span>
  )
}

/** Same pill look for student-request (appeal) status codes. */
export function RequestStatusBadge({ code, name }: { code: string; name: string }) {
  const map: Record<string, TicketStatus> = {
    pending: "open",
    open: "open",
    under_review: "in_progress",
    approved: "resolved",
    rejected: "closed",
    canceled: "closed",
    withdrawn: "closed",
  }
  const s = STATUS_STYLES[map[code] ?? "open"]
  const rejected = code === "rejected"
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 700,
        background: rejected ? "#FEE2E2" : s.bg,
        color: rejected ? "#991B1B" : s.fg,
        whiteSpace: "nowrap",
      }}
    >
      {name}
    </span>
  )
}
