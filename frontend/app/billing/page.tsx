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
  tagline?: string;
  contactPhone: string;
  contactEmail: string;
  address: string;
  gstin: string;
  pan?: string;
  stateCode?: string;
  fssai?: string;
  bankName?: string;
  accountName?: string;
  accountNo?: string;
  ifscCode?: string;
  branchName?: string;
  upiId?: string;
  currency: string;
  receiptFooter: string;
};

const DEFAULT_PROFILE: CompanyProfile = {
  companyName: "Food Court Event Management & Catering",
  tagline: "Premium Event Planning, Luxury Catering & Production",
  contactPhone: "+91 96333 71320",
  contactEmail: "contact@foodcourtkerala.com",
  address: "Puthanathani, Malappuram, Kerala - 676552",
  gstin: "32AAAAA0000A1Z5",
  pan: "ABCDE1234F",
  stateCode: "Kerala (Code: 32)",
  fssai: "11322001000456",
  bankName: "Federal Bank Ltd",
  accountName: "Food Court Event Management",
  accountNo: "14280200049281",
  ifscCode: "FDRL0001428",
  branchName: "Puthanathani Branch",
  upiId: "foodcourt@upi",
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

function numberToWordsINR(amount: number | string | null | undefined): string {
  const num = Math.round(Math.abs(Number(amount) || 0));
  if (num === 0) return "Zero Rupees Only";

  const a = [
    "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
    "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen",
  ];
  const b = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  function formatChunk(n: number): string {
    let str = "";
    if (n >= 100) {
      str += a[Math.floor(n / 100)] + " Hundred ";
      n %= 100;
    }
    if (n > 0) {
      if (str !== "") str += "and ";
      if (n < 20) {
        str += a[n] + " ";
      } else {
        str += b[Math.floor(n / 10)] + " ";
        if (n % 10 > 0) {
          str += a[n % 10] + " ";
        }
      }
    }
    return str.trim();
  }

  const crore = Math.floor(num / 10000000);
  let remainder = num % 10000000;
  const lakh = Math.floor(remainder / 100000);
  remainder %= 100000;
  const thousand = Math.floor(remainder / 1000);
  const hundred = remainder % 1000;

  let res = "";
  if (crore > 0) res += formatChunk(crore) + " Crore ";
  if (lakh > 0) res += formatChunk(lakh) + " Lakh ";
  if (thousand > 0) res += formatChunk(thousand) + " Thousand ";
  if (hundred > 0) res += formatChunk(hundred) + " ";

  return ("Rupees " + res.trim() + " Only").replace(/\s+/g, " ");
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
        <div className={`page-content ${modalOpen ? "no-print" : ""}`}>
          <OwnerBanner />
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
          INVOICE & PRINT MODAL (Corporate Standard GST Tax Invoice)
      ============================================================ */}
      {modalOpen && activeEvent && (
        <div
          className="invoice-modal-overlay"
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(15, 5, 25, 0.72)",
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
            className="invoice-modal-dialog"
            style={{
              background: "#ffffff",
              borderRadius: "16px",
              width: "100%",
              maxWidth: "890px",
              maxHeight: "94vh",
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
                padding: "14px 24px",
                background: "linear-gradient(135deg, #180828 0%, #2b0c4c 100%)",
                color: "#ffffff",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "12px",
                borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                  <h3 style={{ margin: 0, fontSize: "17px", fontWeight: 800 }}>
                    Tax Invoice — INV-2026-{String(activeEvent.id).padStart(5, "0")}
                  </h3>
                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: 700,
                      background: "rgba(124, 58, 237, 0.4)",
                      padding: "2px 8px",
                      borderRadius: "12px",
                      color: "#e9d5ff",
                      border: "1px solid rgba(192, 132, 252, 0.3)",
                    }}
                  >
                    {activeEvent.customer_name}
                  </span>
                </div>
                <span style={{ fontSize: "12px", color: "#c084fc", marginTop: "2px", display: "block" }}>
                  Official Commercial Tax Invoice • Ready for high-resolution print or PDF export
                </span>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <button
                  type="button"
                  onClick={handleCopyInvoiceLink}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    background: "rgba(255, 255, 255, 0.12)",
                    color: "#ffffff",
                    border: "1px solid rgba(255, 255, 255, 0.2)",
                    borderRadius: "8px",
                    padding: "8px 14px",
                    fontWeight: 600,
                    fontSize: "12px",
                    cursor: "pointer",
                  }}
                  title="Copy direct shareable invoice link"
                >
                  {copyStatus ? "✓ Copied!" : "📋 Copy Link"}
                </button>

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
                  🖨️ Print / Save as PDF
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
                  title="Close modal"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Scrollable Printable Document Container */}
            <div
              className="invoice-scroll-container"
              style={{
                padding: "clamp(16px, 3.5vw, 32px)",
                overflowY: "auto",
                background: "#f4f1f8",
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
                  border: "1px solid #e5daf0",
                  boxShadow: "0 4px 24px rgba(124, 58, 237, 0.08)",
                  padding: "clamp(20px, 4vw, 36px)",
                  color: "#180828",
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
                    marginBottom: "20px",
                  }}
                >
                  {/* Company Info Left */}
                  <div style={{ display: "flex", gap: "14px", alignItems: "flex-start", maxWidth: "480px" }}>
                    <div
                      style={{
                        width: "56px",
                        height: "56px",
                        borderRadius: "14px",
                        background: "linear-gradient(135deg, #180828 0%, #7c3aed 100%)",
                        color: "#ffffff",
                        fontWeight: 900,
                        fontSize: "22px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        letterSpacing: "1px",
                        boxShadow: "0 4px 14px rgba(124, 58, 237, 0.25)",
                        flexShrink: 0,
                      }}
                    >
                      FC
                    </div>
                    <div>
                      <h2
                        style={{
                          margin: 0,
                          fontSize: "20px",
                          fontWeight: 800,
                          color: "#180828",
                          letterSpacing: "-0.3px",
                          lineHeight: 1.25,
                        }}
                      >
                        {profile.companyName}
                      </h2>
                      <div
                        style={{
                          fontSize: "12px",
                          fontWeight: 600,
                          color: "#7c3aed",
                          marginTop: "2px",
                          letterSpacing: "0.2px",
                        }}
                      >
                        {profile.tagline || "Premium Event Planning, Luxury Catering & Production"}
                      </div>
                      <p
                        style={{
                          margin: "4px 0 0 0",
                          fontSize: "12px",
                          color: "#4b5563",
                          lineHeight: 1.4,
                        }}
                      >
                        {profile.address}
                      </p>
                      <div style={{ fontSize: "12px", color: "#4b5563", marginTop: "3px" }}>
                        <span>📞 {profile.contactPhone}</span> • <span>✉ {profile.contactEmail}</span>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: "8px",
                          fontSize: "11px",
                          fontWeight: 700,
                          color: "#1e0836",
                          background: "#f5f0fb",
                          padding: "4px 8px",
                          borderRadius: "6px",
                          marginTop: "6px",
                          border: "1px solid #ebdcf7",
                        }}
                      >
                        <span>GSTIN: <strong style={{ color: "#7c3aed" }}>{profile.gstin}</strong></span>
                        <span>•</span>
                        <span>PAN: <strong>{profile.pan || "ABCDE1234F"}</strong></span>
                        <span>•</span>
                        <span>State: <strong>{profile.stateCode || "Kerala (32)"}</strong></span>
                        {profile.fssai && (
                          <>
                            <span>•</span>
                            <span>FSSAI: <strong>{profile.fssai}</strong></span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Document Title & Meta Right */}
                  <div style={{ textAlign: "right", minWidth: "210px", flexShrink: 0 }}>
                    <div
                      style={{
                        fontSize: "22px",
                        fontWeight: 900,
                        letterSpacing: "1.2px",
                        color: "#6d28d9",
                        textTransform: "uppercase",
                        lineHeight: 1.1,
                      }}
                    >
                      TAX INVOICE
                    </div>
                    <div
                      style={{
                        fontSize: "11px",
                        fontWeight: 600,
                        color: "#6b7280",
                        letterSpacing: "0.4px",
                        marginTop: "2px",
                        textTransform: "uppercase",
                      }}
                    >
                      Original for Recipient
                    </div>
                    <div
                      style={{
                        fontSize: "14px",
                        fontWeight: 800,
                        color: "#111827",
                        marginTop: "6px",
                        fontFamily: "monospace",
                      }}
                    >
                      INV-2026-{String(activeEvent.id).padStart(5, "0")}
                    </div>
                    <div style={{ fontSize: "12px", color: "#4b5563", marginTop: "3px" }}>
                      Invoice Date: <strong>{formatDate(activeEvent.date || new Date().toISOString())}</strong>
                    </div>
                    <div style={{ fontSize: "11px", color: "#6b7280", marginTop: "2px" }}>
                      Place of Supply: <strong>Kerala (Code 32)</strong>
                    </div>
                    <div style={{ fontSize: "11px", color: "#6b7280", marginTop: "2px" }}>
                      Reverse Charge: <strong>No</strong>
                    </div>

                    {/* Status Badge */}
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
                              borderRadius: "16px",
                              fontSize: "11px",
                              fontWeight: 800,
                              letterSpacing: "0.4px",
                              textTransform: "uppercase",
                              background: isSettled ? "#dcfce7" : isPartial ? "#fef3c7" : "#fee2e2",
                              color: isSettled ? "#15803d" : isPartial ? "#b45309" : "#b91c1c",
                              border: `1.5px solid ${isSettled ? "#86efac" : isPartial ? "#fde68a" : "#fca5a5"}`,
                            }}
                          >
                            {isSettled
                              ? "✓ PAID IN FULL"
                              : isPartial
                              ? `⚡ PARTIALLY PAID (BAL: ₹${formatMoney(bal)})`
                              : `● PAYMENT DUE (₹${formatMoney(bal)})`}
                          </span>
                        );
                      })()}
                    </div>
                  </div>
                </div>

                {/* 2. BILLED TO & EVENT PARTICULARS (Two-Column Card) */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                    gap: "16px",
                    background: "#faf7fd",
                    borderRadius: "10px",
                    border: "1px solid #ebdcf5",
                    padding: "16px 20px",
                    marginBottom: "20px",
                  }}
                >
                  {/* Card 1: Billed To */}
                  <div style={{ borderRight: "1px dashed #e2d4f0", paddingRight: "12px" }}>
                    <div
                      style={{
                        fontSize: "11px",
                        fontWeight: 800,
                        color: "#6d28d9",
                        textTransform: "uppercase",
                        letterSpacing: "0.8px",
                        marginBottom: "6px",
                      }}
                    >
                      BILLED TO (CLIENT / RECIPIENT)
                    </div>
                    <div style={{ fontSize: "16px", fontWeight: 800, color: "#180828" }}>
                      {activeEvent.customer_name}
                    </div>
                    {activeEvent.customer_mobile && (
                      <div style={{ fontSize: "13px", color: "#374151", marginTop: "3px" }}>
                        Phone: <strong>+91 {activeEvent.customer_mobile}</strong>
                      </div>
                    )}
                    <div style={{ fontSize: "12px", color: "#6b7280", marginTop: "2px" }}>
                      Client ID: <strong>#CUST-{activeEvent.customer_id ?? "001"}</strong>
                    </div>
                    <div style={{ fontSize: "12px", color: "#6b7280", marginTop: "2px" }}>
                      Billing Address / Location: <strong>{activeEvent.place || "Kerala, India"}</strong>
                    </div>
                    <div
                      style={{
                        fontSize: "11px",
                        color: "#4b5563",
                        marginTop: "5px",
                        background: "#f3e8ff",
                        display: "inline-block",
                        padding: "2px 8px",
                        borderRadius: "4px",
                        fontWeight: 600,
                      }}
                    >
                      Category: Unregistered Consumer (B2C)
                    </div>
                  </div>

                  {/* Card 2: Event Details */}
                  <div>
                    <div
                      style={{
                        fontSize: "11px",
                        fontWeight: 800,
                        color: "#6d28d9",
                        textTransform: "uppercase",
                        letterSpacing: "0.8px",
                        marginBottom: "6px",
                      }}
                    >
                      EVENT & SERVICE PARTICULARS
                    </div>
                    <div style={{ fontSize: "16px", fontWeight: 800, color: "#180828" }}>
                      {activeEvent.event_type}
                    </div>
                    <div style={{ fontSize: "13px", color: "#374151", marginTop: "3px" }}>
                      Venue / Destination: <strong>{activeEvent.place || "Designated Event Venue"}</strong>
                    </div>
                    <div style={{ fontSize: "12px", color: "#4b5563", marginTop: "2px" }}>
                      Event Date: <strong>{formatDate(activeEvent.date)}</strong>
                    </div>
                    <div style={{ fontSize: "12px", color: "#4b5563", marginTop: "2px" }}>
                      Guaranteed Attendance: <strong>{activeEvent.guest_count} Pax (Guests)</strong>
                    </div>
                    <div
                      style={{
                        fontSize: "11px",
                        color: "#4b5563",
                        marginTop: "5px",
                        background: "#f3e8ff",
                        display: "inline-block",
                        padding: "2px 8px",
                        borderRadius: "4px",
                        fontWeight: 600,
                      }}
                    >
                      Booking Order Ref: EVT-{String(activeEvent.id).padStart(5, "0")}
                    </div>
                  </div>
                </div>

                {/* 3. ITEMIZED BREAKDOWN TABLE */}
                <div style={{ marginBottom: "20px", overflowX: "auto" }}>
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      fontSize: "12.5px",
                      textAlign: "left",
                      border: "1px solid #ebdcf5",
                      borderRadius: "8px",
                      overflow: "hidden",
                    }}
                  >
                    <thead>
                      <tr
                        style={{
                          background: "#f3eefb",
                          borderBottom: "1.5px solid #d4c2ec",
                          color: "#3b185f",
                          fontWeight: 700,
                          textTransform: "uppercase",
                          fontSize: "11px",
                          letterSpacing: "0.4px",
                        }}
                      >
                        <th style={{ padding: "10px 12px", width: "40px", textAlign: "center" }}>#</th>
                        <th style={{ padding: "10px 12px" }}>Description of Services / Supplies</th>
                        <th style={{ padding: "10px 12px", textAlign: "center", width: "90px" }}>SAC Code</th>
                        <th style={{ padding: "10px 12px", textAlign: "center", width: "110px" }}>Pax / Qty</th>
                        <th style={{ padding: "10px 12px", textAlign: "right", width: "120px" }}>Rate (₹)</th>
                        <th style={{ padding: "10px 12px", textAlign: "right", width: "140px" }}>Amount (₹)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoiceItems.map((item, index) => (
                        <tr
                          key={item.id}
                          style={{
                            borderBottom: "1px solid #f0e6f8",
                            background: index % 2 === 0 ? "#ffffff" : "#fcfbfe",
                          }}
                        >
                          <td style={{ padding: "12px", textAlign: "center", color: "#6b7280", fontWeight: 600 }}>
                            {String(index + 1).padStart(2, "0")}
                          </td>
                          <td style={{ padding: "12px" }}>
                            <div style={{ fontWeight: 700, color: "#180828", fontSize: "13px" }}>
                              {item.title}
                            </div>
                            <div style={{ fontSize: "11.5px", color: "#64748b", marginTop: "3px", lineHeight: 1.4 }}>
                              {item.desc}
                            </div>
                          </td>
                          <td style={{ padding: "12px", textAlign: "center", fontFamily: "monospace", fontWeight: 600, color: "#6d28d9" }}>
                            {item.sac}
                          </td>
                          <td style={{ padding: "12px", textAlign: "center", fontWeight: 600, color: "#374151" }}>
                            {item.qty}
                          </td>
                          <td style={{ padding: "12px", textAlign: "right", color: "#374151" }}>
                            {item.rate > 0 ? `₹${formatMoney(item.rate)}` : "—"}
                          </td>
                          <td style={{ padding: "12px", textAlign: "right", fontWeight: 700, color: "#180828" }}>
                            ₹{formatMoney(item.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* 4. FINANCIAL RECONCILIATION & BANKING SECTION */}
                {(() => {
                  const finalTotal = activeEvent.quote ?? activeEvent.total_estimate ?? 0;
                  const subtotalExclTax = Math.round(finalTotal / 1.05);
                  const gstAmount = Math.max(0, finalTotal - subtotalExclTax);
                  const cgstAmount = Math.round(gstAmount / 2);
                  const sgstAmount = gstAmount - cgstAmount;
                  const paid = activeEvent.paid_amount ?? 0;
                  const bal = activeEvent.balance ?? Math.max(0, finalTotal - paid);

                  return (
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                        gap: "20px",
                        marginBottom: "20px",
                        alignItems: "flex-start",
                      }}
                    >
                      {/* Left: Amount in Words & Remittance Details */}
                      <div>
                        {/* Amount in words */}
                        <div
                          style={{
                            background: "#fbf9fd",
                            border: "1px solid #ebdcf5",
                            borderRadius: "8px",
                            padding: "10px 14px",
                            marginBottom: "14px",
                          }}
                        >
                          <div style={{ fontSize: "10px", fontWeight: 800, color: "#6d28d9", textTransform: "uppercase", letterSpacing: "0.6px" }}>
                            TOTAL AMOUNT IN WORDS (INR)
                          </div>
                          <div style={{ fontSize: "12.5px", fontWeight: 700, color: "#180828", marginTop: "3px", fontStyle: "italic", lineHeight: 1.4 }}>
                            {numberToWordsINR(finalTotal)}
                          </div>
                        </div>

                        {/* Bank remittance card */}
                        <div
                          style={{
                            background: "#fafafa",
                            border: "1px solid #e5e7eb",
                            borderRadius: "8px",
                            padding: "12px 16px",
                          }}
                        >
                          <div style={{ fontSize: "11px", fontWeight: 800, color: "#374151", textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: "8px", display: "flex", alignItems: "center", gap: "6px" }}>
                            <span>🏦</span> COMPANY REMITTANCE & BANK DETAILS
                          </div>
                          <div style={{ display: "grid", gridTemplateColumns: "95px 1fr", gap: "4px 8px", fontSize: "12px" }}>
                            <span style={{ color: "#6b7280" }}>Bank Name:</span>
                            <strong style={{ color: "#111827" }}>{profile.bankName || "Federal Bank Ltd"}</strong>

                            <span style={{ color: "#6b7280" }}>A/c Name:</span>
                            <strong style={{ color: "#111827" }}>{profile.accountName || "Food Court Event Management"}</strong>

                            <span style={{ color: "#6b7280" }}>A/c Number:</span>
                            <strong style={{ color: "#111827", fontFamily: "monospace", letterSpacing: "0.5px" }}>{profile.accountNo || "14280200049281"}</strong>

                            <span style={{ color: "#6b7280" }}>IFSC Code:</span>
                            <strong style={{ color: "#111827", fontFamily: "monospace" }}>{profile.ifscCode || "FDRL0001428"}</strong>

                            <span style={{ color: "#6b7280" }}>Branch:</span>
                            <strong style={{ color: "#111827" }}>{profile.branchName || "Puthanathani Branch"}</strong>

                            <span style={{ color: "#6b7280" }}>UPI VPA ID:</span>
                            <strong style={{ color: "#6d28d9", fontFamily: "monospace" }}>{profile.upiId || "foodcourt@upi"}</strong>
                          </div>
                        </div>
                      </div>

                      {/* Right: Totals Ledger */}
                      <div>
                        <div
                          style={{
                            background: "#fbf9fd",
                            border: "1px solid #ebdcf5",
                            borderRadius: "10px",
                            padding: "14px 18px",
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: "12.5px" }}>
                            <span style={{ color: "#4b5563" }}>Taxable Subtotal (Excl. Tax):</span>
                            <span style={{ fontWeight: 600, color: "#180828" }}>₹{formatMoney(subtotalExclTax)}</span>
                          </div>

                          <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: "12px", color: "#6b7280" }}>
                            <span>CGST @ 2.5%:</span>
                            <span>₹{formatMoney(cgstAmount)}</span>
                          </div>

                          <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: "12px", color: "#6b7280" }}>
                            <span>SGST @ 2.5%:</span>
                            <span>₹{formatMoney(sgstAmount)}</span>
                          </div>

                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              padding: "10px 0 8px 0",
                              fontSize: "14px",
                              borderTop: "1.5px solid #d4c2ec",
                              color: "#180828",
                              fontWeight: 800,
                            }}
                          >
                            <span>Total Invoice Value:</span>
                            <span style={{ fontSize: "16px", color: "#6d28d9" }}>
                              ₹{formatMoney(finalTotal)}
                            </span>
                          </div>

                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              padding: "6px 0",
                              fontSize: "12.5px",
                              color: "#15803d",
                              borderTop: "1px dashed #e2d4f0",
                            }}
                          >
                            <span>Recorded Payments to Date:</span>
                            <strong>− ₹{formatMoney(paid)}</strong>
                          </div>

                          {/* Net Balance Due Box */}
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              padding: "12px 16px",
                              background: bal > 0 ? "linear-gradient(135deg, #180828 0%, #350f58 100%)" : "#dcfce7",
                              color: bal > 0 ? "#ffffff" : "#15803d",
                              borderRadius: "8px",
                              marginTop: "10px",
                              boxShadow: bal > 0 ? "0 4px 14px rgba(24, 8, 40, 0.25)" : "none",
                            }}
                          >
                            <div>
                              <div style={{ fontSize: "10.5px", fontWeight: 800, letterSpacing: "0.6px", textTransform: "uppercase", opacity: 0.9 }}>
                                {bal > 0 ? "NET BALANCE DUE" : "STATUS: FULLY SETTLED"}
                              </div>
                              <div style={{ fontSize: "10px", opacity: 0.75 }}>
                                {bal > 0 ? "Payable on or before event delivery" : "Zero outstanding balance"}
                              </div>
                            </div>
                            <div style={{ fontSize: "20px", fontWeight: 900, letterSpacing: "-0.5px" }}>
                              ₹{formatMoney(bal)}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* 5. RECORDED PAYMENT RECEIPTS TABLE (IF ANY) */}
                {activeEventPayments.length > 0 && (
                  <div style={{ marginBottom: "20px" }}>
                    <div
                      style={{
                        fontSize: "11.5px",
                        fontWeight: 800,
                        color: "#180828",
                        textTransform: "uppercase",
                        letterSpacing: "0.6px",
                        marginBottom: "8px",
                      }}
                    >
                      RECORDED PAYMENT RECEIPTS TO DATE
                    </div>
                    <table
                      style={{
                        width: "100%",
                        borderCollapse: "collapse",
                        fontSize: "12px",
                        textAlign: "left",
                        border: "1px solid #e5e7eb",
                        borderRadius: "6px",
                        overflow: "hidden",
                      }}
                    >
                      <thead>
                        <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", color: "#475569", fontSize: "11px", fontWeight: 700 }}>
                          <th style={{ padding: "8px 12px" }}>Receipt Date</th>
                          <th style={{ padding: "8px 12px" }}>Payment Mode</th>
                          <th style={{ padding: "8px 12px" }}>Category</th>
                          <th style={{ padding: "8px 12px" }}>Transaction Ref / Note</th>
                          <th style={{ padding: "8px 12px", textAlign: "right" }}>Amount Credited</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeEventPayments.map((p) => (
                          <tr key={p.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                            <td style={{ padding: "8px 12px" }}>{formatDate(p.payment_date)}</td>
                            <td style={{ padding: "8px 12px", fontWeight: 600 }}>{p.payment_method}</td>
                            <td style={{ padding: "8px 12px" }}>{p.payment_type}</td>
                            <td style={{ padding: "8px 12px", color: "#64748b" }}>{p.note || "Standard Receipt"}</td>
                            <td style={{ padding: "8px 12px", textAlign: "right", fontWeight: 700, color: "#15803d" }}>
                              ₹{formatMoney(p.amount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* 6. TERMS & CONDITIONS AND DUAL SIGNATORIES */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                    gap: "24px",
                    borderTop: "1.5px dashed #d8cbe8",
                    paddingTop: "18px",
                    marginTop: "16px",
                  }}
                >
                  {/* Terms & Conditions */}
                  <div>
                    <div
                      style={{
                        fontSize: "10.5px",
                        fontWeight: 800,
                        color: "#6d28d9",
                        textTransform: "uppercase",
                        letterSpacing: "0.6px",
                        marginBottom: "6px",
                      }}
                    >
                      TERMS & CONDITIONS
                    </div>
                    <ul
                      style={{
                        margin: 0,
                        paddingLeft: "16px",
                        fontSize: "11px",
                        color: "#4b5563",
                        lineHeight: 1.55,
                      }}
                    >
                      <li>All cheques / transfers should be drawn in favor of <strong>Food Court Event Management</strong>.</li>
                      <li>Net balance due is payable upon completion or delivery of contracted event services.</li>
                      <li>Final guest count adjustments must be locked 72 hours prior to the event commencement date.</li>
                      <li>This is a computer-generated tax invoice issued in accordance with Section 31 of CGST / SGST Act 2017.</li>
                    </ul>
                    <div style={{ fontSize: "11px", color: "#6b7280", marginTop: "8px", fontStyle: "italic" }}>
                      {profile.receiptFooter}
                    </div>
                  </div>

                  {/* Dual Signatory Blocks */}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-end",
                      gap: "16px",
                    }}
                  >
                    {/* Customer Acceptance */}
                    <div style={{ textAlign: "center", flex: 1 }}>
                      <div style={{ height: "48px" }} />
                      <div style={{ borderTop: "1px solid #cbd5e1", width: "100%", margin: "0 auto" }} />
                      <div style={{ fontSize: "11.5px", fontWeight: 700, color: "#1e0836", marginTop: "5px" }}>
                        Customer Acceptance
                      </div>
                      <div style={{ fontSize: "10px", color: "#64748b" }}>
                        Name & Signature
                      </div>
                    </div>

                    {/* Authorized Signatory */}
                    <div style={{ textAlign: "center", flex: 1 }}>
                      <div
                        style={{
                          height: "48px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <span
                          style={{
                            border: "1px dashed #c084fc",
                            borderRadius: "50%",
                            width: "44px",
                            height: "44px",
                            display: "grid",
                            placeItems: "center",
                            fontSize: "8px",
                            color: "#7c3aed",
                            fontWeight: 700,
                            textTransform: "uppercase",
                            opacity: 0.6,
                          }}
                        >
                          SEAL
                        </span>
                      </div>
                      <div style={{ borderTop: "1.5px solid #1e0836", width: "100%", margin: "0 auto" }} />
                      <div style={{ fontSize: "11.5px", fontWeight: 800, color: "#1e0836", marginTop: "5px" }}>
                        Authorized Signatory
                      </div>
                      <div style={{ fontSize: "10px", color: "#64748b" }}>
                        For {profile.companyName}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Scoped Print Isolation Styles */}
      <style jsx global>{`
        @media print {
          body {
            background: #ffffff !important;
            color: #0f172a !important;
          }
          .no-print,
          .topbar,
          .sidebar,
          .mobile-menu-button {
            display: none !important;
          }
          .invoice-modal-overlay {
            position: static !important;
            background: transparent !important;
            backdrop-filter: none !important;
            padding: 0 !important;
            margin: 0 !important;
            display: block !important;
            width: 100% !important;
            height: auto !important;
            overflow: visible !important;
            z-index: auto !important;
          }
          .invoice-modal-dialog {
            position: static !important;
            max-width: 100% !important;
            max-height: none !important;
            width: 100% !important;
            box-shadow: none !important;
            border: none !important;
            border-radius: 0 !important;
            overflow: visible !important;
            background: #ffffff !important;
          }
          .invoice-scroll-container {
            padding: 0 !important;
            margin: 0 !important;
            background: #ffffff !important;
            overflow: visible !important;
            display: block !important;
          }
          #printable-bill {
            border: none !important;
            box-shadow: none !important;
            padding: 0 !important;
            margin: 0 auto !important;
            width: 100% !important;
            max-width: 100% !important;
            background: #ffffff !important;
          }
        }
      `}</style>
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
