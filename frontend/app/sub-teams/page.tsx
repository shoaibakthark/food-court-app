"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth, fetchWithAuth } from "../lib/auth";
import { SidebarUserCard, OwnerBanner, NavLink, TopbarUserBadge, AppSidebar, MobileMenuButton } from "../components/AuthBar";

const API_URL = typeof window !== "undefined" ? "/api/py" : "http://127.0.0.1:8000";

type EventItem = {
  id: number;
  name?: string;
  date?: string;
  customer_name?: string;
  event_type?: string;
  place?: string;
};

type SubTeam = {
  id: number;
  event_id: number;
  name: string;
  purpose?: string | null;
  phone?: string | null;
  amount?: number | string | null;
  note?: string | null;
  event_name?: string | null;
};

type SubTeamForm = {
  event_id: string;
  name: string;
  purpose: string;
  phone: string;
  amount: string;
  note: string;
};

const EMPTY_FORM: SubTeamForm = {
  event_id: "",
  name: "",
  purpose: "",
  phone: "",
  amount: "",
  note: "",
};

function formatMoney(amount: number | string | null | undefined): string {
  return Number(amount ?? 0).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  });
}

export default function SubTeamsPage() {
  const router = useRouter();
  const { user, isOwner, isManager } = useAuth();

  const [events, setEvents] = useState<EventItem[]>([]);
  const [subTeams, setSubTeams] = useState<SubTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<SubTeamForm>(EMPTY_FORM);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [eventsRes, subTeamsRes] = await Promise.all([
        fetch(`${API_URL}/events`, { cache: "no-store" }),
        fetch(`${API_URL}/sub-teams`, { cache: "no-store" }),
      ]);

      if (eventsRes.ok) {
        const evData = await eventsRes.json();
        setEvents(
          Array.isArray(evData)
            ? evData.map((e: any) => ({
                id: e.id,
                name: e.customer_name ? `${e.customer_name} - ${e.event_type || "Event"} (#${e.id})` : `Event #${e.id}`,
                date: e.date,
                customer_name: e.customer_name,
                event_type: e.event_type,
                place: e.place,
              }))
            : []
        );
      }

      if (subTeamsRes.ok) {
        const stData = await subTeamsRes.json();
        setSubTeams(Array.isArray(stData) ? stData : []);
      }
    } catch (err: any) {
      console.error("Failed to load sub-teams:", err);
      setError("Unable to connect to the backend server. Please verify FastAPI is running.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Financial summary
  const summary = useMemo(() => {
    let totalAmt = 0;
    const eventIds = new Set<number>();

    subTeams.forEach((t) => {
      totalAmt += Number(t.amount || 0);
      if (t.event_id) eventIds.add(t.event_id);
    });

    return {
      totalCount: subTeams.length,
      totalAmount: totalAmt,
      eventsCount: eventIds.size,
    };
  }, [subTeams]);

  // Filtered sub-teams
  const filteredTeams = useMemo(() => {
    if (!search.trim()) return subTeams;
    const q = search.toLowerCase().trim();
    return subTeams.filter((t) => {
      return (
        t.name.toLowerCase().includes(q) ||
        (t.purpose && t.purpose.toLowerCase().includes(q)) ||
        (t.phone && t.phone.includes(q)) ||
        (t.note && t.note.toLowerCase().includes(q)) ||
        String(t.event_id).includes(q) ||
        String(t.id).includes(q)
      );
    });
  }, [subTeams, search]);

  const openAddModal = () => {
    setForm({
      ...EMPTY_FORM,
      event_id: events.length > 0 ? String(events[0].id) : "",
    });
    setError(null);
    setSuccess(null);
    setModalOpen(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.event_id) {
      alert("Please select an event.");
      return;
    }
    if (!form.name.trim()) {
      alert("Please enter the sub-team name.");
      return;
    }

    const amt = form.amount.trim() ? Number(form.amount) : 0;
    if (!Number.isFinite(amt) || amt < 0) {
      alert("Please enter a valid amount (0 or more).");
      return;
    }

    try {
      setSaving(true);
      const res = await fetchWithAuth(`${API_URL}/sub-teams`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_id: Number(form.event_id),
          name: form.name.trim(),
          purpose: form.purpose.trim() || null,
          phone: form.phone.trim() || null,
          amount: amt,
          note: form.note.trim() || null,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.detail || "Failed to create sub-team.");
      }

      setSuccess(`Sub-team "${form.name.trim()}" added successfully.`);
      setModalOpen(false);
      setForm(EMPTY_FORM);
      await loadData();
      setTimeout(() => setSuccess(null), 3500);
    } catch (err: any) {
      alert(err.message || "Failed to save sub-team.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!window.confirm(`Are you sure you want to delete sub-team "${name}"?`)) {
      return;
    }
    try {
      const res = await fetchWithAuth(`${API_URL}/sub-teams/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete sub-team.");

      setSuccess(`Sub-team "${name}" deleted.`);
      await loadData();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      alert(err.message || "Unable to delete sub-team.");
    }
  };

  const getEventLabel = (eventId: number) => {
    const ev = events.find((e) => e.id === eventId);
    if (!ev) return `Event #${eventId}`;
    return ev.name || `Event #${eventId}`;
  };

  return (
    <main className="dashboard">
      <AppSidebar activeRoute="/sub-teams" />

      {/* Main Content */}
      <div className="main-content">
        {/* Topbar */}
        <header className="topbar">
          <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            <MobileMenuButton />
            <h1 style={{ margin: 0, fontSize: "19px", fontWeight: 700, color: "#24103f" }}>
              Sub Teams Management
            </h1>
            <span
              style={{
                fontSize: "12px",
                color: "#6b5b7e",
                background: "#f0edf5",
                padding: "4px 10px",
                borderRadius: "12px",
                fontWeight: 600,
              }}
            >
              {subTeams.length} Teams Registered
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            <div className="search-box">
              <span style={{ color: "#8a7b9b" }}>🔍</span>
              <input
                type="text"
                placeholder="Search sub teams, purpose, phone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ border: "none", background: "transparent", outline: "none", width: "100%", fontSize: "13px" }}
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  style={{ border: "none", background: "transparent", color: "#8a7b9b", cursor: "pointer", fontSize: "14px" }}
                >
                  ✕
                </button>
              )}
            </div>

            {!isOwner && (
              <button
                type="button"
                onClick={openAddModal}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  background: "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "8px",
                  padding: "8px 14px",
                  fontWeight: 700,
                  fontSize: "12px",
                  cursor: "pointer",
                  boxShadow: "0 4px 14px rgba(124, 58, 237, 0.35)",
                }}
              >
                <span>+</span> Add Sub Team
              </button>
            )}

            <TopbarUserBadge />
          </div>
        </header>

        {/* Content Body */}
        <div className="page-content">
          <OwnerBanner />

          {/* Notifications */}
          {success && (
            <div
              style={{
                background: "#e8f8f0",
                border: "1px solid #a3e6c0",
                color: "#0d6832",
                padding: "12px 18px",
                borderRadius: "8px",
                marginBottom: "20px",
                fontSize: "14px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span>✓ {success}</span>
              <button
                type="button"
                onClick={() => setSuccess(null)}
                style={{ border: "none", background: "transparent", color: "#0d6832", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>
          )}

          {error && (
            <div
              style={{
                background: "#fef2f2",
                border: "1px solid #fecaca",
                color: "#991b1b",
                padding: "12px 18px",
                borderRadius: "8px",
                marginBottom: "20px",
                fontSize: "14px",
              }}
            >
              ⚠ {error}
            </div>
          )}

          {/* Metric Summary Cards */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
              gap: "20px",
              marginBottom: "28px",
            }}
          >
            <div
              style={{
                background: "#fff",
                border: "1px solid #e9e5f0",
                borderRadius: "12px",
                padding: "20px",
                boxShadow: "0 2px 8px rgba(36, 16, 63, 0.04)",
              }}
            >
              <div style={{ fontSize: "12px", color: "#7a6e8a", fontWeight: 600, textTransform: "uppercase" }}>
                Total Sub Teams
              </div>
              <div style={{ fontSize: "26px", fontWeight: 800, color: "#24103f", marginTop: "8px" }}>
                {summary.totalCount}
              </div>
              <div style={{ fontSize: "12px", color: "#8d819e", marginTop: "6px" }}>
                Allocated across events
              </div>
            </div>

            <div
              style={{
                background: "#fff",
                border: "1px solid #e9e5f0",
                borderRadius: "12px",
                padding: "20px",
                boxShadow: "0 2px 8px rgba(36, 16, 63, 0.04)",
              }}
            >
              <div style={{ fontSize: "12px", color: "#7a6e8a", fontWeight: 600, textTransform: "uppercase" }}>
                Active Events With Teams
              </div>
              <div style={{ fontSize: "26px", fontWeight: 800, color: "#4f46e5", marginTop: "8px" }}>
                {summary.eventsCount}
              </div>
              <div style={{ fontSize: "12px", color: "#8d819e", marginTop: "6px" }}>
                Out of {events.length} total events
              </div>
            </div>

            <div
              style={{
                background: "linear-gradient(135deg, #f0fdf4 0%, #e6f9ed 100%)",
                border: "1px solid #bbf7d0",
                borderRadius: "12px",
                padding: "20px",
                boxShadow: "0 2px 8px rgba(22, 101, 52, 0.04)",
              }}
            >
              <div style={{ fontSize: "12px", color: "#166534", fontWeight: 600, textTransform: "uppercase" }}>
                Total Budget Committed
              </div>
              <div style={{ fontSize: "26px", fontWeight: 800, color: "#15803d", marginTop: "8px" }}>
                ₹{formatMoney(summary.totalAmount)}
              </div>
              <div style={{ fontSize: "12px", color: "#166534", marginTop: "6px", fontWeight: 600 }}>
                Combined sub-team allocations
              </div>
            </div>
          </div>

          {/* Sub Teams Table */}
          <div
            style={{
              background: "#fff",
              borderRadius: "12px",
              border: "1px solid #e9e5f0",
              overflow: "hidden",
              boxShadow: "0 2px 10px rgba(36, 16, 63, 0.03)",
            }}
          >
            {loading ? (
              <div style={{ padding: "48px", textAlign: "center", color: "#7a6e8a" }}>Loading sub-teams...</div>
            ) : filteredTeams.length === 0 ? (
              <div style={{ padding: "50px 20px", textAlign: "center" }}>
                <div style={{ fontSize: "36px", marginBottom: "12px" }}>♧</div>
                <h3 style={{ margin: "0 0 6px 0", color: "#24103f" }}>No sub-teams found</h3>
                <p style={{ color: "#7a6e8a", fontSize: "14px", margin: "0 0 16px 0" }}>
                  {search ? "Try adjusting your search keywords." : "Add a sub-team to assign duties, contacts, and budgets."}
                </p>
                {!isOwner && (
                  <button
                    type="button"
                    onClick={openAddModal}
                    style={{
                      background: "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)",
                      color: "#ffffff",
                      border: "none",
                      padding: "8px 16px",
                      borderRadius: "6px",
                      fontWeight: 700,
                      cursor: "pointer",
                      boxShadow: "0 4px 14px rgba(124, 58, 237, 0.35)",
                    }}
                  >
                    + Add First Sub Team
                  </button>
                )}
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", minWidth: "750px", borderCollapse: "collapse", fontSize: "13px", textAlign: "left" }}>
                  <thead>
                    <tr style={{ background: "#f8f7fb", borderBottom: "1px solid #e9e5f0", color: "#5d4e70", fontWeight: 600 }}>
                      <th style={{ padding: "14px 18px" }}>Sub Team Name</th>
                      <th style={{ padding: "14px 18px" }}>Linked Event</th>
                      <th style={{ padding: "14px 18px" }}>Purpose / Duty</th>
                      <th style={{ padding: "14px 18px" }}>Contact Phone</th>
                      <th style={{ padding: "14px 18px", textAlign: "right" }}>Committed Amount</th>
                      <th style={{ padding: "14px 18px" }}>Notes / Remarks</th>
                      <th style={{ padding: "14px 18px", textAlign: "center" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTeams.map((team) => (
                      <tr
                        key={team.id}
                        style={{
                          borderBottom: "1px solid #f2eff7",
                          transition: "background 0.15s ease",
                        }}
                      >
                        <td style={{ padding: "14px 18px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                            <div
                              style={{
                                width: "36px",
                                height: "36px",
                                borderRadius: "8px",
                                background: "#f3eaf7",
                                color: "#603b7d",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontWeight: 800,
                                fontSize: "14px",
                                flexShrink: 0,
                              }}
                            >
                              {team.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <strong style={{ color: "#24103f", display: "block" }}>{team.name}</strong>
                              <small style={{ color: "#8a7b9b" }}>Team #{team.id}</small>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: "14px 18px" }}>
                          <Link
                            href={`/events/${team.event_id}`}
                            style={{ color: "#4f46e5", fontWeight: 600, textDecoration: "none" }}
                          >
                            {getEventLabel(team.event_id)}
                          </Link>
                        </td>
                        <td style={{ padding: "14px 18px", color: "#3c2e4e" }}>
                          {team.purpose || <span style={{ color: "#a59cb3" }}>—</span>}
                        </td>
                        <td style={{ padding: "14px 18px", color: "#5d4e70" }}>
                          {team.phone || <span style={{ color: "#a59cb3" }}>—</span>}
                        </td>
                        <td style={{ padding: "14px 18px", textAlign: "right", fontWeight: 700, color: "#166534" }}>
                          ₹{formatMoney(team.amount)}
                        </td>
                        <td style={{ padding: "14px 18px", color: "#6b5b7e", maxWidth: "200px" }}>
                          {team.note || <span style={{ color: "#a59cb3" }}>—</span>}
                        </td>
                        <td style={{ padding: "14px 18px", textAlign: "center" }}>
                          <div style={{ display: "flex", justifyContent: "center", gap: "6px" }}>
                            <Link
                              href={`/events/${team.event_id}`}
                              style={{
                                padding: "4px 8px",
                                borderRadius: "4px",
                                background: "#f0edf5",
                                color: "#24103f",
                                fontSize: "12px",
                                fontWeight: 600,
                                textDecoration: "none",
                              }}
                            >
                              Event
                            </Link>
                            {!isOwner && (
                              <button
                                type="button"
                                onClick={() => handleDelete(team.id, team.name)}
                                style={{
                                  padding: "4px 8px",
                                  borderRadius: "4px",
                                  background: "#fee2e2",
                                  color: "#b91c1c",
                                  border: "none",
                                  fontSize: "12px",
                                  fontWeight: 600,
                                  cursor: "pointer",
                                }}
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ADD SUB TEAM MODAL */}
      {modalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(18, 8, 32, 0.65)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "20px",
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: "16px",
              width: "100%",
              maxWidth: "520px",
              boxShadow: "0 20px 50px rgba(0, 0, 0, 0.25)",
              overflow: "hidden",
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: "20px 24px",
                background: "linear-gradient(135deg, #180828 0%, #2b0c4c 100%)",
                color: "#fff",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: "17px", fontWeight: 700 }}>Add Sub Team</h3>
                <span style={{ fontSize: "12px", color: "#c084fc" }}>Assign crew & budgets to an event</span>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                style={{
                  background: "rgba(255, 255, 255, 0.15)",
                  border: "none",
                  color: "#fff",
                  borderRadius: "50%",
                  width: "28px",
                  height: "28px",
                  cursor: "pointer",
                  fontSize: "14px",
                }}
              >
                ✕
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmit} style={{ padding: "24px" }}>
              <div style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#3c2e4e", marginBottom: "6px" }}>
                  Select Event *
                </label>
                <select
                  required
                  value={form.event_id}
                  onChange={(e) => setForm({ ...form, event_id: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: "1px solid #d8d3e2",
                    fontSize: "13px",
                    background: "#faf9fc",
                  }}
                >
                  <option value="">-- Choose an Event --</option>
                  {events.map((ev) => (
                    <option key={ev.id} value={ev.id}>
                      {ev.name}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#3c2e4e", marginBottom: "6px" }}>
                  Sub Team Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Stage Sound & Lights Crew, Welcome Team"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: "1px solid #d8d3e2",
                    fontSize: "13px",
                  }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginBottom: "16px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#3c2e4e", marginBottom: "6px" }}>
                    Purpose / Responsibility
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Stage Decor, Sound"
                    value={form.purpose}
                    onChange={(e) => setForm({ ...form, purpose: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: "8px",
                      border: "1px solid #d8d3e2",
                      fontSize: "13px",
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#3c2e4e", marginBottom: "6px" }}>
                    Contact Phone
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 9876543210"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: "8px",
                      border: "1px solid #d8d3e2",
                      fontSize: "13px",
                    }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#3c2e4e", marginBottom: "6px" }}>
                  Allocated Amount (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: "1px solid #d8d3e2",
                    fontSize: "14px",
                    fontWeight: 700,
                    color: "#166534",
                  }}
                />
              </div>

              <div style={{ marginBottom: "24px" }}>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#3c2e4e", marginBottom: "6px" }}>
                  Remarks / Notes
                </label>
                <input
                  type="text"
                  placeholder="Optional details or instructions..."
                  value={form.note}
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: "1px solid #d8d3e2",
                    fontSize: "13px",
                  }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setModalOpen(false)}
                  style={{
                    padding: "10px 18px",
                    borderRadius: "8px",
                    border: "1px solid #dcd7e5",
                    background: "#fff",
                    color: "#5d4e70",
                    fontWeight: 600,
                    fontSize: "13px",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    padding: "10px 22px",
                    borderRadius: "8px",
                    border: "none",
                    background: "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)",
                    color: "#ffffff",
                    fontWeight: 700,
                    fontSize: "13px",
                    cursor: saving ? "not-allowed" : "pointer",
                    boxShadow: "0 4px 14px rgba(124, 58, 237, 0.35)",
                  }}
                >
                  {saving ? "Saving..." : "Save Sub Team"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
