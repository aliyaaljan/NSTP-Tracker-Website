"use client"

import { useCallback, useMemo, useState } from "react"
import AdminProfilePill from "@/components/admin/AdminProfilePill"
import TicketList from "@/components/tickets/TicketList"
import TicketThreadModal, { formatTicketDate } from "@/components/tickets/TicketThreadModal"
import TicketModalShell, { ticketFieldStyle } from "@/components/tickets/TicketModalShell"
import { RequestStatusBadge } from "@/components/tickets/TicketStatusBadge"
import { getAllTickets } from "@/lib/tickets/ticket-actions"
import type { AdminStudentRequestRow, TicketSummary } from "@/lib/tickets/ticket-types"
import type { AdminCurrentUser } from "@/lib/admin/settings"
import { PAGE_TITLE, TYPE } from "@/lib/admin-typography"
import { ADMIN_COLORS as COLORS } from "@/lib/admin-theme"

type Tab = "tickets" | "requests"

const OPEN_REQUEST_CODES = new Set(["pending", "open", "under_review"])

export default function AdminTicketsClient({
  initialTickets,
  ticketsError,
  requests,
  requestsError,
  currentUser,
}: {
  initialTickets: TicketSummary[]
  ticketsError: string | null
  requests: AdminStudentRequestRow[]
  requestsError: string | null
  currentUser: AdminCurrentUser
}) {
  const [tab, setTab] = useState<Tab>("tickets")
  const [tickets, setTickets] = useState(initialTickets)
  const [openTicketId, setOpenTicketId] = useState<string | null>(null)
  const [openRequest, setOpenRequest] = useState<AdminStudentRequestRow | null>(null)

  const refreshTickets = useCallback(async () => {
    const res = await getAllTickets()
    if (res.ok) setTickets(res.data)
  }, [])

  const openTicketCount = tickets.filter((t) => t.status === "open" || t.status === "in_progress").length
  const openRequestCount = requests.filter((r) => OPEN_REQUEST_CODES.has(r.statusCode)).length

  const tabButton = (value: Tab, label: string, count: number) => (
    <button
      type="button"
      role="tab"
      aria-selected={tab === value}
      onClick={() => setTab(value)}
      style={{
        ...TYPE.bodyBold,
        fontFamily: "inherit",
        background: "none",
        border: "none",
        borderBottom: `3px solid ${tab === value ? COLORS.maroon : "transparent"}`,
        color: tab === value ? COLORS.maroon : COLORS.textGray,
        padding: "10px 4px",
        marginRight: 20,
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      {label}
      {count > 0 && (
        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            background: tab === value ? COLORS.maroon : "#E5E7EB",
            color: tab === value ? "#fff" : "#374151",
            borderRadius: 999,
            padding: "1px 8px",
          }}
        >
          {count}
        </span>
      )}
    </button>
  )

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 16,
          marginBottom: 20,
        }}
      >
        <div>
          <h1 style={{ ...PAGE_TITLE, color: COLORS.maroon, margin: 0 }}>Tickets</h1>
          <p style={{ ...TYPE.caption, color: COLORS.textGray, margin: "6px 0 0" }}>
            Tickets facilitators send to the admin, plus every student request sent to facilitators
          </p>
        </div>
        <AdminProfilePill user={currentUser} />
      </div>

      <div
        style={{
          background: COLORS.cardBg,
          border: `1px solid ${COLORS.border}`,
          borderRadius: COLORS.radius,
          boxShadow: COLORS.cardShadow,
          padding: "8px 20px 20px",
        }}
      >
        <div role="tablist" style={{ borderBottom: `1px solid ${COLORS.border}`, marginBottom: 16 }}>
          {tabButton("tickets", "Facilitator Tickets", openTicketCount)}
          {tabButton("requests", "Student Requests", openRequestCount)}
        </div>

        {tab === "tickets" ? (
          ticketsError ? (
            <p style={{ color: "#991B1B", margin: 0 }}>{ticketsError}</p>
          ) : (
            <TicketList
              tickets={tickets}
              onOpen={setOpenTicketId}
              showRequester
              emptyMessage="No tickets yet. Facilitators can send one from their Tickets page."
            />
          )
        ) : requestsError ? (
          <p style={{ color: "#991B1B", margin: 0 }}>{requestsError}</p>
        ) : (
          <StudentRequestTable requests={requests} onOpen={setOpenRequest} />
        )}
      </div>

      {openTicketId && (
        <TicketThreadModal
          ticketId={openTicketId}
          onClose={() => setOpenTicketId(null)}
          onChanged={refreshTickets}
        />
      )}

      {openRequest && <StudentRequestModal request={openRequest} onClose={() => setOpenRequest(null)} />}
    </div>
  )
}

function StudentRequestTable({
  requests,
  onOpen,
}: {
  requests: AdminStudentRequestRow[]
  onOpen: (r: AdminStudentRequestRow) => void
}) {
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("open")
  const [termFilter, setTermFilter] = useState<"active" | "all">("active")

  const statusOptions = useMemo(() => {
    const seen = new Map<string, string>()
    for (const r of requests) seen.set(r.statusCode, r.statusName)
    return [...seen.entries()]
  }, [requests])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return requests.filter((r) => {
      if (termFilter === "active" && !r.termIsActive) return false
      if (statusFilter === "open" && !OPEN_REQUEST_CODES.has(r.statusCode)) return false
      if (statusFilter !== "open" && statusFilter !== "all" && r.statusCode !== statusFilter) return false
      if (!q) return true
      return [r.studentName, r.studentNumber, r.adviserName, r.classLabel, r.title, r.typeName]
        .join(" ")
        .toLowerCase()
        .includes(q)
    })
  }, [requests, search, statusFilter, termFilter])

  const th: React.CSSProperties = {
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
  const td: React.CSSProperties = {
    fontSize: 14,
    color: "#2C2C2A",
    padding: "12px",
    borderBottom: "1px solid #F3F4F6",
    verticalAlign: "middle",
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <p style={{ ...TYPE.caption, color: COLORS.textGray, margin: 0 }}>
        Read-only. The student&apos;s facilitator approves or rejects these from My Students.
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search student, facilitator, class, type…"
          aria-label="Search student requests"
          style={{ ...ticketFieldStyle, flex: "1 1 240px", width: "auto" }}
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label="Filter by status"
          style={{ ...ticketFieldStyle, width: "auto", cursor: "pointer" }}
        >
          <option value="open">Pending &amp; Under Review</option>
          <option value="all">All statuses</option>
          {statusOptions.map(([code, name]) => (
            <option key={code} value={code}>
              {name}
            </option>
          ))}
        </select>
        <select
          value={termFilter}
          onChange={(e) => setTermFilter(e.target.value as "active" | "all")}
          aria-label="Filter by term"
          style={{ ...ticketFieldStyle, width: "auto", cursor: "pointer" }}
        >
          <option value="active">Active term</option>
          <option value="all">All terms</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <p style={{ margin: 0, padding: "28px 0", textAlign: "center", color: "#6B7280", fontSize: 14 }}>
          {requests.length === 0 ? "No student requests yet." : "No requests match your filters."}
        </p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 720 }}>
            <thead>
              <tr>
                <th style={th}>Student</th>
                <th style={th}>Request</th>
                <th style={th}>Facilitator</th>
                <th style={th}>Status</th>
                <th style={th}>Submitted</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr
                  key={r.appealId}
                  onClick={() => onOpen(r)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault()
                      onOpen(r)
                    }
                  }}
                  tabIndex={0}
                  style={{ cursor: "pointer" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#F9FAFB")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <td style={{ ...td, fontWeight: 600 }}>
                    {r.studentName}
                    <div style={{ fontSize: 12, fontWeight: 400, color: "#9CA3AF", marginTop: 2 }}>
                      {r.studentNumber}
                    </div>
                  </td>
                  <td style={td}>
                    {r.typeName}
                    <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 2 }}>{r.title}</div>
                  </td>
                  <td style={td}>
                    {r.adviserName}
                    <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 2 }}>{r.classLabel}</div>
                  </td>
                  <td style={td}>
                    <RequestStatusBadge code={r.statusCode} name={r.statusName} />
                  </td>
                  <td style={{ ...td, whiteSpace: "nowrap", color: "#6B7280" }}>
                    {formatTicketDate(r.createdAt)}
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

function StudentRequestModal({ request: r, onClose }: { request: AdminStudentRequestRow; onClose: () => void }) {
  const row = (label: string, value: React.ReactNode) => (
    <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: 12, fontSize: 14 }}>
      <div style={{ fontWeight: 700, color: "#6B7280" }}>{label}</div>
      <div style={{ color: "#2C2C2A", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{value}</div>
    </div>
  )
  return (
    <TicketModalShell title={`${r.typeName} — ${r.studentName}`} onClose={onClose} maxWidth={600}>
      <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12, overflowY: "auto" }}>
        {row("Status", <RequestStatusBadge code={r.statusCode} name={r.statusName} />)}
        {row("Student", `${r.studentName} (${r.studentNumber})`)}
        {row("Class", r.classLabel)}
        {row("Facilitator", r.adviserName)}
        {row("Submitted", formatTicketDate(r.createdAt))}
        {row("Title", r.title)}
        {r.details && row("Details", r.details)}
        {r.requestedTimeIn && row("Requested time in", formatTicketDate(r.requestedTimeIn))}
        {r.requestedTimeOut && row("Requested time out", formatTicketDate(r.requestedTimeOut))}
        {r.resolutionNote && row("Facilitator note", r.resolutionNote)}
      </div>
    </TicketModalShell>
  )
}
