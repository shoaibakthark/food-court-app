"use client";

import React, { useState, useEffect, useMemo, useCallback, FormEvent } from "react";
import Link from "next/link";
import { useAuth, fetchWithAuth } from "../lib/auth";

const API_URL = typeof window !== "undefined" ? "/api/py" : "http://127.0.0.1:8000";

// --- TYPES ---
export type ExpenseRecord = {
  id: number;
  title: string;
  category: string;
  amount: number;
  expense_date: string;
  payment_method: string;
  vendor?: string | null;
  bill_number?: string | null;
  note?: string | null;
  event_id?: number | null;
  event_type?: string | null;
  event_place?: string | null;
};

export type ExpenseSettlementRecord = {
  id: number;
  vendor: string;
  amount: number;
  settlement_date: string;
  payment_mode: string;
  reference_no?: string | null;
  note?: string | null;
};

export type EventOption = {
  id: number;
  date: string;
  customer_name: string;
  event_type: string;
  place: string;
};

export type VendorAccount = {
  name: string;
  totalBilled: number;
  totalCredit: number;
  totalDirectPaid: number;
  totalCleared: number;
  pendingBalance: number;
  billCount: number;
  lastDate: string;
  expenses: ExpenseRecord[];
  settlements: ExpenseSettlementRecord[];
};

// --- CONSTANTS ---
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

const QUICK_SUGGESTIONS = [
  { title: "Vegetables & Greens", cat: "Vegetables & Fruits" },
  { title: "Rice 25kg Bag", cat: "Raw Materials & Groceries" },
  { title: "Cooking Oil (15L Tin)", cat: "Raw Materials & Groceries" },
  { title: "Gas Cylinder Refill", cat: "Gas & Utilities" },
  { title: "Milk & Dairy Supplies", cat: "Dairy & Bakery" },
  { title: "Staff Refreshments / Tea", cat: "Staff Refreshments" },
  { title: "Kitchen Spices & Masala", cat: "Raw Materials & Groceries" },
  { title: "Meat / Chicken 10kg", cat: "Meat & Seafood" },
];

const DIRECT_PAYMENT_METHODS = [
  "Cash",
  "UPI / GPay / PhonePe",
  "Bank Transfer / NEFT",
  "Company Card",
  "Cheque",
];

const CLEARANCE_PAYMENT_METHODS = [
  "UPI / GPay / PhonePe",
  "Cash",
  "Bank Transfer / NEFT",
  "Cheque",
];

function formatMoney(amount: number | null | undefined): string {
  return Number(amount ?? 0).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  });
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "-";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr.slice(0, 10);
    return d.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateStr.slice(0, 10);
  }
}

function isCreditExpense(method: string | null | undefined): boolean {
  if (!method) return false;
  const m = method.toLowerCase();
  return m.includes("credit") || m.includes("account") || m.includes("due") || m.includes("payable");
}

export default function ExpensesPage() {
  const { isOwner } = useAuth();

  // --- DATA STATES ---
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [settlements, setSettlements] = useState<ExpenseSettlementRecord[]>([]);
  const [events, setEvents] = useState<EventOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // --- NAVIGATION TAB ---
  // Simple 2-tab navigation: Expenses Entry & List vs Supplier Settle & Khata
  const [activeTab, setActiveTab] = useState<"expenses" | "settle">("expenses");

  // --- EXPENSE LIST FILTERS ---
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState<"all" | "paid" | "credit">("all");
  const [dateRangeFilter, setDateRangeFilter] = useState<"this_month" | "all" | "today">("this_month");

  // --- MODAL: ADD / EDIT EXPENSE ---
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState<number | null>(null);
  const [formTitle, setFormTitle] = useState("");
  const [formCategory, setFormCategory] = useState(CATEGORIES[0]);
  const [formAmount, setFormAmount] = useState("");
  const [formPaymentType, setFormPaymentType] = useState<"direct" | "credit">("direct");
  const [formDirectMethod, setFormDirectMethod] = useState("Cash");
  const [formVendor, setFormVendor] = useState("");
  const [formDate, setFormDate] = useState(new Date().toISOString().slice(0, 10));
  const [formBillNumber, setFormBillNumber] = useState("");
  const [formNote, setFormNote] = useState("");
  const [formEventId, setFormEventId] = useState<number | null>(null);
  const [submittingExpense, setSubmittingExpense] = useState(false);

  // --- MODAL: SETTLE SUPPLIER DUE ---
  const [settleModalOpen, setSettleModalOpen] = useState(false);
  const [settleVendor, setSettleVendor] = useState("");
  const [settleAmount, setSettleAmount] = useState("");
  const [settleMode, setSettleMode] = useState(CLEARANCE_PAYMENT_METHODS[0]);
  const [settleDate, setSettleDate] = useState(new Date().toISOString().slice(0, 10));
  const [settleRef, setSettleRef] = useState("");
  const [settleNote, setSettleNote] = useState("");
  const [submittingSettle, setSubmittingSettle] = useState(false);

  // --- VENDOR STATEMENT DRILL-DOWN ---
  const [statementVendor, setStatementVendor] = useState<string | null>(null);

  // --- LOAD DATA ---
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [expRes, settleRes, eventsRes] = await Promise.all([
        fetch(`${API_URL}/expenses`, { cache: "no-store" }),
        fetch(`${API_URL}/expenses/settlements`, { cache: "no-store" }).catch(() => null),
        fetch(`${API_URL}/events`, { cache: "no-store" }).catch(() => null),
      ]);

      if (expRes.ok) {
        const expData = await expRes.json();
        setExpenses(Array.isArray(expData) ? expData : []);
      } else {
        throw new Error("Failed to load expenses list");
      }

      if (settleRes && settleRes.ok) {
        const sData = await settleRes.json();
        setSettlements(Array.isArray(sData) ? sData : []);
      }

      if (eventsRes && eventsRes.ok) {
        const evData = await eventsRes.json();
        setEvents(Array.isArray(evData) ? evData : []);
      }
    } catch (err: any) {
      console.error("Load expenses error:", err);
      setError(err.message || "Failed to load financial data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // --- KNOWN VENDORS LIST ---
  const knownVendors = useMemo(() => {
    const set = new Set<string>();
    expenses.forEach((e) => {
      if (e.vendor && e.vendor.trim()) set.add(e.vendor.trim());
    });
    settlements.forEach((s) => {
      if (s.vendor && s.vendor.trim()) set.add(s.vendor.trim());
    });
    return Array.from(set).sort();
  }, [expenses, settlements]);

  // --- SUPPLIER ACCOUNTS & KHATA BALANCES ---
  const vendorAccounts = useMemo(() => {
    const map: Record<string, VendorAccount> = {};

    expenses.forEach((e) => {
      const vName = (e.vendor && e.vendor.trim()) || "Direct / Cash Outflows";
      if (!map[vName]) {
        map[vName] = {
          name: vName,
          totalBilled: 0,
          totalCredit: 0,
          totalDirectPaid: 0,
          totalCleared: 0,
          pendingBalance: 0,
          billCount: 0,
          lastDate: "",
          expenses: [],
          settlements: [],
        };
      }
      const acc = map[vName];
      const amt = Number(e.amount) || 0;
      acc.totalBilled += amt;
      acc.billCount += 1;

      if (isCreditExpense(e.payment_method)) {
        acc.totalCredit += amt;
      } else {
        acc.totalDirectPaid += amt;
      }

      const d = (e.expense_date || "").slice(0, 10);
      if (d > acc.lastDate) acc.lastDate = d;
      acc.expenses.push(e);
    });

    settlements.forEach((s) => {
      const vName = (s.vendor && s.vendor.trim()) || "Direct / Cash Outflows";
      if (!map[vName]) {
        map[vName] = {
          name: vName,
          totalBilled: 0,
          totalCredit: 0,
          totalDirectPaid: 0,
          totalCleared: 0,
          pendingBalance: 0,
          billCount: 0,
          lastDate: "",
          expenses: [],
          settlements: [],
        };
      }
      const acc = map[vName];
      const amt = Number(s.amount) || 0;
      acc.totalCleared += amt;

      const d = (s.settlement_date || "").slice(0, 10);
      if (d > acc.lastDate) acc.lastDate = d;
      acc.settlements.push(s);
    });

    // Compute pending balances
    Object.values(map).forEach((acc) => {
      acc.pendingBalance = Math.max(0, acc.totalCredit - acc.totalCleared);
    });

    return Object.values(map).sort((a, b) => b.pendingBalance - a.pendingBalance || a.name.localeCompare(b.name));
  }, [expenses, settlements]);

  // Suppliers with unpaid credit dues
  const dueVendors = useMemo(() => {
    return vendorAccounts.filter((v) => v.name !== "Direct / Cash Outflows" && v.pendingBalance > 0);
  }, [vendorAccounts]);

  // Total outstanding credit across all suppliers
  const totalOutstandingDue = useMemo(() => {
    return dueVendors.reduce((sum, v) => sum + v.pendingBalance, 0);
  }, [dueVendors]);

  // --- FIFO CLEARANCE MAPPING FOR INDIVIDUAL BILLS ---
  const billStatusMap = useMemo(() => {
    const map: Record<number, { isCredit: boolean; isSettled: boolean; dueAmount: number }> = {};
    const creditByVendor: Record<string, ExpenseRecord[]> = {};

    expenses.forEach((e) => {
      const isCred = isCreditExpense(e.payment_method);
      if (!isCred) {
        map[e.id] = { isCredit: false, isSettled: true, dueAmount: 0 };
      } else {
        const vKey = (e.vendor || "Direct / Cash Outflows").trim().toLowerCase();
        if (!creditByVendor[vKey]) creditByVendor[vKey] = [];
        creditByVendor[vKey].push(e);
      }
    });

    Object.entries(creditByVendor).forEach(([vKey, vExpenses]) => {
      const sorted = [...vExpenses].sort((a, b) => (a.expense_date || "").localeCompare(b.expense_date || ""));
      const totalCleared = settlements
        .filter((s) => (s.vendor || "").trim().toLowerCase() === vKey)
        .reduce((sum, s) => sum + (s.amount || 0), 0);

      let remainingClearance = totalCleared;
      sorted.forEach((exp) => {
        const amt = exp.amount || 0;
        if (remainingClearance >= amt) {
          map[exp.id] = { isCredit: true, isSettled: true, dueAmount: 0 };
          remainingClearance -= amt;
        } else if (remainingClearance > 0) {
          const due = amt - remainingClearance;
          map[exp.id] = { isCredit: true, isSettled: false, dueAmount: due };
          remainingClearance = 0;
        } else {
          map[exp.id] = { isCredit: true, isSettled: false, dueAmount: amt };
        }
      });
    });

    return map;
  }, [expenses, settlements]);

  // --- MONTHLY METRICS ---
  const currentMonthMetrics = useMemo(() => {
    const now = new Date();
    const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const todayStr = now.toISOString().slice(0, 10);

    let monthTotal = 0;
    let directPaid = 0;
    let creditIncurred = 0;

    expenses.forEach((e) => {
      const d = (e.expense_date || "").slice(0, 7);
      if (d === currentYearMonth) {
        const amt = Number(e.amount) || 0;
        monthTotal += amt;
        if (isCreditExpense(e.payment_method)) {
          creditIncurred += amt;
        } else {
          directPaid += amt;
        }
      }
    });

    return { monthTotal, directPaid, creditIncurred, todayStr, currentYearMonth };
  }, [expenses]);

  // --- FILTERED EXPENSES FOR TAB 1 ---
  const filteredExpenses = useMemo(() => {
    return expenses.filter((e) => {
      // Search
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim();
        const titleMatch = (e.title || "").toLowerCase().includes(q);
        const vendorMatch = (e.vendor || "").toLowerCase().includes(q);
        const billMatch = (e.bill_number || "").toLowerCase().includes(q);
        if (!titleMatch && !vendorMatch && !billMatch) return false;
      }

      // Category
      if (selectedCategory !== "all" && e.category !== selectedCategory) {
        return false;
      }

      // Payment Type
      const isCred = isCreditExpense(e.payment_method);
      if (paymentFilter === "paid" && isCred) return false;
      if (paymentFilter === "credit" && !isCred) return false;

      // Date Range
      const expDate = (e.expense_date || "").slice(0, 10);
      if (dateRangeFilter === "today") {
        if (expDate !== currentMonthMetrics.todayStr) return false;
      } else if (dateRangeFilter === "this_month") {
        if (!expDate.startsWith(currentMonthMetrics.currentYearMonth)) return false;
      }

      return true;
    });
  }, [expenses, searchTerm, selectedCategory, paymentFilter, dateRangeFilter, currentMonthMetrics]);

  // --- ACTIVE STATEMENT VENDOR DATA ---
  const activeStatementVendor = useMemo(() => {
    if (!statementVendor) return null;
    return vendorAccounts.find((v) => v.name.toLowerCase() === statementVendor.toLowerCase()) || null;
  }, [statementVendor, vendorAccounts]);

  // --- MODAL OPENERS ---
  const openNewExpenseModal = () => {
    setEditingExpenseId(null);
    setFormTitle("");
    setFormCategory(CATEGORIES[0]);
    setFormAmount("");
    setFormPaymentType("direct");
    setFormDirectMethod("Cash");
    setFormVendor("");
    setFormDate(new Date().toISOString().slice(0, 10));
    setFormBillNumber("");
    setFormNote("");
    setFormEventId(null);
    setExpenseModalOpen(true);
  };

  const openEditExpenseModal = (exp: ExpenseRecord) => {
    setEditingExpenseId(exp.id);
    setFormTitle(exp.title || "");
    setFormCategory(exp.category || CATEGORIES[0]);
    setFormAmount(String(exp.amount || ""));
    const isCred = isCreditExpense(exp.payment_method);
    setFormPaymentType(isCred ? "credit" : "direct");
    setFormDirectMethod(isCred ? "Cash" : exp.payment_method || "Cash");
    setFormVendor(exp.vendor || "");
    setFormDate(exp.expense_date ? exp.expense_date.slice(0, 10) : new Date().toISOString().slice(0, 10));
    setFormBillNumber(exp.bill_number || "");
    setFormNote(exp.note || "");
    setFormEventId(exp.event_id || null);
    setExpenseModalOpen(true);
  };

  const openSettleModal = (vendorName?: string, presetAmount?: number) => {
    let target = vendorName || (dueVendors[0]?.name || (knownVendors[0] || ""));
    const vendorData = vendorAccounts.find((v) => v.name.toLowerCase() === target.toLowerCase());

    let amtStr = "";
    if (presetAmount !== undefined && presetAmount > 0) {
      amtStr = String(presetAmount);
    } else if (vendorData && vendorData.pendingBalance > 0) {
      amtStr = String(vendorData.pendingBalance);
    }

    setSettleVendor(target);
    setSettleAmount(amtStr);
    setSettleMode(CLEARANCE_PAYMENT_METHODS[0]);
    setSettleDate(new Date().toISOString().slice(0, 10));
    setSettleRef("");
    setSettleNote(target ? `Credit balance settlement for ${target}` : "");
    setSettleModalOpen(true);
  };

  // --- ACTIONS: SAVE EXPENSE ---
  const handleSaveExpense = async (e: FormEvent) => {
    e.preventDefault();
    const title = formTitle.trim();
    if (!title) {
      alert("Please enter what was purchased.");
      return;
    }
    const amt = parseFloat(formAmount);
    if (!amt || isNaN(amt) || amt <= 0) {
      alert("Please enter a valid expense amount greater than 0.");
      return;
    }

    try {
      setSubmittingExpense(true);
      const finalPaymentMethod = formPaymentType === "credit" ? "Credit (On Account)" : formDirectMethod;

      const payload = {
        title,
        category: formCategory,
        amount: amt,
        expense_date: formDate,
        payment_method: finalPaymentMethod,
        vendor: formVendor.trim() || null,
        bill_number: formBillNumber.trim() || null,
        note: formNote.trim() || null,
        event_id: formEventId || null,
      };

      const url = editingExpenseId ? `${API_URL}/expenses/${editingExpenseId}` : `${API_URL}/expenses`;
      const method = editingExpenseId ? "PUT" : "POST";

      const res = await fetchWithAuth(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.detail || `Failed to save expense (${res.status})`);
      }

      setExpenseModalOpen(false);
      setSuccessMsg(
        editingExpenseId
          ? `✓ Expense updated successfully!`
          : `✓ New expense of ₹${formatMoney(amt)} recorded!`
      );
      await loadData();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      alert(err.message || "Failed to save expense");
    } finally {
      setSubmittingExpense(false);
    }
  };

  // --- ACTIONS: DELETE EXPENSE ---
  const handleDeleteExpense = async (id: number, title: string) => {
    if (!window.confirm(`Are you sure you want to delete "${title}" (#${id})?`)) return;
    try {
      const res = await fetchWithAuth(`${API_URL}/expenses/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete expense");
      setSuccessMsg(`✓ Expense #${id} deleted.`);
      await loadData();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      alert(err.message || "Unable to delete expense");
    }
  };

  // --- ACTIONS: SAVE SETTLEMENT ---
  const handleSaveSettlement = async (e: FormEvent) => {
    e.preventDefault();
    const vendor = settleVendor.trim();
    if (!vendor) {
      alert("Please select or enter the supplier / vendor name.");
      return;
    }
    const amt = parseFloat(settleAmount);
    if (!amt || isNaN(amt) || amt <= 0) {
      alert("Please enter a valid payment amount greater than 0.");
      return;
    }

    try {
      setSubmittingSettle(true);
      const payload = {
        vendor,
        amount: amt,
        settlement_date: settleDate,
        payment_mode: settleMode,
        reference_no: settleRef.trim() || null,
        note: settleNote.trim() || null,
      };

      const res = await fetchWithAuth(`${API_URL}/expenses/settlements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.detail || `Failed to record settlement (${res.status})`);
      }

      setSettleModalOpen(false);
      setSuccessMsg(`✓ Settlement of ₹${formatMoney(amt)} to ${vendor} recorded successfully!`);
      await loadData();
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (err: any) {
      alert(err.message || "Failed to record settlement");
    } finally {
      setSubmittingSettle(false);
    }
  };

  // --- ACTIONS: DELETE SETTLEMENT ---
  const handleDeleteSettlement = async (id: number, vendor: string, amt: number) => {
    if (!window.confirm(`Void settlement #${id} (₹${formatMoney(amt)} to ${vendor})? This will restore the supplier due.`)) {
      return;
    }
    try {
      const res = await fetchWithAuth(`${API_URL}/expenses/settlements/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to void settlement");
      setSuccessMsg(`✓ Settlement #${id} voided.`);
      await loadData();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      alert(err.message || "Unable to void settlement");
    }
  };

  // Active modal vendor info
  const activeSettleVendorData = useMemo(() => {
    if (!settleVendor || !settleVendor.trim()) return null;
    return vendorAccounts.find((v) => v.name.toLowerCase() === settleVendor.trim().toLowerCase()) || null;
  }, [settleVendor, vendorAccounts]);

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", color: "#0f172a", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      {/* SUCCESS TOAST */}
      {successMsg && (
        <div
          style={{
            position: "fixed",
            top: "20px",
            right: "20px",
            zIndex: 9999,
            background: "#10b981",
            color: "#ffffff",
            padding: "12px 20px",
            borderRadius: "10px",
            fontWeight: 700,
            fontSize: "14px",
            boxShadow: "0 10px 25px -5px rgba(16, 185, 129, 0.4)",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <span>✓</span> {successMsg}
        </div>
      )}

      {/* TOP APP HEADER */}
      <div
        className="no-print"
        style={{
          background: "#ffffff",
          borderBottom: "1px solid #e2e8f0",
          padding: "16px 28px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "16px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <Link
            href="/"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 12px",
              borderRadius: "8px",
              background: "#f1f5f9",
              color: "#475569",
              fontSize: "13px",
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            ← Dashboard
          </Link>
          <div>
            <h1 style={{ margin: 0, fontSize: "22px", fontWeight: 900, color: "#0f172a", display: "flex", alignItems: "center", gap: "8px" }}>
              <span>💰</span> Expense Entry & Supplier Settle
            </h1>
            <span style={{ fontSize: "13px", color: "#64748b" }}>
              Fast expense tracking, Khata credit ledger & one-click settlements
            </span>
          </div>
        </div>

        {/* PRIMARY ACTIONS: ADD EXPENSE & SETTLE SUPPLIER */}
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          {!isOwner && (
            <>
              <button
                type="button"
                onClick={openNewExpenseModal}
                style={{
                  background: "#2563eb",
                  color: "#ffffff",
                  border: "none",
                  padding: "10px 18px",
                  borderRadius: "8px",
                  fontWeight: 800,
                  fontSize: "14px",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  boxShadow: "0 2px 6px rgba(37, 99, 235, 0.3)",
                }}
              >
                <span>＋</span> Add Expense
              </button>

              <button
                type="button"
                onClick={() => openSettleModal()}
                style={{
                  background: "#059669",
                  color: "#ffffff",
                  border: "none",
                  padding: "10px 18px",
                  borderRadius: "8px",
                  fontWeight: 800,
                  fontSize: "14px",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  boxShadow: "0 2px 6px rgba(5, 150, 105, 0.3)",
                }}
              >
                <span>🤝</span> Settle Supplier Due
              </button>
            </>
          )}

          <button
            type="button"
            onClick={loadData}
            title="Refresh records"
            style={{
              padding: "10px 12px",
              borderRadius: "8px",
              border: "1px solid #cbd5e1",
              background: "#ffffff",
              color: "#475569",
              cursor: "pointer",
              fontSize: "14px",
            }}
          >
            🔄
          </button>
        </div>
      </div>

      <div style={{ maxWidth: "1400px", margin: "0 auto", padding: "24px 28px" }}>
        {/* SUMMARY STAT CARDS */}
        <div
          className="no-print"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: "16px",
            marginBottom: "24px",
          }}
        >
          {/* Card 1: Monthly Total */}
          <div style={{ background: "#ffffff", borderRadius: "12px", border: "1px solid #e2e8f0", padding: "18px 20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "12px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                This Month's Spend
              </span>
              <span style={{ fontSize: "20px" }}>📅</span>
            </div>
            <div style={{ fontSize: "26px", fontWeight: 900, color: "#0f172a", marginTop: "8px" }}>
              ₹{formatMoney(currentMonthMetrics.monthTotal)}
            </div>
            <div style={{ fontSize: "12px", color: "#64748b", marginTop: "4px" }}>
              Across {expenses.filter((e) => (e.expense_date || "").startsWith(currentMonthMetrics.currentYearMonth)).length} purchase entries
            </div>
          </div>

          {/* Card 2: Direct Paid */}
          <div style={{ background: "#ffffff", borderRadius: "12px", border: "1px solid #e2e8f0", padding: "18px 20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "12px", fontWeight: 700, color: "#059669", textTransform: "uppercase" }}>
                Paid Immediately (Cash / UPI)
              </span>
              <span style={{ fontSize: "20px" }}>💵</span>
            </div>
            <div style={{ fontSize: "26px", fontWeight: 900, color: "#059669", marginTop: "8px" }}>
              ₹{formatMoney(currentMonthMetrics.directPaid)}
            </div>
            <div style={{ fontSize: "12px", color: "#64748b", marginTop: "4px" }}>
              Direct out-of-pocket payments
            </div>
          </div>

          {/* Card 3: Outstanding Supplier Due (Khata) */}
          <div
            onClick={() => setActiveTab("settle")}
            style={{
              background: totalOutstandingDue > 0 ? "#fef2f2" : "#f0fdf4",
              borderRadius: "12px",
              border: totalOutstandingDue > 0 ? "1px solid #fecaca" : "1px solid #a7f3d0",
              padding: "18px 20px",
              cursor: "pointer",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "12px", fontWeight: 700, color: totalOutstandingDue > 0 ? "#dc2626" : "#059669", textTransform: "uppercase" }}>
                Total Supplier Dues (To Settle)
              </span>
              <span style={{ fontSize: "20px" }}>🏪</span>
            </div>
            <div style={{ fontSize: "26px", fontWeight: 900, color: totalOutstandingDue > 0 ? "#dc2626" : "#059669", marginTop: "8px" }}>
              ₹{formatMoney(totalOutstandingDue)}
            </div>
            <div style={{ fontSize: "12px", color: totalOutstandingDue > 0 ? "#b91c1c" : "#047857", marginTop: "4px", fontWeight: 600 }}>
              {dueVendors.length > 0 ? `⚠️ ${dueVendors.length} supplier(s) awaiting payment (Click to Settle →)` : "✓ All supplier accounts cleared!"}
            </div>
          </div>
        </div>

        {/* MAIN TAB SWITCHER */}
        <div
          className="no-print"
          style={{
            display: "flex",
            gap: "8px",
            borderBottom: "2px solid #e2e8f0",
            marginBottom: "20px",
          }}
        >
          <button
            type="button"
            onClick={() => {
              setActiveTab("expenses");
              setStatementVendor(null);
            }}
            style={{
              padding: "12px 20px",
              border: "none",
              background: "transparent",
              borderBottom: activeTab === "expenses" ? "3px solid #2563eb" : "3px solid transparent",
              color: activeTab === "expenses" ? "#2563eb" : "#64748b",
              fontWeight: 800,
              fontSize: "15px",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <span>📝</span> Daily Expenses List ({expenses.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("settle")}
            style={{
              padding: "12px 20px",
              border: "none",
              background: "transparent",
              borderBottom: activeTab === "settle" ? "3px solid #059669" : "3px solid transparent",
              color: activeTab === "settle" ? "#059669" : "#64748b",
              fontWeight: 800,
              fontSize: "15px",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <span>🤝</span> Supplier Khata & Settle
            {dueVendors.length > 0 && (
              <span
                style={{
                  background: "#dc2626",
                  color: "#ffffff",
                  fontSize: "11px",
                  padding: "2px 7px",
                  borderRadius: "10px",
                  fontWeight: 900,
                }}
              >
                {dueVendors.length} DUE
              </span>
            )}
          </button>
        </div>

        {/* ======================================================== */}
        {/* TAB 1: DAILY EXPENSES LIST */}
        {/* ======================================================== */}
        {activeTab === "expenses" && (
          <div>
            {/* Filter Bar */}
            <div
              className="no-print"
              style={{
                background: "#ffffff",
                padding: "14px 18px",
                borderRadius: "10px",
                border: "1px solid #e2e8f0",
                marginBottom: "16px",
                display: "flex",
                flexWrap: "wrap",
                gap: "12px",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              {/* Search */}
              <div style={{ flex: "1 1 240px", minWidth: "200px" }}>
                <input
                  type="text"
                  placeholder="🔍 Search expense, supplier, or bill #..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    fontSize: "13px",
                  }}
                />
              </div>

              {/* Category Filter */}
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                style={{
                  padding: "9px 12px",
                  borderRadius: "8px",
                  border: "1px solid #cbd5e1",
                  fontSize: "13px",
                  background: "#ffffff",
                }}
              >
                <option value="all">All Categories</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>

              {/* Payment Filter */}
              <select
                value={paymentFilter}
                onChange={(e) => setPaymentFilter(e.target.value as any)}
                style={{
                  padding: "9px 12px",
                  borderRadius: "8px",
                  border: "1px solid #cbd5e1",
                  fontSize: "13px",
                  background: "#ffffff",
                }}
              >
                <option value="all">All Payment Types</option>
                <option value="paid">Direct Paid (Cash / UPI)</option>
                <option value="credit">Credit / Khata Purchases</option>
              </select>

              {/* Date Filter */}
              <select
                value={dateRangeFilter}
                onChange={(e) => setDateRangeFilter(e.target.value as any)}
                style={{
                  padding: "9px 12px",
                  borderRadius: "8px",
                  border: "1px solid #cbd5e1",
                  fontSize: "13px",
                  background: "#ffffff",
                }}
              >
                <option value="this_month">This Month</option>
                <option value="today">Today Only</option>
                <option value="all">All Time</option>
              </select>

              {(searchTerm || selectedCategory !== "all" || paymentFilter !== "all" || dateRangeFilter !== "this_month") && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchTerm("");
                    setSelectedCategory("all");
                    setPaymentFilter("all");
                    setDateRangeFilter("this_month");
                  }}
                  style={{
                    border: "none",
                    background: "transparent",
                    color: "#dc2626",
                    fontSize: "13px",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  ✕ Clear Filters
                </button>
              )}
            </div>

            {/* Expenses Table */}
            <div style={{ background: "#ffffff", borderRadius: "12px", border: "1px solid #e2e8f0", overflow: "hidden" }}>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", textAlign: "left" }}>
                  <thead>
                    <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0", color: "#475569", fontWeight: 700 }}>
                      <th style={{ padding: "12px 16px" }}>Date</th>
                      <th style={{ padding: "12px 16px" }}>Description / Item</th>
                      <th style={{ padding: "12px 16px" }}>Category</th>
                      <th style={{ padding: "12px 16px" }}>Supplier / Payee</th>
                      <th style={{ padding: "12px 16px", textAlign: "right" }}>Amount (₹)</th>
                      <th style={{ padding: "12px 16px" }}>Status</th>
                      <th className="no-print" style={{ padding: "12px 16px", textAlign: "center" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={7} style={{ padding: "40px", textAlign: "center", color: "#64748b" }}>
                          Loading expenses...
                        </td>
                      </tr>
                    ) : filteredExpenses.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ padding: "50px 20px", textAlign: "center" }}>
                          <div style={{ fontSize: "36px", marginBottom: "8px" }}>📝</div>
                          <div style={{ fontWeight: 800, color: "#0f172a", fontSize: "16px" }}>No expenses found</div>
                          <div style={{ color: "#64748b", fontSize: "13px", marginTop: "4px", marginBottom: "16px" }}>
                            {expenses.length === 0 ? "You haven't added any expenses yet." : "No records match your selected filters."}
                          </div>
                          {!isOwner && (
                            <button
                              type="button"
                              onClick={openNewExpenseModal}
                              style={{
                                background: "#2563eb",
                                color: "#ffffff",
                                border: "none",
                                padding: "8px 16px",
                                borderRadius: "8px",
                                fontWeight: 700,
                                fontSize: "13px",
                                cursor: "pointer",
                              }}
                            >
                              ＋ Add First Expense
                            </button>
                          )}
                        </td>
                      </tr>
                    ) : (
                      filteredExpenses.map((exp) => {
                        const stat = billStatusMap[exp.id] || { isCredit: false, isSettled: true, dueAmount: 0 };
                        const isCredit = stat.isCredit;

                        return (
                          <tr key={exp.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                            <td style={{ padding: "12px 16px", color: "#0f172a", fontWeight: 600, whiteSpace: "nowrap" }}>
                              {formatDate(exp.expense_date)}
                            </td>
                            <td style={{ padding: "12px 16px" }}>
                              <div style={{ fontWeight: 700, color: "#0f172a" }}>{exp.title}</div>
                              {exp.bill_number && (
                                <span style={{ fontSize: "11px", color: "#64748b", fontFamily: "monospace" }}>
                                  Bill #{exp.bill_number}
                                </span>
                              )}
                              {exp.note && (
                                <div style={{ fontSize: "11px", color: "#64748b", marginTop: "2px" }}>
                                  {exp.note}
                                </div>
                              )}
                            </td>
                            <td style={{ padding: "12px 16px", color: "#334155" }}>
                              <span style={{ background: "#f1f5f9", padding: "3px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: 600 }}>
                                {exp.category}
                              </span>
                            </td>
                            <td style={{ padding: "12px 16px", fontWeight: 600, color: "#0f172a" }}>
                              {exp.vendor ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setStatementVendor(exp.vendor!);
                                    setActiveTab("settle");
                                  }}
                                  style={{
                                    border: "none",
                                    background: "transparent",
                                    color: "#2563eb",
                                    fontWeight: 700,
                                    cursor: "pointer",
                                    padding: 0,
                                    textDecoration: "underline",
                                  }}
                                  title="View Khata statement"
                                >
                                  🏪 {exp.vendor}
                                </button>
                              ) : (
                                <span style={{ color: "#94a3b8" }}>Direct / Store</span>
                              )}
                            </td>
                            <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: 800, fontSize: "14px", color: "#0f172a" }}>
                              ₹{formatMoney(exp.amount)}
                            </td>
                            <td style={{ padding: "12px 16px", whiteSpace: "nowrap" }}>
                              {!isCredit ? (
                                <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "3px 8px", borderRadius: "6px", background: "#f0fdf4", color: "#059669", border: "1px solid #bbf7d0", fontSize: "11px", fontWeight: 700 }}>
                                  ✓ Paid ({exp.payment_method || "Cash"})
                                </span>
                              ) : stat.isSettled ? (
                                <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "3px 8px", borderRadius: "6px", background: "#f0fdf4", color: "#059669", border: "1px solid #bbf7d0", fontSize: "11px", fontWeight: 700 }}>
                                  ✓ Settled (Khata)
                                </span>
                              ) : (
                                <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "3px 8px", borderRadius: "6px", background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", fontSize: "11px", fontWeight: 800 }}>
                                  🔴 Due: ₹{formatMoney(stat.dueAmount)}
                                </span>
                              )}
                            </td>
                            <td className="no-print" style={{ padding: "12px 16px", textAlign: "center" }}>
                              <div style={{ display: "flex", justifyContent: "center", gap: "6px" }}>
                                {!isOwner && isCredit && !stat.isSettled && (
                                  <button
                                    type="button"
                                    onClick={() => openSettleModal(exp.vendor || undefined, stat.dueAmount)}
                                    title="Settle this due"
                                    style={{
                                      padding: "4px 8px",
                                      borderRadius: "6px",
                                      background: "#059669",
                                      color: "#ffffff",
                                      border: "none",
                                      fontSize: "11px",
                                      fontWeight: 800,
                                      cursor: "pointer",
                                    }}
                                  >
                                    🤝 Settle
                                  </button>
                                )}
                                {!isOwner && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => openEditExpenseModal(exp)}
                                      title="Edit expense"
                                      style={{
                                        padding: "4px 8px",
                                        borderRadius: "6px",
                                        border: "1px solid #cbd5e1",
                                        background: "#ffffff",
                                        color: "#334155",
                                        fontSize: "11px",
                                        fontWeight: 600,
                                        cursor: "pointer",
                                      }}
                                    >
                                      ✏️ Edit
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteExpense(exp.id, exp.title)}
                                      title="Delete expense"
                                      style={{
                                        padding: "4px 8px",
                                        borderRadius: "6px",
                                        border: "1px solid #fecdd3",
                                        background: "#fff1f2",
                                        color: "#e11d48",
                                        fontSize: "11px",
                                        fontWeight: 600,
                                        cursor: "pointer",
                                      }}
                                    >
                                      🗑️
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 2: SUPPLIER KHATA & SETTLE (PROPER SETTLEMENT VIEW) */}
        {/* ======================================================== */}
        {activeTab === "settle" && (
          <div>
            {/* If user clicked to view a single vendor's statement */}
            {activeStatementVendor ? (
              <div style={{ background: "#ffffff", borderRadius: "12px", border: "1px solid #e2e8f0", padding: "20px 24px", marginBottom: "20px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
                  <div>
                    <button
                      type="button"
                      onClick={() => setStatementVendor(null)}
                      style={{
                        border: "none",
                        background: "transparent",
                        color: "#2563eb",
                        fontSize: "13px",
                        fontWeight: 700,
                        cursor: "pointer",
                        padding: 0,
                        marginBottom: "6px",
                      }}
                    >
                      ← Back to All Suppliers
                    </button>
                    <h2 style={{ margin: 0, fontSize: "20px", fontWeight: 900, color: "#0f172a" }}>
                      🏪 {activeStatementVendor.name} - Khata Statement
                    </h2>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                    <div style={{ textAlign: "right" }}>
                      <span style={{ fontSize: "11px", color: activeStatementVendor.pendingBalance > 0 ? "#dc2626" : "#059669", fontWeight: 800 }}>
                        CURRENT DUE
                      </span>
                      <div style={{ fontSize: "22px", fontWeight: 900, color: activeStatementVendor.pendingBalance > 0 ? "#dc2626" : "#059669" }}>
                        ₹{formatMoney(activeStatementVendor.pendingBalance)}
                      </div>
                    </div>

                    {!isOwner && activeStatementVendor.pendingBalance > 0 && (
                      <button
                        type="button"
                        onClick={() => openSettleModal(activeStatementVendor.name, activeStatementVendor.pendingBalance)}
                        style={{
                          background: "#059669",
                          color: "#ffffff",
                          border: "none",
                          padding: "10px 18px",
                          borderRadius: "8px",
                          fontWeight: 800,
                          fontSize: "13px",
                          cursor: "pointer",
                        }}
                      >
                        🤝 Settle Full Due (₹{formatMoney(activeStatementVendor.pendingBalance)})
                      </button>
                    )}
                  </div>
                </div>

                {/* Vendor Statement Items */}
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", textAlign: "left" }}>
                    <thead>
                      <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0", color: "#475569", fontWeight: 700 }}>
                        <th style={{ padding: "10px 14px" }}>Date</th>
                        <th style={{ padding: "10px 14px" }}>Type</th>
                        <th style={{ padding: "10px 14px" }}>Particulars / Ref</th>
                        <th style={{ padding: "10px 14px", textAlign: "right" }}>Credit Bill (+₹)</th>
                        <th style={{ padding: "10px 14px", textAlign: "right" }}>Settlement Paid (-₹)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* Interleaved chronological view */}
                      {(() => {
                        const allItems: Array<{
                          date: string;
                          type: "bill" | "settlement";
                          title: string;
                          billAmt: number;
                          settleAmt: number;
                          rawId: number;
                        }> = [];

                        activeStatementVendor.expenses
                          .filter((e) => isCreditExpense(e.payment_method))
                          .forEach((e) => {
                            allItems.push({
                              date: (e.expense_date || "").slice(0, 10),
                              type: "bill",
                              title: `${e.title}${e.bill_number ? ` (Bill #${e.bill_number})` : ""}`,
                              billAmt: e.amount || 0,
                              settleAmt: 0,
                              rawId: e.id,
                            });
                          });

                        activeStatementVendor.settlements.forEach((s) => {
                          allItems.push({
                            date: (s.settlement_date || "").slice(0, 10),
                            type: "settlement",
                            title: `Credit Payment via ${s.payment_mode}${s.reference_no ? ` (Ref: ${s.reference_no})` : ""}`,
                            billAmt: 0,
                            settleAmt: s.amount || 0,
                            rawId: s.id,
                          });
                        });

                        allItems.sort((a, b) => b.date.localeCompare(a.date));

                        if (allItems.length === 0) {
                          return (
                            <tr>
                              <td colSpan={5} style={{ padding: "30px", textAlign: "center", color: "#64748b" }}>
                                No credit transactions found for this supplier.
                              </td>
                            </tr>
                          );
                        }

                        return allItems.map((item, idx) => (
                          <tr key={`${item.type}-${item.rawId}-${idx}`} style={{ borderBottom: "1px solid #f1f5f9", background: item.type === "settlement" ? "#f0fdf4" : "#ffffff" }}>
                            <td style={{ padding: "10px 14px", fontWeight: 600 }}>{formatDate(item.date)}</td>
                            <td style={{ padding: "10px 14px" }}>
                              {item.type === "bill" ? (
                                <span style={{ background: "#fef2f2", color: "#dc2626", padding: "2px 6px", borderRadius: "4px", fontSize: "11px", fontWeight: 700 }}>
                                  Credit Bill
                                </span>
                              ) : (
                                <span style={{ background: "#ecfdf5", color: "#059669", padding: "2px 6px", borderRadius: "4px", fontSize: "11px", fontWeight: 700 }}>
                                  Settlement Paid
                                </span>
                              )}
                            </td>
                            <td style={{ padding: "10px 14px", fontWeight: 600, color: "#0f172a" }}>{item.title}</td>
                            <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 800, color: "#dc2626" }}>
                              {item.billAmt > 0 ? `+ ₹${formatMoney(item.billAmt)}` : "-"}
                            </td>
                            <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 800, color: "#059669" }}>
                              {item.settleAmt > 0 ? `- ₹${formatMoney(item.settleAmt)}` : "-"}
                            </td>
                          </tr>
                        ));
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}

            {/* SECTION 1: SUPPLIERS WITH PENDING DUES (QUICK SETTLE CARDS) */}
            <div style={{ marginBottom: "28px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 800, color: "#0f172a" }}>
                    🔴 Suppliers Awaiting Payment ({dueVendors.length})
                  </h2>
                  <span style={{ fontSize: "13px", color: "#64748b" }}>
                    Suppliers with outstanding credit balances. Click Settle to record payments.
                  </span>
                </div>
                {dueVendors.length > 0 && !isOwner && (
                  <button
                    type="button"
                    onClick={() => openSettleModal()}
                    style={{
                      background: "#059669",
                      color: "#ffffff",
                      border: "none",
                      padding: "8px 14px",
                      borderRadius: "8px",
                      fontWeight: 700,
                      fontSize: "13px",
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    <span>🤝</span> Settle Any Supplier
                  </button>
                )}
              </div>

              {dueVendors.length === 0 ? (
                <div
                  style={{
                    background: "#f0fdf4",
                    border: "1px solid #bbf7d0",
                    borderRadius: "12px",
                    padding: "24px",
                    textAlign: "center",
                    color: "#065f46",
                  }}
                >
                  <div style={{ fontSize: "28px", marginBottom: "6px" }}>🎉</div>
                  <div style={{ fontWeight: 800, fontSize: "16px" }}>All Supplier Accounts Are Settled!</div>
                  <div style={{ fontSize: "13px", color: "#047857", marginTop: "2px" }}>
                    You currently have zero outstanding dues with any supplier.
                  </div>
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "16px" }}>
                  {dueVendors.map((vendor) => (
                    <div
                      key={vendor.name}
                      style={{
                        background: "#ffffff",
                        borderRadius: "12px",
                        border: "1px solid #fecaca",
                        boxShadow: "0 2px 8px rgba(220, 38, 38, 0.06)",
                        padding: "18px 20px",
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "space-between",
                      }}
                    >
                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                          <div>
                            <h3 style={{ margin: 0, fontSize: "17px", fontWeight: 900, color: "#0f172a" }}>
                              🏪 {vendor.name}
                            </h3>
                            <span style={{ fontSize: "12px", color: "#64748b" }}>
                              {vendor.billCount} total purchases • Last: {formatDate(vendor.lastDate)}
                            </span>
                          </div>
                          <span style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", padding: "3px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: 800 }}>
                            PAYMENT DUE
                          </span>
                        </div>

                        {/* Balance Stats */}
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "1fr 1fr",
                            gap: "8px",
                            background: "#f8fafc",
                            padding: "10px 12px",
                            borderRadius: "8px",
                            margin: "14px 0",
                            fontSize: "12px",
                          }}
                        >
                          <div>
                            <span style={{ color: "#64748b" }}>Total Credit:</span>
                            <div style={{ fontWeight: 700, color: "#0f172a" }}>₹{formatMoney(vendor.totalCredit)}</div>
                          </div>
                          <div>
                            <span style={{ color: "#059669" }}>Paid So Far:</span>
                            <div style={{ fontWeight: 700, color: "#059669" }}>₹{formatMoney(vendor.totalCleared)}</div>
                          </div>
                        </div>

                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "16px" }}>
                          <span style={{ fontSize: "13px", fontWeight: 700, color: "#dc2626" }}>Current Balance Due:</span>
                          <span style={{ fontSize: "22px", fontWeight: 900, color: "#dc2626" }}>
                            ₹{formatMoney(vendor.pendingBalance)}
                          </span>
                        </div>
                      </div>

                      {/* Card Action Buttons */}
                      <div style={{ display: "flex", gap: "8px" }}>
                        {!isOwner && (
                          <button
                            type="button"
                            onClick={() => openSettleModal(vendor.name, vendor.pendingBalance)}
                            style={{
                              flex: 1,
                              background: "#059669",
                              color: "#ffffff",
                              border: "none",
                              padding: "10px 14px",
                              borderRadius: "8px",
                              fontWeight: 800,
                              fontSize: "13px",
                              cursor: "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: "4px",
                            }}
                          >
                            <span>🤝</span> Settle Due (₹{formatMoney(vendor.pendingBalance)})
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setStatementVendor(vendor.name)}
                          style={{
                            border: "1px solid #cbd5e1",
                            background: "#ffffff",
                            color: "#475569",
                            padding: "10px 12px",
                            borderRadius: "8px",
                            fontWeight: 700,
                            fontSize: "12px",
                            cursor: "pointer",
                          }}
                        >
                          View Khata
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* SECTION 2: ALL SUPPLIER ACCOUNTS SUMMARY */}
            <div style={{ background: "#ffffff", borderRadius: "12px", border: "1px solid #e2e8f0", overflow: "hidden", marginBottom: "28px" }}>
              <div style={{ padding: "16px 20px", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 800, color: "#0f172a" }}>
                    📋 All Supplier Khata Accounts ({vendorAccounts.length})
                  </h3>
                  <span style={{ fontSize: "12px", color: "#64748b" }}>
                    Master overview of all suppliers and transaction balances
                  </span>
                </div>
              </div>

              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", textAlign: "left" }}>
                  <thead>
                    <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0", color: "#475569", fontWeight: 700 }}>
                      <th style={{ padding: "12px 16px" }}>Supplier Name</th>
                      <th style={{ padding: "12px 16px", textAlign: "right" }}>Total Purchases</th>
                      <th style={{ padding: "12px 16px", textAlign: "right" }}>Total Credit</th>
                      <th style={{ padding: "12px 16px", textAlign: "right" }}>Paid / Cleared</th>
                      <th style={{ padding: "12px 16px", textAlign: "right" }}>Balance Due</th>
                      <th style={{ padding: "12px 16px", textAlign: "center" }}>Status</th>
                      <th className="no-print" style={{ padding: "12px 16px", textAlign: "center" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vendorAccounts.map((v) => (
                      <tr key={v.name} style={{ borderBottom: "1px solid #f1f5f9" }}>
                        <td style={{ padding: "12px 16px", fontWeight: 700, color: "#0f172a" }}>
                          🏪 {v.name}
                        </td>
                        <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: 600 }}>
                          ₹{formatMoney(v.totalBilled)}
                        </td>
                        <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: 600, color: "#dc2626" }}>
                          ₹{formatMoney(v.totalCredit)}
                        </td>
                        <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: 600, color: "#059669" }}>
                          ₹{formatMoney(v.totalCleared)}
                        </td>
                        <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: 900, color: v.pendingBalance > 0 ? "#dc2626" : "#059669", fontSize: "14px" }}>
                          ₹{formatMoney(v.pendingBalance)}
                        </td>
                        <td style={{ padding: "12px 16px", textAlign: "center" }}>
                          {v.pendingBalance > 0 ? (
                            <span style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", padding: "3px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: 800 }}>
                              🔴 Due (₹{formatMoney(v.pendingBalance)})
                            </span>
                          ) : (
                            <span style={{ background: "#f0fdf4", color: "#059669", border: "1px solid #bbf7d0", padding: "3px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: 700 }}>
                              ✓ Clear
                            </span>
                          )}
                        </td>
                        <td className="no-print" style={{ padding: "12px 16px", textAlign: "center" }}>
                          <div style={{ display: "flex", justifyContent: "center", gap: "6px" }}>
                            {v.pendingBalance > 0 && !isOwner && (
                              <button
                                type="button"
                                onClick={() => openSettleModal(v.name, v.pendingBalance)}
                                style={{
                                  padding: "4px 8px",
                                  borderRadius: "6px",
                                  background: "#059669",
                                  color: "#ffffff",
                                  border: "none",
                                  fontSize: "11px",
                                  fontWeight: 800,
                                  cursor: "pointer",
                                }}
                              >
                                🤝 Settle
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setStatementVendor(v.name)}
                              style={{
                                padding: "4px 8px",
                                borderRadius: "6px",
                                border: "1px solid #cbd5e1",
                                background: "#ffffff",
                                color: "#475569",
                                fontSize: "11px",
                                fontWeight: 600,
                                cursor: "pointer",
                              }}
                            >
                              Statement
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* SECTION 3: SETTLEMENT PAYMENT HISTORY */}
            <div style={{ background: "#ffffff", borderRadius: "12px", border: "1px solid #e2e8f0", overflow: "hidden" }}>
              <div style={{ padding: "16px 20px", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 800, color: "#0f172a" }}>
                    📜 Settlement Payment History ({settlements.length})
                  </h3>
                  <span style={{ fontSize: "12px", color: "#64748b" }}>
                    All past credit clearance payments recorded
                  </span>
                </div>
              </div>

              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", textAlign: "left" }}>
                  <thead>
                    <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0", color: "#475569", fontWeight: 700 }}>
                      <th style={{ padding: "12px 16px" }}>Date</th>
                      <th style={{ padding: "12px 16px" }}>Settlement ID</th>
                      <th style={{ padding: "12px 16px" }}>Supplier / Payee</th>
                      <th style={{ padding: "12px 16px" }}>Payment Mode</th>
                      <th style={{ padding: "12px 16px" }}>Reference / Note</th>
                      <th style={{ padding: "12px 16px", textAlign: "right" }}>Amount Paid</th>
                      <th className="no-print" style={{ padding: "12px 16px", textAlign: "center" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {settlements.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ padding: "30px", textAlign: "center", color: "#64748b" }}>
                          No settlements recorded yet.
                        </td>
                      </tr>
                    ) : (
                      settlements.map((s) => (
                        <tr key={s.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                          <td style={{ padding: "12px 16px", fontWeight: 600, color: "#0f172a", whiteSpace: "nowrap" }}>
                            {formatDate(s.settlement_date)}
                          </td>
                          <td style={{ padding: "12px 16px", fontFamily: "monospace", color: "#64748b" }}>
                            SETTLE-{String(s.id).padStart(4, "0")}
                          </td>
                          <td style={{ padding: "12px 16px", fontWeight: 700, color: "#0f172a" }}>
                            🏪 {s.vendor}
                          </td>
                          <td style={{ padding: "12px 16px" }}>
                            <span style={{ background: "#ecfdf5", color: "#059669", padding: "3px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: 700 }}>
                              {s.payment_mode}
                            </span>
                          </td>
                          <td style={{ padding: "12px 16px", color: "#64748b", fontSize: "12px" }}>
                            {s.reference_no && <div style={{ fontWeight: 600, color: "#334155" }}>Ref: {s.reference_no}</div>}
                            {s.note && <div>{s.note}</div>}
                          </td>
                          <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: 900, color: "#059669", fontSize: "14px" }}>
                            ₹{formatMoney(s.amount)}
                          </td>
                          <td className="no-print" style={{ padding: "12px 16px", textAlign: "center" }}>
                            {!isOwner && (
                              <button
                                type="button"
                                onClick={() => handleDeleteSettlement(s.id, s.vendor, s.amount)}
                                title="Void this clearance (restores due)"
                                style={{
                                  padding: "4px 8px",
                                  borderRadius: "6px",
                                  border: "1px solid #fecdd3",
                                  background: "#fff1f2",
                                  color: "#e11d48",
                                  fontSize: "11px",
                                  fontWeight: 600,
                                  cursor: "pointer",
                                }}
                              >
                                🗑️ Void
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* MODAL 1: ADD / EDIT EXPENSE */}
      {/* ======================================================== */}
      {expenseModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.7)",
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
              background: "#ffffff",
              borderRadius: "16px",
              width: "100%",
              maxWidth: "540px",
              maxHeight: "92vh",
              overflowY: "auto",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
            }}
          >
            {/* Header */}
            <div style={{ background: "#2563eb", color: "#ffffff", padding: "18px 22px", borderRadius: "16px 16px 0 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 900 }}>
                  {editingExpenseId ? "✏️ Edit Expense" : "＋ Record New Expense"}
                </h3>
                <span style={{ fontSize: "12px", opacity: 0.9 }}>
                  Enter what was purchased and how it was paid
                </span>
              </div>
              <button
                type="button"
                onClick={() => setExpenseModalOpen(false)}
                style={{
                  background: "rgba(255,255,255,0.2)",
                  border: "none",
                  color: "#ffffff",
                  borderRadius: "50%",
                  width: "30px",
                  height: "30px",
                  fontSize: "16px",
                  cursor: "pointer",
                }}
              >
                ✕
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveExpense} style={{ padding: "20px 22px" }}>
              {/* Quick suggestion pills (only on new expense) */}
              {!editingExpenseId && (
                <div style={{ marginBottom: "16px" }}>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", marginBottom: "6px" }}>
                    Quick Select Common Items:
                  </label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                    {QUICK_SUGGESTIONS.map((q) => (
                      <button
                        key={q.title}
                        type="button"
                        onClick={() => {
                          setFormTitle(q.title);
                          setFormCategory(q.cat);
                        }}
                        style={{
                          padding: "3px 8px",
                          borderRadius: "6px",
                          border: "1px solid #cbd5e1",
                          background: "#f8fafc",
                          fontSize: "11px",
                          fontWeight: 600,
                          color: "#334155",
                          cursor: "pointer",
                        }}
                      >
                        + {q.title}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Title & Amount */}
              <div style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 700, color: "#0f172a", marginBottom: "6px" }}>
                  Item Description / What did you buy? *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Vegetables, Rice 25kg, Petrol, Milk"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  required
                  autoFocus
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    fontSize: "14px",
                  }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "16px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: 700, color: "#0f172a", marginBottom: "6px" }}>
                    Amount (₹) *
                  </label>
                  <div style={{ position: "relative" }}>
                    <span style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", fontSize: "16px", fontWeight: 800, color: "#2563eb" }}>
                      ₹
                    </span>
                    <input
                      type="number"
                      step="any"
                      min="0.01"
                      placeholder="0.00"
                      value={formAmount}
                      onChange={(e) => setFormAmount(e.target.value)}
                      required
                      style={{
                        width: "100%",
                        padding: "10px 12px 10px 30px",
                        borderRadius: "8px",
                        border: "1px solid #cbd5e1",
                        fontSize: "16px",
                        fontWeight: 800,
                        color: "#0f172a",
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: 700, color: "#0f172a", marginBottom: "6px" }}>
                    Category *
                  </label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                      fontSize: "13px",
                      background: "#ffffff",
                    }}
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* PAYMENT TYPE SELECTION: DIRECT PAID VS ON CREDIT */}
              <div style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 700, color: "#0f172a", marginBottom: "6px" }}>
                  Payment Method *
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <button
                    type="button"
                    onClick={() => setFormPaymentType("direct")}
                    style={{
                      padding: "12px 14px",
                      borderRadius: "8px",
                      border: formPaymentType === "direct" ? "2px solid #059669" : "1px solid #cbd5e1",
                      background: formPaymentType === "direct" ? "#ecfdf5" : "#ffffff",
                      color: formPaymentType === "direct" ? "#065f46" : "#475569",
                      fontWeight: 800,
                      fontSize: "13px",
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    <div>💵 Direct Paid</div>
                    <div style={{ fontSize: "11px", fontWeight: 500, opacity: 0.8, marginTop: "2px" }}>
                      Paid immediately (Cash / UPI)
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormPaymentType("credit")}
                    style={{
                      padding: "12px 14px",
                      borderRadius: "8px",
                      border: formPaymentType === "credit" ? "2px solid #dc2626" : "1px solid #cbd5e1",
                      background: formPaymentType === "credit" ? "#fef2f2" : "#ffffff",
                      color: formPaymentType === "credit" ? "#991b1b" : "#475569",
                      fontWeight: 800,
                      fontSize: "13px",
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    <div>🔴 Buy on Credit (Khata)</div>
                    <div style={{ fontSize: "11px", fontWeight: 500, opacity: 0.8, marginTop: "2px" }}>
                      Pay later to supplier
                    </div>
                  </button>
                </div>
              </div>

              {/* Sub-option for direct paid */}
              {formPaymentType === "direct" && (
                <div style={{ marginBottom: "16px" }}>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#475569", marginBottom: "4px" }}>
                    Paid Via:
                  </label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                    {DIRECT_PAYMENT_METHODS.map((pm) => (
                      <button
                        key={pm}
                        type="button"
                        onClick={() => setFormDirectMethod(pm)}
                        style={{
                          padding: "6px 12px",
                          borderRadius: "6px",
                          border: formDirectMethod === pm ? "1px solid #059669" : "1px solid #cbd5e1",
                          background: formDirectMethod === pm ? "#059669" : "#ffffff",
                          color: formDirectMethod === pm ? "#ffffff" : "#334155",
                          fontSize: "12px",
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        {pm}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Vendor / Supplier */}
              <div style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 700, color: "#0f172a", marginBottom: "6px" }}>
                  Supplier / Vendor Name {formPaymentType === "credit" && <span style={{ color: "#dc2626" }}>* (Required for Credit Khata)</span>}
                </label>
                <input
                  type="text"
                  placeholder="e.g. MS Fresh, United Traders, Direct Market"
                  value={formVendor}
                  onChange={(e) => setFormVendor(e.target.value)}
                  required={formPaymentType === "credit"}
                  list="known-vendors-datalist"
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    fontSize: "13px",
                  }}
                />
                <datalist id="known-vendors-datalist">
                  {knownVendors.map((v) => (
                    <option key={v} value={v} />
                  ))}
                </datalist>
              </div>

              {/* Date & Bill Number */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "16px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#0f172a", marginBottom: "4px" }}>
                    Date *
                  </label>
                  <input
                    type="date"
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    required
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                      fontSize: "13px",
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#0f172a", marginBottom: "4px" }}>
                    Invoice / Bill # (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. INV-9842"
                    value={formBillNumber}
                    onChange={(e) => setFormBillNumber(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                      fontSize: "13px",
                    }}
                  />
                </div>
              </div>

              {/* Remarks */}
              <div style={{ marginBottom: "20px" }}>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#0f172a", marginBottom: "4px" }}>
                  Remarks / Note (Optional)
                </label>
                <input
                  type="text"
                  placeholder="Optional remarks"
                  value={formNote}
                  onChange={(e) => setFormNote(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    fontSize: "13px",
                  }}
                />
              </div>

              {/* Submit Buttons */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button
                  type="button"
                  onClick={() => setExpenseModalOpen(false)}
                  style={{
                    padding: "10px 16px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    background: "#ffffff",
                    color: "#475569",
                    fontWeight: 600,
                    fontSize: "13px",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingExpense}
                  style={{
                    padding: "10px 22px",
                    borderRadius: "8px",
                    border: "none",
                    background: "#2563eb",
                    color: "#ffffff",
                    fontWeight: 800,
                    fontSize: "14px",
                    cursor: submittingExpense ? "not-allowed" : "pointer",
                  }}
                >
                  {submittingExpense ? "Saving..." : editingExpenseId ? "✓ Update Expense" : "✓ Save Expense"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 2: SETTLE SUPPLIER DUE (PROPER SETTLEMENT POPUP) */}
      {/* ======================================================== */}
      {settleModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.7)",
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
              background: "#ffffff",
              borderRadius: "16px",
              width: "100%",
              maxWidth: "500px",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
            }}
          >
            {/* Header */}
            <div style={{ background: "#059669", color: "#ffffff", padding: "18px 22px", borderRadius: "16px 16px 0 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 900 }}>
                  🤝 Settle Supplier Khata Due
                </h3>
                <span style={{ fontSize: "12px", opacity: 0.9 }}>
                  Record a payment to clear vendor credit balance
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSettleModalOpen(false)}
                style={{
                  background: "rgba(255,255,255,0.2)",
                  border: "none",
                  color: "#ffffff",
                  borderRadius: "50%",
                  width: "30px",
                  height: "30px",
                  fontSize: "16px",
                  cursor: "pointer",
                }}
              >
                ✕
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveSettlement} style={{ padding: "20px 22px" }}>
              {/* Supplier Selection */}
              <div style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 700, color: "#0f172a", marginBottom: "6px" }}>
                  Supplier / Vendor Account *
                </label>
                <input
                  type="text"
                  placeholder="Type or pick supplier name"
                  value={settleVendor}
                  onChange={(e) => setSettleVendor(e.target.value)}
                  required
                  list="settle-vendor-list"
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    fontSize: "14px",
                    fontWeight: 700,
                  }}
                />
                <datalist id="settle-vendor-list">
                  {vendorAccounts.map((v) => (
                    <option key={v.name} value={v.name}>
                      {v.name} (Due: ₹{formatMoney(v.pendingBalance)})
                    </option>
                  ))}
                </datalist>

                {/* Quick Chips for suppliers with dues */}
                {dueVendors.length > 0 && (
                  <div style={{ marginTop: "8px" }}>
                    <span style={{ fontSize: "11px", color: "#64748b", fontWeight: 600 }}>Suppliers with dues:</span>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginTop: "4px" }}>
                      {dueVendors.map((v) => (
                        <button
                          key={v.name}
                          type="button"
                          onClick={() => {
                            setSettleVendor(v.name);
                            setSettleAmount(String(v.pendingBalance));
                            setSettleNote(`Credit balance settlement for ${v.name}`);
                          }}
                          style={{
                            padding: "3px 8px",
                            borderRadius: "12px",
                            border: settleVendor.toLowerCase() === v.name.toLowerCase() ? "1px solid #059669" : "1px solid #cbd5e1",
                            background: settleVendor.toLowerCase() === v.name.toLowerCase() ? "#059669" : "#f8fafc",
                            color: settleVendor.toLowerCase() === v.name.toLowerCase() ? "#ffffff" : "#334155",
                            fontSize: "11px",
                            fontWeight: 700,
                            cursor: "pointer",
                          }}
                        >
                          {v.name} (₹{formatMoney(v.pendingBalance)})
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Active Supplier Balance Info Box */}
              {activeSettleVendorData && (
                <div
                  style={{
                    background: activeSettleVendorData.pendingBalance > 0 ? "#fef2f2" : "#f0fdf4",
                    border: activeSettleVendorData.pendingBalance > 0 ? "1px solid #fecaca" : "1px solid #bbf7d0",
                    borderRadius: "8px",
                    padding: "10px 14px",
                    marginBottom: "16px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <span style={{ fontSize: "11px", color: "#64748b", fontWeight: 600 }}>Total Credit Taken:</span>
                    <div style={{ fontWeight: 700, color: "#0f172a" }}>₹{formatMoney(activeSettleVendorData.totalCredit)}</div>
                  </div>
                  <div>
                    <span style={{ fontSize: "11px", color: "#059669", fontWeight: 600 }}>Already Cleared:</span>
                    <div style={{ fontWeight: 700, color: "#059669" }}>₹{formatMoney(activeSettleVendorData.totalCleared)}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <span style={{ fontSize: "11px", color: activeSettleVendorData.pendingBalance > 0 ? "#dc2626" : "#059669", fontWeight: 800 }}>
                      Outstanding Due:
                    </span>
                    <div style={{ fontSize: "16px", fontWeight: 900, color: activeSettleVendorData.pendingBalance > 0 ? "#dc2626" : "#059669" }}>
                      ₹{formatMoney(activeSettleVendorData.pendingBalance)}
                    </div>
                  </div>
                </div>
              )}

              {/* Amount & Quick Chips */}
              <div style={{ marginBottom: "16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                  <label style={{ fontSize: "13px", fontWeight: 700, color: "#0f172a" }}>
                    Payment Amount (₹) *
                  </label>
                  {activeSettleVendorData && activeSettleVendorData.pendingBalance > 0 && (
                    <div style={{ display: "flex", gap: "6px" }}>
                      <button
                        type="button"
                        onClick={() => setSettleAmount(String(activeSettleVendorData.pendingBalance))}
                        style={{
                          background: "#ecfdf5",
                          border: "1px solid #a7f3d0",
                          color: "#047857",
                          padding: "2px 8px",
                          borderRadius: "4px",
                          fontSize: "11px",
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        ⚡ Full Due (₹{formatMoney(activeSettleVendorData.pendingBalance)})
                      </button>
                      <button
                        type="button"
                        onClick={() => setSettleAmount(String(Math.round(activeSettleVendorData.pendingBalance / 2)))}
                        style={{
                          background: "#f0f9ff",
                          border: "1px solid #bae6fd",
                          color: "#0369a1",
                          padding: "2px 8px",
                          borderRadius: "4px",
                          fontSize: "11px",
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        50%
                      </button>
                    </div>
                  )}
                </div>

                <div style={{ position: "relative" }}>
                  <span style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", fontSize: "16px", fontWeight: 800, color: "#059669" }}>
                    ₹
                  </span>
                  <input
                    type="number"
                    step="any"
                    min="0.01"
                    placeholder="0.00"
                    value={settleAmount}
                    onChange={(e) => setSettleAmount(e.target.value)}
                    required
                    style={{
                      width: "100%",
                      padding: "10px 12px 10px 30px",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                      fontSize: "16px",
                      fontWeight: 800,
                      color: "#0f172a",
                    }}
                  />
                </div>
              </div>

              {/* Payment Mode */}
              <div style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 700, color: "#0f172a", marginBottom: "6px" }}>
                  Paid Mode *
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "6px" }}>
                  {CLEARANCE_PAYMENT_METHODS.map((pm) => (
                    <button
                      key={pm}
                      type="button"
                      onClick={() => setSettleMode(pm)}
                      style={{
                        padding: "8px 10px",
                        borderRadius: "6px",
                        border: settleMode === pm ? "1px solid #059669" : "1px solid #cbd5e1",
                        background: settleMode === pm ? "#059669" : "#ffffff",
                        color: settleMode === pm ? "#ffffff" : "#334155",
                        fontSize: "12px",
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      {pm}
                    </button>
                  ))}
                </div>
              </div>

              {/* Date & Reference */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "16px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#0f172a", marginBottom: "4px" }}>
                    Date *
                  </label>
                  <input
                    type="date"
                    value={settleDate}
                    onChange={(e) => setSettleDate(e.target.value)}
                    required
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      borderRadius: "6px",
                      border: "1px solid #cbd5e1",
                      fontSize: "12px",
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#0f172a", marginBottom: "4px" }}>
                    Ref / Cheque # (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. UTR-98341"
                    value={settleRef}
                    onChange={(e) => setSettleRef(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      borderRadius: "6px",
                      border: "1px solid #cbd5e1",
                      fontSize: "12px",
                    }}
                  />
                </div>
              </div>

              {/* Submit Buttons */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button
                  type="button"
                  onClick={() => setSettleModalOpen(false)}
                  style={{
                    padding: "10px 16px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    background: "#ffffff",
                    color: "#475569",
                    fontWeight: 600,
                    fontSize: "13px",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingSettle}
                  style={{
                    padding: "10px 22px",
                    borderRadius: "8px",
                    border: "none",
                    background: "#059669",
                    color: "#ffffff",
                    fontWeight: 800,
                    fontSize: "14px",
                    cursor: submittingSettle ? "not-allowed" : "pointer",
                  }}
                >
                  {submittingSettle ? "Recording..." : `✓ Record Settlement (₹${formatMoney(parseFloat(settleAmount) || 0)})`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
