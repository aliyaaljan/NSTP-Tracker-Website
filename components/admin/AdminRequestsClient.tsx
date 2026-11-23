"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import AdminProfilePill from "@/components/admin/AdminProfilePill"
import {
  adminDecideStudentRequest,
  type AdminStudentRequestRow,
} from "@/lib/admin/student-requests-actions"
import { formatHm } from "@/lib/admin/student-request-plan"
import type { AdminCurrentUser } from "@/lib/admin/settings"
import { PAGE_TITLE, TYPE } from "@/lib/admin-typography"
import { ADMIN_COLORS as COLORS } from "@/lib/admin-theme"

const OPEN_REQUEST_CODES = new Set(["pending", "open", "under_review"])

const fieldStyle: React.CSSProperties = {
  boxSizing: "border-box",
  fontSize: 14,
  fontFamily: "inherit",
  color: "#2C2C2A",
  background: "#F3F4F6",
  border: "1.5px solid transparent",
  borderRadius: 8,
  padding: "10px 12px",
  outline: "none",
}

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

function StatusBadge({ code, name }: { code: string; name: string }) {
  const palette: Record<string, { bg: string; fg: string }> = {
    pending: { bg: "#FEF3C7", fg: "#92400E" },
    open: { bg: "#FEF3C7", fg: "#92400E" },
    under_review: { bg: "#DBEAFE", fg: "#1E40AF" },
    approved: { bg: "#DCFCE7", fg: "#14532D" },
    rejected: { bg: "#FEE2E2", fg: "#991B1B" },
  }
  const s = palette[code] ?? { bg: "#E5E7EB", fg: "#374151" }
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
      {name}
    </span>
  )
}

export default function AdminRequestsClient({
  requests,
  error,
  currentUser,
}: {
  requests: AdminStudentRequestRow[]
  error: string | null
  currentUser: AdminCurrentUser
}) {
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("open")
  const [termFilter, setTermFilter] = useState<"active" | "all">("active")
  const [selected, setSelected] = useState<AdminStudentRequestRow | null>(null)

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

  const openCount = requests.filter((r) => r.termIsActive && OPEN_REQUEST_CODES.has(r.statusCode)).length

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
          <h1 style={{ ...PAGE_TITLE, color: COLORS.maroon, margin: 0 }}>Student Requests</h1>
          <p style={{ ...TYPE.caption, color: COLORS.textGray, margin: "6px 0 0" }}>
            Every request students send to their facilitators · {openCount} pending this term
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
          padding: 20,
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <p style={{ ...TYPE.caption, color: COLORS.textGray, margin: 0 }}>
          Click a request to approve or reject it. The student&apos;s facilitator can also decide it from My Students.
        </p>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search student, facilitator, class, type…"
            aria-label="Search student requests"
            style={{ ...fieldStyle, flex: "1 1 240px" }}
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Filter by status"
            style={{ ...fieldStyle, cursor: "pointer" }}
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
            style={{ ...fieldStyle, cursor: "pointer" }}
          >
            <option value="active">Active term</option>
            <option value="all">All terms</option>
          </select>
        </div>

        {error ? (
          <p style={{ margin: 0, color: "#991B1B" }}>{error}</p>
        ) : filtered.length === 0 ? (
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
                    onClick={() => setSelected(r)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault()
                        setSelected(r)
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
                      <StatusBadge code={r.statusCode} name={r.statusName} />
                    </td>
                    <td style={{ ...td, whiteSpace: "nowrap", color: "#6B7280" }}>
                      {formatDateTime(r.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected && <RequestDetailModal request={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}

function RequestDetailModal({ request: r, onClose }: { request: AdminStudentRequestRow; onClose: () => void }) {
  const router = useRouter()
  const [note, setNote] = useState("")
  const [clearFlag, setClearFlag] = useState(false)
  const [decideError, setDecideError] = useState<string | null>(null)
  const [pendingDecision, setPendingDecision] = useState<"approved" | "rejected" | null>(null)
  const [isPending, startTransition] = useTransition()

  function decide(decision: "approved" | "rejected") {
    const verb = decision === "approved" ? "Approve" : "Reject"
    if (!window.confirm(`${verb} this request from ${r.studentName}? The student will be notified.`)) return
    setDecideError(null)
    setPendingDecision(decision)
    startTransition(async () => {
      const res = await adminDecideStudentRequest(r.appealId, decision, note, { clearFlag })
      if (!res.ok) {
        setDecideError(res.error)
        setPendingDecision(null)
        return
      }
      router.refresh()
      onClose()
    })
  }

  const plan = r.plan
  const showTimes = plan.kind === "add" || plan.kind === "edit" || plan.kind === "restore"

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isPending) onClose()
    }
    document.body.style.overflow = "hidden"
    window.addEventListener("keydown", onKeyDown)
    return () => {
      document.body.style.overflow = ""
      window.removeEventListener("keydown", onKeyDown)
    }
  }, [onClose, isPending])

  const row = (label: string, value: React.ReactNode) => (
    <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: 12, fontSize: 14 }}>
      <div style={{ fontWeight: 700, color: "#6B7280" }}>{label}</div>
      <div style={{ color: "#2C2C2A", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{value}</div>
    </div>
  )

  return (
    <div
      role="presentation"
      onClick={() => !isPending && onClose()}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        background: "rgba(44, 44, 42, 0.35)",
        backdropFilter: "blur(4px)",
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="request-detail-title"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 600,
          maxHeight: "calc(100vh - 32px)",
          display: "flex",
          flexDirection: "column",
          borderRadius: 16,
          overflow: "hidden",
          background: "#fff",
          boxShadow: "0 20px 50px rgba(0,0,0,0.18)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            padding: "16px 20px",
            background: "#14492E",
            color: "#fff",
            flexShrink: 0,
          }}
        >
          <h2 id="request-detail-title" style={{ ...TYPE.h2, color: "#fff", margin: 0 }}>
            {r.typeName} — {r.studentName}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            aria-label="Close"
            style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", padding: 4, display: "flex" }}
          >
            <i className="ti ti-x" style={{ fontSize: 20 }} />
          </button>
        </div>
        <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12, overflowY: "auto" }}>
          {row("Status", <StatusBadge code={r.statusCode} name={r.statusName} />)}
          {row("Student", `${r.studentName} (${r.studentNumber})`)}
          {row("Class", r.classLabel)}
          {row("Facilitator", r.adviserName)}
          {row("Submitted", formatDateTime(r.createdAt))}
          {row("Title", r.title)}
          {r.details && row("Details", r.details)}
          {r.requestedTimeIn && row("Requested time in", formatDateTime(r.requestedTimeIn))}
          {r.requestedTimeOut && row("Requested time out", formatDateTime(r.requestedTimeOut))}
          {r.resolutionNote && row("Resolution note", r.resolutionNote)}
        </div>

        {r.canDecide && (
          <div
            style={{
              borderTop: "1px solid #E5E7EB",
              padding: "14px 20px 18px",
              display: "flex",
              flexDirection: "column",
              gap: 10,
              flexShrink: 0,
            }}
          >
            <div
              style={{
                fontSize: 13,
                color: "#14492E",
                background: "#ECFDF3",
                border: "1px solid #BBF7D0",
                borderRadius: 8,
                padding: "8px 12px",
              }}
            >
              <strong>If approved:</strong> {plan.summary}
              {showTimes && (
                <div style={{ marginTop: 4 }}>
                  {plan.date || "—"} · {formatHm(plan.timeIn) || "—"} – {formatHm(plan.timeOut) || "—"}
                </div>
              )}
            </div>

            {plan.kind === "flag" && (
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#2C2C2A" }}>
                <input
                  type="checkbox"
                  checked={clearFlag}
                  onChange={(e) => setClearFlag(e.target.checked)}
                  disabled={isPending}
                />
                Also clear the flag on this session
              </label>
            )}

            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={1000}
              rows={2}
              placeholder="Note to the student (optional)"
              aria-label="Note to the student"
              disabled={isPending}
              style={{ ...fieldStyle, width: "100%", resize: "vertical" }}
            />

            {decideError && <p style={{ margin: 0, fontSize: 13, color: "#991B1B" }}>{decideError}</p>}

            <div style={{ display: "flex", gap: 10 }}>
              <button
                type="button"
                onClick={() => decide("rejected")}
                disabled={isPending}
                style={{
                  flex: 1,
                  fontSize: 14,
                  fontWeight: 700,
                  fontFamily: "inherit",
                  background: "#fff",
                  color: "#7B1D1D",
                  border: "1.5px solid #7B1D1D",
                  borderRadius: 999,
                  padding: "10px 18px",
                  cursor: isPending ? "not-allowed" : "pointer",
                  opacity: isPending ? 0.6 : 1,
                }}
              >
                {pendingDecision === "rejected" ? "Rejecting…" : "Reject"}
              </button>
              <button
                type="button"
                onClick={() => decide("approved")}
                disabled={isPending}
                style={{
                  flex: 1,
                  fontSize: 14,
                  fontWeight: 700,
                  fontFamily: "inherit",
                  background: "#14492E",
                  color: "#fff",
                  border: "1.5px solid #14492E",
                  borderRadius: 999,
                  padding: "10px 18px",
                  cursor: isPending ? "not-allowed" : "pointer",
                  opacity: isPending ? 0.6 : 1,
                }}
              >
                {pendingDecision === "approved"
                  ? "Approving…"
                  : showTimes
                    ? "Approve & Apply"
                    : plan.kind === "leader"
                      ? "Approve & Assign Leader"
                      : "Approve"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
