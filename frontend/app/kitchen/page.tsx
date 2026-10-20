"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth, fetchWithAuth } from "../lib/auth";
import { exportEntireDatabaseToExcel } from "../lib/excelBackup";
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

  // Selected Staff for Details View ("Click and go to kitchen staff details page")
  const [selectedStaffId, setSelectedStaffId] = useState<number | null>(null);

  // Data states
  const [staffList, setStaffList] = useState<KitchenStaff[]>([]);
  const [dutiesList, setDutiesList] = useState<KitchenDuty[]>([]);
  const [paymentsList, setPaymentsList] = useState<KitchenPayment[]>([]);
  const [summary, setSummary] = useState<KitchenSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [exportingExcel, setExportingExcel] = useState(false);

  const handleExportKitchenExcel = async () => {
    try {
      setExportingExcel(true);
      const res = await exportEntireDatabaseToExcel();
      if (res.success) {
        setSaveSuccessMsg(`✓ Complete Excel backup downloaded successfully (${res.totalRecords} records across 11 sheets including kitchen staff).`);
        setTimeout(() => setSaveSuccessMsg(null), 5000);
      } else {
        alert("Failed to export Excel backup: " + res.error);
      }
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setExportingExcel(false);
    }
  };

  // Search & Filter
  const [searchStaff, setSearchStaff] = useState("");
  const [staffFilter, setStaffFilter] = useState<"all" | "daily" | "monthly">("all");

  // Modals
  const [showAddStaffModal, setShowAddStaffModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState<KitchenStaff | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentTargetStaff, setPaymentTargetStaff] = useState<KitchenStaff | null>(null);

  // Quick Daily Wage Entry Form ("Form" from Blueprint)
  const [showWageFormModal, setShowWageFormModal] = useState(false);
  const [wageForm, setWageForm] = useState({
    staff_id: "",
    duty_date: new Date().toISOString().split("T")[0],
    duty_status: "present", // 'present' | 'half' | 'absent'
    today_wage: "800",
    paid_today: false,
    payment_mode: "Cash",
    note: "",
  });

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
        fetchWithAuth(`${API_URL}/kitchen/duties`),
        fetchWithAuth(`${API_URL}/kitchen/payments`),
      ]);

      if (staffRes.ok) {
        setStaffList(await staffRes.json());
      }
      if (summaryRes.ok) {
        setSummary(await summaryRes.json());
      }
      if (dutiesRes.ok) {
        setDutiesList(await dutiesRes.json());
      }
      if (paymentsRes.ok) {
        setPaymentsList(await paymentsRes.json());
      }
    } catch (err: any) {
      console.error("Error loading kitchen data:", err);
      setErrorMsg(err.message || "Failed to load kitchen staff data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  // Selected Staff Details
  const selectedStaff = useMemo(() => {
    if (!selectedStaffId) return null;
    return staffList.find((s) => s.id === selectedStaffId) || null;
  }, [selectedStaffId, staffList]);

  // Selected Staff Duties / Work Days ("Show their work: Date, Wage, Payment")
  const selectedStaffDuties = useMemo(() => {
    if (!selectedStaffId) return [];
    return dutiesList
      .filter((d) => d.staff_id === selectedStaffId)
      .sort((a, b) => new Date(b.duty_date).getTime() - new Date(a.duty_date).getTime());
  }, [selectedStaffId, dutiesList]);

  // Selected Staff Payments
  const selectedStaffPayments = useMemo(() => {
    if (!selectedStaffId) return [];
    return paymentsList
      .filter((p) => p.staff_id === selectedStaffId)
      .sort((a, b) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime());
  }, [selectedStaffId, paymentsList]);

  // Metrics from blueprint
  const totalStaffCount = staffList.length;
  const totalStaffWages = summary?.total_wages || 0;
  const totalStaffPending = summary?.total_pending_balance || 0;
  const monthlySalaryTotal = useMemo(() => {
    return staffList
      .filter((s) => s.wage_type === "monthly" && s.status === "active")
      .reduce((sum, s) => sum + (Number(s.wage_rate) || 0), 0);
  }, [staffList]);

  // Filtered Staff List for Table
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

  // Open the "Form" from blueprint
  const openWageForm = (preselectedStaffId?: number) => {
    const defaultStaff = preselectedStaffId
      ? staffList.find((s) => s.id === preselectedStaffId)
      : staffList[0];

    const staffId = defaultStaff ? String(defaultStaff.id) : "";
    const defaultRate = defaultStaff
      ? defaultStaff.wage_type === "monthly"
        ? "0"
        : String(defaultStaff.wage_rate)
      : "800";

    setWageForm({
      staff_id: staffId,
      duty_date: new Date().toISOString().split("T")[0],
      duty_status: "present",
      today_wage: defaultRate,
      paid_today: false,
      payment_mode: "Cash",
      note: "",
    });
    setShowWageFormModal(true);
  };

  // Submit Daily Wage Entry Form ("Form" from Blueprint)
  const handleSubmitWageForm = async (e: FormEvent) => {
    e.preventDefault();
    if (isOwner) {
      alert("Owner accounts have view-only access.");
      return;
    }

    try {
      setErrorMsg(null);
      if (!wageForm.staff_id) {
        alert("Please select a staff member");
        return;
      }

      const wageNum = parseFloat(wageForm.today_wage) || 0;

      const res = await fetchWithAuth(`${API_URL}/kitchen/duties`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          staff_id: parseInt(wageForm.staff_id),
          duty_date: wageForm.duty_date,
          shift: "Full Day",
          duty_status: wageForm.duty_status,
          duty_units: wageForm.duty_status === "absent" ? 0 : wageForm.duty_status === "half" ? 0.5 : 1.0,
          daily_rate: wageForm.duty_status === "absent" ? 0 : wageNum,
          today_wage: wageForm.duty_status === "absent" ? 0 : wageNum,
          paid_today: wageForm.paid_today,
          paid_amount: wageForm.paid_today ? wageNum : 0,
          payment_mode: wageForm.payment_mode,
          note: wageForm.note.trim() || null,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to record wage entry");
      }

      setShowWageFormModal(false);
      setSaveSuccessMsg("✓ Wage entry recorded successfully!");
      setTimeout(() => setSaveSuccessMsg(null), 3500);
      await loadAllData();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to record wage entry");
    }
  };

  // Delete a Duty Entry from staff details history
  const handleDeleteDuty = async (dutyId: number) => {
    if (isOwner) {
      alert("Owner accounts have view-only access.");
      return;
    }
    if (!confirm("Are you sure you want to remove this day's work record?")) {
      return;
    }

    try {
      const res = await fetchWithAuth(`${API_URL}/kitchen/duties/${dutyId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to delete duty record");
      }
      await loadAllData();
    } catch (err: any) {
      alert(err.message || "Failed to delete duty record");
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
    if (!confirm(`Are you sure you want to remove ${name}? This will delete all their wage and payment history.`)) {
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
      if (selectedStaffId === staffId) {
        setSelectedStaffId(null);
      }
      await loadAllData();
    } catch (err: any) {
      alert(err.message || "Failed to delete staff");
    }
  };

  // Open Payment Modal
  const openPaymentModal = (staff?: KitchenStaff) => {
    if (staff) {
      setPaymentTargetStaff(staff);
      setPaymentForm({
        staff_id: String(staff.id),
        amount: String(staff.balance > 0 ? staff.balance : staff.wage_rate),
        payment_date: new Date().toISOString().split("T")[0],
        payment_mode: "Cash",
        reference_no: "",
        note: staff.wage_type === "monthly" ? "Monthly salary payment" : "Daily wage settlement",
      });
    } else {
      setPaymentTargetStaff(null);
      setPaymentForm({
        staff_id: staffList[0] ? String(staffList[0].id) : "",
        amount: "",
        payment_date: new Date().toISOString().split("T")[0],
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
    if (!confirm("Are you sure you want to delete this payment record?")) {
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

  return (
    <main className="dashboard">
      {/* App Fixed Sidebar */}
      <AppSidebar activeRoute="/kitchen" />

      {/* Main Content (standard margin-left: 250px so sidebar never cuts off) */}
      <div className="main-content">
        {/* Topbar */}
        <header className="topbar" style={{ minHeight: "74px", height: "auto", padding: "12px 24px", gap: "12px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
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
              {totalStaffCount} Kitchen Staff
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            {!isOwner && (
              <>
                {/* Button that opens the Blueprint's "Form" */}
                <button
                  type="button"
                  onClick={() => openWageForm(selectedStaffId || undefined)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
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
                  title="Open wage entry form"
                >
                  <span>📝</span> Add Wage Entry
                </button>

                {/* Button that adds a new staff */}
                <button
                  type="button"
                  onClick={handleExportKitchenExcel}
                  disabled={exportingExcel}
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
                    cursor: exportingExcel ? "not-allowed" : "pointer",
                    boxShadow: "0 2px 8px rgba(5, 150, 105, 0.3)",
                    transition: "all 0.15s ease",
                  }}
                  title="Download complete database as an Excel (.xlsx) spreadsheet with kitchen staff, duties & payments"
                >
                  <span>📊</span> {exportingExcel ? "Exporting..." : "Backup to Excel"}
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

        {/* Content Canvas (Clean White Background) */}
        <div className="page-content" style={{ maxWidth: "1600px", padding: "24px 28px 60px", minHeight: "calc(100vh - 74px)" }}>
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

          {/* ========================================================= */}
          {/* TOP 4 METRIC CARDS (EXACTLY FROM USER'S BLUEPRINT)         */}
          {/* Box 1: Total staff                                       */}
          {/* Box 2: Total staff wages                                 */}
          {/* Box 3: Total staff pending                               */}
          {/* Box 4: Monthly salary                                    */}
          {/* ========================================================= */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
              gap: "16px",
              marginBottom: "28px",
            }}
          >
            {/* Box 1: Total staff */}
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
                <span style={{ fontSize: "12px", color: "#6b5b7e", fontWeight: 700, textTransform: "uppercase" }}>
                  Total Staff
                </span>
                <span style={{ fontSize: "16px" }}>👥</span>
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
                <span style={{ fontSize: "30px", fontWeight: 800, color: "#24103f", letterSpacing: "-0.5px" }}>
                  {totalStaffCount}
                </span>
                <span style={{ fontSize: "12px", color: "#8a7b9b", fontWeight: 600 }}>Active Members</span>
              </div>
              <div style={{ fontSize: "11px", color: "#8a7b9b" }}>
                {staffList.filter((s) => s.wage_type === "daily").length} Daily • {staffList.filter((s) => s.wage_type === "monthly").length} Monthly
              </div>
            </div>

            {/* Box 2: Total staff wages */}
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
                <span style={{ fontSize: "12px", color: "#6b5b7e", fontWeight: 700, textTransform: "uppercase" }}>
                  Total Staff Wages
                </span>
                <span style={{ fontSize: "16px" }}>💰</span>
              </div>
              <div>
                <span style={{ fontSize: "30px", fontWeight: 800, color: "#b45309", letterSpacing: "-0.5px" }}>
                  ₹{Number(totalStaffWages).toLocaleString("en-IN")}
                </span>
              </div>
              <div style={{ fontSize: "11px", color: "#6b5b7e" }}>
                Total earnings accrued across all duties
              </div>
            </div>

            {/* Box 3: Total staff pending */}
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
                <span style={{ fontSize: "12px", color: "#6b5b7e", fontWeight: 700, textTransform: "uppercase" }}>
                  Total Staff Pending
                </span>
                <span style={{ fontSize: "16px" }}>⏳</span>
              </div>
              <div>
                <span style={{ fontSize: "30px", fontWeight: 800, color: "#be123c", letterSpacing: "-0.5px" }}>
                  ₹{Number(totalStaffPending).toLocaleString("en-IN")}
                </span>
              </div>
              <div style={{ fontSize: "11px", color: "#8a7b9b" }}>
                Pending balance due to be paid out
              </div>
            </div>

            {/* Box 4: Monthly salary */}
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
                <span style={{ fontSize: "12px", color: "#6b5b7e", fontWeight: 700, textTransform: "uppercase" }}>
                  Monthly Salary
                </span>
                <span style={{ fontSize: "16px" }}>💼</span>
              </div>
              <div>
                <span style={{ fontSize: "30px", fontWeight: 800, color: "#4338ca", letterSpacing: "-0.5px" }}>
                  ₹{Number(monthlySalaryTotal).toLocaleString("en-IN")}
                </span>
              </div>
              <div style={{ fontSize: "11px", color: "#8a7b9b" }}>
                Monthly payroll commitment for fixed staff
              </div>
            </div>
          </div>

          {/* ========================================================= */}
          {/* VIEW SWITCH: MASTER STAFF DATA vs STAFF DETAILS PAGE       */}
          {/* ========================================================= */}
          {!selectedStaff ? (
            /* ------------------------------------------------------- */
            /* SCREEN 1: MASTER STAFF DATA TABLE                       */
            /* ------------------------------------------------------- */
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              {/* Header Bar above Table with Search, Filter & Quick Add Buttons */}
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
                {/* Search */}
                <div style={{ display: "flex", alignItems: "center", gap: "8px", flex: 1, minWidth: "260px" }}>
                  <span style={{ color: "#8a7b9b" }}>🔍</span>
                  <input
                    type="text"
                    placeholder="Search staff by name, role, phone..."
                    value={searchStaff}
                    onChange={(e) => setSearchStaff(e.target.value)}
                    style={{
                      width: "100%",
                      height: "38px",
                      padding: "0 12px",
                      borderRadius: "10px",
                      border: "1px solid #e2e8f0",
                      background: "#ffffff",
                      fontSize: "13px",
                      outline: "none",
                    }}
                  />
                </div>

                {/* Filters */}
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
                      padding: "6px 14px",
                      borderRadius: "8px",
                      border: "none",
                      fontSize: "12px",
                      fontWeight: 700,
                      cursor: "pointer",
                      background: staffFilter === "all" ? "#7c3aed" : "transparent",
                      color: staffFilter === "all" ? "#ffffff" : "#475569",
                      transition: "all 0.15s ease",
                    }}
                  >
                    All ({staffList.length})
                  </button>

                  <button
                    type="button"
                    onClick={() => setStaffFilter("daily")}
                    style={{
                      padding: "6px 14px",
                      borderRadius: "8px",
                      border: "none",
                      fontSize: "12px",
                      fontWeight: 700,
                      cursor: "pointer",
                      background: staffFilter === "daily" ? "#7c3aed" : "transparent",
                      color: staffFilter === "daily" ? "#ffffff" : "#475569",
                      transition: "all 0.15s ease",
                    }}
                  >
                    Daily Staff ({staffList.filter((s) => s.wage_type === "daily").length})
                  </button>

                  <button
                    type="button"
                    onClick={() => setStaffFilter("monthly")}
                    style={{
                      padding: "6px 14px",
                      borderRadius: "8px",
                      border: "none",
                      fontSize: "12px",
                      fontWeight: 700,
                      cursor: "pointer",
                      background: staffFilter === "monthly" ? "#7c3aed" : "transparent",
                      color: staffFilter === "monthly" ? "#ffffff" : "#475569",
                      transition: "all 0.15s ease",
                    }}
                  >
                    Monthly Staff ({staffList.filter((s) => s.wage_type === "monthly").length})
                  </button>
                </div>

                {/* Quick Add Action from Blueprint */}
                <button
                  type="button"
                  onClick={() => openWageForm()}
                  style={{
                    height: "38px",
                    padding: "0 16px",
                    borderRadius: "10px",
                    border: "1px solid #a7f3d0",
                    background: "#ecfdf5",
                    color: "#047857",
                    fontWeight: 700,
                    fontSize: "13px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    boxShadow: "0 1px 4px rgba(4, 120, 87, 0.1)",
                  }}
                >
                  <span>📝</span>
                  <span>+ Add Wage Entry</span>
                </button>
              </div>

              {/* Staff Data Table ("Staff data" from Blueprint) */}
              <div
                style={{
                  background: "#ffffff",
                  borderRadius: "16px",
                  border: "1px solid #e9e3f3",
                  boxShadow: "0 2px 8px rgba(30, 8, 54, 0.04)",
                  overflowX: "auto",
                }}
              >
                <div style={{ padding: "16px 20px", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 800, color: "#1e0836" }}>
                      Staff Data
                    </h2>
                    <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#8a7b9b" }}>
                      Click on any staff member to view their complete work history, dates, and wages.
                    </p>
                  </div>
                  <span style={{ fontSize: "12px", color: "#6d28d9", fontWeight: 700 }}>
                    Showing {filteredStaffList.length} staff
                  </span>
                </div>

                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "13px" }}>
                  <thead style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                    <tr>
                      <th style={{ padding: "14px 20px", fontWeight: 700, color: "#64748b", fontSize: "11px", textTransform: "uppercase" }}>Staff Member</th>
                      <th style={{ padding: "14px 16px", fontWeight: 700, color: "#64748b", fontSize: "11px", textTransform: "uppercase" }}>Role</th>
                      <th style={{ padding: "14px 16px", fontWeight: 700, color: "#64748b", fontSize: "11px", textTransform: "uppercase" }}>Type</th>
                      <th style={{ padding: "14px 16px", fontWeight: 700, color: "#64748b", fontSize: "11px", textTransform: "uppercase", textAlign: "right" }}>Base Rate / Salary</th>
                      <th style={{ padding: "14px 16px", fontWeight: 700, color: "#64748b", fontSize: "11px", textTransform: "uppercase", textAlign: "right" }}>Total Accrued</th>
                      <th style={{ padding: "14px 16px", fontWeight: 700, color: "#64748b", fontSize: "11px", textTransform: "uppercase", textAlign: "right" }}>Total Paid</th>
                      <th style={{ padding: "14px 16px", fontWeight: 700, color: "#64748b", fontSize: "11px", textTransform: "uppercase", textAlign: "right" }}>Pending Due</th>
                      <th style={{ padding: "14px 20px", fontWeight: 700, color: "#64748b", fontSize: "11px", textTransform: "uppercase", textAlign: "center" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStaffList.length === 0 ? (
                      <tr>
                        <td colSpan={8} style={{ padding: "40px", textAlign: "center", color: "#8a7b9b" }}>
                          No staff found matching criteria.
                        </td>
                      </tr>
                    ) : (
                      filteredStaffList.map((s) => (
                        <tr
                          key={s.id}
                          onClick={() => setSelectedStaffId(s.id)}
                          style={{
                            borderBottom: "1px solid #f1f5f9",
                            cursor: "pointer",
                            transition: "background 0.15s ease",
                          }}
                          className="hover:bg-purple-50/50"
                        >
                          <td style={{ padding: "16px 20px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                              <div
                                style={{
                                  width: "38px",
                                  height: "38px",
                                  borderRadius: "10px",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  fontWeight: 800,
                                  fontSize: "13px",
                                  background: s.wage_type === "monthly" ? "#e0e7ff" : "#ede9fe",
                                  color: s.wage_type === "monthly" ? "#3730a3" : "#6d28d9",
                                  flexShrink: 0,
                                }}
                              >
                                {s.name.slice(0, 2).toUpperCase()}
                              </div>
                              <div>
                                <div style={{ fontWeight: 800, color: "#1e0836", fontSize: "14px" }}>{s.name}</div>
                                {s.mobile && (
                                  <div style={{ fontSize: "11px", color: "#8a7b9b" }}>📞 {s.mobile}</div>
                                )}
                              </div>
                            </div>
                          </td>

                          <td style={{ padding: "16px 16px", color: "#475569", fontWeight: 600 }}>{s.kitchen_role}</td>

                          <td style={{ padding: "16px 16px" }}>
                            <span
                              style={{
                                fontSize: "11px",
                                fontWeight: 700,
                                textTransform: "uppercase",
                                padding: "3px 8px",
                                borderRadius: "6px",
                                background: s.wage_type === "monthly" ? "#e0e7ff" : "#fef3c7",
                                color: s.wage_type === "monthly" ? "#3730a3" : "#b45309",
                              }}
                            >
                              {s.wage_type}
                            </span>
                          </td>

                          <td style={{ padding: "16px 16px", textAlign: "right", fontWeight: 700, color: "#1e0836" }}>
                            ₹{Number(s.wage_rate).toLocaleString("en-IN")}
                            <span style={{ fontSize: "10px", color: "#8a7b9b", display: "block", fontWeight: 500 }}>
                              {s.wage_type === "monthly" ? "/month" : "/day"}
                            </span>
                          </td>

                          <td style={{ padding: "16px 16px", textAlign: "right", fontWeight: 800, color: "#1e0836" }}>
                            ₹{Number(s.total_wages).toLocaleString("en-IN")}
                          </td>

                          <td style={{ padding: "16px 16px", textAlign: "right", fontWeight: 800, color: "#059669" }}>
                            ₹{Number(s.total_paid).toLocaleString("en-IN")}
                          </td>

                          <td style={{ padding: "16px 16px", textAlign: "right" }}>
                            <span
                              style={{
                                fontWeight: 800,
                                padding: "4px 10px",
                                borderRadius: "8px",
                                background: s.balance > 0 ? "#fef3c7" : "#ecfdf5",
                                color: s.balance > 0 ? "#b45309" : "#047857",
                                display: "inline-block",
                              }}
                            >
                              ₹{Number(s.balance).toLocaleString("en-IN")}
                            </span>
                          </td>

                          <td style={{ padding: "16px 20px", textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
                            <div style={{ display: "inline-flex", gap: "6px", alignItems: "center" }}>
                              <button
                                type="button"
                                onClick={() => setSelectedStaffId(s.id)}
                                style={{
                                  padding: "6px 12px",
                                  borderRadius: "8px",
                                  border: "1px solid #ddd6fe",
                                  background: "#f5f3ff",
                                  color: "#6d28d9",
                                  fontWeight: 700,
                                  fontSize: "12px",
                                  cursor: "pointer",
                                }}
                              >
                                View Details →
                              </button>

                              <button
                                type="button"
                                onClick={() => openPaymentModal(s)}
                                style={{
                                  padding: "6px 10px",
                                  borderRadius: "8px",
                                  border: "1px solid #a7f3d0",
                                  background: "#ecfdf5",
                                  color: "#047857",
                                  fontWeight: 700,
                                  fontSize: "12px",
                                  cursor: "pointer",
                                }}
                                title="Pay Balance"
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
                                  padding: "6px 8px",
                                  borderRadius: "8px",
                                  border: "1px solid #e2e8f0",
                                  background: "#ffffff",
                                  cursor: "pointer",
                                  fontSize: "12px",
                                }}
                                title="Edit"
                              >
                                ✏️
                              </button>

                              <button
                                type="button"
                                onClick={() => handleDeleteStaff(s.id, s.name)}
                                style={{
                                  padding: "6px 8px",
                                  borderRadius: "8px",
                                  border: "1px solid #fecaca",
                                  background: "#fef2f2",
                                  color: "#b91c1c",
                                  cursor: "pointer",
                                  fontSize: "12px",
                                }}
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
          ) : (
            /* ------------------------------------------------------- */
            /* SCREEN 2: KITCHEN STAFF DETAILS PAGE                    */
            /* ("Show their work: Date, Wage, Payment, List days")     */
            /* ------------------------------------------------------- */
            <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
              {/* Back Navigation Bar */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
                <button
                  type="button"
                  onClick={() => setSelectedStaffId(null)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "8px 16px",
                    borderRadius: "10px",
                    border: "1px solid #e2e8f0",
                    background: "#ffffff",
                    color: "#24103f",
                    fontWeight: 700,
                    fontSize: "13px",
                    cursor: "pointer",
                    boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
                  }}
                >
                  <span>←</span> Back to Staff List
                </button>

                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <button
                    type="button"
                    onClick={() => openWageForm(selectedStaff.id)}
                    style={{
                      padding: "8px 16px",
                      borderRadius: "10px",
                      border: "1px solid #a7f3d0",
                      background: "#ecfdf5",
                      color: "#047857",
                      fontWeight: 700,
                      fontSize: "13px",
                      cursor: "pointer",
                    }}
                  >
                    📝 + Add Wage for {selectedStaff.name}
                  </button>

                  <button
                    type="button"
                    onClick={() => openPaymentModal(selectedStaff)}
                    style={{
                      padding: "8px 16px",
                      borderRadius: "10px",
                      border: "none",
                      background: "linear-gradient(135deg, #059669 0%, #047857 100%)",
                      color: "#ffffff",
                      fontWeight: 700,
                      fontSize: "13px",
                      cursor: "pointer",
                      boxShadow: "0 4px 12px rgba(5, 150, 105, 0.25)",
                    }}
                  >
                    💵 Pay Balance (₹{Number(selectedStaff.balance).toLocaleString("en-IN")})
                  </button>
                </div>
              </div>

              {/* Staff Profile Overview Card */}
              <div
                style={{
                  background: "#ffffff",
                  border: "1px solid #e9e3f3",
                  borderRadius: "18px",
                  padding: "24px",
                  boxShadow: "0 2px 8px rgba(30, 8, 54, 0.04)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "20px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                    <div
                      style={{
                        width: "56px",
                        height: "56px",
                        borderRadius: "14px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 800,
                        fontSize: "20px",
                        background: selectedStaff.wage_type === "monthly" ? "#e0e7ff" : "#ede9fe",
                        color: selectedStaff.wage_type === "monthly" ? "#3730a3" : "#6d28d9",
                        flexShrink: 0,
                      }}
                    >
                      {selectedStaff.name.slice(0, 2).toUpperCase()}
                    </div>

                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                        <h2 style={{ margin: 0, fontSize: "20px", fontWeight: 800, color: "#1e0836" }}>
                          {selectedStaff.name}
                        </h2>
                        <span
                          style={{
                            fontSize: "11px",
                            fontWeight: 700,
                            padding: "3px 8px",
                            borderRadius: "6px",
                            background: "#f5f3ff",
                            color: "#6d28d9",
                            border: "1px solid #ede9fe",
                          }}
                        >
                          {selectedStaff.kitchen_role}
                        </span>
                        <span
                          style={{
                            fontSize: "11px",
                            fontWeight: 700,
                            textTransform: "uppercase",
                            padding: "3px 8px",
                            borderRadius: "6px",
                            background: selectedStaff.wage_type === "monthly" ? "#e0e7ff" : "#fef3c7",
                            color: selectedStaff.wage_type === "monthly" ? "#3730a3" : "#b45309",
                          }}
                        >
                          {selectedStaff.wage_type}
                        </span>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: "16px", marginTop: "6px", fontSize: "13px", color: "#6b5b7e" }}>
                        {selectedStaff.mobile && <span>📞 {selectedStaff.mobile}</span>}
                        {selectedStaff.notes && <span>💬 {selectedStaff.notes}</span>}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setEditingStaff(selectedStaff);
                      setStaffForm({
                        name: selectedStaff.name,
                        mobile: selectedStaff.mobile || "",
                        kitchen_role: selectedStaff.kitchen_role,
                        wage_type: selectedStaff.wage_type,
                        wage_rate: String(selectedStaff.wage_rate),
                        status: selectedStaff.status,
                        address: selectedStaff.address || "",
                        notes: selectedStaff.notes || "",
                      });
                      setShowAddStaffModal(true);
                    }}
                    style={{
                      padding: "6px 14px",
                      borderRadius: "8px",
                      border: "1px solid #e2e8f0",
                      background: "#ffffff",
                      fontSize: "12px",
                      fontWeight: 700,
                      color: "#6b5b7e",
                      cursor: "pointer",
                    }}
                  >
                    ✏️ Edit Staff
                  </button>
                </div>

                {/* 4 Financial Stat Cards */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px" }}>
                  <div style={{ background: "#f8fafc", padding: "14px 16px", borderRadius: "12px", border: "1px solid #f1f5f9" }}>
                    <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Base Rate / Salary</div>
                    <div style={{ fontSize: "20px", fontWeight: 800, color: "#1e0836", marginTop: "4px" }}>
                      ₹{Number(selectedStaff.wage_rate).toLocaleString("en-IN")}
                      <small style={{ fontSize: "11px", color: "#8a7b9b", fontWeight: 500, marginLeft: "4px" }}>
                        {selectedStaff.wage_type === "monthly" ? "/mo" : "/day"}
                      </small>
                    </div>
                  </div>

                  <div style={{ background: "#f8fafc", padding: "14px 16px", borderRadius: "12px", border: "1px solid #f1f5f9" }}>
                    <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Total Worked Days</div>
                    <div style={{ fontSize: "20px", fontWeight: 800, color: "#1e0836", marginTop: "4px" }}>
                      {selectedStaffDuties.filter((d) => d.duty_status !== "absent").length} Days
                    </div>
                  </div>

                  <div style={{ background: "#f8fafc", padding: "14px 16px", borderRadius: "12px", border: "1px solid #f1f5f9" }}>
                    <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Total Accrued Wages</div>
                    <div style={{ fontSize: "20px", fontWeight: 800, color: "#b45309", marginTop: "4px" }}>
                      ₹{Number(selectedStaff.total_wages).toLocaleString("en-IN")}
                    </div>
                  </div>

                  <div style={{ background: "#f8fafc", padding: "14px 16px", borderRadius: "12px", border: "1px solid #f1f5f9" }}>
                    <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Total Paid</div>
                    <div style={{ fontSize: "20px", fontWeight: 800, color: "#059669", marginTop: "4px" }}>
                      ₹{Number(selectedStaff.total_paid).toLocaleString("en-IN")}
                    </div>
                  </div>

                  <div style={{ background: selectedStaff.balance > 0 ? "#fef3c7" : "#ecfdf5", padding: "14px 16px", borderRadius: "12px", border: selectedStaff.balance > 0 ? "1px solid #fde68a" : "1px solid #a7f3d0" }}>
                    <div style={{ fontSize: "11px", fontWeight: 800, color: selectedStaff.balance > 0 ? "#b45309" : "#047857", textTransform: "uppercase" }}>
                      Balance Due
                    </div>
                    <div style={{ fontSize: "20px", fontWeight: 800, color: selectedStaff.balance > 0 ? "#b45309" : "#047857", marginTop: "4px" }}>
                      ₹{Number(selectedStaff.balance).toLocaleString("en-IN")}
                    </div>
                  </div>
                </div>
              </div>

              {/* Work & Daily Wage History Table ("* Show their work, * Date, * Wage, * Payment, * List them worked days") */}
              <div
                style={{
                  background: "#ffffff",
                  border: "1px solid #e9e3f3",
                  borderRadius: "18px",
                  boxShadow: "0 2px 8px rgba(30, 8, 54, 0.04)",
                  overflowX: "auto",
                }}
              >
                <div style={{ padding: "18px 20px", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 800, color: "#1e0836" }}>
                      🗓️ Work & Daily Wage History ({selectedStaffDuties.length} days recorded)
                    </h3>
                    <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#8a7b9b" }}>
                      List of all work dates, attendance, variable daily wages, and payout status.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => openWageForm(selectedStaff.id)}
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
                    + Log Work Day
                  </button>
                </div>

                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "13px" }}>
                  <thead style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                    <tr>
                      <th style={{ padding: "14px 20px", fontWeight: 700, color: "#64748b", fontSize: "11px", textTransform: "uppercase" }}>Date</th>
                      <th style={{ padding: "14px 16px", fontWeight: 700, color: "#64748b", fontSize: "11px", textTransform: "uppercase" }}>Work / Attendance</th>
                      <th style={{ padding: "14px 16px", fontWeight: 700, color: "#64748b", fontSize: "11px", textTransform: "uppercase", textAlign: "right" }}>Daily Wage (₹)</th>
                      <th style={{ padding: "14px 16px", fontWeight: 700, color: "#64748b", fontSize: "11px", textTransform: "uppercase", textAlign: "center" }}>Payment Status</th>
                      <th style={{ padding: "14px 20px", fontWeight: 700, color: "#64748b", fontSize: "11px", textTransform: "uppercase" }}>Note / Shift</th>
                      <th style={{ padding: "14px 20px", fontWeight: 700, color: "#64748b", fontSize: "11px", textTransform: "uppercase", textAlign: "center" }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedStaffDuties.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ padding: "36px", textAlign: "center", color: "#8a7b9b" }}>
                          No work days recorded yet. Click <strong>"+ Log Work Day"</strong> above to record their first wage entry.
                        </td>
                      </tr>
                    ) : (
                      selectedStaffDuties.map((d) => (
                        <tr key={d.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                          <td style={{ padding: "14px 20px", fontWeight: 700, color: "#1e0836" }}>
                            {d.duty_date}
                          </td>

                          <td style={{ padding: "14px 16px" }}>
                            {d.duty_status === "present" || d.duty_status === "full" ? (
                              <span style={{ padding: "3px 8px", borderRadius: "6px", background: "#ecfdf5", color: "#047857", fontWeight: 700, fontSize: "11px" }}>
                                🟢 Present
                              </span>
                            ) : d.duty_status === "half" ? (
                              <span style={{ padding: "3px 8px", borderRadius: "6px", background: "#fef3c7", color: "#b45309", fontWeight: 700, fontSize: "11px" }}>
                                🟡 Half Day
                              </span>
                            ) : (
                              <span style={{ padding: "3px 8px", borderRadius: "6px", background: "#fef2f2", color: "#b91c1c", fontWeight: 700, fontSize: "11px" }}>
                                🔴 Absent
                              </span>
                            )}
                          </td>

                          <td style={{ padding: "14px 16px", textAlign: "right", fontWeight: 800, color: "#b45309" }}>
                            ₹{Number(d.total_wage).toLocaleString("en-IN")}
                          </td>

                          <td style={{ padding: "14px 16px", textAlign: "center" }}>
                            {d.paid_today ? (
                              <span style={{ padding: "3px 8px", borderRadius: "6px", background: "#ecfdf5", color: "#047857", fontWeight: 700, fontSize: "11px" }}>
                                💵 Paid Cash
                              </span>
                            ) : (
                              <span style={{ padding: "3px 8px", borderRadius: "6px", background: "#f8fafc", color: "#64748b", fontWeight: 600, fontSize: "11px", border: "1px solid #e2e8f0" }}>
                                ⏳ Pending
                              </span>
                            )}
                          </td>

                          <td style={{ padding: "14px 20px", color: "#64748b" }}>
                            {d.note || "-"}
                          </td>

                          <td style={{ padding: "14px 20px", textAlign: "center" }}>
                            <button
                              type="button"
                              onClick={() => handleDeleteDuty(d.id)}
                              style={{
                                border: "1px solid #fecaca",
                                background: "#fef2f2",
                                color: "#b91c1c",
                                borderRadius: "6px",
                                padding: "4px 8px",
                                fontSize: "11px",
                                cursor: "pointer",
                              }}
                              title="Delete work record"
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

              {/* Payments & Advances History Table */}
              <div
                style={{
                  background: "#ffffff",
                  border: "1px solid #e9e3f3",
                  borderRadius: "18px",
                  boxShadow: "0 2px 8px rgba(30, 8, 54, 0.04)",
                  overflowX: "auto",
                }}
              >
                <div style={{ padding: "18px 20px", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 800, color: "#1e0836" }}>
                      🧾 Cash Payments & Advances ({selectedStaffPayments.length})
                    </h3>
                    <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#8a7b9b" }}>
                      Payment ledger and advance vouchers handed to {selectedStaff.name}.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => openPaymentModal(selectedStaff)}
                    style={{
                      padding: "6px 14px",
                      borderRadius: "8px",
                      border: "none",
                      background: "linear-gradient(135deg, #059669 0%, #047857 100%)",
                      color: "#ffffff",
                      fontWeight: 700,
                      fontSize: "12px",
                      cursor: "pointer",
                    }}
                  >
                    + Pay Cash / Advance
                  </button>
                </div>

                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "13px" }}>
                  <thead style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                    <tr>
                      <th style={{ padding: "14px 20px", fontWeight: 700, color: "#64748b", fontSize: "11px", textTransform: "uppercase" }}>Payment Date</th>
                      <th style={{ padding: "14px 16px", fontWeight: 700, color: "#64748b", fontSize: "11px", textTransform: "uppercase", textAlign: "right" }}>Amount (₹)</th>
                      <th style={{ padding: "14px 16px", fontWeight: 700, color: "#64748b", fontSize: "11px", textTransform: "uppercase", textAlign: "center" }}>Mode</th>
                      <th style={{ padding: "14px 20px", fontWeight: 700, color: "#64748b", fontSize: "11px", textTransform: "uppercase" }}>Note / Description</th>
                      <th style={{ padding: "14px 20px", fontWeight: 700, color: "#64748b", fontSize: "11px", textTransform: "uppercase", textAlign: "center" }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedStaffPayments.length === 0 ? (
                      <tr>
                        <td colSpan={5} style={{ padding: "30px", textAlign: "center", color: "#8a7b9b" }}>
                          No payments recorded yet for this staff member.
                        </td>
                      </tr>
                    ) : (
                      selectedStaffPayments.map((p) => (
                        <tr key={p.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                          <td style={{ padding: "14px 20px", color: "#1e0836", fontWeight: 700 }}>{p.payment_date}</td>
                          <td style={{ padding: "14px 16px", textAlign: "right", fontWeight: 800, color: "#059669" }}>
                            ₹{Number(p.amount).toLocaleString("en-IN")}
                          </td>
                          <td style={{ padding: "14px 16px", textAlign: "center" }}>
                            <span style={{ padding: "2px 8px", borderRadius: "6px", background: "#f1f5f9", color: "#475569", fontSize: "11px", fontWeight: 700 }}>
                              {p.payment_mode}
                            </span>
                          </td>
                          <td style={{ padding: "14px 20px", color: "#64748b" }}>
                            {p.note || "-"}
                            {p.reference_no && <span style={{ fontSize: "10px", color: "#8a7b9b", display: "block" }}>Ref: {p.reference_no}</span>}
                          </td>
                          <td style={{ padding: "14px 20px", textAlign: "center" }}>
                            <button
                              type="button"
                              onClick={() => handleDeletePayment(p.id)}
                              style={{
                                border: "1px solid #fecaca",
                                background: "#fef2f2",
                                color: "#b91c1c",
                                borderRadius: "6px",
                                padding: "4px 8px",
                                fontSize: "11px",
                                cursor: "pointer",
                              }}
                              title="Delete payment"
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

        {/* ========================================================= */}
        {/* MODAL 1: QUICK DAILY WAGE ENTRY ("Form" from Blueprint)   */}
        {/* ========================================================= */}
        {showWageFormModal && (
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
                maxWidth: "480px",
                maxHeight: "90vh",
                display: "flex",
                flexDirection: "column",
                background: "#ffffff",
                borderRadius: "18px",
                padding: "24px",
                boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
                border: "1px solid #e9e3f3",
                overflow: "hidden",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: "12px", borderBottom: "1px solid #f1f5f9", flexShrink: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "20px" }}>📝</span>
                  <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 800, color: "#1e0836" }}>
                    Record Daily Work & Wage
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowWageFormModal(false)}
                  style={{ border: "none", background: "transparent", color: "#64748b", cursor: "pointer", fontSize: "14px" }}
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSubmitWageForm} style={{ marginTop: "16px", display: "flex", flexDirection: "column", gap: "14px", overflowY: "auto", flex: 1, paddingRight: "4px" }}>
                {/* Date */}
                <div>
                  <label style={{ fontSize: "12px", fontWeight: 700, color: "#1e0836", display: "block", marginBottom: "4px" }}>
                    Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={wageForm.duty_date}
                    onChange={(e) => setWageForm({ ...wageForm, duty_date: e.target.value })}
                    style={{
                      width: "100%",
                      height: "38px",
                      padding: "0 12px",
                      borderRadius: "10px",
                      border: "1px solid #d8b4fe",
                      fontSize: "13px",
                      fontWeight: 700,
                      outline: "none",
                    }}
                  />
                </div>

                {/* Assign / Select Staff */}
                <div>
                  <label style={{ fontSize: "12px", fontWeight: 700, color: "#1e0836", display: "block", marginBottom: "4px" }}>
                    Select Staff *
                  </label>
                  <select
                    required
                    value={wageForm.staff_id}
                    onChange={(e) => {
                      const sid = e.target.value;
                      const s = staffList.find((item) => item.id === parseInt(sid));
                      const rate = s ? (s.wage_type === "monthly" ? "0" : String(s.wage_rate)) : "800";
                      setWageForm({
                        ...wageForm,
                        staff_id: sid,
                        today_wage: rate,
                      });
                    }}
                    style={{
                      width: "100%",
                      height: "38px",
                      padding: "0 10px",
                      borderRadius: "10px",
                      border: "1px solid #d8b4fe",
                      fontSize: "13px",
                      fontWeight: 700,
                      background: "#fff",
                      outline: "none",
                    }}
                  >
                    <option value="">-- Choose Staff Member --</option>
                    {staffList.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.kitchen_role}) - {s.wage_type === "monthly" ? `₹${Number(s.wage_rate).toLocaleString("en-IN")}/mo` : `Base: ₹${Number(s.wage_rate).toLocaleString("en-IN")}/day`}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Attendance Status */}
                <div>
                  <label style={{ fontSize: "12px", fontWeight: 700, color: "#1e0836", display: "block", marginBottom: "6px" }}>
                    Attendance Status
                  </label>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px" }}>
                    <button
                      type="button"
                      onClick={() => {
                        const s = staffList.find((item) => item.id === parseInt(wageForm.staff_id));
                        const rate = s ? (s.wage_type === "monthly" ? "0" : String(s.wage_rate)) : "800";
                        setWageForm({ ...wageForm, duty_status: "present", today_wage: rate });
                      }}
                      style={{
                        height: "36px",
                        borderRadius: "8px",
                        border: wageForm.duty_status === "present" ? "2px solid #059669" : "1px solid #e2e8f0",
                        background: wageForm.duty_status === "present" ? "#ecfdf5" : "#ffffff",
                        color: wageForm.duty_status === "present" ? "#047857" : "#475569",
                        fontWeight: 700,
                        fontSize: "12px",
                        cursor: "pointer",
                      }}
                    >
                      🟢 Present
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        const s = staffList.find((item) => item.id === parseInt(wageForm.staff_id));
                        const halfRate = s ? Math.round(Number(s.wage_rate) * 0.5) : 400;
                        setWageForm({ ...wageForm, duty_status: "half", today_wage: String(halfRate) });
                      }}
                      style={{
                        height: "36px",
                        borderRadius: "8px",
                        border: wageForm.duty_status === "half" ? "2px solid #f59e0b" : "1px solid #e2e8f0",
                        background: wageForm.duty_status === "half" ? "#fef3c7" : "#ffffff",
                        color: wageForm.duty_status === "half" ? "#b45309" : "#475569",
                        fontWeight: 700,
                        fontSize: "12px",
                        cursor: "pointer",
                      }}
                    >
                      🟡 Half Day
                    </button>

                    <button
                      type="button"
                      onClick={() => setWageForm({ ...wageForm, duty_status: "absent", today_wage: "0" })}
                      style={{
                        height: "36px",
                        borderRadius: "8px",
                        border: wageForm.duty_status === "absent" ? "2px solid #e11d48" : "1px solid #e2e8f0",
                        background: wageForm.duty_status === "absent" ? "#fef2f2" : "#ffffff",
                        color: wageForm.duty_status === "absent" ? "#b91c1c" : "#475569",
                        fontWeight: 700,
                        fontSize: "12px",
                        cursor: "pointer",
                      }}
                    >
                      🔴 Absent
                    </button>
                  </div>
                </div>

                {/* Today's Wage (THE HERO INPUT) */}
                <div>
                  <label style={{ fontSize: "12px", fontWeight: 700, color: "#1e0836", display: "block", marginBottom: "4px" }}>
                    Today's Wage (₹) *
                  </label>
                  <div style={{ position: "relative" }}>
                    <span style={{ position: "absolute", left: "12px", top: "9px", fontSize: "14px", fontWeight: 800, color: "#8a7b9b" }}>
                      ₹
                    </span>
                    <input
                      type="number"
                      required
                      min="0"
                      value={wageForm.today_wage}
                      onChange={(e) => setWageForm({ ...wageForm, today_wage: e.target.value })}
                      style={{
                        width: "100%",
                        height: "40px",
                        paddingLeft: "30px",
                        paddingRight: "14px",
                        borderRadius: "10px",
                        border: "2px solid #7c3aed",
                        fontSize: "16px",
                        fontWeight: 800,
                        color: "#1e0836",
                        outline: "none",
                      }}
                      placeholder="e.g. 800"
                    />
                  </div>
                  <span style={{ fontSize: "11px", color: "#8a7b9b", marginTop: "3px", display: "block" }}>
                    Change freely. Wages vary all days based on shifts, hours, or catering.
                  </span>
                </div>

                {/* Paid in Cash Today Toggle */}
                <div style={{ background: "#f8fafc", padding: "10px 14px", borderRadius: "10px", border: "1px solid #f1f5f9" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", fontSize: "13px", fontWeight: 700, color: "#1e0836" }}>
                    <input
                      type="checkbox"
                      checked={wageForm.paid_today}
                      onChange={(e) => setWageForm({ ...wageForm, paid_today: e.target.checked })}
                      style={{ width: "16px", height: "16px", accentColor: "#059669" }}
                    />
                    <span>💵 Paid in Cash Today (Settles balance to ₹0)</span>
                  </label>
                </div>

                {/* Note */}
                <div>
                  <label style={{ fontSize: "12px", fontWeight: 700, color: "#1e0836", display: "block", marginBottom: "4px" }}>
                    Note / Description (Optional)
                  </label>
                  <input
                    type="text"
                    value={wageForm.note}
                    onChange={(e) => setWageForm({ ...wageForm, note: e.target.value })}
                    style={{
                      width: "100%",
                      height: "38px",
                      padding: "0 12px",
                      borderRadius: "10px",
                      border: "1px solid #e2e8f0",
                      fontSize: "13px",
                      outline: "none",
                    }}
                    placeholder="e.g. Overtime catering, Evening shift"
                  />
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", paddingTop: "12px", borderTop: "1px solid #f1f5f9", position: "sticky", bottom: 0, background: "#ffffff", marginTop: "auto" }}>
                  <button
                    type="button"
                    onClick={() => setShowWageFormModal(false)}
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
                      padding: "8px 22px",
                      borderRadius: "8px",
                      border: "none",
                      background: "linear-gradient(135deg, #059669 0%, #047857 100%)",
                      color: "#ffffff",
                      fontWeight: 800,
                      fontSize: "13px",
                      cursor: "pointer",
                      boxShadow: "0 4px 14px rgba(5, 150, 105, 0.25)",
                    }}
                  >
                    Submit Wage Entry ✓
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* MODAL 2: ADD / EDIT KITCHEN STAFF                         */}
        {/* ========================================================= */}
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
                maxWidth: "480px",
                maxHeight: "90vh",
                display: "flex",
                flexDirection: "column",
                background: "#ffffff",
                borderRadius: "18px",
                padding: "24px",
                boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
                border: "1px solid #e9e3f3",
                overflow: "hidden",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: "12px", borderBottom: "1px solid #f1f5f9", flexShrink: 0 }}>
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

              <form onSubmit={handleSaveStaff} style={{ marginTop: "16px", display: "flex", flexDirection: "column", gap: "14px", overflowY: "auto", flex: 1, paddingRight: "4px" }}>
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

                <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", paddingTop: "12px", borderTop: "1px solid #f1f5f9", position: "sticky", bottom: 0, background: "#ffffff", marginTop: "auto" }}>
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

        {/* ========================================================= */}
        {/* MODAL 3: RECORD PAYMENT / ADVANCE                         */}
        {/* ========================================================= */}
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
                maxWidth: "480px",
                maxHeight: "90vh",
                display: "flex",
                flexDirection: "column",
                background: "#ffffff",
                borderRadius: "18px",
                padding: "24px",
                boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
                border: "1px solid #e9e3f3",
                overflow: "hidden",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: "12px", borderBottom: "1px solid #f1f5f9", flexShrink: 0 }}>
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

              <form onSubmit={handleSavePayment} style={{ marginTop: "16px", display: "flex", flexDirection: "column", gap: "14px", overflowY: "auto", flex: 1, paddingRight: "4px" }}>
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
                    placeholder="e.g. Daily cash settlement / Advance"
                  />
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", paddingTop: "12px", borderTop: "1px solid #f1f5f9", position: "sticky", bottom: 0, background: "#ffffff", marginTop: "auto" }}>
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
