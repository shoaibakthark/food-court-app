"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "../lib/auth";
import { SidebarUserCard, OwnerBanner, NavLink, TopbarUserBadge, AppSidebar, MobileMenuButton } from "../components/AuthBar";
import { exportEntireDatabaseToExcel } from "../lib/excelBackup";
import { GoogleDriveBackupModal } from "../components/GoogleDriveBackupModal";

const API_URL = typeof window !== "undefined" ? "/api/py" : "http://127.0.0.1:8000";

type EventItem = {
  id: number;
  date: string;
  guest_count: number;
  food_amt: number;
  decor_amt: number;
  total_estimate: number;
  place: string;
  customer_id: number;
  customer_name: string;
  event_type: string;
  quote: number | null;
  paid_amount: number;
  balance: number;
};

type PaymentItem = {
  id: number;
  event_id: number;
  amount: number;
  payment_method: string;
  payment_type: string;
  payment_date: string;
  note?: string | null;
  customer_name?: string | null;
};

type ExpenseItem = {
  id: number;
  title: string;
  category: string;
  amount: number;
  expense_date: string;
  event_id?: number | null;
  payment_method?: string | null;
  vendor?: string | null;
};

type StaffPaymentItem = {
  id: number;
  staff_id: number;
  event_id?: number | null;
  amount?: number;
  payment?: number;
  payment_date?: string | null;
  staff_name?: string | null;
  staff_role?: string | null;
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

export default function ReportsPage() {
  const router = useRouter();
  const { user, isOwner, isManager } = useAuth();

  const [events, setEvents] = useState<EventItem[]>([]);
  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [staffPayments, setStaffPayments] = useState<StaffPaymentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [showDriveModal, setShowDriveModal] = useState(false);

  const handleExportExcel = async () => {
    try {
      setExportingExcel(true);
      const res = await exportEntireDatabaseToExcel();
      if (!res.success) {
        alert("Failed to export Excel backup: " + res.error);
      }
    } catch (err: any) {
      alert("Error exporting Excel backup: " + err.message);
    } finally {
      setExportingExcel(false);
    }
  };

  // Filters
  const [dateRange, setDateRange] = useState<"all" | "this_month" | "last_30" | "ytd">("all");
  const [selectedEventType, setSelectedEventType] = useState("All");
  const [activeTab, setActiveTab] = useState<"pnl" | "events" | "expenses" | "receivables">("pnl");

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [eventsRes, paymentsRes, expensesRes, staffPaymentsRes] = await Promise.all([
        fetch(`${API_URL}/events`, { cache: "no-store" }),
        fetch(`${API_URL}/payments`, { cache: "no-store" }),
        fetch(`${API_URL}/expenses`, { cache: "no-store" }),
        fetch(`${API_URL}/staff-payments`, { cache: "no-store" }),
      ]);

      if (eventsRes.ok) {
        const eData = await eventsRes.json();
        setEvents(Array.isArray(eData) ? eData : []);
      }
      if (paymentsRes.ok) {
        const pData = await paymentsRes.json();
        setPayments(Array.isArray(pData) ? pData : []);
      }
      if (expensesRes.ok) {
        const expData = await expensesRes.json();
        setExpenses(Array.isArray(expData) ? expData : []);
      }
      if (staffPaymentsRes.ok) {
        const spData = await staffPaymentsRes.json();
        setStaffPayments(Array.isArray(spData) ? spData : []);
      }
    } catch (err: any) {
      console.error("Failed to load reports data:", err);
      setError("Unable to connect to the backend server. Make sure FastAPI is running.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Date Filtering Helper
  const filterByDate = useCallback((itemDateStr?: string | null) => {
    if (!itemDateStr || dateRange === "all") return true;
    const now = new Date();
    const d = new Date(`${itemDateStr.slice(0, 10)}T00:00:00`);
    if (Number.isNaN(d.getTime())) return true;

    if (dateRange === "this_month") {
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    }
    if (dateRange === "last_30") {
      const past30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      return d >= past30 && d <= now;
    }
    if (dateRange === "ytd") {
      return d.getFullYear() === now.getFullYear();
    }
    return true;
  }, [dateRange]);

  // Filtered Datasets
  const filteredEvents = useMemo(() => {
    return events.filter((ev) => {
      const matchDate = filterByDate(ev.date);
      const matchType = selectedEventType === "All" || ev.event_type === selectedEventType;
      return matchDate && matchType;
    });
  }, [events, filterByDate, selectedEventType]);

  const filteredPayments = useMemo(() => {
    return payments.filter((p) => filterByDate(p.payment_date));
  }, [payments, filterByDate]);

  const filteredExpenses = useMemo(() => {
    return expenses.filter((e) => filterByDate(e.expense_date));
  }, [expenses, filterByDate]);

  const filteredStaffPayments = useMemo(() => {
    return staffPayments.filter((sp) => filterByDate(sp.payment_date));
  }, [staffPayments, filterByDate]);

  // Financial Metrics Computation
  const metrics = useMemo(() => {
    let totalQuoted = 0;
    let totalEstimated = 0;
    let foodRevenue = 0;
    let decorRevenue = 0;
    let totalCollected = 0;
    let totalReceivables = 0;

    filteredEvents.forEach((ev) => {
      const quoteVal = ev.quote ?? ev.total_estimate ?? 0;
      totalQuoted += quoteVal;
      totalEstimated += ev.total_estimate ?? 0;
      foodRevenue += ev.food_amt ?? 0;
      decorRevenue += ev.decor_amt ?? 0;
      totalCollected += ev.paid_amount ?? 0;
      totalReceivables += ev.balance ?? Math.max(0, quoteVal - (ev.paid_amount ?? 0));
    });

    const totalExpenses = filteredExpenses.reduce((acc, e) => acc + (e.amount || 0), 0);
    const totalStaffWages = filteredStaffPayments.reduce((acc, sp) => acc + (sp.amount || sp.payment || 0), 0);
    const totalOutflow = totalExpenses + totalStaffWages;

    const netOperatingProfit = totalQuoted - totalOutflow;
    const netCashflow = totalCollected - totalOutflow;
    const profitMargin = totalQuoted > 0 ? (netOperatingProfit / totalQuoted) * 100 : 0;
    const collectionEfficiency = totalQuoted > 0 ? (totalCollected / totalQuoted) * 100 : 0;

    // Expenses Category Breakdown
    const catMap: Record<string, number> = {};
    filteredExpenses.forEach((exp) => {
      const cat = exp.category || "Miscellaneous";
      catMap[cat] = (catMap[cat] || 0) + (exp.amount || 0);
    });

    const categoryBreakdown = Object.entries(catMap)
      .map(([name, total]) => ({
        name,
        total,
        percentage: totalExpenses > 0 ? (total / totalExpenses) * 100 : 0,
      }))
      .sort((a, b) => b.total - a.total);

    return {
      totalQuoted,
      totalEstimated,
      foodRevenue,
      decorRevenue,
      totalCollected,
      totalReceivables,
      totalExpenses,
      totalStaffWages,
      totalOutflow,
      netOperatingProfit,
      netCashflow,
      profitMargin,
      collectionEfficiency,
      categoryBreakdown,
    };
  }, [filteredEvents, filteredExpenses, filteredStaffPayments]);

  // Event types for filter
  const eventTypes = useMemo(() => {
    const set = new Set<string>();
    events.forEach((e) => {
      if (e.event_type) set.add(e.event_type);
    });
    return ["All", ...Array.from(set)];
  }, [events]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <main className="dashboard">
      <AppSidebar activeRoute="/reports" />

      {/* Main Content */}
      <div className="main-content">
        {/* Topbar */}
        <header className="topbar no-print">
          <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            <MobileMenuButton />
            <h1 style={{ margin: 0, fontSize: "19px", fontWeight: 700, color: "#24103f" }}>
              Financial Reports & Analytics
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
              Audited Ledger Intelligence
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            {/* Date Range Selector */}
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as any)}
              style={{
                padding: "8px 12px",
                borderRadius: "8px",
                border: "1px solid #dcd7e5",
                background: "#fff",
                fontSize: "13px",
                color: "#24103f",
                fontWeight: 600,
              }}
            >
              <option value="all">All Time</option>
              <option value="this_month">This Month</option>
              <option value="last_30">Last 30 Days</option>
              <option value="ytd">Year to Date (YTD)</option>
            </select>

            {/* Excel Backup Button */}
            <button
              type="button"
              onClick={() => setShowDriveModal(true)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
                color: "#fff",
                border: "none",
                borderRadius: "8px",
                padding: "8px 14px",
                fontWeight: 700,
                fontSize: "12px",
                cursor: "pointer",
                boxShadow: "0 2px 6px rgba(37, 99, 235, 0.3)",
              }}
              title="Upload and sync database backup to Google Drive"
            >
              ☁️ Google Drive
            </button>

            <button
              type="button"
              onClick={handleExportExcel}
              disabled={exportingExcel}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                background: "linear-gradient(135deg, #059669 0%, #047857 100%)",
                color: "#fff",
                border: "none",
                borderRadius: "8px",
                padding: "8px 14px",
                fontWeight: 700,
                fontSize: "12px",
                cursor: exportingExcel ? "not-allowed" : "pointer",
                boxShadow: "0 2px 6px rgba(5, 150, 105, 0.3)",
              }}
              title="Download entire database as an Excel (.xlsx) spreadsheet"
            >
              📊 {exportingExcel ? "Exporting..." : "Backup to Excel"}
            </button>

            {/* Print Button */}
            <button
              type="button"
              onClick={handlePrint}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                background: "#24103f",
                color: "#fff",
                border: "none",
                borderRadius: "8px",
                padding: "8px 14px",
                fontWeight: 700,
                fontSize: "12px",
                cursor: "pointer",
              }}
            >
              🖨️ Print Statement
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

          {/* Printable Header (Visible only when printing) */}
          <div className="print-only" style={{ display: "none", marginBottom: "24px" }}>
            <h1 style={{ margin: "0 0 6px 0", color: "#24103f", fontSize: "24px" }}>
              FOOD COURT EVENT MANAGEMENT & CATERING
            </h1>
            <h3 style={{ margin: 0, color: "#7a6e8a", fontSize: "16px" }}>
              Financial Audit & Profit-Loss Statement
            </h3>
            <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#8a7b9b" }}>
              Generated on {new Date().toLocaleDateString("en-IN", { dateStyle: "long" })} • Filter: {dateRange.toUpperCase()}
            </p>
            <hr style={{ border: "0", borderTop: "1px solid #ddd", margin: "14px 0" }} />
          </div>

          {/* Executive Summary Cards */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
              gap: "18px",
              marginBottom: "28px",
            }}
          >
            {/* Total Revenue */}
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
                Total Quoted Revenue
              </div>
              <div style={{ fontSize: "26px", fontWeight: 800, color: "#24103f", marginTop: "8px" }}>
                ₹{formatMoney(metrics.totalQuoted)}
              </div>
              <div style={{ fontSize: "12px", color: "#8d819e", marginTop: "6px" }}>
                Across {filteredEvents.length} events
              </div>
            </div>

            {/* Total Collected */}
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
                Actual Collections (Inflow)
              </div>
              <div style={{ fontSize: "26px", fontWeight: 800, color: "#15803d", marginTop: "8px" }}>
                ₹{formatMoney(metrics.totalCollected)}
              </div>
              <div style={{ fontSize: "12px", color: "#166534", marginTop: "6px", fontWeight: 600 }}>
                {metrics.collectionEfficiency.toFixed(1)}% Realized
              </div>
            </div>

            {/* Total Outflows (Expenses + Wages) */}
            <div
              style={{
                background: "linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)",
                border: "1px solid #fecaca",
                borderRadius: "12px",
                padding: "20px",
                boxShadow: "0 2px 8px rgba(185, 28, 28, 0.04)",
              }}
            >
              <div style={{ fontSize: "12px", color: "#991b1b", fontWeight: 600, textTransform: "uppercase" }}>
                Total Outflows (Cost)
              </div>
              <div style={{ fontSize: "26px", fontWeight: 800, color: "#b91c1c", marginTop: "8px" }}>
                ₹{formatMoney(metrics.totalOutflow)}
              </div>
              <div style={{ fontSize: "12px", color: "#991b1b", marginTop: "6px" }}>
                Expenses: ₹{formatMoney(metrics.totalExpenses)} • Wages: ₹{formatMoney(metrics.totalStaffWages)}
              </div>
            </div>

            {/* Net Operating Profit */}
            <div
              style={{
                background:
                  metrics.netOperatingProfit >= 0
                    ? "linear-gradient(135deg, #fdf8eb 0%, #fef3c7 100%)"
                    : "#fee2e2",
                border:
                  metrics.netOperatingProfit >= 0 ? "1px solid #fde68a" : "1px solid #fca5a5",
                borderRadius: "12px",
                padding: "20px",
                boxShadow: "0 2px 8px rgba(180, 83, 9, 0.04)",
              }}
            >
              <div
                style={{
                  fontSize: "12px",
                  color: metrics.netOperatingProfit >= 0 ? "#92400e" : "#991b1b",
                  fontWeight: 600,
                  textTransform: "uppercase",
                }}
              >
                Net Operating Profit
              </div>
              <div
                style={{
                  fontSize: "26px",
                  fontWeight: 800,
                  color: metrics.netOperatingProfit >= 0 ? "#b45309" : "#b91c1c",
                  marginTop: "8px",
                }}
              >
                ₹{formatMoney(metrics.netOperatingProfit)}
              </div>
              <div
                style={{
                  fontSize: "12px",
                  color: metrics.netOperatingProfit >= 0 ? "#92400e" : "#991b1b",
                  marginTop: "6px",
                  fontWeight: 700,
                }}
              >
                {metrics.profitMargin.toFixed(1)}% Operating Margin
              </div>
            </div>
          </div>

          {/* Tab Navigation */}
          <div
            className="no-print"
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              borderBottom: "1px solid #e5e0ed",
              marginBottom: "20px",
            }}
          >
            <div style={{ display: "flex", gap: "24px" }}>
              <button
                type="button"
                onClick={() => setActiveTab("pnl")}
                style={{
                  background: "transparent",
                  border: "none",
                  borderBottom: activeTab === "pnl" ? "3px solid #7c3aed" : "3px solid transparent",
                  padding: "12px 6px",
                  fontSize: "14px",
                  fontWeight: activeTab === "pnl" ? 700 : 500,
                  color: activeTab === "pnl" ? "#7c3aed" : "#6c5e7e",
                  cursor: "pointer",
                }}
              >
                Profit & Loss (P&L) Statement
              </button>
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
                Event Profitability Ledger ({filteredEvents.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("expenses")}
                style={{
                  background: "transparent",
                  border: "none",
                  borderBottom: activeTab === "expenses" ? "3px solid #7c3aed" : "3px solid transparent",
                  padding: "12px 6px",
                  fontSize: "14px",
                  fontWeight: activeTab === "expenses" ? 700 : 500,
                  color: activeTab === "expenses" ? "#7c3aed" : "#6c5e7e",
                  cursor: "pointer",
                }}
              >
                Expense Category Breakdown ({metrics.categoryBreakdown.length})
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
                Client Receivables Aging
              </button>
            </div>

            {/* Event Type Filter */}
            {activeTab === "events" && (
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                <span style={{ fontSize: "12px", color: "#6c5e7e", fontWeight: 600 }}>Event Type:</span>
                <select
                  value={selectedEventType}
                  onChange={(e) => setSelectedEventType(e.target.value)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: "6px",
                    border: "1px solid #dcd7e5",
                    background: "#fff",
                    fontSize: "13px",
                    color: "#24103f",
                  }}
                >
                  {eventTypes.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* TAB 1: P&L STATEMENT */}
          {activeTab === "pnl" && (
            <div
              style={{
                background: "#fff",
                borderRadius: "14px",
                border: "1px solid #e9e5f0",
                padding: "28px",
                boxShadow: "0 2px 10px rgba(36, 16, 63, 0.03)",
              }}
            >
              <h3 style={{ margin: "0 0 20px 0", color: "#24103f", fontSize: "18px" }}>
                Comprehensive Financial Statement
              </h3>

              <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                {/* 1. REVENUE SECTION */}
                <div>
                  <div
                    style={{
                      background: "#f8f6fc",
                      padding: "10px 16px",
                      borderRadius: "8px",
                      fontWeight: 700,
                      color: "#24103f",
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: "14px",
                    }}
                  >
                    <span>1. OPERATING REVENUE</span>
                    <span>₹{formatMoney(metrics.totalQuoted)}</span>
                  </div>

                  <div style={{ padding: "12px 16px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #f2eff7", fontSize: "13px" }}>
                      <span style={{ color: "#5d4e70" }}>• Food Catering & Menu Revenue</span>
                      <strong style={{ color: "#24103f" }}>₹{formatMoney(metrics.foodRevenue)}</strong>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #f2eff7", fontSize: "13px" }}>
                      <span style={{ color: "#5d4e70" }}>• Decor, Floral & Setup Revenue</span>
                      <strong style={{ color: "#24103f" }}>₹{formatMoney(metrics.decorRevenue)}</strong>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", fontSize: "13px" }}>
                      <span style={{ color: "#5d4e70" }}>• Additional Packages & Equipment</span>
                      <strong style={{ color: "#24103f" }}>
                        ₹{formatMoney(Math.max(0, metrics.totalQuoted - metrics.foodRevenue - metrics.decorRevenue))}
                      </strong>
                    </div>
                  </div>
                </div>

                {/* 2. OPERATING EXPENDITURES */}
                <div>
                  <div
                    style={{
                      background: "#fef2f2",
                      padding: "10px 16px",
                      borderRadius: "8px",
                      fontWeight: 700,
                      color: "#991b1b",
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: "14px",
                    }}
                  >
                    <span>2. DIRECT EXPENSES & OPERATING OUTFLOWS</span>
                    <span>- ₹{formatMoney(metrics.totalOutflow)}</span>
                  </div>

                  <div style={{ padding: "12px 16px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #f2eff7", fontSize: "13px" }}>
                      <span style={{ color: "#5d4e70" }}>• Raw Materials, Groceries & Market Purchases</span>
                      <strong style={{ color: "#b91c1c" }}>- ₹{formatMoney(metrics.totalExpenses)}</strong>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", fontSize: "13px" }}>
                      <span style={{ color: "#5d4e70" }}>• Staff Wages & Crew Disbursements</span>
                      <strong style={{ color: "#b91c1c" }}>- ₹{formatMoney(metrics.totalStaffWages)}</strong>
                    </div>
                  </div>
                </div>

                {/* 3. NET PROFIT CALCULATION */}
                <div
                  style={{
                    background: metrics.netOperatingProfit >= 0 ? "#f0fdf4" : "#fee2e2",
                    border: metrics.netOperatingProfit >= 0 ? "1px solid #bbf7d0" : "1px solid #fca5a5",
                    borderRadius: "10px",
                    padding: "16px 20px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <strong style={{ fontSize: "16px", color: metrics.netOperatingProfit >= 0 ? "#166534" : "#991b1b" }}>
                      NET OPERATING PROFIT
                    </strong>
                    <div style={{ fontSize: "12px", color: metrics.netOperatingProfit >= 0 ? "#15803d" : "#b91c1c", marginTop: "2px" }}>
                      Revenue minus all direct costs & labor
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "24px", fontWeight: 800, color: metrics.netOperatingProfit >= 0 ? "#15803d" : "#b91c1c" }}>
                      ₹{formatMoney(metrics.netOperatingProfit)}
                    </div>
                    <span style={{ fontSize: "12px", fontWeight: 700, color: metrics.netOperatingProfit >= 0 ? "#166534" : "#991b1b" }}>
                      {metrics.profitMargin.toFixed(1)}% Net Margin
                    </span>
                  </div>
                </div>

                {/* 4. CASHFLOW POSITION */}
                <div
                  style={{
                    background: "#fcfbfd",
                    border: "1px solid #ece8f2",
                    borderRadius: "10px",
                    padding: "16px 20px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <strong style={{ fontSize: "14px", color: "#24103f" }}>Realized Cashflow (Cash In hand)</strong>
                    <div style={{ fontSize: "12px", color: "#7a6e8a", marginTop: "2px" }}>
                      Actual collections received (₹{formatMoney(metrics.totalCollected)}) minus paid outflows (₹{formatMoney(metrics.totalOutflow)})
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "20px", fontWeight: 800, color: metrics.netCashflow >= 0 ? "#166534" : "#b91c1c" }}>
                      ₹{formatMoney(metrics.netCashflow)}
                    </div>
                    <div style={{ fontSize: "11px", color: "#8d819e" }}>
                      Uncollected Client Receivables: ₹{formatMoney(metrics.totalReceivables)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: EVENT PROFITABILITY LEDGER */}
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
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", textAlign: "left" }}>
                  <thead>
                    <tr style={{ background: "#f8f7fb", borderBottom: "1px solid #e9e5f0", color: "#5d4e70", fontWeight: 600 }}>
                      <th style={{ padding: "14px 18px" }}>Event # / Date</th>
                      <th style={{ padding: "14px 18px" }}>Customer / Venue</th>
                      <th style={{ padding: "14px 18px", textAlign: "right" }}>Guests</th>
                      <th style={{ padding: "14px 18px", textAlign: "right" }}>Quoted Value</th>
                      <th style={{ padding: "14px 18px", textAlign: "right" }}>Paid Amount</th>
                      <th style={{ padding: "14px 18px", textAlign: "right" }}>Balance Due</th>
                      <th style={{ padding: "14px 18px", textAlign: "center" }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEvents.map((ev) => {
                      const quoteVal = ev.quote ?? ev.total_estimate ?? 0;
                      const isPaid = ev.balance <= 0 && ev.paid_amount > 0;
                      const isPartial = ev.paid_amount > 0 && ev.balance > 0;
                      return (
                        <tr key={ev.id} style={{ borderBottom: "1px solid #f2eff7" }}>
                          <td style={{ padding: "14px 18px" }}>
                            <Link href={`/events/${ev.id}`} style={{ fontWeight: 700, color: "#24103f", textDecoration: "none" }}>
                              Event #{ev.id} • {ev.event_type}
                            </Link>
                            <div style={{ fontSize: "12px", color: "#7a6e8a", marginTop: "2px" }}>
                              📅 {formatDate(ev.date)}
                            </div>
                          </td>
                          <td style={{ padding: "14px 18px" }}>
                            <div style={{ fontWeight: 600, color: "#24103f" }}>{ev.customer_name}</div>
                            <div style={{ fontSize: "12px", color: "#7a6e8a", marginTop: "2px" }}>
                              📍 {ev.place || "Venue not set"}
                            </div>
                          </td>
                          <td style={{ padding: "14px 18px", textAlign: "right", color: "#5d4e70" }}>
                            {ev.guest_count}
                          </td>
                          <td style={{ padding: "14px 18px", textAlign: "right", fontWeight: 700, color: "#24103f" }}>
                            ₹{formatMoney(quoteVal)}
                          </td>
                          <td style={{ padding: "14px 18px", textAlign: "right", fontWeight: 700, color: "#166534" }}>
                            ₹{formatMoney(ev.paid_amount)}
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
                                background: isPaid ? "#dcfce7" : isPartial ? "#fef3c7" : "#fee2e2",
                                color: isPaid ? "#15803d" : isPartial ? "#b45309" : "#b91c1c",
                              }}
                            >
                              {isPaid ? "Fully Paid" : isPartial ? "Partially Paid" : "Unpaid"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: EXPENSE CATEGORY BREAKDOWN */}
          {activeTab === "expenses" && (
            <div
              style={{
                background: "#fff",
                borderRadius: "14px",
                border: "1px solid #e9e5f0",
                padding: "28px",
                boxShadow: "0 2px 10px rgba(36, 16, 63, 0.03)",
              }}
            >
              <h3 style={{ margin: "0 0 20px 0", color: "#24103f", fontSize: "18px" }}>
                Cost Allocation by Category
              </h3>

              {metrics.categoryBreakdown.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px", color: "#7a6e8a" }}>
                  No expense records found for the selected period.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  {metrics.categoryBreakdown.map((item) => (
                    <div key={item.name}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px", fontSize: "13px" }}>
                        <strong style={{ color: "#24103f" }}>{item.name}</strong>
                        <div>
                          <span style={{ fontWeight: 800, color: "#b91c1c" }}>₹{formatMoney(item.total)}</span>
                          <span style={{ color: "#7a6e8a", marginLeft: "8px" }}>({item.percentage.toFixed(1)}%)</span>
                        </div>
                      </div>
                      <div style={{ width: "100%", height: "8px", background: "#f0edf5", borderRadius: "4px", overflow: "hidden" }}>
                        <div
                          style={{
                            width: `${item.percentage}%`,
                            height: "100%",
                            background: "linear-gradient(90deg, #a855f7 0%, #7c3aed 100%)",
                            borderRadius: "4px",
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: RECEIVABLES AGING */}
          {activeTab === "receivables" && (
            <div
              style={{
                background: "#fff",
                borderRadius: "12px",
                border: "1px solid #e9e5f0",
                overflow: "hidden",
                boxShadow: "0 2px 10px rgba(36, 16, 63, 0.03)",
              }}
            >
              <div style={{ padding: "20px", borderBottom: "1px solid #e9e5f0" }}>
                <h3 style={{ margin: 0, color: "#24103f", fontSize: "16px" }}>
                  Uncollected Client Receivables (Total Due: ₹{formatMoney(metrics.totalReceivables)})
                </h3>
              </div>

              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", textAlign: "left" }}>
                  <thead>
                    <tr style={{ background: "#f8f7fb", borderBottom: "1px solid #e9e5f0", color: "#5d4e70", fontWeight: 600 }}>
                      <th style={{ padding: "14px 18px" }}>Customer Name</th>
                      <th style={{ padding: "14px 18px" }}>Event Date</th>
                      <th style={{ padding: "14px 18px" }}>Event Type & Venue</th>
                      <th style={{ padding: "14px 18px", textAlign: "right" }}>Quoted</th>
                      <th style={{ padding: "14px 18px", textAlign: "right" }}>Paid</th>
                      <th style={{ padding: "14px 18px", textAlign: "right" }}>Pending Balance</th>
                      <th style={{ padding: "14px 18px", textAlign: "center" }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEvents
                      .filter((ev) => (ev.balance ?? 0) > 0)
                      .map((ev) => (
                        <tr key={ev.id} style={{ borderBottom: "1px solid #f2eff7" }}>
                          <td style={{ padding: "14px 18px", fontWeight: 700, color: "#24103f" }}>
                            {ev.customer_name}
                          </td>
                          <td style={{ padding: "14px 18px", color: "#6b5b7e" }}>
                            {formatDate(ev.date)}
                          </td>
                          <td style={{ padding: "14px 18px", color: "#5d4e70" }}>
                            Event #{ev.id} • {ev.event_type} ({ev.place || "Venue"})
                          </td>
                          <td style={{ padding: "14px 18px", textAlign: "right", fontWeight: 600 }}>
                            ₹{formatMoney(ev.quote ?? ev.total_estimate)}
                          </td>
                          <td style={{ padding: "14px 18px", textAlign: "right", color: "#166534", fontWeight: 600 }}>
                            ₹{formatMoney(ev.paid_amount)}
                          </td>
                          <td style={{ padding: "14px 18px", textAlign: "right", fontWeight: 800, color: "#b45309" }}>
                            ₹{formatMoney(ev.balance)}
                          </td>
                          <td style={{ padding: "14px 18px", textAlign: "center" }}>
                            <Link
                              href={`/events/${ev.id}`}
                              style={{
                                padding: "6px 14px",
                                borderRadius: "6px",
                                background: "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)",
                                color: "#ffffff",
                                fontWeight: 700,
                                fontSize: "12px",
                                textDecoration: "none",
                                boxShadow: "0 2px 8px rgba(124, 58, 237, 0.25)",
                              }}
                            >
                              Collect
                            </Link>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
      <GoogleDriveBackupModal isOpen={showDriveModal} onClose={() => setShowDriveModal(false)} />
    </main>
  );
}
