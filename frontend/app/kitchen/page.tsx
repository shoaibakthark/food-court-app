"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth, fetchWithAuth } from "../lib/auth";
import {
  SidebarUserCard,
  OwnerBanner,
  TopbarUserBadge,
  AppSidebar,
  MobileMenuButton,
} from "../components/AuthBar";

const API_URL = typeof window !== "undefined" ? "/api/py" : "http://127.0.0.1:8000";

export type KitchenStaff = {
  id: number;
  name: string;
  mobile?: string | null;
  kitchen_role: string;
  wage_type: "monthly" | "daily" | string;
  wage_rate: number;
  status: "active" | "inactive" | string;
  joined_date?: string | null;
  address?: string | null;
  notes?: string | null;
  duties_count: number;
  total_wages: number;
  total_paid: number;
  balance: number;
};

export type KitchenDuty = {
  id: number;
  staff_id: number;
  staff_name?: string | null;
  kitchen_role?: string | null;
  wage_type?: string | null;
  duty_date: string;
  shift: string;
  duty_status: string; // 'present', 'half', 'absent'
  duty_units: number;
  daily_rate: number;
  duty_wage: number;
  bonus: number;
  deduction: number;
  total_wage: number;
  today_wage?: number | null;
  paid_today?: boolean;
  paid_amount?: number;
  payment_mode?: string;
  note?: string | null;
};

export type KitchenPayment = {
  id: number;
  staff_id: number;
  staff_name?: string | null;
  amount: number;
  payment_date: string;
  payment_mode: string;
  reference_no?: string | null;
  note?: string | null;
};

export type KitchenSummary = {
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

// Local row state for daily wage entry
type DailyEntryRow = {
  staff_id: number;
  staff_name: string;
  kitchen_role: string;
  wage_type: string;
  default_rate: number;
  current_balance: number;
  status: "present" | "half" | "absent";
  today_wage: number;
  paid_today: boolean;
  payment_mode: "Cash" | "UPI" | "Bank Transfer";
  note: string;
  existing_duty_id?: number | null;
};

const KITCHEN_ROLES = [
  "Head Chef",
  "Cook / Curry Master",
  "Tandoor Cook",
  "Biryani Master",
  "Chinese / Fast Food Cook",
  "Assistant Cook",
  "Kitchen Helper",
  "Dishwasher & Cleaner",
  "Kitchen Supervisor",
  "Other Helper",
];

export default function KitchenPage() {
  const router = useRouter();
  const { user, isOwner } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Active view tab: 'daily' | 'monthly' | 'staff' | 'payments'
  const [activeTab, setActiveTab] = useState<"daily" | "monthly" | "staff" | "payments">("daily");

  // Selected date for daily wages (defaults to today)
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return new Date().toISOString().split("T")[0];
  });

  // Data states
  const [staffList, setStaffList] = useState<KitchenStaff[]>([]);
  const [dutiesList, setDutiesList] = useState<KitchenDuty[]>([]);
  const [paymentsList, setPaymentsList] = useState<KitchenPayment[]>([]);
  const [summary, setSummary] = useState<KitchenSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingDaily, setSavingDaily] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Daily editable rows
  const [dailyRows, setDailyRows] = useState<Record<number, DailyEntryRow>>({});

  // Modals
  const [showAddStaffModal, setShowAddStaffModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState<KitchenStaff | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentTargetStaff, setPaymentTargetStaff] = useState<KitchenStaff | null>(null);

  // Add / Edit Staff form
  const [staffForm, setStaffForm] = useState({
    name: "",
    mobile: "",
    kitchen_role: "Kitchen Helper",
    wage_type: "daily", // 'daily' or 'monthly'
    wage_rate: "800",
    status: "active",
    address: "",
    notes: "",
  });

  // Payment form
  const [paymentForm, setPaymentForm] = useState({
    staff_id: "",
    amount: "",
    payment_date: new Date().toISOString().split("T")[0],
    payment_mode: "Cash",
    reference_no: "",
    note: "",
  });

  // Selected month for Monthly Staff tab (YYYY-MM)
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  // Filter for Staff Directory
  const [staffFilter, setStaffFilter] = useState<"all" | "daily" | "monthly">("all");
  const [searchStaff, setSearchStaff] = useState("");

  // ==========================================
  // FETCH ALL DATA
  // ==========================================
  const loadAllData = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMsg(null);

      const [staffRes, summaryRes, dutiesRes, paymentsRes] = await Promise.all([
        fetchWithAuth(`${API_URL}/kitchen/staff`),
        fetchWithAuth(`${API_URL}/kitchen/summary`),
        fetchWithAuth(`${API_URL}/kitchen/duties?duty_date=${selectedDate}`),
        fetchWithAuth(`${API_URL}/kitchen/payments`),
      ]);

      let staffData: KitchenStaff[] = [];
      let dutiesData: KitchenDuty[] = [];

      if (staffRes.ok) {
        staffData = await staffRes.json();
        setStaffList(staffData);
      }
      if (summaryRes.ok) {
        setSummary(await summaryRes.json());
      }
      if (dutiesRes.ok) {
        dutiesData = await dutiesRes.json();
        setDutiesList(dutiesData);
      }
      if (paymentsRes.ok) {
        setPaymentsList(await paymentsRes.json());
      }

      // Initialize daily rows for every active staff member
      const rows: Record<number, DailyEntryRow> = {};
      const activeStaff = staffData.filter((s) => s.status === "active");

      activeStaff.forEach((s) => {
        const existingDuty = dutiesData.find((d) => d.staff_id === s.id);

        if (existingDuty) {
          let st: "present" | "half" | "absent" = "present";
          const dStatus = (existingDuty.duty_status || "").toLowerCase();
          if (dStatus === "absent" || dStatus === "off") {
            st = "absent";
          } else if (dStatus === "half" || dStatus === "half day") {
            st = "half";
          } else {
            st = "present";
          }

          rows[s.id] = {
            staff_id: s.id,
            staff_name: s.name,
            kitchen_role: s.kitchen_role,
            wage_type: s.wage_type,
            default_rate: Number(s.wage_rate) || 0,
            current_balance: Number(s.balance) || 0,
            status: st,
            today_wage: Number(existingDuty.total_wage) || 0,
            paid_today: Boolean(existingDuty.paid_today),
            payment_mode: (existingDuty.payment_mode as "Cash" | "UPI" | "Bank Transfer") || "Cash",
            note: existingDuty.note || "",
            existing_duty_id: existingDuty.id,
          };
        } else {
          // No record yet for this date
          // For daily staff: default to Present with their base daily rate
          // For monthly staff: default to Present with ₹0 daily wage (handled monthly)
          const isMonthly = s.wage_type === "monthly";
          const defaultDailyWage = isMonthly ? 0 : Number(s.wage_rate) || 0;

          rows[s.id] = {
            staff_id: s.id,
            staff_name: s.name,
            kitchen_role: s.kitchen_role,
            wage_type: s.wage_type,
            default_rate: Number(s.wage_rate) || 0,
            current_balance: Number(s.balance) || 0,
            status: "present",
            today_wage: defaultDailyWage,
            paid_today: false,
            payment_mode: "Cash",
            note: "",
            existing_duty_id: null,
          };
        }
      });

      setDailyRows(rows);
    } catch (err: any) {
      console.error("Error loading kitchen data:", err);
      setErrorMsg(err.message || "Failed to load kitchen staff data");
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  // Quick Date Navigation
  const changeDateBy = (days: number) => {
    const cur = new Date(selectedDate);
    cur.setDate(cur.getDate() + days);
    setSelectedDate(cur.toISOString().split("T")[0]);
  };

  const setDateToday = () => {
    setSelectedDate(new Date().toISOString().split("T")[0]);
  };

  const formattedDateTitle = useMemo(() => {
    try {
      const d = new Date(selectedDate);
      return d.toLocaleDateString("en-IN", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    } catch {
      return selectedDate;
    }
  }, [selectedDate]);

  // Separate staff by wage type
  const dailyStaff = useMemo(() => {
    return staffList.filter((s) => s.wage_type === "daily" && s.status === "active");
  }, [staffList]);

  const monthlyStaff = useMemo(() => {
    return staffList.filter((s) => s.wage_type === "monthly" && s.status === "active");
  }, [staffList]);

  // Live totals for daily entry sheet
  const dailySheetTotals = useMemo(() => {
    let presentCount = 0;
    let absentCount = 0;
    let totalWagesToday = 0;
    let totalPaidToday = 0;

    dailyStaff.forEach((s) => {
      const row = dailyRows[s.id];
      if (row) {
        if (row.status !== "absent") {
          presentCount++;
          totalWagesToday += Number(row.today_wage) || 0;
          if (row.paid_today) {
            totalPaidToday += Number(row.today_wage) || 0;
          }
        } else {
          absentCount++;
        }
      }
    });

    return {
      presentCount,
      absentCount,
      totalWagesToday,
      totalPaidToday,
      pendingToday: Math.max(0, totalWagesToday - totalPaidToday),
    };
  }, [dailyStaff, dailyRows]);

  // Update a single field in daily row
  const updateDailyRow = (staffId: number, patch: Partial<DailyEntryRow>) => {
    setDailyRows((prev) => {
      const cur = prev[staffId];
      if (!cur) return prev;
      return {
        ...prev,
        [staffId]: { ...cur, ...patch },
      };
    });
  };

  // Quick attendance toggle for Daily Staff
  const handleDailyStatusChange = (staffId: number, newStatus: "present" | "half" | "absent") => {
    setDailyRows((prev) => {
      const row = prev[staffId];
      if (!row) return prev;

      let newWage = row.today_wage;
      if (newStatus === "absent") {
        newWage = 0;
      } else if (newStatus === "half") {
        newWage = Math.round(row.default_rate * 0.5);
      } else if (newStatus === "present") {
        // If it was 0, restore default rate
        if (newWage === 0) {
          newWage = row.default_rate;
        }
      }

      return {
        ...prev,
        [staffId]: {
          ...row,
          status: newStatus,
          today_wage: newWage,
          paid_today: newStatus === "absent" ? false : row.paid_today,
        },
      };
    });
  };

  // Bulk actions for Daily Staff
  const setAllDailyStatus = (status: "present" | "absent") => {
    setDailyRows((prev) => {
      const next = { ...prev };
      dailyStaff.forEach((s) => {
        const row = next[s.id];
        if (row) {
          const wage = status === "absent" ? 0 : row.default_rate;
          next[s.id] = {
            ...row,
            status,
            today_wage: wage,
            paid_today: status === "absent" ? false : row.paid_today,
          };
        }
      });
      return next;
    });
  };

  // SAVE TODAY'S DAILY WAGES
  const handleSaveDailyWages = async () => {
    if (isOwner) {
      alert("Owner accounts have view-only access.");
      return;
    }

    try {
      setSavingDaily(true);
      setErrorMsg(null);
      setSaveSuccessMsg(null);

      // Build payload for all active staff (both daily and monthly)
      const dutiesPayload = Object.values(dailyRows).map((row) => ({
        staff_id: row.staff_id,
        shift: "Full Day",
        duty_status: row.status,
        duty_units: row.status === "absent" ? 0 : row.status === "half" ? 0.5 : 1.0,
        daily_rate: row.status === "absent" ? 0 : row.today_wage,
        today_wage: row.status === "absent" ? 0 : row.today_wage,
        bonus: 0,
        deduction: 0,
        paid_today: row.paid_today,
        paid_amount: row.paid_today ? row.today_wage : 0,
        payment_mode: row.payment_mode,
        note: row.note || null,
      }));

      const res = await fetchWithAuth(`${API_URL}/kitchen/duties/batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          duty_date: selectedDate,
          duties: dutiesPayload,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to save daily wages");
      }

      setSaveSuccessMsg(`✓ Daily wages for ${formattedDateTitle} saved successfully!`);
      setTimeout(() => setSaveSuccessMsg(null), 4000);
      await loadAllData();
    } catch (err: any) {
      console.error("Save daily wages error:", err);
      setErrorMsg(err.message || "Failed to save daily wages");
    } finally {
      setSavingDaily(false);
    }
  };

  // Save Add/Edit Staff
  const handleSaveStaff = async (e: FormEvent) => {
    e.preventDefault();
    if (isOwner) {
      alert("Owner accounts have view-only access.");
      return;
    }

    try {
      setErrorMsg(null);
      const payload = {
        name: staffForm.name.trim(),
        mobile: staffForm.mobile.trim() || null,
        kitchen_role: staffForm.kitchen_role.trim(),
        wage_type: staffForm.wage_type,
        wage_rate: parseFloat(staffForm.wage_rate) || 0,
        status: staffForm.status,
        address: staffForm.address.trim() || null,
        notes: staffForm.notes.trim() || null,
      };

      let res;
      if (editingStaff) {
        res = await fetchWithAuth(`${API_URL}/kitchen/staff/${editingStaff.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetchWithAuth(`${API_URL}/kitchen/staff`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to save kitchen staff");
      }

      setShowAddStaffModal(false);
      setEditingStaff(null);
      setStaffForm({
        name: "",
        mobile: "",
        kitchen_role: "Kitchen Helper",
        wage_type: "daily",
        wage_rate: "800",
        status: "active",
        address: "",
        notes: "",
      });
      await loadAllData();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to save staff");
    }
  };

  // Delete Staff
  const handleDeleteStaff = async (staffId: number, name: string) => {
    if (isOwner) {
      alert("Owner accounts have view-only access.");
      return;
    }
    if (!confirm(`Are you sure you want to remove ${name}? This will delete their past duties and records.`)) {
      return;
    }

    try {
      const res = await fetchWithAuth(`${API_URL}/kitchen/staff/${staffId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to delete staff");
      }
      await loadAllData();
    } catch (err: any) {
      alert(err.message || "Failed to delete staff");
    }
  };

  // Open Quick Pay Modal
  const openPaymentModal = (staff?: KitchenStaff) => {
    if (staff) {
      setPaymentTargetStaff(staff);
      setPaymentForm({
        staff_id: String(staff.id),
        amount: String(staff.balance > 0 ? staff.balance : staff.wage_rate),
        payment_date: selectedDate,
        payment_mode: "Cash",
        reference_no: "",
        note: staff.wage_type === "monthly" ? `Monthly Salary Advance (${selectedMonth})` : `Daily wage settlement`,
      });
    } else {
      setPaymentTargetStaff(null);
      setPaymentForm({
        staff_id: staffList[0] ? String(staffList[0].id) : "",
        amount: "",
        payment_date: selectedDate,
        payment_mode: "Cash",
        reference_no: "",
        note: "",
      });
    }
    setShowPaymentModal(true);
  };

  // Submit Payment
  const handleSavePayment = async (e: FormEvent) => {
    e.preventDefault();
    if (isOwner) {
      alert("Owner accounts have view-only access.");
      return;
    }

    try {
      const amt = parseFloat(paymentForm.amount);
      if (isNaN(amt) || amt <= 0) {
        alert("Please enter a valid payment amount");
        return;
      }

      const res = await fetchWithAuth(`${API_URL}/kitchen/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          staff_id: parseInt(paymentForm.staff_id),
          amount: amt,
          payment_date: paymentForm.payment_date,
          payment_mode: paymentForm.payment_mode,
          reference_no: paymentForm.reference_no.trim() || null,
          note: paymentForm.note.trim() || null,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to record payment");
      }

      setShowPaymentModal(false);
      await loadAllData();
    } catch (err: any) {
      alert(err.message || "Failed to save payment");
    }
  };

  // Delete Payment
  const handleDeletePayment = async (paymentId: number) => {
    if (isOwner) {
      alert("Owner accounts have view-only access.");
      return;
    }
    if (!confirm("Are you sure you want to delete this payment record? The amount will be added back to staff balance.")) {
      return;
    }

    try {
      const res = await fetchWithAuth(`${API_URL}/kitchen/payments/${paymentId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to delete payment");
      }
      await loadAllData();
    } catch (err: any) {
      alert(err.message || "Failed to delete payment");
    }
  };

  // Monthly Staff stats for selected month
  const monthlyStaffMetrics = useMemo(() => {
    return monthlyStaff.map((s) => {
      // Find payments in selected month
      const monthPayments = paymentsList.filter((p) => {
        return p.staff_id === s.id && (p.payment_date || "").startsWith(selectedMonth);
      });
      const totalPaidThisMonth = monthPayments.reduce((acc, p) => acc + Number(p.amount), 0);

      // Total duties / days present this month
      const monthDuties = dutiesList.filter((d) => {
        return (
          d.staff_id === s.id &&
          (d.duty_date || "").startsWith(selectedMonth) &&
          d.duty_status !== "absent"
        );
      });

      const monthlySalary = Number(s.wage_rate) || 0;
      const balanceDue = Math.max(0, monthlySalary - totalPaidThisMonth);

      return {
        staff: s,
        salary: monthlySalary,
        daysPresent: monthDuties.length,
        paidThisMonth: totalPaidThisMonth,
        balanceDue,
        payments: monthPayments,
      };
    });
  }, [monthlyStaff, paymentsList, dutiesList, selectedMonth]);

  // Filtered staff list for Directory tab
  const filteredStaffList = useMemo(() => {
    return staffList.filter((s) => {
      if (staffFilter === "daily" && s.wage_type !== "daily") return false;
      if (staffFilter === "monthly" && s.wage_type !== "monthly") return false;
      if (searchStaff.trim()) {
        const q = searchStaff.toLowerCase();
        const matchName = s.name.toLowerCase().includes(q);
        const matchRole = s.kitchen_role.toLowerCase().includes(q);
        const matchMobile = (s.mobile || "").includes(q);
        return matchName || matchRole || matchMobile;
      }
      return true;
    });
  }, [staffList, staffFilter, searchStaff]);

  return (
    <div className="flex h-screen bg-[#150624] text-white overflow-hidden font-sans">
      {/* Sidebar Navigation */}
      <AppSidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full min-w-0 overflow-y-auto bg-gradient-to-b from-[#1b082e] via-[#150624] to-[#0f041a]">
        <OwnerBanner />

        {/* Top Header Bar */}
        <header className="sticky top-0 z-20 flex items-center justify-between px-4 sm:px-8 py-3.5 bg-[#200a36]/90 backdrop-blur-md border-b border-purple-900/40 shadow-lg">
          <div className="flex items-center gap-3">
            <MobileMenuButton onClick={() => setSidebarOpen(true)} />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-2xl">👨‍🍳</span>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight bg-gradient-to-r from-purple-200 via-pink-200 to-amber-200 bg-clip-text text-transparent">
                  Kitchen Staff & Wages
                </h1>
              </div>
              <p className="text-xs text-purple-300/70 hidden sm:block">
                Easy variable daily wages & fixed monthly staff management
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => openPaymentModal()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 text-xs sm:text-sm font-medium transition-all shadow-sm"
              title="Record Cash or UPI payment"
            >
              <span>💵</span>
              <span className="hidden md:inline">Record Payment</span>
            </button>

            <button
              onClick={() => {
                setEditingStaff(null);
                setStaffForm({
                  name: "",
                  mobile: "",
                  kitchen_role: "Kitchen Helper",
                  wage_type: "daily",
                  wage_rate: "800",
                  status: "active",
                  address: "",
                  notes: "",
                });
                setShowAddStaffModal(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs sm:text-sm font-semibold transition-all shadow-md shadow-purple-950/40"
            >
              <span>+</span>
              <span>Add Staff</span>
            </button>

            <TopbarUserBadge />
          </div>
        </header>

        {/* Global Feedback Banner */}
        {saveSuccessMsg && (
          <div className="mx-4 sm:mx-8 mt-4 p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-200 text-sm flex items-center justify-between animate-fadeIn">
            <div className="flex items-center gap-2">
              <span className="text-lg">🎉</span>
              <span className="font-medium">{saveSuccessMsg}</span>
            </div>
            <button
              onClick={() => setSaveSuccessMsg(null)}
              className="text-emerald-400 hover:text-white text-xs px-2 py-0.5"
            >
              ✕
            </button>
          </div>
        )}

        {errorMsg && (
          <div className="mx-4 sm:mx-8 mt-4 p-3 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-200 text-sm flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg">⚠️</span>
              <span>{errorMsg}</span>
            </div>
            <button
              onClick={() => setErrorMsg(null)}
              className="text-rose-400 hover:text-white text-xs px-2 py-0.5"
            >
              ✕
            </button>
          </div>
        )}

        {/* Top Summary Metric Cards */}
        <div className="px-4 sm:px-8 pt-5 pb-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {/* Card 1: Today's Working Staff */}
            <div className="p-3.5 rounded-xl bg-[#200a36]/70 border border-purple-800/30 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs text-purple-300/80 font-medium">
                <span>Working Today</span>
                <span className="text-emerald-400 text-base">🟢</span>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-white tracking-tight">
                  {dailySheetTotals.presentCount}
                </span>
                <span className="text-xs text-purple-300/60">
                  / {dailyStaff.length} Daily Staff
                </span>
              </div>
              <div className="text-[11px] text-purple-300/60 mt-1">
                {dailySheetTotals.absentCount > 0 ? `${dailySheetTotals.absentCount} absent today` : "Full attendance"}
              </div>
            </div>

            {/* Card 2: Today's Total Wages */}
            <div className="p-3.5 rounded-xl bg-[#200a36]/70 border border-purple-800/30 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs text-purple-300/80 font-medium">
                <span>Today's Wages Total</span>
                <span className="text-amber-400 text-base">💰</span>
              </div>
              <div className="mt-2">
                <span className="text-2xl font-bold text-amber-300 tracking-tight">
                  ₹{dailySheetTotals.totalWagesToday.toLocaleString("en-IN")}
                </span>
              </div>
              <div className="text-[11px] text-purple-300/60 mt-1 flex items-center justify-between">
                <span>Paid: ₹{dailySheetTotals.totalPaidToday.toLocaleString("en-IN")}</span>
                <span className="text-amber-400/90 font-medium">Due: ₹{dailySheetTotals.pendingToday.toLocaleString("en-IN")}</span>
              </div>
            </div>

            {/* Card 3: Monthly Staff */}
            <div className="p-3.5 rounded-xl bg-[#200a36]/70 border border-purple-800/30 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs text-purple-300/80 font-medium">
                <span>Monthly Staff</span>
                <span className="text-indigo-400 text-base">💼</span>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-indigo-300 tracking-tight">
                  {monthlyStaff.length}
                </span>
                <span className="text-xs text-purple-300/60">Staff</span>
              </div>
              <div className="text-[11px] text-purple-300/60 mt-1 truncate">
                {monthlyStaff.length > 0
                  ? monthlyStaff.map((m) => m.name).join(", ")
                  : "No monthly staff"}
              </div>
            </div>

            {/* Card 4: Total Pending Balances */}
            <div className="p-3.5 rounded-xl bg-[#200a36]/70 border border-purple-800/30 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs text-purple-300/80 font-medium">
                <span>Total Balance Due</span>
                <span className="text-rose-400 text-base">⏳</span>
              </div>
              <div className="mt-2">
                <span className="text-2xl font-bold text-rose-300 tracking-tight">
                  ₹{(summary?.total_pending_balance || 0).toLocaleString("en-IN")}
                </span>
              </div>
              <div className="text-[11px] text-purple-300/60 mt-1">
                Accrued wage balance across all kitchen staff
              </div>
            </div>
          </div>
        </div>

        {/* View Switcher Tabs */}
        <div className="px-4 sm:px-8 pt-2">
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[#200a36]/60 border border-purple-900/30 w-full sm:w-fit overflow-x-auto">
            <button
              onClick={() => setActiveTab("daily")}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold whitespace-nowrap transition-all ${
                activeTab === "daily"
                  ? "bg-purple-600 text-white shadow-md shadow-purple-950/50"
                  : "text-purple-300/70 hover:text-white hover:bg-purple-900/30"
              }`}
            >
              <span>📅</span>
              <span>Daily Wages Entry</span>
              <span className="px-1.5 py-0.2 rounded-full bg-purple-900/60 text-[10px] text-purple-200">
                {dailyStaff.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("monthly")}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold whitespace-nowrap transition-all ${
                activeTab === "monthly"
                  ? "bg-purple-600 text-white shadow-md shadow-purple-950/50"
                  : "text-purple-300/70 hover:text-white hover:bg-purple-900/30"
              }`}
            >
              <span>💼</span>
              <span>Monthly Staff</span>
              <span className="px-1.5 py-0.2 rounded-full bg-purple-900/60 text-[10px] text-purple-200">
                {monthlyStaff.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("staff")}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold whitespace-nowrap transition-all ${
                activeTab === "staff"
                  ? "bg-purple-600 text-white shadow-md shadow-purple-950/50"
                  : "text-purple-300/70 hover:text-white hover:bg-purple-900/30"
              }`}
            >
              <span>👥</span>
              <span>Staff & Balances</span>
            </button>

            <button
              onClick={() => setActiveTab("payments")}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold whitespace-nowrap transition-all ${
                activeTab === "payments"
                  ? "bg-purple-600 text-white shadow-md shadow-purple-950/50"
                  : "text-purple-300/70 hover:text-white hover:bg-purple-900/30"
              }`}
            >
              <span>🧾</span>
              <span>Payment History</span>
            </button>
          </div>
        </div>

        {/* Tab 1: DAILY WAGES ENTRY (THE MAIN HERO WORKSPACE) */}
        {activeTab === "daily" && (
          <div className="px-4 sm:px-8 py-4 space-y-4">
            {/* Date Navigator Banner */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-[#260c40] via-[#200a36] to-[#1d0733] border border-purple-800/40 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 bg-[#150624]/80 p-1 rounded-xl border border-purple-900/50">
                  <button
                    onClick={() => changeDateBy(-1)}
                    className="px-2.5 py-1 rounded-lg bg-purple-900/40 hover:bg-purple-800/60 text-purple-200 text-xs font-medium transition"
                    title="Previous Day"
                  >
                    ◀ Prev
                  </button>
                  <button
                    onClick={setDateToday}
                    className="px-2.5 py-1 rounded-lg bg-purple-600/30 hover:bg-purple-600/50 text-purple-200 text-xs font-semibold transition"
                  >
                    Today
                  </button>
                  <button
                    onClick={() => changeDateBy(1)}
                    className="px-2.5 py-1 rounded-lg bg-purple-900/40 hover:bg-purple-800/60 text-purple-200 text-xs font-medium transition"
                    title="Next Day"
                  >
                    Next ▶
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="px-3 py-1.5 rounded-xl bg-[#150624] border border-purple-800/50 text-white text-xs sm:text-sm font-semibold focus:outline-none focus:border-purple-400"
                  />
                  <span className="text-xs sm:text-sm font-semibold text-purple-200">
                    {formattedDateTitle}
                  </span>
                </div>
              </div>

              {/* Quick Roster Actions & Save Button */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setAllDailyStatus("present")}
                  className="px-2.5 py-1.5 rounded-lg bg-emerald-950/40 hover:bg-emerald-900/50 text-emerald-300 border border-emerald-800/40 text-xs font-medium transition"
                >
                  ✓ All Present
                </button>
                <button
                  type="button"
                  onClick={() => setAllDailyStatus("absent")}
                  className="px-2.5 py-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/50 text-rose-300 border border-rose-800/40 text-xs font-medium transition"
                >
                  ✗ All Absent
                </button>

                <button
                  onClick={handleSaveDailyWages}
                  disabled={savingDaily}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs sm:text-sm font-bold shadow-lg shadow-emerald-950/50 transition-all disabled:opacity-50"
                >
                  <span>💾</span>
                  <span>{savingDaily ? "Saving..." : "Save Today's Wages"}</span>
                </button>
              </div>
            </div>

            {/* Instruction Tip */}
            <div className="flex items-center gap-2 text-xs text-purple-300/80 px-1">
              <span className="text-amber-400 font-bold">💡 Tip:</span>
              <span>
                Wages change day-to-day. Simply type today's exact rupee amount for each staff member, or check "Paid Today" if handed cash.
              </span>
            </div>

            {/* Section 1: Daily Working Staff Sheet */}
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                  <span>🔪</span>
                  <span>Daily Working Staff ({dailyStaff.length})</span>
                </h2>
                <span className="text-xs text-purple-300/70">
                  Total Day Wage: <strong className="text-amber-300 font-bold">₹{dailySheetTotals.totalWagesToday.toLocaleString("en-IN")}</strong>
                </span>
              </div>

              {dailyStaff.length === 0 ? (
                <div className="p-8 rounded-2xl bg-[#200a36]/50 border border-purple-900/40 text-center">
                  <p className="text-purple-300/70 text-sm">No daily wage staff found.</p>
                  <button
                    onClick={() => {
                      setEditingStaff(null);
                      setStaffForm({
                        name: "",
                        mobile: "",
                        kitchen_role: "Kitchen Helper",
                        wage_type: "daily",
                        wage_rate: "800",
                        status: "active",
                        address: "",
                        notes: "",
                      });
                      setShowAddStaffModal(true);
                    }}
                    className="mt-3 px-4 py-1.5 rounded-lg bg-purple-600 text-white text-xs font-semibold"
                  >
                    + Add Daily Staff
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2.5">
                  {dailyStaff.map((staff) => {
                    const row = dailyRows[staff.id] || {
                      staff_id: staff.id,
                      staff_name: staff.name,
                      kitchen_role: staff.kitchen_role,
                      wage_type: "daily",
                      default_rate: Number(staff.wage_rate) || 0,
                      current_balance: Number(staff.balance) || 0,
                      status: "present",
                      today_wage: Number(staff.wage_rate) || 0,
                      paid_today: false,
                      payment_mode: "Cash",
                      note: "",
                      existing_duty_id: null,
                    };

                    const isAbsent = row.status === "absent";
                    const isHalf = row.status === "half";
                    const isPresent = row.status === "present";

                    return (
                      <div
                        key={staff.id}
                        className={`p-3.5 sm:p-4 rounded-2xl border transition-all ${
                          isAbsent
                            ? "bg-[#1d0733]/40 border-purple-950/40 opacity-70"
                            : isHalf
                            ? "bg-[#250d3d]/90 border-amber-600/30 shadow-sm"
                            : "bg-[#200a36]/90 border-purple-800/40 shadow-sm hover:border-purple-700/60"
                        }`}
                      >
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                          {/* Staff Info */}
                          <div className="flex items-center gap-3 min-w-[200px]">
                            <div
                              className={`w-10 h-10 rounded-xl flex items-center justify-between justify-center font-bold text-sm ${
                                isAbsent
                                  ? "bg-rose-950/50 text-rose-300 border border-rose-800/40"
                                  : isHalf
                                  ? "bg-amber-950/50 text-amber-300 border border-amber-800/40"
                                  : "bg-purple-900/50 text-purple-200 border border-purple-700/50"
                              }`}
                            >
                              {staff.name.slice(0, 2).toUpperCase()}
                            </div>

                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-white text-sm sm:text-base tracking-tight">
                                  {staff.name}
                                </span>
                                <span className="px-2 py-0.5 rounded-md bg-purple-950/80 border border-purple-800/40 text-[10px] text-purple-300 font-medium">
                                  {staff.kitchen_role}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 text-xs text-purple-300/70 mt-0.5">
                                <span>Default: ₹{Number(staff.wage_rate).toLocaleString("en-IN")}/day</span>
                                <span>•</span>
                                <button
                                  type="button"
                                  onClick={() => openPaymentModal(staff)}
                                  className={`font-semibold hover:underline ${
                                    staff.balance > 0 ? "text-amber-300" : "text-emerald-400"
                                  }`}
                                  title="Click to settle balance"
                                >
                                  Balance: ₹{Number(staff.balance).toLocaleString("en-IN")}
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* Attendance Status Buttons */}
                          <div className="flex items-center gap-1.5 self-start lg:self-center">
                            <button
                              type="button"
                              onClick={() => handleDailyStatusChange(staff.id, "present")}
                              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                                isPresent
                                  ? "bg-emerald-600 text-white shadow-md shadow-emerald-950/50 scale-105"
                                  : "bg-[#150624] text-purple-300 hover:text-white border border-purple-900/60"
                              }`}
                            >
                              <span>🟢</span>
                              <span>Present</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDailyStatusChange(staff.id, "half")}
                              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                                isHalf
                                  ? "bg-amber-600 text-white shadow-md shadow-amber-950/50 scale-105"
                                  : "bg-[#150624] text-purple-300 hover:text-white border border-purple-900/60"
                              }`}
                            >
                              <span>🟡</span>
                              <span>Half Day</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDailyStatusChange(staff.id, "absent")}
                              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                                isAbsent
                                  ? "bg-rose-600 text-white shadow-md shadow-rose-950/50 scale-105"
                                  : "bg-[#150624] text-purple-300 hover:text-white border border-purple-900/60"
                              }`}
                            >
                              <span>🔴</span>
                              <span>Absent</span>
                            </button>
                          </div>

                          {/* Today's Wage Input (THE HERO FIELD) */}
                          <div className="flex items-center gap-2 self-start lg:self-center">
                            <div className="flex flex-col">
                              <label className="text-[10px] text-purple-300/70 font-semibold mb-0.5">
                                Today's Wage (₹)
                              </label>
                              <div className="relative flex items-center">
                                <span className="absolute left-2.5 text-xs text-purple-300/80 font-bold">
                                  ₹
                                </span>
                                <input
                                  type="number"
                                  disabled={isAbsent}
                                  value={row.today_wage}
                                  onChange={(e) => {
                                    const val = Math.max(0, parseFloat(e.target.value) || 0);
                                    updateDailyRow(staff.id, { today_wage: val });
                                  }}
                                  className={`w-28 pl-6 pr-2.5 py-1.5 rounded-xl text-sm font-bold text-right transition-all focus:outline-none ${
                                    isAbsent
                                      ? "bg-[#150624]/40 border border-purple-950 text-purple-500/50 cursor-not-allowed"
                                      : "bg-[#150624] border border-purple-600/70 text-amber-300 focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                                  }`}
                                  placeholder="0"
                                />
                              </div>
                            </div>

                            {/* Paid in Cash Today Toggle */}
                            <div className="flex flex-col ml-2">
                              <label className="text-[10px] text-purple-300/70 font-semibold mb-0.5">
                                Paid Today?
                              </label>
                              <label
                                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border cursor-pointer text-xs font-semibold transition-all select-none ${
                                  row.paid_today
                                    ? "bg-emerald-950/60 border-emerald-500/70 text-emerald-300 shadow-sm"
                                    : "bg-[#150624]/60 border-purple-900/50 text-purple-300/70 hover:border-purple-700"
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  disabled={isAbsent}
                                  checked={row.paid_today}
                                  onChange={(e) => {
                                    updateDailyRow(staff.id, { paid_today: e.target.checked });
                                  }}
                                  className="rounded text-emerald-500 focus:ring-emerald-400"
                                />
                                <span>💵 {row.paid_today ? "Paid Cash" : "Pending"}</span>
                              </label>
                            </div>
                          </div>

                          {/* Quick Note Input */}
                          <div className="w-full lg:w-44 self-start lg:self-center">
                            <input
                              type="text"
                              value={row.note}
                              onChange={(e) => updateDailyRow(staff.id, { note: e.target.value })}
                              placeholder="Note (e.g. catering bonus)"
                              className="w-full px-2.5 py-1.5 rounded-xl bg-[#150624]/80 border border-purple-900/50 text-xs text-purple-200 placeholder-purple-400/40 focus:outline-none focus:border-purple-500"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Section 2: Monthly Staff Attendance (Separated & Clean) */}
            {monthlyStaff.length > 0 && (
              <div className="mt-6 pt-4 border-t border-purple-900/40">
                <div className="flex items-center justify-between mb-2 px-1">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <span>💼</span>
                      <span>Monthly Staff Attendance ({monthlyStaff.length})</span>
                    </h3>
                    <p className="text-[11px] text-purple-300/60">
                      Fixed monthly salary staff — mark daily presence here. Daily wages are not deducted.
                    </p>
                  </div>
                  <button
                    onClick={() => setActiveTab("monthly")}
                    className="text-xs text-purple-300 hover:text-white font-medium underline"
                  >
                    Manage Monthly Salaries →
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {monthlyStaff.map((staff) => {
                    const row = dailyRows[staff.id] || {
                      staff_id: staff.id,
                      staff_name: staff.name,
                      kitchen_role: staff.kitchen_role,
                      wage_type: "monthly",
                      default_rate: Number(staff.wage_rate) || 0,
                      current_balance: Number(staff.balance) || 0,
                      status: "present",
                      today_wage: 0,
                      paid_today: false,
                      payment_mode: "Cash",
                      note: "",
                      existing_duty_id: null,
                    };

                    const isPresent = row.status !== "absent";

                    return (
                      <div
                        key={staff.id}
                        className="p-3 rounded-2xl bg-[#200a36]/60 border border-purple-800/30 flex items-center justify-between gap-3"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white text-sm">{staff.name}</span>
                            <span className="px-2 py-0.2 rounded bg-indigo-950/80 border border-indigo-700/50 text-[10px] text-indigo-300 font-medium">
                              {staff.kitchen_role}
                            </span>
                          </div>
                          <div className="text-xs text-purple-300/70 mt-0.5">
                            Salary: <strong className="text-indigo-300 font-semibold">₹{Number(staff.wage_rate).toLocaleString("en-IN")}/mo</strong>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              const newSt = isPresent ? "absent" : "present";
                              updateDailyRow(staff.id, { status: newSt, today_wage: 0 });
                            }}
                            className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                              isPresent
                                ? "bg-emerald-600/30 text-emerald-300 border border-emerald-500/50"
                                : "bg-rose-600/30 text-rose-300 border border-rose-500/50"
                            }`}
                          >
                            {isPresent ? "🟢 Present" : "🔴 On Leave"}
                          </button>

                          <button
                            type="button"
                            onClick={() => openPaymentModal(staff)}
                            className="px-2.5 py-1 rounded-xl bg-purple-900/40 hover:bg-purple-800/60 text-purple-200 text-xs font-medium border border-purple-700/40"
                            title="Pay Advance"
                          >
                            Advance 💵
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Sticky Save Bar at Bottom */}
            <div className="sticky bottom-3 z-10 p-3 sm:p-4 rounded-2xl bg-[#1b082e]/95 backdrop-blur-md border border-purple-700/50 shadow-2xl flex items-center justify-between gap-3">
              <div className="text-xs sm:text-sm">
                <span className="text-purple-300/70">Today's Wages Total: </span>
                <strong className="text-amber-300 font-bold text-sm sm:text-base">
                  ₹{dailySheetTotals.totalWagesToday.toLocaleString("en-IN")}
                </strong>
                <span className="text-purple-400/60 ml-2">
                  ({dailySheetTotals.presentCount} present)
                </span>
              </div>

              <button
                onClick={handleSaveDailyWages}
                disabled={savingDaily}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs sm:text-sm font-bold shadow-lg shadow-emerald-950/60 transition-all disabled:opacity-50 flex items-center gap-2"
              >
                <span>💾</span>
                <span>{savingDaily ? "Saving..." : "Save Daily Wages"}</span>
              </button>
            </div>
          </div>
        )}

        {/* Tab 2: MONTHLY STAFF (SALARY & ADVANCES) */}
        {activeTab === "monthly" && (
          <div className="px-4 sm:px-8 py-4 space-y-4">
            {/* Header / Month Filter */}
            <div className="p-4 rounded-2xl bg-[#200a36]/80 border border-purple-800/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <span>💼</span>
                  <span>Monthly Fixed Salary Staff</span>
                </h2>
                <p className="text-xs text-purple-300/70">
                  Manage minimal monthly salaried kitchen staff, attendance days, and salary advances.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-xs text-purple-300 font-medium">Month:</label>
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="px-3 py-1.5 rounded-xl bg-[#150624] border border-purple-800 text-white text-xs sm:text-sm font-semibold focus:outline-none"
                />
              </div>
            </div>

            {monthlyStaff.length === 0 ? (
              <div className="p-8 rounded-2xl bg-[#200a36]/40 border border-purple-900/30 text-center">
                <p className="text-purple-300/70 text-sm">No monthly salary staff configured.</p>
                <button
                  onClick={() => {
                    setEditingStaff(null);
                    setStaffForm({
                      name: "",
                      mobile: "",
                      kitchen_role: "Head Chef",
                      wage_type: "monthly",
                      wage_rate: "20000",
                      status: "active",
                      address: "",
                      notes: "",
                    });
                    setShowAddStaffModal(true);
                  }}
                  className="mt-3 px-4 py-2 rounded-xl bg-purple-600 text-white text-xs font-semibold"
                >
                  + Add Monthly Staff
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {monthlyStaffMetrics.map(({ staff, salary, daysPresent, paidThisMonth, balanceDue, payments }) => (
                  <div
                    key={staff.id}
                    className="p-5 rounded-2xl bg-[#200a36]/90 border border-purple-800/40 shadow-md space-y-4"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg font-bold text-white tracking-tight">{staff.name}</h3>
                          <span className="px-2 py-0.5 rounded-md bg-indigo-950/80 border border-indigo-700/50 text-[10px] text-indigo-300 font-semibold">
                            {staff.kitchen_role}
                          </span>
                        </div>
                        {staff.mobile && (
                          <p className="text-xs text-purple-300/70 mt-0.5">📞 {staff.mobile}</p>
                        )}
                      </div>

                      <button
                        onClick={() => openPaymentModal(staff)}
                        className="px-3.5 py-1.5 rounded-xl bg-emerald-600/30 hover:bg-emerald-600/40 text-emerald-300 border border-emerald-500/50 text-xs font-semibold transition"
                      >
                        💵 Pay Advance / Salary
                      </button>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-3 gap-2.5 p-3 rounded-xl bg-[#150624]/70 border border-purple-900/40 text-center">
                      <div>
                        <div className="text-[10px] text-purple-300/70 font-semibold uppercase">Fixed Salary</div>
                        <div className="text-sm sm:text-base font-bold text-white mt-0.5">
                          ₹{salary.toLocaleString("en-IN")}
                        </div>
                      </div>

                      <div>
                        <div className="text-[10px] text-purple-300/70 font-semibold uppercase">Paid in {selectedMonth}</div>
                        <div className="text-sm sm:text-base font-bold text-emerald-300 mt-0.5">
                          ₹{paidThisMonth.toLocaleString("en-IN")}
                        </div>
                      </div>

                      <div>
                        <div className="text-[10px] text-purple-300/70 font-semibold uppercase">Salary Balance</div>
                        <div className="text-sm sm:text-base font-bold text-amber-300 mt-0.5">
                          ₹{balanceDue.toLocaleString("en-IN")}
                        </div>
                      </div>
                    </div>

                    {/* Attendance Note */}
                    <div className="flex items-center justify-between text-xs text-purple-300/80 px-1">
                      <span>Recorded presence: <strong className="text-purple-200">{daysPresent} days</strong></span>
                      <button
                        onClick={() => {
                          setEditingStaff(staff);
                          setStaffForm({
                            name: staff.name,
                            mobile: staff.mobile || "",
                            kitchen_role: staff.kitchen_role,
                            wage_type: staff.wage_type,
                            wage_rate: String(staff.wage_rate),
                            status: staff.status,
                            address: staff.address || "",
                            notes: staff.notes || "",
                          });
                          setShowAddStaffModal(true);
                        }}
                        className="text-purple-400 hover:text-white underline text-[11px]"
                      >
                        Edit Staff Info
                      </button>
                    </div>

                    {/* Recent Payments for this staff in selected month */}
                    {payments.length > 0 && (
                      <div className="pt-2 border-t border-purple-900/40 space-y-1.5">
                        <div className="text-[11px] font-semibold text-purple-300/60 uppercase">
                          Advances / Payments this month
                        </div>
                        {payments.slice(0, 3).map((p) => (
                          <div
                            key={p.id}
                            className="flex items-center justify-between text-xs py-1 px-2 rounded-lg bg-[#150624]/40"
                          >
                            <span className="text-purple-300/70">{p.payment_date} ({p.payment_mode})</span>
                            <span className="font-semibold text-emerald-300">₹{Number(p.amount).toLocaleString("en-IN")}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 3: ALL STAFF & BALANCES (DIRECTORY) */}
        {activeTab === "staff" && (
          <div className="px-4 sm:px-8 py-4 space-y-4">
            {/* Search and Filters */}
            <div className="p-4 rounded-2xl bg-[#200a36]/80 border border-purple-800/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-1 max-w-md">
                <span className="text-purple-400 text-sm">🔍</span>
                <input
                  type="text"
                  placeholder="Search staff by name or role..."
                  value={searchStaff}
                  onChange={(e) => setSearchStaff(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl bg-[#150624] border border-purple-800 text-white text-xs sm:text-sm focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-1.5 bg-[#150624] p-1 rounded-xl border border-purple-900/40 self-start sm:self-auto">
                <button
                  onClick={() => setStaffFilter("all")}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                    staffFilter === "all" ? "bg-purple-600 text-white" : "text-purple-300/70 hover:text-white"
                  }`}
                >
                  All ({staffList.length})
                </button>
                <button
                  onClick={() => setStaffFilter("daily")}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                    staffFilter === "daily" ? "bg-purple-600 text-white" : "text-purple-300/70 hover:text-white"
                  }`}
                >
                  Daily Staff ({dailyStaff.length})
                </button>
                <button
                  onClick={() => setStaffFilter("monthly")}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                    staffFilter === "monthly" ? "bg-purple-600 text-white" : "text-purple-300/70 hover:text-white"
                  }`}
                >
                  Monthly Staff ({monthlyStaff.length})
                </button>
              </div>
            </div>

            {/* Staff Table / Cards */}
            <div className="overflow-x-auto rounded-2xl border border-purple-800/40 bg-[#200a36]/80 shadow-md">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-[#150624]/90 text-purple-300/70 uppercase text-[11px] font-semibold border-b border-purple-900/40">
                  <tr>
                    <th className="py-3 px-4">Staff Member</th>
                    <th className="py-3 px-3">Role</th>
                    <th className="py-3 px-3">Type</th>
                    <th className="py-3 px-3 text-right">Rate / Salary</th>
                    <th className="py-3 px-3 text-right">Total Accrued</th>
                    <th className="py-3 px-3 text-right">Total Paid</th>
                    <th className="py-3 px-3 text-right">Pending Balance</th>
                    <th className="py-3 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-purple-900/30">
                  {filteredStaffList.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-purple-300/60">
                        No staff members found matching criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredStaffList.map((s) => (
                      <tr key={s.id} className="hover:bg-purple-900/20 transition">
                        <td className="py-3.5 px-4 font-bold text-white">
                          <div className="flex items-center gap-2">
                            <span>{s.name}</span>
                            {s.status === "inactive" && (
                              <span className="px-1.5 py-0.2 rounded bg-rose-950 text-rose-300 text-[10px]">
                                Inactive
                              </span>
                            )}
                          </div>
                          {s.mobile && (
                            <span className="text-[11px] text-purple-300/60 font-normal block">{s.mobile}</span>
                          )}
                        </td>
                        <td className="py-3.5 px-3 text-purple-200">{s.kitchen_role}</td>
                        <td className="py-3.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                              s.wage_type === "monthly"
                                ? "bg-indigo-950 border border-indigo-700/50 text-indigo-300"
                                : "bg-amber-950 border border-amber-700/50 text-amber-300"
                            }`}
                          >
                            {s.wage_type}
                          </span>
                        </td>
                        <td className="py-3.5 px-3 text-right font-medium text-purple-200">
                          ₹{Number(s.wage_rate).toLocaleString("en-IN")}
                          <span className="text-[10px] text-purple-400/60 block">
                            {s.wage_type === "monthly" ? "/month" : "/day"}
                          </span>
                        </td>
                        <td className="py-3.5 px-3 text-right font-medium text-purple-200">
                          ₹{Number(s.total_wages).toLocaleString("en-IN")}
                        </td>
                        <td className="py-3.5 px-3 text-right font-medium text-emerald-300">
                          ₹{Number(s.total_paid).toLocaleString("en-IN")}
                        </td>
                        <td className="py-3.5 px-3 text-right font-bold">
                          <span
                            className={`px-2 py-0.5 rounded-lg ${
                              s.balance > 0
                                ? "bg-amber-950/80 border border-amber-700/50 text-amber-300"
                                : "bg-emerald-950/60 text-emerald-400"
                            }`}
                          >
                            ₹{Number(s.balance).toLocaleString("en-IN")}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => openPaymentModal(s)}
                              className="px-2.5 py-1 rounded-lg bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-200 text-xs font-semibold border border-emerald-500/40"
                              title="Pay Balance"
                            >
                              Pay 💵
                            </button>
                            <button
                              onClick={() => {
                                setEditingStaff(s);
                                setStaffForm({
                                  name: s.name,
                                  mobile: s.mobile || "",
                                  kitchen_role: s.kitchen_role,
                                  wage_type: s.wage_type,
                                  wage_rate: String(s.wage_rate),
                                  status: s.status,
                                  address: s.address || "",
                                  notes: s.notes || "",
                                });
                                setShowAddStaffModal(true);
                              }}
                              className="px-2 py-1 rounded-lg bg-purple-900/50 hover:bg-purple-800 text-purple-200 text-xs"
                              title="Edit"
                            >
                              ✏️
                            </button>
                            <button
                              onClick={() => handleDeleteStaff(s.id, s.name)}
                              className="px-2 py-1 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 text-xs border border-rose-900/50"
                              title="Delete"
                            >
                              🗑️
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 4: PAYMENT HISTORY */}
        {activeTab === "payments" && (
          <div className="px-4 sm:px-8 py-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <span>🧾</span>
                  <span>Kitchen Staff Payment Ledger ({paymentsList.length})</span>
                </h2>
                <p className="text-xs text-purple-300/70">
                  Record of all cash payouts, UPI transfers, and advances handed to kitchen staff.
                </p>
              </div>

              <button
                onClick={() => openPaymentModal()}
                className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-semibold shadow-md transition"
              >
                + Record Payment
              </button>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-purple-800/40 bg-[#200a36]/80 shadow-md">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-[#150624]/90 text-purple-300/70 uppercase text-[11px] font-semibold border-b border-purple-900/40">
                  <tr>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Staff Member</th>
                    <th className="py-3 px-3 text-right">Amount (₹)</th>
                    <th className="py-3 px-3 text-center">Mode</th>
                    <th className="py-3 px-4">Note / Reference</th>
                    <th className="py-3 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-purple-900/30">
                  {paymentsList.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-purple-300/60">
                        No payments recorded yet.
                      </td>
                    </tr>
                  ) : (
                    paymentsList.map((p) => (
                      <tr key={p.id} className="hover:bg-purple-900/20 transition">
                        <td className="py-3 px-4 font-medium text-purple-200">{p.payment_date}</td>
                        <td className="py-3 px-4 font-bold text-white">{p.staff_name || `Staff #${p.staff_id}`}</td>
                        <td className="py-3 px-3 text-right font-bold text-emerald-300">
                          ₹{Number(p.amount).toLocaleString("en-IN")}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-950 border border-purple-800 text-purple-200">
                            {p.payment_mode}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-purple-300/80 text-xs">
                          {p.note || "-"}
                          {p.reference_no && (
                            <span className="block text-[10px] text-purple-400/60">Ref: {p.reference_no}</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={() => handleDeletePayment(p.id)}
                            className="px-2 py-1 rounded-lg bg-rose-950/40 hover:bg-rose-900 text-rose-300 text-xs border border-rose-900"
                            title="Delete Payment"
                          >
                            🗑️
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* MODAL: Add / Edit Staff */}
        {showAddStaffModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
            <div className="w-full max-w-md rounded-2xl bg-[#200a36] border border-purple-700/60 p-6 shadow-2xl">
              <div className="flex items-center justify-between pb-3 border-b border-purple-800/40">
                <h3 className="text-base font-bold text-white">
                  {editingStaff ? "Edit Kitchen Staff" : "Add Kitchen Staff"}
                </h3>
                <button
                  onClick={() => setShowAddStaffModal(false)}
                  className="text-purple-400 hover:text-white text-sm"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSaveStaff} className="mt-4 space-y-3.5">
                <div>
                  <label className="text-xs font-semibold text-purple-200 block mb-1">
                    Staff Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={staffForm.name}
                    onChange={(e) => setStaffForm({ ...staffForm, name: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-[#150624] border border-purple-800 text-white text-sm focus:outline-none focus:border-purple-400"
                    placeholder="e.g. Ramesh Kumar"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-purple-200 block mb-1">
                      Role / Designation
                    </label>
                    <select
                      value={staffForm.kitchen_role}
                      onChange={(e) => setStaffForm({ ...staffForm, kitchen_role: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-[#150624] border border-purple-800 text-white text-sm focus:outline-none focus:border-purple-400"
                    >
                      {KITCHEN_ROLES.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-purple-200 block mb-1">
                      Mobile Number
                    </label>
                    <input
                      type="tel"
                      value={staffForm.mobile}
                      onChange={(e) => setStaffForm({ ...staffForm, mobile: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-[#150624] border border-purple-800 text-white text-sm focus:outline-none focus:border-purple-400"
                      placeholder="9876543210"
                    />
                  </div>
                </div>

                {/* Wage Type Selection */}
                <div>
                  <label className="text-xs font-semibold text-purple-200 block mb-1.5">
                    Wage Type *
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setStaffForm({ ...staffForm, wage_type: "daily", wage_rate: "800" })}
                      className={`p-2.5 rounded-xl border text-xs font-bold transition flex flex-col items-center gap-1 ${
                        staffForm.wage_type === "daily"
                          ? "bg-purple-600 border-purple-400 text-white shadow-md"
                          : "bg-[#150624] border-purple-900 text-purple-300 hover:text-white"
                      }`}
                    >
                      <span>🔪 Daily Wage Staff</span>
                      <span className="text-[10px] font-normal text-purple-200/70">Varies every day</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setStaffForm({ ...staffForm, wage_type: "monthly", wage_rate: "20000" })}
                      className={`p-2.5 rounded-xl border text-xs font-bold transition flex flex-col items-center gap-1 ${
                        staffForm.wage_type === "monthly"
                          ? "bg-indigo-600 border-indigo-400 text-white shadow-md"
                          : "bg-[#150624] border-purple-900 text-purple-300 hover:text-white"
                      }`}
                    >
                      <span>💼 Monthly Salaried</span>
                      <span className="text-[10px] font-normal text-purple-200/70">Fixed monthly pay</span>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-purple-200 block mb-1">
                    {staffForm.wage_type === "monthly" ? "Monthly Salary (₹)" : "Default Daily Rate (₹)"}
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={staffForm.wage_rate}
                    onChange={(e) => setStaffForm({ ...staffForm, wage_rate: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-[#150624] border border-purple-800 text-white text-sm focus:outline-none focus:border-purple-400 font-bold"
                    placeholder="e.g. 800 or 20000"
                  />
                  <span className="text-[10px] text-purple-300/60 mt-1 block">
                    {staffForm.wage_type === "monthly"
                      ? "Paid monthly. Daily attendance tracks presence without deducting daily wage."
                      : "Can be freely changed on any day when recording daily duty."}
                  </span>
                </div>

                <div>
                  <label className="text-xs font-semibold text-purple-200 block mb-1">
                    Notes / Remarks (Optional)
                  </label>
                  <input
                    type="text"
                    value={staffForm.notes}
                    onChange={(e) => setStaffForm({ ...staffForm, notes: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-[#150624] border border-purple-800 text-white text-sm focus:outline-none focus:border-purple-400"
                    placeholder="e.g. Specialty in Biryani, Part-time"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-purple-800/40">
                  <button
                    type="button"
                    onClick={() => setShowAddStaffModal(false)}
                    className="px-4 py-2 rounded-xl bg-purple-950 text-purple-300 hover:text-white text-xs font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 text-white text-xs font-bold shadow-md"
                  >
                    {editingStaff ? "Update Staff" : "Add Staff"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: Record Payment / Advance */}
        {showPaymentModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
            <div className="w-full max-w-md rounded-2xl bg-[#200a36] border border-emerald-700/60 p-6 shadow-2xl">
              <div className="flex items-center justify-between pb-3 border-b border-purple-800/40">
                <div className="flex items-center gap-2">
                  <span className="text-xl">💵</span>
                  <h3 className="text-base font-bold text-white">Record Staff Payment / Advance</h3>
                </div>
                <button
                  onClick={() => setShowPaymentModal(false)}
                  className="text-purple-400 hover:text-white text-sm"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSavePayment} className="mt-4 space-y-3.5">
                <div>
                  <label className="text-xs font-semibold text-purple-200 block mb-1">
                    Select Staff Member *
                  </label>
                  <select
                    required
                    value={paymentForm.staff_id}
                    onChange={(e) => {
                      const sid = e.target.value;
                      const st = staffList.find((s) => s.id === parseInt(sid));
                      setPaymentForm({
                        ...paymentForm,
                        staff_id: sid,
                        amount: st && st.balance > 0 ? String(st.balance) : "",
                      });
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-[#150624] border border-purple-800 text-white text-sm focus:outline-none focus:border-purple-400 font-semibold"
                  >
                    {staffList.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.kitchen_role}) - Due: ₹{Number(s.balance).toLocaleString("en-IN")}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-purple-200 block mb-1">
                      Payment Amount (₹) *
                    </label>
                    <input
                      type="number"
                      required
                      min="1"
                      step="any"
                      value={paymentForm.amount}
                      onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-[#150624] border border-emerald-600/70 text-emerald-300 text-sm font-bold focus:outline-none focus:border-emerald-400"
                      placeholder="e.g. 800"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-purple-200 block mb-1">
                      Payment Date
                    </label>
                    <input
                      type="date"
                      required
                      value={paymentForm.payment_date}
                      onChange={(e) => setPaymentForm({ ...paymentForm, payment_date: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-[#150624] border border-purple-800 text-white text-sm focus:outline-none focus:border-purple-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-purple-200 block mb-1">
                    Payment Mode
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {["Cash", "UPI", "Bank Transfer"].map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setPaymentForm({ ...paymentForm, payment_mode: mode })}
                        className={`py-1.5 rounded-xl border text-xs font-semibold transition ${
                          paymentForm.payment_mode === mode
                            ? "bg-emerald-600 text-white border-emerald-400 shadow-sm"
                            : "bg-[#150624] text-purple-300 border-purple-900"
                        }`}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-purple-200 block mb-1">
                    Payment Note / Description
                  </label>
                  <input
                    type="text"
                    value={paymentForm.note}
                    onChange={(e) => setPaymentForm({ ...paymentForm, note: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-[#150624] border border-purple-800 text-white text-sm focus:outline-none focus:border-purple-400"
                    placeholder="e.g. Daily cash wage settlement / Advance"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-purple-800/40">
                  <button
                    type="button"
                    onClick={() => setShowPaymentModal(false)}
                    className="px-4 py-2 rounded-xl bg-purple-950 text-purple-300 hover:text-white text-xs font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 text-white text-xs font-bold shadow-md"
                  >
                    Record Payment 💵
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
