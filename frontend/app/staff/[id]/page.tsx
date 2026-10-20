"use client";

import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useAuth, fetchWithAuth } from "../../lib/auth";
import { SidebarUserCard, OwnerBanner, NavLink, TopbarUserBadge, AppSidebar, MobileMenuButton } from "../../components/AuthBar";

const API_URL = typeof window !== "undefined" ? "/api/py" : "http://127.0.0.1:8000";

type WorkedEvent = {
  event_id: number;
  date: string | null;
  event_type: string;
  place: string;
  customer_name: string;
  customer_mobile?: string | null;
  role_name?: string | null;
  wage: number;
  paid: number;
  balance: number;
  status: string;
};

type PaymentRecord = {
  id: number;
  event_id?: number | null;
  amount: number;
  payment: number;
  payment_date: string | null;
  note?: string | null;
  event_type?: string;
  place?: string | null;
};

type StaffDetails = {
  id: number;
  name: string;
  mobile: string;
  role_id?: number | null;
  role_name?: string | null;
  wage: number;
  daily_wage: number;
  salary?: number | string | null;
  address?: string | null;
  total_earnings: number;
  total_paid: number;
  pending_balance: number;
  events_count: number;
  worked_events: WorkedEvent[];
  payments: PaymentRecord[];
};

type EventOption = {
  id: number;
  date: string;
  customer_name: string;
  event_type: string;
  place: string;
};

function formatMoney(amount: number | null | undefined): string {
  return Number(amount ?? 0).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  });
}

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return "-";
  const parsed = new Date(`${dateStr.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return dateStr;
  return parsed.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function StaffDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const staffId = params?.id as string;
  const { user, isOwner, isManager } = useAuth();

  const [staff, setStaff] = useState<StaffDetails | null>(null);
  const [allEvents, setAllEvents] = useState<EventOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Tabs: 'events' | 'payments'
  const [activeTab, setActiveTab] = useState<"events" | "payments">("events");

  // Payment Modal
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [payAmount, setPayAmount] = useState("");
  const [payEventId, setPayEventId] = useState<number | "">("");
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10));
  const [payNote, setPayNote] = useState("");
  const [submittingPayment, setSubmittingPayment] = useState(false);

  const loadStaffDetails = useCallback(async () => {
    if (!staffId) return;
    try {
      setLoading(true);
      setError(null);

      const [staffRes, eventsRes] = await Promise.all([
        fetch(`${API_URL}/staff/${staffId}`, { cache: "no-store" }),
        fetch(`${API_URL}/events`, { cache: "no-store" }),
      ]);

      if (!staffRes.ok) {
        throw new Error(`Failed to load staff details (Status: ${staffRes.status})`);
      }

      const staffData = await staffRes.json();
      setStaff(staffData);

      if (eventsRes.ok) {
        const eventsData = await eventsRes.json();
        setAllEvents(
          Array.isArray(eventsData)
            ? eventsData.map((e: any) => ({
                id: e.id,
                date: e.date,
                customer_name: e.customer_name || `Customer #${e.customer_id}`,
                event_type: e.event_type || "Event",
                place: e.place || "",
              }))
            : []
        );
      }
    } catch (err: any) {
      console.error("Error loading staff data:", err);
      setError(err.message || "Failed to load staff details.");
    } finally {
      setLoading(false);
    }
  }, [staffId]);

  useEffect(() => {
    loadStaffDetails();
  }, [loadStaffDetails]);

  const openPayModal = (presetEventId?: number) => {
    if (!staff) return;
    setPayEventId(presetEventId ?? (staff.worked_events[0]?.event_id || ""));
    if (presetEventId) {
      const targetEv = staff.worked_events.find((e) => e.event_id === presetEventId);
      if (targetEv && targetEv.balance > 0) {
        setPayAmount(String(targetEv.balance));
      } else if (staff.pending_balance > 0) {
        setPayAmount(String(staff.pending_balance));
      } else {
        setPayAmount(String(staff.daily_wage || ""));
      }
      setPayNote(`Wage payout for Event #${presetEventId}`);
    } else if (staff.pending_balance > 0) {
      setPayAmount(String(staff.pending_balance));
      setPayNote("");
    } else {
      setPayAmount(String(staff.daily_wage || ""));
      setPayNote("");
    }
    setPayDate(new Date().toISOString().slice(0, 10));
    setPayModalOpen(true);
  };

  const handleRecordPayment = async (e: FormEvent) => {
    e.preventDefault();
    if (!staff) return;

    const amt = parseFloat(payAmount);
    if (!amt || amt <= 0) {
      alert("Please enter a valid wage payment amount greater than zero.");
      return;
    }

    try {
      setSubmittingPayment(true);
      const payload: any = {
        staff_id: staff.id,
        amount: amt,
        payment: amt,
        payment_date: payDate,
        note: payNote.trim() || undefined,
      };

      if (payEventId) {
        payload.event_id = Number(payEventId);
      }

      const res = await fetchWithAuth(`${API_URL}/staff-payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.detail || "Failed to record staff wage payment.");
      }

      setSuccessMsg(`Disbursed ₹${formatMoney(amt)} to ${staff.name} successfully.`);
      setPayModalOpen(false);
      await loadStaffDetails();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      alert(err.message || "Failed to record payment.");
    } finally {
      setSubmittingPayment(false);
    }
  };

  const handleDeletePayment = async (paymentId: number) => {
    if (!window.confirm("Are you sure you want to delete this wage disbursement record?")) {
      return;
    }

    try {
      const res = await fetchWithAuth(`${API_URL}/staff-payments/${paymentId}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Failed to delete staff payment");

      setSuccessMsg("Wage disbursement record deleted.");
      await loadStaffDetails();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      alert(err.message || "Failed to delete payment.");
    }
  };

  if (loading) {
    return (
      <main className="dashboard">
        <AppSidebar activeRoute="/staff" />
        <div className="main-content" style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "80vh" }}>
          <div style={{ textAlign: "center", color: "#6e5d82" }}>
            <div style={{ fontSize: "32px", marginBottom: "12px" }}>⏳</div>
            <h3>Loading Staff Details...</h3>
          </div>
        </div>
      </main>
    );
  }

  if (error || !staff) {
    return (
      <main className="dashboard">
        <AppSidebar activeRoute="/staff" />
        <div className="main-content page-content" style={{ padding: "40px" }}>
          <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "12px", padding: "24px", color: "#991b1b" }}>
            <h3>Error Loading Staff Member</h3>
            <p>{error || "Staff record not found."}</p>
            <Link
              href="/staff"
              style={{
                display: "inline-block",
                marginTop: "12px",
                background: "#24103f",
                color: "#fff",
                padding: "8px 16px",
                borderRadius: "6px",
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              ← Back to Staff Directory
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="dashboard">
      <AppSidebar activeRoute="/staff" />

      {/* Main Content */}
      <div className="main-content">
        {/* Top Header */}
        <header
          className="topbar"
          style={{
            minHeight: "72px",
            height: "auto",
            padding: "12px 24px",
            background: "#ffffff",
            borderBottom: "1px solid #e2e8f0",
            gap: "12px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0, flex: "1 1 260px" }}>
            <MobileMenuButton />
            <Link
              href="/staff"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                height: "38px",
                color: "#6b5b7e",
                textDecoration: "none",
                fontSize: "13px",
                fontWeight: 600,
                background: "#f0edf5",
                padding: "0 14px",
                borderRadius: "8px",
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}
            >
              ← Staff List
            </Link>
            <h1 style={{ margin: 0, fontSize: "20px", fontWeight: 700, color: "#24103f", whiteSpace: "nowrap" }}>
              {staff.name}
            </h1>
            <span
              style={{
                fontSize: "12px",
                fontWeight: 700,
                background: "#f3eaf7",
                color: "#603b7d",
                padding: "4px 10px",
                borderRadius: "12px",
                whiteSpace: "nowrap",
              }}
            >
              {staff.role_name || "General Staff"}
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", justifyContent: "flex-end", flex: "1 1 auto" }}>
            {!isOwner && (
              <button
                type="button"
                onClick={() => openPayModal()}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  height: "38px",
                  background: "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "8px",
                  padding: "0 16px",
                  fontWeight: 700,
                  fontSize: "12px",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                  boxShadow: "0 2px 6px rgba(124, 58, 237, 0.25)",
                }}
              >
                <span>+</span> Record Wage Payment
              </button>
            )}
            <TopbarUserBadge />
          </div>
        </header>

        {/* Content Body */}
        <div className="page-content">
          <OwnerBanner />

          {/* Notifications */}
          {successMsg && (
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
              <span>✓ {successMsg}</span>
              <button
                type="button"
                onClick={() => setSuccessMsg(null)}
                style={{ border: "none", background: "transparent", color: "#0d6832", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>
          )}

          {/* Profile Card & Info Banner */}
          <div
            style={{
              background: "#fff",
              border: "1px solid #e9e5f0",
              borderRadius: "14px",
              padding: "24px",
              marginBottom: "24px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "20px",
              boxShadow: "0 2px 8px rgba(36, 16, 63, 0.03)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "18px" }}>
              <div
                style={{
                  width: "60px",
                  height: "60px",
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)",
                  color: "#ffffff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "22px",
                  fontWeight: 800,
                  flexShrink: 0,
                  boxShadow: "0 4px 16px rgba(124, 58, 237, 0.35)",
                }}
              >
                {staff.name.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <h2 style={{ margin: "0 0 4px 0", fontSize: "20px", color: "#1e0836" }}>{staff.name}</h2>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "14px", color: "#6c5e7e", fontSize: "13px" }}>
                  <span>📞 <strong>{staff.mobile}</strong></span>
                  <span>🏷️ Role: <strong>{staff.role_name || "General Staff"}</strong></span>
                  {staff.address && <span>📍 {staff.address}</span>}
                  <span>💵 Standard Wage: <strong>₹{formatMoney(staff.daily_wage)}/event</strong></span>
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
              <button
                type="button"
                onClick={() => openPayModal()}
                style={{
                  background: "#24103f",
                  color: "#fff",
                  border: "none",
                  borderRadius: "8px",
                  padding: "9px 16px",
                  fontWeight: 700,
                  fontSize: "13px",
                  cursor: "pointer",
                }}
              >
                + Disburse Payment
              </button>
            </div>
          </div>

          {/* Financial Overview Metrics */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
              gap: "20px",
              marginBottom: "28px",
            }}
          >
            {/* Total Earnings */}
            <div
              style={{
                background: "#fff",
                border: "1px solid #e9e5f0",
                borderRadius: "12px",
                padding: "20px",
                boxShadow: "0 2px 8px rgba(36, 16, 63, 0.04)",
              }}
            >
              <div style={{ fontSize: "12px", color: "#7a6e8a", fontWeight: 600, letterSpacing: "0.5px", textTransform: "uppercase" }}>
                Total Earnings (Worked)
              </div>
              <div style={{ fontSize: "26px", fontWeight: 800, color: "#24103f", marginTop: "8px" }}>
                ₹{formatMoney(staff.total_earnings)}
              </div>
              <div style={{ fontSize: "12px", color: "#8d819e", marginTop: "6px" }}>
                Earned across {staff.events_count} event allocations
              </div>
            </div>

            {/* Total Paid */}
            <div
              style={{
                background: "linear-gradient(135deg, #f0fdf4 0%, #e6f9ed 100%)",
                border: "1px solid #bbf7d0",
                borderRadius: "12px",
                padding: "20px",
                boxShadow: "0 2px 8px rgba(22, 101, 52, 0.04)",
              }}
            >
              <div style={{ fontSize: "12px", color: "#166534", fontWeight: 600, letterSpacing: "0.5px", textTransform: "uppercase" }}>
                Total Wages Disbursed
              </div>
              <div style={{ fontSize: "26px", fontWeight: 800, color: "#15803d", marginTop: "8px" }}>
                ₹{formatMoney(staff.total_paid)}
              </div>
              <div style={{ fontSize: "12px", color: "#166534", marginTop: "6px", fontWeight: 500 }}>
                {staff.payments.length} payout records logged
              </div>
            </div>

            {/* Pending Balance */}
            <div
              style={{
                background:
                  staff.pending_balance > 0
                    ? "linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)"
                    : "#fff",
                border:
                  staff.pending_balance > 0 ? "1px solid #fde68a" : "1px solid #e9e5f0",
                borderRadius: "12px",
                padding: "20px",
                boxShadow: "0 2px 8px rgba(180, 83, 9, 0.04)",
              }}
            >
              <div
                style={{
                  fontSize: "12px",
                  color: staff.pending_balance > 0 ? "#92400e" : "#7a6e8a",
                  fontWeight: 600,
                  letterSpacing: "0.5px",
                  textTransform: "uppercase",
                }}
              >
                Pending Wage Balance
              </div>
              <div
                style={{
                  fontSize: "26px",
                  fontWeight: 800,
                  color: staff.pending_balance > 0 ? "#b45309" : "#166534",
                  marginTop: "8px",
                }}
              >
                ₹{formatMoney(staff.pending_balance)}
              </div>
              <div
                style={{
                  fontSize: "12px",
                  color: staff.pending_balance > 0 ? "#92400e" : "#15803d",
                  marginTop: "6px",
                  fontWeight: 600,
                }}
              >
                {staff.pending_balance > 0 ? "⚠️ Payment pending collection" : "✓ All wages settled"}
              </div>
            </div>

            {/* Events Worked Count */}
            <div
              style={{
                background: "#fff",
                border: "1px solid #e9e5f0",
                borderRadius: "12px",
                padding: "20px",
                boxShadow: "0 2px 8px rgba(36, 16, 63, 0.04)",
              }}
            >
              <div style={{ fontSize: "12px", color: "#7a6e8a", fontWeight: 600, letterSpacing: "0.5px", textTransform: "uppercase" }}>
                Events Count
              </div>
              <div style={{ fontSize: "26px", fontWeight: 800, color: "#4f46e5", marginTop: "8px" }}>
                {staff.events_count}
              </div>
              <div style={{ fontSize: "12px", color: "#8d819e", marginTop: "6px" }}>
                Assigned event projects
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div
            style={{
              display: "flex",
              justifyContent: "flex-start",
              alignItems: "center",
              borderBottom: "1px solid #e5e0ed",
              marginBottom: "20px",
              overflowX: "auto",
              WebkitOverflowScrolling: "touch",
            }}
          >
            <div style={{ display: "flex", gap: "20px", whiteSpace: "nowrap" }}>
              <button
                type="button"
                onClick={() => setActiveTab("events")}
                style={{
                  background: "transparent",
                  border: "none",
                  borderBottom: activeTab === "events" ? "3px solid #7c3aed" : "3px solid transparent",
                  padding: "12px 6px",
                  fontSize: "14px",
                  fontWeight: activeTab === "events" ? 700 : 500,
                  color: activeTab === "events" ? "#7c3aed" : "#6c5e7e",
                  cursor: "pointer",
                }}
              >
                Where He Worked & Event Wage List ({staff.worked_events.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("payments")}
                style={{
                  background: "transparent",
                  border: "none",
                  borderBottom: activeTab === "payments" ? "3px solid #7c3aed" : "3px solid transparent",
                  padding: "12px 6px",
                  fontSize: "14px",
                  fontWeight: activeTab === "payments" ? 700 : 500,
                  color: activeTab === "payments" ? "#7c3aed" : "#6c5e7e",
                  cursor: "pointer",
                }}
              >
                Wage Disbursements History ({staff.payments.length})
              </button>
            </div>
          </div>

          {/* TAB 1: WORKED EVENTS */}
          {activeTab === "events" && (
            <div
              style={{
                background: "#fff",
                borderRadius: "12px",
                border: "1px solid #e9e5f0",
                overflow: "hidden",
                boxShadow: "0 2px 10px rgba(36, 16, 63, 0.03)",
              }}
            >
              {staff.worked_events.length === 0 ? (
                <div style={{ padding: "50px 20px", textAlign: "center" }}>
                  <div style={{ fontSize: "36px", marginBottom: "12px" }}>▣</div>
                  <h3 style={{ margin: "0 0 6px 0", color: "#1e0836" }}>No worked events logged yet</h3>
                  <p style={{ color: "#7a6e8a", fontSize: "14px", margin: "0 0 16px 0" }}>
                    When {staff.name} is assigned to events or wages are disbursed, they will automatically appear here with their event wage breakdown.
                  </p>
                  <Link
                    href="/events"
                    style={{
                      display: "inline-block",
                      background: "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)",
                      color: "#ffffff",
                      padding: "10px 18px",
                      borderRadius: "8px",
                      fontWeight: 700,
                      textDecoration: "none",
                      boxShadow: "0 4px 14px rgba(124, 58, 237, 0.3)",
                    }}
                  >
                    Go to Events
                  </Link>
                </div>
              ) : (
                <div className="table-responsive" style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", minWidth: "750px", borderCollapse: "collapse", fontSize: "13px", textAlign: "left" }}>
                    <thead>
                      <tr style={{ background: "#f8f7fb", borderBottom: "1px solid #e9e5f0", color: "#5d4e70", fontWeight: 600 }}>
                        <th style={{ padding: "14px 18px" }}>Event # / Date</th>
                        <th style={{ padding: "14px 18px" }}>Event Type & Venue</th>
                        <th style={{ padding: "14px 18px" }}>Customer</th>
                        <th style={{ padding: "14px 18px" }}>Assigned Duty / Role</th>
                        <th style={{ padding: "14px 18px", textAlign: "right" }}>Event Wage Due</th>
                        <th style={{ padding: "14px 18px", textAlign: "right" }}>Wage Paid</th>
                        <th style={{ padding: "14px 18px", textAlign: "right" }}>Wage Balance</th>
                        <th style={{ padding: "14px 18px", textAlign: "center" }}>Status</th>
                        <th style={{ padding: "14px 18px", textAlign: "center" }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {staff.worked_events.map((ev) => {
                        const isSettled = ev.balance <= 0 && ev.paid > 0;
                        const isPartial = ev.paid > 0 && ev.balance > 0;
                        return (
                          <tr
                            key={ev.event_id}
                            style={{
                              borderBottom: "1px solid #f2eff7",
                              transition: "background 0.15s ease",
                            }}
                          >
                            <td style={{ padding: "14px 18px" }}>
                              <Link
                                href={`/events/${ev.event_id}`}
                                style={{ fontWeight: 700, color: "#24103f", textDecoration: "none" }}
                              >
                                Event #{ev.event_id}
                              </Link>
                              <div style={{ fontSize: "12px", color: "#7a6e8a", marginTop: "3px" }}>
                                📅 {formatDate(ev.date)}
                              </div>
                            </td>
                            <td style={{ padding: "14px 18px" }}>
                              <div style={{ fontWeight: 600, color: "#24103f" }}>{ev.event_type}</div>
                              <div style={{ fontSize: "12px", color: "#7a6e8a", marginTop: "2px" }}>
                                📍 {ev.place || "Venue not set"}
                              </div>
                            </td>
                            <td style={{ padding: "14px 18px" }}>
                              <div style={{ fontWeight: 600, color: "#24103f" }}>{ev.customer_name}</div>
                              {ev.customer_mobile && (
                                <div style={{ fontSize: "11px", color: "#7a6e8a", marginTop: "2px" }}>
                                  📞 {ev.customer_mobile}
                                </div>
                              )}
                            </td>
                            <td style={{ padding: "14px 18px" }}>
                              <span
                                style={{
                                  display: "inline-block",
                                  padding: "3px 9px",
                                  borderRadius: "10px",
                                  fontSize: "11px",
                                  fontWeight: 700,
                                  background: "#f3eaf7",
                                  color: "#603b7d",
                                }}
                              >
                                {ev.role_name || staff.role_name || "General Staff"}
                              </span>
                            </td>
                            <td style={{ padding: "14px 18px", textAlign: "right", fontWeight: 700, color: "#24103f" }}>
                              ₹{formatMoney(ev.wage)}
                            </td>
                            <td style={{ padding: "14px 18px", textAlign: "right", fontWeight: 700, color: "#166534" }}>
                              ₹{formatMoney(ev.paid)}
                            </td>
                            <td
                              style={{
                                padding: "14px 18px",
                                textAlign: "right",
                                fontWeight: 800,
                                color: ev.balance > 0 ? "#b45309" : "#166534",
                              }}
                            >
                              ₹{formatMoney(ev.balance)}
                            </td>
                            <td style={{ padding: "14px 18px", textAlign: "center" }}>
                              <span
                                style={{
                                  display: "inline-block",
                                  padding: "3px 9px",
                                  borderRadius: "12px",
                                  fontSize: "11px",
                                  fontWeight: 700,
                                  background: isSettled ? "#dcfce7" : isPartial ? "#fef3c7" : "#fee2e2",
                                  color: isSettled ? "#15803d" : isPartial ? "#b45309" : "#b91c1c",
                                }}
                              >
                                {isSettled ? "Settled" : isPartial ? "Partially Paid" : "Unpaid"}
                              </span>
                            </td>
                            <td style={{ padding: "14px 18px", textAlign: "center", whiteSpace: "nowrap" }}>
                              <div style={{ display: "flex", justifyContent: "center", gap: "6px" }}>
                                {ev.balance > 0 && !isOwner && (
                                  <button
                                    type="button"
                                    onClick={() => openPayModal(ev.event_id)}
                                    style={{
                                      background: "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)",
                                      color: "#ffffff",
                                      border: "none",
                                      borderRadius: "5px",
                                      padding: "5px 10px",
                                      fontSize: "12px",
                                      fontWeight: 700,
                                      cursor: "pointer",
                                      boxShadow: "0 2px 8px rgba(124, 58, 237, 0.25)",
                                    }}
                                  >
                                    Pay Wage
                                  </button>
                                )}
                                <Link
                                  href={`/events/${ev.event_id}`}
                                  style={{
                                    background: "#f0edf5",
                                    color: "#24103f",
                                    borderRadius: "5px",
                                    padding: "5px 10px",
                                    fontSize: "12px",
                                    fontWeight: 600,
                                    textDecoration: "none",
                                  }}
                                >
                                  Event
                                </Link>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: WAGE DISBURSEMENTS HISTORY */}
          {activeTab === "payments" && (
            <div
              style={{
                background: "#fff",
                borderRadius: "12px",
                border: "1px solid #e9e5f0",
                overflow: "hidden",
                boxShadow: "0 2px 10px rgba(36, 16, 63, 0.03)",
              }}
            >
              {staff.payments.length === 0 ? (
                <div style={{ padding: "50px 20px", textAlign: "center" }}>
                  <div style={{ fontSize: "36px", marginBottom: "12px" }}>💵</div>
                  <h3 style={{ margin: "0 0 6px 0", color: "#24103f" }}>No wage disbursements recorded yet</h3>
                  <p style={{ color: "#7a6e8a", fontSize: "14px", margin: "0 0 16px 0" }}>
                    Record payments made to this staff member when wages are paid out.
                  </p>
                  {!isOwner && (
                    <button
                      type="button"
                      onClick={() => openPayModal()}
                      style={{
                        background: "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)",
                        color: "#ffffff",
                        border: "none",
                        padding: "10px 18px",
                        borderRadius: "8px",
                        fontWeight: 700,
                        cursor: "pointer",
                        boxShadow: "0 4px 14px rgba(124, 58, 237, 0.3)",
                      }}
                    >
                      + Record First Payment
                    </button>
                  )}
                </div>
              ) : (
                <div className="table-responsive" style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", minWidth: "700px", borderCollapse: "collapse", fontSize: "13px", textAlign: "left" }}>
                    <thead>
                      <tr style={{ background: "#f8f7fb", borderBottom: "1px solid #e9e5f0", color: "#5d4e70", fontWeight: 600 }}>
                        <th style={{ padding: "14px 18px" }}>Disbursement Date</th>
                        <th style={{ padding: "14px 18px" }}>Record #</th>
                        <th style={{ padding: "14px 18px" }}>Event Reference</th>
                        <th style={{ padding: "14px 18px" }}>Notes / Remarks</th>
                        <th style={{ padding: "14px 18px", textAlign: "right" }}>Amount Paid</th>
                        <th style={{ padding: "14px 18px", textAlign: "center" }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {staff.payments.map((p) => (
                        <tr
                          key={p.id}
                          style={{
                            borderBottom: "1px solid #f2eff7",
                            transition: "background 0.15s ease",
                          }}
                        >
                          <td style={{ padding: "14px 18px", fontWeight: 600, color: "#24103f", whiteSpace: "nowrap" }}>
                            {formatDate(p.payment_date)}
                          </td>
                          <td style={{ padding: "14px 18px", color: "#8a7b9b", fontFamily: "monospace" }}>
                            #SP-{String(p.id).padStart(4, "0")}
                          </td>
                          <td style={{ padding: "14px 18px" }}>
                            {p.event_id ? (
                              <Link
                                href={`/events/${p.event_id}`}
                                style={{ color: "#4f46e5", fontWeight: 600, textDecoration: "none" }}
                              >
                                Event #{p.event_id} ({p.event_type || "Event"})
                              </Link>
                            ) : (
                              <span style={{ color: "#8a7b9b", background: "#f8f7fb", padding: "2px 6px", borderRadius: "4px" }}>
                                General Wage Advance
                              </span>
                            )}
                          </td>
                          <td style={{ padding: "14px 18px", color: "#5d4e70", maxWidth: "250px" }}>
                            {p.note || "-"}
                          </td>
                          <td style={{ padding: "14px 18px", textAlign: "right", fontWeight: 800, color: "#166534", fontSize: "14px" }}>
                            ₹{formatMoney(p.amount || p.payment)}
                          </td>
                          <td style={{ padding: "14px 18px", textAlign: "center" }}>
                            {!isOwner && (
                              <button
                                type="button"
                                onClick={() => handleDeletePayment(p.id)}
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
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* RECORD WAGE PAYMENT MODAL */}
      {payModalOpen && (
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
            padding: "16px",
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: "16px",
              width: "100%",
              maxWidth: "520px",
              maxHeight: "90vh",
              overflowY: "auto",
              boxShadow: "0 20px 50px rgba(0, 0, 0, 0.25)",
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
                <h3 style={{ margin: 0, fontSize: "17px", fontWeight: 700 }}>Record Staff Wage Payment</h3>
                <span style={{ fontSize: "12px", color: "#c084fc" }}>
                  Disbursement to {staff.name} ({staff.role_name || "Staff"})
                </span>
              </div>
              <button
                type="button"
                onClick={() => setPayModalOpen(false)}
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
            <form onSubmit={handleRecordPayment} style={{ padding: "24px" }}>
              {/* Event Selector */}
              <div style={{ marginBottom: "18px" }}>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#3c2e4e", marginBottom: "6px" }}>
                  Link to Event (Optional)
                </label>
                <select
                  value={payEventId}
                  onChange={(e) => setPayEventId(e.target.value ? Number(e.target.value) : "")}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: "1px solid #d8d3e2",
                    fontSize: "13px",
                    background: "#faf9fc",
                  }}
                >
                  <option value="">-- None (General Advance / Monthly Disbursement) --</option>
                  {allEvents.map((ev) => (
                    <option key={ev.id} value={ev.id}>
                      Event #{ev.id} - {ev.customer_name} ({ev.event_type}, {formatDate(ev.date)})
                    </option>
                  ))}
                </select>
              </div>

              {/* Pending Balance Notice & Auto-Fill */}
              {staff.pending_balance > 0 && (
                <div
                  style={{
                    background: "#fef9ee",
                    borderRadius: "8px",
                    padding: "12px 14px",
                    marginBottom: "18px",
                    border: "1px solid #f9e2b2",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <div style={{ fontSize: "11px", color: "#92400e", fontWeight: 600, textTransform: "uppercase" }}>
                      Current Pending Wage Balance
                    </div>
                    <div style={{ fontSize: "15px", fontWeight: 800, color: "#b45309", marginTop: "2px" }}>
                      ₹{formatMoney(staff.pending_balance)}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPayAmount(String(staff.pending_balance))}
                    style={{
                      background: "#f5f3ff",
                      border: "1px solid #ddd6fe",
                      color: "#6d28d9",
                      borderRadius: "6px",
                      padding: "5px 10px",
                      fontSize: "11px",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    Fill Full Balance
                  </button>
                </div>
              )}

              {/* Amount & Date row */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginBottom: "18px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#3c2e4e", marginBottom: "6px" }}>
                    Payment Amount (₹) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    placeholder="e.g. 700"
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    required
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: "8px",
                      border: "1px solid #d8d3e2",
                      fontSize: "14px",
                      fontWeight: 700,
                      color: "#166534",
                      background: "#fff",
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#3c2e4e", marginBottom: "6px" }}>
                    Payment Date *
                  </label>
                  <input
                    type="date"
                    value={payDate}
                    onChange={(e) => setPayDate(e.target.value)}
                    required
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: "8px",
                      border: "1px solid #d8d3e2",
                      fontSize: "13px",
                      background: "#fff",
                    }}
                  />
                </div>
              </div>

              {/* Note / Remarks */}
              <div style={{ marginBottom: "24px" }}>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#3c2e4e", marginBottom: "6px" }}>
                  Remarks / Notes (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Wages paid for wedding duty, Cash in hand"
                  value={payNote}
                  onChange={(e) => setPayNote(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: "1px solid #d8d3e2",
                    fontSize: "13px",
                    background: "#fff",
                  }}
                />
              </div>

              {/* Action Buttons */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
                <button
                  type="button"
                  onClick={() => setPayModalOpen(false)}
                  disabled={submittingPayment}
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
                  disabled={submittingPayment}
                  style={{
                    padding: "10px 22px",
                    borderRadius: "8px",
                    border: "none",
                    background: "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)",
                    color: "#ffffff",
                    fontWeight: 700,
                    fontSize: "13px",
                    cursor: submittingPayment ? "not-allowed" : "pointer",
                    boxShadow: "0 4px 14px rgba(124, 58, 237, 0.3)",
                  }}
                >
                  {submittingPayment ? "Recording..." : "Record Wage Payment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
