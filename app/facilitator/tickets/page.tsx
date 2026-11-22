"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { IconPlus } from "@tabler/icons-react"
import { Sidebar, dashboardStyles, navRoutes } from "../facilitator"
import { signOutWithAudit } from "@/lib/auth-actions"
import { createClient } from "@/lib/client"
import { googleAvatarUrl } from "@/lib/auth/avatar"
import FacilitatorProfilePill from "@/components/facilitator/FacilitatorProfilePill"
import LoadingPage from "@/components/shared/LoadingPage"
import TicketList from "@/components/tickets/TicketList"
import TicketThreadModal from "@/components/tickets/TicketThreadModal"
import NewTicketModal from "@/components/tickets/NewTicketModal"
import { TicketButton } from "@/components/tickets/TicketModalShell"
import { getMyTickets } from "@/lib/tickets/ticket-actions"
import type { TicketSummary } from "@/lib/tickets/ticket-types"

const ticketsStyles = `
  ${dashboardStyles}
  .tk-body { flex: 1; overflow: auto; padding-top: 16px; }
  .tk-card {
    background: var(--white);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    box-shadow: var(--shadow);
    padding: 20px;
  }
`

export default function FacilitatorTicketsPage() {
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isPageLoading, setIsPageLoading] = useState(true)
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [initials, setInitials] = useState("")
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)

  const [tickets, setTickets] = useState<TicketSummary[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [openTicketId, setOpenTicketId] = useState<string | null>(null)
  const [showNew, setShowNew] = useState(false)

  const loadTickets = useCallback(async () => {
    const res = await getMyTickets()
    if (res.ok) {
      setTickets(res.data)
      setLoadError(null)
    } else {
      setLoadError(res.error)
    }
  }, [])

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      const full: string = user?.user_metadata?.full_name ?? ""
      const parts = full.trim().split(/\s+/)
      const fName = parts[0] ?? ""
      const lName = parts.at(-1) ?? ""
      setFirstName(fName)
      setLastName(lName)
      setInitials((fName[0] ?? "") + (lName[0] ?? ""))
      setAvatarUrl(googleAvatarUrl(user))
    })
    loadTickets().finally(() => setIsPageLoading(false))
  }, [loadTickets])

  async function handleSignOut() {
    await signOutWithAudit()
    router.push("/")
    router.refresh()
  }

  const sidebar = (
    <Sidebar
      open={sidebarOpen}
      activeNav="Tickets"
      onToggle={() => setSidebarOpen((o) => !o)}
      onNavClick={(label) => {
        setSidebarOpen(false)
        router.push(navRoutes[label])
      }}
      onSignOut={handleSignOut}
    />
  )

  if (isPageLoading) {
    return (
      <>
        <style>{dashboardStyles}</style>
        <LoadingPage Sidebar={() => sidebar} />
      </>
    )
  }

  const activeCount = tickets.filter((t) => t.status === "open" || t.status === "in_progress").length

  return (
    <>
      <style>{ticketsStyles}</style>
      <div className="db-root">
        {sidebar}
        {sidebarOpen && (
          <div className="sb-overlay" onClick={() => setSidebarOpen(false)} aria-hidden="true" />
        )}

        <div className="main-wrapper">
          <main className="main">
            <header className="header">
              <h1 className="header-greeting">Tickets</h1>
              <FacilitatorProfilePill
                name={lastName ? `${lastName}, ${firstName}` : "Adviser"}
                avatarUrl={avatarUrl}
                initials={initials || "A"}
              />
            </header>

            <div className="body">
              <div className="tk-body">
                <div className="tk-card">
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                      marginBottom: 16,
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text)" }}>
                        My Tickets to NSTP Admin
                      </div>
                      <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 2 }}>
                        {activeCount} open · Send the admin a concern about accounts, rosters, hours, forms, or the system
                      </div>
                    </div>
                    <TicketButton onClick={() => setShowNew(true)}>
                      <IconPlus size={16} stroke={2.25} />
                      New Ticket
                    </TicketButton>
                  </div>

                  {loadError ? (
                    <p style={{ margin: 0, color: "#991B1B" }}>{loadError}</p>
                  ) : (
                    <TicketList
                      tickets={tickets}
                      onOpen={setOpenTicketId}
                      emptyMessage="You haven't sent any tickets yet. Use New Ticket to contact the NSTP admin."
                    />
                  )}
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>

      {showNew && (
        <NewTicketModal
          onClose={() => setShowNew(false)}
          onCreated={async (ticketId) => {
            setShowNew(false)
            await loadTickets()
            setOpenTicketId(ticketId)
          }}
        />
      )}

      {openTicketId && (
        <TicketThreadModal
          ticketId={openTicketId}
          onClose={() => setOpenTicketId(null)}
          onChanged={loadTickets}
        />
      )}
    </>
  )
}
