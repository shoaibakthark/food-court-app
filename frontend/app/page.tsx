"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "./lib/auth";
import { SidebarUserCard, OwnerBanner, NavLink, TopbarUserBadge, AppSidebar, MobileMenuButton } from "./components/AuthBar";

const API_URL = typeof window !== "undefined" ? "/api/py" : "http://127.0.0.1:8000";

// ============================================================
// TYPES
// ============================================================

type EventData = {
  id: number;
  date: string;
  guest_count: number;
  food_amt: number;
  total_estimate: number;
  place: string;
  customer_id: number;

  customer?: {
    id: number;
    name: string;
    mobile: string;
  } | null;
  customer_name?: string;
  customer_mobile?: string;

  event_type: string;
  decor_amt: number;
  quote: number | null;
};

type PaymentData = {
  id: number;
  event_id?: number | null;
  amount: number;
  payment_method?: string | null;
  payment_type?: string | null;
  payment_date?: string | null;
  note?: string | null;
};

type StaffMember = {
  id: number;
  name: string;
  mobile?: string | null;
  role_id?: number | null;
  role_name?: string | null;
  salary?: number | string | null;
  wage?: number;
  daily_wage?: number;
  events_count?: number;
  total_earnings?: number;
  total_paid?: number;
  pending_balance?: number;
};

type CustomerPendingEvent = {
  id: number;
  date: string;
  place: string;
  event_type: string;
  customer_name: string;
  customer_mobile?: string | null;
  total: number;
  paid: number;
  balance: number;
};

// ============================================================
// DASHBOARD
// ============================================================

export default function Home() {
  // ==========================================================
  const { user, isOwner, isManager, logout, loading: authLoading } = useAuth();

  const [events, setEvents] = useState<EventData[]>([]);
  const [payments, setPayments] = useState<PaymentData[]>([]);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [pendingTab, setPendingTab] = useState<"customer" | "staff">("customer");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // ==========================================================
  // LOAD DASHBOARD DATA (EVENTS, PAYMENTS, STAFF)
  // ==========================================================

  useEffect(() => {
    if (!user) return;

    async function loadDashboardData() {
      try {
        setLoading(true);
        setError("");

        const [eventsRes, paymentsRes, staffRes] = await Promise.all([
          fetch(`${API_URL}/events`, { cache: "no-store" }),
          fetch(`${API_URL}/payments`, { cache: "no-store" }).catch(() => null),
          fetch(`${API_URL}/staff`, { cache: "no-store" }).catch(() => null),
        ]);

        if (!eventsRes.ok) {
          throw new Error(`Failed to load events: ${eventsRes.status}`);
        }

        const eventsData: EventData[] = await eventsRes.json();
        setEvents(Array.isArray(eventsData) ? eventsData : []);

        if (paymentsRes && paymentsRes.ok) {
          const paymentsData = await paymentsRes.json();
          setPayments(Array.isArray(paymentsData) ? paymentsData : []);
        }

        if (staffRes && staffRes.ok) {
          const staffData = await staffRes.json();
          setStaffList(Array.isArray(staffData) ? staffData : []);
        }
      } catch (error) {
        console.error("Dashboard data loading error:", error);
        setError(
          "Failed to load dashboard data. Please check that FastAPI is running."
        );
      } finally {
        setLoading(false);
      }
    }

    loadDashboardData();
  }, [user]);

  // ==========================================================
  // TOTAL EVENTS
  // ==========================================================

  const totalEvents = events.length;

  // ==========================================================
  // TOTAL REVENUE
  // ==========================================================

  const totalRevenue = events.reduce((total, event) => {
    const amount =
      event.quote ??
      event.total_estimate ??
      Number(event.food_amt || 0) + Number(event.decor_amt || 0);

    return total + Number(amount || 0);
  }, 0);

  // ==========================================================
  // CUSTOMER PENDING CALCULATION
  // ==========================================================

  const paymentsByEvent = useMemo(() => {
    const map: Record<number, number> = {};
    payments.forEach((p) => {
      if (p.event_id) {
        map[p.event_id] = (map[p.event_id] || 0) + Number(p.amount || 0);
      }
    });
    return map;
  }, [payments]);

  const customerPendingEvents = useMemo<CustomerPendingEvent[]>(() => {
    return events
      .map((event) => {
        const total = Number(
          event.quote ??
            event.total_estimate ??
            Number(event.food_amt || 0) + Number(event.decor_amt || 0)
        );
        const paid = paymentsByEvent[event.id] || 0;
        const balance = Math.max(0, total - paid);
        return {
          id: event.id,
          date: event.date,
          place: event.place,
          event_type: event.event_type || "Event",
          customer_name:
            event.customer?.name || event.customer_name || `Customer #${event.customer_id}`,
          customer_mobile: event.customer?.mobile || event.customer_mobile || null,
          total,
          paid,
          balance,
        };
      })
      .filter((e) => e.balance > 0 && e.total > 0)
      .sort((a, b) => b.balance - a.balance);
  }, [events, paymentsByEvent]);

  const totalCustomerPending = useMemo(() => {
    return customerPendingEvents.reduce((sum, e) => sum + e.balance, 0);
  }, [customerPendingEvents]);

  // ==========================================================
  // STAFF PENDING CALCULATION
  // ==========================================================

  const staffPendingList = useMemo(() => {
    return staffList
      .filter((s) => Number(s.pending_balance || 0) > 0)
      .sort((a, b) => Number(b.pending_balance || 0) - Number(a.pending_balance || 0));
  }, [staffList]);

  const totalStaffPending = useMemo(() => {
    return staffList.reduce((sum, s) => sum + Number(s.pending_balance || 0), 0);
  }, [staffList]);

  // ==========================================================
  // UPCOMING EVENTS
  // ==========================================================

  const upcomingEvents = events
    .filter((event) => {
      const eventDate = new Date(event.date);

      const today = new Date();

      today.setHours(0, 0, 0, 0);

      return eventDate >= today;
    })
    .sort(
      (a, b) =>
        new Date(a.date).getTime() -
        new Date(b.date).getTime()
    );

  // ==========================================================
  // TOTAL UPCOMING EVENTS
  // ==========================================================

  const totalUpcoming = upcomingEvents.length;

  // ==========================================================
  // TOTAL GUESTS
  // ==========================================================

  const totalGuests = events.reduce(
    (total, event) =>
      total + Number(event.guest_count || 0),
    0
  );

  // ==========================================================
  // FORMAT MONEY
  // ==========================================================

  const formatMoney = (amount: number) => {
    return Number(amount || 0).toLocaleString(
      "en-IN"
    );
  };

  // ==========================================================
  // FORMAT DATE
  // ==========================================================

  const formatDate = (date: string) => {
    if (!date) {
      return "-";
    }

    return new Date(date).toLocaleDateString(
      "en-IN",
      {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }
    );
  };

  // ==========================================================
  // EVENT SYMBOL
  // ==========================================================

  const getEventSymbol = (eventType: string) => {
    if (!eventType) {
      return "E";
    }

    return eventType.charAt(0).toUpperCase();
  };

  // ==========================================================
  // EVENT COLOR
  // ==========================================================

  const getEventColor = (eventType: string) => {
    const type = eventType?.toLowerCase();

    if (type === "wedding") {
      return "purple";
    }

    if (type === "engagement") {
      return "gold";
    }

    if (type === "birthday") {
      return "blue";
    }

    if (type === "corporate") {
      return "green";
    }

    return "purple";
  };

  // ==========================================================
  // AUTH GUARD
  // ==========================================================

  if (authLoading || !user) {
    return (
      <main className="dashboard" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "#faf8fd" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "28px", fontWeight: 800, color: "#1e0836", marginBottom: "8px" }}>Food Court</div>
          <div style={{ fontSize: "14px", color: "#7a6e8f" }}>Checking authentication…</div>
        </div>
      </main>
    );
  }

  // ==========================================================
  // RETURN
  // ==========================================================

  return (
    <main className="dashboard">
      <AppSidebar activeRoute="/" />

      {/* ====================================================
          MAIN CONTENT
      ==================================================== */}

      <section className="main-content">

        {/* TOP BAR */}

        <header className="topbar">
          <MobileMenuButton />

          <div className="search-box">

            <span>
              ⌕
            </span>

            <input
              type="text"
              placeholder="Search events, customers..."
            />

            <kbd>
              ⌘ K
            </kbd>

          </div>

          <div className="top-actions">

            <button
              className="icon-button"
              type="button"
              title="Notifications"
            >
              ♧
            </button>

            <button
              className="icon-button notification"
              type="button"
              title="Notifications"
            >
              ♢
              <span></span>
            </button>

            <TopbarUserBadge />

          </div>

        </header>

        {/* CONTENT */}

        <div className="page-content">

          <OwnerBanner />

          {/* PAGE HEADER */}

          <section className="page-heading">

            <div>

              <span className="eyebrow">
                OVERVIEW
              </span>

              <h1>
                Dashboard
              </h1>

              <p>
                Welcome back. Here's what's happening
                with your events today.
              </p>

            </div>

            {!isOwner && (
              <Link
                className="primary-button"
                href="/create-event"
              >
                <span>
                  ＋
                </span>

                Create Event
              </Link>
            )}

          </section>

          {/* ERROR */}

          {error && (
            <div
              style={{
                background: "#fff1f2",
                color: "#b42318",
                padding: "12px 16px",
                borderRadius: "10px",
                marginBottom: "20px",
              }}
            >
              {error}
            </div>
          )}

          {/* ==================================================
              SUMMARY CARDS
          ================================================== */}

          <section className="summary-grid">

            {/* TOTAL REVENUE */}

            <Link
              href="/reports"
              className="summary-card dashboard-link-card"
            >

              <div className="summary-top">

                <div className="summary-icon purple">
                  ₹
                </div>

                <span className="trend positive">
                  Live
                </span>

              </div>

              <span className="summary-label">
                Total Revenue
              </span>

              <strong className="summary-value">
                ₹{formatMoney(totalRevenue)}
              </strong>

              <span className="summary-note">
                From all events
              </span>

            </Link>

            {/* CUSTOMER PENDING */}

            <div
              role="button"
              tabIndex={0}
              onClick={() => {
                setPendingTab("customer");
                const el = document.getElementById("pending-balances-section");
                if (el) el.scrollIntoView({ behavior: "smooth" });
              }}
              className="summary-card dashboard-link-card"
              style={{ cursor: "pointer" }}
            >

              <div className="summary-top">

                <div className="summary-icon gold">
                  ₹
                </div>

                <span className={`trend ${totalCustomerPending > 0 ? "warning" : "positive"}`}>
                  {customerPendingEvents.length > 0 ? `${customerPendingEvents.length} Events` : "Settled"}
                </span>

              </div>

              <span className="summary-label">
                Customer Pending
              </span>

              <strong className="summary-value" style={{ color: totalCustomerPending > 0 ? "#b45309" : "#166534" }}>
                ₹{formatMoney(totalCustomerPending)}
              </strong>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "4px" }}>
                <span className="summary-note">
                  {customerPendingEvents.length > 0
                    ? `${customerPendingEvents.length} receivables pending`
                    : "Zero customer dues"}
                </span>
                <Link
                  href="/payments"
                  onClick={(e) => e.stopPropagation()}
                  style={{ fontSize: "11px", color: "#8a8490", fontWeight: 700, textDecoration: "none" }}
                >
                  Ledger →
                </Link>
              </div>

            </div>

            {/* STAFF PENDING */}

            <div
              role="button"
              tabIndex={0}
              onClick={() => {
                setPendingTab("staff");
                const el = document.getElementById("pending-balances-section");
                if (el) el.scrollIntoView({ behavior: "smooth" });
              }}
              className="summary-card dashboard-link-card"
              style={{ cursor: "pointer" }}
            >

              <div className="summary-top">

                <div className="summary-icon blue">
                  ♙
                </div>

                <span className={`trend ${totalStaffPending > 0 ? "warning" : "positive"}`}>
                  {staffPendingList.length > 0 ? `${staffPendingList.length} Unpaid` : "Settled"}
                </span>

              </div>

              <span className="summary-label">
                Staff Pending
              </span>

              <strong className="summary-value" style={{ color: totalStaffPending > 0 ? "#b45309" : "#166534" }}>
                ₹{formatMoney(totalStaffPending)}
              </strong>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "4px" }}>
                <span className="summary-note">
                  {staffPendingList.length > 0
                    ? `${staffPendingList.length} staff awaiting wages`
                    : "All staff wages settled"}
                </span>
                <Link
                  href="/staff"
                  onClick={(e) => e.stopPropagation()}
                  style={{ fontSize: "11px", color: "#8a8490", fontWeight: 700, textDecoration: "none" }}
                >
                  Staff →
                </Link>
              </div>

            </div>

            {/* TOTAL EVENTS */}

            <Link
              href="/events"
              className="summary-card dashboard-link-card"
            >

              <div className="summary-top">

                <div className="summary-icon green">
                  ▣
                </div>

                <span className="trend positive">
                  {totalUpcoming} Upcoming
                </span>

              </div>

              <span className="summary-label">
                Total Events
              </span>

              <strong className="summary-value">
                {totalEvents}
              </strong>

              <span className="summary-note">
                {totalGuests.toLocaleString("en-IN")} total guests
              </span>

            </Link>

          </section>

          {/* ==================================================
              TWO COLUMN AREA
          ================================================== */}

          <section className="dashboard-grid">

            {/* REVENUE */}

            <div className="dashboard-panel revenue-panel">

              <div className="panel-heading">

                <div>

                  <h2>
                    Revenue Overview
                  </h2>

                  <p>
                    Current event revenue
                  </p>

                </div>

                <select defaultValue="6">

                  <option value="6">
                    Last 6 months
                  </option>

                  <option value="12">
                    Last 12 months
                  </option>

                </select>

              </div>

              <div className="revenue-summary">

                <strong>
                  ₹{formatMoney(totalRevenue)}
                </strong>

                <span>
                  Based on event quotes
                </span>

              </div>

              <div className="chart">

                <div className="chart-y">

                  <span>
                    ₹{formatMoney(totalRevenue)}
                  </span>

                  <span>
                    ₹0
                  </span>

                </div>

                <div className="chart-area">

                  <div
                    className="chart-line"
                    style={{
                      height: "100%",
                    }}
                  >

                    <span className="point p1"></span>
                    <span className="point p2"></span>
                    <span className="point p3"></span>
                    <span className="point p4"></span>
                    <span className="point p5"></span>
                    <span className="point p6"></span>

                  </div>

                  <div className="chart-months">

                    <span>May</span>
                    <span>Jun</span>
                    <span>Jul</span>
                    <span>Aug</span>
                    <span>Sep</span>
                    <span>Oct</span>

                  </div>

                </div>

              </div>

            </div>

            {/* QUICK ACTIONS */}

            <div className="dashboard-panel quick-panel">

              <div className="panel-heading">

                <div>

                  <h2>
                    Quick Actions
                  </h2>

                  <p>
                    Common tasks
                  </p>

                </div>

              </div>

              <div className="quick-list">

                <Link
                  href="/create-event"
                  className="quick-item"
                >

                  <span className="quick-icon purple">
                    ＋
                  </span>

                  <span>

                    <strong>
                      Create Event
                    </strong>

                    <small>
                      Create a new event
                    </small>

                  </span>

                  <b>
                    ›
                  </b>

                </Link>

                <Link
                  href="/staff"
                  className="quick-item"
                >

                  <span className="quick-icon blue">
                    ♙
                  </span>

                  <span>

                    <strong>
                      Add Staff
                    </strong>

                    <small>
                      Assign staff to event
                    </small>

                  </span>

                  <b>
                    ›
                  </b>

                </Link>

                <Link
                  href="/sub-teams"
                  className="quick-item"
                >

                  <span className="quick-icon green">
                    ♧
                  </span>

                  <span>

                    <strong>
                      Add Sub Team
                    </strong>

                    <small>
                      Add event team
                    </small>

                  </span>

                  <b>
                    ›
                  </b>

                </Link>

                <Link
                  href="/payments"
                  className="quick-item"
                >

                  <span className="quick-icon gold">
                    ₹
                  </span>

                  <span>

                    <strong>
                      Customer Payment
                    </strong>

                    <small>
                      Record payment
                    </small>

                  </span>

                  <b>
                    ›
                  </b>

                </Link>

                <Link
                  href="/expenses"
                  className="quick-item"
                >

                  <span className="quick-icon red">
                    −
                  </span>

                  <span>

                    <strong>
                      Add Expense
                    </strong>

                    <small>
                      Record an expense
                    </small>

                  </span>

                  <b>
                    ›
                  </b>

                </Link>

              </div>

            </div>

          </section>

          {/* ==================================================
              PENDING BALANCES (CUSTOMER RECEIVABLES & STAFF WAGES)
          ================================================== */}

          <section id="pending-balances-section" className="dashboard-panel" style={{ marginTop: "24px", marginBottom: "24px" }}>

            <div className="panel-heading" style={{ flexWrap: "wrap", gap: "12px", borderBottom: "1px solid #e9e5f0", paddingBottom: "16px" }}>

              <div>

                <h2>
                  Pending Balances & Receivables
                </h2>

                <p>
                  Active ledger of customer payments due and unpaid staff wages
                </p>

              </div>

              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>

                <button
                  type="button"
                  onClick={() => setPendingTab("customer")}
                  style={{
                    padding: "8px 18px",
                    borderRadius: "8px",
                    border: "none",
                    cursor: "pointer",
                    fontSize: "13px",
                    fontWeight: 700,
                    background: pendingTab === "customer" ? "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)" : "#f5f3ff",
                    color: pendingTab === "customer" ? "#ffffff" : "#6d28d9",
                    boxShadow: pendingTab === "customer" ? "0 4px 14px rgba(124, 58, 237, 0.3)" : "none",
                    transition: "all 0.15s ease",
                  }}
                >
                  Customer Pending ({customerPendingEvents.length})
                </button>

                <button
                  type="button"
                  onClick={() => setPendingTab("staff")}
                  style={{
                    padding: "8px 18px",
                    borderRadius: "8px",
                    border: "none",
                    cursor: "pointer",
                    fontSize: "13px",
                    fontWeight: 700,
                    background: pendingTab === "staff" ? "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)" : "#f5f3ff",
                    color: pendingTab === "staff" ? "#ffffff" : "#6d28d9",
                    boxShadow: pendingTab === "staff" ? "0 4px 14px rgba(124, 58, 237, 0.3)" : "none",
                    transition: "all 0.15s ease",
                  }}
                >
                  Staff Pending ({staffPendingList.length})
                </button>

              </div>

            </div>

            {/* TAB 1: CUSTOMER PENDING */}

            {pendingTab === "customer" && (
              <div style={{ marginTop: "16px" }}>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    background: totalCustomerPending > 0 ? "#fef9ee" : "#f0fdf4",
                    border: totalCustomerPending > 0 ? "1px solid #f9e2b2" : "1px solid #bbf7d0",
                    borderRadius: "10px",
                    padding: "12px 18px",
                    marginBottom: "16px",
                  }}
                >

                  <div>

                    <span style={{ fontSize: "11px", color: totalCustomerPending > 0 ? "#92400e" : "#166534", fontWeight: 700, textTransform: "uppercase" }}>
                      Total Customer Receivables Outstanding
                    </span>

                    <div style={{ fontSize: "20px", fontWeight: 800, color: totalCustomerPending > 0 ? "#b45309" : "#15803d", marginTop: "2px" }}>
                      ₹{formatMoney(totalCustomerPending)}
                    </div>

                  </div>

                  <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    <Link
                      href="/billing"
                      style={{
                        background: "#f5f3ff",
                        color: "#6d28d9",
                        border: "1px solid #ddd6fe",
                        padding: "8px 14px",
                        borderRadius: "8px",
                        fontSize: "12px",
                        fontWeight: 700,
                        textDecoration: "none",
                      }}
                    >
                      🧾 Invoices & Bills →
                    </Link>

                    <Link
                      href="/payments"
                      style={{
                        background: "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)",
                        color: "#ffffff",
                        padding: "8px 16px",
                        borderRadius: "8px",
                        fontSize: "12px",
                        fontWeight: 700,
                        textDecoration: "none",
                        boxShadow: "0 4px 12px rgba(124, 58, 237, 0.3)",
                      }}
                    >
                      Payments Module →
                    </Link>
                  </div>

                </div>

                {customerPendingEvents.length === 0 ? (
                  <div style={{ padding: "40px 20px", textAlign: "center", color: "#15803d" }}>

                    <div style={{ fontSize: "36px", marginBottom: "8px" }}>✓</div>

                    <h3 style={{ margin: "0 0 4px 0", color: "#15803d" }}>All Customer Invoices Settled</h3>

                    <p style={{ margin: 0, fontSize: "13px", color: "#166534" }}>
                      No customers currently have an outstanding balance on their events.
                    </p>

                  </div>
                ) : (
                  <div className="events-table-wrapper">

                    <table className="events-table">

                      <thead>

                        <tr>

                          <th>EVENT / DATE</th>
                          <th>VENUE</th>
                          <th>CUSTOMER</th>
                          <th style={{ textAlign: "right" }}>QUOTE</th>
                          <th style={{ textAlign: "right" }}>COLLECTED</th>
                          <th style={{ textAlign: "right" }}>PENDING DUE</th>
                          <th style={{ textAlign: "center" }}>ACTION</th>

                        </tr>

                      </thead>

                      <tbody>

                        {customerPendingEvents.slice(0, 8).map((e) => (
                          <tr key={e.id}>

                            <td>
                              <div className="event-name">

                                <div className={`event-symbol ${getEventColor(e.event_type)}`}>
                                  {getEventSymbol(e.event_type)}
                                </div>

                                <div>

                                  <Link
                                    href={`/events/${e.id}`}
                                    style={{ fontWeight: 700, color: "#1e0836", textDecoration: "none" }}
                                  >
                                    Event #{e.id}
                                  </Link>

                                  <small style={{ display: "block" }}>{formatDate(e.date)}</small>

                                </div>

                              </div>
                            </td>

                            <td>{e.place || "-"}</td>

                            <td>
                              <strong>{e.customer_name}</strong>
                              {e.customer_mobile && (
                                <small style={{ display: "block", color: "#7a6e8a" }}>📞 {e.customer_mobile}</small>
                              )}
                            </td>

                            <td style={{ textAlign: "right", fontWeight: 600 }}>₹{formatMoney(e.total)}</td>

                            <td style={{ textAlign: "right", fontWeight: 600, color: "#166534" }}>₹{formatMoney(e.paid)}</td>

                            <td style={{ textAlign: "right", fontWeight: 800, color: "#b45309" }}>
                              ₹{formatMoney(e.balance)}
                            </td>

                            <td style={{ textAlign: "center" }}>
                              <div style={{ display: "flex", justifyContent: "center", gap: "6px" }}>

                                <Link
                                  href={`/events/${e.id}`}
                                  style={{
                                    padding: "6px 12px",
                                    borderRadius: "6px",
                                    background: "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)",
                                    color: "#ffffff",
                                    fontWeight: 700,
                                    fontSize: "11px",
                                    textDecoration: "none",
                                    boxShadow: "0 2px 8px rgba(124, 58, 237, 0.25)",
                                  }}
                                >
                                  Collect
                                </Link>

                                <Link
                                  href={`/events/${e.id}`}
                                  style={{
                                    padding: "6px 12px",
                                    borderRadius: "6px",
                                    background: "#f5f3ff",
                                    color: "#6d28d9",
                                    border: "1px solid #ddd6fe",
                                    fontWeight: 700,
                                    fontSize: "11px",
                                    textDecoration: "none",
                                  }}
                                >
                                  Details
                                </Link>

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

            {/* TAB 2: STAFF PENDING */}

            {pendingTab === "staff" && (
              <div style={{ marginTop: "16px" }}>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    background: totalStaffPending > 0 ? "#fef9ee" : "#f0fdf4",
                    border: totalStaffPending > 0 ? "1px solid #f9e2b2" : "1px solid #bbf7d0",
                    borderRadius: "10px",
                    padding: "12px 18px",
                    marginBottom: "16px",
                  }}
                >

                  <div>

                    <span style={{ fontSize: "11px", color: totalStaffPending > 0 ? "#92400e" : "#166534", fontWeight: 700, textTransform: "uppercase" }}>
                      Total Staff Wages Pending Disbursal
                    </span>

                    <div style={{ fontSize: "20px", fontWeight: 800, color: totalStaffPending > 0 ? "#b45309" : "#15803d", marginTop: "2px" }}>
                      ₹{formatMoney(totalStaffPending)}
                    </div>

                  </div>

                  <Link
                    href="/staff"
                    style={{
                      background: "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)",
                      color: "#ffffff",
                      padding: "8px 16px",
                      borderRadius: "8px",
                      fontSize: "12px",
                      fontWeight: 700,
                      textDecoration: "none",
                      boxShadow: "0 4px 12px rgba(124, 58, 237, 0.3)",
                    }}
                  >
                    Staff Directory →
                  </Link>

                </div>

                {staffPendingList.length === 0 ? (
                  <div style={{ padding: "40px 20px", textAlign: "center", color: "#15803d" }}>

                    <div style={{ fontSize: "36px", marginBottom: "8px" }}>✓</div>

                    <h3 style={{ margin: "0 0 4px 0", color: "#15803d" }}>All Staff Wages Settled</h3>

                    <p style={{ margin: 0, fontSize: "13px", color: "#166534" }}>
                      No staff members currently have unpaid wage balances.
                    </p>

                  </div>
                ) : (
                  <div className="events-table-wrapper">

                    <table className="events-table">

                      <thead>

                        <tr>

                          <th>STAFF MEMBER</th>
                          <th>ROLE</th>
                          <th>MOBILE</th>
                          <th style={{ textAlign: "center" }}>EVENTS WORKED</th>
                          <th style={{ textAlign: "right" }}>TOTAL EARNED</th>
                          <th style={{ textAlign: "right" }}>PAID</th>
                          <th style={{ textAlign: "right" }}>PENDING WAGE</th>
                          <th style={{ textAlign: "center" }}>ACTION</th>

                        </tr>

                      </thead>

                      <tbody>

                        {staffPendingList.map((s) => (
                          <tr key={s.id}>

                            <td>
                              <Link
                                href={`/staff/${s.id}`}
                                style={{
                                  textDecoration: "none",
                                  color: "inherit",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "10px",
                                }}
                              >
                                <div
                                  style={{
                                    width: "32px",
                                    height: "32px",
                                    borderRadius: "50%",
                                    background: "#f3eaf7",
                                    color: "#603b7d",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    fontWeight: 800,
                                    fontSize: "12px",
                                  }}
                                >
                                  {s.name.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <strong>{s.name}</strong>
                                  <small style={{ display: "block", color: "#7a6e8a" }}>Staff #{s.id}</small>
                                </div>
                              </Link>
                            </td>

                            <td>
                              <span
                                style={{
                                  display: "inline-block",
                                  padding: "3px 8px",
                                  borderRadius: "10px",
                                  fontSize: "11px",
                                  fontWeight: 700,
                                  background: "#f3eaf7",
                                  color: "#603b7d",
                                }}
                              >
                                {s.role_name || "General Staff"}
                              </span>
                            </td>

                            <td>{s.mobile || "—"}</td>

                            <td style={{ textAlign: "center" }}>
                              <span
                                style={{
                                  display: "inline-block",
                                  padding: "3px 8px",
                                  borderRadius: "10px",
                                  fontSize: "11px",
                                  fontWeight: 700,
                                  background: "#e0e7ff",
                                  color: "#3730a3",
                                }}
                              >
                                {s.events_count || 0} events
                              </span>
                            </td>

                            <td style={{ textAlign: "right", fontWeight: 600 }}>₹{formatMoney(s.total_earnings || 0)}</td>

                            <td style={{ textAlign: "right", fontWeight: 600, color: "#166534" }}>₹{formatMoney(s.total_paid || 0)}</td>

                            <td style={{ textAlign: "right", fontWeight: 800, color: "#b45309" }}>
                              ₹{formatMoney(s.pending_balance || 0)}
                            </td>

                            <td style={{ textAlign: "center" }}>
                              <Link
                                href={`/staff/${s.id}`}
                                style={{
                                  padding: "6px 12px",
                                  borderRadius: "6px",
                                  background: "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)",
                                  color: "#ffffff",
                                  fontWeight: 700,
                                  fontSize: "11px",
                                  textDecoration: "none",
                                  boxShadow: "0 2px 8px rgba(124, 58, 237, 0.25)",
                                }}
                              >
                                Disburse Wage
                              </Link>
                            </td>

                          </tr>
                        ))}

                      </tbody>

                    </table>

                  </div>
                )}

              </div>
            )}

          </section>

          {/* ==================================================
              UPCOMING EVENTS
          ================================================== */}

          <section className="dashboard-panel events-panel">

            <div className="panel-heading">

              <div>

                <h2>
                  Upcoming Events
                </h2>

                <p>
                  Your next scheduled events
                </p>

              </div>

              <Link href="/events">
                View all →
              </Link>

            </div>

            <div className="events-table-wrapper">

              <table className="events-table">

                <thead>

                  <tr>

                    <th>EVENT</th>
                    <th>DATE</th>
                    <th>VENUE</th>
                    <th>CUSTOMER</th>
                    <th>GUESTS</th>
                    <th>AMOUNT</th>
                    <th>STATUS</th>

                  </tr>

                </thead>

                <tbody>

                  {/* LOADING */}

                  {loading && (
                    <tr>

                      <td
                        colSpan={7}
                        style={{
                          textAlign: "center",
                          padding: "30px",
                        }}
                      >
                        Loading events...
                      </td>

                    </tr>
                  )}

                  {/* EMPTY */}

                  {!loading &&
                    upcomingEvents.length === 0 && (
                      <tr>

                        <td
                          colSpan={7}
                          style={{
                            textAlign: "center",
                            padding: "30px",
                          }}
                        >
                          No upcoming events.
                        </td>

                      </tr>
                    )}

                  {/* EVENTS */}

                  {!loading &&
                    upcomingEvents
                      .slice(0, 5)
                      .map((event) => (

                        <tr key={event.id}>

                          {/* EVENT */}

                          <td>

                            <div className="event-name">

                              <div
                                className={`event-symbol ${getEventColor(
                                  event.event_type
                                )}`}
                              >
                                {getEventSymbol(
                                  event.event_type
                                )}
                              </div>

                              <div>

                                <strong>
                                  {event.event_type}
                                </strong>

                                <small>
                                  Event #{event.id}
                                </small>

                              </div>

                            </div>

                          </td>

                          {/* DATE */}

                          <td>
                            {formatDate(event.date)}
                          </td>

                          {/* VENUE */}

                          <td>
                            {event.place}
                          </td>

                          {/* CUSTOMER */}

                          <td>
                            {event.customer?.name || `Customer #${event.customer_id}`}
                          </td>

                          {/* GUESTS */}

                          <td>
                            {Number(
                              event.guest_count || 0
                            ).toLocaleString("en-IN")}
                          </td>

                          {/* AMOUNT */}

                          <td>
                            ₹
                            {formatMoney(
                              Number(
                                event.quote ??
                                  event.total_estimate ??
                                  0
                              )
                            )}
                          </td>

                          {/* STATUS */}

                          <td>

                            <span className="status upcoming">
                              Upcoming
                            </span>

                          </td>

                        </tr>

                      ))}

                </tbody>

              </table>

            </div>

          </section>

        </div>

      </section>

    </main>
  );
}