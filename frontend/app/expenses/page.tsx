"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth, fetchWithAuth } from "../lib/auth";
import { SidebarUserCard, OwnerBanner, NavLink, TopbarUserBadge, AppSidebar, MobileMenuButton } from "../components/AuthBar";

const API_URL = typeof window !== "undefined" ? "/api/py" : "http://127.0.0.1:8000";

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

type EventOption = {
  id: number;
  date: string;
  customer_name: string;
  event_type: string;
  place: string;
};

type DatePreset = "all" | "today" | "this_week" | "this_month" | "last_month" | "custom";
type LedgerTab = "general" | "vendors" | "audit";

const CATEGORIES = [
  "Raw Materials & Groceries",
  "Vegetables & Fruits",
  "Meat & Seafood",
  "Dairy & Bakery",
  "Transport & Logistics",
  "Decor & Flowers",
  "Equipment & Rentals",
  "Gas & Utilities",
  "Staff Refreshments",
  "Miscellaneous",
];

const PAYMENT_METHODS = [
  "Cash",
  "UPI / GPay / PhonePe",
  "Bank Transfer / NEFT",
  "Company Card",
  "Cheque",
];

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

function formatMonthYear(ymStr: string): string {
  if (!ymStr) return "-";
  const [year, month] = ymStr.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

export default function ExpensesPage() {
  const router = useRouter();
  const { user, isOwner } = useAuth();

  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [events, setEvents] = useState<EventOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Active Ledger Tab
  const [activeTab, setActiveTab] = useState<LedgerTab>("general");

  // Selected Vendor for Individual Account Ledger View
  const [selectedVendor, setSelectedVendor] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [datePreset, setDatePreset] = useState<DatePreset>("all");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [paymentMethodFilter, setPaymentMethodFilter] = useState("All");
  const [allocationFilter, setAllocationFilter] = useState("All"); // All | Event | Overhead
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc"); // desc = latest first, asc = oldest first

  // Modal State for Add / Edit
  const [modalOpen, setModalOpen] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form Fields
  const [formTitle, setFormTitle] = useState("");
  const [formCategory, setFormCategory] = useState(CATEGORIES[0]);
  const [formAmount, setFormAmount] = useState("");
  const [formDate, setFormDate] = useState(new Date().toISOString().slice(0, 10));
  const [formEventId, setFormEventId] = useState<number | "">("");
  const [formPaymentMethod, setFormPaymentMethod] = useState(PAYMENT_METHODS[0]);
  const [formVendor, setFormVendor] = useState("");
  const [formBillNumber, setFormBillNumber] = useState("");
  const [formNote, setFormNote] = useState("");

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [expRes, eventsRes] = await Promise.all([
        fetch(`${API_URL}/expenses`, { cache: "no-store" }),
        fetch(`${API_URL}/events`, { cache: "no-store" }),
      ]);

      if (expRes.ok) {
        const expData = await expRes.json();
        setExpenses(Array.isArray(expData) ? expData : []);
      }

      if (eventsRes.ok) {
        const evData = await eventsRes.json();
        setEvents(
          Array.isArray(evData)
            ? evData.map((e: any) => ({
                id: e.id,
                date: e.date,
                customer_name: e.customer_name || `Customer #${e.customer_id}`,
                event_type: e.event_type || "Event",
                place: e.place || "",
              }))
            : []
        );
      }
    } catch (err) {
      console.error("Failed to load expenses data:", err);
      setError("Unable to connect to the server. Please ensure the backend is running.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Unique vendor list for suggestions
  const knownVendors = useMemo(() => {
    const set = new Set<string>();
    expenses.forEach((e) => {
      if (e.vendor && e.vendor.trim()) set.add(e.vendor.trim());
    });
    return Array.from(set).sort();
  }, [expenses]);

  // Helper date boundary calculators
  const dateBoundaries = useMemo(() => {
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);

    // This week (Monday to Sunday)
    const dayOfWeek = today.getDay(); // 0 is Sunday
    const distanceToMonday = (dayOfWeek + 6) % 7;
    const monday = new Date(today);
    monday.setDate(today.getDate() - distanceToMonday);
    const thisWeekStart = monday.toISOString().slice(0, 10);

    // This month
    const currentYearMonth = todayStr.slice(0, 7);

    // Last month
    const prevMonthDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const lastYearMonth = prevMonthDate.toISOString().slice(0, 7);

    return {
      todayStr,
      thisWeekStart,
      currentYearMonth,
      lastYearMonth,
    };
  }, []);

  // Filtered Expenses according to all active criteria
  const filteredExpenses = useMemo(() => {
    return expenses.filter((e) => {
      const expDate = e.expense_date ? e.expense_date.slice(0, 10) : "";

      // 1. Date Preset Filter
      if (datePreset === "today") {
        if (expDate !== dateBoundaries.todayStr) return false;
      } else if (datePreset === "this_week") {
        if (expDate < dateBoundaries.thisWeekStart || expDate > dateBoundaries.todayStr) return false;
      } else if (datePreset === "this_month") {
        if (!expDate.startsWith(dateBoundaries.currentYearMonth)) return false;
      } else if (datePreset === "last_month") {
        if (!expDate.startsWith(dateBoundaries.lastYearMonth)) return false;
      } else if (datePreset === "custom") {
        if (customStartDate && expDate < customStartDate) return false;
        if (customEndDate && expDate > customEndDate) return false;
      }

      // 2. Category Filter
      if (categoryFilter !== "All" && e.category !== categoryFilter) {
        return false;
      }

      // 3. Payment Method Filter
      if (paymentMethodFilter !== "All") {
        const pm = (e.payment_method || "Cash").toLowerCase();
        if (!pm.includes(paymentMethodFilter.toLowerCase())) {
          return false;
        }
      }

      // 4. Allocation Filter
      if (allocationFilter === "Event" && !e.event_id) return false;
      if (allocationFilter === "Overhead" && e.event_id) return false;

      // 5. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const match =
          (e.title && e.title.toLowerCase().includes(q)) ||
          (e.vendor && e.vendor.toLowerCase().includes(q)) ||
          (e.bill_number && e.bill_number.toLowerCase().includes(q)) ||
          (e.note && e.note.toLowerCase().includes(q)) ||
          (e.category && e.category.toLowerCase().includes(q)) ||
          (e.payment_method && e.payment_method.toLowerCase().includes(q)) ||
          String(e.id).includes(q) ||
          (e.event_id && String(e.event_id).includes(q));
        if (!match) return false;
      }

      return true;
    });
  }, [
    expenses,
    datePreset,
    customStartDate,
    customEndDate,
    categoryFilter,
    paymentMethodFilter,
    allocationFilter,
    searchQuery,
    dateBoundaries,
  ]);

  // Chronologically sorted entries with Running Balance (Accounting Ledger calculation)
  const ledgerEntries = useMemo(() => {
    // Always sort oldest-to-newest first to compute correct cumulative balance
    const sorted = [...filteredExpenses].sort((a, b) => {
      const da = a.expense_date || "";
      const db = b.expense_date || "";
      if (da !== db) return da.localeCompare(db);
      return a.id - b.id;
    });

    let running = 0;
    const computed = sorted.map((entry) => {
      running += entry.amount || 0;
      return {
        ...entry,
        runningBalance: running,
      };
    });

    // If display order is descending (latest first), reverse the display order
    if (sortOrder === "desc") {
      return [...computed].reverse();
    }
    return computed;
  }, [filteredExpenses, sortOrder]);

  // Overall Financial Metrics
  const metrics = useMemo(() => {
    let totalExpense = 0;
    let mtdExpense = 0;
    let eventSpecific = 0;
    let overhead = 0;
    let cashTotal = 0;
    let digitalTotal = 0;
    const categoryTotals: Record<string, number> = {};

    expenses.forEach((e) => {
      const amt = e.amount || 0;
      totalExpense += amt;

      const d = e.expense_date ? e.expense_date.slice(0, 10) : "";
      if (d.startsWith(dateBoundaries.currentYearMonth)) {
        mtdExpense += amt;
      }

      if (e.event_id) {
        eventSpecific += amt;
      } else {
        overhead += amt;
      }

      const method = (e.payment_method || "Cash").toLowerCase();
      if (method.includes("cash")) {
        cashTotal += amt;
      } else {
        digitalTotal += amt;
      }

      const cat = e.category || "Miscellaneous";
      categoryTotals[cat] = (categoryTotals[cat] || 0) + amt;
    });

    let topCat = "None";
    let topCatAmt = 0;
    Object.entries(categoryTotals).forEach(([cat, val]) => {
      if (val > topCatAmt) {
        topCatAmt = val;
        topCat = cat;
      }
    });

    return {
      totalExpense,
      mtdExpense,
      eventSpecific,
      overhead,
      cashTotal,
      digitalTotal,
      topCat,
      topCatAmt,
    };
  }, [expenses, dateBoundaries.currentYearMonth]);

  // Filtered Totals for active ledger view
  const activeLedgerTotals = useMemo(() => {
    let sum = 0;
    let cash = 0;
    let digital = 0;
    filteredExpenses.forEach((e) => {
      const amt = e.amount || 0;
      sum += amt;
      const pm = (e.payment_method || "Cash").toLowerCase();
      if (pm.includes("cash")) cash += amt;
      else digital += amt;
    });
    return { sum, cash, digital, count: filteredExpenses.length };
  }, [filteredExpenses]);

  // Grouped Vendor Ledgers (Accounts Payable / Supplier Accounts)
  const vendorLedgers = useMemo(() => {
    const map: Record<
      string,
      {
        name: string;
        totalAmount: number;
        billCount: number;
        lastDate: string;
        categories: Record<string, number>;
        expenses: ExpenseRecord[];
      }
    > = {};

    expenses.forEach((e) => {
      const vName = (e.vendor && e.vendor.trim()) || "Direct / Unassigned Vendor";
      if (!map[vName]) {
        map[vName] = {
          name: vName,
          totalAmount: 0,
          billCount: 0,
          lastDate: "",
          categories: {},
          expenses: [],
        };
      }
      const item = map[vName];
      const amt = e.amount || 0;
      item.totalAmount += amt;
      item.billCount += 1;
      const d = e.expense_date ? e.expense_date.slice(0, 10) : "";
      if (d > item.lastDate) item.lastDate = d;
      const cat = e.category || "Miscellaneous";
      item.categories[cat] = (item.categories[cat] || 0) + amt;
      item.expenses.push(e);
    });

    return Object.values(map).sort((a, b) => b.totalAmount - a.totalAmount);
  }, [expenses]);

  // Active Selected Vendor Details & Running Ledger
  const selectedVendorData = useMemo(() => {
    if (!selectedVendor) return null;
    const vendorObj = vendorLedgers.find((v) => v.name === selectedVendor);
    if (!vendorObj) return null;

    // Chronological order for vendor account ledger
    const sorted = [...vendorObj.expenses].sort((a, b) => {
      const da = a.expense_date || "";
      const db = b.expense_date || "";
      if (da !== db) return da.localeCompare(db);
      return a.id - b.id;
    });

    let running = 0;
    const computed = sorted.map((entry) => {
      running += entry.amount || 0;
      return {
        ...entry,
        runningBalance: running,
      };
    });

    return {
      ...vendorObj,
      entries: computed.reverse(), // newest first with accurate running total
    };
  }, [selectedVendor, vendorLedgers]);

  // Monthly Outflow Ledger Grouping
  const monthlyLedger = useMemo(() => {
    const monthsMap: Record<
      string,
      {
        monthKey: string;
        total: number;
        eventAllocated: number;
        overhead: number;
        count: number;
      }
    > = {};

    expenses.forEach((e) => {
      const d = e.expense_date ? e.expense_date.slice(0, 7) : "Unknown";
      if (!monthsMap[d]) {
        monthsMap[d] = {
          monthKey: d,
          total: 0,
          eventAllocated: 0,
          overhead: 0,
          count: 0,
        };
      }
      const amt = e.amount || 0;
      monthsMap[d].total += amt;
      monthsMap[d].count += 1;
      if (e.event_id) {
        monthsMap[d].eventAllocated += amt;
      } else {
        monthsMap[d].overhead += amt;
      }
    });

    return Object.values(monthsMap).sort((a, b) => b.monthKey.localeCompare(a.monthKey));
  }, [expenses]);

  // Category Breakdown Ledger Grouping
  const categoryLedger = useMemo(() => {
    const map: Record<
      string,
      {
        category: string;
        total: number;
        count: number;
        topVendor: string;
        vendorSpend: Record<string, number>;
      }
    > = {};

    expenses.forEach((e) => {
      const cat = e.category || "Miscellaneous";
      if (!map[cat]) {
        map[cat] = {
          category: cat,
          total: 0,
          count: 0,
          topVendor: "-",
          vendorSpend: {},
        };
      }
      const amt = e.amount || 0;
      map[cat].total += amt;
      map[cat].count += 1;
      const v = (e.vendor && e.vendor.trim()) || "Direct";
      map[cat].vendorSpend[v] = (map[cat].vendorSpend[v] || 0) + amt;
    });

    return Object.values(map)
      .map((item) => {
        let bestVendor = "-";
        let bestAmt = 0;
        Object.entries(item.vendorSpend).forEach(([ven, val]) => {
          if (val > bestAmt) {
            bestAmt = val;
            bestVendor = ven;
          }
        });
        return {
          category: item.category,
          total: item.total,
          count: item.count,
          percentage: metrics.totalExpense > 0 ? (item.total / metrics.totalExpense) * 100 : 0,
          topVendor: bestVendor,
        };
      })
      .sort((a, b) => b.total - a.total);
  }, [expenses, metrics.totalExpense]);

  // Open Add Modal
  const openAddModal = (presetEventId?: number) => {
    setEditingExpenseId(null);
    setFormTitle("");
    setFormCategory(CATEGORIES[0]);
    setFormAmount("");
    setFormDate(new Date().toISOString().slice(0, 10));
    setFormEventId(presetEventId ?? "");
    setFormPaymentMethod(PAYMENT_METHODS[0]);
    setFormVendor(selectedVendor || "");
    setFormBillNumber("");
    setFormNote("");
    setModalOpen(true);
  };

  // Open Edit Modal
  const openEditModal = (exp: ExpenseRecord) => {
    setEditingExpenseId(exp.id);
    setFormTitle(exp.title);
    setFormCategory(exp.category || CATEGORIES[0]);
    setFormAmount(String(exp.amount));
    setFormDate(exp.expense_date ? exp.expense_date.slice(0, 10) : new Date().toISOString().slice(0, 10));
    setFormEventId(exp.event_id ?? "");
    setFormPaymentMethod(exp.payment_method || PAYMENT_METHODS[0]);
    setFormVendor(exp.vendor || "");
    setFormBillNumber(exp.bill_number || "");
    setFormNote(exp.note || "");
    setModalOpen(true);
  };

  // Submit Modal (Create / Update)
  const handleSaveExpense = async (e: FormEvent) => {
    e.preventDefault();
    const title = formTitle.trim();
    if (!title) {
      alert("Please enter an expense title or item description.");
      return;
    }
    const amt = parseFloat(formAmount);
    if (!amt || amt <= 0) {
      alert("Please enter a valid expense amount greater than zero.");
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        title,
        category: formCategory,
        amount: amt,
        expense_date: formDate,
        event_id: formEventId ? Number(formEventId) : null,
        payment_method: formPaymentMethod,
        vendor: formVendor.trim() || null,
        bill_number: formBillNumber.trim() || null,
        note: formNote.trim() || null,
      };

      const url = editingExpenseId
        ? `${API_URL}/expenses/${editingExpenseId}`
        : `${API_URL}/expenses`;
      const method = editingExpenseId ? "PUT" : "POST";

      const res = await fetchWithAuth(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        throw new Error(errorData?.detail || "Failed to save expense");
      }

      setSuccessMsg(
        editingExpenseId
          ? `Expense updated in ledger successfully.`
          : `Debit voucher recorded: ₹${formatMoney(amt)} (${title})`
      );
      setModalOpen(false);
      await loadData();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      alert(err.message || "Failed to save expense");
    } finally {
      setSubmitting(false);
    }
  };

  // Delete Expense
  const handleDeleteExpense = async (id: number, title: string) => {
    if (!window.confirm(`Are you sure you want to permanently delete expense record #${id} ("${title}") from the ledger?`)) {
      return;
    }
    try {
      const res = await fetchWithAuth(`${API_URL}/expenses/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete expense");
      setSuccessMsg(`Ledger entry #${id} removed successfully.`);
      await loadData();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      alert(err.message || "Unable to delete expense");
    }
  };

  // Print Statement trigger
  const handlePrintLedger = () => {
    window.print();
  };

  return (
    <main className="dashboard">
      <AppSidebar activeRoute="/expenses" />

      {/* Main Content */}
      <div className="main-content">
        {/* Topbar */}
        <header className="topbar no-print">
          <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0 }}>
            <MobileMenuButton />
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                <h1 style={{ margin: 0, fontSize: "19px", fontWeight: 700, color: "#1e0836", lineHeight: 1.2 }}>
                  Expense Tracker & Outflows Ledger
                </h1>
                <span
                  style={{
                    fontSize: "11px",
                    color: "#6d28d9",
                    background: "#f5f3ff",
                    border: "1px solid #ddd6fe",
                    padding: "2px 8px",
                    borderRadius: "10px",
                    fontWeight: 700,
                    whiteSpace: "nowrap",
                  }}
                >
                  {expenses.length} Ledger Records
                </span>
              </div>
              <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#8a7b9b" }}>
                General debit ledger, supplier accounts, operational overheads, and financial auditing
              </p>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", justifyContent: "flex-end" }}>
            {/* Quick search input */}
            <div className="search-box">
              <span style={{ color: "#8a7b9b", fontSize: "14px" }}>🔍</span>
              <input
                type="text"
                placeholder="Search vendor, item, bill #..."
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

            {/* Print Ledger Button */}
            <button
              type="button"
              onClick={handlePrintLedger}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                background: "#ffffff",
                color: "#5b21b6",
                border: "1px solid #ddd6fe",
                borderRadius: "8px",
                padding: "8px 14px",
                fontWeight: 700,
                fontSize: "12px",
                cursor: "pointer",
                whiteSpace: "nowrap",
                flexShrink: 0,
                boxShadow: "0 1px 4px rgba(124, 58, 237, 0.08)",
              }}
            >
              <span>🖨️</span> Print Ledger
            </button>

            {!isOwner && (
              <button
                type="button"
                onClick={() => openAddModal()}
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
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                  boxShadow: "0 4px 14px rgba(124, 58, 237, 0.35)",
                }}
              >
                <span>+</span> Add Expense
              </button>
            )}

            <TopbarUserBadge />
          </div>
        </header>

        {/* PRINT ONLY STATEMENT HEADER */}
        <div
          className="print-only"
          style={{
            display: "none",
            marginBottom: "20px",
            paddingBottom: "12px",
            borderBottom: "2px solid #333",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <h1 style={{ margin: 0, fontSize: "22px", fontWeight: 800, textTransform: "uppercase" }}>
                Food Court Event Management
              </h1>
              <h2 style={{ margin: "4px 0", fontSize: "16px", color: "#444" }}>
                {selectedVendor ? `Vendor Account Statement: ${selectedVendor}` : "General Outflow Expense Ledger"}
              </h2>
              <p style={{ margin: 0, fontSize: "12px", color: "#666" }}>
                Period: {datePreset.replace("_", " ").toUpperCase()} {customStartDate ? `(${customStartDate} to ${customEndDate || "Today"})` : ""}
              </p>
            </div>
            <div style={{ textAlign: "right", fontSize: "12px", color: "#555" }}>
              <div>Generated: {new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</div>
              <div>Audited Total Outflow: ₹{formatMoney(activeLedgerTotals.sum)}</div>
              <div>Total Entries: {activeLedgerTotals.count}</div>
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="page-content" style={{ background: "#faf8fd", minHeight: "100vh", padding: "24px" }}>
          <OwnerBanner />

          {/* Notifications */}
          {successMsg && (
            <div
              className="no-print"
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

          {error && (
            <div
              className="no-print"
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
              marginBottom: "24px",
            }}
          >
            {/* 1. Total Outflows */}
            <div
              style={{
                background: "#ffffff",
                border: "1px solid #ebe4f5",
                borderRadius: "14px",
                padding: "20px",
                boxShadow: "0 2px 10px rgba(124, 58, 237, 0.04)",
                position: "relative",
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                minHeight: "125px",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  height: "3px",
                  background: "linear-gradient(90deg, #ef4444 0%, #f43f5e 100%)",
                }}
              />
              <div style={{ fontSize: "12px", color: "#b91c1c", fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase" }}>
                Total Cumulative Outflows
              </div>
              <div style={{ fontSize: "26px", fontWeight: 800, color: "#991b1b", marginTop: "8px" }}>
                ₹{formatMoney(metrics.totalExpense)}
              </div>
              <div style={{ fontSize: "12px", color: "#7a6e8a", marginTop: "6px" }}>
                Across {expenses.length} debit vouchers logged
              </div>
            </div>

            {/* 2. This Month MTD */}
            <div
              style={{
                background: "#ffffff",
                border: "1px solid #ebe4f5",
                borderRadius: "14px",
                padding: "20px",
                boxShadow: "0 2px 10px rgba(124, 58, 237, 0.04)",
                position: "relative",
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                minHeight: "125px",
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
              <div style={{ fontSize: "12px", color: "#6d28d9", fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase" }}>
                Current Month (MTD)
              </div>
              <div style={{ fontSize: "26px", fontWeight: 800, color: "#1e0836", marginTop: "8px" }}>
                ₹{formatMoney(metrics.mtdExpense)}
              </div>
              <div style={{ fontSize: "12px", color: "#8a7b9b", marginTop: "6px" }}>
                Disbursed this calendar month
              </div>
            </div>

            {/* 3. Cost Allocation */}
            <div
              style={{
                background: "#ffffff",
                border: "1px solid #ebe4f5",
                borderRadius: "14px",
                padding: "20px",
                boxShadow: "0 2px 10px rgba(124, 58, 237, 0.04)",
                position: "relative",
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                minHeight: "125px",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  height: "3px",
                  background: "linear-gradient(90deg, #0284c7 0%, #38bdf8 100%)",
                }}
              />
              <div style={{ fontSize: "12px", color: "#0369a1", fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase" }}>
                Allocation Split
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: "10px", marginTop: "8px", flexWrap: "wrap" }}>
                <span style={{ fontSize: "18px", fontWeight: 800, color: "#1e0836" }}>
                  Event: ₹{formatMoney(metrics.eventSpecific)}
                </span>
              </div>
              <div style={{ fontSize: "12px", color: "#0369a1", marginTop: "6px" }}>
                Overhead: ₹{formatMoney(metrics.overhead)}
              </div>
            </div>

            {/* 4. Cash vs Digital Mode */}
            <div
              style={{
                background: "#ffffff",
                border: "1px solid #ebe4f5",
                borderRadius: "14px",
                padding: "20px",
                boxShadow: "0 2px 10px rgba(124, 58, 237, 0.04)",
                position: "relative",
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                minHeight: "125px",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  height: "3px",
                  background: "linear-gradient(90deg, #10b981 0%, #34d399 100%)",
                }}
              />
              <div style={{ fontSize: "12px", color: "#047857", fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase" }}>
                Disbursement Mode
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: "10px", marginTop: "8px", flexWrap: "wrap" }}>
                <span style={{ fontSize: "18px", fontWeight: 800, color: "#065f46" }}>
                  Cash: ₹{formatMoney(metrics.cashTotal)}
                </span>
              </div>
              <div style={{ fontSize: "12px", color: "#047857", marginTop: "6px" }}>
                Digital/Bank: ₹{formatMoney(metrics.digitalTotal)}
              </div>
            </div>
          </div>

          {/* LEDGER NAVIGATION TABS */}
          <div
            className="no-print"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              borderBottom: "2px solid #e9e3f3",
              marginBottom: "20px",
              flexWrap: "wrap",
            }}
          >
            <button
              type="button"
              onClick={() => {
                setActiveTab("general");
                setSelectedVendor(null);
              }}
              style={{
                background: "transparent",
                border: "none",
                borderBottom: activeTab === "general" ? "3px solid #7c3aed" : "3px solid transparent",
                padding: "12px 16px",
                fontSize: "14px",
                fontWeight: activeTab === "general" ? 800 : 600,
                color: activeTab === "general" ? "#7c3aed" : "#6c5e7e",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                marginBottom: "-2px",
              }}
            >
              <span>📜</span> General Outflow Ledger ({filteredExpenses.length})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("vendors")}
              style={{
                background: "transparent",
                border: "none",
                borderBottom: activeTab === "vendors" ? "3px solid #7c3aed" : "3px solid transparent",
                padding: "12px 16px",
                fontSize: "14px",
                fontWeight: activeTab === "vendors" ? 800 : 600,
                color: activeTab === "vendors" ? "#7c3aed" : "#6c5e7e",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                marginBottom: "-2px",
              }}
            >
              <span>🏪</span> Vendor & Supplier Ledgers ({vendorLedgers.length})
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab("audit");
                setSelectedVendor(null);
              }}
              style={{
                background: "transparent",
                border: "none",
                borderBottom: activeTab === "audit" ? "3px solid #7c3aed" : "3px solid transparent",
                padding: "12px 16px",
                fontSize: "14px",
                fontWeight: activeTab === "audit" ? 800 : 600,
                color: activeTab === "audit" ? "#7c3aed" : "#6c5e7e",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                marginBottom: "-2px",
              }}
            >
              <span>📅</span> Monthly & Category Audit
            </button>
          </div>

          {/* LEDGER FILTER CONTROLS BAR (Shown for General Ledger) */}
          {activeTab === "general" && (
            <div
              className="no-print"
              style={{
                background: "#ffffff",
                border: "1px solid #ebe4f5",
                borderRadius: "14px",
                padding: "14px 18px",
                boxShadow: "0 2px 8px rgba(124, 58, 237, 0.03)",
                marginBottom: "20px",
                display: "flex",
                flexDirection: "column",
                gap: "12px",
              }}
            >
              {/* Row 1: Period Presets & Quick Filters */}
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "6px" }}>
                  <span style={{ fontSize: "11px", color: "#6d5b83", fontWeight: 700, textTransform: "uppercase", marginRight: "4px" }}>
                    Period:
                  </span>
                  {(
                    [
                      { id: "all", label: "All Time" },
                      { id: "this_month", label: "This Month" },
                      { id: "last_month", label: "Last Month" },
                      { id: "this_week", label: "This Week" },
                      { id: "today", label: "Today" },
                      { id: "custom", label: "Custom Range" },
                    ] as const
                  ).map((p) => {
                    const active = datePreset === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setDatePreset(p.id)}
                        style={{
                          padding: "5px 12px",
                          borderRadius: "20px",
                          border: active ? "1px solid #7c3aed" : "1px solid #e2d9ec",
                          background: active ? "#7c3aed" : "#fcfaff",
                          color: active ? "#ffffff" : "#4c3a60",
                          fontSize: "12px",
                          fontWeight: active ? 700 : 500,
                          cursor: "pointer",
                          transition: "all 0.15s ease",
                        }}
                      >
                        {p.label}
                      </button>
                    );
                  })}
                </div>

                {/* Sort Order Toggle */}
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "12px", color: "#6d5b83", fontWeight: 600 }}>Ledger Sequence:</span>
                  <button
                    type="button"
                    onClick={() => setSortOrder(sortOrder === "desc" ? "asc" : "desc")}
                    style={{
                      padding: "5px 12px",
                      borderRadius: "6px",
                      border: "1px solid #dcd7e5",
                      background: "#fcfaff",
                      fontSize: "12px",
                      color: "#1e0836",
                      fontWeight: 700,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    {sortOrder === "desc" ? "Newest First ▾" : "Oldest First (Ascending) ▴"}
                  </button>
                </div>
              </div>

              {/* Row 2: Custom Date Range (if custom selected) */}
              {datePreset === "custom" && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    padding: "10px 14px",
                    background: "#f8f5fd",
                    borderRadius: "8px",
                    border: "1px dashed #d8cce8",
                    flexWrap: "wrap",
                  }}
                >
                  <span style={{ fontSize: "12px", fontWeight: 700, color: "#6d28d9" }}>Custom Dates:</span>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span style={{ fontSize: "12px", color: "#555" }}>From:</span>
                    <input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      style={{ padding: "4px 8px", borderRadius: "6px", border: "1px solid #dcd7e5", fontSize: "12px" }}
                    />
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span style={{ fontSize: "12px", color: "#555" }}>To:</span>
                    <input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      style={{ padding: "4px 8px", borderRadius: "6px", border: "1px solid #dcd7e5", fontSize: "12px" }}
                    />
                  </div>
                </div>
              )}

              {/* Row 3: Dropdown filters */}
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "12px" }}>
                  {/* Category Filter */}
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span style={{ fontSize: "11px", color: "#6d5b83", fontWeight: 700, textTransform: "uppercase" }}>Category:</span>
                    <select
                      value={categoryFilter}
                      onChange={(e) => setCategoryFilter(e.target.value)}
                      style={{
                        height: "32px",
                        padding: "0 10px",
                        borderRadius: "6px",
                        border: "1px solid #e2d9ec",
                        background: "#fcfaff",
                        fontSize: "12px",
                        color: "#1e0836",
                        outline: "none",
                      }}
                    >
                      <option value="All">All Categories</option>
                      {CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Payment Method Filter */}
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span style={{ fontSize: "11px", color: "#6d5b83", fontWeight: 700, textTransform: "uppercase" }}>Method:</span>
                    <select
                      value={paymentMethodFilter}
                      onChange={(e) => setPaymentMethodFilter(e.target.value)}
                      style={{
                        height: "32px",
                        padding: "0 10px",
                        borderRadius: "6px",
                        border: "1px solid #e2d9ec",
                        background: "#fcfaff",
                        fontSize: "12px",
                        color: "#1e0836",
                        outline: "none",
                      }}
                    >
                      <option value="All">All Methods</option>
                      <option value="Cash">Cash Only</option>
                      <option value="UPI">UPI / GPay Only</option>
                      <option value="Bank">Bank Transfer Only</option>
                      <option value="Card">Company Card Only</option>
                      <option value="Cheque">Cheque Only</option>
                    </select>
                  </div>

                  {/* Cost Allocation Filter */}
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span style={{ fontSize: "11px", color: "#6d5b83", fontWeight: 700, textTransform: "uppercase" }}>Allocation:</span>
                    <select
                      value={allocationFilter}
                      onChange={(e) => setAllocationFilter(e.target.value)}
                      style={{
                        height: "32px",
                        padding: "0 10px",
                        borderRadius: "6px",
                        border: "1px solid #e2d9ec",
                        background: "#fcfaff",
                        fontSize: "12px",
                        color: "#1e0836",
                        outline: "none",
                      }}
                    >
                      <option value="All">All Expenses</option>
                      <option value="Event">Event Specific Only</option>
                      <option value="Overhead">General Overhead Only</option>
                    </select>
                  </div>

                  {/* Clear Button */}
                  {(categoryFilter !== "All" || paymentMethodFilter !== "All" || allocationFilter !== "All" || datePreset !== "all" || searchQuery) && (
                    <button
                      type="button"
                      onClick={() => {
                        setCategoryFilter("All");
                        setPaymentMethodFilter("All");
                        setAllocationFilter("All");
                        setDatePreset("all");
                        setCustomStartDate("");
                        setCustomEndDate("");
                        setSearchQuery("");
                      }}
                      style={{
                        height: "32px",
                        padding: "0 10px",
                        borderRadius: "6px",
                        border: "1px solid #fecaca",
                        background: "#fff5f5",
                        color: "#b91c1c",
                        fontSize: "11px",
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      ✕ Reset Filters
                    </button>
                  )}
                </div>

                {/* Audited Total Pill */}
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "12px", color: "#6d5b83" }}>Period Total:</span>
                  <span
                    style={{
                      fontSize: "13px",
                      fontWeight: 800,
                      color: "#b91c1c",
                      background: "#fee2e2",
                      padding: "4px 10px",
                      borderRadius: "8px",
                      border: "1px solid #fca5a5",
                    }}
                  >
                    - ₹{formatMoney(activeLedgerTotals.sum)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 1: GENERAL OUTFLOW LEDGER WITH RUNNING BALANCE */}
          {/* ======================================================== */}
          {activeTab === "general" && (
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
                  Loading financial expense ledger...
                </div>
              ) : ledgerEntries.length === 0 ? (
                <div style={{ padding: "50px 20px", textAlign: "center" }}>
                  <div style={{ fontSize: "36px", marginBottom: "12px" }}>💳</div>
                  <h3 style={{ margin: "0 0 6px 0", color: "#1e0836" }}>No ledger entries found</h3>
                  <p style={{ color: "#7a6e8a", fontSize: "14px", margin: "0 0 16px 0" }}>
                    {searchQuery || categoryFilter !== "All" || datePreset !== "all" || allocationFilter !== "All"
                      ? "No records match your active filters or date criteria."
                      : "Start recording purchases, vendor bills, and operational expenses."}
                  </p>
                  {!isOwner && (
                    <button
                      type="button"
                      onClick={() => openAddModal()}
                      style={{
                        background: "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)",
                        color: "#ffffff",
                        border: "none",
                        padding: "8px 18px",
                        borderRadius: "8px",
                        fontWeight: 700,
                        cursor: "pointer",
                        boxShadow: "0 4px 14px rgba(124, 58, 237, 0.35)",
                      }}
                    >
                      + Record First Debit Entry
                    </button>
                  )}
                </div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table
                    className="ledger-table"
                    style={{
                      width: "100%",
                      minWidth: "900px",
                      borderCollapse: "collapse",
                      fontSize: "13px",
                      textAlign: "left",
                    }}
                  >
                    <thead>
                      <tr
                        style={{
                          background: "linear-gradient(180deg, #fbf9fe 0%, #f4effa 100%)",
                          borderBottom: "2px solid #ece4f5",
                          color: "#542b80",
                          fontWeight: 700,
                        }}
                      >
                        <th style={{ padding: "14px 18px" }}>Entry Date</th>
                        <th style={{ padding: "14px 18px" }}>Voucher / Bill #</th>
                        <th style={{ padding: "14px 18px" }}>Particulars / Item Description</th>
                        <th style={{ padding: "14px 18px" }}>Category</th>
                        <th style={{ padding: "14px 18px" }}>Vendor / Supplier</th>
                        <th style={{ padding: "14px 18px" }}>Payment Mode</th>
                        <th style={{ padding: "14px 18px", textAlign: "right" }}>Debit Amount (₹)</th>
                        <th
                          style={{
                            padding: "14px 18px",
                            textAlign: "right",
                            background: "rgba(124, 58, 237, 0.05)",
                            color: "#6d28d9",
                          }}
                        >
                          Cumulative Outflow (₹)
                        </th>
                        <th className="no-print" style={{ padding: "14px 18px", textAlign: "center" }}>
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {ledgerEntries.map((exp) => (
                        <tr
                          key={exp.id}
                          style={{
                            borderBottom: "1px solid #f2eff7",
                            transition: "background 0.15s ease",
                          }}
                        >
                          {/* Date */}
                          <td style={{ padding: "14px 18px", fontWeight: 600, color: "#24103f", whiteSpace: "nowrap" }}>
                            {formatDate(exp.expense_date)}
                          </td>

                          {/* Voucher / Bill # */}
                          <td style={{ padding: "14px 18px", fontFamily: "monospace", color: "#6b5b7e", fontSize: "12px", whiteSpace: "nowrap" }}>
                            {exp.bill_number ? (
                              <span style={{ background: "#f5f3ff", padding: "2px 6px", borderRadius: "4px", border: "1px solid #ddd6fe", color: "#6d28d9", fontWeight: 700 }}>
                                #{exp.bill_number}
                              </span>
                            ) : (
                              <span style={{ color: "#9ca3af" }}>EXP-{String(exp.id).padStart(4, "0")}</span>
                            )}
                          </td>

                          {/* Particulars */}
                          <td style={{ padding: "14px 18px" }}>
                            <div style={{ fontWeight: 700, color: "#1e0836" }}>{exp.title}</div>
                            {exp.note && (
                              <div style={{ fontSize: "11px", color: "#7a6e8a", marginTop: "2px", maxWidth: "260px" }}>
                                {exp.note}
                              </div>
                            )}
                            {exp.event_id && (
                              <div style={{ marginTop: "4px" }}>
                                <Link
                                  href={`/events/${exp.event_id}`}
                                  style={{
                                    fontSize: "11px",
                                    color: "#4f46e5",
                                    fontWeight: 700,
                                    textDecoration: "none",
                                    background: "#eef2ff",
                                    padding: "2px 6px",
                                    borderRadius: "4px",
                                    display: "inline-block",
                                  }}
                                >
                                  Event #{exp.event_id} {exp.event_type ? `• ${exp.event_type}` : ""}
                                </Link>
                              </div>
                            )}
                          </td>

                          {/* Category */}
                          <td style={{ padding: "14px 18px" }}>
                            <span
                              style={{
                                display: "inline-block",
                                padding: "3px 8px",
                                borderRadius: "6px",
                                fontSize: "11px",
                                fontWeight: 700,
                                background: "#f3edf8",
                                color: "#582a85",
                              }}
                            >
                              {exp.category}
                            </span>
                          </td>

                          {/* Vendor */}
                          <td style={{ padding: "14px 18px", color: "#3c2e4e" }}>
                            {exp.vendor ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedVendor(exp.vendor || null);
                                  setActiveTab("vendors");
                                }}
                                style={{
                                  border: "none",
                                  background: "transparent",
                                  padding: 0,
                                  color: "#7c3aed",
                                  fontWeight: 700,
                                  cursor: "pointer",
                                  textDecoration: "underline",
                                  textAlign: "left",
                                  fontSize: "13px",
                                }}
                                title="Click to view full vendor account statement"
                              >
                                {exp.vendor}
                              </button>
                            ) : (
                              <span style={{ color: "#a59cb3", fontSize: "12px" }}>General / Cash Outflow</span>
                            )}
                          </td>

                          {/* Payment Method */}
                          <td style={{ padding: "14px 18px", whiteSpace: "nowrap" }}>
                            <span
                              style={{
                                display: "inline-block",
                                fontSize: "11px",
                                fontWeight: 600,
                                padding: "2px 8px",
                                borderRadius: "4px",
                                background: (exp.payment_method || "Cash").toLowerCase().includes("cash")
                                  ? "#ecfdf5"
                                  : "#eff6ff",
                                color: (exp.payment_method || "Cash").toLowerCase().includes("cash")
                                  ? "#047857"
                                  : "#1d4ed8",
                              }}
                            >
                              {(exp.payment_method || "Cash").toLowerCase().includes("cash") ? "💵 " : "🏦 "}
                              {exp.payment_method || "Cash"}
                            </span>
                          </td>

                          {/* Debit Amount */}
                          <td
                            style={{
                              padding: "14px 18px",
                              textAlign: "right",
                              fontWeight: 800,
                              color: "#b91c1c",
                              fontSize: "14px",
                              whiteSpace: "nowrap",
                            }}
                          >
                            - ₹{formatMoney(exp.amount)}
                          </td>

                          {/* Running Balance */}
                          <td
                            style={{
                              padding: "14px 18px",
                              textAlign: "right",
                              fontWeight: 800,
                              color: "#4c1d95",
                              fontSize: "14px",
                              background: "rgba(124, 58, 237, 0.03)",
                              whiteSpace: "nowrap",
                            }}
                          >
                            ₹{formatMoney(exp.runningBalance)}
                          </td>

                          {/* Actions */}
                          <td className="no-print" style={{ padding: "14px 18px", textAlign: "center", whiteSpace: "nowrap" }}>
                            <div style={{ display: "flex", justifyContent: "center", gap: "6px" }}>
                              {!isOwner && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => openEditModal(exp)}
                                    style={{
                                      padding: "4px 8px",
                                      borderRadius: "4px",
                                      background: "#f0edf5",
                                      color: "#24103f",
                                      border: "none",
                                      fontSize: "12px",
                                      fontWeight: 600,
                                      cursor: "pointer",
                                    }}
                                  >
                                    Edit
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteExpense(exp.id, exp.title)}
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
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>

                    {/* ACCOUNTING AUDIT FOOTER */}
                    <tfoot>
                      <tr
                        style={{
                          background: "#fdfcfe",
                          borderTop: "2px solid #ddd6fe",
                          fontWeight: 800,
                          color: "#1e0836",
                        }}
                      >
                        <td colSpan={5} style={{ padding: "14px 18px", fontSize: "13px" }}>
                          Audited Ledger Summary ({activeLedgerTotals.count} Entries) • Cash: ₹{formatMoney(activeLedgerTotals.cash)} • Digital: ₹{formatMoney(activeLedgerTotals.digital)}
                        </td>
                        <td style={{ padding: "14px 18px", textAlign: "right", fontSize: "12px", color: "#6b5b7e" }}>
                          Total Debit:
                        </td>
                        <td style={{ padding: "14px 18px", textAlign: "right", fontSize: "15px", color: "#b91c1c" }}>
                          - ₹{formatMoney(activeLedgerTotals.sum)}
                        </td>
                        <td
                          style={{
                            padding: "14px 18px",
                            textAlign: "right",
                            fontSize: "15px",
                            color: "#6d28d9",
                            background: "rgba(124, 58, 237, 0.08)",
                          }}
                        >
                          ₹{formatMoney(activeLedgerTotals.sum)}
                        </td>
                        <td className="no-print" />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 2: VENDOR & SUPPLIER LEDGERS (ACCOUNTS PAYABLE) */}
          {/* ======================================================== */}
          {activeTab === "vendors" && (
            <div>
              {/* If an individual vendor account is selected */}
              {selectedVendorData ? (
                <div>
                  {/* Vendor Account Header */}
                  <div
                    style={{
                      background: "#ffffff",
                      borderRadius: "14px",
                      border: "1px solid #ebe4f5",
                      padding: "20px 24px",
                      marginBottom: "20px",
                      boxShadow: "0 2px 10px rgba(124, 58, 237, 0.04)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      flexWrap: "wrap",
                      gap: "16px",
                    }}
                  >
                    <div>
                      <div className="no-print" style={{ marginBottom: "8px" }}>
                        <button
                          type="button"
                          onClick={() => setSelectedVendor(null)}
                          style={{
                            border: "none",
                            background: "transparent",
                            color: "#7c3aed",
                            fontWeight: 700,
                            fontSize: "13px",
                            cursor: "pointer",
                            padding: 0,
                          }}
                        >
                          ← Back to All Vendors
                        </button>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <span style={{ fontSize: "24px" }}>🏪</span>
                        <div>
                          <h2 style={{ margin: 0, fontSize: "20px", fontWeight: 800, color: "#1e0836" }}>
                            {selectedVendorData.name}
                          </h2>
                          <span style={{ fontSize: "12px", color: "#8a7b9b" }}>
                            Supplier Account Statement • Last Bill: {formatDate(selectedVendorData.lastDate)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
                      <div style={{ textAlign: "right" }}>
                        <span style={{ fontSize: "11px", color: "#6d5b83", fontWeight: 700, textTransform: "uppercase" }}>
                          Total Spent With Vendor
                        </span>
                        <div style={{ fontSize: "24px", fontWeight: 800, color: "#b91c1c" }}>
                          ₹{formatMoney(selectedVendorData.totalAmount)}
                        </div>
                        <span style={{ fontSize: "11px", color: "#7a6e8a" }}>
                          Across {selectedVendorData.billCount} bills
                        </span>
                      </div>

                      <div className="no-print" style={{ display: "flex", gap: "8px" }}>
                        <button
                          type="button"
                          onClick={handlePrintLedger}
                          style={{
                            padding: "8px 14px",
                            borderRadius: "8px",
                            border: "1px solid #ddd6fe",
                            background: "#fff",
                            color: "#6d28d9",
                            fontWeight: 700,
                            fontSize: "12px",
                            cursor: "pointer",
                          }}
                        >
                          🖨️ Print Statement
                        </button>

                        {!isOwner && (
                          <button
                            type="button"
                            onClick={() => openAddModal()}
                            style={{
                              padding: "8px 16px",
                              borderRadius: "8px",
                              border: "none",
                              background: "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)",
                              color: "#fff",
                              fontWeight: 700,
                              fontSize: "12px",
                              cursor: "pointer",
                              boxShadow: "0 4px 14px rgba(124, 58, 237, 0.35)",
                            }}
                          >
                            + Add Bill for {selectedVendorData.name}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Vendor Account Detailed Ledger */}
                  <div
                    style={{
                      background: "#ffffff",
                      borderRadius: "14px",
                      border: "1px solid #ebe4f5",
                      overflow: "hidden",
                      boxShadow: "0 2px 10px rgba(124, 58, 237, 0.03)",
                    }}
                  >
                    <div style={{ overflowX: "auto" }}>
                      <table className="ledger-table" style={{ width: "100%", minWidth: "850px", borderCollapse: "collapse", fontSize: "13px", textAlign: "left" }}>
                        <thead>
                          <tr style={{ background: "linear-gradient(180deg, #fbf9fe 0%, #f4effa 100%)", borderBottom: "2px solid #ece4f5", color: "#542b80", fontWeight: 700 }}>
                            <th style={{ padding: "14px 18px" }}>Date</th>
                            <th style={{ padding: "14px 18px" }}>Bill / Invoice #</th>
                            <th style={{ padding: "14px 18px" }}>Item / Description</th>
                            <th style={{ padding: "14px 18px" }}>Category</th>
                            <th style={{ padding: "14px 18px" }}>Payment Mode</th>
                            <th style={{ padding: "14px 18px" }}>Linked Event</th>
                            <th style={{ padding: "14px 18px", textAlign: "right" }}>Bill Amount (₹)</th>
                            <th style={{ padding: "14px 18px", textAlign: "right", background: "rgba(124, 58, 237, 0.05)", color: "#6d28d9" }}>
                              Cumulative Spend (₹)
                            </th>
                            <th className="no-print" style={{ padding: "14px 18px", textAlign: "center" }}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedVendorData.entries.map((entry) => (
                            <tr key={entry.id} style={{ borderBottom: "1px solid #f2eff7" }}>
                              <td style={{ padding: "14px 18px", fontWeight: 600, color: "#24103f", whiteSpace: "nowrap" }}>
                                {formatDate(entry.expense_date)}
                              </td>
                              <td style={{ padding: "14px 18px", fontFamily: "monospace", color: "#6b5b7e" }}>
                                {entry.bill_number ? `#${entry.bill_number}` : <span style={{ color: "#9ca3af" }}>-</span>}
                              </td>
                              <td style={{ padding: "14px 18px" }}>
                                <div style={{ fontWeight: 700, color: "#1e0836" }}>{entry.title}</div>
                                {entry.note && <div style={{ fontSize: "11px", color: "#7a6e8a", marginTop: "2px" }}>{entry.note}</div>}
                              </td>
                              <td style={{ padding: "14px 18px" }}>
                                <span style={{ padding: "2px 6px", borderRadius: "4px", background: "#f0edf5", fontSize: "11px", fontWeight: 600, color: "#48365f" }}>
                                  {entry.category}
                                </span>
                              </td>
                              <td style={{ padding: "14px 18px" }}>
                                <span style={{ fontSize: "12px", color: "#4b5563" }}>
                                  {entry.payment_method || "Cash"}
                                </span>
                              </td>
                              <td style={{ padding: "14px 18px" }}>
                                {entry.event_id ? (
                                  <Link href={`/events/${entry.event_id}`} style={{ color: "#4f46e5", fontWeight: 700, textDecoration: "none" }}>
                                    Event #{entry.event_id}
                                  </Link>
                                ) : (
                                  <span style={{ color: "#8a7b9b", fontSize: "12px" }}>General Overhead</span>
                                )}
                              </td>
                              <td style={{ padding: "14px 18px", textAlign: "right", fontWeight: 800, color: "#b91c1c", fontSize: "14px" }}>
                                - ₹{formatMoney(entry.amount)}
                              </td>
                              <td style={{ padding: "14px 18px", textAlign: "right", fontWeight: 800, color: "#4c1d95", fontSize: "14px", background: "rgba(124, 58, 237, 0.03)" }}>
                                ₹{formatMoney(entry.runningBalance)}
                              </td>
                              <td className="no-print" style={{ padding: "14px 18px", textAlign: "center" }}>
                                {!isOwner && (
                                  <div style={{ display: "flex", justifyContent: "center", gap: "6px" }}>
                                    <button
                                      type="button"
                                      onClick={() => openEditModal(entry)}
                                      style={{ padding: "4px 8px", borderRadius: "4px", background: "#f0edf5", color: "#24103f", border: "none", fontSize: "12px", cursor: "pointer" }}
                                    >
                                      Edit
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteExpense(entry.id, entry.title)}
                                      style={{ padding: "4px 8px", borderRadius: "4px", background: "#fee2e2", color: "#b91c1c", border: "none", fontSize: "12px", cursor: "pointer" }}
                                    >
                                      Delete
                                    </button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr style={{ background: "#fdfcfe", borderTop: "2px solid #ddd6fe", fontWeight: 800, color: "#1e0836" }}>
                            <td colSpan={6} style={{ padding: "14px 18px" }}>
                              Total Account Settlement • {selectedVendorData.billCount} Invoices
                            </td>
                            <td style={{ padding: "14px 18px", textAlign: "right", color: "#b91c1c", fontSize: "15px" }}>
                              - ₹{formatMoney(selectedVendorData.totalAmount)}
                            </td>
                            <td style={{ padding: "14px 18px", textAlign: "right", color: "#6d28d9", fontSize: "15px", background: "rgba(124, 58, 237, 0.08)" }}>
                              ₹{formatMoney(selectedVendorData.totalAmount)}
                            </td>
                            <td className="no-print" />
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                </div>
              ) : (
                /* All Vendors Overview Table & Cards */
                <div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                      gap: "18px",
                      marginBottom: "24px",
                    }}
                  >
                    {vendorLedgers.map((v) => {
                      const topCat = Object.entries(v.categories).sort((a, b) => b[1] - a[1])[0]?.[0] || "Miscellaneous";
                      return (
                        <div
                          key={v.name}
                          style={{
                            background: "#ffffff",
                            borderRadius: "14px",
                            border: "1px solid #ebe4f5",
                            padding: "20px",
                            boxShadow: "0 2px 10px rgba(124, 58, 237, 0.04)",
                            display: "flex",
                            flexDirection: "column",
                            justifyContent: "space-between",
                            gap: "14px",
                          }}
                        >
                          <div>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <div
                                  style={{
                                    width: "36px",
                                    height: "36px",
                                    borderRadius: "10px",
                                    background: "#f3edf8",
                                    color: "#6d28d9",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    fontWeight: 800,
                                    fontSize: "14px",
                                  }}
                                >
                                  {v.name.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "#1e0836" }}>
                                    {v.name}
                                  </h3>
                                  <span style={{ fontSize: "11px", color: "#7a6e8a" }}>
                                    {v.billCount} bills logged
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div style={{ marginTop: "12px", display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                              <span style={{ fontSize: "12px", color: "#6d5b83" }}>Total Purchases:</span>
                              <span style={{ fontSize: "18px", fontWeight: 800, color: "#b91c1c" }}>
                                ₹{formatMoney(v.totalAmount)}
                              </span>
                            </div>

                            <div style={{ marginTop: "6px", fontSize: "12px", color: "#6d5b83", display: "flex", justifyContent: "space-between" }}>
                              <span>Primary Supply:</span>
                              <span style={{ fontWeight: 600, color: "#4c1d95" }}>{topCat}</span>
                            </div>
                            <div style={{ marginTop: "4px", fontSize: "12px", color: "#8a7b9b", display: "flex", justifyContent: "space-between" }}>
                              <span>Last Transaction:</span>
                              <span>{formatDate(v.lastDate)}</span>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => setSelectedVendor(v.name)}
                            style={{
                              width: "100%",
                              padding: "8px 12px",
                              borderRadius: "8px",
                              border: "1px solid #ddd6fe",
                              background: "#fcfaff",
                              color: "#6d28d9",
                              fontWeight: 700,
                              fontSize: "12px",
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: "6px",
                            }}
                          >
                            View Account Statement Ledger →
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 3: MONTHLY & CATEGORY AUDIT LEDGER */}
          {/* ======================================================== */}
          {activeTab === "audit" && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(440px, 1fr))", gap: "24px" }}>
              {/* Monthly Ledger Table */}
              <div
                style={{
                  background: "#ffffff",
                  borderRadius: "14px",
                  border: "1px solid #ebe4f5",
                  overflow: "hidden",
                  boxShadow: "0 2px 10px rgba(124, 58, 237, 0.03)",
                }}
              >
                <div style={{ padding: "16px 20px", borderBottom: "1px solid #ebe4f5", background: "#fcfaff" }}>
                  <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "#1e0836" }}>
                    📅 Monthly Outflows Audit Ledger
                  </h3>
                  <span style={{ fontSize: "12px", color: "#8a7b9b" }}>
                    Month-by-month financial ledger breakdown
                  </span>
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", textAlign: "left" }}>
                    <thead>
                      <tr style={{ background: "#f8f5fc", borderBottom: "1px solid #ebe4f5", color: "#542b80", fontWeight: 700 }}>
                        <th style={{ padding: "12px 16px" }}>Month</th>
                        <th style={{ padding: "12px 16px", textAlign: "right" }}>Event Costs (₹)</th>
                        <th style={{ padding: "12px 16px", textAlign: "right" }}>Overhead (₹)</th>
                        <th style={{ padding: "12px 16px", textAlign: "right" }}>Total Outflows (₹)</th>
                        <th style={{ padding: "12px 16px", textAlign: "center" }}>Bills</th>
                      </tr>
                    </thead>
                    <tbody>
                      {monthlyLedger.map((m) => (
                        <tr key={m.monthKey} style={{ borderBottom: "1px solid #f2eff7" }}>
                          <td style={{ padding: "12px 16px", fontWeight: 700, color: "#1e0836" }}>
                            {formatMonthYear(m.monthKey)}
                          </td>
                          <td style={{ padding: "12px 16px", textAlign: "right", color: "#0369a1", fontWeight: 600 }}>
                            ₹{formatMoney(m.eventAllocated)}
                          </td>
                          <td style={{ padding: "12px 16px", textAlign: "right", color: "#6b5b7e" }}>
                            ₹{formatMoney(m.overhead)}
                          </td>
                          <td style={{ padding: "12px 16px", textAlign: "right", color: "#b91c1c", fontWeight: 800 }}>
                            ₹{formatMoney(m.total)}
                          </td>
                          <td style={{ padding: "12px 16px", textAlign: "center" }}>
                            <span style={{ padding: "2px 8px", borderRadius: "10px", background: "#f5f3ff", color: "#6d28d9", fontWeight: 700, fontSize: "11px" }}>
                              {m.count}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Category Breakdown Ledger Table */}
              <div
                style={{
                  background: "#ffffff",
                  borderRadius: "14px",
                  border: "1px solid #ebe4f5",
                  overflow: "hidden",
                  boxShadow: "0 2px 10px rgba(124, 58, 237, 0.03)",
                }}
              >
                <div style={{ padding: "16px 20px", borderBottom: "1px solid #ebe4f5", background: "#fcfaff" }}>
                  <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "#1e0836" }}>
                    🏷️ Category-wise Outflow Ledger
                  </h3>
                  <span style={{ fontSize: "12px", color: "#8a7b9b" }}>
                    Expense distribution and share of total expenditures
                  </span>
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", textAlign: "left" }}>
                    <thead>
                      <tr style={{ background: "#f8f5fc", borderBottom: "1px solid #ebe4f5", color: "#542b80", fontWeight: 700 }}>
                        <th style={{ padding: "12px 16px" }}>Category</th>
                        <th style={{ padding: "12px 16px", textAlign: "right" }}>Total (₹)</th>
                        <th style={{ padding: "12px 16px" }}>Share %</th>
                        <th style={{ padding: "12px 16px" }}>Top Vendor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {categoryLedger.map((c) => (
                        <tr key={c.category} style={{ borderBottom: "1px solid #f2eff7" }}>
                          <td style={{ padding: "12px 16px", fontWeight: 700, color: "#1e0836" }}>
                            {c.category}
                          </td>
                          <td style={{ padding: "12px 16px", textAlign: "right", color: "#b91c1c", fontWeight: 800 }}>
                            ₹{formatMoney(c.total)}
                          </td>
                          <td style={{ padding: "12px 16px", minWidth: "120px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                              <div style={{ flex: 1, background: "#f0edf5", height: "6px", borderRadius: "3px", overflow: "hidden" }}>
                                <div style={{ width: `${Math.min(100, c.percentage)}%`, height: "100%", background: "#7c3aed" }} />
                              </div>
                              <span style={{ fontSize: "11px", fontWeight: 700, color: "#6d28d9", width: "38px" }}>
                                {c.percentage.toFixed(1)}%
                              </span>
                            </div>
                          </td>
                          <td style={{ padding: "12px 16px", color: "#4b5563", fontSize: "12px" }}>
                            {c.topVendor}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ======================================================== */}
      {/* ADD / EDIT EXPENSE MODAL */}
      {/* ======================================================== */}
      {modalOpen && (
        <div
          className="no-print"
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
              maxWidth: "560px",
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
                <h3 style={{ margin: 0, fontSize: "17px", fontWeight: 700 }}>
                  {editingExpenseId ? "Edit Expense Ledger Voucher" : "Record New Outflow Voucher"}
                </h3>
                <span style={{ fontSize: "12px", color: "#c084fc" }}>
                  Debit Outflow Accounting Entry
                </span>
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
            <form onSubmit={handleSaveExpense} style={{ padding: "24px" }}>
              {/* Title / Description */}
              <div style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#3c2e4e", marginBottom: "6px" }}>
                  Expense Title / Item Description *
                </label>
                <input
                  type="text"
                  placeholder="e.g. 50kg Basmati Rice & Biryani Spices, Flower Mandap Rentals"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
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

              {/* Category & Amount row */}
              <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "14px", marginBottom: "16px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#3c2e4e", marginBottom: "6px" }}>
                    Category *
                  </label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    required
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: "8px",
                      border: "1px solid #d8d3e2",
                      fontSize: "13px",
                      background: "#fff",
                    }}
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#3c2e4e", marginBottom: "6px" }}>
                    Debit Amount (₹) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    placeholder="e.g. 8500"
                    value={formAmount}
                    onChange={(e) => setFormAmount(e.target.value)}
                    required
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: "8px",
                      border: "1px solid #d8d3e2",
                      fontSize: "14px",
                      fontWeight: 700,
                      color: "#b91c1c",
                      background: "#fff",
                    }}
                  />
                </div>
              </div>

              {/* Date & Payment Method row */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginBottom: "16px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#3c2e4e", marginBottom: "6px" }}>
                    Expense Date *
                  </label>
                  <input
                    type="date"
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
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

                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#3c2e4e", marginBottom: "6px" }}>
                    Payment Method
                  </label>
                  <select
                    value={formPaymentMethod}
                    onChange={(e) => setFormPaymentMethod(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: "8px",
                      border: "1px solid #d8d3e2",
                      fontSize: "13px",
                      background: "#fff",
                    }}
                  >
                    {PAYMENT_METHODS.map((pm) => (
                      <option key={pm} value={pm}>
                        {pm}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Vendor & Bill Number row */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginBottom: "16px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#3c2e4e", marginBottom: "6px" }}>
                    Vendor / Merchant (Optional)
                  </label>
                  <input
                    type="text"
                    list="vendors-datalist"
                    placeholder="e.g. Metro Cash & Carry, Local Mart"
                    value={formVendor}
                    onChange={(e) => setFormVendor(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: "8px",
                      border: "1px solid #d8d3e2",
                      fontSize: "13px",
                      background: "#fff",
                    }}
                  />
                  <datalist id="vendors-datalist">
                    {knownVendors.map((v) => (
                      <option key={v} value={v} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#3c2e4e", marginBottom: "6px" }}>
                    Bill / Voucher # (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. INV-9842"
                    value={formBillNumber}
                    onChange={(e) => setFormBillNumber(e.target.value)}
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

              {/* Link to Event */}
              <div style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#3c2e4e", marginBottom: "6px" }}>
                  Link to Event (Optional)
                </label>
                <select
                  value={formEventId}
                  onChange={(e) => setFormEventId(e.target.value ? Number(e.target.value) : "")}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: "1px solid #d8d3e2",
                    fontSize: "13px",
                    background: "#faf9fc",
                  }}
                >
                  <option value="">-- None (General Kitchen / Business Overhead) --</option>
                  {events.map((ev) => (
                    <option key={ev.id} value={ev.id}>
                      Event #{ev.id} - {ev.customer_name} ({ev.event_type}, {formatDate(ev.date)})
                    </option>
                  ))}
                </select>
              </div>

              {/* Notes */}
              <div style={{ marginBottom: "24px" }}>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#3c2e4e", marginBottom: "6px" }}>
                  Notes / Particulars (Optional)
                </label>
                <input
                  type="text"
                  placeholder="Additional remarks, delivery notes..."
                  value={formNote}
                  onChange={(e) => setFormNote(e.target.value)}
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
                  {submitting ? "Saving..." : editingExpenseId ? "Update Voucher" : "Post to Ledger"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PRINT-SPECIFIC CSS STYLES */}
      <style jsx global>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 12mm;
          }
          body {
            background: #ffffff !important;
            color: #000000 !important;
          }
          .sidebar,
          .topbar,
          .mobile-backdrop,
          .no-print,
          button,
          .search-box {
            display: none !important;
          }
          .main-content {
            margin-left: 0 !important;
            padding: 0 !important;
            width: 100% !important;
          }
          .print-only {
            display: block !important;
          }
          .ledger-table {
            width: 100% !important;
            border: 1px solid #333 !important;
            border-collapse: collapse !important;
          }
          .ledger-table th,
          .ledger-table td {
            border: 1px solid #ddd !important;
            padding: 6px 8px !important;
            font-size: 11px !important;
          }
          .ledger-table th {
            background: #f0f0f0 !important;
            color: #000 !important;
          }
        }
      `}</style>
    </main>
  );
}