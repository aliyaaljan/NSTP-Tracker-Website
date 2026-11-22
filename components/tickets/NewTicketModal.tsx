"use client"

import { useState, useTransition } from "react"
import { createTicket } from "@/lib/tickets/ticket-actions"
import {
  TICKET_CATEGORY_OPTIONS,
  TICKET_MESSAGE_MAX,
  TICKET_SUBJECT_MAX,
  validateCreateTicket,
  type TicketCategory,
} from "@/lib/tickets/ticket-types"
import TicketModalShell, { TicketButton, ticketFieldStyle } from "@/components/tickets/TicketModalShell"

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 14,
  fontWeight: 700,
  color: "#2C2C2A",
  marginBottom: 6,
}

export default function NewTicketModal({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: (ticketId: string) => void
}) {
  const [subject, setSubject] = useState("")
  const [category, setCategory] = useState<TicketCategory>("other")
  const [body, setBody] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit() {
    const payload = { subject, category, body }
    const validationError = validateCreateTicket(payload)
    if (validationError) {
      setError(validationError)
      return
    }
    setError(null)
    startTransition(async () => {
      const res = await createTicket(payload)
      if (!res.ok) {
        setError(res.error)
        return
      }
      onCreated(res.data.ticketId)
    })
  }

  const close = () => {
    if (isPending) return
    if ((subject.trim() || body.trim()) && !window.confirm("Discard this ticket?")) return
    onClose()
  }

  return (
    <TicketModalShell title="New Ticket to NSTP Admin" onClose={close} maxWidth={560}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          handleSubmit()
        }}
        style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16, overflowY: "auto" }}
      >
        <p style={{ margin: 0, fontSize: 13, color: "#6B7280" }}>
          Your ticket goes to the NSTP admin. You&apos;ll see their replies here under Tickets.
        </p>

        <div>
          <label htmlFor="ticket_subject" style={labelStyle}>Subject</label>
          <input
            id="ticket_subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            maxLength={TICKET_SUBJECT_MAX}
            placeholder="e.g. Student missing from my class roster"
            style={ticketFieldStyle}
            autoFocus
          />
        </div>

        <div>
          <label htmlFor="ticket_category" style={labelStyle}>Category</label>
          <select
            id="ticket_category"
            value={category}
            onChange={(e) => setCategory(e.target.value as TicketCategory)}
            style={{ ...ticketFieldStyle, cursor: "pointer" }}
          >
            {TICKET_CATEGORY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="ticket_body" style={labelStyle}>Message</label>
          <textarea
            id="ticket_body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={TICKET_MESSAGE_MAX}
            rows={6}
            placeholder="Describe the issue. Include names, dates, or class details that help the admin act on it."
            style={{ ...ticketFieldStyle, resize: "vertical" }}
          />
          <div style={{ fontSize: 12, color: "#9CA3AF", textAlign: "right", marginTop: 4 }}>
            {body.length}/{TICKET_MESSAGE_MAX}
          </div>
        </div>

        {error && <p style={{ margin: 0, fontSize: 13, color: "#991B1B" }}>{error}</p>}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <TicketButton variant="secondary" onClick={close} disabled={isPending}>
            Cancel
          </TicketButton>
          <TicketButton type="submit" disabled={isPending}>
            {isPending ? "Sending…" : "Send Ticket"}
          </TicketButton>
        </div>
      </form>
    </TicketModalShell>
  )
}
