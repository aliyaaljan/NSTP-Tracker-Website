"use server"

import { revalidatePath } from "next/cache"
import { getAppUserRole } from "@/lib/auth-actions"
import { createSupabaseServerClient } from "@/lib/supabase/server-client"
import { createSupabaseServiceClient } from "@/lib/supabase/service-client"
import { formatClassLabel } from "@/lib/shared/class-label"
import {
  approveRequestWithCorrection,
  resolveStudentRequest,
} from "@/lib/facilitator/appeal-actions"
import { deriveApprovePlan, type ApprovePlan } from "@/lib/admin/student-request-plan"

/** A student request (`appeal`) as the admin's Student Requests page shows it. */
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
  /** Pending / under review and not withdrawn — the admin can approve or reject. */
  canDecide: boolean
  /** What approving will do (same rules as the facilitator's My Students screen). */
  plan: ApprovePlan
}

const OPEN_CODES = new Set(["pending", "open", "under_review"])

export type StudentRequestsResult =
  | { ok: true; data: AdminStudentRequestRow[] }
  | { ok: false; error: string }

/**
 * Every student request across all classes, for the admin. Facilitators keep
 * seeing (and deciding) their own students' requests on My Students; admins can
 * decide any of them via adminDecideStudentRequest below.
 */
export async function getAllStudentRequests(): Promise<StudentRequestsResult> {
  const role = await getAppUserRole()
  if (role !== "admin") return { ok: false, error: "Unauthorized." }

  const service = createSupabaseServiceClient()
  const { data, error } = await service
    .from("appeal")
    .select(
      `
        appeal_id, title, details, resolution_note, requested_time_in, requested_time_out, created_at,
        attendance_session_id,
        appeal_status:appeal_status_id (code, name),
        appeal_type:appeal_type_id (code, name),
        attendance_session:attendance_session_id (
          started_at, ended_at,
          attendance_session_status:attendance_session_status_id (code)
        ),
        enrollment:enrollment_id (
          is_student_leader,
          app_user:student_user_id (full_name, student_number),
          section:section_id (
            course_code,
            adviser:adviser_user_id (full_name),
            term:term_id (school_year, is_active)
          )
        )
      `
    )
    .order("created_at", { ascending: false })
    .limit(2000)

  if (error) {
    console.error("[getAllStudentRequests] query failed", error)
    return { ok: false, error: "Failed to load student requests." }
  }

  type AppealDbRow = {
    appeal_id: string
    title: string | null
    details: string | null
    resolution_note: string | null
    requested_time_in: string | null
    requested_time_out: string | null
    created_at: string
    attendance_session_id: string | null
    appeal_status: { code: string; name: string } | null
    appeal_type: { code: string; name: string } | null
    attendance_session: {
      started_at: string | null
      ended_at: string | null
      attendance_session_status: { code: string } | null
    } | null
    enrollment: {
      is_student_leader: boolean | null
      app_user: { full_name: string | null; student_number: string | null } | null
      section: {
        course_code: string | null
        adviser: { full_name: string | null } | null
        term: { school_year: string | null; is_active: boolean } | null
      } | null
    } | null
  }

  const rows = ((data ?? []) as unknown as AppealDbRow[]).map((a) => {
    const section = a.enrollment?.section
    return {
      appealId: a.appeal_id,
      title: a.title || "Request",
      details: a.details || "",
      typeName: a.appeal_type?.name || "Others",
      statusCode: a.appeal_status?.code || "pending",
      statusName: a.appeal_status?.name || "Pending Review",
      studentName: a.enrollment?.app_user?.full_name || "Unknown Student",
      studentNumber: a.enrollment?.app_user?.student_number || "—",
      classLabel: section
        ? formatClassLabel({
            courseCode: section.course_code,
            facilitatorName: section.adviser?.full_name,
            schoolYear: section.term?.school_year,
          })
        : "—",
      adviserName: section?.adviser?.full_name || "—",
      termIsActive: Boolean(section?.term?.is_active),
      requestedTimeIn: a.requested_time_in,
      requestedTimeOut: a.requested_time_out,
      resolutionNote: a.resolution_note,
      createdAt: a.created_at,
      canDecide: OPEN_CODES.has(a.appeal_status?.code ?? "pending"),
      plan: deriveApprovePlan({
        typeCode: a.appeal_type?.code ?? null,
        attendanceSessionId: a.attendance_session_id,
        requestedTimeIn: a.requested_time_in,
        requestedTimeOut: a.requested_time_out,
        session: a.attendance_session
          ? {
              startedAt: a.attendance_session.started_at,
              endedAt: a.attendance_session.ended_at,
              statusCode: a.attendance_session.attendance_session_status?.code ?? null,
            }
          : null,
        studentIsLeader: Boolean(a.enrollment?.is_student_leader),
      }),
    }
  })

  return { ok: true, data: rows }
}

export type DecideResult = { ok: true } | { ok: false; error: string }

/**
 * Admin approves or rejects a student request. Uses the facilitator's own
 * resolve/approve actions (which already allow admins), so the effect is the
 * same: time corrections are applied, the leader role is assigned, and the
 * student is notified.
 */
export async function adminDecideStudentRequest(
  appealId: string,
  decision: "approved" | "rejected",
  resolutionNote: string,
  options: { clearFlag?: boolean } = {}
): Promise<DecideResult> {
  const role = await getAppUserRole()
  if (role !== "admin") return { ok: false, error: "Unauthorized." }

  const note = resolutionNote.trim()
  if (note.length > 1000) return { ok: false, error: "Note must be at most 1000 characters." }

  const service = createSupabaseServiceClient()
  const { data, error } = await service
    .from("appeal")
    .select(
      `
        appeal_id, attendance_session_id, requested_time_in, requested_time_out, leader_role_expires_at,
        appeal_status:appeal_status_id (code),
        appeal_type:appeal_type_id (code),
        attendance_session:attendance_session_id (
          started_at, ended_at,
          attendance_session_status:attendance_session_status_id (code)
        ),
        enrollment:enrollment_id (
          enrollment_id, is_student_leader,
          section:section_id (adviser_user_id)
        )
      `
    )
    .eq("appeal_id", appealId)
    .maybeSingle()

  if (error || !data) {
    if (error) console.error("[adminDecideStudentRequest] load failed", error)
    return { ok: false, error: "Request not found." }
  }

  type Row = {
    attendance_session_id: string | null
    requested_time_in: string | null
    requested_time_out: string | null
    leader_role_expires_at: string | null
    appeal_status: { code: string } | null
    appeal_type: { code: string } | null
    attendance_session: {
      started_at: string | null
      ended_at: string | null
      attendance_session_status: { code: string } | null
    } | null
    enrollment: {
      enrollment_id: string
      is_student_leader: boolean | null
      section: { adviser_user_id: string | null } | null
    } | null
  }
  const a = data as unknown as Row

  if (!OPEN_CODES.has(a.appeal_status?.code ?? "")) {
    return { ok: false, error: "This request has already been decided or withdrawn." }
  }

  const finish = (res: { ok: boolean; error?: string }): DecideResult => {
    revalidatePath("/admin/requests")
    return res.ok ? { ok: true } : { ok: false, error: res.error || "Failed to update the request." }
  }

  if (decision === "rejected") {
    return finish(await resolveStudentRequest(appealId, "rejected", note))
  }

  const plan = deriveApprovePlan({
    typeCode: a.appeal_type?.code ?? null,
    attendanceSessionId: a.attendance_session_id,
    requestedTimeIn: a.requested_time_in,
    requestedTimeOut: a.requested_time_out,
    session: a.attendance_session
      ? {
          startedAt: a.attendance_session.started_at,
          endedAt: a.attendance_session.ended_at,
          statusCode: a.attendance_session.attendance_session_status?.code ?? null,
        }
      : null,
    studentIsLeader: Boolean(a.enrollment?.is_student_leader),
  })

  if (plan.kind === "leader") {
    const adviserId = a.enrollment?.section?.adviser_user_id
    if (!a.enrollment || !adviserId) {
      return { ok: false, error: "This student's class has no facilitator, so the leader role can't be assigned." }
    }
    // update_student_role matches on the section's adviser; the admin passes its guard via app_is_admin().
    const supabase = await createSupabaseServerClient()
    const { error: roleError } = await supabase.rpc("update_student_role", {
      p_adviser_user_id: adviserId,
      p_enrollment_id: a.enrollment.enrollment_id,
      p_leader_role_expires_at: a.leader_role_expires_at,
    })
    if (roleError) {
      console.error("[adminDecideStudentRequest] update_student_role failed", roleError)
      return { ok: false, error: "Couldn't assign the leader role. The request was not approved." }
    }
    return finish(await resolveStudentRequest(appealId, "approved", note))
  }

  if (plan.kind === "none") {
    return finish(await resolveStudentRequest(appealId, "approved", note))
  }

  if (plan.kind === "add" || plan.kind === "edit" || plan.kind === "restore") {
    if (!plan.date || !plan.timeIn || !plan.timeOut) {
      return {
        ok: false,
        error:
          "This request is missing a date or time, so the correction can't be applied automatically. Ask the facilitator to handle it from My Students.",
      }
    }
  }

  return finish(
    await approveRequestWithCorrection(appealId, {
      action: plan.kind === "flag" ? (options.clearFlag ? "clear_flag" : "none") : plan.kind,
      attendanceSessionId: a.attendance_session_id,
      sessionDate: plan.date,
      timeIn: plan.timeIn,
      timeOut: plan.timeOut,
      resolutionNote: note,
    })
  )
}
