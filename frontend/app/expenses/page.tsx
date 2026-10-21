"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth, fetchWithAuth } from "../lib/auth";
import { OwnerBanner, TopbarUserBadge, AppSidebar, MobileMenuButton } from "../components/AuthBar";

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

type ExpenseSettlementRecord = {
  id: number;
  vendor: string;
  amount: number;
  settlement_date: string;
  payment_mode: string;
  reference_no?: string | null;
  note?: string | null;
};

type EventOption = {
  id: number;
  date: string;
  customer_name: string;
  event_type: string;
  place: string;
};

type DatePreset = "all" | "today" | "this_week" | "this_month" | "last_month" | "custom";
type LedgerTab = "general" | "vendors" | "settlement" | "audit";
type LedgerEntryFilter = "all" | "paid" | "credit" | "clearances";

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

const DIRECT_PAYMENT_METHODS = [
  "Cash",
  "UPI / GPay / PhonePe",
  "Bank Transfer / NEFT",
  "Company Card",
  "Cheque",
];

const CLEARANCE_PAYMENT_METHODS = [
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

function isCreditExpense(paymentMethod?: string | null): boolean {
  if (!paymentMethod) return false;
  const m = paymentMethod.toLowerCase().trim();
  return m.includes("credit") || m.includes("account") || m.includes("due") || m.includes("payable");
}

type VendorAccount = {
  name: string;
  totalBilled: number;
  totalCredit: number;
  totalDirectPaid: number;
  totalCleared: number;
  pendingBalance: number;
  billCount: number;
  creditBillCount: number;
  directPaidCount: number;
  clearanceCount: number;
  lastDate: string;
  categories: Record<string, number>;
  expenses: ExpenseRecord[];
  settlements: ExpenseSettlementRecord[];
};

export default function ExpensesPage() {
  const router = useRouter();
  const { user, isOwner } = useAuth();

  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [settlements, setSettlements] = useState<ExpenseSettlementRecord[]>([]);
  const [events, setEvents] = useState<EventOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Active Tab
  const [activeTab, setActiveTab] = useState<LedgerTab>("general");

  // Selected Vendor for Individual Account Ledger View
  const [selectedVendor, setSelectedVendor] = useState<string | null>(null);

  // Filters for Unified Ledger
  const [entryTypeFilter, setEntryTypeFilter] = useState<LedgerEntryFilter>("all"); // all | paid | credit | clearances
  const [searchQuery, setSearchQuery] = useState("");
  const [datePreset, setDatePreset] = useState<DatePreset>("all");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [allocationFilter, setAllocationFilter] = useState("All"); // All | Event | Overhead
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");

  // Filters for Vendor Accounts Tab
  const [vendorSearch, setVendorSearch] = useState("");
  const [vendorStatusFilter, setVendorStatusFilter] = useState<"all" | "due" | "settled">("all");

  // Modal State for Add / Edit Expense
  const [modalOpen, setModalOpen] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form Fields for Add / Edit Expense
  const [formType, setFormType] = useState<"paid" | "credit">("paid"); // Default: Direct Paid
  const [formTitle, setFormTitle] = useState("");
  const [formCategory, setFormCategory] = useState(CATEGORIES[0]);
  const [formAmount, setFormAmount] = useState("");
  const [formDate, setFormDate] = useState(new Date().toISOString().slice(0, 10));
  const [formEventId, setFormEventId] = useState<number | "">("");
  const [formPaymentMethod, setFormPaymentMethod] = useState("Cash");
  const [formVendor, setFormVendor] = useState("");
  const [formBillNumber, setFormBillNumber] = useState("");
  const [formNote, setFormNote] = useState("");

  // Modal State for CREDIT CLEARANCE (Settlement)
  const [settleModalOpen, setSettleModalOpen] = useState(false);
  const [settling, setSettling] = useState(false);
  const [settleVendor, setSettleVendor] = useState("");
  const [isCustomVendor, setIsCustomVendor] = useState(false);
  const [settleAmount, setSettleAmount] = useState("");
  const [settleDate, setSettleDate] = useState(new Date().toISOString().slice(0, 10));
  const [settleMode, setSettleMode] = useState(CLEARANCE_PAYMENT_METHODS[0]);
  const [settleReference, setSettleReference] = useState("");
  const [settleNote, setSettleNote] = useState("");

  // Modal State for QUICK MARK EXPENSE AS PAID
  const [markPaidModalOpen, setMarkPaidModalOpen] = useState(false);
  const [targetExpense, setTargetExpense] = useState<ExpenseRecord | null>(null);
  const [markPaidMode, setMarkPaidMode] = useState("Cash");
  const [markPaidDate, setMarkPaidDate] = useState(new Date().toISOString().slice(0, 10));
  const [markPaidRef, setMarkPaidRef] = useState("");
  const [markingPaid, setMarkingPaid] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [expRes, eventsRes, settleRes] = await Promise.all([
        fetch(`${API_URL}/expenses`, { cache: "no-store" }),
        fetch(`${API_URL}/events`, { cache: "no-store" }),
        fetch(`${API_URL}/expenses/settlements`, { cache: "no-store" }).catch(() => null),
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

      if (settleRes && settleRes.ok) {
        const sData = await settleRes.json();
        setSettlements(Array.isArray(sData) ? sData : []);
      } else if (settleRes && !settleRes.ok) {
        console.error("Failed to load settlements:", settleRes.status);
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

  // Unique vendor list for autocomplete suggestions
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

  // Date boundary calculations
  const dateBoundaries = useMemo(() => {
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);

    const dayOfWeek = today.getDay();
    const distanceToMonday = (dayOfWeek + 6) % 7;
    const monday = new Date(today);
    monday.setDate(today.getDate() - distanceToMonday);
    const thisWeekStart = monday.toISOString().slice(0, 10);

    const currentYearMonth = todayStr.slice(0, 7);
    const prevMonthDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const lastYearMonth = prevMonthDate.toISOString().slice(0, 7);

    return {
      todayStr,
      thisWeekStart,
      currentYearMonth,
      lastYearMonth,
    };
  }, []);

  // Settlement totals mapped by vendor (normalized to lowercase)
  const settlementsByVendor = useMemo(() => {
    const map: Record<string, number> = {};
    settlements.forEach((s) => {
      const v = (s.vendor?.trim() || "Direct / Cash Outflows").toLowerCase();
      map[v] = (map[v] || 0) + (s.amount || 0);
    });
    return map;
  }, [settlements]);

  // Grouped Vendor Accounts & Balances (Accounts Payable / Supplier Khata)
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
          directPaidCount: 0,
          clearanceCount: 0,
          lastDate: "",
          categories: {},
          expenses: [],
          settlements: [],
        };
      }
      const item = map[vName];
      const amt = e.amount || 0;
      item.totalBilled += amt;
      item.billCount += 1;

      if (isCreditExpense(e.payment_method)) {
        item.totalCredit += amt;
        item.creditBillCount += 1;
      } else {
        item.totalDirectPaid += amt;
        item.directPaidCount += 1;
      }

      const d = e.expense_date ? e.expense_date.slice(0, 10) : "";
      if (d > item.lastDate) item.lastDate = d;
      const cat = e.category || "Miscellaneous";
      item.categories[cat] = (item.categories[cat] || 0) + amt;
      item.expenses.push(e);
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
          directPaidCount: 0,
          clearanceCount: 0,
          lastDate: "",
          categories: {},
          expenses: [],
          settlements: [],
        };
      }
      const item = map[vName];
      item.clearanceCount += 1;
      const d = s.settlement_date ? s.settlement_date.slice(0, 10) : "";
      if (d > item.lastDate) item.lastDate = d;
      item.settlements.push(s);
    });

    // Populate settlements cleared and calculate pending credit balance:
    // Only goods purchased on credit generate a pending balance!
    Object.values(map).forEach((item) => {
      item.totalCleared = settlementsByVendor[item.name.toLowerCase()] || 0;
      item.pendingBalance = Math.max(0, item.totalCredit - item.totalCleared);
    });

    return Object.values(map).sort((a, b) => b.pendingBalance - a.pendingBalance || b.totalCredit - a.totalCredit || b.totalBilled - a.totalBilled);
  }, [expenses, settlements, settlementsByVendor]);

  // Filtered Vendor Accounts for the Vendors / Accounts Payable Tab
  const filteredVendorAccounts = useMemo(() => {
    return vendorAccounts.filter((v) => {
      if (vendorSearch.trim()) {
        const q = vendorSearch.toLowerCase().trim();
        if (!v.name.toLowerCase().includes(q)) return false;
      }
      if (vendorStatusFilter === "due" && v.pendingBalance <= 0) return false;
      if (vendorStatusFilter === "settled" && v.pendingBalance > 0) return false;
      return true;
    });
  }, [vendorAccounts, vendorSearch, vendorStatusFilter]);

  // Count of vendor accounts with pending due credit balances
  const pendingVendorsCount = useMemo(() => {
    return vendorAccounts.filter((v) => v.pendingBalance > 0).length;
  }, [vendorAccounts]);

  // Active Selected Vendor Details & Statement
  const selectedVendorData = useMemo(() => {
    if (!selectedVendor) return null;
    const vendorObj = vendorAccounts.find((v) => v.name === selectedVendor);
    if (!vendorObj) return null;

    const allVendorItems: Array<{
      id: string;
      rawId: number;
      kind: "credit_bill" | "paid_expense" | "clearance";
      date: string;
      refNumber: string;
      title: string;
      category: string;
      paymentMode: string;
      totalAmount: number;
      creditIncurred: number;
      creditCleared: number;
      runningCreditBalance: number;
      note?: string | null;
      rawExpense?: ExpenseRecord;
      rawSettlement?: ExpenseSettlementRecord;
    }> = [];

    vendorObj.expenses.forEach((e) => {
      const isCredit = isCreditExpense(e.payment_method);
      const amt = e.amount || 0;
      allVendorItems.push({
        id: `exp-${e.id}`,
        rawId: e.id,
        kind: isCredit ? "credit_bill" : "paid_expense",
        date: e.expense_date ? e.expense_date.slice(0, 10) : "",
        refNumber: e.bill_number ? `#${e.bill_number}` : `EXP-${String(e.id).padStart(4, "0")}`,
        title: e.title,
        category: e.category,
        paymentMode: e.payment_method || (isCredit ? "Credit (On Account)" : "Cash"),
        totalAmount: amt,
        creditIncurred: isCredit ? amt : 0,
        creditCleared: 0,
        runningCreditBalance: 0,
        note: e.note,
        rawExpense: e,
      });
    });

    vendorObj.settlements.forEach((s) => {
      const amt = s.amount || 0;
      allVendorItems.push({
        id: `set-${s.id}`,
        rawId: s.id,
        kind: "clearance",
        date: s.settlement_date ? s.settlement_date.slice(0, 10) : "",
        refNumber: s.reference_no ? `#${s.reference_no}` : `SETTLE-${String(s.id).padStart(4, "0")}`,
        title: `Credit Clearance Payment (${s.payment_mode})`,
        category: "Vendor Settlement",
        paymentMode: s.payment_mode,
        totalAmount: amt,
        creditIncurred: 0,
        creditCleared: amt,
        runningCreditBalance: 0,
        note: s.note,
        rawSettlement: s,
      });
    });

    // Sort chronologically
    allVendorItems.sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return a.kind === "clearance" ? 1 : -1;
    });

    let running = 0;
    const computed = allVendorItems.map((item) => {
      running += item.creditIncurred - item.creditCleared;
      return {
        ...item,
        runningCreditBalance: Math.max(0, running),
      };
    });

    return {
      ...vendorObj,
      statementItems: computed.reverse(),
    };
  }, [selectedVendor, vendorAccounts]);

  // Overall Financial & Credit Metrics
  const metrics = useMemo(() => {
    let totalExpense = 0;
    let mtdExpense = 0;
    let directPaidTotal = 0;
    let directPaidCount = 0;
    let creditIncurredTotal = 0;
    let creditIncurredCount = 0;
    let eventSpecific = 0;
    let overhead = 0;
    let totalSettled = 0;
    let mtdCleared = 0;

    expenses.forEach((e) => {
      const amt = e.amount || 0;
      totalExpense += amt;

      const d = e.expense_date ? e.expense_date.slice(0, 10) : "";
      if (d.startsWith(dateBoundaries.currentYearMonth)) {
        mtdExpense += amt;
      }

      if (isCreditExpense(e.payment_method)) {
        creditIncurredTotal += amt;
        creditIncurredCount += 1;
      } else {
        directPaidTotal += amt;
        directPaidCount += 1;
      }

      if (e.event_id) {
        eventSpecific += amt;
      } else {
        overhead += amt;
      }
    });

    settlements.forEach((s) => {
      const amt = s.amount || 0;
      totalSettled += amt;

      const d = s.settlement_date ? s.settlement_date.slice(0, 10) : "";
      if (d.startsWith(dateBoundaries.currentYearMonth)) {
        mtdCleared += amt;
      }
    });

    const netCreditDue = Math.max(0, creditIncurredTotal - totalSettled);

    return {
      totalExpense,
      mtdExpense,
      directPaidTotal,
      directPaidCount,
      creditIncurredTotal,
      creditIncurredCount,
      totalSettled,
      mtdCleared,
      netCreditDue,
      eventSpecific,
      overhead,
    };
  }, [expenses, settlements, dateBoundaries.currentYearMonth]);

  // UNIFIED EXPENSE & CREDIT LEDGER (Bills + Clearances)
  const unifiedLedgerEntries = useMemo(() => {
    type LedgerRow = {
      id: string;
      rawId: number;
      kind: "credit_bill" | "paid_expense" | "clearance";
      date: string;
      refNumber: string;
      title: string;
      category: string;
      vendor: string;
      paymentMode: string;
      totalAmount: number;
      creditIncurred: number;
      creditCleared: number;
      runningCreditBalance: number;
      eventId?: number | null;
      eventType?: string | null;
      note?: string | null;
      rawExpense?: ExpenseRecord;
      rawSettlement?: ExpenseSettlementRecord;
    };

    const combined: LedgerRow[] = [];

    // 1. Add Expenses (Both Credit Bills and Direct Paid Expenses)
    expenses.forEach((e) => {
      const expDate = e.expense_date ? e.expense_date.slice(0, 10) : "";
      const isCredit = isCreditExpense(e.payment_method);

      if (entryTypeFilter === "credit" && !isCredit) return;
      if (entryTypeFilter === "paid" && isCredit) return;
      if (entryTypeFilter === "clearances") return;

      if (datePreset === "today" && expDate !== dateBoundaries.todayStr) return;
      if (datePreset === "this_week" && (expDate < dateBoundaries.thisWeekStart || expDate > dateBoundaries.todayStr)) return;
      if (datePreset === "this_month" && !expDate.startsWith(dateBoundaries.currentYearMonth)) return;
      if (datePreset === "last_month" && !expDate.startsWith(dateBoundaries.lastYearMonth)) return;
      if (datePreset === "custom") {
        if (customStartDate && expDate < customStartDate) return;
        if (customEndDate && expDate > customEndDate) return;
      }

      if (categoryFilter !== "All" && e.category !== categoryFilter) return;
      if (allocationFilter === "Event" && !e.event_id) return;
      if (allocationFilter === "Overhead" && e.event_id) return;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const match =
          (e.title && e.title.toLowerCase().includes(q)) ||
          (e.vendor && e.vendor.toLowerCase().includes(q)) ||
          (e.bill_number && e.bill_number.toLowerCase().includes(q)) ||
          (e.note && e.note.toLowerCase().includes(q)) ||
          (e.category && e.category.toLowerCase().includes(q));
        if (!match) return;
      }

      const amt = e.amount || 0;
      combined.push({
        id: `exp-${e.id}`,
        rawId: e.id,
        kind: isCredit ? "credit_bill" : "paid_expense",
        date: expDate,
        refNumber: e.bill_number ? `#${e.bill_number}` : `EXP-${String(e.id).padStart(4, "0")}`,
        title: e.title,
        category: e.category,
        vendor: e.vendor?.trim() || "Direct / No Vendor",
        paymentMode: e.payment_method || (isCredit ? "Credit (On Account)" : "Cash"),
        totalAmount: amt,
        creditIncurred: isCredit ? amt : 0,
        creditCleared: 0,
        runningCreditBalance: 0,
        eventId: e.event_id,
        eventType: e.event_type,
        note: e.note,
        rawExpense: e,
      });
    });

    // 2. Add Settlements (Credit Clearances)
    if (entryTypeFilter !== "credit" && entryTypeFilter !== "paid") {
      settlements.forEach((s) => {
        const sDate = s.settlement_date ? s.settlement_date.slice(0, 10) : "";

        if (datePreset === "today" && sDate !== dateBoundaries.todayStr) return;
        if (datePreset === "this_week" && (sDate < dateBoundaries.thisWeekStart || sDate > dateBoundaries.todayStr)) return;
        if (datePreset === "this_month" && !sDate.startsWith(dateBoundaries.currentYearMonth)) return;
        if (datePreset === "last_month" && !sDate.startsWith(dateBoundaries.lastYearMonth)) return;
        if (datePreset === "custom") {
          if (customStartDate && sDate < customStartDate) return;
          if (customEndDate && sDate > customEndDate) return;
        }

        if (categoryFilter !== "All" && categoryFilter !== "Vendor Settlement") return;

        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const match =
            (s.vendor && s.vendor.toLowerCase().includes(q)) ||
            (s.reference_no && s.reference_no.toLowerCase().includes(q)) ||
            (s.note && s.note.toLowerCase().includes(q));
          if (!match) return;
        }

        const amt = s.amount || 0;
        combined.push({
          id: `set-${s.id}`,
          rawId: s.id,
          kind: "clearance",
          date: sDate,
          refNumber: s.reference_no ? `#${s.reference_no}` : `SETTLE-${String(s.id).padStart(4, "0")}`,
          title: `Credit Clearance Payment (${s.payment_mode})`,
          category: "Vendor Settlement",
          vendor: s.vendor?.trim() || "Direct / No Vendor",
          paymentMode: s.payment_mode,
          totalAmount: amt,
          creditIncurred: 0,
          creditCleared: amt,
          runningCreditBalance: 0,
          note: s.note,
          rawSettlement: s,
        });
      });
    }

    combined.sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return a.kind === "clearance" ? 1 : -1;
    });

    let running = 0;
    const withRunning = combined.map((entry) => {
      running += entry.creditIncurred - entry.creditCleared;
      return {
        ...entry,
        runningCreditBalance: Math.max(0, running),
      };
    });

    if (sortOrder === "desc") {
      return [...withRunning].reverse();
    }
    return withRunning;
  }, [
    expenses,
    settlements,
    entryTypeFilter,
    datePreset,
    customStartDate,
    customEndDate,
    categoryFilter,
    allocationFilter,
    searchQuery,
    sortOrder,
    dateBoundaries,
  ]);

  // Active Ledger Totals
  const activeLedgerTotals = useMemo(() => {
    let totalSpend = 0;
    let totalCredit = 0;
    let totalCleared = 0;
    unifiedLedgerEntries.forEach((e) => {
      totalSpend += e.totalAmount;
      totalCredit += e.creditIncurred;
      totalCleared += e.creditCleared;
    });
    return {
      totalSpend,
      totalCredit,
      totalCleared,
      netDue: Math.max(0, totalCredit - totalCleared),
      count: unifiedLedgerEntries.length,
    };
  }, [unifiedLedgerEntries]);

  // Monthly Outflow Ledger Grouping
  const monthlyLedger = useMemo(() => {
    const monthsMap: Record<
      string,
      {
        monthKey: string;
        totalBilled: number;
        totalDirectPaid: number;
        totalCredit: number;
        totalCleared: number;
        netDue: number;
        count: number;
      }
    > = {};

    expenses.forEach((e) => {
      const d = e.expense_date ? e.expense_date.slice(0, 7) : "Unknown";
      if (!monthsMap[d]) {
        monthsMap[d] = { monthKey: d, totalBilled: 0, totalDirectPaid: 0, totalCredit: 0, totalCleared: 0, netDue: 0, count: 0 };
      }
      const amt = e.amount || 0;
      monthsMap[d].totalBilled += amt;
      monthsMap[d].count += 1;
      if (isCreditExpense(e.payment_method)) {
        monthsMap[d].totalCredit += amt;
      } else {
        monthsMap[d].totalDirectPaid += amt;
      }
    });

    settlements.forEach((s) => {
      const d = s.settlement_date ? s.settlement_date.slice(0, 7) : "Unknown";
      if (!monthsMap[d]) {
        monthsMap[d] = { monthKey: d, totalBilled: 0, totalDirectPaid: 0, totalCredit: 0, totalCleared: 0, netDue: 0, count: 0 };
      }
      monthsMap[d].totalCleared += s.amount || 0;
    });

    Object.values(monthsMap).forEach((m) => {
      m.netDue = Math.max(0, m.totalCredit - m.totalCleared);
    });

    return Object.values(monthsMap).sort((a, b) => b.monthKey.localeCompare(a.monthKey));
  }, [expenses, settlements]);

  // Category Breakdown
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

  // Open Add Expense Modal
  const openAddModal = (presetEventId?: number, defaultVendor?: string, forceType?: "paid" | "credit") => {
    setEditingExpenseId(null);
    setFormType(forceType || "paid"); // Defaults to Direct Paid
    setFormTitle("");
    setFormCategory(CATEGORIES[0]);
    setFormAmount("");
    setFormDate(new Date().toISOString().slice(0, 10));
    setFormEventId(presetEventId ?? "");
    setFormPaymentMethod(forceType === "credit" ? "Credit (On Account)" : "Cash");
    setFormVendor(defaultVendor || selectedVendor || "");
    setFormBillNumber("");
    setFormNote("");
    setModalOpen(true);
  };

  // Open Edit Expense Modal
  const openEditModal = (exp: ExpenseRecord) => {
    setEditingExpenseId(exp.id);
    const isCredit = isCreditExpense(exp.payment_method);
    setFormType(isCredit ? "credit" : "paid");
    setFormTitle(exp.title);
    setFormCategory(exp.category || CATEGORIES[0]);
    setFormAmount(String(exp.amount));
    setFormDate(exp.expense_date ? exp.expense_date.slice(0, 10) : new Date().toISOString().slice(0, 10));
    setFormEventId(exp.event_id ?? "");
    setFormPaymentMethod(isCredit ? "Cash" : (exp.payment_method || "Cash"));
    setFormVendor(exp.vendor || "");
    setFormBillNumber(exp.bill_number || "");
    setFormNote(exp.note || "");
    setModalOpen(true);
  };

  // Open Quick Mark as Paid Modal
  const openMarkPaidModal = (exp: ExpenseRecord) => {
    setTargetExpense(exp);
    setMarkPaidMode("Cash");
    setMarkPaidDate(new Date().toISOString().slice(0, 10));
    setMarkPaidRef("");
    setMarkPaidModalOpen(true);
  };

  // 1-Click Instant Settle helper (Cash, UPI, etc. today)
  const handleQuickMarkPaid = async (exp: ExpenseRecord, chosenMode: string) => {
    const todayStr = new Date().toISOString().slice(0, 10);
    await executeMarkExpensePaid(exp, chosenMode, todayStr);
  };

  // Execute Mark Expense as Paid API call
  const executeMarkExpensePaid = async (
    exp: ExpenseRecord,
    mode: string,
    date?: string,
    refNote?: string
  ) => {
    try {
      setMarkingPaid(true);
      const existingNote = (exp.note || "").trim();
      const cleanRef = (refNote || "").trim();
      let noteText = existingNote;
      if (cleanRef) {
        noteText = existingNote ? `${existingNote} • Paid via ${mode} (${cleanRef})` : `Paid via ${mode} (${cleanRef})`;
      }

      const payload: Record<string, any> = {
        payment_method: mode,
      };
      if (date) {
        payload.expense_date = date;
      }
      if (noteText) {
        payload.note = noteText;
      }

      const res = await fetchWithAuth(`${API_URL}/expenses/${exp.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.detail || `Failed to update expense status (${res.status})`);
      }

      setSuccessMsg(`✓ Expense #${exp.id} ("${exp.title}") marked as PAID via ${mode}! Ledger updated.`);
      setMarkPaidModalOpen(false);
      setTargetExpense(null);
      await loadData();
      setTimeout(() => setSuccessMsg(null), 4500);
    } catch (err: any) {
      console.error("Mark as paid error:", err);
      alert(err.message || "Failed to mark expense as paid");
    } finally {
      setMarkingPaid(false);
    }
  };

  // Active selected vendor account in the settlement modal
  const activeModalVendorAccount = useMemo(() => {
    if (!settleVendor || !settleVendor.trim()) return null;
    const q = settleVendor.trim().toLowerCase();
    return vendorAccounts.find((v) => v.name.toLowerCase() === q) || null;
  }, [settleVendor, vendorAccounts]);

  // Open CREDIT BALANCE CLEARANCE (Settlement) Modal
  const openClearSettlementModal = (vendorName?: string, presetAmount?: number) => {
    // 1. If called for a specific vendor, verify whether they have outstanding credit
    if (vendorName && vendorName.trim()) {
      const vAcc = vendorAccounts.find((v) => v.name.toLowerCase() === vendorName.trim().toLowerCase());
      if (vAcc && vAcc.pendingBalance <= 0) {
        alert(`Supplier "${vAcc.name}" is already fully settled (₹0 Due). No credit clearance is needed.`);
        return;
      }
    }

    // 2. If general call (no vendor), check if any supplier has outstanding credit
    const vendorsWithDue = vendorAccounts.filter((v) => v.name !== "Direct / Cash Outflows" && v.pendingBalance > 0);
    if (!vendorName && vendorsWithDue.length === 0) {
      alert("All supplier accounts are already fully settled (₹0 Due). There are no outstanding credit balances to clear.");
      return;
    }

    const dueVendor = vendorsWithDue[0]?.name;
    const targetVendor =
      (vendorName && vendorName.trim() && !vendorName.toLowerCase().includes("direct") ? vendorName.trim() : "") ||
      dueVendor ||
      "";

    const vendorData = vendorAccounts.find((v) => v.name.toLowerCase() === targetVendor.toLowerCase());

    if (targetVendor && !vendorData && !targetVendor.toLowerCase().includes("direct")) {
      setIsCustomVendor(true);
    } else {
      setIsCustomVendor(false);
    }

    let amountToSet = "";
    if (vendorData && vendorData.pendingBalance > 0) {
      if (presetAmount !== undefined && presetAmount > 0) {
        amountToSet = String(Math.min(presetAmount, vendorData.pendingBalance));
      } else {
        amountToSet = String(vendorData.pendingBalance);
      }
    } else if (presetAmount !== undefined && presetAmount > 0) {
      amountToSet = String(presetAmount);
    }

    setSettleVendor(targetVendor);
    setSettleAmount(amountToSet);
    setSettleDate(new Date().toISOString().slice(0, 10));
    setSettleMode(CLEARANCE_PAYMENT_METHODS[0]);
    setSettleReference("");
    setSettleNote(targetVendor ? `Credit balance clearance for ${targetVendor}` : "Credit balance clearance");
    setSettleModalOpen(true);
  };

  // Submit Add / Edit Expense
  const handleSaveExpense = async (e: FormEvent) => {
    e.preventDefault();
    const title = formTitle.trim();
    if (!title) {
      alert("Please enter an expense title or item description.");
      return;
    }
    const amt = parseFloat(formAmount);
    if (!amt || isNaN(amt) || amt <= 0) {
      alert("Please enter a valid expense amount greater than zero.");
      return;
    }

    try {
      setSubmitting(true);
      const computedPaymentMethod = formType === "credit" ? "Credit (On Account)" : formPaymentMethod;
      const vendorName = formVendor.trim() || null;

      const payload = {
        title,
        category: formCategory,
        amount: amt,
        expense_date: formDate,
        event_id: formEventId ? Number(formEventId) : null,
        payment_method: computedPaymentMethod,
        vendor: vendorName,
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
          : formType === "credit"
          ? `🔴 Credit bill recorded: ₹${formatMoney(amt)} on account for ${vendorName || "supplier"}.`
          : `✓ Direct paid expense recorded: ₹${formatMoney(amt)} (${formPaymentMethod}).`
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

  // Submit CREDIT CLEARANCE (Settlement)
  const handleSaveSettlement = async (e: FormEvent) => {
    e.preventDefault();
    const vendor = settleVendor.trim();
    if (!vendor) {
      alert("Please select or enter the vendor/payee name.");
      return;
    }
    const amt = parseFloat(settleAmount);
    if (!amt || isNaN(amt) || amt <= 0) {
      alert("Please enter a valid clearance amount greater than zero.");
      return;
    }

    if (activeModalVendorAccount) {
      if (activeModalVendorAccount.pendingBalance <= 0) {
        alert(`Supplier "${vendor}" has ₹0 outstanding balance and is already fully settled.`);
        return;
      }
      if (amt > activeModalVendorAccount.pendingBalance) {
        alert(`Clearance amount (₹${formatMoney(amt)}) exceeds the outstanding credit balance of ₹${formatMoney(activeModalVendorAccount.pendingBalance)} for ${vendor}. Please adjust the amount.`);
        return;
      }
    }

    try {
      setSettling(true);
      const payload = {
        vendor,
        amount: amt,
        settlement_date: settleDate,
        payment_mode: settleMode,
        reference_no: settleReference.trim() || null,
        note: settleNote.trim() || null,
      };

      const res = await fetchWithAuth(`${API_URL}/expenses/settlements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.detail || `Failed to record credit clearance (${res.status})`);
      }

      setSuccessMsg(`✓ Credit clearance of ₹${formatMoney(amt)} recorded for ${vendor} via ${settleMode}! Outstanding balance updated.`);
      setSettleModalOpen(false);
      await loadData();
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (err: any) {
      console.error("Settlement error:", err);
      alert(err.message || "Failed to record credit clearance");
    } finally {
      setSettling(false);
    }
  };

  // Void Settlement
  const handleDeleteSettlement = async (id: number, vendor: string, amt: number) => {
    if (!window.confirm(`Are you sure you want to void this credit clearance of ₹${formatMoney(amt)} for ${vendor}? This will restore the vendor's pending credit balance.`)) {
      return;
    }
    try {
      const res = await fetchWithAuth(`${API_URL}/expenses/settlements/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to void clearance");
      setSuccessMsg(`Credit clearance #${id} voided successfully.`);
      await loadData();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      alert(err.message || "Unable to void clearance");
    }
  };

  // Delete Expense
  const handleDeleteExpense = async (id: number, title: string) => {
    if (!window.confirm(`Are you sure you want to delete expense record #${id} ("${title}")?`)) {
      return;
    }
    try {
      const res = await fetchWithAuth(`${API_URL}/expenses/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete expense");
      setSuccessMsg(`Expense #${id} removed successfully.`);
      await loadData();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      alert(err.message || "Unable to delete expense");
    }
  };

  const handlePrintLedger = () => {
    window.print();
  };

  return (
    <main className="dashboard" style={{ background: "#ffffff", minHeight: "100vh" }}>
      <AppSidebar activeRoute="/expenses" />

      {/* Main Content */}
      <div className="main-content" style={{ background: "#ffffff", minHeight: "100vh" }}>
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
              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                <h1 style={{ margin: 0, fontSize: "19px", fontWeight: 800, color: "#0f172a", lineHeight: 1.2 }}>
                  Expense & Ledger Management
                </h1>
                <span
                  style={{
                    fontSize: "11px",
                    color: "#334155",
                    background: "#f1f5f9",
                    border: "1px solid #e2e8f0",
                    padding: "2px 8px",
                    borderRadius: "10px",
                    fontWeight: 700,
                    whiteSpace: "nowrap",
                  }}
                >
                  {expenses.length} Total Expenses
                </span>
                {metrics.netCreditDue > 0 ? (
                  <span
                    style={{
                      fontSize: "11px",
                      color: "#dc2626",
                      background: "#fef2f2",
                      border: "1px solid #fecaca",
                      padding: "2px 8px",
                      borderRadius: "10px",
                      fontWeight: 800,
                      whiteSpace: "nowrap",
                    }}
                  >
                    🔴 ₹{formatMoney(metrics.netCreditDue)} Supplier Credit Due
                  </span>
                ) : (
                  <span
                    style={{
                      fontSize: "11px",
                      color: "#059669",
                      background: "#ecfdf5",
                      border: "1px solid #a7f3d0",
                      padding: "2px 8px",
                      borderRadius: "10px",
                      fontWeight: 800,
                      whiteSpace: "nowrap",
                    }}
                  >
                    ✓ All Supplier Credit Cleared
                  </span>
                )}
              </div>
              <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#64748b" }}>
                Track direct paid expenses (Cash / UPI) and manage supplier credit purchases & clearances
              </p>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", justifyContent: "flex-end", flex: "1 1 auto" }}>
            {/* Quick search input */}
            <div className="search-box" style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "8px" }}>
              <span style={{ color: "#64748b", fontSize: "14px" }}>🔍</span>
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
                  color: "#0f172a",
                }}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  style={{ border: "none", background: "transparent", color: "#64748b", cursor: "pointer", fontSize: "14px" }}
                >
                  ✕
                </button>
              )}
            </div>

            {/* Clear Credit Balance Button */}
            {!isOwner && (
              <button
                type="button"
                onClick={() => openClearSettlementModal()}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  background: "#059669",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "8px",
                  padding: "9px 15px",
                  fontWeight: 700,
                  fontSize: "12px",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                  boxShadow: "0 1px 3px rgba(5, 150, 105, 0.2)",
                }}
              >
                <span>🤝</span> Clear Supplier Credit
              </button>
            )}

            {/* Print Ledger Button */}
            <button
              type="button"
              onClick={handlePrintLedger}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                background: "#ffffff",
                color: "#475569",
                border: "1px solid #cbd5e1",
                borderRadius: "8px",
                padding: "9px 14px",
                fontWeight: 700,
                fontSize: "12px",
                cursor: "pointer",
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}
            >
              <span>🖨️</span> Print Statement
            </button>

            {/* Add Expense Button */}
            {!isOwner && (
              <button
                type="button"
                onClick={() => openAddModal()}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  background: "#2563eb",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "8px",
                  padding: "9px 16px",
                  fontWeight: 700,
                  fontSize: "12px",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                  boxShadow: "0 2px 6px rgba(37, 99, 235, 0.25)",
                }}
              >
                <span>+</span> Record Expense
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
                {selectedVendor
                  ? `Vendor Account Statement: ${selectedVendor}`
                  : "Expenses & Supplier Credit Ledger"}
              </h2>
              <p style={{ margin: 0, fontSize: "12px", color: "#666" }}>
                Total Expenditure: ₹{formatMoney(metrics.totalExpense)} • Direct Paid: ₹{formatMoney(metrics.directPaidTotal)} • Credit Taken: ₹{formatMoney(metrics.creditIncurredTotal)} • Outstanding Due: ₹{formatMoney(metrics.netCreditDue)}
              </p>
            </div>
            <div style={{ textAlign: "right", fontSize: "12px", color: "#555" }}>
              <div>Generated: {new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</div>
              <div style={{ fontWeight: 800, color: metrics.netCreditDue > 0 ? "#b91c1c" : "#047857" }}>
                Net Supplier Credit Due: ₹{formatMoney(metrics.netCreditDue)}
              </div>
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="page-content" style={{ background: "#ffffff", minHeight: "calc(100vh - 72px)", padding: "24px 28px 80px" }}>
          <OwnerBanner />

          {/* Notifications */}
          {successMsg && (
            <div
              className="no-print"
              style={{
                background: "#ecfdf5",
                border: "1px solid #a7f3d0",
                color: "#065f46",
                padding: "12px 18px",
                borderRadius: "8px",
                marginBottom: "20px",
                fontSize: "14px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span>{successMsg}</span>
              <button
                type="button"
                onClick={() => setSuccessMsg(null)}
                style={{ border: "none", background: "transparent", color: "#065f46", cursor: "pointer" }}
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

          {/* 4 CLEAR FINANCIAL METRIC CARDS */}
          <div
            className="no-print"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
              gap: "16px",
              marginBottom: "24px",
            }}
          >
            {/* 1. Total Expenses */}
            <div
              style={{
                background: "#ffffff",
                border: "1px solid #e2e8f0",
                borderRadius: "12px",
                padding: "18px 20px",
                boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                position: "relative",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                minHeight: "120px",
              }}
            >
              <div style={{ fontSize: "12px", color: "#475569", fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase" }}>
                Total Expenditure
              </div>
              <div style={{ fontSize: "26px", fontWeight: 800, color: "#0f172a", marginTop: "6px" }}>
                ₹{formatMoney(metrics.totalExpense)}
              </div>
              <div style={{ fontSize: "12px", color: "#64748b", marginTop: "6px" }}>
                Across {expenses.length} purchases ({formatMoney(metrics.directPaidTotal)} cash, {formatMoney(metrics.creditIncurredTotal)} credit)
              </div>
            </div>

            {/* 2. Direct Paid (Cash / UPI / Bank) */}
            <div
              style={{
                background: "#ffffff",
                border: "1px solid #e2e8f0",
                borderRadius: "12px",
                padding: "18px 20px",
                boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                position: "relative",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                minHeight: "120px",
              }}
            >
              <div style={{ fontSize: "12px", color: "#0284c7", fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase" }}>
                Direct Paid (Cash / UPI)
              </div>
              <div style={{ fontSize: "26px", fontWeight: 800, color: "#0369a1", marginTop: "6px" }}>
                ₹{formatMoney(metrics.directPaidTotal)}
              </div>
              <div style={{ fontSize: "12px", color: "#0284c7", marginTop: "6px" }}>
                {metrics.directPaidCount} cash / digital payments (Settled immediately)
              </div>
            </div>

            {/* 3. Supplier Credit Cleared */}
            <div
              style={{
                background: "#ffffff",
                border: "1px solid #e2e8f0",
                borderRadius: "12px",
                padding: "18px 20px",
                boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                position: "relative",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                minHeight: "120px",
              }}
            >
              <div style={{ fontSize: "12px", color: "#059669", fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase" }}>
                Supplier Credit Cleared
              </div>
              <div style={{ fontSize: "26px", fontWeight: 800, color: "#047857", marginTop: "6px" }}>
                ₹{formatMoney(metrics.totalSettled)}
              </div>
              <div style={{ fontSize: "12px", color: "#059669", marginTop: "6px" }}>
                {settlements.length} settlement payments to suppliers
              </div>
            </div>

            {/* 4. Net Supplier Credit Due */}
            <div
              style={{
                background: metrics.netCreditDue > 0 ? "#fffafb" : "#ffffff",
                border: metrics.netCreditDue > 0 ? "1px solid #fecaca" : "1px solid #e2e8f0",
                borderRadius: "12px",
                padding: "18px 20px",
                boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                position: "relative",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                minHeight: "120px",
              }}
            >
              <div style={{ fontSize: "12px", color: metrics.netCreditDue > 0 ? "#b91c1c" : "#059669", fontWeight: 800, letterSpacing: "0.5px", textTransform: "uppercase" }}>
                Net Supplier Credit Due
              </div>
              <div style={{ fontSize: "28px", fontWeight: 900, color: metrics.netCreditDue > 0 ? "#dc2626" : "#059669", marginTop: "6px" }}>
                ₹{formatMoney(metrics.netCreditDue)}
              </div>
              <div style={{ fontSize: "12px", color: metrics.netCreditDue > 0 ? "#b91c1c" : "#059669", marginTop: "6px", fontWeight: 600 }}>
                {pendingVendorsCount > 0 ? `${pendingVendorsCount} suppliers waiting for payment` : "✓ All supplier accounts fully settled"}
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
              borderBottom: "2px solid #e2e8f0",
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
                background: activeTab === "general" ? "#fff" : "transparent",
                border: "none",
                borderBottom: activeTab === "general" ? "3px solid #2563eb" : "3px solid transparent",
                padding: "12px 16px",
                borderRadius: "8px 8px 0 0",
                fontSize: "14px",
                fontWeight: activeTab === "general" ? 800 : 600,
                color: activeTab === "general" ? "#2563eb" : "#64748b",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                marginBottom: "-2px",
              }}
            >
              <span>📜</span> Unified Expenses Ledger ({unifiedLedgerEntries.length})
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab("vendors");
                setSelectedVendor(null);
              }}
              style={{
                background: activeTab === "vendors" ? "#fff" : "transparent",
                border: "none",
                borderBottom: activeTab === "vendors" ? "3px solid #2563eb" : "3px solid transparent",
                padding: "12px 16px",
                borderRadius: "8px 8px 0 0",
                fontSize: "14px",
                fontWeight: activeTab === "vendors" ? 800 : 600,
                color: activeTab === "vendors" ? "#2563eb" : "#64748b",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                marginBottom: "-2px",
              }}
            >
              <span>🏪</span> Supplier Accounts & Khata ({vendorAccounts.length})
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab("settlement");
                setSelectedVendor(null);
              }}
              style={{
                background: activeTab === "settlement" ? "#fff" : "transparent",
                border: "none",
                borderBottom: activeTab === "settlement" ? "3px solid #059669" : "3px solid transparent",
                padding: "12px 16px",
                borderRadius: "8px 8px 0 0",
                fontSize: "14px",
                fontWeight: activeTab === "settlement" ? 800 : 600,
                color: activeTab === "settlement" ? "#059669" : "#64748b",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                marginBottom: "-2px",
              }}
            >
              <span>🤝</span> Credit Clearances ({settlements.length})
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab("audit");
                setSelectedVendor(null);
              }}
              style={{
                background: activeTab === "audit" ? "#fff" : "transparent",
                border: "none",
                borderBottom: activeTab === "audit" ? "3px solid #2563eb" : "3px solid transparent",
                padding: "12px 16px",
                borderRadius: "8px 8px 0 0",
                fontSize: "14px",
                fontWeight: activeTab === "audit" ? 800 : 600,
                color: activeTab === "audit" ? "#2563eb" : "#64748b",
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

          {/* ======================================================== */}
          {/* TAB 1: UNIFIED EXPENSES LEDGER */}
          {/* ======================================================== */}
          {activeTab === "general" && (
            <div>
              {/* Filter Controls Bar */}
              <div
                className="no-print"
                style={{
                  background: "#ffffff",
                  border: "1px solid #e2e8f0",
                  borderRadius: "12px",
                  padding: "14px 18px",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
                  marginBottom: "20px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                }}
              >
                {/* Row 1: Entry Type Filter */}
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                    <span style={{ fontSize: "11px", color: "#64748b", fontWeight: 700, textTransform: "uppercase" }}>
                      Filter By:
                    </span>
                    {(
                      [
                        { id: "all", label: `All Records (${expenses.length + settlements.length})`, color: "#2563eb" },
                        { id: "credit", label: `🔴 Unpaid Credit (${metrics.creditIncurredCount})`, color: "#dc2626" },
                        { id: "paid", label: `🟢 Direct Paid (${metrics.directPaidCount})`, color: "#059669" },
                        { id: "clearances", label: `🤝 Clearances (${settlements.length})`, color: "#0284c7" },
                      ] as const
                    ).map((t) => {
                      const active = entryTypeFilter === t.id;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setEntryTypeFilter(t.id)}
                          style={{
                            padding: "6px 14px",
                            borderRadius: "20px",
                            border: active ? `2px solid ${t.color}` : "1px solid #cbd5e1",
                            background: active ? t.color : "#ffffff",
                            color: active ? "#ffffff" : "#334155",
                            fontSize: "12px",
                            fontWeight: active ? 800 : 600,
                            cursor: "pointer",
                            transition: "all 0.15s ease",
                            boxShadow: active ? `0 2px 6px ${t.color}33` : "none",
                          }}
                        >
                          {t.label}
                        </button>
                      );
                    })}
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "12px", color: "#64748b", fontWeight: 600 }}>Sequence:</span>
                    <button
                      type="button"
                      onClick={() => setSortOrder(sortOrder === "desc" ? "asc" : "desc")}
                      style={{
                        padding: "5px 12px",
                        borderRadius: "6px",
                        border: "1px solid #cbd5e1",
                        background: "#ffffff",
                        fontSize: "12px",
                        color: "#0f172a",
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      {sortOrder === "desc" ? "Newest First ▾" : "Oldest First ▴"}
                    </button>
                  </div>
                </div>

                {/* Row 2: Period Presets */}
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "6px" }}>
                  <span style={{ fontSize: "11px", color: "#64748b", fontWeight: 700, textTransform: "uppercase", marginRight: "4px" }}>
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
                          padding: "4px 10px",
                          borderRadius: "16px",
                          border: active ? "1px solid #0f172a" : "1px solid #cbd5e1",
                          background: active ? "#0f172a" : "#ffffff",
                          color: active ? "#ffffff" : "#475569",
                          fontSize: "11px",
                          fontWeight: active ? 700 : 500,
                          cursor: "pointer",
                        }}
                      >
                        {p.label}
                      </button>
                    );
                  })}
                </div>

                {/* Custom Date Range */}
                {datePreset === "custom" && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                      padding: "10px 14px",
                      background: "#f8fafc",
                      borderRadius: "8px",
                      border: "1px dashed #cbd5e1",
                      flexWrap: "wrap",
                    }}
                  >
                    <span style={{ fontSize: "12px", fontWeight: 700, color: "#2563eb" }}>Custom Dates:</span>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <span style={{ fontSize: "12px", color: "#555" }}>From:</span>
                      <input
                        type="date"
                        value={customStartDate}
                        onChange={(e) => setCustomStartDate(e.target.value)}
                        style={{ padding: "4px 8px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "12px" }}
                      />
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <span style={{ fontSize: "12px", color: "#555" }}>To:</span>
                      <input
                        type="date"
                        value={customEndDate}
                        onChange={(e) => setCustomEndDate(e.target.value)}
                        style={{ padding: "4px 8px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "12px" }}
                      />
                    </div>
                  </div>
                )}

                {/* Row 3: Dropdowns & Period Totals */}
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
                  <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "12px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <span style={{ fontSize: "11px", color: "#64748b", fontWeight: 700, textTransform: "uppercase" }}>Category:</span>
                      <select
                        value={categoryFilter}
                        onChange={(e) => setCategoryFilter(e.target.value)}
                        style={{
                          height: "32px",
                          padding: "0 10px",
                          borderRadius: "6px",
                          border: "1px solid #cbd5e1",
                          background: "#ffffff",
                          fontSize: "12px",
                          color: "#0f172a",
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

                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <span style={{ fontSize: "11px", color: "#64748b", fontWeight: 700, textTransform: "uppercase" }}>Allocation:</span>
                      <select
                        value={allocationFilter}
                        onChange={(e) => setAllocationFilter(e.target.value)}
                        style={{
                          height: "32px",
                          padding: "0 10px",
                          borderRadius: "6px",
                          border: "1px solid #cbd5e1",
                          background: "#ffffff",
                          fontSize: "12px",
                          color: "#0f172a",
                          outline: "none",
                        }}
                      >
                        <option value="All">All Allocations</option>
                        <option value="Event">Event Specific Only</option>
                        <option value="Overhead">General Overhead Only</option>
                      </select>
                    </div>

                    {(categoryFilter !== "All" || allocationFilter !== "All" || datePreset !== "all" || entryTypeFilter !== "all" || searchQuery) && (
                      <button
                        type="button"
                        onClick={() => {
                          setCategoryFilter("All");
                          setAllocationFilter("All");
                          setDatePreset("all");
                          setEntryTypeFilter("all");
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

                  {/* Summary of Active Filtered Entries */}
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                    <div style={{ fontSize: "12px", color: "#64748b" }}>
                      Total Spend: <strong style={{ color: "#0f172a" }}>₹{formatMoney(activeLedgerTotals.totalSpend)}</strong>
                    </div>
                    <div style={{ fontSize: "12px", color: "#64748b" }}>
                      Credit Taken: <strong style={{ color: "#dc2626" }}>₹{formatMoney(activeLedgerTotals.totalCredit)}</strong>
                    </div>
                    <div style={{ fontSize: "12px", color: "#64748b" }}>
                      Credit Cleared: <strong style={{ color: "#059669" }}>₹{formatMoney(activeLedgerTotals.totalCleared)}</strong>
                    </div>
                    <div
                      style={{
                        fontSize: "13px",
                        fontWeight: 800,
                        color: activeLedgerTotals.netDue > 0 ? "#dc2626" : "#059669",
                        background: activeLedgerTotals.netDue > 0 ? "#fef2f2" : "#ecfdf5",
                        border: activeLedgerTotals.netDue > 0 ? "1px solid #fecaca" : "1px solid #a7f3d0",
                        padding: "3px 10px",
                        borderRadius: "8px",
                      }}
                    >
                      Credit Due: ₹{formatMoney(activeLedgerTotals.netDue)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Table */}
              <div
                style={{
                  background: "#ffffff",
                  borderRadius: "12px",
                  border: "1px solid #e2e8f0",
                  overflow: "hidden",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
                }}
              >
                {loading ? (
                  <div style={{ padding: "48px", textAlign: "center", color: "#64748b" }}>
                    Loading expenses and credit ledger...
                  </div>
                ) : unifiedLedgerEntries.length === 0 ? (
                  <div style={{ padding: "50px 20px", textAlign: "center" }}>
                    <div style={{ fontSize: "36px", marginBottom: "12px" }}>💳</div>
                    <h3 style={{ margin: "0 0 6px 0", color: "#0f172a" }}>No expenses found</h3>
                    <p style={{ color: "#64748b", fontSize: "14px", margin: "0 0 16px 0" }}>
                      {searchQuery || categoryFilter !== "All" || datePreset !== "all"
                        ? "No records match your active search or filters."
                        : "Start recording your direct paid expenses or supplier credit purchases."}
                    </p>
                    {!isOwner && (
                      <button
                        type="button"
                        onClick={() => openAddModal()}
                        style={{
                          background: "#2563eb",
                          color: "#ffffff",
                          border: "none",
                          padding: "8px 18px",
                          borderRadius: "8px",
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        + Record Expense
                      </button>
                    )}
                  </div>
                ) : (
                  <div style={{ overflowX: "auto" }}>
                    <table
                      className="ledger-table"
                      style={{
                        width: "100%",
                        minWidth: "960px",
                        borderCollapse: "collapse",
                        fontSize: "13px",
                        textAlign: "left",
                      }}
                    >
                      <thead>
                        <tr
                          style={{
                            background: "#f8fafc",
                            borderBottom: "2px solid #e2e8f0",
                            color: "#334155",
                            fontWeight: 700,
                          }}
                        >
                          <th style={{ padding: "12px 16px" }}>Date</th>
                          <th style={{ padding: "12px 16px" }}>Voucher / Bill #</th>
                          <th style={{ padding: "12px 16px" }}>Payee / Vendor</th>
                          <th style={{ padding: "12px 16px" }}>Particulars / Description</th>
                          <th style={{ padding: "12px 16px" }}>Payment Type</th>
                          <th style={{ padding: "12px 16px", textAlign: "right" }}>Total Amount (₹)</th>
                          <th style={{ padding: "12px 16px", textAlign: "right" }}>Credit Impact</th>
                          <th
                            style={{
                              padding: "12px 16px",
                              textAlign: "right",
                              background: "#f1f5f9",
                              color: "#0f172a",
                            }}
                          >
                            Net Credit Due (₹)
                          </th>
                          <th className="no-print" style={{ padding: "12px 16px", textAlign: "center" }}>
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {unifiedLedgerEntries.map((row) => {
                          const isCredit = row.kind === "credit_bill";
                          const isClearance = row.kind === "clearance";
                          const isPaid = row.kind === "paid_expense";

                          return (
                            <tr
                              key={row.id}
                              style={{
                                borderBottom: "1px solid #f1f5f9",
                                background: isClearance ? "#f0fdf4" : isCredit ? "#fffafb" : "#ffffff",
                                transition: "background 0.15s ease",
                              }}
                            >
                              {/* Date */}
                              <td style={{ padding: "12px 16px", fontWeight: 600, color: "#0f172a", whiteSpace: "nowrap" }}>
                                {formatDate(row.date)}
                              </td>

                              {/* Bill / Ref # */}
                              <td style={{ padding: "12px 16px", fontFamily: "monospace", color: "#64748b", fontSize: "12px", whiteSpace: "nowrap" }}>
                                <span
                                  style={{
                                    padding: "2px 6px",
                                    borderRadius: "4px",
                                    border: isClearance ? "1px solid #a7f3d0" : isCredit ? "1px solid #fecaca" : "1px solid #e2e8f0",
                                    background: isClearance ? "#ecfdf5" : isCredit ? "#fef2f2" : "#f8fafc",
                                    color: isClearance ? "#047857" : isCredit ? "#dc2626" : "#475569",
                                    fontWeight: 700,
                                  }}
                                >
                                  {row.refNumber}
                                </span>
                              </td>

                              {/* Vendor / Supplier */}
                              <td style={{ padding: "12px 16px", color: "#0f172a", fontWeight: 700 }}>
                                {row.vendor !== "Direct / No Vendor" ? (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedVendor(row.vendor);
                                      setActiveTab("vendors");
                                    }}
                                    style={{
                                      border: "none",
                                      background: "transparent",
                                      padding: 0,
                                      color: "#2563eb",
                                      fontWeight: 700,
                                      cursor: "pointer",
                                      textDecoration: "underline",
                                      textAlign: "left",
                                      fontSize: "13px",
                                    }}
                                    title="View vendor account statement"
                                  >
                                    {row.vendor}
                                  </button>
                                ) : (
                                  <span style={{ color: "#64748b", fontWeight: 500 }}>{row.vendor}</span>
                                )}
                              </td>

                              {/* Particulars */}
                              <td style={{ padding: "12px 16px" }}>
                                <div style={{ fontWeight: 600, color: "#0f172a" }}>{row.title}</div>
                                {row.note && (
                                  <div style={{ fontSize: "11px", color: "#64748b", marginTop: "2px", maxWidth: "260px" }}>
                                    {row.note}
                                  </div>
                                )}
                                {row.eventId && (
                                  <div style={{ marginTop: "4px" }}>
                                    <Link
                                      href={`/events/${row.eventId}`}
                                      style={{
                                        fontSize: "11px",
                                        color: "#2563eb",
                                        fontWeight: 700,
                                        textDecoration: "none",
                                        background: "#eff6ff",
                                        padding: "2px 6px",
                                        borderRadius: "4px",
                                        display: "inline-block",
                                      }}
                                    >
                                      Event #{row.eventId} {row.eventType ? `• ${row.eventType}` : ""}
                                    </Link>
                                  </div>
                                )}
                              </td>

                              {/* Status / Type */}
                              <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>
                                {isCredit && (
                                  <span
                                    style={{
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: "4px",
                                      fontSize: "11px",
                                      fontWeight: 800,
                                      padding: "4px 8px",
                                      borderRadius: "6px",
                                      background: "#fef2f2",
                                      color: "#dc2626",
                                      border: "1px solid #fecaca",
                                    }}
                                  >
                                    <span style={{ fontSize: "8px" }}>🔴</span> Unpaid Credit
                                  </span>
                                )}
                                {isPaid && (
                                  <span
                                    style={{
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: "4px",
                                      fontSize: "11px",
                                      fontWeight: 700,
                                      padding: "4px 8px",
                                      borderRadius: "6px",
                                      background: "#ecfdf5",
                                      color: "#047857",
                                      border: "1px solid #a7f3d0",
                                    }}
                                  >
                                    <span>✓</span> Paid ({row.paymentMode})
                                  </span>
                                )}
                                {isClearance && (
                                  <span
                                    style={{
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: "4px",
                                      fontSize: "11px",
                                      fontWeight: 700,
                                      padding: "4px 8px",
                                      borderRadius: "6px",
                                      background: "#f0fdf4",
                                      color: "#059669",
                                      border: "1px solid #bbf7d0",
                                    }}
                                  >
                                    <span>🤝</span> Cleared ({row.paymentMode})
                                  </span>
                                )}
                              </td>

                              {/* Total Amount */}
                              <td
                                style={{
                                  padding: "12px 16px",
                                  textAlign: "right",
                                  fontWeight: 800,
                                  color: "#0f172a",
                                  fontSize: "13px",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                ₹{formatMoney(row.totalAmount)}
                              </td>

                              {/* Credit Impact */}
                              <td
                                style={{
                                  padding: "12px 16px",
                                  textAlign: "right",
                                  fontWeight: 700,
                                  fontSize: "13px",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {isCredit ? (
                                  <span style={{ color: "#dc2626" }}>+₹{formatMoney(row.creditIncurred)}</span>
                                ) : isClearance ? (
                                  <span style={{ color: "#059669" }}>-₹{formatMoney(row.creditCleared)}</span>
                                ) : (
                                  <span style={{ color: "#94a3b8", fontSize: "12px" }}>Settled (₹0 Due)</span>
                                )}
                              </td>

                              {/* Net Credit Due */}
                              <td
                                style={{
                                  padding: "12px 16px",
                                  textAlign: "right",
                                  fontWeight: 800,
                                  color: row.runningCreditBalance > 0 ? "#dc2626" : "#059669",
                                  fontSize: "13px",
                                  background: "#f8fafc",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                ₹{formatMoney(row.runningCreditBalance)}
                              </td>

                              {/* Actions */}
                              <td className="no-print" style={{ padding: "10px 14px", textAlign: "center", whiteSpace: "nowrap" }}>
                                <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "6px" }}>
                                  {!isOwner && row.rawExpense && (
                                    <>
                                      {isCredit && (
                                        <button
                                          type="button"
                                          onClick={() => openMarkPaidModal(row.rawExpense!)}
                                          title="Mark this credit bill as Paid"
                                          style={{
                                            padding: "5px 11px",
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
                                      <button
                                        type="button"
                                        onClick={() => openEditModal(row.rawExpense!)}
                                        title="Edit this expense"
                                        style={{
                                          padding: "5px 9px",
                                          borderRadius: "6px",
                                          background: "#f8fafc",
                                          color: "#334155",
                                          border: "1px solid #cbd5e1",
                                          fontSize: "12px",
                                          fontWeight: 600,
                                          cursor: "pointer",
                                          display: "inline-flex",
                                          alignItems: "center",
                                          gap: "3px",
                                        }}
                                      >
                                        <span>✏️</span> Edit
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteExpense(row.rawId, row.title)}
                                        title="Delete this expense record"
                                        style={{
                                          padding: "5px 8px",
                                          borderRadius: "6px",
                                          background: "#fff1f2",
                                          color: "#e11d48",
                                          border: "1px solid #fecdd3",
                                          fontSize: "12px",
                                          fontWeight: 600,
                                          cursor: "pointer",
                                          display: "inline-flex",
                                          alignItems: "center",
                                          gap: "3px",
                                        }}
                                      >
                                        <span>🗑️</span>
                                      </button>
                                    </>
                                  )}

                                  {!isOwner && isClearance && (
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteSettlement(row.rawId, row.vendor, row.creditCleared)}
                                      title="Void this clearance and restore credit balance"
                                      style={{
                                        padding: "5px 10px",
                                        borderRadius: "6px",
                                        background: "#fff1f2",
                                        color: "#e11d48",
                                        border: "1px solid #fecdd3",
                                        fontSize: "11px",
                                        fontWeight: 700,
                                        cursor: "pointer",
                                      }}
                                    >
                                      Void ✕
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>

                      {/* SUMMARY FOOTER */}
                      <tfoot>
                        <tr
                          style={{
                            background: "#f8fafc",
                            borderTop: "2px solid #cbd5e1",
                            fontWeight: 800,
                            color: "#0f172a",
                          }}
                        >
                          <td colSpan={5} style={{ padding: "12px 16px", fontSize: "13px" }}>
                            Audited Summary ({activeLedgerTotals.count} Transactions)
                          </td>
                          <td style={{ padding: "12px 16px", textAlign: "right", fontSize: "14px", color: "#0f172a" }}>
                            ₹{formatMoney(activeLedgerTotals.totalSpend)}
                          </td>
                          <td style={{ padding: "12px 16px", textAlign: "right", fontSize: "13px" }}>
                            <span style={{ color: "#dc2626" }}>+₹{formatMoney(activeLedgerTotals.totalCredit)}</span>
                            {" / "}
                            <span style={{ color: "#059669" }}>-₹{formatMoney(activeLedgerTotals.totalCleared)}</span>
                          </td>
                          <td
                            style={{
                              padding: "12px 16px",
                              textAlign: "right",
                              fontSize: "15px",
                              fontWeight: 900,
                              color: activeLedgerTotals.netDue > 0 ? "#dc2626" : "#059669",
                              background: "#f1f5f9",
                            }}
                          >
                            ₹{formatMoney(activeLedgerTotals.netDue)}
                          </td>
                          <td className="no-print" />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 2: VENDOR CREDIT ACCOUNTS (KHATA / SUPPLIER LEDGER) */}
          {/* ======================================================== */}
          {activeTab === "vendors" && (
            <div>
              {selectedVendorData ? (
                /* Individual Vendor Account Statement */
                <div>
                  <div
                    style={{
                      background: "#ffffff",
                      borderRadius: "12px",
                      border: "1px solid #e2e8f0",
                      padding: "20px 24px",
                      marginBottom: "20px",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
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
                            color: "#2563eb",
                            fontWeight: 700,
                            fontSize: "13px",
                            cursor: "pointer",
                            padding: 0,
                          }}
                        >
                          ← Back to All Accounts
                        </button>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <span style={{ fontSize: "24px" }}>🏪</span>
                        <div>
                          <h2 style={{ margin: 0, fontSize: "20px", fontWeight: 800, color: "#0f172a" }}>
                            {selectedVendorData.name}
                          </h2>
                          <span style={{ fontSize: "12px", color: "#64748b" }}>
                            {selectedVendorData.billCount} total purchases ({selectedVendorData.creditBillCount} credit bills, {selectedVendorData.directPaidCount} direct paid) • {selectedVendorData.clearanceCount} clearances
                          </span>
                        </div>
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "20px", flexWrap: "wrap" }}>
                      <div style={{ textAlign: "right" }}>
                        <span style={{ fontSize: "11px", color: "#64748b", fontWeight: 700, textTransform: "uppercase" }}>
                          Total Purchases
                        </span>
                        <div style={{ fontSize: "18px", fontWeight: 800, color: "#0f172a" }}>
                          ₹{formatMoney(selectedVendorData.totalBilled)}
                        </div>
                      </div>

                      <div style={{ textAlign: "right" }}>
                        <span style={{ fontSize: "11px", color: "#dc2626", fontWeight: 700, textTransform: "uppercase" }}>
                          Credit Taken
                        </span>
                        <div style={{ fontSize: "18px", fontWeight: 800, color: "#dc2626" }}>
                          ₹{formatMoney(selectedVendorData.totalCredit)}
                        </div>
                      </div>

                      <div style={{ textAlign: "right" }}>
                        <span style={{ fontSize: "11px", color: "#059669", fontWeight: 700, textTransform: "uppercase" }}>
                          Credit Cleared
                        </span>
                        <div style={{ fontSize: "18px", fontWeight: 800, color: "#059669" }}>
                          ₹{formatMoney(selectedVendorData.totalCleared)}
                        </div>
                      </div>

                      <div style={{ textAlign: "right" }}>
                        <span style={{ fontSize: "11px", color: selectedVendorData.pendingBalance > 0 ? "#dc2626" : "#059669", fontWeight: 800, textTransform: "uppercase" }}>
                          Outstanding Due
                        </span>
                        <div style={{ fontSize: "24px", fontWeight: 900, color: selectedVendorData.pendingBalance > 0 ? "#dc2626" : "#059669" }}>
                          ₹{formatMoney(selectedVendorData.pendingBalance)}
                        </div>
                      </div>

                      <div className="no-print" style={{ display: "flex", gap: "8px" }}>
                        {!isOwner && selectedVendorData.pendingBalance > 0 && (
                          <button
                            type="button"
                            onClick={() => openClearSettlementModal(selectedVendorData.name, selectedVendorData.pendingBalance)}
                            style={{
                              padding: "8px 14px",
                              borderRadius: "8px",
                              border: "none",
                              background: "#059669",
                              color: "#fff",
                              fontWeight: 700,
                              fontSize: "12px",
                              cursor: "pointer",
                            }}
                          >
                            🤝 Clear Due Balance
                          </button>
                        )}

                        {!isOwner && (
                          <button
                            type="button"
                            onClick={() => openAddModal(undefined, selectedVendorData.name, "credit")}
                            style={{
                              padding: "8px 14px",
                              borderRadius: "8px",
                              border: "none",
                              background: "#dc2626",
                              color: "#fff",
                              fontWeight: 700,
                              fontSize: "12px",
                              cursor: "pointer",
                            }}
                          >
                            + Add Credit Bill
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={handlePrintLedger}
                          style={{
                            padding: "8px 14px",
                            borderRadius: "8px",
                            border: "1px solid #cbd5e1",
                            background: "#fff",
                            color: "#475569",
                            fontWeight: 700,
                            fontSize: "12px",
                            cursor: "pointer",
                          }}
                        >
                          🖨️ Print Statement
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Statement Items Table */}
                  <div
                    style={{
                      background: "#ffffff",
                      borderRadius: "12px",
                      border: "1px solid #e2e8f0",
                      overflow: "hidden",
                    }}
                  >
                    <div style={{ overflowX: "auto" }}>
                      <table className="ledger-table" style={{ width: "100%", minWidth: "850px", borderCollapse: "collapse", fontSize: "13px", textAlign: "left" }}>
                        <thead>
                          <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0", color: "#334155", fontWeight: 700 }}>
                            <th style={{ padding: "12px 16px" }}>Date</th>
                            <th style={{ padding: "12px 16px" }}>Ref / Bill #</th>
                            <th style={{ padding: "12px 16px" }}>Particulars</th>
                            <th style={{ padding: "12px 16px" }}>Transaction Type</th>
                            <th style={{ padding: "12px 16px", textAlign: "right" }}>Bill Amount (₹)</th>
                            <th style={{ padding: "12px 16px", textAlign: "right" }}>Credit Cleared (-₹)</th>
                            <th style={{ padding: "12px 16px", textAlign: "right", background: "#f1f5f9", color: "#0f172a" }}>
                              Running Due (₹)
                            </th>
                            <th className="no-print" style={{ padding: "12px 16px", textAlign: "center" }}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedVendorData.statementItems.map((entry) => {
                            const isCredit = entry.kind === "credit_bill";
                            const isClearance = entry.kind === "clearance";

                            return (
                              <tr key={entry.id} style={{ borderBottom: "1px solid #f1f5f9", background: isClearance ? "#f0fdf4" : isCredit ? "#fffafb" : "#ffffff" }}>
                                <td style={{ padding: "12px 16px", fontWeight: 600, color: "#0f172a", whiteSpace: "nowrap" }}>
                                  {formatDate(entry.date)}
                                </td>
                                <td style={{ padding: "12px 16px", fontFamily: "monospace", color: "#64748b" }}>
                                  {entry.refNumber}
                                </td>
                                <td style={{ padding: "12px 16px" }}>
                                  <div style={{ fontWeight: 700, color: "#0f172a" }}>{entry.title}</div>
                                  {entry.note && <div style={{ fontSize: "11px", color: "#64748b", marginTop: "2px" }}>{entry.note}</div>}
                                </td>
                                <td style={{ padding: "12px 16px" }}>
                                  {isCredit ? (
                                    <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "3px 8px", borderRadius: "6px", background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", fontSize: "11px", fontWeight: 800 }}>
                                      🔴 Unpaid Credit
                                    </span>
                                  ) : isClearance ? (
                                    <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "3px 8px", borderRadius: "6px", background: "#f0fdf4", color: "#059669", border: "1px solid #bbf7d0", fontSize: "11px", fontWeight: 700 }}>
                                      🟢 Cleared ({entry.paymentMode})
                                    </span>
                                  ) : (
                                    <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "3px 8px", borderRadius: "6px", background: "#ecfdf5", color: "#047857", border: "1px solid #a7f3d0", fontSize: "11px", fontWeight: 700 }}>
                                      ✓ Paid ({entry.paymentMode})
                                    </span>
                                  )}
                                </td>
                                <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: 800, color: isCredit ? "#dc2626" : "#0f172a" }}>
                                  {entry.totalAmount > 0 ? `₹${formatMoney(entry.totalAmount)}` : "-"}
                                </td>
                                <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: 800, color: entry.creditCleared > 0 ? "#059669" : "#94a3b8" }}>
                                  {entry.creditCleared > 0 ? `- ₹${formatMoney(entry.creditCleared)}` : "-"}
                                </td>
                                <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: 900, color: entry.runningCreditBalance > 0 ? "#dc2626" : "#059669", background: "#f8fafc" }}>
                                  ₹{formatMoney(entry.runningCreditBalance)}
                                </td>
                                <td className="no-print" style={{ padding: "12px 16px", textAlign: "center" }}>
                                  <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "6px" }}>
                                    {!isOwner && isCredit && entry.rawExpense && (
                                      <button
                                        type="button"
                                        onClick={() => openMarkPaidModal(entry.rawExpense!)}
                                        title="Mark this credit bill as Paid"
                                        style={{
                                          padding: "4px 10px",
                                          borderRadius: "6px",
                                          background: "#16a34a",
                                          color: "#ffffff",
                                          border: "none",
                                          fontSize: "11px",
                                          fontWeight: 800,
                                          cursor: "pointer",
                                          display: "inline-flex",
                                          alignItems: "center",
                                          gap: "3px",
                                          boxShadow: "0 1px 2px rgba(22, 163, 74, 0.3)",
                                        }}
                                      >
                                        <span>💵</span> Mark Paid
                                      </button>
                                    )}
                                    {!isOwner && entry.rawExpense && (
                                      <button
                                        type="button"
                                        onClick={() => openEditModal(entry.rawExpense!)}
                                        style={{
                                          padding: "4px 8px",
                                          borderRadius: "6px",
                                          background: "#f1f5f9",
                                          color: "#334155",
                                          border: "1px solid #cbd5e1",
                                          fontSize: "11px",
                                          fontWeight: 600,
                                          cursor: "pointer",
                                        }}
                                      >
                                        Edit
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot>
                          <tr style={{ background: "#f8fafc", borderTop: "2px solid #cbd5e1", fontWeight: 800, color: "#0f172a" }}>
                            <td colSpan={4} style={{ padding: "12px 16px" }}>
                              Total Purchased: ₹{formatMoney(selectedVendorData.totalBilled)} • Credit Taken: ₹{formatMoney(selectedVendorData.totalCredit)} • Cleared: ₹{formatMoney(selectedVendorData.totalCleared)}
                            </td>
                            <td style={{ padding: "12px 16px", textAlign: "right", color: "#dc2626" }}>
                              Credit: ₹{formatMoney(selectedVendorData.totalCredit)}
                            </td>
                            <td style={{ padding: "12px 16px", textAlign: "right", color: "#059669" }}>
                              - ₹{formatMoney(selectedVendorData.totalCleared)}
                            </td>
                            <td style={{ padding: "12px 16px", textAlign: "right", color: selectedVendorData.pendingBalance > 0 ? "#dc2626" : "#059669", fontSize: "15px", background: "#f1f5f9" }}>
                              Due: ₹{formatMoney(selectedVendorData.pendingBalance)}
                            </td>
                            <td className="no-print" />
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                </div>
              ) : (
                /* All Vendor Accounts Overview Grid */
                <div>
                  {/* Search and Status Filter */}
                  <div
                    style={{
                      background: "#ffffff",
                      borderRadius: "12px",
                      border: "1px solid #e2e8f0",
                      padding: "14px 18px",
                      marginBottom: "20px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      flexWrap: "wrap",
                      gap: "12px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span style={{ fontSize: "11px", color: "#64748b", fontWeight: 700, textTransform: "uppercase" }}>
                          Status:
                        </span>
                        <select
                          value={vendorStatusFilter}
                          onChange={(e) => setVendorStatusFilter(e.target.value as any)}
                          style={{
                            height: "34px",
                            padding: "0 10px",
                            borderRadius: "8px",
                            border: "1px solid #cbd5e1",
                            background: "#ffffff",
                            fontSize: "12px",
                            color: "#0f172a",
                            fontWeight: 600,
                          }}
                        >
                          <option value="all">All Accounts ({vendorAccounts.length})</option>
                          <option value="due">Credit Due Only ({pendingVendorsCount})</option>
                          <option value="settled">Fully Settled Only ({vendorAccounts.length - pendingVendorsCount})</option>
                        </select>
                      </div>

                      <input
                        type="text"
                        placeholder="Search supplier..."
                        value={vendorSearch}
                        onChange={(e) => setVendorSearch(e.target.value)}
                        style={{
                          height: "34px",
                          padding: "0 12px",
                          borderRadius: "8px",
                          border: "1px solid #cbd5e1",
                          fontSize: "12px",
                          width: "220px",
                        }}
                      />
                    </div>

                    {!isOwner && (
                      <button
                        type="button"
                        onClick={() => openClearSettlementModal()}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                          background: "#059669",
                          color: "#ffffff",
                          border: "none",
                          borderRadius: "8px",
                          padding: "8px 16px",
                          fontWeight: 700,
                          fontSize: "12px",
                          cursor: "pointer",
                        }}
                      >
                        <span>🤝</span> Clear Supplier Credit
                      </button>
                    )}
                  </div>

                  {/* Vendor Account Cards */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                      gap: "16px",
                      marginBottom: "24px",
                    }}
                  >
                    {filteredVendorAccounts.map((v) => {
                      const topCat = Object.entries(v.categories).sort((a, b) => b[1] - a[1])[0]?.[0] || "Miscellaneous";
                      const isDue = v.pendingBalance > 0;
                      return (
                        <div
                          key={v.name}
                          style={{
                            background: "#ffffff",
                            borderRadius: "12px",
                            border: isDue ? "1px solid #fecaca" : "1px solid #e2e8f0",
                            padding: "18px 20px",
                            boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
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
                                    borderRadius: "8px",
                                    background: isDue ? "#fef2f2" : "#f1f5f9",
                                    color: isDue ? "#dc2626" : "#0369a1",
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
                                  <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "#0f172a" }}>
                                    {v.name}
                                  </h3>
                                  <span style={{ fontSize: "11px", color: "#64748b" }}>
                                    {v.billCount} purchases ({v.creditBillCount} on credit)
                                  </span>
                                </div>
                              </div>

                              <span
                                style={{
                                  fontSize: "11px",
                                  fontWeight: 800,
                                  padding: "3px 8px",
                                  borderRadius: "10px",
                                  background: isDue ? "#fef2f2" : "#ecfdf5",
                                  color: isDue ? "#dc2626" : "#059669",
                                  border: isDue ? "1px solid #fecaca" : "1px solid #a7f3d0",
                                }}
                              >
                                {isDue ? `₹${formatMoney(v.pendingBalance)} Due` : "✓ Settled"}
                              </span>
                            </div>

                            <div style={{ marginTop: "12px", display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                              <span style={{ fontSize: "12px", color: "#64748b" }}>Total Purchases:</span>
                              <span style={{ fontSize: "14px", fontWeight: 700, color: "#0f172a" }}>
                                ₹{formatMoney(v.totalBilled)}
                              </span>
                            </div>

                            <div style={{ marginTop: "4px", display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                              <span style={{ fontSize: "12px", color: "#dc2626" }}>Credit Taken:</span>
                              <span style={{ fontSize: "13px", fontWeight: 700, color: "#dc2626" }}>
                                ₹{formatMoney(v.totalCredit)}
                              </span>
                            </div>

                            <div style={{ marginTop: "4px", display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                              <span style={{ fontSize: "12px", color: "#059669" }}>Credit Cleared:</span>
                              <span style={{ fontSize: "13px", fontWeight: 700, color: "#059669" }}>
                                ₹{formatMoney(v.totalCleared)}
                              </span>
                            </div>

                            <div style={{ marginTop: "6px", paddingTop: "6px", borderTop: "1px dashed #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                              <span style={{ fontSize: "12px", color: isDue ? "#dc2626" : "#059669", fontWeight: 700 }}>Outstanding Due:</span>
                              <span style={{ fontSize: "16px", fontWeight: 900, color: isDue ? "#dc2626" : "#059669" }}>
                                ₹{formatMoney(v.pendingBalance)}
                              </span>
                            </div>
                          </div>

                          <div style={{ display: "flex", gap: "8px" }}>
                            {!isOwner && isDue && (
                              <button
                                type="button"
                                onClick={() => openClearSettlementModal(v.name, v.pendingBalance)}
                                style={{
                                  flex: 1,
                                  padding: "8px 12px",
                                  borderRadius: "8px",
                                  border: "none",
                                  background: "#059669",
                                  color: "#ffffff",
                                  fontWeight: 700,
                                  fontSize: "12px",
                                  cursor: "pointer",
                                }}
                              >
                                🤝 Clear Balance
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => setSelectedVendor(v.name)}
                              style={{
                                flex: 1,
                                padding: "8px 12px",
                                borderRadius: "8px",
                                border: "1px solid #cbd5e1",
                                background: "#ffffff",
                                color: "#2563eb",
                                fontWeight: 700,
                                fontSize: "12px",
                                cursor: "pointer",
                              }}
                            >
                              Statement →
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 3: CREDIT BALANCE CLEARANCES HISTORY */}
          {/* ======================================================== */}
          {activeTab === "settlement" && (
            <div>
              <div
                style={{
                  background: "#ffffff",
                  borderRadius: "12px",
                  border: "1px solid #e2e8f0",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    padding: "16px 20px",
                    borderBottom: "1px solid #e2e8f0",
                    background: "#f8fafc",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: "12px",
                  }}
                >
                  <div>
                    <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "#0f172a" }}>
                      Credit Clearance Payments History ({settlements.length})
                    </h3>
                    <span style={{ fontSize: "12px", color: "#64748b" }}>
                      Permanent record of payments made to suppliers to settle credit purchases
                    </span>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <span style={{ fontSize: "13px", fontWeight: 800, color: "#059669", background: "#ecfdf5", border: "1px solid #a7f3d0", padding: "4px 10px", borderRadius: "8px" }}>
                      Total Cleared: ₹{formatMoney(metrics.totalSettled)}
                    </span>

                    {!isOwner && (
                      <button
                        type="button"
                        onClick={() => openClearSettlementModal()}
                        style={{
                          background: "#059669",
                          color: "#fff",
                          border: "none",
                          borderRadius: "8px",
                          padding: "8px 14px",
                          fontWeight: 700,
                          fontSize: "12px",
                          cursor: "pointer",
                        }}
                      >
                        + Clear Supplier Credit
                      </button>
                    )}
                  </div>
                </div>

                {settlements.length === 0 ? (
                  <div style={{ padding: "48px", textAlign: "center", color: "#64748b" }}>
                    No credit clearances recorded yet. Click <strong>"Clear Supplier Credit"</strong> to settle an outstanding supplier balance.
                  </div>
                ) : (
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", minWidth: "850px", borderCollapse: "collapse", fontSize: "13px", textAlign: "left" }}>
                      <thead>
                        <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0", color: "#334155", fontWeight: 700 }}>
                          <th style={{ padding: "12px 16px" }}>Clearance Date</th>
                          <th style={{ padding: "12px 16px" }}>Voucher #</th>
                          <th style={{ padding: "12px 16px" }}>Supplier / Payee</th>
                          <th style={{ padding: "12px 16px" }}>Payment Mode</th>
                          <th style={{ padding: "12px 16px" }}>Reference #</th>
                          <th style={{ padding: "12px 16px" }}>Remarks</th>
                          <th style={{ padding: "12px 16px", textAlign: "right" }}>Amount Cleared (₹)</th>
                          <th className="no-print" style={{ padding: "12px 16px", textAlign: "center" }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {settlements.map((s) => (
                          <tr key={s.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                            <td style={{ padding: "12px 16px", fontWeight: 600, color: "#0f172a" }}>
                              {formatDate(s.settlement_date)}
                            </td>
                            <td style={{ padding: "12px 16px", fontFamily: "monospace", color: "#2563eb", fontWeight: 700 }}>
                              SETTLE-{String(s.id).padStart(4, "0")}
                            </td>
                            <td style={{ padding: "12px 16px", fontWeight: 700, color: "#0f172a" }}>
                              {s.vendor}
                            </td>
                            <td style={{ padding: "12px 16px" }}>
                              <span style={{ padding: "2px 8px", borderRadius: "4px", background: "#ecfdf5", color: "#059669", fontWeight: 600, fontSize: "11px" }}>
                                {s.payment_mode}
                              </span>
                            </td>
                            <td style={{ padding: "12px 16px", color: "#64748b", fontFamily: "monospace" }}>
                              {s.reference_no ? `#${s.reference_no}` : "-"}
                            </td>
                            <td style={{ padding: "12px 16px", color: "#64748b" }}>
                              {s.note || "-"}
                            </td>
                            <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: 800, color: "#059669", fontSize: "14px" }}>
                              ✓ ₹{formatMoney(s.amount)}
                            </td>
                            <td className="no-print" style={{ padding: "12px 16px", textAlign: "center" }}>
                              {!isOwner && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteSettlement(s.id, s.vendor, s.amount)}
                                  title="Void this clearance and restore credit balance"
                                  style={{
                                    padding: "3px 8px",
                                    borderRadius: "4px",
                                    border: "none",
                                    background: "#fef2f2",
                                    color: "#dc2626",
                                    fontSize: "11px",
                                    fontWeight: 700,
                                    cursor: "pointer",
                                  }}
                                >
                                  Void
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 4: MONTHLY & CATEGORY AUDIT */}
          {/* ======================================================== */}
          {activeTab === "audit" && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(440px, 1fr))", gap: "20px" }}>
              {/* Monthly Audit Table */}
              <div
                style={{
                  background: "#ffffff",
                  borderRadius: "12px",
                  border: "1px solid #e2e8f0",
                  overflow: "hidden",
                }}
              >
                <div style={{ padding: "14px 18px", borderBottom: "1px solid #e2e8f0", background: "#f8fafc" }}>
                  <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "#0f172a" }}>
                    📅 Monthly Expenditure & Credit Audit
                  </h3>
                  <span style={{ fontSize: "12px", color: "#64748b" }}>
                    Month-by-month spend, direct paid, credit taken & credit cleared
                  </span>
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", textAlign: "left" }}>
                    <thead>
                      <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", color: "#334155", fontWeight: 700 }}>
                        <th style={{ padding: "12px 16px" }}>Month</th>
                        <th style={{ padding: "12px 16px", textAlign: "right" }}>Total Spend (₹)</th>
                        <th style={{ padding: "12px 16px", textAlign: "right" }}>Credit Taken (₹)</th>
                        <th style={{ padding: "12px 16px", textAlign: "right" }}>Credit Cleared (₹)</th>
                        <th style={{ padding: "12px 16px", textAlign: "right" }}>Credit Due (₹)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {monthlyLedger.map((m) => (
                        <tr key={m.monthKey} style={{ borderBottom: "1px solid #f1f5f9" }}>
                          <td style={{ padding: "12px 16px", fontWeight: 700, color: "#0f172a" }}>
                            {formatMonthYear(m.monthKey)}
                          </td>
                          <td style={{ padding: "12px 16px", textAlign: "right", color: "#0f172a", fontWeight: 700 }}>
                            ₹{formatMoney(m.totalBilled)}
                          </td>
                          <td style={{ padding: "12px 16px", textAlign: "right", color: "#dc2626", fontWeight: 700 }}>
                            ₹{formatMoney(m.totalCredit)}
                          </td>
                          <td style={{ padding: "12px 16px", textAlign: "right", color: "#059669", fontWeight: 700 }}>
                            - ₹{formatMoney(m.totalCleared)}
                          </td>
                          <td style={{ padding: "12px 16px", textAlign: "right", color: m.netDue > 0 ? "#dc2626" : "#059669", fontWeight: 800 }}>
                            ₹{formatMoney(m.netDue)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Category Breakdown Table */}
              <div
                style={{
                  background: "#ffffff",
                  borderRadius: "12px",
                  border: "1px solid #e2e8f0",
                  overflow: "hidden",
                }}
              >
                <div style={{ padding: "14px 18px", borderBottom: "1px solid #e2e8f0", background: "#f8fafc" }}>
                  <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "#0f172a" }}>
                    🏷️ Category-wise Spend Breakdown
                  </h3>
                  <span style={{ fontSize: "12px", color: "#64748b" }}>
                    Where expenditures are allocated across supply categories
                  </span>
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", textAlign: "left" }}>
                    <thead>
                      <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", color: "#334155", fontWeight: 700 }}>
                        <th style={{ padding: "12px 16px" }}>Category</th>
                        <th style={{ padding: "12px 16px", textAlign: "right" }}>Total (₹)</th>
                        <th style={{ padding: "12px 16px" }}>Share %</th>
                        <th style={{ padding: "12px 16px" }}>Top Supplier</th>
                      </tr>
                    </thead>
                    <tbody>
                      {categoryLedger.map((c) => (
                        <tr key={c.category} style={{ borderBottom: "1px solid #f1f5f9" }}>
                          <td style={{ padding: "12px 16px", fontWeight: 700, color: "#0f172a" }}>
                            {c.category}
                          </td>
                          <td style={{ padding: "12px 16px", textAlign: "right", color: "#0f172a", fontWeight: 800 }}>
                            ₹{formatMoney(c.total)}
                          </td>
                          <td style={{ padding: "12px 16px", minWidth: "120px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                              <div style={{ flex: 1, background: "#f1f5f9", height: "6px", borderRadius: "3px", overflow: "hidden" }}>
                                <div style={{ width: `${Math.min(100, c.percentage)}%`, height: "100%", background: "#2563eb" }} />
                              </div>
                              <span style={{ fontSize: "11px", fontWeight: 700, color: "#2563eb", width: "38px" }}>
                                {c.percentage.toFixed(1)}%
                              </span>
                            </div>
                          </td>
                          <td style={{ padding: "12px 16px", color: "#475569", fontSize: "12px" }}>
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
      {/* QUICK MARK EXPENSE AS PAID MODAL */}
      {/* ======================================================== */}
      {markPaidModalOpen && targetExpense && (
        <div
          className="no-print"
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
              maxWidth: "520px",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
              overflow: "hidden",
              border: "1px solid #e2e8f0",
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: "18px 22px",
                background: "linear-gradient(135deg, #065f46 0%, #047857 100%)",
                color: "#ffffff",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: "17px", fontWeight: 800, display: "flex", alignItems: "center", gap: "8px" }}>
                  <span>💵</span> Mark Expense as Paid
                </h3>
                <span style={{ fontSize: "12px", color: "#a7f3d0", marginTop: "2px", display: "block" }}>
                  Instantly settle this credit bill and clear it from supplier dues
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setMarkPaidModalOpen(false);
                  setTargetExpense(null);
                }}
                disabled={markingPaid}
                style={{
                  background: "rgba(255, 255, 255, 0.2)",
                  border: "none",
                  color: "#fff",
                  borderRadius: "50%",
                  width: "28px",
                  height: "28px",
                  cursor: "pointer",
                  fontSize: "14px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                ✕
              </button>
            </div>

            {/* Bill Summary Card */}
            <div style={{ padding: "20px 22px 0 22px" }}>
              <div
                style={{
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: "10px",
                  padding: "14px 16px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "12px",
                }}
              >
                <div>
                  <div style={{ fontSize: "15px", fontWeight: 800, color: "#0f172a" }}>
                    {targetExpense.title}
                  </div>
                  <div style={{ fontSize: "12px", color: "#64748b", marginTop: "3px" }}>
                    {targetExpense.vendor ? `Supplier: ${targetExpense.vendor}` : "Direct Payee"} • {targetExpense.category}
                    {targetExpense.bill_number ? ` • Bill #${targetExpense.bill_number}` : ""}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <span style={{ fontSize: "11px", color: "#dc2626", fontWeight: 700, textTransform: "uppercase" }}>
                    Amount Due
                  </span>
                  <div style={{ fontSize: "22px", fontWeight: 900, color: "#dc2626" }}>
                    ₹{formatMoney(targetExpense.amount)}
                  </div>
                </div>
              </div>
            </div>

            {/* 1-Click Instant Settle Presets */}
            <div style={{ padding: "16px 22px 0 22px" }}>
              <label style={{ display: "block", fontSize: "11px", fontWeight: 800, color: "#475569", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "8px" }}>
                ⚡ 1-Click Instant Settle (Today):
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px" }}>
                <button
                  type="button"
                  disabled={markingPaid}
                  onClick={() => handleQuickMarkPaid(targetExpense, "Cash")}
                  style={{
                    padding: "10px 8px",
                    borderRadius: "8px",
                    background: "#ecfdf5",
                    border: "1px solid #a7f3d0",
                    color: "#065f46",
                    fontWeight: 800,
                    fontSize: "12px",
                    cursor: markingPaid ? "not-allowed" : "pointer",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "4px",
                    transition: "all 0.15s ease",
                  }}
                >
                  <span style={{ fontSize: "18px" }}>💵</span>
                  <span>Paid in Cash</span>
                </button>

                <button
                  type="button"
                  disabled={markingPaid}
                  onClick={() => handleQuickMarkPaid(targetExpense, "UPI / GPay / PhonePe")}
                  style={{
                    padding: "10px 8px",
                    borderRadius: "8px",
                    background: "#eff6ff",
                    border: "1px solid #bfdbfe",
                    color: "#1e40af",
                    fontWeight: 800,
                    fontSize: "12px",
                    cursor: markingPaid ? "not-allowed" : "pointer",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "4px",
                    transition: "all 0.15s ease",
                  }}
                >
                  <span style={{ fontSize: "18px" }}>📱</span>
                  <span>Paid via UPI</span>
                </button>

                <button
                  type="button"
                  disabled={markingPaid}
                  onClick={() => handleQuickMarkPaid(targetExpense, "Bank Transfer / NEFT")}
                  style={{
                    padding: "10px 8px",
                    borderRadius: "8px",
                    background: "#f8fafc",
                    border: "1px solid #cbd5e1",
                    color: "#334155",
                    fontWeight: 800,
                    fontSize: "12px",
                    cursor: markingPaid ? "not-allowed" : "pointer",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "4px",
                    transition: "all 0.15s ease",
                  }}
                >
                  <span style={{ fontSize: "18px" }}>🏦</span>
                  <span>Bank Transfer</span>
                </button>
              </div>
            </div>

            {/* Divider */}
            <div style={{ display: "flex", alignItems: "center", margin: "16px 22px", gap: "10px" }}>
              <div style={{ flex: 1, height: "1px", background: "#e2e8f0" }} />
              <span style={{ fontSize: "11px", color: "#94a3b8", fontWeight: 700, textTransform: "uppercase" }}>or Custom Details</span>
              <div style={{ flex: 1, height: "1px", background: "#e2e8f0" }} />
            </div>

            {/* Custom Options Form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                executeMarkExpensePaid(targetExpense, markPaidMode, markPaidDate, markPaidRef);
              }}
              style={{ padding: "0 22px 22px 22px", display: "flex", flexDirection: "column", gap: "12px" }}
            >
              <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#334155", marginBottom: "5px" }}>
                    Payment Mode *
                  </label>
                  <select
                    value={markPaidMode}
                    onChange={(e) => setMarkPaidMode(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                      fontSize: "13px",
                      background: "#ffffff",
                      color: "#0f172a",
                      fontWeight: 600,
                    }}
                  >
                    {DIRECT_PAYMENT_METHODS.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#334155", marginBottom: "5px" }}>
                    Payment Date *
                  </label>
                  <input
                    type="date"
                    value={markPaidDate}
                    onChange={(e) => setMarkPaidDate(e.target.value)}
                    required
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                      fontSize: "13px",
                      background: "#ffffff",
                      color: "#0f172a",
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#334155", marginBottom: "5px" }}>
                  Reference / Transaction Note (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. UPI Ref 9845..., Cheque #4521"
                  value={markPaidRef}
                  onChange={(e) => setMarkPaidRef(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    fontSize: "13px",
                    background: "#ffffff",
                  }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "8px" }}>
                <button
                  type="button"
                  disabled={markingPaid}
                  onClick={() => {
                    setMarkPaidModalOpen(false);
                    setTargetExpense(null);
                  }}
                  style={{
                    padding: "9px 16px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    background: "#ffffff",
                    color: "#475569",
                    fontSize: "13px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={markingPaid}
                  style={{
                    padding: "9px 20px",
                    borderRadius: "8px",
                    border: "none",
                    background: "#059669",
                    color: "#ffffff",
                    fontSize: "13px",
                    fontWeight: 800,
                    cursor: markingPaid ? "not-allowed" : "pointer",
                    boxShadow: "0 2px 6px rgba(5, 150, 105, 0.3)",
                  }}
                >
                  {markingPaid ? "Updating..." : "✓ Confirm Payment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* CLEAR CREDIT BALANCE MODAL */}
      {/* ======================================================== */}
      {settleModalOpen && (
        <div
          className="no-print"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.6)",
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
              borderRadius: "14px",
              width: "100%",
              maxWidth: "540px",
              maxHeight: "90vh",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 20px 40px rgba(0, 0, 0, 0.2)",
              overflow: "hidden",
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: "18px 22px",
                background: "#065f46",
                color: "#ffffff",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexShrink: 0,
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 800 }}>
                  🤝 Clear Supplier Credit Balance
                </h3>
                <span style={{ fontSize: "12px", color: "#a7f3d0" }}>
                  Record clearance payment to settle outstanding credit owed to a vendor
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSettleModalOpen(false)}
                style={{
                  background: "rgba(255, 255, 255, 0.2)",
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
            <form onSubmit={handleSaveSettlement} style={{ padding: "20px 22px", overflowY: "auto", flex: 1, display: "flex", flexDirection: "column" }}>
              {/* Select or Type Vendor */}
              <div style={{ marginBottom: "16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                  <label style={{ fontSize: "13px", fontWeight: 700, color: "#0f172a" }}>
                    Supplier / Vendor Account *
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setIsCustomVendor(!isCustomVendor);
                    }}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "#2563eb",
                      fontSize: "12px",
                      fontWeight: 600,
                      cursor: "pointer",
                      textDecoration: "underline",
                    }}
                  >
                    {isCustomVendor ? "← Choose from accounts" : "➕ Type new / unlisted vendor"}
                  </button>
                </div>

                {!isCustomVendor ? (
                  <select
                    value={settleVendor}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === "__CUSTOM__") {
                        setIsCustomVendor(true);
                        setSettleVendor("");
                        return;
                      }
                      setSettleVendor(v);
                      const vendorObj = vendorAccounts.find((item) => item.name === v);
                      if (vendorObj && vendorObj.pendingBalance > 0) {
                        setSettleAmount(String(vendorObj.pendingBalance));
                      }
                      setSettleNote(`Credit balance clearance for ${v}`);
                    }}
                    required
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                      fontSize: "13px",
                      background: "#ffffff",
                      fontWeight: 600,
                      color: "#0f172a",
                    }}
                  >
                    <option value="">-- Select Vendor Account to Clear --</option>
                    {vendorAccounts
                      .filter((v) => v.name !== "Direct / Cash Outflows")
                      .map((v) => (
                        <option key={v.name} value={v.name} disabled={v.pendingBalance <= 0}>
                          {v.name} {v.pendingBalance > 0 ? `— ₹${formatMoney(v.pendingBalance)} Due` : "— Fully Settled (₹0 Due - Locked)"}
                        </option>
                      ))}
                    <option value="__CUSTOM__">➕ Enter Custom / Other Vendor Name...</option>
                  </select>
                ) : (
                  <div>
                    <input
                      type="text"
                      list="settle-vendor-datalist"
                      placeholder="Enter supplier / vendor / payee name..."
                      value={settleVendor}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSettleVendor(val);
                        const vendorObj = vendorAccounts.find((item) => item.name.toLowerCase() === val.trim().toLowerCase());
                        if (vendorObj && vendorObj.pendingBalance > 0) {
                          setSettleAmount(String(vendorObj.pendingBalance));
                        }
                      }}
                      required
                      autoFocus
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        borderRadius: "8px",
                        border: "1px solid #2563eb",
                        fontSize: "13px",
                        background: "#ffffff",
                        fontWeight: 600,
                        color: "#0f172a",
                      }}
                    />
                    <datalist id="settle-vendor-datalist">
                      {vendorAccounts.map((v) => (
                        <option key={v.name} value={v.name} />
                      ))}
                    </datalist>
                  </div>
                )}

                {/* Quick Chips for Outstanding Due Accounts */}
                {vendorAccounts.filter((v) => v.pendingBalance > 0).length > 0 && (
                  <div style={{ marginTop: "10px" }}>
                    <div style={{ fontSize: "11px", color: "#64748b", fontWeight: 700, marginBottom: "4px" }}>
                      SUPPLIERS WAITING FOR PAYMENT:
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                      {vendorAccounts
                        .filter((v) => v.pendingBalance > 0)
                        .map((v) => {
                          const isSelected = settleVendor.trim().toLowerCase() === v.name.toLowerCase();
                          return (
                            <button
                              key={v.name}
                              type="button"
                              onClick={() => {
                                setIsCustomVendor(false);
                                setSettleVendor(v.name);
                                setSettleAmount(String(v.pendingBalance));
                                setSettleNote(`Credit balance clearance for ${v.name}`);
                              }}
                              style={{
                                padding: "4px 10px",
                                borderRadius: "16px",
                                border: isSelected ? "1px solid #059669" : "1px solid #a7f3d0",
                                background: isSelected ? "#059669" : "#ecfdf5",
                                color: isSelected ? "#ffffff" : "#065f46",
                                fontSize: "11px",
                                fontWeight: 700,
                                cursor: "pointer",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                              }}
                            >
                              <span>🏪</span> {v.name} (<strong>₹{formatMoney(v.pendingBalance)}</strong>)
                            </button>
                          );
                        })}
                    </div>
                  </div>
                )}
              </div>

              {/* Active Vendor Balance Info Card */}
              {activeModalVendorAccount && (
                <div
                  style={{
                    background: activeModalVendorAccount.pendingBalance > 0 ? "#fef2f2" : "#f0fdf4",
                    border: activeModalVendorAccount.pendingBalance > 0 ? "1px solid #fecaca" : "1px solid #a7f3d0",
                    borderRadius: "10px",
                    padding: "12px 16px",
                    marginBottom: "16px",
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr 1fr",
                    gap: "10px",
                    textAlign: "center",
                  }}
                >
                  <div>
                    <div style={{ fontSize: "11px", color: "#64748b", fontWeight: 600 }}>Credit Taken</div>
                    <div style={{ fontSize: "14px", fontWeight: 800, color: "#0f172a", marginTop: "2px" }}>
                      ₹{formatMoney(activeModalVendorAccount.totalCredit)}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: "11px", color: "#059669", fontWeight: 600 }}>Already Cleared</div>
                    <div style={{ fontSize: "14px", fontWeight: 800, color: "#059669", marginTop: "2px" }}>
                      ₹{formatMoney(activeModalVendorAccount.totalCleared)}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: "11px", color: activeModalVendorAccount.pendingBalance > 0 ? "#dc2626" : "#059669", fontWeight: 700 }}>
                      {activeModalVendorAccount.pendingBalance > 0 ? "Outstanding Due" : "Status"}
                    </div>
                    <div
                      style={{
                        fontSize: "15px",
                        fontWeight: 900,
                        color: activeModalVendorAccount.pendingBalance > 0 ? "#dc2626" : "#059669",
                        marginTop: "2px",
                      }}
                    >
                      {activeModalVendorAccount.pendingBalance > 0 ? `₹${formatMoney(activeModalVendorAccount.pendingBalance)}` : "Fully Settled ✓"}
                    </div>
                  </div>
                </div>
              )}

              {/* Clearance Amount & Quick Full Balance Button */}
              <div style={{ marginBottom: "16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                  <label style={{ fontSize: "13px", fontWeight: 700, color: "#0f172a" }}>
                    Clearance Amount (₹) *
                  </label>
                  {activeModalVendorAccount && activeModalVendorAccount.pendingBalance > 0 && (
                    <button
                      type="button"
                      onClick={() => setSettleAmount(String(activeModalVendorAccount.pendingBalance))}
                      style={{
                        border: "1px solid #a7f3d0",
                        background: "#ecfdf5",
                        color: "#047857",
                        fontSize: "11px",
                        fontWeight: 800,
                        padding: "3px 10px",
                        borderRadius: "6px",
                        cursor: "pointer",
                      }}
                    >
                      ⚡ Clear Full Credit Balance (₹{formatMoney(activeModalVendorAccount.pendingBalance)})
                    </button>
                  )}
                </div>
                <div style={{ position: "relative" }}>
                  <span style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", fontSize: "16px", fontWeight: 800, color: (activeModalVendorAccount && activeModalVendorAccount.pendingBalance <= 0) ? "#94a3b8" : "#059669" }}>
                    ₹
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    max={activeModalVendorAccount && activeModalVendorAccount.pendingBalance > 0 ? activeModalVendorAccount.pendingBalance : undefined}
                    placeholder={activeModalVendorAccount && activeModalVendorAccount.pendingBalance <= 0 ? "Account is fully settled (₹0 Due)" : "Enter amount to clear..."}
                    value={settleAmount}
                    disabled={activeModalVendorAccount ? activeModalVendorAccount.pendingBalance <= 0 : false}
                    onChange={(e) => setSettleAmount(e.target.value)}
                    required
                    style={{
                      width: "100%",
                      padding: "10px 12px 10px 28px",
                      borderRadius: "8px",
                      border: (activeModalVendorAccount && parseFloat(settleAmount) > activeModalVendorAccount.pendingBalance) ? "1px solid #ef4444" : "1px solid #cbd5e1",
                      fontSize: "16px",
                      fontWeight: 800,
                      color: (activeModalVendorAccount && activeModalVendorAccount.pendingBalance <= 0) ? "#94a3b8" : "#059669",
                      background: (activeModalVendorAccount && activeModalVendorAccount.pendingBalance <= 0) ? "#f8fafc" : "#ffffff",
                    }}
                  />
                </div>

                {/* Over-clearance warning */}
                {activeModalVendorAccount && activeModalVendorAccount.pendingBalance > 0 && parseFloat(settleAmount) > activeModalVendorAccount.pendingBalance && (
                  <div style={{ marginTop: "6px", fontSize: "12px", color: "#dc2626", fontWeight: 700, display: "flex", alignItems: "center", gap: "4px" }}>
                    <span>❌</span>
                    <span>Amount exceeds outstanding balance (₹{formatMoney(activeModalVendorAccount.pendingBalance)}). Maximum allowed is ₹{formatMoney(activeModalVendorAccount.pendingBalance)}.</span>
                  </div>
                )}
                {activeModalVendorAccount && activeModalVendorAccount.pendingBalance <= 0 && (
                  <div style={{ marginTop: "6px", fontSize: "12px", color: "#b91c1c", fontWeight: 700, display: "flex", alignItems: "center", gap: "4px" }}>
                    <span>🚫</span>
                    <span>This account has ₹0 outstanding balance and is already fully settled.</span>
                  </div>
                )}
              </div>

              {/* Settlement Date & Mode row */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginBottom: "16px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#0f172a", marginBottom: "6px" }}>
                    Clearance Date *
                  </label>
                  <input
                    type="date"
                    value={settleDate}
                    onChange={(e) => setSettleDate(e.target.value)}
                    required
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                      fontSize: "13px",
                      background: "#ffffff",
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#0f172a", marginBottom: "6px" }}>
                    Payment Mode *
                  </label>
                  <select
                    value={settleMode}
                    onChange={(e) => setSettleMode(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                      fontSize: "13px",
                      background: "#ffffff",
                    }}
                  >
                    {CLEARANCE_PAYMENT_METHODS.map((pm) => (
                      <option key={pm} value={pm}>
                        {pm}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Reference Number */}
              <div style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#0f172a", marginBottom: "6px" }}>
                  Cheque / Transaction / Voucher # (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. UTR-98234, CHQ-10492"
                  value={settleReference}
                  onChange={(e) => setSettleReference(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    fontSize: "13px",
                    background: "#ffffff",
                  }}
                />
              </div>

              {/* Notes */}
              <div style={{ marginBottom: "24px" }}>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#0f172a", marginBottom: "6px" }}>
                  Remarks / Clearance Note
                </label>
                <input
                  type="text"
                  placeholder="e.g. Cleared October vegetable supply balance"
                  value={settleNote}
                  onChange={(e) => setSettleNote(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    fontSize: "13px",
                    background: "#ffffff",
                  }}
                />
              </div>

              {/* Action Buttons */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", position: "sticky", bottom: 0, background: "#ffffff", paddingTop: "14px", borderTop: "1px solid #f1f5f9", marginTop: "auto" }}>
                <button
                  type="button"
                  onClick={() => setSettleModalOpen(false)}
                  disabled={settling}
                  style={{
                    padding: "10px 18px",
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

                {(() => {
                  const isZeroDue = activeModalVendorAccount ? activeModalVendorAccount.pendingBalance <= 0 : false;
                  const parsedAmt = parseFloat(settleAmount) || 0;
                  const isOverAmt = activeModalVendorAccount ? parsedAmt > activeModalVendorAccount.pendingBalance : false;
                  const isBlocked = settling || isZeroDue || isOverAmt || parsedAmt <= 0;

                  return (
                    <button
                      type="submit"
                      disabled={isBlocked}
                      style={{
                        padding: "10px 22px",
                        borderRadius: "8px",
                        border: "none",
                        background: isBlocked ? "#94a3b8" : "#059669",
                        color: "#ffffff",
                        fontWeight: 700,
                        fontSize: "13px",
                        cursor: isBlocked ? "not-allowed" : "pointer",
                        boxShadow: isBlocked ? "none" : "0 2px 6px rgba(5, 150, 105, 0.25)",
                      }}
                    >
                      {settling ? "Clearing..." : isZeroDue ? "Account Already Settled" : isOverAmt ? "Amount Exceeds Balance" : "✓ Confirm Credit Clearance"}
                    </button>
                  );
                })()}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* ADD / EDIT EXPENSE MODAL (PAID OR CREDIT) */}
      {/* ======================================================== */}
      {modalOpen && (
        <div
          className="no-print"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.6)",
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
              borderRadius: "14px",
              width: "100%",
              maxWidth: "560px",
              maxHeight: "90vh",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 20px 40px rgba(0, 0, 0, 0.2)",
              overflow: "hidden",
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: "18px 22px",
                background: formType === "credit" ? "#991b1b" : "#1e40af",
                color: "#ffffff",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexShrink: 0,
                transition: "background 0.2s ease",
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 800 }}>
                  {editingExpenseId
                    ? "Edit Expense Record"
                    : formType === "credit"
                    ? "📋 Record Supplier Credit Bill (Khata)"
                    : "💵 Record Direct Paid Expense"}
                </h3>
                <span style={{ fontSize: "12px", color: formType === "credit" ? "#fca5a5" : "#bfdbfe" }}>
                  {formType === "credit"
                    ? "Purchased on credit — will add to supplier's outstanding ledger"
                    : "Direct payment via Cash, UPI, Card, or Bank transfer"}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                style={{
                  background: "rgba(255, 255, 255, 0.2)",
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
            <form onSubmit={handleSaveExpense} style={{ padding: "20px 22px", overflowY: "auto", flex: 1, display: "flex", flexDirection: "column" }}>
              {/* Expense Type Toggle: Direct Paid vs Credit Purchase */}
              <div style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#475569", marginBottom: "6px", textTransform: "uppercase" }}>
                  Payment & Purchase Type *
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <button
                    type="button"
                    onClick={() => {
                      setFormType("paid");
                      if (isCreditExpense(formPaymentMethod)) {
                        setFormPaymentMethod("Cash");
                      }
                    }}
                    style={{
                      padding: "10px 14px",
                      borderRadius: "8px",
                      border: formType === "paid" ? "2px solid #059669" : "1px solid #cbd5e1",
                      background: formType === "paid" ? "#ecfdf5" : "#ffffff",
                      color: formType === "paid" ? "#065f46" : "#475569",
                      fontWeight: 700,
                      fontSize: "13px",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "6px",
                      boxShadow: formType === "paid" ? "0 2px 6px rgba(5, 150, 105, 0.15)" : "none",
                    }}
                  >
                    <span>💵</span> Direct Paid (Cash / UPI)
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setFormType("credit");
                      setFormPaymentMethod("Credit (On Account)");
                    }}
                    style={{
                      padding: "10px 14px",
                      borderRadius: "8px",
                      border: formType === "credit" ? "2px solid #dc2626" : "1px solid #cbd5e1",
                      background: formType === "credit" ? "#fef2f2" : "#ffffff",
                      color: formType === "credit" ? "#991b1b" : "#475569",
                      fontWeight: 700,
                      fontSize: "13px",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "6px",
                      boxShadow: formType === "credit" ? "0 2px 6px rgba(220, 38, 38, 0.15)" : "none",
                    }}
                  >
                    <span>📋</span> Credit Purchase (Khata)
                  </button>
                </div>
                <div style={{ fontSize: "11px", color: formType === "credit" ? "#dc2626" : "#059669", marginTop: "6px", fontWeight: 600 }}>
                  {formType === "credit"
                    ? "🔴 Bought on credit. Creates an outstanding balance owed to the supplier."
                    : "✓ Paid immediately with Cash / UPI / Bank. Complete transaction with no debt owed."}
                </div>
              </div>

              {/* Vendor & Bill Number row */}
              <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: "14px", marginBottom: "16px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#0f172a", marginBottom: "6px" }}>
                    Supplier / Vendor Name {formType === "credit" ? "*" : "(Optional)"}
                  </label>
                  <input
                    type="text"
                    list="vendors-datalist"
                    placeholder={formType === "credit" ? "e.g. Metro Groceries, MS Fresh" : "e.g. Local Market, Petrol Pump"}
                    value={formVendor}
                    onChange={(e) => setFormVendor(e.target.value)}
                    required={formType === "credit"}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                      fontSize: "13px",
                      background: "#ffffff",
                    }}
                  />
                  <datalist id="vendors-datalist">
                    {knownVendors.map((v) => (
                      <option key={v} value={v} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#0f172a", marginBottom: "6px" }}>
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
                      border: "1px solid #cbd5e1",
                      fontSize: "13px",
                      background: "#ffffff",
                    }}
                  />
                </div>
              </div>

              {/* Title / Description */}
              <div style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#0f172a", marginBottom: "6px" }}>
                  Item Description / Particulars *
                </label>
                <input
                  type="text"
                  placeholder="e.g. 50kg Basmati Rice, 40kg Chicken, Flower Mandap Rentals"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  required
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    fontSize: "13px",
                    background: "#ffffff",
                  }}
                />
              </div>

              {/* Category & Amount row */}
              <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "14px", marginBottom: "16px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#0f172a", marginBottom: "6px" }}>
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
                      border: "1px solid #cbd5e1",
                      fontSize: "13px",
                      background: "#ffffff",
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
                  <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#0f172a", marginBottom: "6px" }}>
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
                      border: "1px solid #cbd5e1",
                      fontSize: "15px",
                      fontWeight: 800,
                      color: formType === "credit" ? "#dc2626" : "#0f172a",
                      background: "#ffffff",
                    }}
                  />
                </div>
              </div>

              {/* Date & Payment Mode row */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginBottom: "16px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#0f172a", marginBottom: "6px" }}>
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
                      border: "1px solid #cbd5e1",
                      fontSize: "13px",
                      background: "#ffffff",
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#0f172a", marginBottom: "6px" }}>
                    {formType === "credit" ? "Payment Terms" : "Payment Method"}
                  </label>
                  {formType === "credit" ? (
                    <input
                      type="text"
                      disabled
                      value="🔴 Credit (On Account / Due)"
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        borderRadius: "8px",
                        border: "1px solid #fecaca",
                        fontSize: "13px",
                        background: "#fffafb",
                        color: "#dc2626",
                        fontWeight: 700,
                      }}
                    />
                  ) : (
                    <select
                      value={formPaymentMethod}
                      onChange={(e) => setFormPaymentMethod(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        borderRadius: "8px",
                        border: "1px solid #cbd5e1",
                        fontSize: "13px",
                        background: "#ffffff",
                      }}
                    >
                      {DIRECT_PAYMENT_METHODS.map((pm) => (
                        <option key={pm} value={pm}>
                          {pm}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              {/* Link to Event */}
              <div style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#0f172a", marginBottom: "6px" }}>
                  Link to Event (Optional)
                </label>
                <select
                  value={formEventId}
                  onChange={(e) => setFormEventId(e.target.value ? Number(e.target.value) : "")}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    fontSize: "13px",
                    background: "#f8fafc",
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
                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#0f172a", marginBottom: "6px" }}>
                  Notes / Particulars (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Paid cash at market, delivered to kitchen"
                  value={formNote}
                  onChange={(e) => setFormNote(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    fontSize: "13px",
                    background: "#ffffff",
                  }}
                />
              </div>

              {/* Action Buttons */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", position: "sticky", bottom: 0, background: "#ffffff", paddingTop: "14px", borderTop: "1px solid #f1f5f9", marginTop: "auto" }}>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  disabled={submitting}
                  style={{
                    padding: "10px 18px",
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
                  disabled={submitting}
                  style={{
                    padding: "10px 22px",
                    borderRadius: "8px",
                    border: "none",
                    background: formType === "credit" ? "#dc2626" : "#2563eb",
                    color: "#ffffff",
                    fontWeight: 700,
                    fontSize: "13px",
                    cursor: submitting ? "not-allowed" : "pointer",
                    boxShadow: "0 2px 6px rgba(0, 0, 0, 0.15)",
                  }}
                >
                  {submitting ? "Saving..." : editingExpenseId ? "Update Expense" : formType === "credit" ? "+ Record Credit Bill" : "✓ Record Paid Expense"}
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
