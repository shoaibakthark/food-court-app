"use client";

import { useEffect, useState, useMemo, useRef, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAuth } from "../lib/auth";
import { AppSidebar, MobileMenuButton } from "../components/NavDrawer";
import { TopbarUserBadge, OwnerBanner } from "../components/AuthBar";

const API_URL = typeof window !== "undefined" ? "/api/py" : "http://127.0.0.1:8000";

type BillingEvent = {
  id: number;
  customer_id: number;
  customer_name: string;
  customer_mobile?: string;
  event_type: string;
  place: string;
  date: string;
  guest_count: number;
  food_amt: number;
  decor_amt: number;
  total_estimate: number;
  quote: number | null;
  paid_amount: number;
  balance: number;
};

type PaymentReceipt = {
  id: number;
  event_id: number;
  amount: number;
  payment_date: string;
  payment_method: string;
  payment_type: string;
  note?: string;
};

type CompanyProfile = {
  companyName: string;
  contactPhone: string;
  contactEmail: string;
  address: string;
  gstin: string;
  currency: string;
  receiptFooter: string;
};

const DEFAULT_PROFILE: CompanyProfile = {
  companyName: "Food Court Catering & Event Management",
  contactPhone: "+91 98765 43210",
  contactEmail: "billing@foodcourt.internal",
  address: "Main Avenue, Opp. City Convention Center, Kerala, India",
  gstin: "32AAAAA0000A1Z5",
  currency: "₹",
  receiptFooter: "Thank you for partnering with Food Court! We look forward to creating unforgettable celebrations.",
};

function formatMoney(amount: number | string | null | undefined): string {
  const num = Number(amount) || 0;
  return num.toLocaleString("en-IN", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  });
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function BillingContent() {
  const { user, isOwner } = useAuth();
  const searchParams = useSearchParams();

  const [events, setEvents] = useState<BillingEvent[]>([]);
  const [payments, setPayments] = useState<PaymentReceipt[]>([]);
  const [profile, setProfile] = useState<CompanyProfile>(DEFAULT_PROFILE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "due" | "partial" | "settled">("all");

  // Selected event for Invoice Modal & Printing
  const [activeEvent, setActiveEvent] = useState<BillingEvent | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [autoPrintTriggered, setAutoPrintTriggered] = useState(false);

  // Load Company Profile from settings
  useEffect(() => {
    try {
      const saved = localStorage.getItem("fc_settings");
      if (saved) {
        setProfile({ ...DEFAULT_PROFILE, ...JSON.parse(saved) });
      }
    } catch {
      // ignore
    }
  }, []);

  // Fetch Events and Payments
  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [eventsRes, paymentsRes] = await Promise.all([
        fetch(`${API_URL}/events`).catch(() => null),
        fetch(`${API_URL}/payments`).catch(() => null),
      ]);

      if (!eventsRes || !eventsRes.ok) {
        throw new Error("Unable to connect to the backend server.");
      }

      const eventsData = await eventsRes.json();
      const paymentsData = paymentsRes && paymentsRes.ok ? await paymentsRes.json() : [];

      const list: BillingEvent[] = Array.isArray(eventsData) ? eventsData : [];
      setEvents(list);
      setPayments(Array.isArray(paymentsData) ? paymentsData : []);

      // If query param ?eventId=XYZ or ?print=XYZ is provided, auto-open that invoice
      const paramEventId = searchParams.get("eventId") || searchParams.get("print");
      if (paramEventId) {
        const found = list.find((e) => String(e.id) === paramEventId);
        if (found) {
          setActiveEvent(found);
          setModalOpen(true);
          if (searchParams.get("print")) {
            setAutoPrintTriggered(true);
          }
        }
      }
    } catch (err: any) {
      setError(err.message || "Failed to load billing ledger.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [searchParams]);

  // Handle auto-print if triggered by URL
  useEffect(() => {
    if (autoPrintTriggered && activeEvent && modalOpen) {
      const timer = setTimeout(() => {
        window.print();
        setAutoPrintTriggered(false);
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [autoPrintTriggered, activeEvent, modalOpen]);

  // Filtered payments for active invoice
  const activeEventPayments = useMemo(() => {
    if (!activeEvent) return [];
    return payments.filter((p) => p.event_id === activeEvent.id);
  }, [activeEvent, payments]);

  // Metrics Calculation
  const metrics = useMemo(() => {
    let totalBilled = 0;
    let totalCollected = 0;
    let totalReceivables = 0;
    let dueCount = 0;
    let partialCount = 0;
    let settledCount = 0;

    events.forEach((ev) => {
      const billed = ev.quote ?? ev.total_estimate ?? 0;
      const paid = ev.paid_amount ?? 0;
      const bal = ev.balance ?? Math.max(0, billed - paid);

      totalBilled += billed;
      totalCollected += paid;
      totalReceivables += bal;

      if (bal <= 0 && billed > 0) {
        settledCount++;
      } else if (paid > 0 && bal > 0) {
        partialCount++;
      } else {
        dueCount++;
      }
    });

    const collectionRate = totalBilled > 0 ? (totalCollected / totalBilled) * 100 : 0;

    return {
      totalBilled,
      totalCollected,
      totalReceivables,
      collectionRate,
      dueCount,
      partialCount,
      settledCount,
      totalCount: events.length,
    };
  }, [events]);

  // Filtered Events List
  const filteredEvents = useMemo(() => {
    return events.filter((ev) => {
      const billed = ev.quote ?? ev.total_estimate ?? 0;
      const paid = ev.paid_amount ?? 0;
      const bal = ev.balance ?? Math.max(0, billed - paid);

      // Status check
      if (statusFilter === "settled" && (bal > 0 || billed === 0)) return false;
      if (statusFilter === "partial" && (paid === 0 || bal <= 0)) return false;
      if (statusFilter === "due" && (paid > 0 || billed === 0)) return false;

      // Search query check
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const invoiceNum = `inv-2026-${String(ev.id).padStart(5, "0")}`.toLowerCase();
        const matchesName = (ev.customer_name || "").toLowerCase().includes(q);
        const matchesMobile = (ev.customer_mobile || "").toLowerCase().includes(q);
        const matchesType = (ev.event_type || "").toLowerCase().includes(q);
        const matchesPlace = (ev.place || "").toLowerCase().includes(q);
        const matchesId = String(ev.id).includes(q) || invoiceNum.includes(q);

        return matchesName || matchesMobile || matchesType || matchesPlace || matchesId;
      }

      return true;
    });
  }, [events, statusFilter, searchQuery]);

  const openInvoice = (ev: BillingEvent, autoPrint: boolean = false) => {
    setActiveEvent(ev);
    setModalOpen(true);
    if (autoPrint) {
      setTimeout(() => {
        window.print();
      }, 400);
    }
  };

  const handlePrintCurrentInvoice = () => {
    window.print();
  };

  return (
    <main className="dashboard">
      <AppSidebar activeRoute="/billing" />

      <div className="main-content">
        {/* Topbar */}
        <header
          className="topbar no-print"
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
            <div>
              <h1 style={{ margin: 0, fontSize: "19px", fontWeight: 700, color: "#1e0836", whiteSpace: "nowrap" }}>
                Billing & Invoices
              </h1>
              <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#8a7b9b" }}>
                Generate tax invoices, manage client receivables, and export printable PDF bills
              </p>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", justifyContent: "flex-end", flex: "1 1 auto" }}>
            {/* Search Input */}
            <div
              className="search-box"
              style={{
                width: "260px",
                height: "38px",
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: "8px",
                display: "flex",
                alignItems: "center",
                padding: "0 10px",
                gap: "8px",
              }}
            >
              <span style={{ color: "#8a7b9b", fontSize: "14px" }}>🔍</span>
              <input
                type="text"
                placeholder="Search invoice #, client, venue..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  border: "none",
                  background: "transparent",
                  outline: "none",
                  width: "100%",
                  fontSize: "13px",
                  color: "#1e0836",
                }}
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

            <button
              type="button"
              onClick={() => window.print()}
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
              <span>🖨️</span> Print Ledger
            </button>

            <TopbarUserBadge />
          </div>
        </header>

        {/* Content Body */}
        <div className="page-content">
          <OwnerBanner />

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

          {/* Metric Overview Cards */}
          <div
            className="no-print"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "18px",
              marginBottom: "28px",
            }}
          >
            {/* Total Invoiced */}
            <div
              style={{
                background: "#ffffff",
                border: "1px solid #ebe4f5",
                borderRadius: "14px",
                padding: "20px",
                boxShadow: "0 2px 10px rgba(124, 58, 237, 0.04)",
                position: "relative",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  height: "3px",
                  background: "linear-gradient(90deg, #7c3aed 0%, #a855f7 100%)",
                }}
              />
              <div style={{ fontSize: "12px", color: "#7a6e8a", fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase" }}>
                Total Invoiced Value
              </div>
              <div style={{ fontSize: "26px", fontWeight: 800, color: "#1e0836", marginTop: "8px" }}>
                ₹{formatMoney(metrics.totalBilled)}
              </div>
              <div style={{ fontSize: "12px", color: "#8a7b9b", marginTop: "6px" }}>
                Across {metrics.totalCount} client event contracts
              </div>
            </div>

            {/* Total Realized */}
            <div
              style={{
                background: "#ffffff",
                border: "1px solid #ebe4f5",
                borderRadius: "14px",
                padding: "20px",
                boxShadow: "0 2px 10px rgba(124, 58, 237, 0.04)",
                position: "relative",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  height: "3px",
                  background: "linear-gradient(90deg, #10b981 0%, #059669 100%)",
                }}
              />
              <div style={{ fontSize: "12px", color: "#166534", fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase" }}>
                Payments Realized
              </div>
              <div style={{ fontSize: "26px", fontWeight: 800, color: "#166534", marginTop: "8px" }}>
                ₹{formatMoney(metrics.totalCollected)}
              </div>
              <div style={{ fontSize: "12px", color: "#166534", marginTop: "6px" }}>
                {metrics.collectionRate.toFixed(1)}% recovery efficiency
              </div>
            </div>

            {/* Outstanding Receivables */}
            <div
              style={{
                background: "#ffffff",
                border: "1px solid #ebe4f5",
                borderRadius: "14px",
                padding: "20px",
                boxShadow: "0 2px 10px rgba(124, 58, 237, 0.04)",
                position: "relative",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  height: "3px",
                  background: "linear-gradient(90deg, #f59e0b 0%, #d97706 100%)",
                }}
              />
              <div style={{ fontSize: "12px", color: "#b45309", fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase" }}>
                Pending Receivables
              </div>
              <div style={{ fontSize: "26px", fontWeight: 800, color: "#b45309", marginTop: "8px" }}>
                ₹{formatMoney(metrics.totalReceivables)}
              </div>
              <div style={{ fontSize: "12px", color: "#b45309", marginTop: "6px" }}>
                {metrics.dueCount + metrics.partialCount} invoices awaiting balance
              </div>
            </div>

            {/* Settled Invoices */}
            <div
              style={{
                background: "#ffffff",
                border: "1px solid #ebe4f5",
                borderRadius: "14px",
                padding: "20px",
                boxShadow: "0 2px 10px rgba(124, 58, 237, 0.04)",
                position: "relative",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  height: "3px",
                  background: "linear-gradient(90deg, #6366f1 0%, #4f46e5 100%)",
                }}
              />
              <div style={{ fontSize: "12px", color: "#4338ca", fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase" }}>
                Settled Bills
              </div>
              <div style={{ fontSize: "26px", fontWeight: 800, color: "#4338ca", marginTop: "8px" }}>
                {metrics.settledCount} / {metrics.totalCount}
              </div>
              <div style={{ fontSize: "12px", color: "#6366f1", marginTop: "6px" }}>
                Fully paid & closed statements
              </div>
            </div>
          </div>

          {/* Navigation Filter Tabs */}
          <div
            className="no-print"
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "12px",
              borderBottom: "1px solid #ece5f5",
              marginBottom: "20px",
              paddingBottom: "4px",
            }}
          >
            <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => setStatusFilter("all")}
                style={{
                  background: "transparent",
                  border: "none",
                  borderBottom: statusFilter === "all" ? "3px solid #7c3aed" : "3px solid transparent",
                  padding: "10px 4px",
                  fontSize: "14px",
                  fontWeight: statusFilter === "all" ? 700 : 500,
                  color: statusFilter === "all" ? "#7c3aed" : "#6c5e7e",
                  cursor: "pointer",
                }}
              >
                All Invoices ({metrics.totalCount})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("due")}
                style={{
                  background: "transparent",
                  border: "none",
                  borderBottom: statusFilter === "due" ? "3px solid #7c3aed" : "3px solid transparent",
                  padding: "10px 4px",
                  fontSize: "14px",
                  fontWeight: statusFilter === "due" ? 700 : 500,
                  color: statusFilter === "due" ? "#7c3aed" : "#6c5e7e",
                  cursor: "pointer",
                }}
              >
                Pending Due ({metrics.dueCount})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("partial")}
                style={{
                  background: "transparent",
                  border: "none",
                  borderBottom: statusFilter === "partial" ? "3px solid #7c3aed" : "3px solid transparent",
                  padding: "10px 4px",
                  fontSize: "14px",
                  fontWeight: statusFilter === "partial" ? 700 : 500,
                  color: statusFilter === "partial" ? "#7c3aed" : "#6c5e7e",
                  cursor: "pointer",
                }}
              >
                Partially Paid ({metrics.partialCount})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("settled")}
                style={{
                  background: "transparent",
                  border: "none",
                  borderBottom: statusFilter === "settled" ? "3px solid #7c3aed" : "3px solid transparent",
                  padding: "10px 4px",
                  fontSize: "14px",
                  fontWeight: statusFilter === "settled" ? 700 : 500,
                  color: statusFilter === "settled" ? "#7c3aed" : "#6c5e7e",
                  cursor: "pointer",
                }}
              >
                Settled ({metrics.settledCount})
              </button>
            </div>

            <span style={{ fontSize: "12px", color: "#8a7b9b", fontWeight: 600 }}>
              Showing {filteredEvents.length} invoice records
            </span>
          </div>

          {/* Invoices Table Container */}
          <div
            style={{
              background: "#ffffff",
              borderRadius: "14px",
              border: "1px solid #ebe4f5",
              overflow: "hidden",
              boxShadow: "0 2px 10px rgba(124, 58, 237, 0.03)",
            }}
          >
            {loading ? (
              <div style={{ padding: "48px", textAlign: "center", color: "#7a6e8a" }}>
                Loading billing ledger & invoices...
              </div>
            ) : filteredEvents.length === 0 ? (
              <div style={{ padding: "50px 20px", textAlign: "center" }}>
                <div style={{ fontSize: "36px", marginBottom: "12px" }}>📄</div>
                <h3 style={{ margin: "0 0 6px 0", color: "#1e0836" }}>No invoices found</h3>
                <p style={{ color: "#7a6e8a", fontSize: "14px", margin: "0 0 16px 0" }}>
                  {searchQuery ? "Try adjusting your search criteria or keywords." : "Create an event to generate its first bill."}
                </p>
                <Link
                  href="/create-event"
                  style={{
                    display: "inline-block",
                    background: "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)",
                    color: "#ffffff",
                    padding: "8px 18px",
                    borderRadius: "8px",
                    fontWeight: 700,
                    fontSize: "13px",
                    textDecoration: "none",
                    boxShadow: "0 4px 14px rgba(124, 58, 237, 0.35)",
                  }}
                >
                  + Create New Event
                </Link>
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", minWidth: "900px", borderCollapse: "collapse", fontSize: "13px", textAlign: "left" }}>
                  <thead>
                    <tr style={{ background: "linear-gradient(180deg, #fbf9fe 0%, #f4effa 100%)", borderBottom: "1px solid #ece4f5", color: "#542b80", fontWeight: 700 }}>
                      <th style={{ padding: "14px 18px", verticalAlign: "middle", whiteSpace: "nowrap" }}>Invoice #</th>
                      <th style={{ padding: "14px 18px", verticalAlign: "middle", whiteSpace: "nowrap" }}>Event Date</th>
                      <th style={{ padding: "14px 18px", verticalAlign: "middle", whiteSpace: "nowrap" }}>Client Details</th>
                      <th style={{ padding: "14px 18px", verticalAlign: "middle", whiteSpace: "nowrap" }}>Event & Venue</th>
                      <th style={{ padding: "14px 18px", verticalAlign: "middle", textAlign: "right", whiteSpace: "nowrap" }}>Billed (₹)</th>
                      <th style={{ padding: "14px 18px", verticalAlign: "middle", textAlign: "right", whiteSpace: "nowrap" }}>Paid (₹)</th>
                      <th style={{ padding: "14px 18px", verticalAlign: "middle", textAlign: "right", whiteSpace: "nowrap" }}>Balance Due (₹)</th>
                      <th style={{ padding: "14px 18px", verticalAlign: "middle", textAlign: "center", whiteSpace: "nowrap" }}>Status</th>
                      <th style={{ padding: "14px 18px", verticalAlign: "middle", textAlign: "center", whiteSpace: "nowrap" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEvents.map((ev) => {
                      const billed = ev.quote ?? ev.total_estimate ?? 0;
                      const paid = ev.paid_amount ?? 0;
                      const bal = ev.balance ?? Math.max(0, billed - paid);
                      const isSettled = bal <= 0 && billed > 0;
                      const isPartial = paid > 0 && bal > 0;
                      const invoiceNo = `INV-2026-${String(ev.id).padStart(5, "0")}`;

                      return (
                        <tr
                          key={ev.id}
                          style={{
                            borderBottom: "1px solid #f3eef8",
                            transition: "background 0.15s ease",
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = "#faf7fe")}
                          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                        >
                          {/* Invoice # */}
                          <td style={{ padding: "14px 18px", fontWeight: 700, verticalAlign: "middle", whiteSpace: "nowrap" }}>
                            <button
                              type="button"
                              onClick={() => openInvoice(ev)}
                              style={{
                                background: "transparent",
                                border: "none",
                                padding: 0,
                                color: "#7c3aed",
                                fontWeight: 700,
                                fontSize: "13px",
                                cursor: "pointer",
                                textDecoration: "underline",
                              }}
                            >
                              {invoiceNo}
                            </button>
                          </td>

                          {/* Date */}
                          <td style={{ padding: "14px 18px", color: "#6b5b7e", verticalAlign: "middle", whiteSpace: "nowrap" }}>
                            {formatDate(ev.date)}
                          </td>

                          {/* Client */}
                          <td style={{ padding: "14px 18px", verticalAlign: "middle" }}>
                            <strong style={{ color: "#1e0836", display: "block" }}>{ev.customer_name}</strong>
                            {ev.customer_mobile && (
                              <span style={{ fontSize: "11px", color: "#8a7b9b" }}>📞 {ev.customer_mobile}</span>
                            )}
                          </td>

                          {/* Event & Venue */}
                          <td style={{ padding: "14px 18px", color: "#5d4e70", verticalAlign: "middle" }}>
                            <div>
                              <strong>{ev.event_type}</strong>
                              <span style={{ fontSize: "12px", color: "#8a7b9b", marginLeft: "6px" }}>
                                ({ev.place || "Venue"})
                              </span>
                            </div>
                            <small style={{ color: "#8a7b9b" }}>{ev.guest_count} guests</small>
                          </td>

                          {/* Billed */}
                          <td style={{ padding: "14px 18px", textAlign: "right", fontWeight: 700, color: "#1e0836", verticalAlign: "middle", whiteSpace: "nowrap" }}>
                            ₹{formatMoney(billed)}
                          </td>

                          {/* Paid */}
                          <td style={{ padding: "14px 18px", textAlign: "right", color: "#166534", fontWeight: 700, verticalAlign: "middle", whiteSpace: "nowrap" }}>
                            ₹{formatMoney(paid)}
                          </td>

                          {/* Balance */}
                          <td style={{ padding: "14px 18px", textAlign: "right", fontWeight: 800, verticalAlign: "middle", whiteSpace: "nowrap" }}>
                            <span style={{ color: bal > 0 ? "#b45309" : "#166534" }}>
                              ₹{formatMoney(bal)}
                            </span>
                          </td>

                          {/* Status */}
                          <td style={{ padding: "14px 18px", textAlign: "center", verticalAlign: "middle", whiteSpace: "nowrap" }}>
                            <span
                              style={{
                                display: "inline-block",
                                padding: "4px 10px",
                                borderRadius: "12px",
                                fontSize: "11px",
                                fontWeight: 700,
                                background: isSettled ? "#e8f8f0" : isPartial ? "#fef3c7" : "#fee2e2",
                                color: isSettled ? "#0d6832" : isPartial ? "#92400e" : "#b91c1c",
                              }}
                            >
                              {isSettled ? "● Paid" : isPartial ? "● Partial" : "● Unpaid"}
                            </span>
                          </td>

                          {/* Actions */}
                          <td style={{ padding: "14px 18px", textAlign: "center", verticalAlign: "middle", whiteSpace: "nowrap" }}>
                            <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
                              <button
                                type="button"
                                onClick={() => openInvoice(ev, true)}
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "4px",
                                  height: "30px",
                                  padding: "0 12px",
                                  borderRadius: "6px",
                                  border: "none",
                                  background: "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)",
                                  color: "#ffffff",
                                  fontWeight: 700,
                                  fontSize: "12px",
                                  cursor: "pointer",
                                  whiteSpace: "nowrap",
                                  boxShadow: "0 2px 6px rgba(124, 58, 237, 0.25)",
                                }}
                                title="Print or save as PDF"
                              >
                                🖨️ Print / PDF
                              </button>

                              <button
                                type="button"
                                onClick={() => openInvoice(ev, false)}
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  height: "30px",
                                  padding: "0 10px",
                                  borderRadius: "6px",
                                  border: "1px solid #ddd6fe",
                                  background: "#f5f3ff",
                                  color: "#6d28d9",
                                  fontWeight: 600,
                                  fontSize: "12px",
                                  cursor: "pointer",
                                  whiteSpace: "nowrap",
                                }}
                                title="View detailed bill"
                              >
                                👁️ View
                              </button>
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
        </div>
      </div>

      {/* ============================================================
          INVOICE & PRINT MODAL
      ============================================================ */}
      {modalOpen && activeEvent && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(15, 5, 25, 0.65)",
            backdropFilter: "blur(6px)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 9999,
            padding: "16px",
            overflowY: "auto",
          }}
          onClick={() => setModalOpen(false)}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: "16px",
              width: "100%",
              maxWidth: "850px",
              maxHeight: "92vh",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 25px 60px rgba(0, 0, 0, 0.4)",
              overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Screen Header (Hidden when printing) */}
            <div
              className="no-print"
              style={{
                padding: "16px 24px",
                background: "linear-gradient(135deg, #180828 0%, #2b0c4c 100%)",
                color: "#ffffff",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "12px",
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: "17px", fontWeight: 700 }}>
                  Tax Invoice — INV-2026-{String(activeEvent.id).padStart(5, "0")}
                </h3>
                <span style={{ fontSize: "12px", color: "#c084fc" }}>
                  Ready to print or export as PDF via browser print dialog
                </span>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <button
                  type="button"
                  onClick={handlePrintCurrentInvoice}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    background: "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "8px",
                    padding: "8px 18px",
                    fontWeight: 700,
                    fontSize: "13px",
                    cursor: "pointer",
                    boxShadow: "0 4px 14px rgba(124, 58, 237, 0.4)",
                  }}
                >
                  🖨️ Print to PDF
                </button>

                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  style={{
                    background: "rgba(255, 255, 255, 0.15)",
                    border: "none",
                    color: "#ffffff",
                    borderRadius: "50%",
                    width: "32px",
                    height: "32px",
                    cursor: "pointer",
                    fontSize: "16px",
                    display: "grid",
                    placeItems: "center",
                  }}
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Scrollable Printable Document Container */}
            <div
              style={{
                padding: "clamp(16px, 4vw, 36px)",
                overflowY: "auto",
                background: "#faf8fd",
                flex: 1,
              }}
            >
              {/* THE INVOICE PAPER (Target for PDF printing) */}
              <div
                id="printable-bill"
                className="print-card"
                style={{
                  background: "#ffffff",
                  borderRadius: "12px",
                  border: "1px solid #e9e3f1",
                  boxShadow: "0 4px 20px rgba(124, 58, 237, 0.05)",
                  padding: "clamp(20px, 4vw, 36px)",
                  color: "#1e0836",
                  fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
                }}
              >
                {/* 1. INVOICE TOP BAR */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    flexWrap: "wrap",
                    gap: "20px",
                    borderBottom: "2px solid #7c3aed",
                    paddingBottom: "20px",
                    marginBottom: "24px",
                  }}
                >
                  {/* Company Info */}
                  <div style={{ display: "flex", gap: "14px", alignItems: "flex-start" }}>
                    <div
                      style={{
                        width: "52px",
                        height: "52px",
                        borderRadius: "14px",
                        background: "linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)",
                        color: "#ffffff",
                        fontWeight: 900,
                        fontSize: "20px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        boxShadow: "0 4px 12px rgba(124, 58, 237, 0.3)",
                        flexShrink: 0,
                      }}
                    >
                      FC
                    </div>
                    <div>
                      <h2 style={{ margin: 0, fontSize: "20px", fontWeight: 800, color: "#1e0836" }}>
                        {profile.companyName}
                      </h2>
                      <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#6b5b7e", maxWidth: "340px", lineHeight: 1.4 }}>
                        {profile.address}
                      </p>
                      <div style={{ fontSize: "12px", color: "#6b5b7e", marginTop: "4px" }}>
                        <span>📞 {profile.contactPhone}</span> • <span>✉ {profile.contactEmail}</span>
                      </div>
                      <div style={{ fontSize: "12px", fontWeight: 700, color: "#7c3aed", marginTop: "4px" }}>
                        GSTIN: {profile.gstin}
                      </div>
                    </div>
                  </div>

                  {/* Document Title & Meta */}
                  <div style={{ textAlign: "right" }}>
                    <div
                      style={{
                        fontSize: "20px",
                        fontWeight: 900,
                        letterSpacing: "1px",
                        color: "#7c3aed",
                        textTransform: "uppercase",
                      }}
                    >
                      TAX INVOICE / BILL
                    </div>
                    <div style={{ fontSize: "14px", fontWeight: 800, color: "#1e0836", marginTop: "4px" }}>
                      # INV-2026-{String(activeEvent.id).padStart(5, "0")}
                    </div>
                    <div style={{ fontSize: "12px", color: "#6b5b7e", marginTop: "4px" }}>
                      Date: <strong>{formatDate(activeEvent.date || new Date().toISOString())}</strong>
                    </div>
                    <div style={{ marginTop: "8px" }}>
                      {(() => {
                        const billed = activeEvent.quote ?? activeEvent.total_estimate ?? 0;
                        const paid = activeEvent.paid_amount ?? 0;
                        const bal = activeEvent.balance ?? Math.max(0, billed - paid);
                        const isSettled = bal <= 0 && billed > 0;
                        const isPartial = paid > 0 && bal > 0;
                        return (
                          <span
                            style={{
                              display: "inline-block",
                              padding: "4px 12px",
                              borderRadius: "14px",
                              fontSize: "11px",
                              fontWeight: 800,
                              textTransform: "uppercase",
                              background: isSettled ? "#e8f8f0" : isPartial ? "#fef3c7" : "#fee2e2",
                              color: isSettled ? "#0d6832" : isPartial ? "#92400e" : "#b91c1c",
                              border: `1px solid ${isSettled ? "#a3e6c0" : isPartial ? "#fde68a" : "#fecaca"}`,
                            }}
                          >
                            {isSettled ? "PAID IN FULL" : isPartial ? "PARTIALLY PAID" : "PAYMENT DUE"}
                          </span>
                        );
                      })()}
                    </div>
                  </div>
                </div>

                {/* 2. BILLED TO CARD */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                    gap: "20px",
                    background: "#fbf9fc",
                    borderRadius: "10px",
                    border: "1px solid #ede7f5",
                    padding: "16px 20px",
                    marginBottom: "24px",
                  }}
                >
                  <div>
                    <span style={{ fontSize: "11px", fontWeight: 700, color: "#7c3aed", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                      BILLED TO
                    </span>
                    <div style={{ fontSize: "16px", fontWeight: 800, color: "#1e0836", marginTop: "4px" }}>
                      {activeEvent.customer_name}
                    </div>
                    {activeEvent.customer_mobile && (
                      <div style={{ fontSize: "13px", color: "#5d4e70", marginTop: "2px" }}>
                        Phone: {activeEvent.customer_mobile}
                      </div>
                    )}
                    <div style={{ fontSize: "12px", color: "#8a7b9b", marginTop: "2px" }}>
                      Customer ID: #{activeEvent.customer_id ?? "—"}
                    </div>
                  </div>

                  <div>
                    <span style={{ fontSize: "11px", fontWeight: 700, color: "#7c3aed", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                      EVENT PARTICULARS
                    </span>
                    <div style={{ fontSize: "15px", fontWeight: 700, color: "#1e0836", marginTop: "4px" }}>
                      {activeEvent.event_type}
                    </div>
                    <div style={{ fontSize: "13px", color: "#5d4e70", marginTop: "2px" }}>
                      Venue: <strong>{activeEvent.place || "Specified Venue"}</strong>
                    </div>
                    <div style={{ fontSize: "12px", color: "#6b5b7e", marginTop: "2px" }}>
                      Event Date: {formatDate(activeEvent.date)} • {activeEvent.guest_count} Guests
                    </div>
                  </div>
                </div>

                {/* 3. ITEMIZED BREAKDOWN TABLE */}
                <div style={{ marginBottom: "24px" }}>
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      fontSize: "13px",
                      textAlign: "left",
                    }}
                  >
                    <thead>
                      <tr
                        style={{
                          background: "#f5f0fa",
                          borderTop: "1px solid #e5dcf0",
                          borderBottom: "1px solid #e5dcf0",
                          color: "#4a2373",
                          fontWeight: 700,
                        }}
                      >
                        <th style={{ padding: "10px 14px", width: "40px" }}>#</th>
                        <th style={{ padding: "10px 14px" }}>Service / Package Description</th>
                        <th style={{ padding: "10px 14px", textAlign: "center", width: "120px" }}>Quantity</th>
                        <th style={{ padding: "10px 14px", textAlign: "right", width: "160px" }}>Amount (₹)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* Food & Catering */}
                      <tr style={{ borderBottom: "1px solid #f0eaf7" }}>
                        <td style={{ padding: "12px 14px", color: "#8a7b9b" }}>1</td>
                        <td style={{ padding: "12px 14px" }}>
                          <strong style={{ color: "#1e0836" }}>Food Catering & Menu Planning</strong>
                          <div style={{ fontSize: "12px", color: "#7a6e8a" }}>
                            Specialized multi-course banquet menu tailored for {activeEvent.guest_count} guests
                          </div>
                        </td>
                        <td style={{ padding: "12px 14px", textAlign: "center" }}>
                          {activeEvent.guest_count} guests
                        </td>
                        <td style={{ padding: "12px 14px", textAlign: "right", fontWeight: 700 }}>
                          ₹{formatMoney(activeEvent.food_amt)}
                        </td>
                      </tr>

                      {/* Decor */}
                      <tr style={{ borderBottom: "1px solid #f0eaf7" }}>
                        <td style={{ padding: "12px 14px", color: "#8a7b9b" }}>2</td>
                        <td style={{ padding: "12px 14px" }}>
                          <strong style={{ color: "#1e0836" }}>Stage & Theme Decoration</strong>
                          <div style={{ fontSize: "12px", color: "#7a6e8a" }}>
                            Lighting, floral stage arrangement, ambient props & guest seating setup
                          </div>
                        </td>
                        <td style={{ padding: "12px 14px", textAlign: "center" }}>1 package</td>
                        <td style={{ padding: "12px 14px", textAlign: "right", fontWeight: 700 }}>
                          ₹{formatMoney(activeEvent.decor_amt)}
                        </td>
                      </tr>

                      {/* Operations & Staff */}
                      <tr style={{ borderBottom: "1px solid #f0eaf7" }}>
                        <td style={{ padding: "12px 14px", color: "#8a7b9b" }}>3</td>
                        <td style={{ padding: "12px 14px" }}>
                          <strong style={{ color: "#1e0836" }}>Event Operations & Crew Deployment</strong>
                          <div style={{ fontSize: "12px", color: "#7a6e8a" }}>
                            On-site coordination, logistics crew, food stewards & service staff
                          </div>
                        </td>
                        <td style={{ padding: "12px 14px", textAlign: "center" }}>Event Crew</td>
                        <td style={{ padding: "12px 14px", textAlign: "right", fontWeight: 700 }}>
                          ₹{formatMoney(
                            Math.max(
                              0,
                              (activeEvent.total_estimate ?? 0) -
                                (activeEvent.food_amt ?? 0) -
                                (activeEvent.decor_amt ?? 0)
                            )
                          )}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* 4. TOTALS & BALANCE SUMMARY BOX */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "flex-end",
                    marginBottom: "28px",
                  }}
                >
                  <div style={{ width: "100%", maxWidth: "380px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: "13px" }}>
                      <span style={{ color: "#6b5b7e" }}>Estimated Base Cost:</span>
                      <strong style={{ color: "#1e0836" }}>₹{formatMoney(activeEvent.total_estimate)}</strong>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        padding: "8px 0",
                        fontSize: "14px",
                        borderTop: "1px solid #e5dcf0",
                        color: "#1e0836",
                        fontWeight: 800,
                      }}
                    >
                      <span>Final Agreed Total:</span>
                      <span style={{ fontSize: "16px", color: "#7c3aed" }}>
                        ₹{formatMoney(activeEvent.quote ?? activeEvent.total_estimate)}
                      </span>
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: "13px", color: "#166534" }}>
                      <span>Payments Received to Date:</span>
                      <strong>− ₹{formatMoney(activeEvent.paid_amount)}</strong>
                    </div>

                    {/* Grand Balance Due */}
                    {(() => {
                      const billed = activeEvent.quote ?? activeEvent.total_estimate ?? 0;
                      const paid = activeEvent.paid_amount ?? 0;
                      const bal = activeEvent.balance ?? Math.max(0, billed - paid);

                      return (
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            padding: "12px 16px",
                            background: bal > 0 ? "linear-gradient(135deg, #180828 0%, #2b0c4c 100%)" : "#e8f8f0",
                            color: bal > 0 ? "#ffffff" : "#0d6832",
                            borderRadius: "8px",
                            marginTop: "8px",
                            boxShadow: bal > 0 ? "0 4px 14px rgba(24, 8, 40, 0.25)" : "none",
                          }}
                        >
                          <span style={{ fontSize: "12px", fontWeight: 800, letterSpacing: "0.5px" }}>
                            {bal > 0 ? "BALANCE DUE PAYABLE" : "STATUS: SETTLED IN FULL"}
                          </span>
                          <span style={{ fontSize: "20px", fontWeight: 900 }}>
                            ₹{formatMoney(bal)}
                          </span>
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* 5. PAYMENT RECEIPTS HISTORY TABLE (IF ANY) */}
                {activeEventPayments.length > 0 && (
                  <div style={{ marginBottom: "28px" }}>
                    <div style={{ fontSize: "13px", fontWeight: 700, color: "#1e0836", marginBottom: "8px" }}>
                      Recorded Payment Receipts
                    </div>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px", textAlign: "left" }}>
                      <thead>
                        <tr style={{ background: "#fbf9fe", borderBottom: "1px solid #ebe4f5", color: "#6b5b7e" }}>
                          <th style={{ padding: "8px 12px" }}>Date</th>
                          <th style={{ padding: "8px 12px" }}>Payment Mode</th>
                          <th style={{ padding: "8px 12px" }}>Type</th>
                          <th style={{ padding: "8px 12px" }}>Note / Ref #</th>
                          <th style={{ padding: "8px 12px", textAlign: "right" }}>Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeEventPayments.map((p) => (
                          <tr key={p.id} style={{ borderBottom: "1px solid #f3eff8" }}>
                            <td style={{ padding: "8px 12px" }}>{formatDate(p.payment_date)}</td>
                            <td style={{ padding: "8px 12px", fontWeight: 600 }}>{p.payment_method}</td>
                            <td style={{ padding: "8px 12px" }}>{p.payment_type}</td>
                            <td style={{ padding: "8px 12px", color: "#6b5b7e" }}>{p.note || "—"}</td>
                            <td style={{ padding: "8px 12px", textAlign: "right", fontWeight: 700, color: "#166534" }}>
                              ₹{formatMoney(p.amount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* 6. BANKING & TERMS & SIGNATURE FOOTER */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
                    gap: "24px",
                    borderTop: "1px dashed #dcd2ea",
                    paddingTop: "20px",
                    marginTop: "20px",
                  }}
                >
                  {/* Banking & Terms */}
                  <div>
                    <span style={{ fontSize: "11px", fontWeight: 700, color: "#7c3aed", textTransform: "uppercase" }}>
                      PAYMENT INSTRUCTIONS
                    </span>
                    <div style={{ fontSize: "12px", color: "#5d4e70", marginTop: "4px", lineHeight: 1.5 }}>
                      Please settle balance via NEFT, RTGS, UPI, or cash.
                    </div>
                    <div style={{ fontSize: "11px", color: "#8a7b9b", marginTop: "6px" }}>
                      {profile.receiptFooter}
                    </div>
                  </div>

                  {/* Signature Block */}
                  <div style={{ textAlign: "right", display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
                    <div style={{ height: "45px" }} />
                    <div style={{ borderTop: "1px solid #3c2058", display: "inline-block", width: "180px", marginLeft: "auto" }} />
                    <div style={{ fontSize: "12px", fontWeight: 700, color: "#1e0836", marginTop: "4px" }}>
                      Authorized Signatory
                    </div>
                    <div style={{ fontSize: "11px", color: "#8a7b9b" }}>
                      {profile.companyName}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default function BillingPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, textAlign: "center" }}>Loading billing module...</div>}>
      <BillingContent />
    </Suspense>
  );
}
