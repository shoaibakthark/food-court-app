"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth, fetchWithAuth } from "../lib/auth";
import {
  SidebarUserCard,
  OwnerBanner,
  NavLink,
  TopbarUserBadge,
  AppSidebar,
  MobileMenuButton,
} from "../components/AuthBar";

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
  creditBillCount: number;
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
    const d = new Date(`${dateStr.slice(0, 10)}T00:00:00`);
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
  const router = useRouter();
  const { user, isOwner } = useAuth();

  // --- DATA STATES ---
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [settlements, setSettlements] = useState<ExpenseSettlementRecord[]>([]);
  const [events, setEvents] = useState<EventOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // --- TABS: 'expenses' | 'khata' | 'history' ---
  const [activeTab, setActiveTab] = useState<"expenses" | "khata" | "history">("expenses");

  // --- FILTERS ---
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "unpaid" | "paid">("all");
  const [dateFilter, setDateFilter] = useState<"this_month" | "all" | "today">("this_month");

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

  // --- MODAL: MARK AS PAID (PAYMENT MARKING) ---
  const [markPaidModalOpen, setMarkPaidModalOpen] = useState(false);
  const [targetExpense, setTargetExpense] = useState<ExpenseRecord | null>(null);
  const [markPaidAmount, setMarkPaidAmount] = useState("");
  const [markPaidMode, setMarkPaidMode] = useState("UPI / GPay / PhonePe");
  const [markPaidDate, setMarkPaidDate] = useState(new Date().toISOString().slice(0, 10));
  const [markPaidRef, setMarkPaidRef] = useState("");
  const [submittingMarkPaid, setSubmittingMarkPaid] = useState(false);

  // --- MODAL: SETTLE SUPPLIER KHATA DUE ---
  const [settleModalOpen, setSettleModalOpen] = useState(false);
  const [settleVendor, setSettleVendor] = useState("");
  const [settleAmount, setSettleAmount] = useState("");
  const [settleMode, setSettleMode] = useState(CLEARANCE_PAYMENT_METHODS[0]);
  const [settleDate, setSettleDate] = useState(new Date().toISOString().slice(0, 10));
  const [settleRef, setSettleRef] = useState("");
  const [settleNote, setSettleNote] = useState("");
  const [submittingSettle, setSubmittingSettle] = useState(false);

  // --- STATEMENT DRILL-DOWN ---
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
      setError(err.message || "Failed to load financial records");
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

  // --- SUPPLIER KHATA BALANCES ---
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
          creditBillCount: 0,
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
        acc.creditBillCount += 1;
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
          creditBillCount: 0,
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

    Object.values(map).forEach((acc) => {
      acc.pendingBalance = Math.max(0, acc.totalCredit - acc.totalCleared);
    });

    return Object.values(map).sort((a, b) => b.pendingBalance - a.pendingBalance || a.name.localeCompare(b.name));
  }, [expenses, settlements]);

  // Due Vendors
  const dueVendors = useMemo(() => {
    return vendorAccounts.filter((v) => v.name !== "Direct / Cash Outflows" && v.pendingBalance > 0);
  }, [vendorAccounts]);

  const totalOutstandingDue = useMemo(() => {
    return dueVendors.reduce((sum, v) => sum + v.pendingBalance, 0);
  }, [dueVendors]);

  // Unpaid credit bills count & total
  const unpaidCreditBills = useMemo(() => {
    return expenses.filter((e) => isCreditExpense(e.payment_method));
  }, [expenses]);

  const unpaidCreditTotal = useMemo(() => {
    return unpaidCreditBills.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  }, [unpaidCreditBills]);

  // --- MONTHLY METRICS ---
  const currentMonthMetrics = useMemo(() => {
    const now = new Date();
    const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const todayStr = now.toISOString().slice(0, 10);

    let monthTotal = 0;
    let directPaid = 0;

    expenses.forEach((e) => {
      const d = (e.expense_date || "").slice(0, 7);
      if (d === currentYearMonth) {
        const amt = Number(e.amount) || 0;
        monthTotal += amt;
        if (!isCreditExpense(e.payment_method)) {
          directPaid += amt;
        }
      }
    });

    return { monthTotal, directPaid, todayStr, currentYearMonth };
  }, [expenses]);

  // --- FILTERED EXPENSES ---
  const filteredExpenses = useMemo(() => {
    return expenses.filter((e) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const titleMatch = (e.title || "").toLowerCase().includes(q);
        const vendorMatch = (e.vendor || "").toLowerCase().includes(q);
        const billMatch = (e.bill_number || "").toLowerCase().includes(q);
        const catMatch = (e.category || "").toLowerCase().includes(q);
        if (!titleMatch && !vendorMatch && !billMatch && !catMatch) return false;
      }

      if (selectedCategory !== "all" && e.category !== selectedCategory) {
        return false;
      }

      const isCred = isCreditExpense(e.payment_method);
      if (statusFilter === "unpaid" && !isCred) return false;
      if (statusFilter === "paid" && isCred) return false;

      const expDate = (e.expense_date || "").slice(0, 10);
      if (dateFilter === "today") {
        if (expDate !== currentMonthMetrics.todayStr) return false;
      } else if (dateFilter === "this_month") {
        if (!expDate.startsWith(currentMonthMetrics.currentYearMonth)) return false;
      }

      return true;
    });
  }, [expenses, searchQuery, selectedCategory, statusFilter, dateFilter, currentMonthMetrics]);

  // Active statement vendor
  const activeStatementVendor = useMemo(() => {
    if (!statementVendor) return null;
    return vendorAccounts.find((v) => v.name.toLowerCase() === statementVendor.toLowerCase()) || null;
  }, [statementVendor, vendorAccounts]);

  // --- MODAL TRIGGERS ---
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

  // TRIGGER PAYMENT MARKING FOR AN EXPENSE
  const openMarkPaidModal = (exp: ExpenseRecord) => {
    setTargetExpense(exp);
    setMarkPaidAmount(String(exp.amount || ""));
    setMarkPaidMode("UPI / GPay / PhonePe");
    setMarkPaidDate(new Date().toISOString().slice(0, 10));
    setMarkPaidRef("");
    setMarkPaidModalOpen(true);
  };

  // TRIGGER SUPPLIER KHATA SETTLEMENT
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
    setSettleNote(target ? `Credit clearance for ${target}` : "");
    setSettleModalOpen(true);
  };

  // --- ACTION: SAVE EXPENSE (ADD / EDIT) ---
  const handleSaveExpense = async (e: FormEvent) => {
    e.preventDefault();
    const title = formTitle.trim();
    if (!title) {
      alert("Please enter the item / expense description.");
      return;
    }
    const amt = parseFloat(formAmount);
    if (!amt || isNaN(amt) || amt <= 0) {
      alert("Please enter a valid expense amount greater than zero.");
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
          : formPaymentType === "credit"
          ? `✓ Credit purchase of ₹${formatMoney(amt)} added to ${formVendor || "supplier"} Khata!`
          : `✓ Paid expense of ₹${formatMoney(amt)} recorded via ${formDirectMethod}!`
      );
      await loadData();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      alert(err.message || "Failed to save expense");
    } finally {
      setSubmittingExpense(false);
    }
  };

  // --- ACTION: EXECUTE MARK EXPENSE AS PAID (PAYMENT MARKING) ---
  const handleExecuteMarkPaid = async (e: FormEvent) => {
    e.preventDefault();
    if (!targetExpense) return;

    const originalAmt = Number(targetExpense.amount) || 0;
    const payAmt = parseFloat(markPaidAmount);

    if (isNaN(payAmt) || payAmt <= 0) {
      alert("Please enter a valid payment amount greater than zero.");
      return;
    }

    if (payAmt > originalAmt) {
      alert(`Payment amount (₹${formatMoney(payAmt)}) cannot exceed the bill amount of ₹${formatMoney(originalAmt)}.`);
      return;
    }

    try {
      setSubmittingMarkPaid(true);
      const cleanRef = markPaidRef.trim();
      const existingNote = (targetExpense.note || "").trim();
      let noteText = existingNote;
      if (cleanRef) {
        noteText = existingNote ? `${existingNote} • Paid via ${markPaidMode} (${cleanRef})` : `Paid via ${markPaidMode} (${cleanRef})`;
      } else {
        noteText = existingNote ? `${existingNote} • Paid via ${markPaidMode}` : `Paid via ${markPaidMode}`;
      }

      // CASE 1: Full Payment
      if (payAmt === originalAmt) {
        const payload = {
          payment_method: markPaidMode,
          expense_date: markPaidDate,
          note: noteText,
        };

        const res = await fetchWithAuth(`${API_URL}/expenses/${targetExpense.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!res.ok) throw new Error("Failed to mark expense as paid");

        setSuccessMsg(`✓ Bill #${targetExpense.id} ("${targetExpense.title}") marked as PAID via ${markPaidMode}!`);
      } else {
        // CASE 2: Partial Payment
        const remainingDue = originalAmt - payAmt;

        // Step 1: Update current bill to the paid amount
        const resUpdate = await fetchWithAuth(`${API_URL}/expenses/${targetExpense.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount: payAmt,
            payment_method: markPaidMode,
            expense_date: markPaidDate,
            note: `${noteText} (Partial payment of ₹${formatMoney(payAmt)} from ₹${formatMoney(originalAmt)})`,
          }),
        });

        if (!resUpdate.ok) throw new Error("Failed to update bill for partial payment");

        // Step 2: Create new credit bill for the remaining due
        await fetchWithAuth(`${API_URL}/expenses`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: `${targetExpense.title} (Balance Due)`,
            category: targetExpense.category,
            amount: remainingDue,
            expense_date: targetExpense.expense_date,
            payment_method: "Credit (On Account)",
            vendor: targetExpense.vendor,
            bill_number: targetExpense.bill_number,
            note: `Remaining balance due (₹${formatMoney(remainingDue)}) after partial settlement of ₹${formatMoney(payAmt)} on ${targetExpense.title}.`,
            event_id: targetExpense.event_id,
          }),
        });

        setSuccessMsg(
          `✓ Partial payment of ₹${formatMoney(payAmt)} marked as PAID via ${markPaidMode}! Balance of ₹${formatMoney(remainingDue)} remains in Khata.`
        );
      }

      setMarkPaidModalOpen(false);
      setTargetExpense(null);
      await loadData();
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (err: any) {
      alert(err.message || "Failed to mark expense as paid");
    } finally {
      setSubmittingMarkPaid(false);
    }
  };

  // --- ACTION: SAVE SUPPLIER SETTLEMENT ---
  const handleSaveSettlement = async (e: FormEvent) => {
    e.preventDefault();
    const vendor = settleVendor.trim();
    if (!vendor) {
      alert("Please select or enter the supplier / vendor name.");
      return;
    }
    const amt = parseFloat(settleAmount);
    if (!amt || isNaN(amt) || amt <= 0) {
      alert("Please enter a valid clearance amount greater than zero.");
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
      setSuccessMsg(`✓ Settlement of ₹${formatMoney(amt)} to ${vendor} via ${settleMode} recorded! Khata balance updated.`);
      await loadData();
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (err: any) {
      alert(err.message || "Failed to record settlement");
    } finally {
      setSubmittingSettle(false);
    }
  };

  // --- ACTION: DELETE EXPENSE ---
  const handleDeleteExpense = async (id: number, title: string) => {
    if (!window.confirm(`Are you sure you want to delete expense #${id} ("${title}")?`)) return;
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

  // --- ACTION: VOID SETTLEMENT ---
  const handleVoidSettlement = async (id: number, vendor: string, amt: number) => {
    if (!window.confirm(`Void settlement #${id} (₹${formatMoney(amt)} to ${vendor})? This will restore the supplier due.`)) {
      return;
    }
    try {
      const res = await fetchWithAuth(`${API_URL}/expenses/settlements/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to void settlement");
      setSuccessMsg(`✓ Settlement #${id} voided successfully.`);
      await loadData();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      alert(err.message || "Unable to void settlement");
    }
  };

  // Active supplier info for modal
  const activeSettleVendorData = useMemo(() => {
    if (!settleVendor || !settleVendor.trim()) return null;
    return vendorAccounts.find((v) => v.name.toLowerCase() === settleVendor.trim().toLowerCase()) || null;
  }, [settleVendor, vendorAccounts]);

  return (
    <main className="dashboard">
      <AppSidebar activeRoute="/expenses" />

      {/* Main Content Area */}
      <div className="main-content">
        {/* Topbar with Standard Application Integration */}
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
          <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0, flex: "1 1 280px" }}>
            <MobileMenuButton />
            <h1 style={{ margin: 0, fontSize: "19px", fontWeight: 800, color: "#24103f", whiteSpace: "nowrap" }}>
              Expense & Khata Management
            </h1>
            <span
              style={{
                fontSize: "12px",
                color: "#6b5b7e",
                background: "#f0edf5",
                padding: "4px 10px",
                borderRadius: "12px",
                fontWeight: 600,
                whiteSpace: "nowrap",
              }}
            >
              {expenses.length} Total Bills
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", justifyContent: "flex-end", flex: "1 1 auto" }}>
            {/* Quick Search */}
            <div
              className="search-box"
              style={{
                width: "240px",
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
                placeholder="Search expense, supplier..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  border: "none",
                  background: "transparent",
                  outline: "none",
                  width: "100%",
                  fontSize: "13px",
                  color: "#0f172a",
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

            {/* PRIMARY ACTIONS: RECORD EXPENSE & SETTLE SUPPLIER */}
            {!isOwner && (
              <>
                <button
                  type="button"
                  onClick={openNewExpenseModal}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    height: "38px",
                    background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "8px",
                    padding: "0 16px",
                    fontWeight: 700,
                    fontSize: "13px",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    boxShadow: "0 2px 6px rgba(37, 99, 235, 0.25)",
                  }}
                >
                  <span>＋</span> Record Expense
                </button>

                <button
                  type="button"
                  onClick={() => openSettleModal()}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    height: "38px",
                    background: "linear-gradient(135deg, #059669 0%, #047857 100%)",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "8px",
                    padding: "0 16px",
                    fontWeight: 700,
                    fontSize: "13px",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    boxShadow: "0 2px 6px rgba(5, 150, 105, 0.25)",
                  }}
                >
                  <span>🤝</span> Settle Supplier Due
                </button>
              </>
            )}

            <TopbarUserBadge />
          </div>
        </header>

        {/* Content Body */}
        <div className="page-content" style={{ padding: "24px" }}>
          <OwnerBanner />

          {/* Notifications */}
          {successMsg && (
            <div style={{ background: "#e8f8f0", border: "1px solid #a3e6c0", color: "#0d6832", padding: "12px 18px", borderRadius: "8px", marginBottom: "20px", fontSize: "14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>✓ {successMsg}</span>
              <button type="button" onClick={() => setSuccessMsg(null)} style={{ border: "none", background: "transparent", color: "#0d6832", cursor: "pointer", fontWeight: 700 }}>✕</button>
            </div>
          )}

          {error && (
            <div style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b", padding: "12px 18px", borderRadius: "8px", marginBottom: "20px", fontSize: "14px" }}>
              ⚠ {error}
            </div>
          )}

          {/* Metric Overview Cards (Matching App Design) */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: "16px", marginBottom: "24px" }}>
            {/* Total Month Spend */}
            <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "18px 20px", boxShadow: "0 2px 6px rgba(0,0,0,0.03)" }}>
              <div style={{ fontSize: "12px", color: "#64748b", fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase" }}>
                Total Spend This Month
              </div>
              <div style={{ fontSize: "26px", fontWeight: 900, color: "#0f172a", marginTop: "6px" }}>
                ₹{formatMoney(currentMonthMetrics.monthTotal)}
              </div>
              <div style={{ fontSize: "12px", color: "#64748b", marginTop: "4px" }}>
                All purchases & business outflows
              </div>
            </div>

            {/* Direct Paid */}
            <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "18px 20px", boxShadow: "0 2px 6px rgba(0,0,0,0.03)" }}>
              <div style={{ fontSize: "12px", color: "#059669", fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase" }}>
                Paid Directly (Cash / UPI)
              </div>
              <div style={{ fontSize: "26px", fontWeight: 900, color: "#059669", marginTop: "6px" }}>
                ₹{formatMoney(currentMonthMetrics.directPaid)}
              </div>
              <div style={{ fontSize: "12px", color: "#64748b", marginTop: "4px" }}>
                Immediate settled expenses
              </div>
            </div>

            {/* Unpaid Credit Bills */}
            <div
              onClick={() => {
                setActiveTab("expenses");
                setStatusFilter("unpaid");
              }}
              style={{
                background: unpaidCreditTotal > 0 ? "#fffafb" : "#fff",
                border: unpaidCreditTotal > 0 ? "1px solid #fecaca" : "1px solid #e2e8f0",
                borderRadius: "12px",
                padding: "18px 20px",
                boxShadow: "0 2px 6px rgba(0,0,0,0.03)",
                cursor: "pointer",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontSize: "12px", color: unpaidCreditTotal > 0 ? "#dc2626" : "#64748b", fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase" }}>
                  Unpaid Credit Bills
                </div>
                {unpaidCreditBills.length > 0 && (
                  <span style={{ background: "#fef2f2", color: "#dc2626", fontSize: "11px", fontWeight: 800, padding: "2px 6px", borderRadius: "6px", border: "1px solid #fecaca" }}>
                    {unpaidCreditBills.length} BILLS DUE
                  </span>
                )}
              </div>
              <div style={{ fontSize: "26px", fontWeight: 900, color: unpaidCreditTotal > 0 ? "#dc2626" : "#0f172a", marginTop: "6px" }}>
                ₹{formatMoney(unpaidCreditTotal)}
              </div>
              <div style={{ fontSize: "12px", color: unpaidCreditTotal > 0 ? "#b91c1c" : "#64748b", marginTop: "4px", fontWeight: 600 }}>
                {unpaidCreditBills.length > 0 ? "Click to view & Mark Paid →" : "✓ No unpaid bills"}
              </div>
            </div>

            {/* Supplier Khata Dues */}
            <div
              onClick={() => setActiveTab("khata")}
              style={{
                background: totalOutstandingDue > 0 ? "#fef2f2" : "#f0fdf4",
                border: totalOutstandingDue > 0 ? "1px solid #fecaca" : "1px solid #bbf7d0",
                borderRadius: "12px",
                padding: "18px 20px",
                boxShadow: "0 2px 6px rgba(0,0,0,0.03)",
                cursor: "pointer",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontSize: "12px", color: totalOutstandingDue > 0 ? "#dc2626" : "#059669", fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase" }}>
                  Supplier Khata Dues
                </div>
                {dueVendors.length > 0 && (
                  <span style={{ background: "#dc2626", color: "#ffffff", fontSize: "11px", fontWeight: 900, padding: "2px 7px", borderRadius: "10px" }}>
                    {dueVendors.length} VENDORS
                  </span>
                )}
              </div>
              <div style={{ fontSize: "26px", fontWeight: 900, color: totalOutstandingDue > 0 ? "#dc2626" : "#059669", marginTop: "6px" }}>
                ₹{formatMoney(totalOutstandingDue)}
              </div>
              <div style={{ fontSize: "12px", color: totalOutstandingDue > 0 ? "#b91c1c" : "#047857", marginTop: "4px", fontWeight: 600 }}>
                {dueVendors.length > 0 ? "Click to settle supplier accounts →" : "✓ All Khata accounts cleared"}
              </div>
            </div>
          </div>

          {/* MAIN TABS NAVIGATION */}
          <div
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
                fontSize: "14px",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <span>📋</span> All Expenses ({expenses.length})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("khata")}
              style={{
                padding: "12px 20px",
                border: "none",
                background: "transparent",
                borderBottom: activeTab === "khata" ? "3px solid #059669" : "3px solid transparent",
                color: activeTab === "khata" ? "#059669" : "#64748b",
                fontWeight: 800,
                fontSize: "14px",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <span>🏪</span> Supplier Khata Accounts ({vendorAccounts.length})
              {dueVendors.length > 0 && (
                <span style={{ background: "#dc2626", color: "#fff", fontSize: "11px", padding: "2px 7px", borderRadius: "10px", fontWeight: 800 }}>
                  {dueVendors.length} DUE
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("history")}
              style={{
                padding: "12px 20px",
                border: "none",
                background: "transparent",
                borderBottom: activeTab === "history" ? "3px solid #7c3aed" : "3px solid transparent",
                color: activeTab === "history" ? "#7c3aed" : "#64748b",
                fontWeight: 800,
                fontSize: "14px",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <span>📜</span> Settlement History ({settlements.length})
            </button>
          </div>

          {/* ======================================================== */}
          {/* TAB 1: ALL EXPENSES (WITH PAYMENT MARKING) */}
          {/* ======================================================== */}
          {activeTab === "expenses" && (
            <div>
              {/* Filter Strip */}
              <div
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
                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
                  {/* Status Pills */}
                  <div style={{ display: "flex", background: "#f1f5f9", borderRadius: "8px", padding: "3px" }}>
                    <button
                      type="button"
                      onClick={() => setStatusFilter("all")}
                      style={{
                        padding: "6px 12px",
                        borderRadius: "6px",
                        border: "none",
                        background: statusFilter === "all" ? "#ffffff" : "transparent",
                        color: statusFilter === "all" ? "#0f172a" : "#64748b",
                        fontWeight: statusFilter === "all" ? 800 : 600,
                        fontSize: "12px",
                        cursor: "pointer",
                        boxShadow: statusFilter === "all" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                      }}
                    >
                      All ({expenses.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setStatusFilter("unpaid")}
                      style={{
                        padding: "6px 12px",
                        borderRadius: "6px",
                        border: "none",
                        background: statusFilter === "unpaid" ? "#dc2626" : "transparent",
                        color: statusFilter === "unpaid" ? "#ffffff" : "#dc2626",
                        fontWeight: statusFilter === "unpaid" ? 800 : 700,
                        fontSize: "12px",
                        cursor: "pointer",
                      }}
                    >
                      🔴 Unpaid Credit ({unpaidCreditBills.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setStatusFilter("paid")}
                      style={{
                        padding: "6px 12px",
                        borderRadius: "6px",
                        border: "none",
                        background: statusFilter === "paid" ? "#059669" : "transparent",
                        color: statusFilter === "paid" ? "#ffffff" : "#059669",
                        fontWeight: statusFilter === "paid" ? 800 : 700,
                        fontSize: "12px",
                        cursor: "pointer",
                      }}
                    >
                      ✓ Paid ({expenses.length - unpaidCreditBills.length})
                    </button>
                  </div>

                  {/* Category Filter */}
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    style={{
                      padding: "8px 12px",
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

                  {/* Date Filter */}
                  <select
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value as any)}
                    style={{
                      padding: "8px 12px",
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
                </div>

                {(searchQuery || selectedCategory !== "all" || statusFilter !== "all" || dateFilter !== "this_month") && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery("");
                      setSelectedCategory("all");
                      setStatusFilter("all");
                      setDateFilter("this_month");
                    }}
                    style={{
                      border: "none",
                      background: "transparent",
                      color: "#dc2626",
                      fontSize: "12px",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    ✕ Reset Filters
                  </button>
                )}
              </div>

              {/* Table */}
              <div style={{ background: "#ffffff", borderRadius: "12px", border: "1px solid #e2e8f0", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.02)" }}>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", textAlign: "left" }}>
                    <thead>
                      <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0", color: "#475569", fontWeight: 700 }}>
                        <th style={{ padding: "12px 16px" }}>Date</th>
                        <th style={{ padding: "12px 16px" }}>Bill #</th>
                        <th style={{ padding: "12px 16px" }}>Description / Item</th>
                        <th style={{ padding: "12px 16px" }}>Category</th>
                        <th style={{ padding: "12px 16px" }}>Supplier / Payee</th>
                        <th style={{ padding: "12px 16px", textAlign: "right" }}>Amount (₹)</th>
                        <th style={{ padding: "12px 16px" }}>Status</th>
                        <th style={{ padding: "12px 16px", textAlign: "center" }}>Payment Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading ? (
                        <tr>
                          <td colSpan={8} style={{ padding: "40px", textAlign: "center", color: "#64748b" }}>
                            Loading expenses...
                          </td>
                        </tr>
                      ) : filteredExpenses.length === 0 ? (
                        <tr>
                          <td colSpan={8} style={{ padding: "50px 20px", textAlign: "center" }}>
                            <div style={{ fontSize: "32px", marginBottom: "8px" }}>📝</div>
                            <div style={{ fontWeight: 800, color: "#0f172a", fontSize: "15px" }}>No expenses match your filters</div>
                            <div style={{ color: "#64748b", fontSize: "13px", marginTop: "4px", marginBottom: "16px" }}>
                              Try resetting your filters or record a new expense.
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
                                ＋ Record New Expense
                              </button>
                            )}
                          </td>
                        </tr>
                      ) : (
                        filteredExpenses.map((exp) => {
                          const isCredit = isCreditExpense(exp.payment_method);

                          return (
                            <tr key={exp.id} style={{ borderBottom: "1px solid #f1f5f9", background: isCredit ? "#fffafb" : "#ffffff" }}>
                              <td style={{ padding: "12px 16px", color: "#0f172a", fontWeight: 600, whiteSpace: "nowrap" }}>
                                {formatDate(exp.expense_date)}
                              </td>
                              <td style={{ padding: "12px 16px", fontFamily: "monospace", color: "#64748b", fontSize: "12px" }}>
                                {exp.bill_number ? `#${exp.bill_number}` : `EXP-${String(exp.id).padStart(4, "0")}`}
                              </td>
                              <td style={{ padding: "12px 16px" }}>
                                <div style={{ fontWeight: 700, color: "#0f172a" }}>{exp.title}</div>
                                {exp.note && (
                                  <div style={{ fontSize: "11px", color: "#64748b", marginTop: "2px" }}>
                                    {exp.note}
                                  </div>
                                )}
                              </td>
                              <td style={{ padding: "12px 16px" }}>
                                <span style={{ background: "#f1f5f9", padding: "3px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: 600, color: "#334155" }}>
                                  {exp.category}
                                </span>
                              </td>
                              <td style={{ padding: "12px 16px", fontWeight: 600, color: "#0f172a" }}>
                                {exp.vendor ? (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setStatementVendor(exp.vendor!);
                                      setActiveTab("khata");
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
                                    title="View Supplier Khata"
                                  >
                                    🏪 {exp.vendor}
                                  </button>
                                ) : (
                                  <span style={{ color: "#94a3b8" }}>Direct / Store</span>
                                )}
                              </td>
                              <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: 900, fontSize: "14px", color: isCredit ? "#dc2626" : "#0f172a" }}>
                                ₹{formatMoney(exp.amount)}
                              </td>
                              <td style={{ padding: "12px 16px", whiteSpace: "nowrap" }}>
                                {isCredit ? (
                                  <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "4px 8px", borderRadius: "6px", background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", fontSize: "11px", fontWeight: 800 }}>
                                    🔴 Unpaid Credit
                                  </span>
                                ) : (
                                  <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "4px 8px", borderRadius: "6px", background: "#f0fdf4", color: "#059669", border: "1px solid #bbf7d0", fontSize: "11px", fontWeight: 700 }}>
                                    ✓ Paid ({exp.payment_method})
                                  </span>
                                )}
                              </td>
                              <td style={{ padding: "12px 16px", textAlign: "center" }}>
                                <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "6px" }}>
                                  {/* THE CRITICAL "MARK AS PAID" BUTTON */}
                                  {!isOwner && isCredit && (
                                    <button
                                      type="button"
                                      onClick={() => openMarkPaidModal(exp)}
                                      title="Mark this bill as Paid"
                                      style={{
                                        padding: "6px 12px",
                                        borderRadius: "6px",
                                        background: "#16a34a",
                                        color: "#ffffff",
                                        border: "none",
                                        fontSize: "12px",
                                        fontWeight: 800,
                                        cursor: "pointer",
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: "4px",
                                        boxShadow: "0 1px 3px rgba(22, 163, 74, 0.3)",
                                        whiteSpace: "nowrap",
                                      }}
                                    >
                                      <span>💵</span> Mark Paid
                                    </button>
                                  )}

                                  {!isOwner && (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => openEditExpenseModal(exp)}
                                        title="Edit bill"
                                        style={{
                                          padding: "5px 8px",
                                          borderRadius: "6px",
                                          border: "1px solid #cbd5e1",
                                          background: "#ffffff",
                                          color: "#475569",
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
                                        title="Delete bill"
                                        style={{
                                          padding: "5px 8px",
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
          {/* TAB 2: SUPPLIER KHATA & DUES */}
          {/* ======================================================== */}
          {activeTab === "khata" && (
            <div>
              {/* Detailed statement view if selected */}
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
                        🏪 {activeStatementVendor.name} - Statement & Khata
                      </h2>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                      <div style={{ textAlign: "right" }}>
                        <span style={{ fontSize: "11px", color: activeStatementVendor.pendingBalance > 0 ? "#dc2626" : "#059669", fontWeight: 800 }}>
                          OUTSTANDING DUE
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

                  {/* Interleaved statement table */}
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", textAlign: "left" }}>
                      <thead>
                        <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0", color: "#475569", fontWeight: 700 }}>
                          <th style={{ padding: "10px 14px" }}>Date</th>
                          <th style={{ padding: "10px 14px" }}>Type</th>
                          <th style={{ padding: "10px 14px" }}>Particulars / Ref</th>
                          <th style={{ padding: "10px 14px", textAlign: "right" }}>Credit Bill (+₹)</th>
                          <th style={{ padding: "10px 14px", textAlign: "right" }}>Payment Cleared (-₹)</th>
                          <th style={{ padding: "10px 14px", textAlign: "center" }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          const items: Array<{
                            date: string;
                            type: "credit_bill" | "settlement";
                            title: string;
                            billAmt: number;
                            settleAmt: number;
                            rawExpense?: ExpenseRecord;
                            rawSettlement?: ExpenseSettlementRecord;
                          }> = [];

                          activeStatementVendor.expenses.forEach((e) => {
                            if (isCreditExpense(e.payment_method)) {
                              items.push({
                                date: (e.expense_date || "").slice(0, 10),
                                type: "credit_bill",
                                title: e.title,
                                billAmt: e.amount || 0,
                                settleAmt: 0,
                                rawExpense: e,
                              });
                            }
                          });

                          activeStatementVendor.settlements.forEach((s) => {
                            items.push({
                              date: (s.settlement_date || "").slice(0, 10),
                              type: "settlement",
                              title: `Clearance via ${s.payment_mode}${s.reference_no ? ` (${s.reference_no})` : ""}`,
                              billAmt: 0,
                              settleAmt: s.amount || 0,
                              rawSettlement: s,
                            });
                          });

                          items.sort((a, b) => b.date.localeCompare(a.date));

                          if (items.length === 0) {
                            return (
                              <tr>
                                <td colSpan={6} style={{ padding: "30px", textAlign: "center", color: "#64748b" }}>
                                  No credit transactions found for this supplier.
                                </td>
                              </tr>
                            );
                          }

                          return items.map((it, idx) => (
                            <tr key={idx} style={{ borderBottom: "1px solid #f1f5f9", background: it.type === "settlement" ? "#f0fdf4" : "#ffffff" }}>
                              <td style={{ padding: "10px 14px", fontWeight: 600 }}>{formatDate(it.date)}</td>
                              <td style={{ padding: "10px 14px" }}>
                                {it.type === "credit_bill" ? (
                                  <span style={{ background: "#fef2f2", color: "#dc2626", padding: "2px 6px", borderRadius: "4px", fontSize: "11px", fontWeight: 700 }}>
                                    🔴 Unpaid Bill
                                  </span>
                                ) : (
                                  <span style={{ background: "#ecfdf5", color: "#059669", padding: "2px 6px", borderRadius: "4px", fontSize: "11px", fontWeight: 700 }}>
                                    🟢 Payment Cleared
                                  </span>
                                )}
                              </td>
                              <td style={{ padding: "10px 14px", fontWeight: 600, color: "#0f172a" }}>{it.title}</td>
                              <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 800, color: "#dc2626" }}>
                                {it.billAmt > 0 ? `+ ₹${formatMoney(it.billAmt)}` : "-"}
                              </td>
                              <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 800, color: "#059669" }}>
                                {it.settleAmt > 0 ? `- ₹${formatMoney(it.settleAmt)}` : "-"}
                              </td>
                              <td style={{ padding: "10px 14px", textAlign: "center" }}>
                                {!isOwner && it.type === "credit_bill" && it.rawExpense && (
                                  <button
                                    type="button"
                                    onClick={() => openMarkPaidModal(it.rawExpense!)}
                                    style={{
                                      padding: "4px 8px",
                                      borderRadius: "6px",
                                      background: "#16a34a",
                                      color: "#ffffff",
                                      border: "none",
                                      fontSize: "11px",
                                      fontWeight: 800,
                                      cursor: "pointer",
                                    }}
                                  >
                                    💵 Mark Paid
                                  </button>
                                )}
                              </td>
                            </tr>
                          ));
                        })()}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}

              {/* SUPPLIERS AWAITING PAYMENT (CARDS) */}
              <div style={{ marginBottom: "28px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
                  <div>
                    <h2 style={{ margin: 0, fontSize: "17px", fontWeight: 800, color: "#0f172a" }}>
                      🔴 Suppliers Awaiting Payment ({dueVendors.length})
                    </h2>
                    <span style={{ fontSize: "13px", color: "#64748b" }}>
                      Suppliers with outstanding balances that need settlement
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
                      }}
                    >
                      🤝 Settle Any Supplier
                    </button>
                  )}
                </div>

                {dueVendors.length === 0 ? (
                  <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "12px", padding: "24px", textAlign: "center", color: "#065f46" }}>
                    <div style={{ fontSize: "28px", marginBottom: "6px" }}>🎉</div>
                    <div style={{ fontWeight: 800, fontSize: "16px" }}>All Supplier Accounts Are Settled!</div>
                    <div style={{ fontSize: "13px", color: "#047857", marginTop: "2px" }}>
                      You currently owe ₹0.00 to all suppliers.
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
                          boxShadow: "0 2px 8px rgba(220, 38, 38, 0.05)",
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
                                {vendor.creditBillCount} credit bills • Last: {formatDate(vendor.lastDate)}
                              </span>
                            </div>
                            <span style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", padding: "3px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: 800 }}>
                              PAYMENT DUE
                            </span>
                          </div>

                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", background: "#f8fafc", padding: "10px 12px", borderRadius: "8px", margin: "14px 0", fontSize: "12px" }}>
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
                            View Statement
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ALL SUPPLIERS OVERVIEW */}
              <div style={{ background: "#ffffff", borderRadius: "12px", border: "1px solid #e2e8f0", overflow: "hidden" }}>
                <div style={{ padding: "16px 20px", borderBottom: "1px solid #e2e8f0" }}>
                  <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 800, color: "#0f172a" }}>
                    📋 All Supplier Accounts ({vendorAccounts.length})
                  </h3>
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", textAlign: "left" }}>
                    <thead>
                      <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0", color: "#475569", fontWeight: 700 }}>
                        <th style={{ padding: "12px 16px" }}>Supplier Name</th>
                        <th style={{ padding: "12px 16px", textAlign: "right" }}>Total Purchases</th>
                        <th style={{ padding: "12px 16px", textAlign: "right" }}>Credit Taken</th>
                        <th style={{ padding: "12px 16px", textAlign: "right" }}>Amount Cleared</th>
                        <th style={{ padding: "12px 16px", textAlign: "right" }}>Current Due</th>
                        <th style={{ padding: "12px 16px", textAlign: "center" }}>Status</th>
                        <th style={{ padding: "12px 16px", textAlign: "center" }}>Actions</th>
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
                          <td style={{ padding: "12px 16px", textAlign: "center" }}>
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
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 3: SETTLEMENT HISTORY */}
          {/* ======================================================== */}
          {activeTab === "history" && (
            <div style={{ background: "#ffffff", borderRadius: "12px", border: "1px solid #e2e8f0", overflow: "hidden" }}>
              <div style={{ padding: "16px 20px", borderBottom: "1px solid #e2e8f0" }}>
                <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 800, color: "#0f172a" }}>
                  📜 All Settlement Payments ({settlements.length})
                </h3>
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
                      <th style={{ padding: "12px 16px", textAlign: "center" }}>Actions</th>
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
                          <td style={{ padding: "12px 16px", textAlign: "center" }}>
                            {!isOwner && (
                              <button
                                type="button"
                                onClick={() => handleVoidSettlement(s.id, s.vendor, s.amount)}
                                title="Void clearance"
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
          )}
        </div>
      </div>

      {/* ======================================================== */}
      {/* MODAL 1: ADD / EDIT EXPENSE */}
      {/* ======================================================== */}
      {expenseModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.65)",
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
            <div style={{ background: "#2563eb", color: "#ffffff", padding: "18px 22px", borderRadius: "16px 16px 0 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 900 }}>
                  {editingExpenseId ? "✏️ Edit Expense" : "＋ Record New Expense"}
                </h3>
                <span style={{ fontSize: "12px", opacity: 0.9 }}>
                  Enter bill details and select Direct Paid or Credit Khata
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

            <form onSubmit={handleSaveExpense} style={{ padding: "20px 22px" }}>
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
                          padding: "4px 8px",
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

              <div style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 700, color: "#0f172a", marginBottom: "6px" }}>
                  What did you buy? (Item / Description) *
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

              {/* PAYMENT TYPE TOGGLE */}
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
                      Mark as Unpaid (Pay Later)
                    </div>
                  </button>
                </div>
              </div>

              {/* Direct paid method chips */}
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

              {/* Supplier / Vendor */}
              <div style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 700, color: "#0f172a", marginBottom: "6px" }}>
                  Supplier / Vendor Name {formPaymentType === "credit" && <span style={{ color: "#dc2626" }}>* (Required for Khata)</span>}
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

              {/* Date & Bill # */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "16px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#0f172a", marginBottom: "4px" }}>
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
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#0f172a", marginBottom: "4px" }}>
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
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#0f172a", marginBottom: "4px" }}>
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
      {/* MODAL 2: MARK EXPENSE AS PAID (PAYMENT MARKING) */}
      {/* ======================================================== */}
      {markPaidModalOpen && targetExpense && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.65)",
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
            <div style={{ background: "#16a34a", color: "#ffffff", padding: "18px 22px", borderRadius: "16px 16px 0 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 900 }}>
                  💵 Mark Expense as Paid
                </h3>
                <span style={{ fontSize: "12px", opacity: 0.9 }}>
                  #{targetExpense.id} • {targetExpense.title}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setMarkPaidModalOpen(false)}
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

            <form onSubmit={handleExecuteMarkPaid} style={{ padding: "20px 22px" }}>
              {/* Bill Details Box */}
              <div
                style={{
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: "10px",
                  padding: "12px 16px",
                  marginBottom: "16px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <div style={{ fontSize: "11px", color: "#64748b", fontWeight: 600 }}>Supplier:</div>
                  <div style={{ fontSize: "14px", fontWeight: 800, color: "#0f172a" }}>
                    🏪 {targetExpense.vendor || "Direct / Store"}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: "11px", color: "#dc2626", fontWeight: 700 }}>Total Bill Amount:</div>
                  <div style={{ fontSize: "18px", fontWeight: 900, color: "#dc2626" }}>
                    ₹{formatMoney(targetExpense.amount)}
                  </div>
                </div>
              </div>

              {/* Settlement Amount & Quick Chips */}
              <div style={{ marginBottom: "16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                  <label style={{ fontSize: "13px", fontWeight: 700, color: "#0f172a" }}>
                    Settlement Amount (₹) *
                  </label>
                  <div style={{ display: "flex", gap: "6px" }}>
                    <button
                      type="button"
                      onClick={() => setMarkPaidAmount(String(targetExpense.amount))}
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
                      ⚡ Full Amount (₹{formatMoney(targetExpense.amount)})
                    </button>
                    <button
                      type="button"
                      onClick={() => setMarkPaidAmount(String(Math.round(targetExpense.amount / 2)))}
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
                </div>

                <div style={{ position: "relative" }}>
                  <span style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", fontSize: "16px", fontWeight: 800, color: "#16a34a" }}>
                    ₹
                  </span>
                  <input
                    type="number"
                    step="any"
                    min="0.01"
                    max={targetExpense.amount}
                    placeholder="0.00"
                    value={markPaidAmount}
                    onChange={(e) => setMarkPaidAmount(e.target.value)}
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
                {parseFloat(markPaidAmount) < targetExpense.amount && (
                  <div style={{ fontSize: "11px", color: "#dc2626", marginTop: "4px", fontWeight: 600 }}>
                    ℹ️ Remaining balance (₹{formatMoney(targetExpense.amount - parseFloat(markPaidAmount))}) will stay as an unpaid credit bill.
                  </div>
                )}
              </div>

              {/* Payment Mode Selection */}
              <div style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 700, color: "#0f172a", marginBottom: "6px" }}>
                  Paid Via (Mode) *
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "6px" }}>
                  {DIRECT_PAYMENT_METHODS.map((pm) => (
                    <button
                      key={pm}
                      type="button"
                      onClick={() => setMarkPaidMode(pm)}
                      style={{
                        padding: "8px 10px",
                        borderRadius: "6px",
                        border: markPaidMode === pm ? "1px solid #16a34a" : "1px solid #cbd5e1",
                        background: markPaidMode === pm ? "#16a34a" : "#ffffff",
                        color: markPaidMode === pm ? "#ffffff" : "#334155",
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

              {/* Payment Date & Reference */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "16px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#0f172a", marginBottom: "4px" }}>
                    Payment Date *
                  </label>
                  <input
                    type="date"
                    value={markPaidDate}
                    onChange={(e) => setMarkPaidDate(e.target.value)}
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
                    Reference / UTR # (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. UTR-98243, Cheque #"
                    value={markPaidRef}
                    onChange={(e) => setMarkPaidRef(e.target.value)}
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
                  onClick={() => setMarkPaidModalOpen(false)}
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
                  disabled={submittingMarkPaid}
                  style={{
                    padding: "10px 22px",
                    borderRadius: "8px",
                    border: "none",
                    background: "#16a34a",
                    color: "#ffffff",
                    fontWeight: 800,
                    fontSize: "14px",
                    cursor: submittingMarkPaid ? "not-allowed" : "pointer",
                  }}
                >
                  {submittingMarkPaid ? "Marking..." : `✓ Confirm & Mark Paid (₹${formatMoney(parseFloat(markPaidAmount) || 0)})`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 3: SETTLE SUPPLIER KHATA DUE */}
      {/* ======================================================== */}
      {settleModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.65)",
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
            <div style={{ background: "#059669", color: "#ffffff", padding: "18px 22px", borderRadius: "16px 16px 0 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 900 }}>
                  🤝 Settle Supplier Khata Due
                </h3>
                <span style={{ fontSize: "12px", opacity: 0.9 }}>
                  Record a payment clearance to reduce vendor credit balance
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

            <form onSubmit={handleSaveSettlement} style={{ padding: "20px 22px" }}>
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
    </main>
  );
}
