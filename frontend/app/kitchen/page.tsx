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
    wage_type: "daily",
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
      const monthPayments = paymentsList.filter((p) => {
        return p.staff_id === s.id && (p.payment_date || "").startsWith(selectedMonth);
      });
      const totalPaidThisMonth = monthPayments.reduce((acc, p) => acc + Number(p.amount), 0);

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
    <main className="dashboard">
      {/* App Fixed Sidebar */}
      <AppSidebar activeRoute="/kitchen" />

      {/* Main Content with standard margin-left: 250px so sidebar never cuts off */}
      <div className="main-content">
        {/* Topbar matching app standard light theme */}
        <header className="topbar">
          <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            <MobileMenuButton />
            <h1 style={{ margin: 0, fontSize: "19px", fontWeight: 700, color: "#24103f" }}>
              🍳 Kitchen Staff & Wages
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
              {dailyStaff.length} Daily • {monthlyStaff.length} Monthly
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            {!isOwner && (
              <>
                <button
                  type="button"
                  onClick={() => openPaymentModal()}
                  style={{
                    background: "#ecfdf5",
                    color: "#047857",
                    border: "1px solid #a7f3d0",
                    borderRadius: "8px",
                    padding: "8px 14px",
                    fontWeight: 700,
                    fontSize: "12px",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                  title="Record Cash or UPI payment"
                >
                  💵 Record Payment
                </button>

                <button
                  type="button"
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
                    boxShadow: "0 4px 14px rgba(124, 58, 237, 0.3)",
                    transition: "all 0.15s ease",
                  }}
                >
                  <span>+</span> Add Staff
                </button>
              </>
            )}

            <TopbarUserBadge />
          </div>
        </header>

        {/* Page Content with Clean White / Light Theme */}
        <div className="page-content" style={{ maxWidth: "1600px", padding: "24px 32px" }}>
          <OwnerBanner />

          {/* Global Feedback Banner */}
          {saveSuccessMsg && (
            <div
              style={{
                background: "#ecfdf5",
                border: "1px solid #a7f3d0",
                color: "#065f46",
                padding: "12px 18px",
                borderRadius: "12px",
                marginBottom: "20px",
                fontSize: "14px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                fontWeight: 600,
              }}
            >
              <span>🎉 {saveSuccessMsg}</span>
              <button
                type="button"
                onClick={() => setSaveSuccessMsg(null)}
                style={{ border: "none", background: "transparent", color: "#065f46", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>
          )}

          {errorMsg && (
            <div
              style={{
                background: "#fef2f2",
                border: "1px solid #fecaca",
                color: "#991b1b",
                padding: "12px 18px",
                borderRadius: "12px",
                marginBottom: "20px",
                fontSize: "14px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                fontWeight: 600,
              }}
            >
              <span>⚠️ {errorMsg}</span>
              <button
                type="button"
                onClick={() => setErrorMsg(null)}
                style={{ border: "none", background: "transparent", color: "#991b1b", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>
          )}

          {/* Top Summary Metric Cards (Clean White Theme) */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
              gap: "16px",
              marginBottom: "24px",
            }}
          >
            {/* Card 1: Today's Working Staff */}
            <div
              style={{
                background: "#ffffff",
                border: "1px solid #e9e3f3",
                borderRadius: "16px",
                padding: "18px 20px",
                boxShadow: "0 2px 8px rgba(30, 8, 54, 0.04)",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                height: "115px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "12px", color: "#6b5b7e", fontWeight: 600 }}>Working Today</span>
                <span style={{ fontSize: "14px" }}>🟢</span>
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
                <span style={{ fontSize: "28px", fontWeight: 800, color: "#24103f", letterSpacing: "-0.5px" }}>
                  {dailySheetTotals.presentCount}
                </span>
                <span style={{ fontSize: "12px", color: "#8a7b9b", fontWeight: 600 }}>
                  / {dailyStaff.length} Daily Staff
                </span>
              </div>
              <div style={{ fontSize: "11px", color: "#8a7b9b" }}>
                {dailySheetTotals.absentCount > 0 ? `${dailySheetTotals.absentCount} marked absent today` : "Full attendance today"}
              </div>
            </div>

            {/* Card 2: Today's Total Wages */}
            <div
              style={{
                background: "#ffffff",
                border: "1px solid #e9e3f3",
                borderRadius: "16px",
                padding: "18px 20px",
                boxShadow: "0 2px 8px rgba(30, 8, 54, 0.04)",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                height: "115px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "12px", color: "#6b5b7e", fontWeight: 600 }}>Today's Wages Total</span>
                <span style={{ fontSize: "14px" }}>💰</span>
              </div>
              <div>
                <span style={{ fontSize: "28px", fontWeight: 800, color: "#b45309", letterSpacing: "-0.5px" }}>
                  ₹{dailySheetTotals.totalWagesToday.toLocaleString("en-IN")}
                </span>
              </div>
              <div style={{ fontSize: "11px", color: "#6b5b7e", display: "flex", justifyContent: "space-between" }}>
                <span>Paid: ₹{dailySheetTotals.totalPaidToday.toLocaleString("en-IN")}</span>
                <span style={{ fontWeight: 700, color: "#b45309" }}>Due: ₹{dailySheetTotals.pendingToday.toLocaleString("en-IN")}</span>
              </div>
            </div>

            {/* Card 3: Monthly Staff */}
            <div
              style={{
                background: "#ffffff",
                border: "1px solid #e9e3f3",
                borderRadius: "16px",
                padding: "18px 20px",
                boxShadow: "0 2px 8px rgba(30, 8, 54, 0.04)",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                height: "115px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "12px", color: "#6b5b7e", fontWeight: 600 }}>Monthly Salaried</span>
                <span style={{ fontSize: "14px" }}>💼</span>
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
                <span style={{ fontSize: "28px", fontWeight: 800, color: "#4338ca", letterSpacing: "-0.5px" }}>
                  {monthlyStaff.length}
                </span>
                <span style={{ fontSize: "12px", color: "#8a7b9b", fontWeight: 600 }}>Active</span>
              </div>
              <div style={{ fontSize: "11px", color: "#8a7b9b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {monthlyStaff.length > 0 ? monthlyStaff.map((m) => m.name).join(", ") : "No monthly staff"}
              </div>
            </div>

            {/* Card 4: Total Pending Balances */}
            <div
              style={{
                background: "#ffffff",
                border: "1px solid #e9e3f3",
                borderRadius: "16px",
                padding: "18px 20px",
                boxShadow: "0 2px 8px rgba(30, 8, 54, 0.04)",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                height: "115px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "12px", color: "#6b5b7e", fontWeight: 600 }}>Total Balance Due</span>
                <span style={{ fontSize: "14px" }}>⏳</span>
              </div>
              <div>
                <span style={{ fontSize: "28px", fontWeight: 800, color: "#be123c", letterSpacing: "-0.5px" }}>
                  ₹{(summary?.total_pending_balance || 0).toLocaleString("en-IN")}
                </span>
              </div>
              <div style={{ fontSize: "11px", color: "#8a7b9b" }}>
                Accrued wage balance across all staff
              </div>
            </div>
          </div>

          {/* View Switcher Tabs (White Pill Style) */}
          <div style={{ marginBottom: "20px" }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                background: "#ffffff",
                padding: "4px",
                borderRadius: "12px",
                border: "1px solid #e9e3f3",
                boxShadow: "0 1px 4px rgba(30, 8, 54, 0.04)",
              }}
            >
              <button
                type="button"
                onClick={() => setActiveTab("daily")}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "8px 16px",
                  borderRadius: "10px",
                  fontSize: "13px",
                  fontWeight: 700,
                  cursor: "pointer",
                  border: "none",
                  transition: "all 0.15s ease",
                  background: activeTab === "daily" ? "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)" : "transparent",
                  color: activeTab === "daily" ? "#ffffff" : "#6b5b7e",
                  boxShadow: activeTab === "daily" ? "0 2px 8px rgba(124, 58, 237, 0.25)" : "none",
                }}
              >
                <span>📅</span>
                <span>Daily Wages Entry</span>
                <span
                  style={{
                    padding: "2px 6px",
                    borderRadius: "10px",
                    fontSize: "10px",
                    background: activeTab === "daily" ? "rgba(255,255,255,0.25)" : "#ede9fe",
                    color: activeTab === "daily" ? "#ffffff" : "#6d28d9",
                  }}
                >
                  {dailyStaff.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("monthly")}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "8px 16px",
                  borderRadius: "10px",
                  fontSize: "13px",
                  fontWeight: 700,
                  cursor: "pointer",
                  border: "none",
                  transition: "all 0.15s ease",
                  background: activeTab === "monthly" ? "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)" : "transparent",
                  color: activeTab === "monthly" ? "#ffffff" : "#6b5b7e",
                  boxShadow: activeTab === "monthly" ? "0 2px 8px rgba(124, 58, 237, 0.25)" : "none",
                }}
              >
                <span>💼</span>
                <span>Monthly Staff</span>
                <span
                  style={{
                    padding: "2px 6px",
                    borderRadius: "10px",
                    fontSize: "10px",
                    background: activeTab === "monthly" ? "rgba(255,255,255,0.25)" : "#ede9fe",
                    color: activeTab === "monthly" ? "#ffffff" : "#6d28d9",
                  }}
                >
                  {monthlyStaff.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("staff")}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "8px 16px",
                  borderRadius: "10px",
                  fontSize: "13px",
                  fontWeight: 700,
                  cursor: "pointer",
                  border: "none",
                  transition: "all 0.15s ease",
                  background: activeTab === "staff" ? "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)" : "transparent",
                  color: activeTab === "staff" ? "#ffffff" : "#6b5b7e",
                  boxShadow: activeTab === "staff" ? "0 2px 8px rgba(124, 58, 237, 0.25)" : "none",
                }}
              >
                <span>👥</span>
                <span>Staff & Balances</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("payments")}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "8px 16px",
                  borderRadius: "10px",
                  fontSize: "13px",
                  fontWeight: 700,
                  cursor: "pointer",
                  border: "none",
                  transition: "all 0.15s ease",
                  background: activeTab === "payments" ? "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)" : "transparent",
                  color: activeTab === "payments" ? "#ffffff" : "#6b5b7e",
                  boxShadow: activeTab === "payments" ? "0 2px 8px rgba(124, 58, 237, 0.25)" : "none",
                }}
              >
                <span>🧾</span>
                <span>Payment History</span>
              </button>
            </div>
          </div>

          {/* TAB 1: DAILY WAGES ENTRY (HERO WORKSPACE ON WHITE BG) */}
          {activeTab === "daily" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              {/* Date Navigator Banner (Crisp White Card) */}
              <div
                style={{
                  background: "#ffffff",
                  border: "1px solid #e9e3f3",
                  borderRadius: "16px",
                  padding: "16px 20px",
                  boxShadow: "0 2px 8px rgba(30, 8, 54, 0.04)",
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "14px",
                }}
              >
                {/* Left side: Date navigation */}
                <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                      background: "#f5f3ff",
                      padding: "4px",
                      borderRadius: "10px",
                      border: "1px solid #e9e3f3",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => changeDateBy(-1)}
                      style={{
                        padding: "6px 12px",
                        borderRadius: "8px",
                        border: "none",
                        background: "#ffffff",
                        color: "#6d28d9",
                        fontWeight: 700,
                        fontSize: "12px",
                        cursor: "pointer",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                      }}
                      title="Previous Day"
                    >
                      ◀ Prev
                    </button>
                    <button
                      type="button"
                      onClick={setDateToday}
                      style={{
                        padding: "6px 12px",
                        borderRadius: "8px",
                        border: "none",
                        background: "#ede9fe",
                        color: "#5b21b6",
                        fontWeight: 800,
                        fontSize: "12px",
                        cursor: "pointer",
                      }}
                    >
                      Today
                    </button>
                    <button
                      type="button"
                      onClick={() => changeDateBy(1)}
                      style={{
                        padding: "6px 12px",
                        borderRadius: "8px",
                        border: "none",
                        background: "#ffffff",
                        color: "#6d28d9",
                        fontWeight: 700,
                        fontSize: "12px",
                        cursor: "pointer",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                      }}
                      title="Next Day"
                    >
                      Next ▶
                    </button>
                  </div>

                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    style={{
                      height: "36px",
                      padding: "0 12px",
                      borderRadius: "10px",
                      border: "1px solid #d8b4fe",
                      background: "#ffffff",
                      color: "#24103f",
                      fontWeight: 700,
                      fontSize: "13px",
                      outline: "none",
                    }}
                  />

                  <span
                    style={{
                      background: "#f5f3ff",
                      color: "#6d28d9",
                      padding: "6px 12px",
                      borderRadius: "10px",
                      fontWeight: 700,
                      fontSize: "13px",
                      border: "1px solid #ede9fe",
                    }}
                  >
                    {formattedDateTitle}
                  </span>
                </div>

                {/* Right side: Quick Roster Actions & Save Button */}
                <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={() => setAllDailyStatus("present")}
                    style={{
                      height: "36px",
                      padding: "0 14px",
                      borderRadius: "10px",
                      border: "1px solid #a7f3d0",
                      background: "#ecfdf5",
                      color: "#047857",
                      fontWeight: 700,
                      fontSize: "12px",
                      cursor: "pointer",
                    }}
                  >
                    ✓ All Present
                  </button>

                  <button
                    type="button"
                    onClick={() => setAllDailyStatus("absent")}
                    style={{
                      height: "36px",
                      padding: "0 14px",
                      borderRadius: "10px",
                      border: "1px solid #fecaca",
                      background: "#fef2f2",
                      color: "#b91c1c",
                      fontWeight: 700,
                      fontSize: "12px",
                      cursor: "pointer",
                    }}
                  >
                    ✗ All Absent
                  </button>

                  <button
                    type="button"
                    onClick={handleSaveDailyWages}
                    disabled={savingDaily}
                    style={{
                      height: "36px",
                      padding: "0 18px",
                      borderRadius: "10px",
                      border: "none",
                      background: "linear-gradient(135deg, #059669 0%, #047857 100%)",
                      color: "#ffffff",
                      fontWeight: 700,
                      fontSize: "13px",
                      cursor: "pointer",
                      boxShadow: "0 4px 12px rgba(5, 150, 105, 0.25)",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    <span>💾</span>
                    <span>{savingDaily ? "Saving..." : "Save Today's Wages"}</span>
                  </button>
                </div>
              </div>

              {/* Instruction Tip */}
              <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", color: "#6b5b7e" }}>
                <span style={{ color: "#d97706", fontWeight: 700 }}>💡 Tip:</span>
                <span>
                  Wages change every day. Simply type today's exact rupee amount for each worker, or check "Paid Cash" if handed out.
                </span>
              </div>

              {/* Section 1: Daily Working Staff Table (White Theme with Crisp Grid) */}
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 4px" }}>
                  <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "#24103f" }}>
                    🔪 Daily Working Staff ({dailyStaff.length})
                  </h2>
                  <span style={{ fontSize: "13px", color: "#6b5b7e" }}>
                    Total Day Wage:{" "}
                    <strong style={{ color: "#b45309", fontWeight: 800 }}>
                      ₹{dailySheetTotals.totalWagesToday.toLocaleString("en-IN")}
                    </strong>
                  </span>
                </div>

                {dailyStaff.length === 0 ? (
                  <div
                    style={{
                      background: "#ffffff",
                      borderRadius: "16px",
                      border: "1px solid #e9e3f3",
                      padding: "40px",
                      textAlign: "center",
                    }}
                  >
                    <p style={{ color: "#8a7b9b", fontSize: "14px", margin: 0 }}>No daily wage staff found.</p>
                    <button
                      type="button"
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
                      style={{
                        marginTop: "12px",
                        padding: "8px 16px",
                        background: "#7c3aed",
                        color: "#fff",
                        borderRadius: "8px",
                        border: "none",
                        fontWeight: 700,
                        fontSize: "12px",
                        cursor: "pointer",
                      }}
                    >
                      + Add Daily Staff
                    </button>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    {/* Header Row on Desktop */}
                    <div
                      className="hidden md:grid"
                      style={{
                        gridTemplateColumns: "3fr 3fr 2fr 2fr 2fr",
                        gap: "14px",
                        padding: "0 18px",
                        fontSize: "11px",
                        fontWeight: 700,
                        color: "#8a7b9b",
                        textTransform: "uppercase",
                        letterSpacing: "0.5px",
                      }}
                    >
                      <div>Staff Member</div>
                      <div style={{ textAlign: "center" }}>Attendance</div>
                      <div style={{ textAlign: "center" }}>Today's Wage (₹)</div>
                      <div style={{ textAlign: "center" }}>Payment Status</div>
                      <div>Note / Shift</div>
                    </div>

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
                          style={{
                            background: isAbsent ? "#f8fafc" : "#ffffff",
                            border: isAbsent
                              ? "1px solid #e2e8f0"
                              : isHalf
                              ? "1px solid #fde68a"
                              : "1px solid #e9e3f3",
                            borderRadius: "16px",
                            padding: "16px 18px",
                            boxShadow: "0 1px 4px rgba(30, 8, 54, 0.03)",
                            opacity: isAbsent ? 0.65 : 1,
                            transition: "all 0.15s ease",
                          }}
                        >
                          {/* Desktop Grid (md+) */}
                          <div
                            className="hidden md:grid"
                            style={{
                              gridTemplateColumns: "3fr 3fr 2fr 2fr 2fr",
                              gap: "14px",
                              alignItems: "center",
                            }}
                          >
                            {/* Col 1: Staff Info */}
                            <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0 }}>
                              <div
                                style={{
                                  width: "40px",
                                  height: "40px",
                                  borderRadius: "10px",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  fontWeight: 800,
                                  fontSize: "14px",
                                  flexShrink: 0,
                                  background: isAbsent ? "#f1f5f9" : isHalf ? "#fef3c7" : "#ede9fe",
                                  color: isAbsent ? "#64748b" : isHalf ? "#b45309" : "#6d28d9",
                                  border: isAbsent ? "1px solid #cbd5e1" : isHalf ? "1px solid #fcd34d" : "1px solid #ddd6fe",
                                }}
                              >
                                {staff.name.slice(0, 2).toUpperCase()}
                              </div>

                              <div style={{ minWidth: 0, flex: 1 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                                  <span style={{ fontWeight: 800, fontSize: "14px", color: "#1e0836" }}>
                                    {staff.name}
                                  </span>
                                  <span
                                    style={{
                                      fontSize: "10px",
                                      fontWeight: 600,
                                      padding: "2px 6px",
                                      borderRadius: "6px",
                                      background: "#f5f3ff",
                                      color: "#6d28d9",
                                      border: "1px solid #ede9fe",
                                    }}
                                  >
                                    {staff.kitchen_role}
                                  </span>
                                </div>
                                <div style={{ fontSize: "12px", color: "#6b5b7e", marginTop: "2px", display: "flex", gap: "6px" }}>
                                  <span>Base: ₹{Number(staff.wage_rate).toLocaleString("en-IN")}</span>
                                  <span>•</span>
                                  <button
                                    type="button"
                                    onClick={() => openPaymentModal(staff)}
                                    style={{
                                      border: "none",
                                      background: "transparent",
                                      padding: 0,
                                      cursor: "pointer",
                                      fontWeight: 700,
                                      color: staff.balance > 0 ? "#b45309" : "#059669",
                                      textDecoration: "underline",
                                      fontSize: "12px",
                                    }}
                                    title="Click to settle balance"
                                  >
                                    Due: ₹{Number(staff.balance).toLocaleString("en-IN")}
                                  </button>
                                </div>
                              </div>
                            </div>

                            {/* Col 2: Attendance Toggle */}
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
                              <button
                                type="button"
                                onClick={() => handleDailyStatusChange(staff.id, "present")}
                                style={{
                                  height: "36px",
                                  padding: "0 12px",
                                  borderRadius: "10px",
                                  fontSize: "12px",
                                  fontWeight: 700,
                                  cursor: "pointer",
                                  transition: "all 0.15s ease",
                                  border: isPresent ? "none" : "1px solid #e2e8f0",
                                  background: isPresent ? "#059669" : "#ffffff",
                                  color: isPresent ? "#ffffff" : "#475569",
                                  boxShadow: isPresent ? "0 2px 6px rgba(5, 150, 105, 0.25)" : "none",
                                }}
                              >
                                <span>🟢 Present</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleDailyStatusChange(staff.id, "half")}
                                style={{
                                  height: "36px",
                                  padding: "0 10px",
                                  borderRadius: "10px",
                                  fontSize: "12px",
                                  fontWeight: 700,
                                  cursor: "pointer",
                                  transition: "all 0.15s ease",
                                  border: isHalf ? "none" : "1px solid #e2e8f0",
                                  background: isHalf ? "#f59e0b" : "#ffffff",
                                  color: isHalf ? "#ffffff" : "#475569",
                                  boxShadow: isHalf ? "0 2px 6px rgba(245, 158, 11, 0.25)" : "none",
                                }}
                              >
                                <span>🟡 Half</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleDailyStatusChange(staff.id, "absent")}
                                style={{
                                  height: "36px",
                                  padding: "0 10px",
                                  borderRadius: "10px",
                                  fontSize: "12px",
                                  fontWeight: 700,
                                  cursor: "pointer",
                                  transition: "all 0.15s ease",
                                  border: isAbsent ? "none" : "1px solid #e2e8f0",
                                  background: isAbsent ? "#e11d48" : "#ffffff",
                                  color: isAbsent ? "#ffffff" : "#475569",
                                  boxShadow: isAbsent ? "0 2px 6px rgba(225, 29, 72, 0.25)" : "none",
                                }}
                              >
                                <span>🔴 Absent</span>
                              </button>
                            </div>

                            {/* Col 3: Today's Wage Input */}
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                              <div style={{ position: "relative", width: "130px" }}>
                                <span
                                  style={{
                                    position: "absolute",
                                    left: "10px",
                                    top: "9px",
                                    fontSize: "13px",
                                    fontWeight: 700,
                                    color: "#8a7b9b",
                                    pointerEvents: "none",
                                  }}
                                >
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
                                  style={{
                                    width: "100%",
                                    height: "36px",
                                    paddingLeft: "26px",
                                    paddingRight: "10px",
                                    borderRadius: "10px",
                                    border: isAbsent ? "1px solid #e2e8f0" : "1px solid #d8b4fe",
                                    background: isAbsent ? "#f1f5f9" : "#ffffff",
                                    color: isAbsent ? "#94a3b8" : "#1e0836",
                                    fontWeight: 800,
                                    fontSize: "14px",
                                    textAlign: "right",
                                    outline: "none",
                                  }}
                                  placeholder="0"
                                />
                              </div>
                            </div>

                            {/* Col 4: Payment Status Checkbox */}
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                              <label
                                style={{
                                  height: "36px",
                                  padding: "0 12px",
                                  borderRadius: "10px",
                                  border: row.paid_today ? "1px solid #a7f3d0" : "1px solid #e2e8f0",
                                  background: row.paid_today ? "#ecfdf5" : "#ffffff",
                                  color: row.paid_today ? "#047857" : "#64748b",
                                  fontWeight: 700,
                                  fontSize: "12px",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "8px",
                                  cursor: isAbsent ? "not-allowed" : "pointer",
                                  userSelect: "none",
                                }}
                              >
                                <input
                                  type="checkbox"
                                  disabled={isAbsent}
                                  checked={row.paid_today}
                                  onChange={(e) => {
                                    updateDailyRow(staff.id, { paid_today: e.target.checked });
                                  }}
                                  style={{ accentColor: "#059669", cursor: "pointer" }}
                                />
                                <span>💵 {row.paid_today ? "Paid Cash" : "Pending"}</span>
                              </label>
                            </div>

                            {/* Col 5: Note Input */}
                            <div>
                              <input
                                type="text"
                                value={row.note}
                                onChange={(e) => updateDailyRow(staff.id, { note: e.target.value })}
                                placeholder="Note (e.g. bonus)"
                                style={{
                                  width: "100%",
                                  height: "36px",
                                  padding: "0 12px",
                                  borderRadius: "10px",
                                  border: "1px solid #e2e8f0",
                                  background: "#ffffff",
                                  color: "#24103f",
                                  fontSize: "12px",
                                  outline: "none",
                                }}
                              />
                            </div>
                          </div>

                          {/* Mobile View (< md) */}
                          <div className="md:hidden" style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                <div
                                  style={{
                                    width: "36px",
                                    height: "36px",
                                    borderRadius: "8px",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    fontWeight: 800,
                                    fontSize: "12px",
                                    background: isAbsent ? "#f1f5f9" : "#ede9fe",
                                    color: isAbsent ? "#64748b" : "#6d28d9",
                                  }}
                                >
                                  {staff.name.slice(0, 2).toUpperCase()}
                                </div>
                                <div>
                                  <div style={{ fontWeight: 800, fontSize: "14px", color: "#1e0836" }}>{staff.name}</div>
                                  <div style={{ fontSize: "11px", color: "#6b5b7e" }}>{staff.kitchen_role}</div>
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={() => openPaymentModal(staff)}
                                style={{
                                  border: "none",
                                  background: staff.balance > 0 ? "#fef3c7" : "#ecfdf5",
                                  color: staff.balance > 0 ? "#b45309" : "#047857",
                                  padding: "4px 8px",
                                  borderRadius: "6px",
                                  fontSize: "11px",
                                  fontWeight: 700,
                                  cursor: "pointer",
                                }}
                              >
                                Due: ₹{Number(staff.balance).toLocaleString("en-IN")}
                              </button>
                            </div>

                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "6px" }}>
                              <button
                                type="button"
                                onClick={() => handleDailyStatusChange(staff.id, "present")}
                                style={{
                                  height: "32px",
                                  borderRadius: "8px",
                                  border: "none",
                                  fontSize: "11px",
                                  fontWeight: 700,
                                  background: isPresent ? "#059669" : "#f1f5f9",
                                  color: isPresent ? "#fff" : "#475569",
                                }}
                              >
                                🟢 Present
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDailyStatusChange(staff.id, "half")}
                                style={{
                                  height: "32px",
                                  borderRadius: "8px",
                                  border: "none",
                                  fontSize: "11px",
                                  fontWeight: 700,
                                  background: isHalf ? "#f59e0b" : "#f1f5f9",
                                  color: isHalf ? "#fff" : "#475569",
                                }}
                              >
                                🟡 Half
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDailyStatusChange(staff.id, "absent")}
                                style={{
                                  height: "32px",
                                  borderRadius: "8px",
                                  border: "none",
                                  fontSize: "11px",
                                  fontWeight: 700,
                                  background: isAbsent ? "#e11d48" : "#f1f5f9",
                                  color: isAbsent ? "#fff" : "#475569",
                                }}
                              >
                                🔴 Absent
                              </button>
                            </div>

                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", alignItems: "center" }}>
                              <div style={{ position: "relative" }}>
                                <span style={{ position: "absolute", left: "8px", top: "7px", fontSize: "12px", color: "#8a7b9b" }}>₹</span>
                                <input
                                  type="number"
                                  disabled={isAbsent}
                                  value={row.today_wage}
                                  onChange={(e) => updateDailyRow(staff.id, { today_wage: parseFloat(e.target.value) || 0 })}
                                  style={{
                                    width: "100%",
                                    height: "32px",
                                    paddingLeft: "20px",
                                    paddingRight: "8px",
                                    borderRadius: "8px",
                                    border: "1px solid #d8b4fe",
                                    fontWeight: 800,
                                    fontSize: "13px",
                                    textAlign: "right",
                                  }}
                                />
                              </div>

                              <label
                                style={{
                                  height: "32px",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "6px",
                                  borderRadius: "8px",
                                  padding: "0 10px",
                                  background: row.paid_today ? "#ecfdf5" : "#f8fafc",
                                  border: row.paid_today ? "1px solid #a7f3d0" : "1px solid #e2e8f0",
                                  fontSize: "11px",
                                  fontWeight: 700,
                                  color: row.paid_today ? "#047857" : "#475569",
                                }}
                              >
                                <input
                                  type="checkbox"
                                  disabled={isAbsent}
                                  checked={row.paid_today}
                                  onChange={(e) => updateDailyRow(staff.id, { paid_today: e.target.checked })}
                                />
                                <span>💵 {row.paid_today ? "Paid Cash" : "Pending"}</span>
                              </label>
                            </div>

                            <input
                              type="text"
                              value={row.note}
                              onChange={(e) => updateDailyRow(staff.id, { note: e.target.value })}
                              placeholder="Note (optional)"
                              style={{
                                height: "30px",
                                padding: "0 8px",
                                borderRadius: "6px",
                                border: "1px solid #e2e8f0",
                                fontSize: "11px",
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Section 2: Monthly Staff Attendance (Separated Card on White BG) */}
              {monthlyStaff.length > 0 && (
                <div
                  style={{
                    background: "#ffffff",
                    border: "1px solid #e9e3f3",
                    borderRadius: "16px",
                    padding: "18px 20px",
                    boxShadow: "0 2px 8px rgba(30, 8, 54, 0.04)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "#24103f" }}>
                        💼 Monthly Staff Attendance Today ({monthlyStaff.length})
                      </h3>
                      <p style={{ margin: "2px 0 0 0", fontSize: "11px", color: "#6b5b7e" }}>
                        Fixed monthly salary staff — mark daily presence here. Daily wages are not deducted from salary.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setActiveTab("monthly")}
                      style={{
                        border: "none",
                        background: "transparent",
                        color: "#6d28d9",
                        fontWeight: 700,
                        fontSize: "12px",
                        cursor: "pointer",
                        textDecoration: "underline",
                      }}
                    >
                      Manage Monthly Salaries →
                    </button>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "12px" }}>
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
                          style={{
                            background: "#fdfcff",
                            border: "1px solid #ede9fe",
                            borderRadius: "14px",
                            padding: "14px 16px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: "12px",
                          }}
                        >
                          <div>
                            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                              <span style={{ fontWeight: 800, fontSize: "14px", color: "#1e0836" }}>{staff.name}</span>
                              <span
                                style={{
                                  fontSize: "10px",
                                  fontWeight: 600,
                                  padding: "2px 6px",
                                  borderRadius: "6px",
                                  background: "#e0e7ff",
                                  color: "#3730a3",
                                }}
                              >
                                {staff.kitchen_role}
                              </span>
                            </div>
                            <div style={{ fontSize: "12px", color: "#6b5b7e", marginTop: "2px" }}>
                              Salary: <strong style={{ color: "#4338ca", fontWeight: 700 }}>₹{Number(staff.wage_rate).toLocaleString("en-IN")}/mo</strong>
                            </div>
                          </div>

                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <button
                              type="button"
                              onClick={() => {
                                const newSt = isPresent ? "absent" : "present";
                                updateDailyRow(staff.id, { status: newSt, today_wage: 0 });
                              }}
                              style={{
                                height: "32px",
                                padding: "0 10px",
                                borderRadius: "8px",
                                border: isPresent ? "1px solid #a7f3d0" : "1px solid #fecaca",
                                background: isPresent ? "#ecfdf5" : "#fef2f2",
                                color: isPresent ? "#047857" : "#b91c1c",
                                fontWeight: 700,
                                fontSize: "11px",
                                cursor: "pointer",
                              }}
                            >
                              {isPresent ? "🟢 Present" : "🔴 On Leave"}
                            </button>

                            <button
                              type="button"
                              onClick={() => openPaymentModal(staff)}
                              style={{
                                height: "32px",
                                padding: "0 10px",
                                borderRadius: "8px",
                                border: "1px solid #ddd6fe",
                                background: "#f5f3ff",
                                color: "#6d28d9",
                                fontWeight: 700,
                                fontSize: "11px",
                                cursor: "pointer",
                              }}
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
              <div
                style={{
                  position: "sticky",
                  bottom: "16px",
                  zIndex: 20,
                  background: "rgba(255, 255, 255, 0.95)",
                  backdropFilter: "blur(10px)",
                  border: "1px solid #d8b4fe",
                  borderRadius: "16px",
                  padding: "14px 20px",
                  boxShadow: "0 8px 24px rgba(30, 8, 54, 0.12)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "12px",
                }}
              >
                <div style={{ fontSize: "14px", color: "#475569" }}>
                  <span>Today's Total Day Wages: </span>
                  <strong style={{ fontSize: "17px", color: "#1e0836", fontWeight: 800 }}>
                    ₹{dailySheetTotals.totalWagesToday.toLocaleString("en-IN")}
                  </strong>
                  <span style={{ fontSize: "12px", color: "#8a7b9b", marginLeft: "8px" }}>
                    ({dailySheetTotals.presentCount} present, {dailySheetTotals.absentCount} absent)
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleSaveDailyWages}
                  disabled={savingDaily}
                  style={{
                    height: "40px",
                    padding: "0 22px",
                    borderRadius: "10px",
                    border: "none",
                    background: "linear-gradient(135deg, #059669 0%, #047857 100%)",
                    color: "#ffffff",
                    fontWeight: 700,
                    fontSize: "13px",
                    cursor: "pointer",
                    boxShadow: "0 4px 14px rgba(5, 150, 105, 0.3)",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <span>💾</span>
                  <span>{savingDaily ? "Saving..." : "Save Daily Wages"}</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: MONTHLY STAFF MANAGEMENT (WHITE THEME) */}
          {activeTab === "monthly" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              {/* Header / Month Filter */}
              <div
                style={{
                  background: "#ffffff",
                  border: "1px solid #e9e3f3",
                  borderRadius: "16px",
                  padding: "16px 20px",
                  boxShadow: "0 2px 8px rgba(30, 8, 54, 0.04)",
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "12px",
                }}
              >
                <div>
                  <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "#24103f" }}>
                    💼 Monthly Fixed Salary Staff
                  </h2>
                  <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#6b5b7e" }}>
                    Manage monthly salaried staff, attendance days, and salary advances.
                  </p>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <label style={{ fontSize: "12px", fontWeight: 700, color: "#6b5b7e" }}>Month:</label>
                  <input
                    type="month"
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    style={{
                      height: "36px",
                      padding: "0 12px",
                      borderRadius: "10px",
                      border: "1px solid #d8b4fe",
                      background: "#ffffff",
                      color: "#24103f",
                      fontWeight: 700,
                      fontSize: "13px",
                      outline: "none",
                    }}
                  />
                </div>
              </div>

              {monthlyStaff.length === 0 ? (
                <div
                  style={{
                    background: "#ffffff",
                    borderRadius: "16px",
                    border: "1px solid #e9e3f3",
                    padding: "40px",
                    textAlign: "center",
                  }}
                >
                  <p style={{ color: "#8a7b9b", fontSize: "14px", margin: 0 }}>No monthly salary staff configured.</p>
                  <button
                    type="button"
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
                    style={{
                      marginTop: "12px",
                      padding: "8px 16px",
                      background: "#7c3aed",
                      color: "#fff",
                      borderRadius: "8px",
                      border: "none",
                      fontWeight: 700,
                      fontSize: "12px",
                      cursor: "pointer",
                    }}
                  >
                    + Add Monthly Staff
                  </button>
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: "16px" }}>
                  {monthlyStaffMetrics.map(({ staff, salary, daysPresent, paidThisMonth, balanceDue, payments }) => (
                    <div
                      key={staff.id}
                      style={{
                        background: "#ffffff",
                        border: "1px solid #e9e3f3",
                        borderRadius: "16px",
                        padding: "20px",
                        boxShadow: "0 2px 8px rgba(30, 8, 54, 0.04)",
                        display: "flex",
                        flexDirection: "column",
                        gap: "16px",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" }}>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 800, color: "#1e0836" }}>{staff.name}</h3>
                            <span
                              style={{
                                fontSize: "11px",
                                fontWeight: 700,
                                padding: "2px 8px",
                                borderRadius: "6px",
                                background: "#e0e7ff",
                                color: "#3730a3",
                              }}
                            >
                              {staff.kitchen_role}
                            </span>
                          </div>
                          {staff.mobile && (
                            <p style={{ margin: "3px 0 0 0", fontSize: "12px", color: "#6b5b7e" }}>📞 {staff.mobile}</p>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => openPaymentModal(staff)}
                          style={{
                            padding: "6px 14px",
                            borderRadius: "8px",
                            border: "1px solid #a7f3d0",
                            background: "#ecfdf5",
                            color: "#047857",
                            fontWeight: 700,
                            fontSize: "12px",
                            cursor: "pointer",
                          }}
                        >
                          💵 Pay Advance
                        </button>
                      </div>

                      {/* 3 Metric Grid */}
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr 1fr 1fr",
                          gap: "10px",
                          background: "#f8fafc",
                          padding: "12px",
                          borderRadius: "12px",
                          border: "1px solid #f1f5f9",
                          textAlign: "center",
                        }}
                      >
                        <div>
                          <div style={{ fontSize: "10px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Fixed Salary</div>
                          <div style={{ fontSize: "15px", fontWeight: 800, color: "#1e0836", marginTop: "2px" }}>
                            ₹{salary.toLocaleString("en-IN")}
                          </div>
                        </div>

                        <div>
                          <div style={{ fontSize: "10px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Paid in {selectedMonth}</div>
                          <div style={{ fontSize: "15px", fontWeight: 800, color: "#059669", marginTop: "2px" }}>
                            ₹{paidThisMonth.toLocaleString("en-IN")}
                          </div>
                        </div>

                        <div>
                          <div style={{ fontSize: "10px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Salary Due</div>
                          <div style={{ fontSize: "15px", fontWeight: 800, color: "#b45309", marginTop: "2px" }}>
                            ₹{balanceDue.toLocaleString("en-IN")}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "12px" }}>
                        <span style={{ color: "#6b5b7e" }}>
                          Attendance: <strong style={{ color: "#1e0836" }}>{daysPresent} days present</strong>
                        </span>
                        <button
                          type="button"
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
                          style={{
                            border: "none",
                            background: "transparent",
                            color: "#7c3aed",
                            fontWeight: 700,
                            cursor: "pointer",
                            textDecoration: "underline",
                            fontSize: "11px",
                          }}
                        >
                          Edit Staff Info
                        </button>
                      </div>

                      {payments.length > 0 && (
                        <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: "10px", display: "flex", flexDirection: "column", gap: "6px" }}>
                          <span style={{ fontSize: "10px", fontWeight: 700, color: "#8a7b9b", textTransform: "uppercase" }}>
                            Recent payments this month
                          </span>
                          {payments.slice(0, 3).map((p) => (
                            <div
                              key={p.id}
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                fontSize: "12px",
                                background: "#f8fafc",
                                padding: "6px 10px",
                                borderRadius: "8px",
                              }}
                            >
                              <span style={{ color: "#64748b" }}>{p.payment_date} ({p.payment_mode})</span>
                              <strong style={{ color: "#059669" }}>₹{Number(p.amount).toLocaleString("en-IN")}</strong>
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

          {/* TAB 3: ALL STAFF & BALANCES (DIRECTORY ON WHITE BG) */}
          {activeTab === "staff" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              {/* Search and Filters */}
              <div
                style={{
                  background: "#ffffff",
                  border: "1px solid #e9e3f3",
                  borderRadius: "16px",
                  padding: "16px 20px",
                  boxShadow: "0 2px 8px rgba(30, 8, 54, 0.04)",
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "12px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px", flex: 1, maxWidth: "400px" }}>
                  <span style={{ color: "#8a7b9b" }}>🔍</span>
                  <input
                    type="text"
                    placeholder="Search staff by name or role..."
                    value={searchStaff}
                    onChange={(e) => setSearchStaff(e.target.value)}
                    style={{
                      width: "100%",
                      height: "36px",
                      padding: "0 12px",
                      borderRadius: "10px",
                      border: "1px solid #e2e8f0",
                      background: "#ffffff",
                      fontSize: "13px",
                      outline: "none",
                    }}
                  />
                </div>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    background: "#f1f5f9",
                    padding: "4px",
                    borderRadius: "10px",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setStaffFilter("all")}
                    style={{
                      padding: "6px 12px",
                      borderRadius: "8px",
                      border: "none",
                      fontSize: "12px",
                      fontWeight: 700,
                      cursor: "pointer",
                      background: staffFilter === "all" ? "#7c3aed" : "transparent",
                      color: staffFilter === "all" ? "#fff" : "#475569",
                    }}
                  >
                    All ({staffList.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setStaffFilter("daily")}
                    style={{
                      padding: "6px 12px",
                      borderRadius: "8px",
                      border: "none",
                      fontSize: "12px",
                      fontWeight: 700,
                      cursor: "pointer",
                      background: staffFilter === "daily" ? "#7c3aed" : "transparent",
                      color: staffFilter === "daily" ? "#fff" : "#475569",
                    }}
                  >
                    Daily Staff ({dailyStaff.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setStaffFilter("monthly")}
                    style={{
                      padding: "6px 12px",
                      borderRadius: "8px",
                      border: "none",
                      fontSize: "12px",
                      fontWeight: 700,
                      cursor: "pointer",
                      background: staffFilter === "monthly" ? "#7c3aed" : "transparent",
                      color: staffFilter === "monthly" ? "#fff" : "#475569",
                    }}
                  >
                    Monthly Staff ({monthlyStaff.length})
                  </button>
                </div>
              </div>

              {/* Staff Table */}
              <div
                style={{
                  background: "#ffffff",
                  borderRadius: "16px",
                  border: "1px solid #e9e3f3",
                  boxShadow: "0 2px 8px rgba(30, 8, 54, 0.04)",
                  overflowX: "auto",
                }}
              >
                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "13px" }}>
                  <thead style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                    <tr>
                      <th style={{ padding: "14px 18px", fontWeight: 700, color: "#64748b", fontSize: "11px", textTransform: "uppercase" }}>Staff Member</th>
                      <th style={{ padding: "14px 14px", fontWeight: 700, color: "#64748b", fontSize: "11px", textTransform: "uppercase" }}>Role</th>
                      <th style={{ padding: "14px 14px", fontWeight: 700, color: "#64748b", fontSize: "11px", textTransform: "uppercase" }}>Type</th>
                      <th style={{ padding: "14px 14px", fontWeight: 700, color: "#64748b", fontSize: "11px", textTransform: "uppercase", textAlign: "right" }}>Rate / Salary</th>
                      <th style={{ padding: "14px 14px", fontWeight: 700, color: "#64748b", fontSize: "11px", textTransform: "uppercase", textAlign: "right" }}>Total Accrued</th>
                      <th style={{ padding: "14px 14px", fontWeight: 700, color: "#64748b", fontSize: "11px", textTransform: "uppercase", textAlign: "right" }}>Total Paid</th>
                      <th style={{ padding: "14px 14px", fontWeight: 700, color: "#64748b", fontSize: "11px", textTransform: "uppercase", textAlign: "right" }}>Pending Due</th>
                      <th style={{ padding: "14px 18px", fontWeight: 700, color: "#64748b", fontSize: "11px", textTransform: "uppercase", textAlign: "center" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStaffList.length === 0 ? (
                      <tr>
                        <td colSpan={8} style={{ padding: "30px", textAlign: "center", color: "#8a7b9b" }}>
                          No staff members found matching criteria.
                        </td>
                      </tr>
                    ) : (
                      filteredStaffList.map((s) => (
                        <tr key={s.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                          <td style={{ padding: "14px 18px" }}>
                            <div style={{ fontWeight: 800, color: "#1e0836" }}>{s.name}</div>
                            {s.mobile && (
                              <div style={{ fontSize: "11px", color: "#8a7b9b" }}>{s.mobile}</div>
                            )}
                          </td>
                          <td style={{ padding: "14px 14px", color: "#475569" }}>{s.kitchen_role}</td>
                          <td style={{ padding: "14px 14px" }}>
                            <span
                              style={{
                                fontSize: "10px",
                                fontWeight: 700,
                                textTransform: "uppercase",
                                padding: "2px 8px",
                                borderRadius: "6px",
                                background: s.wage_type === "monthly" ? "#e0e7ff" : "#fef3c7",
                                color: s.wage_type === "monthly" ? "#3730a3" : "#b45309",
                              }}
                            >
                              {s.wage_type}
                            </span>
                          </td>
                          <td style={{ padding: "14px 14px", textAlign: "right", fontWeight: 700, color: "#1e0836" }}>
                            ₹{Number(s.wage_rate).toLocaleString("en-IN")}
                            <span style={{ fontSize: "10px", color: "#8a7b9b", display: "block", fontWeight: 500 }}>
                              {s.wage_type === "monthly" ? "/month" : "/day"}
                            </span>
                          </td>
                          <td style={{ padding: "14px 14px", textAlign: "right", fontWeight: 700, color: "#1e0836" }}>
                            ₹{Number(s.total_wages).toLocaleString("en-IN")}
                          </td>
                          <td style={{ padding: "14px 14px", textAlign: "right", fontWeight: 700, color: "#059669" }}>
                            ₹{Number(s.total_paid).toLocaleString("en-IN")}
                          </td>
                          <td style={{ padding: "14px 14px", textAlign: "right" }}>
                            <span
                              style={{
                                fontWeight: 800,
                                padding: "3px 8px",
                                borderRadius: "6px",
                                background: s.balance > 0 ? "#fef3c7" : "#ecfdf5",
                                color: s.balance > 0 ? "#b45309" : "#047857",
                              }}
                            >
                              ₹{Number(s.balance).toLocaleString("en-IN")}
                            </span>
                          </td>
                          <td style={{ padding: "14px 18px", textAlign: "center" }}>
                            <div style={{ display: "inline-flex", gap: "6px" }}>
                              <button
                                type="button"
                                onClick={() => openPaymentModal(s)}
                                style={{
                                  padding: "4px 10px",
                                  borderRadius: "6px",
                                  border: "1px solid #a7f3d0",
                                  background: "#ecfdf5",
                                  color: "#047857",
                                  fontWeight: 700,
                                  fontSize: "11px",
                                  cursor: "pointer",
                                }}
                              >
                                Pay 💵
                              </button>
                              <button
                                type="button"
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
                                style={{
                                  padding: "4px 8px",
                                  borderRadius: "6px",
                                  border: "1px solid #e2e8f0",
                                  background: "#ffffff",
                                  cursor: "pointer",
                                  fontSize: "11px",
                                }}
                              >
                                ✏️
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteStaff(s.id, s.name)}
                                style={{
                                  padding: "4px 8px",
                                  borderRadius: "6px",
                                  border: "1px solid #fecaca",
                                  background: "#fef2f2",
                                  color: "#b91c1c",
                                  cursor: "pointer",
                                  fontSize: "11px",
                                }}
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

          {/* TAB 4: PAYMENT HISTORY (WHITE THEME) */}
          {activeTab === "payments" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "#24103f" }}>
                    🧾 Kitchen Staff Payment Ledger ({paymentsList.length})
                  </h2>
                  <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#6b5b7e" }}>
                    Record of all cash payouts, UPI transfers, and advances handed to kitchen staff.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => openPaymentModal()}
                  style={{
                    padding: "8px 16px",
                    borderRadius: "8px",
                    border: "none",
                    background: "linear-gradient(135deg, #059669 0%, #047857 100%)",
                    color: "#ffffff",
                    fontWeight: 700,
                    fontSize: "12px",
                    cursor: "pointer",
                  }}
                >
                  + Record Payment
                </button>
              </div>

              <div
                style={{
                  background: "#ffffff",
                  borderRadius: "16px",
                  border: "1px solid #e9e3f3",
                  boxShadow: "0 2px 8px rgba(30, 8, 54, 0.04)",
                  overflowX: "auto",
                }}
              >
                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "13px" }}>
                  <thead style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                    <tr>
                      <th style={{ padding: "14px 18px", fontWeight: 700, color: "#64748b", fontSize: "11px", textTransform: "uppercase" }}>Date</th>
                      <th style={{ padding: "14px 18px", fontWeight: 700, color: "#64748b", fontSize: "11px", textTransform: "uppercase" }}>Staff Member</th>
                      <th style={{ padding: "14px 14px", fontWeight: 700, color: "#64748b", fontSize: "11px", textTransform: "uppercase", textAlign: "right" }}>Amount (₹)</th>
                      <th style={{ padding: "14px 14px", fontWeight: 700, color: "#64748b", fontSize: "11px", textTransform: "uppercase", textAlign: "center" }}>Mode</th>
                      <th style={{ padding: "14px 18px", fontWeight: 700, color: "#64748b", fontSize: "11px", textTransform: "uppercase" }}>Note / Reference</th>
                      <th style={{ padding: "14px 18px", fontWeight: 700, color: "#64748b", fontSize: "11px", textTransform: "uppercase", textAlign: "center" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paymentsList.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ padding: "30px", textAlign: "center", color: "#8a7b9b" }}>
                          No payments recorded yet.
                        </td>
                      </tr>
                    ) : (
                      paymentsList.map((p) => (
                        <tr key={p.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                          <td style={{ padding: "14px 18px", color: "#1e0836", fontWeight: 600 }}>{p.payment_date}</td>
                          <td style={{ padding: "14px 18px", fontWeight: 800, color: "#1e0836" }}>{p.staff_name || `Staff #${p.staff_id}`}</td>
                          <td style={{ padding: "14px 14px", textAlign: "right", fontWeight: 800, color: "#059669" }}>
                            ₹{Number(p.amount).toLocaleString("en-IN")}
                          </td>
                          <td style={{ padding: "14px 14px", textAlign: "center" }}>
                            <span
                              style={{
                                fontSize: "10px",
                                fontWeight: 700,
                                padding: "2px 8px",
                                borderRadius: "6px",
                                background: "#f1f5f9",
                                color: "#475569",
                              }}
                            >
                              {p.payment_mode}
                            </span>
                          </td>
                          <td style={{ padding: "14px 18px", color: "#64748b" }}>
                            {p.note || "-"}
                            {p.reference_no && (
                              <span style={{ fontSize: "10px", color: "#8a7b9b", display: "block" }}>Ref: {p.reference_no}</span>
                            )}
                          </td>
                          <td style={{ padding: "14px 18px", textAlign: "center" }}>
                            <button
                              type="button"
                              onClick={() => handleDeletePayment(p.id)}
                              style={{
                                padding: "4px 8px",
                                borderRadius: "6px",
                                border: "1px solid #fecaca",
                                background: "#fef2f2",
                                color: "#b91c1c",
                                cursor: "pointer",
                                fontSize: "11px",
                              }}
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
        </div>

        {/* MODAL: Add / Edit Staff (White Dialog) */}
        {showAddStaffModal && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 100,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "16px",
              background: "rgba(15, 6, 28, 0.6)",
              backdropFilter: "blur(4px)",
            }}
          >
            <div
              style={{
                width: "100%",
                maxWidth: "460px",
                background: "#ffffff",
                borderRadius: "18px",
                padding: "24px",
                boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
                border: "1px solid #e9e3f3",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: "12px", borderBottom: "1px solid #f1f5f9" }}>
                <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 800, color: "#1e0836" }}>
                  {editingStaff ? "Edit Kitchen Staff" : "Add Kitchen Staff"}
                </h3>
                <button
                  type="button"
                  onClick={() => setShowAddStaffModal(false)}
                  style={{ border: "none", background: "transparent", color: "#64748b", cursor: "pointer", fontSize: "14px" }}
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSaveStaff} style={{ marginTop: "16px", display: "flex", flexDirection: "column", gap: "14px" }}>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: 700, color: "#1e0836", display: "block", marginBottom: "4px" }}>
                    Staff Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={staffForm.name}
                    onChange={(e) => setStaffForm({ ...staffForm, name: e.target.value })}
                    style={{
                      width: "100%",
                      height: "38px",
                      padding: "0 12px",
                      borderRadius: "10px",
                      border: "1px solid #d8b4fe",
                      fontSize: "13px",
                      outline: "none",
                    }}
                    placeholder="e.g. Ramesh Kumar"
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div>
                    <label style={{ fontSize: "12px", fontWeight: 700, color: "#1e0836", display: "block", marginBottom: "4px" }}>
                      Role / Designation
                    </label>
                    <select
                      value={staffForm.kitchen_role}
                      onChange={(e) => setStaffForm({ ...staffForm, kitchen_role: e.target.value })}
                      style={{
                        width: "100%",
                        height: "38px",
                        padding: "0 10px",
                        borderRadius: "10px",
                        border: "1px solid #d8b4fe",
                        fontSize: "13px",
                        background: "#fff",
                      }}
                    >
                      {KITCHEN_ROLES.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: "12px", fontWeight: 700, color: "#1e0836", display: "block", marginBottom: "4px" }}>
                      Mobile Number
                    </label>
                    <input
                      type="tel"
                      value={staffForm.mobile}
                      onChange={(e) => setStaffForm({ ...staffForm, mobile: e.target.value })}
                      style={{
                        width: "100%",
                        height: "38px",
                        padding: "0 12px",
                        borderRadius: "10px",
                        border: "1px solid #d8b4fe",
                        fontSize: "13px",
                        outline: "none",
                      }}
                      placeholder="9876543210"
                    />
                  </div>
                </div>

                {/* Wage Type */}
                <div>
                  <label style={{ fontSize: "12px", fontWeight: 700, color: "#1e0836", display: "block", marginBottom: "6px" }}>
                    Wage Type *
                  </label>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                    <button
                      type="button"
                      onClick={() => setStaffForm({ ...staffForm, wage_type: "daily", wage_rate: "800" })}
                      style={{
                        padding: "10px",
                        borderRadius: "10px",
                        border: staffForm.wage_type === "daily" ? "2px solid #7c3aed" : "1px solid #e2e8f0",
                        background: staffForm.wage_type === "daily" ? "#f5f3ff" : "#ffffff",
                        cursor: "pointer",
                        textAlign: "center",
                      }}
                    >
                      <div style={{ fontWeight: 800, fontSize: "12px", color: staffForm.wage_type === "daily" ? "#6d28d9" : "#475569" }}>
                        🔪 Daily Wage Staff
                      </div>
                      <div style={{ fontSize: "10px", color: "#8a7b9b", marginTop: "2px" }}>Varies every day</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setStaffForm({ ...staffForm, wage_type: "monthly", wage_rate: "20000" })}
                      style={{
                        padding: "10px",
                        borderRadius: "10px",
                        border: staffForm.wage_type === "monthly" ? "2px solid #4338ca" : "1px solid #e2e8f0",
                        background: staffForm.wage_type === "monthly" ? "#e0e7ff" : "#ffffff",
                        cursor: "pointer",
                        textAlign: "center",
                      }}
                    >
                      <div style={{ fontWeight: 800, fontSize: "12px", color: staffForm.wage_type === "monthly" ? "#3730a3" : "#475569" }}>
                        💼 Monthly Salaried
                      </div>
                      <div style={{ fontSize: "10px", color: "#8a7b9b", marginTop: "2px" }}>Fixed monthly pay</div>
                    </button>
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: "12px", fontWeight: 700, color: "#1e0836", display: "block", marginBottom: "4px" }}>
                    {staffForm.wage_type === "monthly" ? "Monthly Salary (₹)" : "Default Daily Rate (₹)"}
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={staffForm.wage_rate}
                    onChange={(e) => setStaffForm({ ...staffForm, wage_rate: e.target.value })}
                    style={{
                      width: "100%",
                      height: "38px",
                      padding: "0 12px",
                      borderRadius: "10px",
                      border: "1px solid #d8b4fe",
                      fontSize: "14px",
                      fontWeight: 800,
                      color: "#1e0836",
                      outline: "none",
                    }}
                    placeholder="e.g. 800 or 20000"
                  />
                  <span style={{ fontSize: "11px", color: "#8a7b9b", marginTop: "3px", display: "block" }}>
                    {staffForm.wage_type === "monthly"
                      ? "Paid monthly. Daily attendance tracks presence without deducting daily wage."
                      : "Can be freely changed on any day when recording daily wages."}
                  </span>
                </div>

                <div>
                  <label style={{ fontSize: "12px", fontWeight: 700, color: "#1e0836", display: "block", marginBottom: "4px" }}>
                    Notes / Remarks (Optional)
                  </label>
                  <input
                    type="text"
                    value={staffForm.notes}
                    onChange={(e) => setStaffForm({ ...staffForm, notes: e.target.value })}
                    style={{
                      width: "100%",
                      height: "38px",
                      padding: "0 12px",
                      borderRadius: "10px",
                      border: "1px solid #e2e8f0",
                      fontSize: "13px",
                      outline: "none",
                    }}
                    placeholder="e.g. Specialty in Biryani"
                  />
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", paddingTop: "12px", borderTop: "1px solid #f1f5f9" }}>
                  <button
                    type="button"
                    onClick={() => setShowAddStaffModal(false)}
                    style={{
                      padding: "8px 16px",
                      borderRadius: "8px",
                      border: "1px solid #e2e8f0",
                      background: "#fff",
                      color: "#64748b",
                      fontWeight: 700,
                      fontSize: "12px",
                      cursor: "pointer",
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    style={{
                      padding: "8px 18px",
                      borderRadius: "8px",
                      border: "none",
                      background: "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)",
                      color: "#ffffff",
                      fontWeight: 700,
                      fontSize: "12px",
                      cursor: "pointer",
                      boxShadow: "0 4px 12px rgba(124, 58, 237, 0.25)",
                    }}
                  >
                    {editingStaff ? "Update Staff" : "Add Staff"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: Record Payment / Advance (White Dialog) */}
        {showPaymentModal && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 100,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "16px",
              background: "rgba(15, 6, 28, 0.6)",
              backdropFilter: "blur(4px)",
            }}
          >
            <div
              style={{
                width: "100%",
                maxWidth: "460px",
                background: "#ffffff",
                borderRadius: "18px",
                padding: "24px",
                boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
                border: "1px solid #e9e3f3",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: "12px", borderBottom: "1px solid #f1f5f9" }}>
                <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 800, color: "#1e0836", display: "flex", alignItems: "center", gap: "6px" }}>
                  <span>💵</span>
                  <span>Record Staff Payment / Advance</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  style={{ border: "none", background: "transparent", color: "#64748b", cursor: "pointer", fontSize: "14px" }}
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSavePayment} style={{ marginTop: "16px", display: "flex", flexDirection: "column", gap: "14px" }}>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: 700, color: "#1e0836", display: "block", marginBottom: "4px" }}>
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
                    style={{
                      width: "100%",
                      height: "38px",
                      padding: "0 10px",
                      borderRadius: "10px",
                      border: "1px solid #d8b4fe",
                      fontSize: "13px",
                      background: "#fff",
                      fontWeight: 700,
                    }}
                  >
                    {staffList.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.kitchen_role}) - Due: ₹{Number(s.balance).toLocaleString("en-IN")}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div>
                    <label style={{ fontSize: "12px", fontWeight: 700, color: "#1e0836", display: "block", marginBottom: "4px" }}>
                      Amount (₹) *
                    </label>
                    <input
                      type="number"
                      required
                      min="1"
                      step="any"
                      value={paymentForm.amount}
                      onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                      style={{
                        width: "100%",
                        height: "38px",
                        padding: "0 12px",
                        borderRadius: "10px",
                        border: "1px solid #a7f3d0",
                        fontSize: "14px",
                        fontWeight: 800,
                        color: "#059669",
                        outline: "none",
                      }}
                      placeholder="e.g. 800"
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: "12px", fontWeight: 700, color: "#1e0836", display: "block", marginBottom: "4px" }}>
                      Payment Date
                    </label>
                    <input
                      type="date"
                      required
                      value={paymentForm.payment_date}
                      onChange={(e) => setPaymentForm({ ...paymentForm, payment_date: e.target.value })}
                      style={{
                        width: "100%",
                        height: "38px",
                        padding: "0 10px",
                        borderRadius: "10px",
                        border: "1px solid #e2e8f0",
                        fontSize: "13px",
                        outline: "none",
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: "12px", fontWeight: 700, color: "#1e0836", display: "block", marginBottom: "6px" }}>
                    Payment Mode
                  </label>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px" }}>
                    {["Cash", "UPI", "Bank Transfer"].map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setPaymentForm({ ...paymentForm, payment_mode: mode })}
                        style={{
                          height: "36px",
                          borderRadius: "8px",
                          border: paymentForm.payment_mode === mode ? "2px solid #059669" : "1px solid #e2e8f0",
                          background: paymentForm.payment_mode === mode ? "#ecfdf5" : "#ffffff",
                          color: paymentForm.payment_mode === mode ? "#047857" : "#475569",
                          fontWeight: 700,
                          fontSize: "12px",
                          cursor: "pointer",
                        }}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: "12px", fontWeight: 700, color: "#1e0836", display: "block", marginBottom: "4px" }}>
                    Payment Note / Description
                  </label>
                  <input
                    type="text"
                    value={paymentForm.note}
                    onChange={(e) => setPaymentForm({ ...paymentForm, note: e.target.value })}
                    style={{
                      width: "100%",
                      height: "38px",
                      padding: "0 12px",
                      borderRadius: "10px",
                      border: "1px solid #e2e8f0",
                      fontSize: "13px",
                      outline: "none",
                    }}
                    placeholder="e.g. Daily cash wage settlement / Advance"
                  />
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", paddingTop: "12px", borderTop: "1px solid #f1f5f9" }}>
                  <button
                    type="button"
                    onClick={() => setShowPaymentModal(false)}
                    style={{
                      padding: "8px 16px",
                      borderRadius: "8px",
                      border: "1px solid #e2e8f0",
                      background: "#fff",
                      color: "#64748b",
                      fontWeight: 700,
                      fontSize: "12px",
                      cursor: "pointer",
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    style={{
                      padding: "8px 18px",
                      borderRadius: "8px",
                      border: "none",
                      background: "linear-gradient(135deg, #059669 0%, #047857 100%)",
                      color: "#ffffff",
                      fontWeight: 700,
                      fontSize: "12px",
                      cursor: "pointer",
                      boxShadow: "0 4px 12px rgba(5, 150, 105, 0.25)",
                    }}
                  >
                    Record Payment 💵
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
