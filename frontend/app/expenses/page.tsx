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
type LedgerEntryFilter = "all" | "bills" | "clearances";

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

export default function ExpensesPage() {
  const router = useRouter();
  const { user, isOwner } = useAuth();

  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [settlements, setSettlements] = useState<ExpenseSettlementRecord[]>([]);
  const [events, setEvents] = useState<EventOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Active Ledger Tab
  const [activeTab, setActiveTab] = useState<LedgerTab>("general");

  // Selected Vendor for Individual Account Ledger View
  const [selectedVendor, setSelectedVendor] = useState<string | null>(null);

  // Filters for Credit Ledger
  const [entryTypeFilter, setEntryTypeFilter] = useState<LedgerEntryFilter>("all"); // all | bills | clearances
  const [searchQuery, setSearchQuery] = useState("");
  const [datePreset, setDatePreset] = useState<DatePreset>("all");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [allocationFilter, setAllocationFilter] = useState("All"); // All | Event | Overhead
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc"); // desc = latest first, asc = oldest first

  // Filters for Vendor / Settlement Accounts
  const [vendorSearch, setVendorSearch] = useState("");
  const [vendorStatusFilter, setVendorStatusFilter] = useState<"all" | "due" | "settled">("all");

  // Modal State for Add / Edit Expense (Credit Bill)
  const [modalOpen, setModalOpen] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form Fields for Add / Edit Expense
  const [formType, setFormType] = useState<"credit" | "paid">("credit"); // DEFAULT TO CREDIT PURCHASE!
  const [formTitle, setFormTitle] = useState("");
  const [formCategory, setFormCategory] = useState(CATEGORIES[0]);
  const [formAmount, setFormAmount] = useState("");
  const [formDate, setFormDate] = useState(new Date().toISOString().slice(0, 10));
  const [formEventId, setFormEventId] = useState<number | "">("");
  const [formPaymentMethod, setFormPaymentMethod] = useState("Cash");
  const [formVendor, setFormVendor] = useState("");
  const [formBillNumber, setFormBillNumber] = useState("");
  const [formNote, setFormNote] = useState("");

  // Modal State for CREDIT BALANCE CLEARANCE (Settlement)
  const [settleModalOpen, setSettleModalOpen] = useState(false);
  const [settling, setSettling] = useState(false);
  const [settleVendor, setSettleVendor] = useState("");
  const [settleAmount, setSettleAmount] = useState("");
  const [settleDate, setSettleDate] = useState(new Date().toISOString().slice(0, 10));
  const [settleMode, setSettleMode] = useState(CLEARANCE_PAYMENT_METHODS[0]);
  const [settleReference, setSettleReference] = useState("");
  const [settleNote, setSettleNote] = useState("");

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

  // Helper date boundary calculators
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

  // Settlement totals mapped by vendor
  const settlementsByVendor = useMemo(() => {
    const map: Record<string, number> = {};
    settlements.forEach((s) => {
      const v = s.vendor?.trim() || "Direct / Unassigned Vendor";
      map[v] = (map[v] || 0) + (s.amount || 0);
    });
    return map;
  }, [settlements]);

  // Grouped Vendor Accounts & Balances (Accounts Payable / Supplier Credit)
  const vendorAccounts = useMemo(() => {
    const map: Record<
      string,
      {
        name: string;
        totalIncurred: number;
        totalCleared: number;
        pendingBalance: number;
        billCount: number;
        clearanceCount: number;
        lastDate: string;
        categories: Record<string, number>;
        expenses: ExpenseRecord[];
        settlements: ExpenseSettlementRecord[];
      }
    > = {};

    expenses.forEach((e) => {
      const vName = (e.vendor && e.vendor.trim()) || "Direct / Unassigned Vendor";
      if (!map[vName]) {
        map[vName] = {
          name: vName,
          totalIncurred: 0,
          totalCleared: 0,
          pendingBalance: 0,
          billCount: 0,
          clearanceCount: 0,
          lastDate: "",
          categories: {},
          expenses: [],
          settlements: [],
        };
      }
      const item = map[vName];
      const amt = e.amount || 0;
      item.totalIncurred += amt;
      item.billCount += 1;
      const d = e.expense_date ? e.expense_date.slice(0, 10) : "";
      if (d > item.lastDate) item.lastDate = d;
      const cat = e.category || "Miscellaneous";
      item.categories[cat] = (item.categories[cat] || 0) + amt;
      item.expenses.push(e);
    });

    settlements.forEach((s) => {
      const vName = (s.vendor && s.vendor.trim()) || "Direct / Unassigned Vendor";
      if (!map[vName]) {
        map[vName] = {
          name: vName,
          totalIncurred: 0,
          totalCleared: 0,
          pendingBalance: 0,
          billCount: 0,
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

    // Populate settlements cleared and calculate pending credit balance
    Object.values(map).forEach((item) => {
      item.totalCleared = settlementsByVendor[item.name] || 0;
      item.pendingBalance = Math.max(0, item.totalIncurred - item.totalCleared);
    });

    return Object.values(map).sort((a, b) => b.totalIncurred - a.totalIncurred);
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

    // Combine all bills and clearances for this vendor chronologically
    const allVendorItems: Array<{
      id: string;
      rawId: number;
      kind: "bill" | "clearance";
      date: string;
      refNumber: string;
      title: string;
      category: string;
      paymentMode: string;
      incurred: number;
      cleared: number;
      note?: string | null;
      rawExpense?: ExpenseRecord;
      rawSettlement?: ExpenseSettlementRecord;
    }> = [];

    vendorObj.expenses.forEach((e) => {
      allVendorItems.push({
        id: `exp-${e.id}`,
        rawId: e.id,
        kind: "bill",
        date: e.expense_date ? e.expense_date.slice(0, 10) : "",
        refNumber: e.bill_number ? `#${e.bill_number}` : `EXP-${String(e.id).padStart(4, "0")}`,
        title: e.title,
        category: e.category,
        paymentMode: e.payment_method || "Credit (On Account)",
        incurred: e.amount || 0,
        cleared: 0,
        note: e.note,
        rawExpense: e,
      });
    });

    vendorObj.settlements.forEach((s) => {
      allVendorItems.push({
        id: `set-${s.id}`,
        rawId: s.id,
        kind: "clearance",
        date: s.settlement_date ? s.settlement_date.slice(0, 10) : "",
        refNumber: s.reference_no ? `#${s.reference_no}` : `SETTLE-${String(s.id).padStart(4, "0")}`,
        title: `Credit Balance Clearance (${s.payment_mode})`,
        category: "Vendor Settlement",
        paymentMode: s.payment_mode,
        incurred: 0,
        cleared: s.amount || 0,
        note: s.note,
        rawSettlement: s,
      });
    });

    // Sort chronologically to compute exact running credit balance
    allVendorItems.sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return a.kind === "bill" ? -1 : 1;
    });

    let running = 0;
    const computed = allVendorItems.map((item) => {
      running += item.incurred - item.cleared;
      return {
        ...item,
        runningCreditBalance: running,
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

    const netLedgerBalance = Math.max(0, totalExpense - totalSettled);

    return {
      totalExpense,
      mtdExpense,
      totalSettled,
      mtdCleared,
      netLedgerBalance,
      eventSpecific,
      overhead,
    };
  }, [expenses, settlements, dateBoundaries.currentYearMonth]);

  // ========================================================
  // UNIFIED CREDIT & EXPENSE LEDGER (Chronological journal of Bills + Clearances)
  // ========================================================
  const unifiedLedgerEntries = useMemo(() => {
    type LedgerRow = {
      id: string;
      rawId: number;
      kind: "bill" | "clearance";
      date: string;
      refNumber: string;
      title: string;
      category: string;
      vendor: string;
      paymentMode: string;
      incurredAmount: number;
      clearedAmount: number;
      runningCreditBalance: number;
      eventId?: number | null;
      eventType?: string | null;
      note?: string | null;
      rawExpense?: ExpenseRecord;
      rawSettlement?: ExpenseSettlementRecord;
    };

    const combined: LedgerRow[] = [];

    // 1. Add Expenses (Credit Bills)
    expenses.forEach((e) => {
      const expDate = e.expense_date ? e.expense_date.slice(0, 10) : "";

      // Apply Filters
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

      combined.push({
        id: `exp-${e.id}`,
        rawId: e.id,
        kind: "bill",
        date: expDate,
        refNumber: e.bill_number ? `#${e.bill_number}` : `EXP-${String(e.id).padStart(4, "0")}`,
        title: e.title,
        category: e.category,
        vendor: e.vendor?.trim() || "Direct / Unassigned Vendor",
        paymentMode: e.payment_method || "Credit (On Account)",
        incurredAmount: e.amount || 0,
        clearedAmount: 0,
        runningCreditBalance: 0,
        eventId: e.event_id,
        eventType: e.event_type,
        note: e.note,
        rawExpense: e,
      });
    });

    // 2. Add Settlements (Credit Clearances)
    settlements.forEach((s) => {
      const sDate = s.settlement_date ? s.settlement_date.slice(0, 10) : "";

      // Apply Filters
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

      combined.push({
        id: `set-${s.id}`,
        rawId: s.id,
        kind: "clearance",
        date: sDate,
        refNumber: s.reference_no ? `#${s.reference_no}` : `SETTLE-${String(s.id).padStart(4, "0")}`,
        title: `Credit Clearance Payment (${s.payment_mode})`,
        category: "Vendor Settlement",
        vendor: s.vendor?.trim() || "Direct / Unassigned Vendor",
        paymentMode: s.payment_mode,
        incurredAmount: 0,
        clearedAmount: s.amount || 0,
        runningCreditBalance: 0,
        note: s.note,
        rawSettlement: s,
      });
    });

    // Sort chronologically (oldest to newest) to calculate running net credit balance accurately
    combined.sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return a.kind === "bill" ? -1 : 1;
    });

    let running = 0;
    const withRunning = combined.map((entry) => {
      running += entry.incurredAmount - entry.clearedAmount;
      return {
        ...entry,
        runningCreditBalance: running,
      };
    });

    // Apply Entry Type filter (Bills only or Clearances only)
    const filtered = withRunning.filter((item) => {
      if (entryTypeFilter === "bills") return item.kind === "bill";
      if (entryTypeFilter === "clearances") return item.kind === "clearance";
      return true;
    });

    // Reverse if display sequence is newest first
    if (sortOrder === "desc") {
      return [...filtered].reverse();
    }
    return filtered;
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
    let totalIncurred = 0;
    let totalCleared = 0;
    unifiedLedgerEntries.forEach((e) => {
      totalIncurred += e.incurredAmount;
      totalCleared += e.clearedAmount;
    });
    return {
      totalIncurred,
      totalCleared,
      netBalance: Math.max(0, totalIncurred - totalCleared),
      count: unifiedLedgerEntries.length,
    };
  }, [unifiedLedgerEntries]);

  // Monthly Outflow Ledger Grouping
  const monthlyLedger = useMemo(() => {
    const monthsMap: Record<
      string,
      {
        monthKey: string;
        totalIncurred: number;
        totalCleared: number;
        netDue: number;
        count: number;
      }
    > = {};

    expenses.forEach((e) => {
      const d = e.expense_date ? e.expense_date.slice(0, 7) : "Unknown";
      if (!monthsMap[d]) {
        monthsMap[d] = { monthKey: d, totalIncurred: 0, totalCleared: 0, netDue: 0, count: 0 };
      }
      monthsMap[d].totalIncurred += e.amount || 0;
      monthsMap[d].count += 1;
    });

    settlements.forEach((s) => {
      const d = s.settlement_date ? s.settlement_date.slice(0, 7) : "Unknown";
      if (!monthsMap[d]) {
        monthsMap[d] = { monthKey: d, totalIncurred: 0, totalCleared: 0, netDue: 0, count: 0 };
      }
      monthsMap[d].totalCleared += s.amount || 0;
    });

    Object.values(monthsMap).forEach((m) => {
      m.netDue = Math.max(0, m.totalIncurred - m.totalCleared);
    });

    return Object.values(monthsMap).sort((a, b) => b.monthKey.localeCompare(a.monthKey));
  }, [expenses, settlements]);

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

  // Open Add Expense Modal (Credit Bill)
  const openAddModal = (presetEventId?: number, defaultVendor?: string) => {
    setEditingExpenseId(null);
    setFormType("credit"); // DEFAULTS TO CREDIT PURCHASE!
    setFormTitle("");
    setFormCategory(CATEGORIES[0]);
    setFormAmount("");
    setFormDate(new Date().toISOString().slice(0, 10));
    setFormEventId(presetEventId ?? "");
    setFormPaymentMethod("Cash");
    setFormVendor(defaultVendor || selectedVendor || "");
    setFormBillNumber("");
    setFormNote("");
    setModalOpen(true);
  };

  // Open Edit Expense Modal
  const openEditModal = (exp: ExpenseRecord) => {
    setEditingExpenseId(exp.id);
    const isCredit = (exp.payment_method || "").toLowerCase().includes("credit");
    setFormType(isCredit ? "credit" : "paid");
    setFormTitle(exp.title);
    setFormCategory(exp.category || CATEGORIES[0]);
    setFormAmount(String(exp.amount));
    setFormDate(exp.expense_date ? exp.expense_date.slice(0, 10) : new Date().toISOString().slice(0, 10));
    setFormEventId(exp.event_id ?? "");
    setFormPaymentMethod(exp.payment_method || "Cash");
    setFormVendor(exp.vendor || "");
    setFormBillNumber(exp.bill_number || "");
    setFormNote(exp.note || "");
    setModalOpen(true);
  };

  // Open CREDIT BALANCE CLEARANCE (Settlement) Modal
  const openClearSettlementModal = (vendorName?: string, presetAmount?: number) => {
    const targetVendor = vendorName || (vendorAccounts[0]?.name ?? "");
    const vendorData = vendorAccounts.find((v) => v.name === targetVendor);
    const amountToSet = presetAmount !== undefined ? String(presetAmount) : vendorData ? String(vendorData.pendingBalance) : "";

    setSettleVendor(targetVendor);
    setSettleAmount(amountToSet);
    setSettleDate(new Date().toISOString().slice(0, 10));
    setSettleMode(CLEARANCE_PAYMENT_METHODS[0]);
    setSettleReference("");
    setSettleNote(`Credit balance clearance for ${targetVendor}`);
    setSettleModalOpen(true);
  };

  // Submit Add / Edit Expense (Credit Bill or Paid Expense)
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

      // If user chose "Paid Immediately" and not editing, also record immediate clearance
      if (!editingExpenseId && formType === "paid" && vendorName) {
        try {
          await fetchWithAuth(`${API_URL}/expenses/settlements`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              vendor: vendorName,
              amount: amt,
              settlement_date: formDate,
              payment_mode: formPaymentMethod,
              reference_no: formBillNumber.trim() || null,
              note: `Direct immediate settlement for ${title}`,
            }),
          });
        } catch (settleErr) {
          console.warn("Failed to auto-record settlement:", settleErr);
        }
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

  // Submit CREDIT BALANCE CLEARANCE (Settlement)
  const handleSaveSettlement = async (e: FormEvent) => {
    e.preventDefault();
    const vendor = settleVendor.trim();
    if (!vendor) {
      alert("Please select or enter the vendor/payee name.");
      return;
    }
    const amt = parseFloat(settleAmount);
    if (!amt || amt <= 0) {
      alert("Please enter a valid clearance amount greater than zero.");
      return;
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
        throw new Error(errData?.detail || "Failed to clear credit balance");
      }

      setSuccessMsg(`✓ Credit balance of ₹${formatMoney(amt)} cleared for ${vendor} via ${settleMode}!`);
      setSettleModalOpen(false);
      await loadData();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      alert(err.message || "Failed to record credit clearance");
    } finally {
      setSettling(false);
    }
  };

  // Delete Settlement (Revert clearance)
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
        <header
          className="topbar no-print"
          style={{
            minHeight: "74px",
            height: "auto",
            padding: "12px 24px",
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
                <h1 style={{ margin: 0, fontSize: "19px", fontWeight: 700, color: "#1e0836", lineHeight: 1.2 }}>
                  Expense & Vendor Credit Ledger
                </h1>
                <span
                  style={{
                    fontSize: "11px",
                    color: "#dc2626",
                    background: "#fef2f2",
                    border: "1px solid #fecaca",
                    padding: "2px 8px",
                    borderRadius: "10px",
                    fontWeight: 700,
                    whiteSpace: "nowrap",
                  }}
                >
                  {expenses.length} Credit Bills
                </span>
              </div>
              <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#8a7b9b" }}>
                Manage supplier credit purchases, accounts payable, and credit balance clearances
              </p>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", justifyContent: "flex-end", flex: "1 1 auto" }}>
            {/* Quick search input */}
            <div className="search-box">
              <span style={{ color: "#8a7b9b", fontSize: "14px" }}>🔍</span>
              <input
                type="text"
                placeholder="Search vendor, bill #, item..."
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

            {/* Clear Credit Balance Button */}
            {!isOwner && (
              <button
                type="button"
                onClick={() => openClearSettlementModal()}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  background: "linear-gradient(135deg, #059669 0%, #047857 100%)",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "8px",
                  padding: "8px 14px",
                  fontWeight: 700,
                  fontSize: "12px",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                  boxShadow: "0 2px 8px rgba(5, 150, 105, 0.3)",
                }}
              >
                <span>🤝</span> Clear Credit Balance
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

            {/* Add Credit Expense Button */}
            {!isOwner && (
              <button
                type="button"
                onClick={() => openAddModal()}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  background: "linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "8px",
                  padding: "8px 16px",
                  fontWeight: 700,
                  fontSize: "12px",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                  boxShadow: "0 4px 14px rgba(220, 38, 38, 0.35)",
                }}
              >
                <span>+</span> Add Credit Expense
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
                  ? `Vendor Credit Account Statement: ${selectedVendor}`
                  : "Supplier Credit & Outflows Ledger"}
              </h2>
              <p style={{ margin: 0, fontSize: "12px", color: "#666" }}>
                Total Credit Incurred: ₹{formatMoney(metrics.totalExpense)} • Total Cleared: ₹{formatMoney(metrics.totalSettled)} • Outstanding Due: ₹{formatMoney(metrics.netLedgerBalance)}
              </p>
            </div>
            <div style={{ textAlign: "right", fontSize: "12px", color: "#555" }}>
              <div>Generated: {new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</div>
              <div>Net Outstanding Credit Due: ₹{formatMoney(metrics.netLedgerBalance)}</div>
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="page-content" style={{ background: "#faf8fd", minHeight: "calc(100vh - 74px)", padding: "24px 28px 60px" }}>
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
              <span>{successMsg}</span>
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

          {/* 4 CORE CREDIT METRICS CARDS */}
          <div
            className="no-print"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "18px",
              marginBottom: "24px",
            }}
          >
            {/* 1. Total Credit Taken (All Bills) */}
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
                Total Credit Incurred
              </div>
              <div style={{ fontSize: "26px", fontWeight: 800, color: "#1e0836", marginTop: "8px" }}>
                ₹{formatMoney(metrics.totalExpense)}
              </div>
              <div style={{ fontSize: "12px", color: "#7a6e8a", marginTop: "6px" }}>
                Across {expenses.length} bills from suppliers
              </div>
            </div>

            {/* 2. Total Credit Cleared (Paid) */}
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
                Total Credit Cleared
              </div>
              <div style={{ fontSize: "26px", fontWeight: 800, color: "#065f46", marginTop: "8px" }}>
                ₹{formatMoney(metrics.totalSettled)}
              </div>
              <div style={{ fontSize: "12px", color: "#047857", marginTop: "6px" }}>
                {settlements.length} payments cleared to vendors
              </div>
            </div>

            {/* 3. Outstanding Credit Balance Due */}
            <div
              style={{
                background: "#ffffff",
                border: "1px solid #fee2e2",
                borderRadius: "14px",
                padding: "20px",
                boxShadow: "0 2px 10px rgba(220, 38, 38, 0.06)",
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
                  height: "4px",
                  background: "linear-gradient(90deg, #ef4444 0%, #dc2626 100%)",
                }}
              />
              <div style={{ fontSize: "12px", color: "#b91c1c", fontWeight: 800, letterSpacing: "0.5px", textTransform: "uppercase" }}>
                Net Credit Balance Due
              </div>
              <div style={{ fontSize: "28px", fontWeight: 900, color: metrics.netLedgerBalance > 0 ? "#b91c1c" : "#059669", marginTop: "8px" }}>
                ₹{formatMoney(metrics.netLedgerBalance)}
              </div>
              <div style={{ fontSize: "12px", color: "#b91c1c", marginTop: "6px", fontWeight: 600 }}>
                {pendingVendorsCount > 0 ? `${pendingVendorsCount} suppliers waiting for payment` : "All credit balances settled"}
              </div>
            </div>

            {/* 4. This Month Credit Activity */}
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
                This Month (MTD)
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginTop: "8px", flexWrap: "wrap" }}>
                <span style={{ fontSize: "18px", fontWeight: 800, color: "#1e0836" }}>
                  Billed: ₹{formatMoney(metrics.mtdExpense)}
                </span>
              </div>
              <div style={{ fontSize: "12px", color: "#047857", marginTop: "6px", fontWeight: 600 }}>
                Cleared: ₹{formatMoney(metrics.mtdCleared)}
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
                background: activeTab === "general" ? "#fff" : "transparent",
                border: "none",
                borderBottom: activeTab === "general" ? "3px solid #7c3aed" : "3px solid transparent",
                padding: "12px 16px",
                borderRadius: "8px 8px 0 0",
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
              <span>📜</span> Credit & Expense Ledger ({unifiedLedgerEntries.length})
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
                borderBottom: activeTab === "vendors" ? "3px solid #7c3aed" : "3px solid transparent",
                padding: "12px 16px",
                borderRadius: "8px 8px 0 0",
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
              <span>🏪</span> Vendor Credit Accounts ({vendorAccounts.length})
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab("settlement");
                setSelectedVendor(null);
              }}
              style={{
                background: activeTab === "settlement" ? "#ecfdf5" : "transparent",
                border: "none",
                borderBottom: activeTab === "settlement" ? "3px solid #059669" : "3px solid transparent",
                padding: "12px 16px",
                borderRadius: "8px 8px 0 0",
                fontSize: "14px",
                fontWeight: activeTab === "settlement" ? 800 : 600,
                color: activeTab === "settlement" ? "#047857" : "#6c5e7e",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                marginBottom: "-2px",
              }}
            >
              <span>🤝</span> Credit Balance Clearances ({settlements.length})
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
                borderBottom: activeTab === "audit" ? "3px solid #7c3aed" : "3px solid transparent",
                padding: "12px 16px",
                borderRadius: "8px 8px 0 0",
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

          {/* ======================================================== */}
          {/* TAB 1: UNIFIED CREDIT & EXPENSE LEDGER */}
          {/* ======================================================== */}
          {activeTab === "general" && (
            <div>
              {/* Filter Controls Bar */}
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
                {/* Row 1: Entry Type Filter (All vs Credit Bills vs Clearances) & Sequence */}
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                    <span style={{ fontSize: "11px", color: "#6d5b83", fontWeight: 700, textTransform: "uppercase" }}>
                      Show:
                    </span>
                    {(
                      [
                        { id: "all", label: `All Transactions (${unifiedLedgerEntries.length})` },
                        { id: "bills", label: `🔴 Credit Bills Only (${expenses.length})` },
                        { id: "clearances", label: `🟢 Credit Clearances Only (${settlements.length})` },
                      ] as const
                    ).map((t) => {
                      const active = entryTypeFilter === t.id;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setEntryTypeFilter(t.id)}
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
                          {t.label}
                        </button>
                      );
                    })}
                  </div>

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

                {/* Row 2: Period Presets */}
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
                          padding: "4px 10px",
                          borderRadius: "16px",
                          border: active ? "1px solid #4c1d95" : "1px solid #e2d9ec",
                          background: active ? "#4c1d95" : "#fcfaff",
                          color: active ? "#ffffff" : "#4c3a60",
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

                {/* Row 3: Dropdowns & Period Totals */}
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
                  <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "12px" }}>
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
                    <div style={{ fontSize: "12px", color: "#6d5b83" }}>
                      Credit: <strong style={{ color: "#b91c1c" }}>+₹{formatMoney(activeLedgerTotals.totalIncurred)}</strong>
                    </div>
                    <div style={{ fontSize: "12px", color: "#6d5b83" }}>
                      Cleared: <strong style={{ color: "#047857" }}>-₹{formatMoney(activeLedgerTotals.totalCleared)}</strong>
                    </div>
                    <div
                      style={{
                        fontSize: "13px",
                        fontWeight: 800,
                        color: activeLedgerTotals.netBalance > 0 ? "#b91c1c" : "#059669",
                        background: activeLedgerTotals.netBalance > 0 ? "#fee2e2" : "#d1fae5",
                        padding: "4px 10px",
                        borderRadius: "8px",
                      }}
                    >
                      Due: ₹{formatMoney(activeLedgerTotals.netBalance)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Table */}
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
                    Loading credit & outflows ledger...
                  </div>
                ) : unifiedLedgerEntries.length === 0 ? (
                  <div style={{ padding: "50px 20px", textAlign: "center" }}>
                    <div style={{ fontSize: "36px", marginBottom: "12px" }}>💳</div>
                    <h3 style={{ margin: "0 0 6px 0", color: "#1e0836" }}>No ledger entries found</h3>
                    <p style={{ color: "#7a6e8a", fontSize: "14px", margin: "0 0 16px 0" }}>
                      {searchQuery || categoryFilter !== "All" || datePreset !== "all"
                        ? "No records match your active search or filters."
                        : "Start recording credit purchases and bills from your suppliers."}
                    </p>
                    {!isOwner && (
                      <button
                        type="button"
                        onClick={() => openAddModal()}
                        style={{
                          background: "linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)",
                          color: "#ffffff",
                          border: "none",
                          padding: "8px 18px",
                          borderRadius: "8px",
                          fontWeight: 700,
                          cursor: "pointer",
                          boxShadow: "0 4px 14px rgba(220, 38, 38, 0.35)",
                        }}
                      >
                        + Record First Credit Expense
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
                            background: "linear-gradient(180deg, #fbf9fe 0%, #f4effa 100%)",
                            borderBottom: "2px solid #ece4f5",
                            color: "#542b80",
                            fontWeight: 700,
                          }}
                        >
                          <th style={{ padding: "14px 18px" }}>Date</th>
                          <th style={{ padding: "14px 18px" }}>Bill / Ref #</th>
                          <th style={{ padding: "14px 18px" }}>Supplier / Vendor</th>
                          <th style={{ padding: "14px 18px" }}>Particulars / Item Description</th>
                          <th style={{ padding: "14px 18px" }}>Status / Type</th>
                          <th style={{ padding: "14px 18px", textAlign: "right" }}>Credit Incurred (+₹)</th>
                          <th style={{ padding: "14px 18px", textAlign: "right" }}>Credit Cleared (-₹)</th>
                          <th
                            style={{
                              padding: "14px 18px",
                              textAlign: "right",
                              background: "rgba(124, 58, 237, 0.05)",
                              color: "#6d28d9",
                            }}
                          >
                            Net Credit Due (₹)
                          </th>
                          <th className="no-print" style={{ padding: "14px 18px", textAlign: "center" }}>
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {unifiedLedgerEntries.map((row) => {
                          const isBill = row.kind === "bill";
                          return (
                            <tr
                              key={row.id}
                              style={{
                                borderBottom: "1px solid #f2eff7",
                                background: isBill ? "#ffffff" : "#f0fdf4",
                                transition: "background 0.15s ease",
                              }}
                            >
                              {/* Date */}
                              <td style={{ padding: "14px 18px", fontWeight: 600, color: "#24103f", whiteSpace: "nowrap" }}>
                                {formatDate(row.date)}
                              </td>

                              {/* Bill / Ref # */}
                              <td style={{ padding: "14px 18px", fontFamily: "monospace", color: "#6b5b7e", fontSize: "12px", whiteSpace: "nowrap" }}>
                                <span
                                  style={{
                                    padding: "2px 6px",
                                    borderRadius: "4px",
                                    border: isBill ? "1px solid #fecaca" : "1px solid #a7f3d0",
                                    background: isBill ? "#fff5f5" : "#ecfdf5",
                                    color: isBill ? "#b91c1c" : "#047857",
                                    fontWeight: 700,
                                  }}
                                >
                                  {row.refNumber}
                                </span>
                              </td>

                              {/* Vendor / Supplier */}
                              <td style={{ padding: "14px 18px", color: "#1e0836", fontWeight: 700 }}>
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
                                    color: "#7c3aed",
                                    fontWeight: 700,
                                    cursor: "pointer",
                                    textDecoration: "underline",
                                    textAlign: "left",
                                    fontSize: "13px",
                                  }}
                                  title="View full vendor statement"
                                >
                                  {row.vendor}
                                </button>
                              </td>

                              {/* Particulars */}
                              <td style={{ padding: "14px 18px" }}>
                                <div style={{ fontWeight: 600, color: "#1e0836" }}>{row.title}</div>
                                {row.note && (
                                  <div style={{ fontSize: "11px", color: "#7a6e8a", marginTop: "2px", maxWidth: "260px" }}>
                                    {row.note}
                                  </div>
                                )}
                                {row.eventId && (
                                  <div style={{ marginTop: "4px" }}>
                                    <Link
                                      href={`/events/${row.eventId}`}
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
                                      Event #{row.eventId} {row.eventType ? `• ${row.eventType}` : ""}
                                    </Link>
                                  </div>
                                )}
                              </td>

                              {/* Status / Type */}
                              <td style={{ padding: "14px 18px", whiteSpace: "nowrap" }}>
                                {isBill ? (
                                  <span
                                    style={{
                                      display: "inline-block",
                                      fontSize: "11px",
                                      fontWeight: 700,
                                      padding: "3px 8px",
                                      borderRadius: "4px",
                                      background: "#fee2e2",
                                      color: "#991b1b",
                                      border: "1px solid #fecaca",
                                    }}
                                  >
                                    🔴 Credit Bill (Payable)
                                  </span>
                                ) : (
                                  <span
                                    style={{
                                      display: "inline-block",
                                      fontSize: "11px",
                                      fontWeight: 700,
                                      padding: "3px 8px",
                                      borderRadius: "4px",
                                      background: "#d1fae5",
                                      color: "#065f46",
                                      border: "1px solid #a7f3d0",
                                    }}
                                  >
                                    🟢 Credit Cleared ({row.paymentMode})
                                  </span>
                                )}
                              </td>

                              {/* Credit Incurred */}
                              <td
                                style={{
                                  padding: "14px 18px",
                                  textAlign: "right",
                                  fontWeight: 800,
                                  color: row.incurredAmount > 0 ? "#b91c1c" : "#9ca3af",
                                  fontSize: "14px",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {row.incurredAmount > 0 ? `+ ₹${formatMoney(row.incurredAmount)}` : "-"}
                              </td>

                              {/* Credit Cleared */}
                              <td
                                style={{
                                  padding: "14px 18px",
                                  textAlign: "right",
                                  fontWeight: 800,
                                  color: row.clearedAmount > 0 ? "#047857" : "#9ca3af",
                                  fontSize: "14px",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {row.clearedAmount > 0 ? `- ₹${formatMoney(row.clearedAmount)}` : "-"}
                              </td>

                              {/* Net Credit Due (Running Balance) */}
                              <td
                                style={{
                                  padding: "14px 18px",
                                  textAlign: "right",
                                  fontWeight: 900,
                                  color: row.runningCreditBalance > 0 ? "#b91c1c" : "#047857",
                                  fontSize: "14px",
                                  background: "rgba(124, 58, 237, 0.03)",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                ₹{formatMoney(row.runningCreditBalance)}
                              </td>

                              {/* Actions */}
                              <td className="no-print" style={{ padding: "14px 18px", textAlign: "center", whiteSpace: "nowrap" }}>
                                <div style={{ display: "flex", justifyContent: "center", gap: "6px" }}>
                                  {!isOwner && isBill && row.rawExpense && (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => openClearSettlementModal(row.vendor, row.incurredAmount)}
                                        title="Clear credit balance for this supplier"
                                        style={{
                                          padding: "4px 8px",
                                          borderRadius: "4px",
                                          background: "#ecfdf5",
                                          color: "#047857",
                                          border: "1px solid #a7f3d0",
                                          fontSize: "11px",
                                          fontWeight: 700,
                                          cursor: "pointer",
                                        }}
                                      >
                                        Clear 🤝
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => openEditModal(row.rawExpense!)}
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
                                        onClick={() => handleDeleteExpense(row.rawId, row.title)}
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

                                  {!isOwner && !isBill && (
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteSettlement(row.rawId, row.vendor, row.clearedAmount)}
                                      title="Void this clearance and restore credit balance"
                                      style={{
                                        padding: "4px 8px",
                                        borderRadius: "4px",
                                        background: "#fee2e2",
                                        color: "#b91c1c",
                                        border: "none",
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
                            background: "#fdfcfe",
                            borderTop: "2px solid #ddd6fe",
                            fontWeight: 800,
                            color: "#1e0836",
                          }}
                        >
                          <td colSpan={5} style={{ padding: "14px 18px", fontSize: "13px" }}>
                            Audited Summary ({activeLedgerTotals.count} Transactions)
                          </td>
                          <td style={{ padding: "14px 18px", textAlign: "right", fontSize: "15px", color: "#b91c1c" }}>
                            + ₹{formatMoney(activeLedgerTotals.totalIncurred)}
                          </td>
                          <td style={{ padding: "14px 18px", textAlign: "right", fontSize: "15px", color: "#047857" }}>
                            - ₹{formatMoney(activeLedgerTotals.totalCleared)}
                          </td>
                          <td
                            style={{
                              padding: "14px 18px",
                              textAlign: "right",
                              fontSize: "16px",
                              fontWeight: 900,
                              color: activeLedgerTotals.netBalance > 0 ? "#b91c1c" : "#059669",
                              background: "rgba(124, 58, 237, 0.08)",
                            }}
                          >
                            ₹{formatMoney(activeLedgerTotals.netBalance)}
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
          {/* TAB 2: VENDOR CREDIT ACCOUNTS (ACCOUNTS PAYABLE) */}
          {/* ======================================================== */}
          {activeTab === "vendors" && (
            <div>
              {/* If an individual vendor account statement is selected */}
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
                          ← Back to All Vendor Accounts
                        </button>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <span style={{ fontSize: "24px" }}>🏪</span>
                        <div>
                          <h2 style={{ margin: 0, fontSize: "20px", fontWeight: 800, color: "#1e0836" }}>
                            {selectedVendorData.name}
                          </h2>
                          <span style={{ fontSize: "12px", color: "#8a7b9b" }}>
                            Vendor Credit Account Statement • {selectedVendorData.billCount} bills • {selectedVendorData.clearanceCount} clearances
                          </span>
                        </div>
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "20px", flexWrap: "wrap" }}>
                      <div style={{ textAlign: "right" }}>
                        <span style={{ fontSize: "11px", color: "#6d5b83", fontWeight: 700, textTransform: "uppercase" }}>
                          Total Credit Taken
                        </span>
                        <div style={{ fontSize: "20px", fontWeight: 800, color: "#1e0836" }}>
                          ₹{formatMoney(selectedVendorData.totalIncurred)}
                        </div>
                      </div>

                      <div style={{ textAlign: "right" }}>
                        <span style={{ fontSize: "11px", color: "#047857", fontWeight: 700, textTransform: "uppercase" }}>
                          Total Cleared
                        </span>
                        <div style={{ fontSize: "20px", fontWeight: 800, color: "#047857" }}>
                          ₹{formatMoney(selectedVendorData.totalCleared)}
                        </div>
                      </div>

                      <div style={{ textAlign: "right" }}>
                        <span style={{ fontSize: "11px", color: "#b91c1c", fontWeight: 800, textTransform: "uppercase" }}>
                          Current Credit Due
                        </span>
                        <div style={{ fontSize: "24px", fontWeight: 900, color: selectedVendorData.pendingBalance > 0 ? "#b91c1c" : "#059669" }}>
                          ₹{formatMoney(selectedVendorData.pendingBalance)}
                        </div>
                      </div>

                      <div className="no-print" style={{ display: "flex", gap: "8px" }}>
                        {!isOwner && (
                          <button
                            type="button"
                            onClick={() => openClearSettlementModal(selectedVendorData.name, selectedVendorData.pendingBalance)}
                            style={{
                              padding: "8px 14px",
                              borderRadius: "8px",
                              border: "none",
                              background: "linear-gradient(135deg, #059669 0%, #047857 100%)",
                              color: "#fff",
                              fontWeight: 700,
                              fontSize: "12px",
                              cursor: "pointer",
                              boxShadow: "0 2px 8px rgba(5, 150, 105, 0.3)",
                            }}
                          >
                            🤝 Clear Credit Balance
                          </button>
                        )}

                        {!isOwner && (
                          <button
                            type="button"
                            onClick={() => openAddModal(undefined, selectedVendorData.name)}
                            style={{
                              padding: "8px 14px",
                              borderRadius: "8px",
                              border: "none",
                              background: "linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)",
                              color: "#fff",
                              fontWeight: 700,
                              fontSize: "12px",
                              cursor: "pointer",
                            }}
                          >
                            + Add Bill
                          </button>
                        )}

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
                      </div>
                    </div>
                  </div>

                  {/* Vendor Statement Ledger Table */}
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
                            <th style={{ padding: "14px 18px" }}>Ref / Bill #</th>
                            <th style={{ padding: "14px 18px" }}>Particulars</th>
                            <th style={{ padding: "14px 18px" }}>Transaction Kind</th>
                            <th style={{ padding: "14px 18px", textAlign: "right" }}>Bill (+₹)</th>
                            <th style={{ padding: "14px 18px", textAlign: "right" }}>Cleared (-₹)</th>
                            <th style={{ padding: "14px 18px", textAlign: "right", background: "rgba(124, 58, 237, 0.05)", color: "#6d28d9" }}>
                              Balance Due (₹)
                            </th>
                            <th className="no-print" style={{ padding: "14px 18px", textAlign: "center" }}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedVendorData.statementItems.map((entry) => (
                            <tr key={entry.id} style={{ borderBottom: "1px solid #f2eff7", background: entry.kind === "bill" ? "#ffffff" : "#f0fdf4" }}>
                              <td style={{ padding: "14px 18px", fontWeight: 600, color: "#24103f", whiteSpace: "nowrap" }}>
                                {formatDate(entry.date)}
                              </td>
                              <td style={{ padding: "14px 18px", fontFamily: "monospace", color: "#6b5b7e" }}>
                                {entry.refNumber}
                              </td>
                              <td style={{ padding: "14px 18px" }}>
                                <div style={{ fontWeight: 700, color: "#1e0836" }}>{entry.title}</div>
                                {entry.note && <div style={{ fontSize: "11px", color: "#7a6e8a", marginTop: "2px" }}>{entry.note}</div>}
                              </td>
                              <td style={{ padding: "14px 18px" }}>
                                {entry.kind === "bill" ? (
                                  <span style={{ padding: "2px 6px", borderRadius: "4px", background: "#fee2e2", color: "#991b1b", fontSize: "11px", fontWeight: 700 }}>
                                    🔴 Credit Bill
                                  </span>
                                ) : (
                                  <span style={{ padding: "2px 6px", borderRadius: "4px", background: "#d1fae5", color: "#065f46", fontSize: "11px", fontWeight: 700 }}>
                                    🟢 Cleared ({entry.paymentMode})
                                  </span>
                                )}
                              </td>
                              <td style={{ padding: "14px 18px", textAlign: "right", fontWeight: 800, color: entry.incurred > 0 ? "#b91c1c" : "#9ca3af" }}>
                                {entry.incurred > 0 ? `+ ₹${formatMoney(entry.incurred)}` : "-"}
                              </td>
                              <td style={{ padding: "14px 18px", textAlign: "right", fontWeight: 800, color: entry.cleared > 0 ? "#047857" : "#9ca3af" }}>
                                {entry.cleared > 0 ? `- ₹${formatMoney(entry.cleared)}` : "-"}
                              </td>
                              <td style={{ padding: "14px 18px", textAlign: "right", fontWeight: 900, color: entry.runningCreditBalance > 0 ? "#b91c1c" : "#047857", background: "rgba(124, 58, 237, 0.03)" }}>
                                ₹{formatMoney(entry.runningCreditBalance)}
                              </td>
                              <td className="no-print" style={{ padding: "14px 18px", textAlign: "center" }}>
                                {!isOwner && entry.kind === "bill" && entry.rawExpense && (
                                  <div style={{ display: "flex", justifyContent: "center", gap: "6px" }}>
                                    <button
                                      type="button"
                                      onClick={() => openClearSettlementModal(selectedVendorData.name, entry.incurred)}
                                      style={{ padding: "4px 8px", borderRadius: "4px", background: "#ecfdf5", color: "#047857", border: "1px solid #a7f3d0", fontSize: "11px", fontWeight: 700, cursor: "pointer" }}
                                    >
                                      Clear
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => openEditModal(entry.rawExpense!)}
                                      style={{ padding: "4px 8px", borderRadius: "4px", background: "#f0edf5", color: "#24103f", border: "none", fontSize: "12px", cursor: "pointer" }}
                                    >
                                      Edit
                                    </button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr style={{ background: "#fdfcfe", borderTop: "2px solid #ddd6fe", fontWeight: 800, color: "#1e0836" }}>
                            <td colSpan={4} style={{ padding: "14px 18px" }}>
                              Total Taken: ₹{formatMoney(selectedVendorData.totalIncurred)} • Total Cleared: ₹{formatMoney(selectedVendorData.totalCleared)}
                            </td>
                            <td style={{ padding: "14px 18px", textAlign: "right", color: "#b91c1c" }}>
                              + ₹{formatMoney(selectedVendorData.totalIncurred)}
                            </td>
                            <td style={{ padding: "14px 18px", textAlign: "right", color: "#047857" }}>
                              - ₹{formatMoney(selectedVendorData.totalCleared)}
                            </td>
                            <td style={{ padding: "14px 18px", textAlign: "right", color: selectedVendorData.pendingBalance > 0 ? "#b91c1c" : "#059669", fontSize: "15px", background: "rgba(124, 58, 237, 0.08)" }}>
                              ₹{formatMoney(selectedVendorData.pendingBalance)}
                            </td>
                            <td className="no-print" />
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                </div>
              ) : (
                /* All Vendor Accounts Overview Grid & Table */
                <div>
                  {/* Search and Status Filter */}
                  <div
                    style={{
                      background: "#ffffff",
                      borderRadius: "14px",
                      border: "1px solid #ebe4f5",
                      padding: "14px 18px",
                      marginBottom: "20px",
                      boxShadow: "0 2px 8px rgba(124, 58, 237, 0.03)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      flexWrap: "wrap",
                      gap: "12px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span style={{ fontSize: "11px", color: "#6d5b83", fontWeight: 700, textTransform: "uppercase" }}>
                          Account Status:
                        </span>
                        <select
                          value={vendorStatusFilter}
                          onChange={(e) => setVendorStatusFilter(e.target.value as any)}
                          style={{
                            height: "34px",
                            padding: "0 10px",
                            borderRadius: "8px",
                            border: "1px solid #dcd7e5",
                            background: "#fcfaff",
                            fontSize: "12px",
                            color: "#1e0836",
                            fontWeight: 600,
                          }}
                        >
                          <option value="all">All Suppliers ({vendorAccounts.length})</option>
                          <option value="due">Pending Credit Due Only ({pendingVendorsCount})</option>
                          <option value="settled">Fully Cleared Only ({vendorAccounts.length - pendingVendorsCount})</option>
                        </select>
                      </div>

                      <input
                        type="text"
                        placeholder="Search supplier / vendor..."
                        value={vendorSearch}
                        onChange={(e) => setVendorSearch(e.target.value)}
                        style={{
                          height: "34px",
                          padding: "0 12px",
                          borderRadius: "8px",
                          border: "1px solid #dcd7e5",
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
                          background: "linear-gradient(135deg, #059669 0%, #047857 100%)",
                          color: "#ffffff",
                          border: "none",
                          borderRadius: "8px",
                          padding: "8px 16px",
                          fontWeight: 700,
                          fontSize: "12px",
                          cursor: "pointer",
                          boxShadow: "0 2px 8px rgba(5, 150, 105, 0.3)",
                        }}
                      >
                        <span>🤝</span> Clear Credit Balance
                      </button>
                    )}
                  </div>

                  {/* Vendor Account Cards */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                      gap: "18px",
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
                            borderRadius: "14px",
                            border: isDue ? "1px solid #fecaca" : "1px solid #ebe4f5",
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
                                    background: isDue ? "#fee2e2" : "#ecfdf5",
                                    color: isDue ? "#dc2626" : "#059669",
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

                              <span
                                style={{
                                  fontSize: "10px",
                                  fontWeight: 800,
                                  padding: "3px 8px",
                                  borderRadius: "10px",
                                  background: isDue ? "#fee2e2" : "#d1fae5",
                                  color: isDue ? "#b91c1c" : "#065f46",
                                  border: isDue ? "1px solid #fca5a5" : "1px solid #a7f3d0",
                                }}
                              >
                                {isDue ? `₹${formatMoney(v.pendingBalance)} Due` : "✓ All Cleared"}
                              </span>
                            </div>

                            <div style={{ marginTop: "12px", display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                              <span style={{ fontSize: "12px", color: "#6d5b83" }}>Total Credit Taken:</span>
                              <span style={{ fontSize: "15px", fontWeight: 700, color: "#1e0836" }}>
                                ₹{formatMoney(v.totalIncurred)}
                              </span>
                            </div>

                            <div style={{ marginTop: "4px", display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                              <span style={{ fontSize: "12px", color: "#047857" }}>Credit Cleared:</span>
                              <span style={{ fontSize: "14px", fontWeight: 700, color: "#047857" }}>
                                ₹{formatMoney(v.totalCleared)}
                              </span>
                            </div>

                            <div style={{ marginTop: "4px", display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                              <span style={{ fontSize: "12px", color: "#b91c1c", fontWeight: 700 }}>Outstanding Due:</span>
                              <span style={{ fontSize: "16px", fontWeight: 900, color: isDue ? "#b91c1c" : "#059669" }}>
                                ₹{formatMoney(v.pendingBalance)}
                              </span>
                            </div>

                            <div style={{ marginTop: "8px", fontSize: "11px", color: "#8a7b9b", display: "flex", justifyContent: "space-between" }}>
                              <span>Supply Category:</span>
                              <span style={{ fontWeight: 600, color: "#4c1d95" }}>{topCat}</span>
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
                                  background: "linear-gradient(135deg, #059669 0%, #047857 100%)",
                                  color: "#ffffff",
                                  fontWeight: 700,
                                  fontSize: "12px",
                                  cursor: "pointer",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  gap: "4px",
                                  boxShadow: "0 2px 6px rgba(5, 150, 105, 0.3)",
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
                                border: "1px solid #ddd6fe",
                                background: "#fcfaff",
                                color: "#6d28d9",
                                fontWeight: 700,
                                fontSize: "12px",
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: "4px",
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
          {/* TAB 3: CREDIT BALANCE CLEARANCE HISTORY */}
          {/* ======================================================== */}
          {activeTab === "settlement" && (
            <div>
              <div
                style={{
                  background: "#ffffff",
                  borderRadius: "14px",
                  border: "1px solid #ebe4f5",
                  overflow: "hidden",
                  boxShadow: "0 2px 10px rgba(124, 58, 237, 0.03)",
                }}
              >
                <div
                  style={{
                    padding: "18px 24px",
                    borderBottom: "1px solid #ebe4f5",
                    background: "#fcfaff",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: "12px",
                  }}
                >
                  <div>
                    <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "#1e0836" }}>
                      Credit Balance Clearance History ({settlements.length})
                    </h3>
                    <span style={{ fontSize: "12px", color: "#8a7b9b" }}>
                      Permanent record of payments made to suppliers to clear credit balances
                    </span>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <span style={{ fontSize: "13px", fontWeight: 800, color: "#047857", background: "#ecfdf5", padding: "4px 10px", borderRadius: "8px" }}>
                      Total Cleared: ₹{formatMoney(metrics.totalSettled)}
                    </span>

                    {!isOwner && (
                      <button
                        type="button"
                        onClick={() => openClearSettlementModal()}
                        style={{
                          background: "linear-gradient(135deg, #059669 0%, #047857 100%)",
                          color: "#fff",
                          border: "none",
                          borderRadius: "8px",
                          padding: "8px 14px",
                          fontWeight: 700,
                          fontSize: "12px",
                          cursor: "pointer",
                          boxShadow: "0 2px 8px rgba(5, 150, 105, 0.3)",
                        }}
                      >
                        + Clear Credit Balance
                      </button>
                    )}
                  </div>
                </div>

                {settlements.length === 0 ? (
                  <div style={{ padding: "48px", textAlign: "center", color: "#7a6e8a" }}>
                    No credit clearances recorded yet. Click <strong>"Clear Credit Balance"</strong> to record a payment to a supplier.
                  </div>
                ) : (
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", minWidth: "850px", borderCollapse: "collapse", fontSize: "13px", textAlign: "left" }}>
                      <thead>
                        <tr style={{ background: "#f8f5fc", borderBottom: "2px solid #ece4f5", color: "#542b80", fontWeight: 700 }}>
                          <th style={{ padding: "12px 16px" }}>Clearance Date</th>
                          <th style={{ padding: "12px 16px" }}>Voucher #</th>
                          <th style={{ padding: "12px 16px" }}>Vendor / Payee</th>
                          <th style={{ padding: "12px 16px" }}>Payment Mode</th>
                          <th style={{ padding: "12px 16px" }}>Reference / Cheque #</th>
                          <th style={{ padding: "12px 16px" }}>Remarks</th>
                          <th style={{ padding: "12px 16px", textAlign: "right" }}>Amount Cleared (₹)</th>
                          <th className="no-print" style={{ padding: "12px 16px", textAlign: "center" }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {settlements.map((s) => (
                          <tr key={s.id} style={{ borderBottom: "1px solid #f2eff7" }}>
                            <td style={{ padding: "12px 16px", fontWeight: 600, color: "#1e0836" }}>
                              {formatDate(s.settlement_date)}
                            </td>
                            <td style={{ padding: "12px 16px", fontFamily: "monospace", color: "#6d28d9", fontWeight: 700 }}>
                              SETTLE-{String(s.id).padStart(4, "0")}
                            </td>
                            <td style={{ padding: "12px 16px", fontWeight: 700, color: "#1e0836" }}>
                              {s.vendor}
                            </td>
                            <td style={{ padding: "12px 16px" }}>
                              <span style={{ padding: "2px 8px", borderRadius: "4px", background: "#ecfdf5", color: "#047857", fontWeight: 600, fontSize: "11px" }}>
                                {s.payment_mode}
                              </span>
                            </td>
                            <td style={{ padding: "12px 16px", color: "#6b5b7e", fontFamily: "monospace" }}>
                              {s.reference_no ? `#${s.reference_no}` : "-"}
                            </td>
                            <td style={{ padding: "12px 16px", color: "#6b5b7e" }}>
                              {s.note || "-"}
                            </td>
                            <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: 800, color: "#047857", fontSize: "14px" }}>
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
                                    background: "#fee2e2",
                                    color: "#b91c1c",
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
          {/* TAB 4: MONTHLY & CATEGORY AUDIT LEDGER */}
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
                    📅 Monthly Credit Outflow Audit
                  </h3>
                  <span style={{ fontSize: "12px", color: "#8a7b9b" }}>
                    Month-by-month credit bills incurred and cleared
                  </span>
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", textAlign: "left" }}>
                    <thead>
                      <tr style={{ background: "#f8f5fc", borderBottom: "1px solid #ebe4f5", color: "#542b80", fontWeight: 700 }}>
                        <th style={{ padding: "12px 16px" }}>Month</th>
                        <th style={{ padding: "12px 16px", textAlign: "right" }}>Credit Billed (+₹)</th>
                        <th style={{ padding: "12px 16px", textAlign: "right" }}>Credit Cleared (-₹)</th>
                        <th style={{ padding: "12px 16px", textAlign: "right" }}>Net Due (₹)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {monthlyLedger.map((m) => (
                        <tr key={m.monthKey} style={{ borderBottom: "1px solid #f2eff7" }}>
                          <td style={{ padding: "12px 16px", fontWeight: 700, color: "#1e0836" }}>
                            {formatMonthYear(m.monthKey)}
                          </td>
                          <td style={{ padding: "12px 16px", textAlign: "right", color: "#b91c1c", fontWeight: 700 }}>
                            + ₹{formatMoney(m.totalIncurred)}
                          </td>
                          <td style={{ padding: "12px 16px", textAlign: "right", color: "#047857", fontWeight: 700 }}>
                            - ₹{formatMoney(m.totalCleared)}
                          </td>
                          <td style={{ padding: "12px 16px", textAlign: "right", color: m.netDue > 0 ? "#b91c1c" : "#059669", fontWeight: 800 }}>
                            ₹{formatMoney(m.netDue)}
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
                    🏷️ Category-wise Credit Breakdown
                  </h3>
                  <span style={{ fontSize: "12px", color: "#8a7b9b" }}>
                    Where credit purchases are allocated
                  </span>
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", textAlign: "left" }}>
                    <thead>
                      <tr style={{ background: "#f8f5fc", borderBottom: "1px solid #ebe4f5", color: "#542b80", fontWeight: 700 }}>
                        <th style={{ padding: "12px 16px" }}>Category</th>
                        <th style={{ padding: "12px 16px", textAlign: "right" }}>Total (₹)</th>
                        <th style={{ padding: "12px 16px" }}>Share %</th>
                        <th style={{ padding: "12px 16px" }}>Top Supplier</th>
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
      {/* CLEAR CREDIT BALANCE MODAL */}
      {/* ======================================================== */}
      {settleModalOpen && (
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
              maxWidth: "540px",
              maxHeight: "90vh",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 20px 50px rgba(0, 0, 0, 0.25)",
              overflow: "hidden",
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: "20px 24px",
                background: "linear-gradient(135deg, #064e3b 0%, #065f46 100%)",
                color: "#fff",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexShrink: 0,
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: "17px", fontWeight: 700 }}>
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
            <form onSubmit={handleSaveSettlement} style={{ padding: "24px", overflowY: "auto", flex: 1, display: "flex", flexDirection: "column" }}>
              {/* Select Vendor */}
              <div style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#3c2e4e", marginBottom: "6px" }}>
                  Select Supplier / Vendor Account *
                </label>
                <select
                  value={settleVendor}
                  onChange={(e) => {
                    const v = e.target.value;
                    setSettleVendor(v);
                    const vendorObj = vendorAccounts.find((item) => item.name === v);
                    if (vendorObj && vendorObj.pendingBalance > 0) {
                      setSettleAmount(String(vendorObj.pendingBalance));
                    }
                  }}
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
                  <option value="">-- Select Vendor Account --</option>
                  {vendorAccounts.map((v) => (
                    <option key={v.name} value={v.name}>
                      {v.name} — Credit Due: ₹{formatMoney(v.pendingBalance)} (Total Bills: ₹{formatMoney(v.totalIncurred)})
                    </option>
                  ))}
                </select>
              </div>

              {/* Clearance Amount & Quick Full Balance Button */}
              <div style={{ marginBottom: "16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                  <label style={{ fontSize: "13px", fontWeight: 600, color: "#3c2e4e" }}>
                    Clearance Amount (₹) *
                  </label>
                  {settleVendor && (
                    <button
                      type="button"
                      onClick={() => {
                        const vendorObj = vendorAccounts.find((v) => v.name === settleVendor);
                        if (vendorObj) setSettleAmount(String(vendorObj.pendingBalance));
                      }}
                      style={{
                        border: "none",
                        background: "#ecfdf5",
                        color: "#047857",
                        fontSize: "11px",
                        fontWeight: 700,
                        padding: "2px 8px",
                        borderRadius: "4px",
                        cursor: "pointer",
                      }}
                    >
                      ⚡ Clear Full Credit Balance
                    </button>
                  )}
                </div>
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  placeholder="e.g. 15000"
                  value={settleAmount}
                  onChange={(e) => setSettleAmount(e.target.value)}
                  required
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: "1px solid #d8d3e2",
                    fontSize: "15px",
                    fontWeight: 700,
                    color: "#047857",
                    background: "#fff",
                  }}
                />
              </div>

              {/* Settlement Date & Mode row */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginBottom: "16px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#3c2e4e", marginBottom: "6px" }}>
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
                      border: "1px solid #d8d3e2",
                      fontSize: "13px",
                      background: "#fff",
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#3c2e4e", marginBottom: "6px" }}>
                    Payment Mode *
                  </label>
                  <select
                    value={settleMode}
                    onChange={(e) => setSettleMode(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: "8px",
                      border: "1px solid #d8d3e2",
                      fontSize: "13px",
                      background: "#fff",
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
                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#3c2e4e", marginBottom: "6px" }}>
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
                    border: "1px solid #d8d3e2",
                    fontSize: "13px",
                    background: "#fff",
                  }}
                />
              </div>

              {/* Notes */}
              <div style={{ marginBottom: "24px" }}>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#3c2e4e", marginBottom: "6px" }}>
                  Remarks / Clearance Note
                </label>
                <input
                  type="text"
                  placeholder="e.g. Cleared October grocery credit"
                  value={settleNote}
                  onChange={(e) => setSettleNote(e.target.value)}
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
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", position: "sticky", bottom: 0, background: "#fff", paddingTop: "14px", borderTop: "1px solid #f1f5f9", marginTop: "auto" }}>
                <button
                  type="button"
                  onClick={() => setSettleModalOpen(false)}
                  disabled={settling}
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
                  disabled={settling}
                  style={{
                    padding: "10px 22px",
                    borderRadius: "8px",
                    border: "none",
                    background: "linear-gradient(135deg, #059669 0%, #047857 100%)",
                    color: "#ffffff",
                    fontWeight: 700,
                    fontSize: "13px",
                    cursor: settling ? "not-allowed" : "pointer",
                    boxShadow: "0 4px 14px rgba(5, 150, 105, 0.35)",
                  }}
                >
                  {settling ? "Clearing..." : "✓ Confirm Credit Clearance"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* ADD / EDIT EXPENSE (CREDIT BILL) MODAL */}
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
              maxHeight: "90vh",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 20px 50px rgba(0, 0, 0, 0.25)",
              overflow: "hidden",
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: "20px 24px",
                background: "linear-gradient(135deg, #991b1b 0%, #7f1d1d 100%)",
                color: "#fff",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexShrink: 0,
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: "17px", fontWeight: 700 }}>
                  {editingExpenseId ? "Edit Expense / Bill" : "Record Supplier Credit Bill"}
                </h3>
                <span style={{ fontSize: "12px", color: "#fca5a5" }}>
                  Record purchases on credit or direct outflows
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
            <form onSubmit={handleSaveExpense} style={{ padding: "24px", overflowY: "auto", flex: 1, display: "flex", flexDirection: "column" }}>
              {/* Expense Type Toggle: Credit Purchase (Default) vs Paid Immediately */}
              {!editingExpenseId && (
                <div style={{ marginBottom: "18px" }}>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#4c1d95", marginBottom: "8px", textTransform: "uppercase" }}>
                    Purchase / Payment Type *
                  </label>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                    <button
                      type="button"
                      onClick={() => setFormType("credit")}
                      style={{
                        padding: "10px",
                        borderRadius: "8px",
                        border: formType === "credit" ? "2px solid #dc2626" : "1px solid #e2d9ec",
                        background: formType === "credit" ? "#fef2f2" : "#ffffff",
                        color: formType === "credit" ? "#991b1b" : "#4b5563",
                        fontWeight: 700,
                        fontSize: "13px",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "6px",
                      }}
                    >
                      <span>🔴</span> Credit (Pay Later / On Account)
                    </button>

                    <button
                      type="button"
                      onClick={() => setFormType("paid")}
                      style={{
                        padding: "10px",
                        borderRadius: "8px",
                        border: formType === "paid" ? "2px solid #059669" : "1px solid #e2d9ec",
                        background: formType === "paid" ? "#ecfdf5" : "#ffffff",
                        color: formType === "paid" ? "#065f46" : "#4b5563",
                        fontWeight: 700,
                        fontSize: "13px",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "6px",
                      }}
                    >
                      <span>🟢</span> Direct Paid (Immediate Cash/UPI)
                    </button>
                  </div>
                </div>
              )}

              {/* Vendor & Bill Number row */}
              <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: "14px", marginBottom: "16px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#3c2e4e", marginBottom: "6px" }}>
                    Supplier / Vendor Name *
                  </label>
                  <input
                    type="text"
                    list="vendors-datalist"
                    placeholder="e.g. Metro Cash & Carry, Babu Veg"
                    value={formVendor}
                    onChange={(e) => setFormVendor(e.target.value)}
                    required={formType === "credit"}
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
                    Bill / Challan # (Optional)
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

              {/* Title / Description */}
              <div style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#3c2e4e", marginBottom: "6px" }}>
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
                    Bill Amount (₹) *
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
                      fontWeight: 800,
                      color: "#b91c1c",
                      background: "#fff",
                    }}
                  />
                </div>
              </div>

              {/* Date & Mode row */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginBottom: "16px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#3c2e4e", marginBottom: "6px" }}>
                    Bill Date *
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
                    {formType === "credit" ? "Account Status" : "Direct Payment Method"}
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
                        background: "#fff5f5",
                        color: "#991b1b",
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
                        border: "1px solid #d8d3e2",
                        fontSize: "13px",
                        background: "#fff",
                      }}
                    >
                      {CLEARANCE_PAYMENT_METHODS.map((pm) => (
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
                  Notes / Delivery Particulars (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Delivered to main kitchen, 30 days credit terms"
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
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", position: "sticky", bottom: 0, background: "#fff", paddingTop: "14px", borderTop: "1px solid #f1f5f9", marginTop: "auto" }}>
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
                    background: formType === "credit" ? "linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)" : "linear-gradient(135deg, #059669 0%, #047857 100%)",
                    color: "#ffffff",
                    fontWeight: 700,
                    fontSize: "13px",
                    cursor: submitting ? "not-allowed" : "pointer",
                    boxShadow: "0 4px 14px rgba(220, 38, 38, 0.35)",
                  }}
                >
                  {submitting ? "Saving..." : editingExpenseId ? "Update Bill" : formType === "credit" ? "+ Record Credit Bill" : "Post Paid Expense"}
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