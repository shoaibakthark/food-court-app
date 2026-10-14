"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties, FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth, fetchWithAuth } from "../lib/auth";
import { SidebarUserCard, OwnerBanner, NavLink, TopbarUserBadge, AppSidebar, MobileMenuButton } from "../components/AuthBar";

const API_URL = typeof window !== "undefined" ? "/api/py" : "http://127.0.0.1:8000";

type PaymentRecord = {
  id: number;
  event_id: number;
  amount: number;
  payment_method: string;
  payment_type: string;
  payment_date: string;
  note?: string | null;
  event_type?: string;
  event_date?: string | null;
  place?: string | null;
  customer_name?: string | null;
  customer_mobile?: string | null;
  quote?: number;
};

type EventSummary = {
  id: number;
  date: string;
  place: string;
  event_type: string;
  customer_name: string;
  guest_count: number;
  food_amt: number;
  decor_amt: number;
  total_estimate: number;
  quote: number | null;
  paid_amount: number;
  balance: number;
};

type StaffPaymentRecord = {
  id: number;
  staff_id: number;
  event_id?: number | null;
  amount: number;
  payment_date: string;
  note?: string | null;
  staff_name?: string;
  staff_role?: string;
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

export default function PaymentsPage() {
  const router = useRouter();
  const { user, isOwner, isManager } = useAuth();

  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [staffPayments, setStaffPayments] = useState<StaffPaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Tab: 'payments' | 'receivables' | 'staff'
  const [activeTab, setActiveTab] = useState<"payments" | "receivables" | "staff">("payments");
  const [searchQuery, setSearchQuery] = useState("");
  const [methodFilter, setMethodFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<number | "">("");
  const [paymentAmount, setPaymentAmount] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [paymentType, setPaymentType] = useState("Advance");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [paymentNote, setPaymentNote] = useState("");

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [paymentsRes, eventsRes, staffPaymentsRes] = await Promise.all([
        fetch(`${API_URL}/payments`, { cache: "no-store" }),
        fetch(`${API_URL}/events`, { cache: "no-store" }),
        fetch(`${API_URL}/staff-payments`, { cache: "no-store" }),
      ]);

      if (paymentsRes.ok) {
        const pData = await paymentsRes.json();
        setPayments(Array.isArray(pData) ? pData : []);
      }

      if (eventsRes.ok) {
        const eData = await eventsRes.json();
        setEvents(Array.isArray(eData) ? eData : []);
      }

      if (staffPaymentsRes.ok) {
        const spData = await staffPaymentsRes.json();
        setStaffPayments(Array.isArray(spData) ? spData : []);
      }
    } catch (err) {
      console.error("Failed to load payments data:", err);
      setError("Unable to connect to the server. Please ensure the backend is running.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Financial Metrics Calculation
  const metrics = useMemo(() => {
    let totalQuoted = 0;
    let totalCollected = 0;
    let totalBalanceDue = 0;

    events.forEach((ev) => {
      const quoteVal = ev.quote ?? ev.total_estimate ?? 0;
      const paidVal = ev.paid_amount ?? 0;
      totalQuoted += quoteVal;
      totalCollected += paidVal;
      totalBalanceDue += Math.max(0, quoteVal - paidVal);
    });

    const collectionRate = totalQuoted > 0 ? (totalCollected / totalQuoted) * 100 : 0;
    const staffDisbursed = staffPayments.reduce((acc, p) => acc + (p.amount || 0), 0);

    return {
      totalQuoted,
      totalCollected,
      totalBalanceDue,
      collectionRate,
      staffDisbursed,
    };
  }, [events, staffPayments]);

  // Selected event in modal
  const activeEvent = useMemo(() => {
    if (!selectedEventId) return null;
    return events.find((e) => e.id === Number(selectedEventId)) || null;
  }, [events, selectedEventId]);

  // Filtered Payments
  const filteredPayments = useMemo(() => {
    return payments.filter((p) => {
      const matchSearch =
        !searchQuery.trim() ||
        (p.customer_name && p.customer_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (p.note && p.note.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (p.event_type && p.event_type.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (p.place && p.place.toLowerCase().includes(searchQuery.toLowerCase())) ||
        String(p.event_id).includes(searchQuery.trim()) ||
        String(p.id).includes(searchQuery.trim());

      const matchMethod = methodFilter === "All" || p.payment_method === methodFilter;

      return matchSearch && matchMethod;
    });
  }, [payments, searchQuery, methodFilter]);

  // Filtered Event Receivables
  const filteredEvents = useMemo(() => {
    return events.filter((ev) => {
      const matchSearch =
        !searchQuery.trim() ||
        (ev.customer_name && ev.customer_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (ev.event_type && ev.event_type.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (ev.place && ev.place.toLowerCase().includes(searchQuery.toLowerCase())) ||
        String(ev.id).includes(searchQuery.trim());

      const quoteVal = ev.quote ?? ev.total_estimate ?? 0;
      const isPaid = ev.balance <= 0 && ev.paid_amount > 0;
      const isPartial = ev.paid_amount > 0 && ev.balance > 0;
      const isUnpaid = ev.paid_amount === 0;

      let matchStatus = true;
      if (statusFilter === "Paid") matchStatus = isPaid;
      else if (statusFilter === "Partial") matchStatus = isPartial;
      else if (statusFilter === "Unpaid") matchStatus = isUnpaid;

      return matchSearch && matchStatus;
    });
  }, [events, searchQuery, statusFilter]);

  // Filtered Staff Payments
  const filteredStaffPayments = useMemo(() => {
    return staffPayments.filter((sp) => {
      return (
        !searchQuery.trim() ||
        (sp.staff_name && sp.staff_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (sp.staff_role && sp.staff_role.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (sp.note && sp.note.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    });
  }, [staffPayments, searchQuery]);

  // Open modal pre-selected for an event
  const openRecordModal = (eventId?: number) => {
    if (eventId) {
      setSelectedEventId(eventId);
      const ev = events.find((e) => e.id === eventId);
      if (ev && ev.balance > 0) {
        setPaymentAmount(String(ev.balance));
      } else {
        setPaymentAmount("");
      }
    } else {
      setSelectedEventId(events[0]?.id || "");
      setPaymentAmount("");
    }
    setPaymentDate(new Date().toISOString().slice(0, 10));
    setPaymentMethod("Cash");
    setPaymentType("Advance");
    setPaymentNote("");
    setModalOpen(true);
  };

  // Submit payment
  const handleRecordPayment = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedEventId) {
      alert("Please select an event.");
      return;
    }
    const amt = parseFloat(paymentAmount);
    if (!amt || amt <= 0) {
      alert("Please enter a valid payment amount greater than zero.");
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetchWithAuth(`${API_URL}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_id: Number(selectedEventId),
          amount: amt,
          payment_method: paymentMethod,
          payment_type: paymentType,
          payment_date: paymentDate,
          note: paymentNote.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        throw new Error(errorData?.detail || "Failed to record payment");
      }

      setSuccessMsg(`Successfully recorded payment of ₹${formatMoney(amt)}`);
      setModalOpen(false);
      await loadData();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      alert(err.message || "Failed to save payment");
    } finally {
      setSubmitting(false);
    }
  };

  // Delete payment
  const handleDeletePayment = async (paymentId: number) => {
    if (!window.confirm("Are you sure you want to delete this payment record? This will adjust the event balance.")) {
      return;
    }
    try {
      const res = await fetchWithAuth(`${API_URL}/payments/${paymentId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete payment");
      setSuccessMsg("Payment record deleted successfully.");
      await loadData();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      alert(err.message || "Unable to delete payment");
    }
  };

  return (
    <main className="dashboard">
      <AppSidebar activeRoute="/payments" />

      {/* Main Content */}
      <div className="main-content">
        {/* Topbar */}
        <header className="topbar">
          <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            <MobileMenuButton />
            <h1 style={{ margin: 0, fontSize: "19px", fontWeight: 700, color: "#24103f" }}>
              Payments & Receivables
            </h1>
            <span style={{ fontSize: "12px", color: "#6b5b7e", background: "#f0edf5", padding: "4px 10px", borderRadius: "12px", fontWeight: 600 }}>
              {payments.length} Transactions Recorded
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            <div className="search-box">
              <span style={{ color: "#8a7b9b" }}>🔍</span>
              <input
                type="text"
                placeholder="Search by client, event #, note..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ border: "none", background: "transparent", outline: "none", width: "100%", fontSize: "13px" }}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  style={{ border: "none", background: "transparent", color: "#8a7b9b", cursor: "pointer", fontSize: "14px" }}
                >
                  ✕
                </button>
              )}
            </div>

            {!isOwner && (
              <button
                type="button"
                onClick={() => openRecordModal()}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  background: "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "8px",
                  padding: "8px 16px",
                  fontWeight: 700,
                  fontSize: "12px",
                  cursor: "pointer",
                  boxShadow: "0 4px 14px rgba(124, 58, 237, 0.3)",
                  transition: "all 0.15s ease",
                }}
              >
                <span>+</span> Record Payment
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
            <div style={{ background: "#e8f8f0", border: "1px solid #a3e6c0", color: "#0d6832", padding: "12px 18px", borderRadius: "8px", marginBottom: "20px", fontSize: "14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>✓ {successMsg}</span>
              <button type="button" onClick={() => setSuccessMsg(null)} style={{ border: "none", background: "transparent", color: "#0d6832", cursor: "pointer" }}>✕</button>
            </div>
          )}

          {error && (
            <div style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b", padding: "12px 18px", borderRadius: "8px", marginBottom: "20px", fontSize: "14px" }}>
              ⚠ {error}
            </div>
          )}

          {/* Metric Overview Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: "20px", marginBottom: "28px" }}>
            {/* Total Quoted */}
            <div style={{ background: "#fff", border: "1px solid #e9e5f0", borderRadius: "12px", padding: "20px", boxShadow: "0 2px 8px rgba(36, 16, 63, 0.04)" }}>
              <div style={{ fontSize: "12px", color: "#7a6e8a", fontWeight: 600, letterSpacing: "0.5px", textTransform: "uppercase" }}>
                Total Quoted Value
              </div>
              <div style={{ fontSize: "26px", fontWeight: 800, color: "#24103f", marginTop: "8px" }}>
                ₹{formatMoney(metrics.totalQuoted)}
              </div>
              <div style={{ fontSize: "12px", color: "#8d819e", marginTop: "6px" }}>
                Across {events.length} booked events
              </div>
            </div>

            {/* Total Collected */}
            <div style={{ background: "linear-gradient(135deg, #f0fdf4 0%, #e6f9ed 100%)", border: "1px solid #bbf7d0", borderRadius: "12px", padding: "20px", boxShadow: "0 2px 8px rgba(22, 101, 52, 0.04)" }}>
              <div style={{ fontSize: "12px", color: "#166534", fontWeight: 600, letterSpacing: "0.5px", textTransform: "uppercase" }}>
                Total Received (Inflow)
              </div>
              <div style={{ fontSize: "26px", fontWeight: 800, color: "#15803d", marginTop: "8px" }}>
                ₹{formatMoney(metrics.totalCollected)}
              </div>
              <div style={{ fontSize: "12px", color: "#166534", marginTop: "6px", fontWeight: 500 }}>
                {metrics.collectionRate.toFixed(1)}% Collection Rate
              </div>
            </div>

            {/* Outstanding Balance */}
            <div style={{ background: "linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)", border: "1px solid #fde68a", borderRadius: "12px", padding: "20px", boxShadow: "0 2px 8px rgba(180, 83, 9, 0.04)" }}>
              <div style={{ fontSize: "12px", color: "#92400e", fontWeight: 600, letterSpacing: "0.5px", textTransform: "uppercase" }}>
                Balance Due (Receivables)
              </div>
              <div style={{ fontSize: "26px", fontWeight: 800, color: "#b45309", marginTop: "8px" }}>
                ₹{formatMoney(metrics.totalBalanceDue)}
              </div>
              <div style={{ fontSize: "12px", color: "#92400e", marginTop: "6px" }}>
                Pending collection from clients
              </div>
            </div>

            {/* Staff Wage Disbursements */}
            <div style={{ background: "#fff", border: "1px solid #e9e5f0", borderRadius: "12px", padding: "20px", boxShadow: "0 2px 8px rgba(36, 16, 63, 0.04)" }}>
              <div style={{ fontSize: "12px", color: "#7a6e8a", fontWeight: 600, letterSpacing: "0.5px", textTransform: "uppercase" }}>
                Staff Wages Paid (Outflow)
              </div>
              <div style={{ fontSize: "26px", fontWeight: 800, color: "#4f46e5", marginTop: "8px" }}>
                ₹{formatMoney(metrics.staffDisbursed)}
              </div>
              <div style={{ fontSize: "12px", color: "#8d819e", marginTop: "6px" }}>
                {staffPayments.length} staff disbursements logged
              </div>
            </div>
          </div>

          {/* Tab Navigation */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #e5e0ed", marginBottom: "20px" }}>
            <div style={{ display: "flex", gap: "24px" }}>
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
                All Received Payments ({payments.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("receivables")}
                style={{
                  background: "transparent",
                  border: "none",
                  borderBottom: activeTab === "receivables" ? "3px solid #7c3aed" : "3px solid transparent",
                  padding: "12px 6px",
                  fontSize: "14px",
                  fontWeight: activeTab === "receivables" ? 700 : 500,
                  color: activeTab === "receivables" ? "#7c3aed" : "#6c5e7e",
                  cursor: "pointer",
                }}
              >
                Event Receivables Ledger ({events.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("staff")}
                style={{
                  background: "transparent",
                  border: "none",
                  borderBottom: activeTab === "staff" ? "3px solid #7c3aed" : "3px solid transparent",
                  padding: "12px 6px",
                  fontSize: "14px",
                  fontWeight: activeTab === "staff" ? 700 : 500,
                  color: activeTab === "staff" ? "#7c3aed" : "#6c5e7e",
                  cursor: "pointer",
                }}
              >
                Staff Wage Disbursements ({staffPayments.length})
              </button>
            </div>

            {/* Tab specific filter */}
            {activeTab === "payments" && (
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                <span style={{ fontSize: "12px", color: "#6c5e7e", fontWeight: 600 }}>Method:</span>
                <select
                  value={methodFilter}
                  onChange={(e) => setMethodFilter(e.target.value)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: "6px",
                    border: "1px solid #dcd7e5",
                    background: "#fff",
                    fontSize: "13px",
                    color: "#24103f",
                  }}
                >
                  <option value="All">All Methods</option>
                  <option value="Cash">Cash</option>
                  <option value="UPI">UPI / GPay</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Cheque">Cheque</option>
                  <option value="Card">Card</option>
                </select>
              </div>
            )}

            {activeTab === "receivables" && (
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                <span style={{ fontSize: "12px", color: "#6c5e7e", fontWeight: 600 }}>Payment Status:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: "6px",
                    border: "1px solid #dcd7e5",
                    background: "#fff",
                    fontSize: "13px",
                    color: "#24103f",
                  }}
                >
                  <option value="All">All Statuses</option>
                  <option value="Paid">Fully Paid</option>
                  <option value="Partial">Partially Paid</option>
                  <option value="Unpaid">Unpaid / Full Due</option>
                </select>
              </div>
            )}
          </div>

          {/* TAB 1: ALL RECEIVED PAYMENTS */}
          {activeTab === "payments" && (
            <div style={{ background: "#fff", borderRadius: "12px", border: "1px solid #e9e5f0", overflow: "hidden", boxShadow: "0 2px 10px rgba(36, 16, 63, 0.03)" }}>
              {loading ? (
                <div style={{ padding: "48px", textAlign: "center", color: "#7a6e8a" }}>Loading payments ledger...</div>
              ) : filteredPayments.length === 0 ? (
                <div style={{ padding: "50px 20px", textAlign: "center" }}>
                  <div style={{ fontSize: "36px", marginBottom: "12px" }}>▥</div>
                  <h3 style={{ margin: "0 0 6px 0", color: "#24103f" }}>No payment records found</h3>
                  <p style={{ color: "#7a6e8a", fontSize: "14px", margin: "0 0 16px 0" }}>
                    {searchQuery || methodFilter !== "All"
                      ? "Try adjusting your search query or method filter."
                      : "Record client advance payments and stage disbursements to track your cashflow."}
                  </p>
                  <button
                    type="button"
                    onClick={() => openRecordModal()}
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
                </div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", minWidth: "750px", borderCollapse: "collapse", fontSize: "13px", textAlign: "left" }}>
                    <thead>
                      <tr style={{ background: "#f8f7fb", borderBottom: "1px solid #e9e5f0", color: "#5d4e70", fontWeight: 600 }}>
                        <th style={{ padding: "14px 18px" }}>Date</th>
                        <th style={{ padding: "14px 18px" }}>Receipt #</th>
                        <th style={{ padding: "14px 18px" }}>Event / Client</th>
                        <th style={{ padding: "14px 18px" }}>Method</th>
                        <th style={{ padding: "14px 18px" }}>Type</th>
                        <th style={{ padding: "14px 18px" }}>Note / Ref</th>
                        <th style={{ padding: "14px 18px", textAlign: "right" }}>Amount</th>
                        <th style={{ padding: "14px 18px", textAlign: "center" }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPayments.map((p) => (
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
                            #{String(p.id).padStart(5, "0")}
                          </td>
                          <td style={{ padding: "14px 18px" }}>
                            <Link
                              href={`/events/${p.event_id}`}
                              style={{ fontWeight: 600, color: "#24103f", textDecoration: "none" }}
                            >
                              {p.customer_name || "Client"}
                            </Link>
                            <div style={{ fontSize: "11px", color: "#7a6e8a", marginTop: "2px" }}>
                              Event #{p.event_id} • {p.event_type || "Event"} {p.place ? `(${p.place})` : ""}
                            </div>
                          </td>
                          <td style={{ padding: "14px 18px" }}>
                            <span
                              style={{
                                display: "inline-block",
                                padding: "3px 8px",
                                borderRadius: "4px",
                                fontSize: "11px",
                                fontWeight: 600,
                                background: "#f0edf5",
                                color: "#48365f",
                              }}
                            >
                              {p.payment_method || "Cash"}
                            </span>
                          </td>
                          <td style={{ padding: "14px 18px" }}>
                            <span
                              style={{
                                display: "inline-block",
                                padding: "3px 8px",
                                borderRadius: "4px",
                                fontSize: "11px",
                                fontWeight: 600,
                                background: p.payment_type === "Advance" ? "#eef2ff" : "#fdf4ff",
                                color: p.payment_type === "Advance" ? "#3730a3" : "#86198f",
                              }}
                            >
                              {p.payment_type || "Payment"}
                            </span>
                          </td>
                          <td style={{ padding: "14px 18px", color: "#5d4e70", maxWidth: "200px" }}>
                            {p.note || "-"}
                          </td>
                          <td style={{ padding: "14px 18px", textAlign: "right", fontWeight: 800, color: "#166534", fontSize: "14px" }}>
                            + ₹{formatMoney(p.amount)}
                          </td>
                          <td style={{ padding: "14px 18px", textAlign: "center", whiteSpace: "nowrap" }}>
                            <div style={{ display: "flex", justifyContent: "center", gap: "8px" }}>
                              <Link
                                href={`/events/${p.event_id}`}
                                title="View Event"
                                style={{
                                  padding: "4px 8px",
                                  borderRadius: "4px",
                                  background: "#f0edf5",
                                  color: "#24103f",
                                  fontSize: "12px",
                                  fontWeight: 600,
                                }}
                              >
                                View
                              </Link>
                              {!isOwner && (
                                <button
                                  type="button"
                                  onClick={() => handleDeletePayment(p.id)}
                                  title="Delete Payment Record"
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
          )}

          {/* TAB 2: EVENT RECEIVABLES LEDGER */}
          {activeTab === "receivables" && (
            <div style={{ background: "#fff", borderRadius: "12px", border: "1px solid #e9e5f0", overflow: "hidden", boxShadow: "0 2px 10px rgba(36, 16, 63, 0.03)" }}>
              {loading ? (
                <div style={{ padding: "48px", textAlign: "center", color: "#7a6e8a" }}>Loading event receivables...</div>
              ) : filteredEvents.length === 0 ? (
                <div style={{ padding: "50px 20px", textAlign: "center", color: "#7a6e8a" }}>
                  No events match the selected criteria.
                </div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", minWidth: "750px", borderCollapse: "collapse", fontSize: "13px", textAlign: "left" }}>
                    <thead>
                      <tr style={{ background: "#f8f7fb", borderBottom: "1px solid #e9e5f0", color: "#5d4e70", fontWeight: 600 }}>
                        <th style={{ padding: "14px 18px" }}>Event # / Date</th>
                        <th style={{ padding: "14px 18px" }}>Customer / Venue</th>
                        <th style={{ padding: "14px 18px", textAlign: "right" }}>Quoted Value</th>
                        <th style={{ padding: "14px 18px", textAlign: "right" }}>Paid So Far</th>
                        <th style={{ padding: "14px 18px", textAlign: "right" }}>Balance Due</th>
                        <th style={{ padding: "14px 18px", textAlign: "center" }}>Status & Progress</th>
                        <th style={{ padding: "14px 18px", textAlign: "center" }}>Quick Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredEvents.map((ev) => {
                        const quoteVal = ev.quote ?? ev.total_estimate ?? 0;
                        const paidVal = ev.paid_amount ?? 0;
                        const balanceVal = ev.balance ?? Math.max(0, quoteVal - paidVal);
                        const percent = quoteVal > 0 ? Math.min(100, Math.round((paidVal / quoteVal) * 100)) : 100;
                        const isPaid = balanceVal <= 0 && paidVal > 0;
                        const isPartial = paidVal > 0 && balanceVal > 0;

                        return (
                          <tr
                            key={ev.id}
                            style={{
                              borderBottom: "1px solid #f2eff7",
                              transition: "background 0.15s ease",
                            }}
                          >
                            <td style={{ padding: "14px 18px" }}>
                              <div style={{ fontWeight: 700, color: "#24103f" }}>
                                <Link href={`/events/${ev.id}`} style={{ color: "#24103f" }}>
                                  #{ev.id} • {ev.event_type}
                                </Link>
                              </div>
                              <div style={{ fontSize: "12px", color: "#7a6e8a", marginTop: "3px" }}>
                                📅 {formatDate(ev.date)}
                              </div>
                            </td>
                            <td style={{ padding: "14px 18px" }}>
                              <div style={{ fontWeight: 600, color: "#24103f" }}>
                                {ev.customer_name || "Unknown"}
                              </div>
                              <div style={{ fontSize: "12px", color: "#7a6e8a", marginTop: "2px" }}>
                                📍 {ev.place || "Venue not set"}
                              </div>
                            </td>
                            <td style={{ padding: "14px 18px", textAlign: "right", fontWeight: 700, color: "#24103f" }}>
                              ₹{formatMoney(quoteVal)}
                            </td>
                            <td style={{ padding: "14px 18px", textAlign: "right", fontWeight: 700, color: "#166534" }}>
                              ₹{formatMoney(paidVal)}
                            </td>
                            <td style={{ padding: "14px 18px", textAlign: "right", fontWeight: 800, color: balanceVal > 0 ? "#b45309" : "#166534" }}>
                              ₹{formatMoney(balanceVal)}
                            </td>
                            <td style={{ padding: "14px 18px", textAlign: "center", minWidth: "150px" }}>
                              <div style={{ display: "inline-block", marginBottom: "6px" }}>
                                <span
                                  style={{
                                    display: "inline-block",
                                    padding: "3px 9px",
                                    borderRadius: "12px",
                                    fontSize: "11px",
                                    fontWeight: 700,
                                    background: isPaid ? "#dcfce7" : isPartial ? "#fef3c7" : "#fee2e2",
                                    color: isPaid ? "#15803d" : isPartial ? "#b45309" : "#b91c1c",
                                  }}
                                >
                                  {isPaid ? "Fully Paid" : isPartial ? "Partially Paid" : "Unpaid"} ({percent}%)
                                </span>
                              </div>
                              {/* Mini progress bar */}
                              <div style={{ width: "100%", height: "6px", background: "#f0edf5", borderRadius: "3px", overflow: "hidden" }}>
                                <div
                                  style={{
                                    width: `${percent}%`,
                                    height: "100%",
                                    background: isPaid ? "#16a34a" : isPartial ? "#f59e0b" : "#e5e7eb",
                                    borderRadius: "3px",
                                  }}
                                />
                              </div>
                            </td>
                            <td style={{ padding: "14px 18px", textAlign: "center", whiteSpace: "nowrap" }}>
                              <div style={{ display: "flex", justifyContent: "center", gap: "6px" }}>
                                {!isOwner && (
                                  <button
                                    type="button"
                                    onClick={() => openRecordModal(ev.id)}
                                    style={{
                                      background: "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)",
                                      color: "#ffffff",
                                      border: "none",
                                      borderRadius: "6px",
                                      padding: "6px 12px",
                                      fontSize: "12px",
                                      fontWeight: 700,
                                      cursor: "pointer",
                                      boxShadow: "0 2px 8px rgba(124, 58, 237, 0.25)",
                                    }}
                                  >
                                    + Pay
                                  </button>
                                )}
                                <Link
                                  href={`/billing?eventId=${ev.id}`}
                                  style={{
                                    background: "#f5f3ff",
                                    color: "#6d28d9",
                                    border: "1px solid #ddd6fe",
                                    borderRadius: "5px",
                                    padding: "5px 10px",
                                    fontSize: "12px",
                                    fontWeight: 700,
                                    textDecoration: "none",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "4px",
                                  }}
                                  title="Print or view Tax Invoice / Bill"
                                >
                                  📄 Bill
                                </Link>
                                <Link
                                  href={`/events/${ev.id}`}
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
                                  View
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

          {/* TAB 3: STAFF WAGE DISBURSEMENTS */}
          {activeTab === "staff" && (
            <div style={{ background: "#fff", borderRadius: "12px", border: "1px solid #e9e5f0", overflow: "hidden", boxShadow: "0 2px 10px rgba(36, 16, 63, 0.03)" }}>
              {loading ? (
                <div style={{ padding: "48px", textAlign: "center", color: "#7a6e8a" }}>Loading staff disbursements...</div>
              ) : filteredStaffPayments.length === 0 ? (
                <div style={{ padding: "50px 20px", textAlign: "center" }}>
                  <div style={{ fontSize: "36px", marginBottom: "12px" }}>♙</div>
                  <h3 style={{ margin: "0 0 6px 0", color: "#24103f" }}>No staff payments recorded</h3>
                  <p style={{ color: "#7a6e8a", fontSize: "14px", margin: "0 0 16px 0" }}>
                    Staff payments are logged from each event details page under staff allocation.
                  </p>
                </div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", textAlign: "left" }}>
                    <thead>
                      <tr style={{ background: "#f8f7fb", borderBottom: "1px solid #e9e5f0", color: "#5d4e70", fontWeight: 600 }}>
                        <th style={{ padding: "14px 18px" }}>Disbursement Date</th>
                        <th style={{ padding: "14px 18px" }}>Record #</th>
                        <th style={{ padding: "14px 18px" }}>Staff Member</th>
                        <th style={{ padding: "14px 18px" }}>Event Reference</th>
                        <th style={{ padding: "14px 18px" }}>Note / Role</th>
                        <th style={{ padding: "14px 18px", textAlign: "right" }}>Wage Paid</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredStaffPayments.map((sp) => (
                        <tr
                          key={sp.id}
                          style={{
                            borderBottom: "1px solid #f2eff7",
                            transition: "background 0.15s ease",
                          }}
                        >
                          <td style={{ padding: "14px 18px", fontWeight: 600, color: "#24103f" }}>
                            {formatDate(sp.payment_date)}
                          </td>
                          <td style={{ padding: "14px 18px", color: "#8a7b9b", fontFamily: "monospace" }}>
                            #SP-{String(sp.id).padStart(4, "0")}
                          </td>
                          <td style={{ padding: "14px 18px", fontWeight: 600, color: "#24103f" }}>
                            {sp.staff_name || `Staff #${sp.staff_id}`}
                            {sp.staff_role && (
                              <div style={{ fontSize: "11px", color: "#7a6e8a", marginTop: "2px" }}>
                                {sp.staff_role}
                              </div>
                            )}
                          </td>
                          <td style={{ padding: "14px 18px" }}>
                            {sp.event_id ? (
                              <Link href={`/events/${sp.event_id}`} style={{ color: "#4f46e5", fontWeight: 600 }}>
                                Event #{sp.event_id}
                              </Link>
                            ) : (
                              <span style={{ color: "#8a7b9b" }}>General Duty</span>
                            )}
                          </td>
                          <td style={{ padding: "14px 18px", color: "#5d4e70" }}>
                            {sp.note || "-"}
                          </td>
                          <td style={{ padding: "14px 18px", textAlign: "right", fontWeight: 800, color: "#4f46e5", fontSize: "14px" }}>
                            ₹{formatMoney(sp.amount)}
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

      {/* RECORD PAYMENT MODAL */}
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
                <h3 style={{ margin: 0, fontSize: "17px", fontWeight: 700 }}>Record Client Payment</h3>
                <span style={{ fontSize: "12px", color: "#c084fc" }}>Credit to Event Receivables</span>
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
            <form onSubmit={handleRecordPayment} style={{ padding: "24px" }}>
              {/* Event Selector */}
              <div style={{ marginBottom: "18px" }}>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#3c2e4e", marginBottom: "6px" }}>
                  Select Event *
                </label>
                <select
                  value={selectedEventId}
                  onChange={(e) => {
                    const id = Number(e.target.value);
                    setSelectedEventId(id);
                    const ev = events.find((item) => item.id === id);
                    if (ev && ev.balance > 0) {
                      setPaymentAmount(String(ev.balance));
                    }
                  }}
                  required
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
                      #{ev.id} - {ev.customer_name} ({ev.event_type}, {formatDate(ev.date)}) - Due: ₹{formatMoney(ev.balance)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Event Balance Quick Peek */}
              {activeEvent && (
                <div
                  style={{
                    background: "#f8f6fc",
                    borderRadius: "8px",
                    padding: "12px 14px",
                    marginBottom: "18px",
                    border: "1px solid #ece8f3",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <div style={{ fontSize: "11px", color: "#7a6e8a", textTransform: "uppercase", fontWeight: 600 }}>
                      Quoted: ₹{formatMoney(activeEvent.quote ?? activeEvent.total_estimate)} • Paid: ₹{formatMoney(activeEvent.paid_amount)}
                    </div>
                    <div style={{ fontSize: "14px", fontWeight: 800, color: activeEvent.balance > 0 ? "#b45309" : "#166534", marginTop: "2px" }}>
                      Remaining Balance: ₹{formatMoney(activeEvent.balance)}
                    </div>
                  </div>
                  {activeEvent.balance > 0 && (
                    <button
                      type="button"
                      onClick={() => setPaymentAmount(String(activeEvent.balance))}
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
                  )}
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
                    placeholder="e.g. 50000"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
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
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
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

              {/* Method & Type row */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginBottom: "18px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#3c2e4e", marginBottom: "6px" }}>
                    Payment Method
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: "8px",
                      border: "1px solid #d8d3e2",
                      fontSize: "13px",
                      background: "#fff",
                    }}
                  >
                    <option value="Cash">Cash</option>
                    <option value="UPI">UPI / GPay / PhonePe</option>
                    <option value="Bank Transfer">Bank Transfer / NEFT</option>
                    <option value="Cheque">Cheque</option>
                    <option value="Card">Card</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#3c2e4e", marginBottom: "6px" }}>
                    Payment Stage / Type
                  </label>
                  <select
                    value={paymentType}
                    onChange={(e) => setPaymentType(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: "8px",
                      border: "1px solid #d8d3e2",
                      fontSize: "13px",
                      background: "#fff",
                    }}
                  >
                    <option value="Advance">Advance Booking</option>
                    <option value="Stage Payment">Stage 2 Payment</option>
                    <option value="Pre-Event Final">Pre-Event Settlement</option>
                    <option value="Final Settlement">Final Settlement</option>
                    <option value="Full Payment">Full 100% Payment</option>
                  </select>
                </div>
              </div>

              {/* Note / Reference */}
              <div style={{ marginBottom: "24px" }}>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#3c2e4e", marginBottom: "6px" }}>
                  Reference / Note (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. UPI Ref #493012948 or Cheque #884102"
                  value={paymentNote}
                  onChange={(e) => setPaymentNote(e.target.value)}
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
                  onClick={() => setModalOpen(false)}
                  disabled={submitting}
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
                  disabled={submitting}
                  style={{
                    padding: "10px 22px",
                    borderRadius: "8px",
                    border: "none",
                    background: "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)",
                    color: "#ffffff",
                    fontWeight: 700,
                    fontSize: "13px",
                    cursor: submitting ? "not-allowed" : "pointer",
                    boxShadow: "0 4px 14px rgba(124, 58, 237, 0.35)",
                  }}
                >
                  {submitting ? "Saving..." : "Record Payment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
