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

export default function ExpensesPage() {
  const router = useRouter();
  const { user, isOwner, isManager } = useAuth();

  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [events, setEvents] = useState<EventOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [eventFilter, setEventFilter] = useState("All");

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

  // Financial Metrics
  const metrics = useMemo(() => {
    let totalExpense = 0;
    let mtdExpense = 0;
    let eventSpecific = 0;
    let overhead = 0;
    const categoryTotals: Record<string, number> = {};

    const currentYearMonth = new Date().toISOString().slice(0, 7);

    expenses.forEach((e) => {
      const amt = e.amount || 0;
      totalExpense += amt;

      if (e.expense_date && e.expense_date.startsWith(currentYearMonth)) {
        mtdExpense += amt;
      }

      if (e.event_id) {
        eventSpecific += amt;
      } else {
        overhead += amt;
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
      topCat,
      topCatAmt,
    };
  }, [expenses]);

  // Filtered Expenses
  const filteredExpenses = useMemo(() => {
    return expenses.filter((e) => {
      const matchSearch =
        !searchQuery.trim() ||
        (e.title && e.title.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (e.vendor && e.vendor.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (e.bill_number && e.bill_number.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (e.note && e.note.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (e.category && e.category.toLowerCase().includes(searchQuery.toLowerCase())) ||
        String(e.id).includes(searchQuery.trim()) ||
        (e.event_id && String(e.event_id).includes(searchQuery.trim()));

      const matchCategory = categoryFilter === "All" || e.category === categoryFilter;

      let matchEvent = true;
      if (eventFilter === "Overhead") {
        matchEvent = !e.event_id;
      } else if (eventFilter !== "All") {
        matchEvent = e.event_id === Number(eventFilter);
      }

      return matchSearch && matchCategory && matchEvent;
    });
  }, [expenses, searchQuery, categoryFilter, eventFilter]);

  // Open Add Modal
  const openAddModal = (presetEventId?: number) => {
    setEditingExpenseId(null);
    setFormTitle("");
    setFormCategory(CATEGORIES[0]);
    setFormAmount("");
    setFormDate(new Date().toISOString().slice(0, 10));
    setFormEventId(presetEventId ?? "");
    setFormPaymentMethod(PAYMENT_METHODS[0]);
    setFormVendor("");
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
          ? `Expense updated successfully.`
          : `Recorded expense of ₹${formatMoney(amt)} (${title})`
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
    if (!window.confirm(`Are you sure you want to delete expense record "${title}"?`)) {
      return;
    }
    try {
      const res = await fetchWithAuth(`${API_URL}/expenses/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete expense");
      setSuccessMsg(`Expense deleted successfully.`);
      await loadData();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      alert(err.message || "Unable to delete expense");
    }
  };

  return (
    <main className="dashboard">
      <AppSidebar activeRoute="/expenses" />

      {/* Main Content */}
      <div className="main-content">
        {/* Topbar */}
        <header className="topbar">
          <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0 }}>
            <MobileMenuButton />
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                <h1 style={{ margin: 0, fontSize: "19px", fontWeight: 700, color: "#1e0836", lineHeight: 1.2 }}>
                  Expense Tracker & Outflows
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
                  {expenses.length} Records
                </span>
              </div>
              <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#8a7b9b" }}>
                Track vendor bills, operational overheads, and event-allocated expenditures
              </p>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", justifyContent: "flex-end" }}>
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
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "18px",
              marginBottom: "24px",
            }}
          >
            {/* Total Expenses */}
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
                Total Outflows
              </div>
              <div style={{ fontSize: "26px", fontWeight: 800, color: "#991b1b", marginTop: "8px" }}>
                ₹{formatMoney(metrics.totalExpense)}
              </div>
              <div style={{ fontSize: "12px", color: "#b91c1c", marginTop: "6px" }}>
                Cumulative recorded expenditures
              </div>
            </div>

            {/* This Month */}
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
              <div style={{ fontSize: "12px", color: "#7a6e8a", fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase" }}>
                Current Month (MTD)
              </div>
              <div style={{ fontSize: "26px", fontWeight: 800, color: "#1e0836", marginTop: "8px" }}>
                ₹{formatMoney(metrics.mtdExpense)}
              </div>
              <div style={{ fontSize: "12px", color: "#8a7b9b", marginTop: "6px" }}>
                Disbursed this calendar month
              </div>
            </div>

            {/* Event Specific vs Overhead */}
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
                Cost Allocation
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

            {/* Top Category */}
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
                  background: "linear-gradient(90deg, #d97706 0%, #fbbf24 100%)",
                }}
              />
              <div style={{ fontSize: "12px", color: "#b45309", fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase" }}>
                Top Expense Category
              </div>
              <div
                style={{
                  fontSize: "20px",
                  fontWeight: 800,
                  color: "#7c3aed",
                  marginTop: "8px",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
                title={metrics.topCat}
              >
                {metrics.topCat}
              </div>
              <div style={{ fontSize: "12px", color: "#b45309", marginTop: "6px" }}>
                ₹{formatMoney(metrics.topCatAmt)} total outflow
              </div>
            </div>
          </div>

          {/* Filter Bar */}
          <div
            style={{
              background: "#ffffff",
              border: "1px solid #ebe4f5",
              borderRadius: "14px",
              padding: "14px 18px",
              boxShadow: "0 2px 8px rgba(124, 58, 237, 0.03)",
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "14px",
              marginBottom: "22px",
            }}
          >
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "12px" }}>
              {/* Category Filter */}
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "12px", color: "#6d5b83", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.4px" }}>
                  Category:
                </span>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  style={{
                    height: "36px",
                    padding: "0 12px",
                    borderRadius: "8px",
                    border: "1px solid #e2d9ec",
                    background: "#fcfaff",
                    fontSize: "13px",
                    color: "#1e0836",
                    fontWeight: 500,
                    cursor: "pointer",
                    outline: "none",
                  }}
                >
                  <option value="All">All Categories ({CATEGORIES.length})</option>
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              {/* Event Filter */}
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "12px", color: "#6d5b83", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.4px" }}>
                  Allocation:
                </span>
                <select
                  value={eventFilter}
                  onChange={(e) => setEventFilter(e.target.value)}
                  style={{
                    height: "36px",
                    padding: "0 12px",
                    borderRadius: "8px",
                    border: "1px solid #e2d9ec",
                    background: "#fcfaff",
                    fontSize: "13px",
                    color: "#1e0836",
                    fontWeight: 500,
                    cursor: "pointer",
                    outline: "none",
                    maxWidth: "240px",
                  }}
                >
                  <option value="All">All Expenses</option>
                  <option value="Overhead">General Overhead Only</option>
                  {events.map((ev) => (
                    <option key={ev.id} value={ev.id}>
                      Event #{ev.id} - {ev.customer_name}
                    </option>
                  ))}
                </select>
              </div>

              {(categoryFilter !== "All" || eventFilter !== "All" || searchQuery) && (
                <button
                  type="button"
                  onClick={() => {
                    setCategoryFilter("All");
                    setEventFilter("All");
                    setSearchQuery("");
                  }}
                  style={{
                    height: "36px",
                    padding: "0 12px",
                    borderRadius: "8px",
                    border: "1px solid #fecaca",
                    background: "#fff5f5",
                    color: "#b91c1c",
                    fontSize: "12px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  ✕ Clear Filters
                </button>
              )}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "12px", color: "#8a7b9b" }}>Showing:</span>
              <span
                style={{
                  fontSize: "12px",
                  fontWeight: 700,
                  color: "#6d28d9",
                  background: "#f5f3ff",
                  border: "1px solid #ddd6fe",
                  padding: "4px 10px",
                  borderRadius: "12px",
                }}
              >
                {filteredExpenses.length} of {expenses.length} records
              </span>
            </div>
          </div>

          {/* Expenses Table */}
          <div style={{ background: "#ffffff", borderRadius: "14px", border: "1px solid #ebe4f5", overflow: "hidden", boxShadow: "0 2px 10px rgba(124, 58, 237, 0.03)" }}>
            {loading ? (
              <div style={{ padding: "48px", textAlign: "center", color: "#7a6e8a" }}>Loading expenses ledger...</div>
            ) : filteredExpenses.length === 0 ? (
              <div style={{ padding: "50px 20px", textAlign: "center" }}>
                <div style={{ fontSize: "36px", marginBottom: "12px" }}>💳</div>
                <h3 style={{ margin: "0 0 6px 0", color: "#1e0836" }}>No expenses found</h3>
                <p style={{ color: "#7a6e8a", fontSize: "14px", margin: "0 0 16px 0" }}>
                  {searchQuery || categoryFilter !== "All" || eventFilter !== "All"
                    ? "Try adjusting your filters or search keywords."
                    : "Start logging purchases, vendor bills, and operational expenses."}
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
                    + Add First Expense
                  </button>
                )}
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", minWidth: "750px", borderCollapse: "collapse", fontSize: "13px", textAlign: "left" }}>
                  <thead>
                    <tr style={{ background: "linear-gradient(180deg, #fbf9fe 0%, #f4effa 100%)", borderBottom: "1px solid #ece4f5", color: "#542b80", fontWeight: 700 }}>
                      <th style={{ padding: "14px 18px" }}>Date</th>
                      <th style={{ padding: "14px 18px" }}>Expense Title</th>
                      <th style={{ padding: "14px 18px" }}>Category</th>
                      <th style={{ padding: "14px 18px" }}>Vendor / Supplier</th>
                      <th style={{ padding: "14px 18px" }}>Bill / Ref #</th>
                      <th style={{ padding: "14px 18px" }}>Linked Event</th>
                      <th style={{ padding: "14px 18px" }}>Method</th>
                      <th style={{ padding: "14px 18px", textAlign: "right" }}>Amount</th>
                      <th style={{ padding: "14px 18px", textAlign: "center" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredExpenses.map((exp) => (
                      <tr
                        key={exp.id}
                        style={{
                          borderBottom: "1px solid #f2eff7",
                          transition: "background 0.15s ease",
                        }}
                      >
                        <td style={{ padding: "14px 18px", fontWeight: 600, color: "#24103f", whiteSpace: "nowrap" }}>
                          {formatDate(exp.expense_date)}
                        </td>
                        <td style={{ padding: "14px 18px" }}>
                          <div style={{ fontWeight: 700, color: "#24103f" }}>{exp.title}</div>
                          {exp.note && (
                            <div style={{ fontSize: "11px", color: "#7a6e8a", marginTop: "2px", maxWidth: "240px" }}>
                              {exp.note}
                            </div>
                          )}
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
                            {exp.category}
                          </span>
                        </td>
                        <td style={{ padding: "14px 18px", color: "#3c2e4e" }}>
                          {exp.vendor || <span style={{ color: "#a59cb3" }}>-</span>}
                        </td>
                        <td style={{ padding: "14px 18px", color: "#6b5b7e", fontFamily: "monospace" }}>
                          {exp.bill_number ? `#${exp.bill_number}` : <span style={{ color: "#a59cb3" }}>-</span>}
                        </td>
                        <td style={{ padding: "14px 18px" }}>
                          {exp.event_id ? (
                            <Link
                              href={`/events/${exp.event_id}`}
                              style={{
                                color: "#4f46e5",
                                fontWeight: 600,
                                textDecoration: "none",
                              }}
                            >
                              Event #{exp.event_id}
                              {exp.event_type ? ` (${exp.event_type})` : ""}
                            </Link>
                          ) : (
                            <span style={{ color: "#8a7b9b", fontSize: "12px", background: "#f8f7fb", padding: "2px 6px", borderRadius: "4px" }}>
                              General Overhead
                            </span>
                          )}
                        </td>
                        <td style={{ padding: "14px 18px" }}>
                          <span style={{ fontSize: "12px", color: "#5d4e70" }}>
                            {exp.payment_method || "Cash"}
                          </span>
                        </td>
                        <td style={{ padding: "14px 18px", textAlign: "right", fontWeight: 800, color: "#b91c1c", fontSize: "14px", whiteSpace: "nowrap" }}>
                          - ₹{formatMoney(exp.amount)}
                        </td>
                        <td style={{ padding: "14px 18px", textAlign: "center", whiteSpace: "nowrap" }}>
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
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ADD / EDIT EXPENSE MODAL */}
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
                  {editingExpenseId ? "Edit Expense Entry" : "Record New Expense"}
                </h3>
                <span style={{ fontSize: "12px", color: "#c084fc" }}>
                  Debit Outflow Ledger
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
                    Amount (₹) *
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
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#3c2e4e", marginBottom: "6px" }}>
                    Bill / Receipt # (Optional)
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
                  {submitting ? "Saving..." : editingExpenseId ? "Update Expense" : "Add Expense"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
