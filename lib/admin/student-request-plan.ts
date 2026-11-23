// What approving a student request will do — pure, client-safe.
// Mirrors deriveApplyPlan in app/facilitator/my-students/page.tsx so an admin
// approval has the same effect as the facilitator's (without manual time edits).

import { manilaHm, manilaYmd } from "@/lib/student/time-correction"

export const LEADER_ROLE_TRANSFER_CODE = "leader role transfer"

export type ApprovePlanKind = "none" | "add" | "edit" | "restore" | "flag" | "leader"

export interface ApprovePlan {
  kind: ApprovePlanKind
  /** One line shown above the Approve button. */
  summary: string
  /** YYYY-MM-DD (Manila) for add/edit/restore */
  date: string
  /** HH:MM 24h (Manila) */
  timeIn: string
  timeOut: string
}

export interface ApprovePlanInput {
  typeCode: string | null
  attendanceSessionId: string | null
  requestedTimeIn: string | null
  requestedTimeOut: string | null
  session: { startedAt: string | null; endedAt: string | null; statusCode: string | null } | null
  studentIsLeader: boolean
}

export function deriveApprovePlan(r: ApprovePlanInput): ApprovePlan {
  const base = { date: "", timeIn: "", timeOut: "" }

  if (r.typeCode === LEADER_ROLE_TRANSFER_CODE) {
    return {
      ...base,
      kind: r.studentIsLeader ? "none" : "leader",
      summary: r.studentIsLeader
        ? "This student is already the class leader. Approving only marks the request approved."
        : "Approving makes this student the class leader.",
    }
  }

  const hasTimes = !!r.requestedTimeIn || !!r.requestedTimeOut
  const isTimeRequest = !!r.attendanceSessionId || hasTimes
  if (!isTimeRequest) {
    return { ...base, kind: "none", summary: "Approving marks the request approved. No attendance changes." }
  }

  if (!r.attendanceSessionId) {
    return {
      kind: "add",
      date: manilaYmd(r.requestedTimeIn) || manilaYmd(r.requestedTimeOut),
      timeIn: manilaHm(r.requestedTimeIn),
      timeOut: manilaHm(r.requestedTimeOut),
      summary: "Approving adds a new attendance session with the requested times.",
    }
  }

  if (r.session?.statusCode === "voided") {
    return {
      kind: "restore",
      date: manilaYmd(r.session.startedAt),
      timeIn: manilaHm(r.session.startedAt),
      timeOut: manilaHm(r.requestedTimeOut) || manilaHm(r.session.endedAt),
      summary: "Approving restores this auto-timed-out session with the requested time-out.",
    }
  }

  if (hasTimes) {
    return {
      kind: "edit",
      date: manilaYmd(r.session?.startedAt) || manilaYmd(r.requestedTimeIn),
      timeIn: manilaHm(r.requestedTimeIn) || manilaHm(r.session?.startedAt),
      timeOut: manilaHm(r.requestedTimeOut) || manilaHm(r.session?.endedAt),
      summary: "Approving corrects the recorded time on this session to the requested times.",
    }
  }

  return {
    ...base,
    kind: "flag",
    summary: "The student is explaining a flagged session. The session still counts.",
  }
}

/** "14:05" → "2:05 PM" */
export function formatHm(hm: string): string {
  if (!hm) return ""
  const [h, m] = hm.split(":").map(Number)
  const hour12 = h % 12 === 0 ? 12 : h % 12
  return `${hour12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`
}
