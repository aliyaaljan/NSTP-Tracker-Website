import { Suspense } from "react"
import AdminLoadingFallback from "@/components/admin/AdminLoadingFallback"
import AdminTicketsClient from "@/components/admin/AdminTicketsClient"
import type { AdminCurrentUser } from "@/lib/admin/settings"
import { createSupabaseServerClient } from "@/lib/supabase/server-client"
import { getAllStudentRequests, getAllTickets } from "@/lib/tickets/ticket-actions"

export const revalidate = 0

async function getCurrentAdmin(): Promise<AdminCurrentUser> {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { name: "Admin", role: "NSTP Admin" }
  const { data } = await supabase
    .from("app_user")
    .select("full_name, avatar_url")
    .eq("app_user_id", user.id)
    .maybeSingle()
  return {
    name: data?.full_name || "Admin",
    role: "NSTP Admin",
    avatarUrl: data?.avatar_url ?? undefined,
  }
}

async function TicketsContent() {
  const [tickets, requests, currentUser] = await Promise.all([
    getAllTickets(),
    getAllStudentRequests(),
    getCurrentAdmin(),
  ])

  return (
    <AdminTicketsClient
      initialTickets={tickets.ok ? tickets.data : []}
      ticketsError={tickets.ok ? null : tickets.error}
      requests={requests.ok ? requests.data : []}
      requestsError={requests.ok ? null : requests.error}
      currentUser={currentUser}
    />
  )
}

export default function AdminTicketsPage() {
  return (
    <Suspense fallback={<AdminLoadingFallback />}>
      <TicketsContent />
    </Suspense>
  )
}
