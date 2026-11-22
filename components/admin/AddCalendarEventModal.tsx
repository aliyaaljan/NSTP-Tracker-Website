"use client"

import { useCallback, useEffect, useState, useTransition } from "react"
import { createCalendarEvent } from "@/lib/admin/settings-actions"
import {
  CALENDAR_EVENT_DESCRIPTION_MAX,
  CALENDAR_EVENT_LOCATION_MAX,
  CALENDAR_EVENT_TITLE_MAX,
  collectCalendarEventFieldErrors,
  emptyCalendarEventCreatePayload,
  type CalendarEventCreatePayload,
  type CalendarEventFieldErrors,
} from "@/lib/admin/settings-edit"
import { FONT_HEADING, TYPE } from "@/lib/admin-typography"
import {
  ADMIN_FIELD_ERROR_STYLE,
  ADMIN_FIELD_NORMAL_STYLE,
  AdminFormField,
  AdminTextInput,
} from "@/components/admin/AdminFormControls"

const COLORS = {
  textDark: "#2C2C2A",
  textGray: "#8C8C88",
  headerGreen: "#14492E",
  fieldBg: "#EBEBE8",
  error: "#7B1113",
}

export default function AddCalendarEventModal({
  open,
  termId,
  onClose,
}: {
  open: boolean
  termId: string
  onClose: () => void
}) {
  const [form, setForm] = useState<CalendarEventCreatePayload>(
    emptyCalendarEventCreatePayload(termId)
  )
  const [fieldErrors, setFieldErrors] = useState<CalendarEventFieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const reset = useCallback(() => {
    setForm(emptyCalendarEventCreatePayload(termId))
    setFieldErrors({})
    setFormError(null)
  }, [termId])

  const close = useCallback(() => {
    if (isPending) return
    reset()
    onClose()
  }, [isPending, onClose, reset])

  useEffect(() => {
    if (open) reset()
  }, [open, reset])

  useEffect(() => {
    if (!open) return

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") close()
    }

    document.body.style.overflow = "hidden"
    window.addEventListener("keydown", onKeyDown)
    return () => {
      document.body.style.overflow = ""
      window.removeEventListener("keydown", onKeyDown)
    }
  }, [open, close])

  function patchForm(updates: Partial<CalendarEventCreatePayload>) {
    setForm((prev) => ({ ...prev, ...updates }))
    setFieldErrors((prev) => {
      const next = { ...prev }
      for (const key of Object.keys(updates) as (keyof CalendarEventFieldErrors)[]) {
        delete next[key]
      }
      // Start/end time errors depend on each other.
      if ("startTime" in updates || "endTime" in updates) {
        delete next.startTime
        delete next.endTime
      }
      return next
    })
    setFormError(null)
  }

  function handleAdd() {
    const nextErrors = collectCalendarEventFieldErrors(form)
    setFieldErrors(nextErrors)
    setFormError(null)
    if (Object.keys(nextErrors).length > 0) return

    startTransition(async () => {
      const result = await createCalendarEvent(form)
      if (!result.ok) {
        setFormError(result.error)
        return
      }
      reset()
      onClose()
      window.location.reload()
    })
  }

  if (!open) return null

  const canAdd = !isPending

  return (
    <div
      role="presentation"
      onClick={close}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        background: "rgba(44, 44, 42, 0.35)",
        backdropFilter: "blur(4px)",
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-event-title"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 520,
          maxHeight: "calc(100vh - 48px)",
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
            padding: "18px 22px",
            background: COLORS.headerGreen,
            flexShrink: 0,
          }}
        >
          <h2
            id="add-event-title"
            style={{ ...TYPE.h2, fontFamily: FONT_HEADING, color: "#fff", margin: 0 }}
          >
            Add Event / Reminder
          </h2>
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            style={{
              background: "none",
              border: "none",
              color: "#fff",
              cursor: "pointer",
              padding: 4,
              display: "flex",
            }}
          >
            <i className="ti ti-x" style={{ fontSize: 20 }} />
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleAdd()
          }}
          style={{
            padding: "24px 22px 20px",
            display: "flex",
            flexDirection: "column",
            gap: 18,
            overflowY: "auto",
          }}
        >
          <p style={{ ...TYPE.caption, color: COLORS.textGray, margin: 0 }}>
            Shows on every student&apos;s and adviser&apos;s calendar for the active term.
          </p>

          <AdminFormField label="Event Title:" htmlFor="event_title" error={fieldErrors.title}>
            <AdminTextInput
              id="event_title"
              name="event_title"
              value={form.title}
              onChange={(title) => patchForm({ title })}
              placeholder="e.g. Basic First Aid Training"
              maxLength={CALENDAR_EVENT_TITLE_MAX}
              invalid={Boolean(fieldErrors.title)}
            />
          </AdminFormField>

          <AdminFormField label="Date:" htmlFor="event_date" error={fieldErrors.date}>
            <AdminTextInput
              id="event_date"
              name="event_date"
              type="date"
              value={form.date}
              onChange={(date) => patchForm({ date })}
              invalid={Boolean(fieldErrors.date)}
            />
          </AdminFormField>

          <div style={{ display: "flex", gap: 16 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <AdminFormField
                label="Start Time (optional):"
                htmlFor="event_start_time"
                error={fieldErrors.startTime}
              >
                <AdminTextInput
                  id="event_start_time"
                  name="event_start_time"
                  type="time"
                  value={form.startTime}
                  onChange={(startTime) => patchForm({ startTime })}
                  invalid={Boolean(fieldErrors.startTime)}
                />
              </AdminFormField>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <AdminFormField
                label="End Time (optional):"
                htmlFor="event_end_time"
                error={fieldErrors.endTime}
              >
                <AdminTextInput
                  id="event_end_time"
                  name="event_end_time"
                  type="time"
                  value={form.endTime}
                  onChange={(endTime) => patchForm({ endTime })}
                  invalid={Boolean(fieldErrors.endTime)}
                />
              </AdminFormField>
            </div>
          </div>

          <AdminFormField
            label="Location (optional):"
            htmlFor="event_location"
            error={fieldErrors.location}
          >
            <AdminTextInput
              id="event_location"
              name="event_location"
              value={form.location}
              onChange={(location) => patchForm({ location })}
              placeholder="e.g. UP Baguio Gym"
              maxLength={CALENDAR_EVENT_LOCATION_MAX}
              invalid={Boolean(fieldErrors.location)}
            />
          </AdminFormField>

          <AdminFormField
            label="Details (optional):"
            htmlFor="event_description"
            error={fieldErrors.description}
          >
            <textarea
              id="event_description"
              name="event_description"
              value={form.description}
              onChange={(e) => patchForm({ description: e.target.value })}
              placeholder="e.g. Wear comfortable clothes and bring your own water."
              maxLength={CALENDAR_EVENT_DESCRIPTION_MAX}
              rows={3}
              aria-invalid={Boolean(fieldErrors.description) || undefined}
              style={{
                width: "100%",
                boxSizing: "border-box",
                ...TYPE.body,
                fontStyle: "normal",
                fontFamily: "inherit",
                color: COLORS.textDark,
                ...(fieldErrors.description ? ADMIN_FIELD_ERROR_STYLE : ADMIN_FIELD_NORMAL_STYLE),
                borderRadius: 6,
                padding: "12px 14px",
                outline: "none",
                resize: "vertical",
              }}
            />
          </AdminFormField>

          {formError && (
            <p style={{ ...TYPE.caption, color: COLORS.error, margin: 0 }}>{formError}</p>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4 }}>
            <button
              type="submit"
              disabled={!canAdd}
              style={{
                ...TYPE.bodyBold,
                fontFamily: FONT_HEADING,
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                background: canAdd ? COLORS.headerGreen : "#A8B5AD",
                color: "#fff",
                border: "none",
                borderRadius: 24,
                padding: "10px 22px",
                cursor: canAdd ? "pointer" : "not-allowed",
                opacity: canAdd ? 1 : 0.5,
              }}
            >
              <i className="ti ti-plus" style={{ fontSize: 16 }} />
              {isPending ? "Adding…" : "Add"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
