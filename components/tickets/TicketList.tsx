"use client"

import { useMemo, useState } from "react"
import {
  TICKET_CATEGORY_LABELS,
  TICKET_STATUS_LABELS,
  type TicketStatus,
  type TicketSummary,
} from "@/lib/tickets/ticket-types"
import TicketStatusBadge from "@/components/tickets/TicketStatusBadge"
import { formatTicketDate } from "@/components/tickets/TicketThreadModal"
import { ticketFieldStyle } from "@/components/tickets/TicketModalShell"

type StatusFilter = "active" | "all" | TicketStatus

/** Searchable, filterable ticket table. `showRequester` adds a "From" column (admin inbox). */
export default function TicketList({
  tickets,
  onOpen,
  showRequester,
  emptyMessage,
}: {
  tickets: TicketSummary[]
  onOpen: (ticketId: string) => void
  showRequester?: boolean
  emptyMessage: string
}) {
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active")

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return tickets.filter((t) => {
      if (statusFilter === "active" && (t.status === "resolved" || t.status === "closed")) return false
      if (statusFilter !== "active" && statusFilter !== "all" && t.status !== statusFilter) return false
      if (!q) return true
      return (
        t.subject.toLowerCase().includes(q) ||
        t.requesterName.toLowerCase().includes(q) ||
        t.requesterEmail.toLowerCase().includes(q) ||
        TICKET_CATEGORY_LABELS[t.category].toLowerCase().includes(q)
      )
    })
  }, [tickets, search, statusFilter])

  const thStyle: React.CSSProperties = {
    textAlign: "left",
    fontSize: 12,
    fontWeight: 700,
    color: "#6B7280",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    padding: "10px 12px",
    borderBottom: "1px solid #E5E7EB",
    whiteSpace: "nowrap",
  }
  const tdStyle: React.CSSProperties = {
    fontSize: 14,
    color: "#2C2C2A",
    padding: "12px",
    borderBottom: "1px solid #F3F4F6",
    verticalAlign: "middle",
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={showRequester ? "Search subject, facilitator, category…" : "Search subject or category…"}
          aria-label="Search tickets"
          style={{ ...ticketFieldStyle, flex: "1 1 240px", width: "auto" }}
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          aria-label="Filter by status"
          style={{ ...ticketFieldStyle, width: "auto", cursor: "pointer" }}
        >
          <option value="active">Open &amp; In Progress</option>
          <option value="all">All statuses</option>
          {(Object.keys(TICKET_STATUS_LABELS) as TicketStatus[]).map((s) => (
            <option key={s} value={s}>
              {TICKET_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <p style={{ margin: 0, padding: "28px 0", textAlign: "center", color: "#6B7280", fontSize: 14 }}>
          {tickets.length === 0 ? emptyMessage : "No tickets match your filters."}
        </p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 560 }}>
            <thead>
              <tr>
                <th style={thStyle}>Subject</th>
                {showRequester && <th style={thStyle}>From</th>}
                <th style={thStyle}>Category</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Last Activity</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <tr
                  key={t.ticketId}
                  onClick={() => onOpen(t.ticketId)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault()
                      onOpen(t.ticketId)
                    }
                  }}
                  tabIndex={0}
                  style={{ cursor: "pointer" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#F9FAFB")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <td style={{ ...tdStyle, fontWeight: 600 }}>
                    {t.subject}
                    <div style={{ fontSize: 12, fontWeight: 400, color: "#9CA3AF", marginTop: 2 }}>
                      {t.messageCount} message{t.messageCount === 1 ? "" : "s"}
                    </div>
                  </td>
                  {showRequester && <td style={tdStyle}>{t.requesterName}</td>}
                  <td style={tdStyle}>{TICKET_CATEGORY_LABELS[t.category]}</td>
                  <td style={tdStyle}>
                    <TicketStatusBadge status={t.status} />
                  </td>
                  <td style={{ ...tdStyle, whiteSpace: "nowrap", color: "#6B7280" }}>
                    {formatTicketDate(t.lastActivityAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
