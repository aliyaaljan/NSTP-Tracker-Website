import { Suspense } from "react"
import AdminLoadingFallback from "@/components/admin/AdminLoadingFallback"
import AdminRequestsClient from "@/components/admin/AdminRequestsClient"
import type { AdminCurrentUser } from "@/lib/admin/settings"
import { createSupabaseServerClient } from "@/lib/supabase/server-client"
import { getAllStudentRequests } from "@/lib/admin/student-requests-actions"

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

async function RequestsContent() {
  const [requests, currentUser] = await Promise.all([getAllStudentRequests(), getCurrentAdmin()])

  return (
    <AdminRequestsClient
      requests={requests.ok ? requests.data : []}
      error={requests.ok ? null : requests.error}
      currentUser={currentUser}
    />
  )
}

export default function AdminRequestsPage() {
  return (
    <Suspense fallback={<AdminLoadingFallback />}>
      <RequestsContent />
    </Suspense>
  )
}
