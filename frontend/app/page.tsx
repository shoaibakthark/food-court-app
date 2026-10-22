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

type KitchenSummary = {
  total_staff: number;
  active_staff: number;
  monthly_staff_count: number;
  daily_staff_count: number;
  total_wages: number;
  total_paid: number;
  total_pending_balance: number;
  today_duties_count: number;
  today_duty_wages: number;
};

type KitchenStaffMember = {
  id: number;
  name: string;
  mobile?: string | null;
  kitchen_role: string;
  wage_type: "daily" | "monthly";
  wage_rate: number;
  status: string;
  duties_count: number;
  total_wages: number;
  total_paid: number;
  balance: number;
};

type ExpenseRecord = {
  id: number;
  title: string;
  category: string;
  amount: number;
  expense_date: string;
  event_id?: number | null;
  payment_method?: string | null;
  vendor?: string | null;
  bill_number?: string | null;
  note?: string | null;
  event_type?: string | null;
  event_place?: string | null;
};

type ExpenseSettlementRecord = {
  id: number;
  vendor: string;
  amount: number;
  settlement_date: string;
  payment_mode?: string | null;
  reference_no?: string | null;
  note?: string | null;
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
  const [kitchenSummary, setKitchenSummary] = useState<KitchenSummary | null>(null);
  const [kitchenStaffList, setKitchenStaffList] = useState<KitchenStaffMember[]>([]);
  const [expensesList, setExpensesList] = useState<ExpenseRecord[]>([]);
  const [settlementsList, setSettlementsList] = useState<ExpenseSettlementRecord[]>([]);
  const [pendingTab, setPendingTab] = useState<"customer" | "staff" | "kitchen" | "supplier">("customer");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [chartTimeframe, setChartTimeframe] = useState<6 | 12>(6);
  const [chartSeries, setChartSeries] = useState<"both" | "revenue" | "expenses">("both");
  const [hoveredPointIndex, setHoveredPointIndex] = useState<number | null>(null);

  // ==========================================================
  // LOAD DASHBOARD DATA (EVENTS, PAYMENTS, STAFF, KITCHEN, EXPENSES)
  // ==========================================================

  useEffect(() => {
    if (!user) return;

    async function loadDashboardData() {
      try {
        setLoading(true);
        setError("");

        const [
          eventsRes,
          paymentsRes,
          staffRes,
          kitchenSummaryRes,
          kitchenStaffRes,
          expensesRes,
          settlementsRes,
        ] = await Promise.all([
          fetch(`${API_URL}/events`, { cache: "no-store" }),
          fetch(`${API_URL}/payments`, { cache: "no-store" }).catch(() => null),
          fetch(`${API_URL}/staff`, { cache: "no-store" }).catch(() => null),
          fetch(`${API_URL}/kitchen/summary`, { cache: "no-store" }).catch(() => null),
          fetch(`${API_URL}/kitchen/staff`, { cache: "no-store" }).catch(() => null),
          fetch(`${API_URL}/expenses`, { cache: "no-store" }).catch(() => null),
          fetch(`${API_URL}/expenses/settlements`, { cache: "no-store" }).catch(() => null),
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

        if (kitchenSummaryRes && kitchenSummaryRes.ok) {
          const kSummaryData = await kitchenSummaryRes.json();
          setKitchenSummary(kSummaryData);
        }

        if (kitchenStaffRes && kitchenStaffRes.ok) {
          const kStaffData = await kitchenStaffRes.json();
          setKitchenStaffList(Array.isArray(kStaffData) ? kStaffData : []);
        }

        if (expensesRes && expensesRes.ok) {
          const expData = await expensesRes.json();
          setExpensesList(Array.isArray(expData) ? expData : []);
        }

        if (settlementsRes && settlementsRes.ok) {
          const setData = await settlementsRes.json();
          setSettlementsList(Array.isArray(setData) ? setData : []);
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

  const handleSendWhatsAppReminder = (pending: CustomerPendingEvent) => {
    const rawMobile = pending.customer_mobile || "";
    const cleanMobile = rawMobile.replace(/[^0-9]/g, "");
    const dateFormatted = pending.date ? new Date(pending.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

    const msg = [
      `✨ *FOOD COURT EVENT MANAGEMENT & CATERING*`,
      `----------------------------------------`,
      `Dear *${pending.customer_name}*,`,
      ``,
      `Greetings from Food Court! We hope you had a wonderful celebration for your *${pending.event_type}* on ${dateFormatted}.`,
      ``,
      `This is a gentle payment reminder regarding the outstanding balance:`,
      `• *Total Event Estimate:* ₹${formatMoney(pending.total)}`,
      `• *Advance/Paid:* ₹${formatMoney(pending.paid)}`,
      `• *Balance Due:* *₹${formatMoney(pending.balance)}*`,
      ``,
      `Please let us know once the transfer is completed, or reply here for any assistance.`,
      `----------------------------------------`,
      `_Warm regards,_`,
      `*Food Court Management*`,
    ].join("\n");

    const phonePrefix = cleanMobile.length === 10 ? `91${cleanMobile}` : cleanMobile;
    const url = phonePrefix
      ? `https://wa.me/${phonePrefix}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank");
  };

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

  const totalStaffWages = useMemo(() => {
    return staffList.reduce((sum, s) => sum + Number(s.total_earnings || s.salary || 0), 0);
  }, [staffList]);

  // ==========================================================
  // KITCHEN STAFF WAGES CALCULATION
  // ==========================================================

  const kitchenTotalWages = useMemo(() => {
    return Number(kitchenSummary?.total_wages || 0);
  }, [kitchenSummary]);

  const kitchenPendingStaffList = useMemo(() => {
    return kitchenStaffList
      .filter((k) => Number(k.balance || 0) > 0)
      .sort((a, b) => Number(b.balance || 0) - Number(a.balance || 0));
  }, [kitchenStaffList]);

  const totalKitchenPending = useMemo(() => {
    return Number(kitchenSummary?.total_pending_balance ?? kitchenPendingStaffList.reduce((sum, k) => sum + Number(k.balance || 0), 0));
  }, [kitchenSummary, kitchenPendingStaffList]);

  // ==========================================================
  // EXPENSES & SUPPLIER KHATA CALCULATION
  // ==========================================================

  const totalExpenses = useMemo(() => {
    return expensesList.reduce((sum, e) => sum + Number(e.amount || 0), 0);
  }, [expensesList]);

  const directPaidExpenses = useMemo(() => {
    return expensesList
      .filter((e) => (e.payment_method || "").toLowerCase() !== "credit / khata")
      .reduce((sum, e) => sum + Number(e.amount || 0), 0);
  }, [expensesList]);

  const supplierCreditIncurred = useMemo(() => {
    return expensesList
      .filter((e) => (e.payment_method || "").toLowerCase() === "credit / khata")
      .reduce((sum, e) => sum + Number(e.amount || 0), 0);
  }, [expensesList]);

  const totalSettlementsCleared = useMemo(() => {
    return settlementsList.reduce((sum, s) => sum + Number(s.amount || 0), 0);
  }, [settlementsList]);

  const vendorPendingList = useMemo(() => {
    const map: Record<string, { totalCredit: number; settled: number; count: number }> = {};
    expensesList.forEach((e) => {
      const isCredit = (e.payment_method || "").toLowerCase() === "credit / khata";
      const vendorName = (e.vendor || "").trim();
      if (!vendorName) return;
      if (!map[vendorName]) map[vendorName] = { totalCredit: 0, settled: 0, count: 0 };
      if (isCredit) {
        map[vendorName].totalCredit += Number(e.amount || 0);
        map[vendorName].count += 1;
      }
    });
    settlementsList.forEach((s) => {
      const vendorName = (s.vendor || "").trim();
      if (!vendorName) return;
      if (!map[vendorName]) map[vendorName] = { totalCredit: 0, settled: 0, count: 0 };
      map[vendorName].settled += Number(s.amount || 0);
    });

    return Object.entries(map)
      .map(([name, data]) => ({
        name,
        vendor: name,
        creditIncurred: data.totalCredit,
        totalCredit: data.totalCredit,
        settled: data.settled,
        balance: Math.max(0, data.totalCredit - data.settled),
        billsCount: data.count,
      }))
      .filter((v) => v.balance > 0)
      .sort((a, b) => b.balance - a.balance);
  }, [expensesList, settlementsList]);

  const totalSupplierCreditPending = useMemo(() => {
    return vendorPendingList.reduce((sum, v) => sum + v.balance, 0);
  }, [vendorPendingList]);

  // Net Estimated Business Profit
  const netProfit = useMemo(() => {
    return totalRevenue - totalExpenses - totalStaffWages - kitchenTotalWages;
  }, [totalRevenue, totalExpenses, totalStaffWages, kitchenTotalWages]);

  const profitMargin = useMemo(() => {
    if (totalRevenue <= 0) return 0;
    return Math.round((netProfit / totalRevenue) * 100);
  }, [netProfit, totalRevenue]);

  // ==========================================================
  // COMPACT INDIAN NUMBER FORMATTER (FOR CHART Y-AXIS)
  // ==========================================================

  const formatCompactIndian = (num: number) => {
    if (num >= 10000000) {
      const cr = (num / 10000000).toFixed(1).replace(/\.0$/, "");
      return `₹${cr}Cr`;
    }
    if (num >= 100000) {
      const lk = (num / 100000).toFixed(1).replace(/\.0$/, "");
      return `₹${lk}L`;
    }
    if (num >= 1000) {
      const k = (num / 1000).toFixed(1).replace(/\.0$/, "");
      return `₹${k}k`;
    }
    return `₹${num}`;
  };

  // ==========================================================
  // MONTHLY REVENUE & EXPENSES CHART AGGREGATION
  // ==========================================================

  const monthlyChartData = useMemo(() => {
    const now = new Date();
    let anchor = new Date(now.getFullYear(), now.getMonth(), 1);
    events.forEach((e) => {
      if (e.date) {
        const d = new Date(e.date);
        if (d > anchor) anchor = new Date(d.getFullYear(), d.getMonth(), 1);
      }
    });

    const months: {
      key: string;
      shortMonth: string;
      fullMonth: string;
      year: number;
      revenue: number;
      eventsCount: number;
      expenses: number;
      expenseCount: number;
    }[] = [];

    for (let i = chartTimeframe - 1; i >= 0; i--) {
      const d = new Date(anchor.getFullYear(), anchor.getMonth() - i, 1);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const key = `${yyyy}-${mm}`;
      const shortMonth = d.toLocaleString("en-IN", { month: "short" });
      const fullMonth = d.toLocaleString("en-IN", { month: "long", year: "numeric" });
      months.push({
        key,
        shortMonth,
        fullMonth,
        year: yyyy,
        revenue: 0,
        eventsCount: 0,
        expenses: 0,
        expenseCount: 0,
      });
    }

    events.forEach((e) => {
      if (!e.date) return;
      const key = e.date.slice(0, 7);
      const m = months.find((item) => item.key === key);
      if (m) {
        m.revenue += Number(e.quote ?? e.total_estimate ?? 0);
        m.eventsCount += 1;
      }
    });

    expensesList.forEach((exp) => {
      if (!exp.expense_date) return;
      const key = exp.expense_date.slice(0, 7);
      const m = months.find((item) => item.key === key);
      if (m) {
        m.expenses += Number(exp.amount || 0);
        m.expenseCount += 1;
      }
    });

    const rawMax = Math.max(
      ...months.map((m) => Math.max(m.revenue, chartSeries !== "revenue" ? m.expenses : 0)),
      10000
    );

    let topVal = 100000;
    if (rawMax > 10000000) {
      topVal = Math.ceil(rawMax / 5000000) * 5000000;
    } else if (rawMax > 1000000) {
      topVal = Math.ceil(rawMax / 1000000) * 1000000;
    } else if (rawMax > 100000) {
      topVal = Math.ceil(rawMax / 200000) * 200000;
    } else {
      topVal = Math.ceil(rawMax / 25000) * 25000;
    }

    const timeframeTotalRev = months.reduce((acc, m) => acc + m.revenue, 0);
    const timeframeTotalExp = months.reduce((acc, m) => acc + m.expenses, 0);

    return {
      months,
      maxVal: topVal,
      timeframeTotalRev,
      timeframeTotalExp,
    };
  }, [events, expensesList, chartTimeframe, chartSeries]);

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

          <section className="summary-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))" }}>

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

            {/* KITCHEN STAFF WAGES */}

            <div
              role="button"
              tabIndex={0}
              onClick={() => {
                setPendingTab("kitchen");
                const el = document.getElementById("pending-balances-section");
                if (el) el.scrollIntoView({ behavior: "smooth" });
              }}
              className="summary-card dashboard-link-card"
              style={{ cursor: "pointer" }}
            >

              <div className="summary-top">

                <div className="summary-icon orange" style={{ background: "#ffedd5", color: "#c2410c", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "10px", width: "36px", height: "36px", fontSize: "18px" }}>
                  🍳
                </div>

                <span className={`trend ${totalKitchenPending > 0 ? "warning" : "positive"}`}>
                  {kitchenPendingStaffList.length > 0 ? `${kitchenPendingStaffList.length} Unpaid` : "Settled"}
                </span>

              </div>

              <span className="summary-label">
                Kitchen Wages
              </span>

              <strong className="summary-value" style={{ color: "#1e0836" }}>
                ₹{formatMoney(kitchenTotalWages)}
              </strong>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "4px" }}>
                <span className="summary-note">
                  {totalKitchenPending > 0
                    ? `₹${formatMoney(totalKitchenPending)} pending`
                    : `${kitchenSummary?.today_duties_count || 0} shifts today`}
                </span>
                <Link
                  href="/kitchen"
                  onClick={(e) => e.stopPropagation()}
                  style={{ fontSize: "11px", color: "#c2410c", fontWeight: 700, textDecoration: "none" }}
                >
                  Kitchen →
                </Link>
              </div>

            </div>

            {/* TOTAL EXPENSES */}

            <div
              role="button"
              tabIndex={0}
              onClick={() => {
                setPendingTab("supplier");
                const el = document.getElementById("pending-balances-section");
                if (el) el.scrollIntoView({ behavior: "smooth" });
              }}
              className="summary-card dashboard-link-card"
              style={{ cursor: "pointer" }}
            >

              <div className="summary-top">

                <div className="summary-icon red" style={{ background: "#fee2e2", color: "#b91c1c", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "10px", width: "36px", height: "36px", fontSize: "18px" }}>
                  📉
                </div>

                <span className={`trend ${totalSupplierCreditPending > 0 ? "warning" : "positive"}`}>
                  {vendorPendingList.length > 0 ? `${vendorPendingList.length} Khata Dues` : "Cleared"}
                </span>

              </div>

              <span className="summary-label">
                Total Expenses
              </span>

              <strong className="summary-value" style={{ color: "#b91c1c" }}>
                ₹{formatMoney(totalExpenses)}
              </strong>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "4px" }}>
                <span className="summary-note">
                  {totalSupplierCreditPending > 0
                    ? `₹${formatMoney(totalSupplierCreditPending)} Khata due`
                    : `${expensesList.length} expenses recorded`}
                </span>
                <Link
                  href="/expenses"
                  onClick={(e) => e.stopPropagation()}
                  style={{ fontSize: "11px", color: "#b91c1c", fontWeight: 700, textDecoration: "none" }}
                >
                  Expenses →
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

                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <select
                    value={chartTimeframe}
                    onChange={(e) => setChartTimeframe(Number(e.target.value) as 6 | 12)}
                    style={{
                      padding: "6px 12px",
                      borderRadius: "8px",
                      border: "1px solid #ddd6fe",
                      background: "#fdfcff",
                      fontSize: "12px",
                      fontWeight: 700,
                      color: "#6d28d9",
                      cursor: "pointer",
                      outline: "none",
                    }}
                  >
                    <option value={6}>Last 6 months</option>
                    <option value={12}>Last 12 months</option>
                  </select>
                </div>

              </div>

              <div className="revenue-summary">

                <strong>
                  ₹{formatMoney(totalRevenue)}
                </strong>

                <span>
                  Based on event quotes
                </span>

              </div>

              {/* OPERATING P&L BREAKDOWN STRIP */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
                  gap: "10px",
                  padding: "12px 14px",
                  background: "#fbf9fd",
                  border: "1px solid #f0ebf8",
                  borderRadius: "10px",
                  margin: "12px 0 16px 0",
                }}
              >
                <div>
                  <div style={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.5px", color: "#8a8490", fontWeight: 700 }}>
                    Expenses
                  </div>
                  <div style={{ fontSize: "13px", fontWeight: 700, color: "#dc2626", marginTop: "2px" }}>
                    −₹{formatMoney(totalExpenses)}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.5px", color: "#8a8490", fontWeight: 700 }}>
                    Staff Wages
                  </div>
                  <div style={{ fontSize: "13px", fontWeight: 700, color: "#d97706", marginTop: "2px" }}>
                    −₹{formatMoney(totalStaffWages)}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.5px", color: "#8a8490", fontWeight: 700 }}>
                    Kitchen Wages
                  </div>
                  <div style={{ fontSize: "13px", fontWeight: 700, color: "#ea580c", marginTop: "2px" }}>
                    −₹{formatMoney(kitchenTotalWages)}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.5px", color: "#8a8490", fontWeight: 700 }}>
                    Est. Net Margin
                  </div>
                  <div style={{ fontSize: "13px", fontWeight: 800, color: netProfit >= 0 ? "#16a34a" : "#dc2626", marginTop: "2px" }}>
                    ₹{formatMoney(netProfit)} <span style={{ fontSize: "11px", fontWeight: 600 }}>({profitMargin}%)</span>
                  </div>
                </div>
              </div>

              {/* REVENUE & EXPENSES CHART */}
              <div className="chart-container">
                {/* CHART SERIES CONTROLS & TIMEFRAME STATS */}
                <div className="chart-controls-bar">
                  <div className="chart-series-pills">
                    <button
                      type="button"
                      onClick={() => setChartSeries("both")}
                      className={`chart-pill ${chartSeries === "both" ? "active-all" : ""}`}
                    >
                      All (Revenue & Expenses)
                    </button>
                    <button
                      type="button"
                      onClick={() => setChartSeries("revenue")}
                      className={`chart-pill ${chartSeries === "revenue" ? "active-revenue" : ""}`}
                    >
                      <span style={{ display: "inline-block", width: "8px", height: "8px", borderRadius: "50%", background: "#7c3aed" }}></span>
                      Revenue
                    </button>
                    <button
                      type="button"
                      onClick={() => setChartSeries("expenses")}
                      className={`chart-pill ${chartSeries === "expenses" ? "active-expenses" : ""}`}
                    >
                      <span style={{ display: "inline-block", width: "8px", height: "8px", borderRadius: "50%", background: "#ef4444" }}></span>
                      Expenses
                    </button>
                  </div>

                  <div style={{ fontSize: "11px", color: "#71717a", fontWeight: 600 }}>
                    Period Revenue: <strong style={{ color: "#7c3aed" }}>₹{formatMoney(monthlyChartData.timeframeTotalRev)}</strong>
                  </div>
                </div>

                {(() => {
                  const { months, maxVal } = monthlyChartData;
                  const svgWidth = 650;
                  const svgHeight = 210;
                  const paddingLeft = 58;
                  const paddingRight = 24;
                  const paddingTop = 22;
                  const paddingBottom = 32;
                  const chartW = svgWidth - paddingLeft - paddingRight;
                  const chartH = svgHeight - paddingTop - paddingBottom;
                  const baselineY = paddingTop + chartH;

                  // Compute coordinates for each month
                  const count = months.length;
                  const revPts = months.map((m, i) => {
                    const x = paddingLeft + (count <= 1 ? chartW / 2 : (i / (count - 1)) * chartW);
                    const norm = Math.min(1, Math.max(0, m.revenue / maxVal));
                    const y = baselineY - norm * chartH;
                    return { x, y, month: m, index: i };
                  });

                  const expPts = months.map((m, i) => {
                    const x = paddingLeft + (count <= 1 ? chartW / 2 : (i / (count - 1)) * chartW);
                    const norm = Math.min(1, Math.max(0, m.expenses / maxVal));
                    const y = baselineY - norm * chartH;
                    return { x, y, month: m, index: i };
                  });

                  // Build smooth S-curves
                  const buildSmoothPath = (pts: { x: number; y: number }[]) => {
                    if (pts.length === 0) return "";
                    let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
                    for (let i = 0; i < pts.length - 1; i++) {
                      const p0 = pts[i];
                      const p1 = pts[i + 1];
                      const cp1x = p0.x + (p1.x - p0.x) / 2;
                      const cp1y = p0.y;
                      const cp2x = p0.x + (p1.x - p0.x) / 2;
                      const cp2y = p1.y;
                      d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p1.x.toFixed(1)} ${p1.y.toFixed(1)}`;
                    }
                    return d;
                  };

                  const revLinePath = buildSmoothPath(revPts);
                  const revAreaPath = revPts.length > 0
                    ? `${revLinePath} L ${revPts[revPts.length - 1].x.toFixed(1)} ${baselineY} L ${revPts[0].x.toFixed(1)} ${baselineY} Z`
                    : "";

                  const expLinePath = buildSmoothPath(expPts);
                  const expAreaPath = expPts.length > 0
                    ? `${expLinePath} L ${expPts[expPts.length - 1].x.toFixed(1)} ${baselineY} L ${expPts[0].x.toFixed(1)} ${baselineY} Z`
                    : "";

                  // Y ticks (4 levels: 0%, 33.3%, 66.7%, 100%)
                  const yTicks = [
                    { val: maxVal, y: paddingTop },
                    { val: Math.round((maxVal * 2) / 3), y: paddingTop + chartH / 3 },
                    { val: Math.round(maxVal / 3), y: paddingTop + (chartH * 2) / 3 },
                    { val: 0, y: baselineY },
                  ];

                  const hoveredData = hoveredPointIndex !== null && revPts[hoveredPointIndex]
                    ? revPts[hoveredPointIndex]
                    : null;

                  return (
                    <svg
                      viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                      className="chart-svg"
                      style={{ overflow: "visible" }}
                    >
                      <defs>
                        <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#7c3aed" stopOpacity="0.28" />
                          <stop offset="80%" stopColor="#7c3aed" stopOpacity="0.04" />
                          <stop offset="100%" stopColor="#7c3aed" stopOpacity="0" />
                        </linearGradient>

                        <linearGradient id="expensesGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#ef4444" stopOpacity="0.22" />
                          <stop offset="80%" stopColor="#ef4444" stopOpacity="0.03" />
                          <stop offset="100%" stopColor="#ef4444" stopOpacity="0" />
                        </linearGradient>

                        <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
                          <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#000000" floodOpacity="0.12" />
                        </filter>
                      </defs>

                      {/* Horizontal Gridlines & Y Axis Ticks */}
                      {yTicks.map((tick, i) => (
                        <g key={i}>
                          <line
                            x1={paddingLeft}
                            y1={tick.y}
                            x2={svgWidth - paddingRight}
                            y2={tick.y}
                            stroke="#e9e5f0"
                            strokeDasharray={i === yTicks.length - 1 ? undefined : "3 3"}
                            strokeWidth={i === yTicks.length - 1 ? "1.5" : "1"}
                          />
                          <text
                            x={paddingLeft - 8}
                            y={tick.y + 4}
                            textAnchor="end"
                            fontSize="10"
                            fontWeight="600"
                            fill="#8a8490"
                          >
                            {formatCompactIndian(tick.val)}
                          </text>
                        </g>
                      ))}

                      {/* Revenue Area & Line */}
                      {(chartSeries === "both" || chartSeries === "revenue") && (
                        <>
                          <path d={revAreaPath} fill="url(#revenueGrad)" />
                          <path
                            d={revLinePath}
                            fill="none"
                            stroke="#7c3aed"
                            strokeWidth="3"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </>
                      )}

                      {/* Expenses Area & Line */}
                      {(chartSeries === "both" || chartSeries === "expenses") && (
                        <>
                          <path d={expAreaPath} fill="url(#expensesGrad)" />
                          <path
                            d={expLinePath}
                            fill="none"
                            stroke="#ef4444"
                            strokeWidth="2.5"
                            strokeDasharray={chartSeries === "both" ? "4 4" : undefined}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </>
                      )}

                      {/* X Axis Month Labels */}
                      {revPts.map((p, i) => (
                        <text
                          key={i}
                          x={p.x}
                          y={baselineY + 18}
                          textAnchor="middle"
                          fontSize="11"
                          fontWeight={hoveredPointIndex === i ? "800" : "600"}
                          fill={hoveredPointIndex === i ? "#7c3aed" : "#71717a"}
                          style={{ transition: "all 0.15s ease" }}
                        >
                          {p.month.shortMonth}
                        </text>
                      ))}

                      {/* Hover Guideline */}
                      {hoveredData && (
                        <line
                          x1={hoveredData.x}
                          y1={paddingTop}
                          x2={hoveredData.x}
                          y2={baselineY}
                          stroke="#7c3aed"
                          strokeWidth="1.5"
                          strokeDasharray="3 3"
                          opacity="0.7"
                        />
                      )}

                      {/* Revenue Data Points */}
                      {(chartSeries === "both" || chartSeries === "revenue") &&
                        revPts.map((p, i) => {
                          const isHovered = hoveredPointIndex === i;
                          const hasData = p.month.revenue > 0;
                          return (
                            <g key={`rev-pt-${i}`}>
                              {isHovered && (
                                <circle
                                  cx={p.x}
                                  cy={p.y}
                                  r="9"
                                  fill="#7c3aed"
                                  opacity="0.2"
                                />
                              )}
                              <circle
                                cx={p.x}
                                cy={p.y}
                                r={isHovered ? "6" : hasData ? "4.5" : "3"}
                                fill="#ffffff"
                                stroke="#7c3aed"
                                strokeWidth={isHovered ? "3" : hasData ? "2.5" : "1.5"}
                                style={{ transition: "all 0.15s ease" }}
                              />
                            </g>
                          );
                        })}

                      {/* Expenses Data Points */}
                      {(chartSeries === "both" || chartSeries === "expenses") &&
                        expPts.map((p, i) => {
                          const isHovered = hoveredPointIndex === i;
                          const hasData = p.month.expenses > 0;
                          return (
                            <g key={`exp-pt-${i}`}>
                              {isHovered && (
                                <circle
                                  cx={p.x}
                                  cy={p.y}
                                  r="8"
                                  fill="#ef4444"
                                  opacity="0.2"
                                />
                              )}
                              <circle
                                cx={p.x}
                                cy={p.y}
                                r={isHovered ? "5.5" : hasData ? "4" : "2.5"}
                                fill="#ffffff"
                                stroke="#ef4444"
                                strokeWidth={isHovered ? "2.5" : hasData ? "2" : "1.2"}
                                style={{ transition: "all 0.15s ease" }}
                              />
                            </g>
                          );
                        })}

                      {/* Interactive Hover Columns */}
                      {revPts.map((p, i) => {
                        const step = count > 1 ? chartW / (count - 1) : chartW;
                        const colX = p.x - step / 2;
                        return (
                          <rect
                            key={`hit-${i}`}
                            x={Math.max(0, colX)}
                            y={paddingTop}
                            width={step}
                            height={chartH + 25}
                            fill="transparent"
                            style={{ cursor: "pointer" }}
                            onMouseEnter={() => setHoveredPointIndex(i)}
                            onMouseLeave={() => setHoveredPointIndex(null)}
                          />
                        );
                      })}

                      {/* Floating Interactive Tooltip */}
                      {hoveredData && (
                        (() => {
                          const m = hoveredData.month;
                          const boxW = 160;
                          const boxH = 68;
                          let tipX = hoveredData.x - boxW / 2;
                          if (tipX < 10) tipX = 10;
                          if (tipX + boxW > svgWidth - 10) tipX = svgWidth - boxW - 10;
                          let tipY = Math.min(hoveredData.y, expPts[hoveredData.index]?.y || hoveredData.y) - boxH - 12;
                          if (tipY < 4) tipY = paddingTop + 10;

                          return (
                            <g filter="url(#shadow)" style={{ pointerEvents: "none" }}>
                              <rect
                                x={tipX}
                                y={tipY}
                                width={boxW}
                                height={boxH}
                                rx="8"
                                fill="#1e0836"
                                opacity="0.96"
                              />
                              <text
                                x={tipX + 10}
                                y={tipY + 16}
                                fill="#ffffff"
                                fontSize="11"
                                fontWeight="800"
                              >
                                {m.fullMonth}
                              </text>

                              <text
                                x={tipX + 10}
                                y={tipY + 34}
                                fill="#c4b5fd"
                                fontSize="10"
                                fontWeight="700"
                              >
                                ● Revenue: ₹{formatMoney(m.revenue)}
                              </text>
                              <text
                                x={tipX + boxW - 10}
                                y={tipY + 34}
                                fill="#a78bfa"
                                fontSize="9"
                                textAnchor="end"
                              >
                                ({m.eventsCount} events)
                              </text>

                              <text
                                x={tipX + 10}
                                y={tipY + 52}
                                fill="#fca5a5"
                                fontSize="10"
                                fontWeight="700"
                              >
                                ● Expenses: ₹{formatMoney(m.expenses)}
                              </text>
                              <text
                                x={tipX + boxW - 10}
                                y={tipY + 52}
                                fill="#f87171"
                                fontSize="9"
                                textAnchor="end"
                              >
                                ({m.expenseCount} items)
                              </text>
                            </g>
                          );
                        })()
                      )}
                    </svg>
                  );
                })()}
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

                <Link
                  href="/kitchen"
                  className="quick-item"
                >

                  <span className="quick-icon orange" style={{ background: "#ffedd5", color: "#c2410c", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "8px", width: "32px", height: "32px", fontSize: "15px" }}>
                    🍳
                  </span>

                  <span>

                    <strong>
                      Kitchen Duty & Wages
                    </strong>

                    <small>
                      Roster, shifts & payouts
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
                  Active ledger of customer payments due, staff wages, kitchen dues & supplier credit
                </p>

              </div>

              <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>

                <button
                  type="button"
                  onClick={() => setPendingTab("customer")}
                  style={{
                    padding: "8px 16px",
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
                  Customer Dues ({customerPendingEvents.length})
                </button>

                <button
                  type="button"
                  onClick={() => setPendingTab("staff")}
                  style={{
                    padding: "8px 16px",
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
                  Event Staff ({staffPendingList.length})
                </button>

                <button
                  type="button"
                  onClick={() => setPendingTab("kitchen")}
                  style={{
                    padding: "8px 16px",
                    borderRadius: "8px",
                    border: "none",
                    cursor: "pointer",
                    fontSize: "13px",
                    fontWeight: 700,
                    background: pendingTab === "kitchen" ? "linear-gradient(135deg, #ea580c 0%, #c2410c 100%)" : "#fff7ed",
                    color: pendingTab === "kitchen" ? "#ffffff" : "#c2410c",
                    boxShadow: pendingTab === "kitchen" ? "0 4px 14px rgba(234, 88, 12, 0.3)" : "none",
                    transition: "all 0.15s ease",
                  }}
                >
                  Kitchen Wages ({kitchenPendingStaffList.length})
                </button>

                <button
                  type="button"
                  onClick={() => setPendingTab("supplier")}
                  style={{
                    padding: "8px 16px",
                    borderRadius: "8px",
                    border: "none",
                    cursor: "pointer",
                    fontSize: "13px",
                    fontWeight: 700,
                    background: pendingTab === "supplier" ? "linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)" : "#fef2f2",
                    color: pendingTab === "supplier" ? "#ffffff" : "#b91c1c",
                    boxShadow: pendingTab === "supplier" ? "0 4px 14px rgba(220, 38, 38, 0.3)" : "none",
                    transition: "all 0.15s ease",
                  }}
                >
                  Supplier Khata ({vendorPendingList.length})
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

                                <button
                                  type="button"
                                  onClick={() => handleSendWhatsAppReminder(e)}
                                  style={{
                                    padding: "6px 10px",
                                    borderRadius: "6px",
                                    background: "#f0fdf4",
                                    color: "#15803d",
                                    border: "1px solid #bbf7d0",
                                    fontWeight: 700,
                                    fontSize: "11px",
                                    cursor: "pointer",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "3px",
                                  }}
                                  title="Send polite WhatsApp payment reminder to customer"
                                >
                                  <span>💬</span> WhatsApp
                                </button>

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

            {/* TAB 3: KITCHEN STAFF WAGES PENDING */}

            {pendingTab === "kitchen" && (
              <div style={{ marginTop: "16px" }}>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    background: totalKitchenPending > 0 ? "#fff7ed" : "#f0fdf4",
                    border: totalKitchenPending > 0 ? "1px solid #fed7aa" : "1px solid #bbf7d0",
                    borderRadius: "10px",
                    padding: "12px 18px",
                    marginBottom: "16px",
                    flexWrap: "wrap",
                    gap: "12px",
                  }}
                >

                  <div>

                    <span style={{ fontSize: "11px", color: totalKitchenPending > 0 ? "#9a3412" : "#166534", fontWeight: 700, textTransform: "uppercase" }}>
                      Total Kitchen Wages Pending Disbursal
                    </span>

                    <div style={{ fontSize: "20px", fontWeight: 800, color: totalKitchenPending > 0 ? "#c2410c" : "#15803d", marginTop: "2px" }}>
                      ₹{formatMoney(totalKitchenPending)}
                    </div>

                    <div style={{ fontSize: "11px", color: "#78716c", marginTop: "2px" }}>
                      Total Earned: ₹{formatMoney(kitchenTotalWages)} • Total Disbursed: ₹{formatMoney(kitchenSummary?.total_paid || 0)}
                    </div>

                  </div>

                  <Link
                    href="/kitchen"
                    style={{
                      background: "linear-gradient(135deg, #ea580c 0%, #c2410c 100%)",
                      color: "#ffffff",
                      padding: "8px 16px",
                      borderRadius: "8px",
                      fontSize: "12px",
                      fontWeight: 700,
                      textDecoration: "none",
                      boxShadow: "0 4px 12px rgba(234, 88, 12, 0.3)",
                    }}
                  >
                    Kitchen Roster & Duties →
                  </Link>

                </div>

                {kitchenPendingStaffList.length === 0 ? (
                  <div style={{ padding: "40px 20px", textAlign: "center", color: "#15803d" }}>

                    <div style={{ fontSize: "36px", marginBottom: "8px" }}>✓</div>

                    <h3 style={{ margin: "0 0 4px 0", color: "#15803d" }}>All Kitchen Staff Wages Settled</h3>

                    <p style={{ margin: 0, fontSize: "13px", color: "#166534" }}>
                      No kitchen staff members currently have unpaid wage balances.
                    </p>

                  </div>
                ) : (
                  <div className="events-table-wrapper">

                    <table className="events-table">

                      <thead>

                        <tr>

                          <th>KITCHEN STAFF</th>
                          <th>ROLE</th>
                          <th>MOBILE</th>
                          <th>RATE & TYPE</th>
                          <th style={{ textAlign: "center" }}>SHIFTS / DUTIES</th>
                          <th style={{ textAlign: "right" }}>TOTAL EARNED</th>
                          <th style={{ textAlign: "right" }}>PAID</th>
                          <th style={{ textAlign: "right" }}>PENDING WAGE</th>
                          <th style={{ textAlign: "center" }}>ACTION</th>

                        </tr>

                      </thead>

                      <tbody>

                        {kitchenPendingStaffList.map((s) => (
                          <tr key={s.id}>

                            <td>
                              <strong>{s.name}</strong>
                            </td>

                            <td>
                              <span
                                style={{
                                  display: "inline-block",
                                  padding: "3px 8px",
                                  borderRadius: "10px",
                                  fontSize: "11px",
                                  fontWeight: 700,
                                  background: "#ffedd5",
                                  color: "#9a3412",
                                }}
                              >
                                {s.kitchen_role || "Kitchen Crew"}
                              </span>
                            </td>

                            <td>{s.mobile || "—"}</td>

                            <td>
                              <span style={{ fontSize: "12px", fontWeight: 600 }}>
                                ₹{formatMoney(s.wage_rate || 0)}
                                <small style={{ color: "#78716c", marginLeft: "4px" }}>
                                  ({s.wage_type === "monthly" ? "Monthly" : "Per Shift"})
                                </small>
                              </span>
                            </td>

                            <td style={{ textAlign: "center" }}>
                              <span
                                style={{
                                  display: "inline-block",
                                  padding: "3px 8px",
                                  borderRadius: "10px",
                                  fontSize: "11px",
                                  fontWeight: 700,
                                  background: "#fef3c7",
                                  color: "#92400e",
                                }}
                              >
                                {s.duties_count || 0} shifts
                              </span>
                            </td>

                            <td style={{ textAlign: "right", fontWeight: 600 }}>
                              ₹{formatMoney(s.total_wages || 0)}
                            </td>

                            <td style={{ textAlign: "right", fontWeight: 600, color: "#166534" }}>
                              ₹{formatMoney(s.total_paid || 0)}
                            </td>

                            <td style={{ textAlign: "right", fontWeight: 800, color: "#c2410c" }}>
                              ₹{formatMoney(s.balance || 0)}
                            </td>

                            <td style={{ textAlign: "center" }}>
                              <Link
                                href="/kitchen"
                                style={{
                                  padding: "6px 12px",
                                  borderRadius: "6px",
                                  background: "linear-gradient(135deg, #ea580c 0%, #c2410c 100%)",
                                  color: "#ffffff",
                                  fontWeight: 700,
                                  fontSize: "11px",
                                  textDecoration: "none",
                                  boxShadow: "0 2px 8px rgba(234, 88, 12, 0.25)",
                                }}
                              >
                                Pay / Roster
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

            {/* TAB 4: SUPPLIER KHATA CREDIT PENDING */}

            {pendingTab === "supplier" && (
              <div style={{ marginTop: "16px" }}>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    background: totalSupplierCreditPending > 0 ? "#fef2f2" : "#f0fdf4",
                    border: totalSupplierCreditPending > 0 ? "1px solid #fecaca" : "1px solid #bbf7d0",
                    borderRadius: "10px",
                    padding: "12px 18px",
                    marginBottom: "16px",
                    flexWrap: "wrap",
                    gap: "12px",
                  }}
                >

                  <div>

                    <span style={{ fontSize: "11px", color: totalSupplierCreditPending > 0 ? "#991b1b" : "#166534", fontWeight: 700, textTransform: "uppercase" }}>
                      Total Supplier Khata Credit Balance Due
                    </span>

                    <div style={{ fontSize: "20px", fontWeight: 800, color: totalSupplierCreditPending > 0 ? "#b91c1c" : "#15803d", marginTop: "2px" }}>
                      ₹{formatMoney(totalSupplierCreditPending)}
                    </div>

                    <div style={{ fontSize: "11px", color: "#78716c", marginTop: "2px" }}>
                      Credit Purchases: ₹{formatMoney(supplierCreditIncurred)} • Cleared / Settled: ₹{formatMoney(totalSettlementsCleared)}
                    </div>

                  </div>

                  <Link
                    href="/expenses"
                    style={{
                      background: "linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)",
                      color: "#ffffff",
                      padding: "8px 16px",
                      borderRadius: "8px",
                      fontSize: "12px",
                      fontWeight: 700,
                      textDecoration: "none",
                      boxShadow: "0 4px 12px rgba(220, 38, 38, 0.3)",
                    }}
                  >
                    Expenses & Khata Ledger →
                  </Link>

                </div>

                {vendorPendingList.length === 0 ? (
                  <div style={{ padding: "40px 20px", textAlign: "center", color: "#15803d" }}>

                    <div style={{ fontSize: "36px", marginBottom: "8px" }}>✓</div>

                    <h3 style={{ margin: "0 0 4px 0", color: "#15803d" }}>Zero Outstanding Supplier Khata</h3>

                    <p style={{ margin: 0, fontSize: "13px", color: "#166534" }}>
                      All vendor invoices and credit bills have been fully settled.
                    </p>

                  </div>
                ) : (
                  <div className="events-table-wrapper">

                    <table className="events-table">

                      <thead>

                        <tr>

                          <th>SUPPLIER / VENDOR</th>
                          <th style={{ textAlign: "center" }}>CREDIT BILLS</th>
                          <th style={{ textAlign: "right" }}>TOTAL CREDIT</th>
                          <th style={{ textAlign: "right" }}>SETTLED / PAID</th>
                          <th style={{ textAlign: "right" }}>OUTSTANDING KHATA</th>
                          <th style={{ textAlign: "center" }}>ACTION</th>

                        </tr>

                      </thead>

                      <tbody>

                        {vendorPendingList.map((v) => (
                          <tr key={v.vendor}>

                            <td>
                              <strong>{v.vendor}</strong>
                            </td>

                            <td style={{ textAlign: "center" }}>
                              <span
                                style={{
                                  display: "inline-block",
                                  padding: "3px 8px",
                                  borderRadius: "10px",
                                  fontSize: "11px",
                                  fontWeight: 700,
                                  background: "#fee2e2",
                                  color: "#991b1b",
                                }}
                              >
                                {v.billsCount} bills
                              </span>
                            </td>

                            <td style={{ textAlign: "right", fontWeight: 600 }}>
                              ₹{formatMoney(v.totalCredit)}
                            </td>

                            <td style={{ textAlign: "right", fontWeight: 600, color: "#166534" }}>
                              ₹{formatMoney(v.settled)}
                            </td>

                            <td style={{ textAlign: "right", fontWeight: 800, color: "#b91c1c" }}>
                              ₹{formatMoney(v.balance)}
                            </td>

                            <td style={{ textAlign: "center" }}>
                              <Link
                                href="/expenses"
                                style={{
                                  padding: "6px 12px",
                                  borderRadius: "6px",
                                  background: "linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)",
                                  color: "#ffffff",
                                  fontWeight: 700,
                                  fontSize: "11px",
                                  textDecoration: "none",
                                  boxShadow: "0 2px 8px rgba(220, 38, 38, 0.25)",
                                }}
                              >
                                Settle Khata
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

          {/* ==================================================
              RECENT EXPENSES & SUPPLIER KHATA LEDGER
          ================================================== */}

          <section className="dashboard-panel" style={{ marginTop: "24px", marginBottom: "24px" }}>

            <div className="panel-heading" style={{ flexWrap: "wrap", gap: "12px", borderBottom: "1px solid #e9e5f0", paddingBottom: "16px" }}>

              <div>

                <h2>
                  Recent Expenses & Vendor Transactions
                </h2>

                <p>
                  Latest operational expenses, raw materials & supplier bills
                </p>

              </div>

              <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>

                <Link
                  href="/expenses"
                  style={{
                    background: "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)",
                    color: "#ffffff",
                    padding: "8px 16px",
                    borderRadius: "8px",
                    fontSize: "12px",
                    fontWeight: 700,
                    textDecoration: "none",
                    boxShadow: "0 4px 12px rgba(124, 58, 237, 0.25)",
                  }}
                >
                  ＋ Add / View All Expenses
                </Link>

              </div>

            </div>

            {expensesList.length === 0 ? (
              <div style={{ padding: "35px 20px", textAlign: "center", color: "#64748b" }}>
                <p style={{ margin: 0, fontSize: "14px" }}>No expenses recorded yet.</p>
              </div>
            ) : (
              <>
                <div className="events-table-wrapper">

                  <table className="events-table">

                    <thead>

                      <tr>

                        <th>DATE</th>
                        <th>EXPENSE TITLE</th>
                        <th>CATEGORY</th>
                        <th>VENDOR / SUPPLIER</th>
                        <th>PAYMENT METHOD</th>
                        <th style={{ textAlign: "right" }}>AMOUNT</th>
                        <th style={{ textAlign: "center" }}>ACTION</th>

                      </tr>

                    </thead>

                    <tbody>

                      {expensesList.slice(0, 6).map((exp) => (
                        <tr key={exp.id}>

                          <td style={{ whiteSpace: "nowrap" }}>
                            {formatDate(exp.expense_date)}
                          </td>

                          <td>
                            <strong>{exp.title}</strong>
                            {exp.bill_number && (
                              <small style={{ display: "block", color: "#8a8490", fontSize: "11px" }}>
                                Bill #{exp.bill_number}
                              </small>
                            )}
                          </td>

                          <td>
                            <span
                              style={{
                                display: "inline-block",
                                padding: "3px 8px",
                                borderRadius: "10px",
                                fontSize: "11px",
                                fontWeight: 700,
                                background: "#f3e8ff",
                                color: "#7e22ce",
                              }}
                            >
                              {exp.category}
                            </span>
                          </td>

                          <td>{exp.vendor || "—"}</td>

                          <td>
                            <span
                              style={{
                                display: "inline-block",
                                padding: "3px 8px",
                                borderRadius: "10px",
                                fontSize: "11px",
                                fontWeight: 700,
                                background: exp.payment_method?.toLowerCase().includes("khata") || exp.payment_method?.toLowerCase().includes("credit")
                                  ? "#fee2e2"
                                  : "#dcfce7",
                                color: exp.payment_method?.toLowerCase().includes("khata") || exp.payment_method?.toLowerCase().includes("credit")
                                  ? "#991b1b"
                                  : "#15803d",
                              }}
                            >
                              {exp.payment_method || "Paid"}
                            </span>
                          </td>

                          <td style={{ textAlign: "right", fontWeight: 700, color: "#1e0836" }}>
                            ₹{formatMoney(exp.amount)}
                          </td>

                          <td style={{ textAlign: "center" }}>
                            <Link
                              href="/expenses"
                              style={{
                                padding: "5px 10px",
                                borderRadius: "6px",
                                background: "#f5f3ff",
                                color: "#6d28d9",
                                fontWeight: 700,
                                fontSize: "11px",
                                textDecoration: "none",
                                border: "1px solid #ddd6fe",
                              }}
                            >
                              View
                            </Link>
                          </td>

                        </tr>
                      ))}

                    </tbody>

                  </table>

                </div>

                {/* EXPENSES FOOTER SUMMARY STRIP */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: "12px",
                    padding: "12px 18px",
                    background: "#faf8fd",
                    borderTop: "1px solid #e9e5f0",
                    marginTop: "8px",
                    borderRadius: "0 0 10px 10px",
                  }}
                >
                  <div style={{ display: "flex", gap: "20px", flexWrap: "wrap" }}>
                    <span style={{ fontSize: "12px", color: "#64748b" }}>
                      Total Recorded: <strong style={{ color: "#1e0836" }}>₹{formatMoney(totalExpenses)}</strong>
                    </span>
                    <span style={{ fontSize: "12px", color: "#64748b" }}>
                      Direct Paid: <strong style={{ color: "#15803d" }}>₹{formatMoney(directPaidExpenses)}</strong>
                    </span>
                    <span style={{ fontSize: "12px", color: "#64748b" }}>
                      Khata Credit Pending: <strong style={{ color: "#b91c1c" }}>₹{formatMoney(totalSupplierCreditPending)}</strong>
                    </span>
                  </div>

                  <Link
                    href="/expenses"
                    style={{ fontSize: "12px", color: "#7c3aed", fontWeight: 700, textDecoration: "none" }}
                  >
                    All {expensesList.length} expenses ledger →
                  </Link>
                </div>
              </>
            )}

          </section>

        </div>

      </section>

    </main>
  );
}