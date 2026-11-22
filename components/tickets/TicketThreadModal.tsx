"use client"

import { useCallback, useEffect, useRef, useState, useTransition } from "react"
import { getTicket, replyToTicket, setTicketStatus } from "@/lib/tickets/ticket-actions"
import {
  TICKET_CATEGORY_LABELS,
  TICKET_MESSAGE_MAX,
  TICKET_STATUS_LABELS,
  validateTicketMessage,
  type TicketDetail,
  type TicketStatus,
} from "@/lib/tickets/ticket-types"
import TicketModalShell, { TicketButton, ticketFieldStyle } from "@/components/tickets/TicketModalShell"
import TicketStatusBadge from "@/components/tickets/TicketStatusBadge"

export function formatTicketDate(iso: string): string {
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

/**
 * One ticket's conversation. Used by both the admin inbox and the facilitator's
 * Tickets page; what the viewer can do (any status vs. close only) comes from
 * the server in `viewerIsAdmin`.
 */
export default function TicketThreadModal({
  ticketId,
  onClose,
  onChanged,
}: {
  ticketId: string
  onClose: () => void
  /** Called after a reply or status change so the list behind can refresh. */
  onChanged: () => void
}) {
  const [ticket, setTicket] = useState<TicketDetail | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reply, setReply] = useState("")
  const [actionError, setActionError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const bottomRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    const res = await getTicket(ticketId)
    if (!res.ok) {
      setLoadError(res.error)
      return
    }
    setLoadError(null)
    setTicket(res.data)
  }, [ticketId])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" })
  }, [ticket?.messages.length])

  function sendReply() {
    const validationError = validateTicketMessage(reply)
    if (validationError) {
      setActionError(validationError)
      return
    }
    setActionError(null)
    startTransition(async () => {
      const res = await replyToTicket(ticketId, reply)
      if (!res.ok) {
        setActionError(res.error)
        return
      }
      setReply("")
      await load()
      onChanged()
    })
  }

  function changeStatus(status: TicketStatus) {
    if (status === "closed" && !window.confirm("Close this ticket? No one can reply after it's closed.")) return
    setActionError(null)
    startTransition(async () => {
      const res = await setTicketStatus(ticketId, status)
      if (!res.ok) {
        setActionError(res.error)
        return
      }
      await load()
      onChanged()
    })
  }

  const isClosed = ticket?.status === "closed"

  return (
    <TicketModalShell
      onClose={() => !isPending && onClose()}
      maxWidth={720}
      title={
        <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {ticket ? ticket.subject : "Ticket"}
        </span>
      }
    >
      {loadError ? (
        <p style={{ padding: 20, margin: 0, color: "#991B1B" }}>{loadError}</p>
      ) : !ticket ? (
        <p style={{ padding: 20, margin: 0, color: "#6B7280" }}>Loading…</p>
      ) : (
        <>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: "6px 14px",
              padding: "12px 20px",
              borderBottom: "1px solid #E5E7EB",
              fontSize: 13,
              color: "#6B7280",
              flexShrink: 0,
            }}
          >
            <TicketStatusBadge status={ticket.status} />
            <span>{TICKET_CATEGORY_LABELS[ticket.category]}</span>
            <span>
              From <strong style={{ color: "#2C2C2A" }}>{ticket.requesterName}</strong>
              {ticket.viewerIsAdmin && ticket.requesterEmail ? ` (${ticket.requesterEmail})` : ""}
            </span>
            <span>Opened {formatTicketDate(ticket.createdAt)}</span>
          </div>

          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "16px 20px",
              display: "flex",
              flexDirection: "column",
              gap: 12,
              background: "#FAFAF9",
              minHeight: 160,
            }}
          >
            {ticket.messages.map((m) => (
              <div
                key={m.messageId}
                style={{
                  alignSelf: m.isMine ? "flex-end" : "flex-start",
                  maxWidth: "85%",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: m.isMine ? "flex-end" : "flex-start",
                  gap: 4,
                }}
              >
                <div style={{ fontSize: 12, color: "#6B7280" }}>
                  <strong style={{ color: "#2C2C2A" }}>{m.isMine ? "You" : m.senderName}</strong>
                  {m.senderIsAdmin && !m.isMine && (
                    <span
                      style={{
                        marginLeft: 6,
                        fontSize: 11,
                        fontWeight: 700,
                        color: "#7B1D1D",
                      }}
                    >
                      NSTP ADMIN
                    </span>
                  )}
                  {" · "}
                  {formatTicketDate(m.createdAt)}
                </div>
                <div
                  style={{
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    fontSize: 14,
                    lineHeight: 1.5,
                    padding: "10px 14px",
                    borderRadius: 12,
                    background: m.isMine ? "#14492E" : "#fff",
                    color: m.isMine ? "#fff" : "#2C2C2A",
                    border: m.isMine ? "none" : "1px solid #E5E7EB",
                  }}
                >
                  {m.body}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          <div style={{ borderTop: "1px solid #E5E7EB", padding: "12px 20px 16px", flexShrink: 0 }}>
            {isClosed ? (
              <p style={{ margin: 0, fontSize: 13, color: "#6B7280" }}>
                This ticket is closed.
                {ticket.viewerIsAdmin ? " Reopen it to reply." : " Open a new ticket if you need more help."}
              </p>
            ) : (
              <textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) sendReply()
                }}
                maxLength={TICKET_MESSAGE_MAX}
                rows={3}
                placeholder="Write a reply… (Ctrl+Enter to send)"
                aria-label="Reply"
                style={{ ...ticketFieldStyle, resize: "vertical" }}
              />
            )}

            {actionError && (
              <p style={{ margin: "8px 0 0", fontSize: 13, color: "#991B1B" }}>{actionError}</p>
            )}

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
                marginTop: 10,
              }}
            >
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
                {ticket.viewerIsAdmin ? (
                  <>
                    <label htmlFor="ticket_status" style={{ fontSize: 13, fontWeight: 700, color: "#2C2C2A" }}>
                      Status
                    </label>
                    <select
                      id="ticket_status"
                      value={ticket.status}
                      disabled={isPending}
                      onChange={(e) => changeStatus(e.target.value as TicketStatus)}
                      style={{ ...ticketFieldStyle, width: "auto", padding: "6px 10px", cursor: "pointer" }}
                    >
                      {(Object.keys(TICKET_STATUS_LABELS) as TicketStatus[]).map((s) => (
                        <option key={s} value={s}>
                          {TICKET_STATUS_LABELS[s]}
                        </option>
                      ))}
                    </select>
                  </>
                ) : (
                  !isClosed && (
                    <TicketButton variant="danger" onClick={() => changeStatus("closed")} disabled={isPending}>
                      Close Ticket
                    </TicketButton>
                  )
                )}
              </div>
              {!isClosed && (
                <TicketButton onClick={sendReply} disabled={isPending || !reply.trim()}>
                  {isPending ? "Sending…" : "Send Reply"}
                </TicketButton>
              )}
            </div>
          </div>
        </>
      )}
    </TicketModalShell>
  )
}
