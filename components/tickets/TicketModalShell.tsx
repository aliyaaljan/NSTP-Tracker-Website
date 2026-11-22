"use client"

import { useEffect } from "react"

/** Minimal modal frame shared by the ticket dialogs (works in admin and facilitator layouts). */
export default function TicketModalShell({
  title,
  onClose,
  children,
  maxWidth = 640,
}: {
  title: React.ReactNode
  onClose: () => void
  children: React.ReactNode
  maxWidth?: number
}) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    window.addEventListener("keydown", onKeyDown)
    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener("keydown", onKeyDown)
    }
  }, [onClose])

  return (
    <div
      role="presentation"
      onClick={onClose}
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
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth,
          maxHeight: "calc(100vh - 32px)",
          display: "flex",
          flexDirection: "column",
          borderRadius: 16,
          overflow: "hidden",
          background: "#fff",
          boxShadow: "0 20px 50px rgba(0,0,0,0.18)",
          fontFamily: "var(--font-content, sans-serif)",
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
          <div style={{ fontSize: 18, fontWeight: 700, minWidth: 0 }}>{title}</div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              background: "none",
              border: "none",
              color: "#fff",
              cursor: "pointer",
              fontSize: 20,
              lineHeight: 1,
              padding: 4,
            }}
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export const ticketFieldStyle: React.CSSProperties = {
  width: "100%",
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

export function TicketButton({
  children,
  onClick,
  disabled,
  variant = "primary",
  type = "button",
}: {
  children: React.ReactNode
  onClick?: () => void
  disabled?: boolean
  variant?: "primary" | "secondary" | "danger"
  type?: "button" | "submit"
}) {
  const palette = {
    primary: { bg: "#14492E", fg: "#fff", border: "#14492E" },
    secondary: { bg: "#fff", fg: "#14492E", border: "#14492E" },
    danger: { bg: "#fff", fg: "#7B1D1D", border: "#7B1D1D" },
  }[variant]
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontSize: 14,
        fontWeight: 700,
        fontFamily: "inherit",
        background: palette.bg,
        color: palette.fg,
        border: `1.5px solid ${palette.border}`,
        borderRadius: 999,
        padding: "8px 18px",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </button>
  )
}
