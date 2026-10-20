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
  total_wages: number;
  total_paid: number;
  balance: number;
};

export type KitchenWage = {
  id: number;
  staff_id: number;
  staff_name?: string | null;
  period: string;
  wage_type: string;
  days_worked: number;
  base_rate: number;
  calculated_wage: number;
  bonus: number;
  deduction: number;
  total_wage: number;
  date_recorded: string;
  notes?: string | null;
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
};

const KITCHEN_ROLES = [
  "Head Chef",
  "Curry Master",
  "Tandoor Cook",
  "Biryani Master",
  "Chinese / Fast Food Cook",
  "Assistant Cook",
  "Kitchen Helper",
  "Dishwasher & Cleaner",
  "Kitchen Supervisor",
  "Store Keeper",
  "Other",
];

const DEFAULT_STAFF_FORM = {
  name: "",
  mobile: "",
  kitchen_role: "Head Chef",
  wage_type: "monthly",
  wage_rate: "",
  status: "active",
  joined_date: new Date().toISOString().slice(0, 10),
  address: "",
  notes: "",
};

function formatMoney(amount: number | string | null | undefined): string {
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

export default function KitchenPage() {
  const router = useRouter();
  const { user, isOwner, isManager } = useAuth();

  // Primary Data
  const [staffList, setStaffList] = useState<KitchenStaff[]>([]);
  const [wages, setWages] = useState<KitchenWage[]>([]);
  const [payments, setPayments] = useState<KitchenPayment[]>([]);
  const [summary, setSummary] = useState<KitchenSummary | null>(null);

  // UI State
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Tabs: 'directory' | 'wages' | 'payments'
  const [activeTab, setActiveTab] = useState<"directory" | "wages" | "payments">("directory");
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<"all" | "monthly" | "daily" | "pending">("all");

  // Modals
  const [staffModalOpen, setStaffModalOpen] = useState(false);
  const [editingStaffId, setEditingStaffId] = useState<number | null>(null);
  const [staffForm, setStaffForm] = useState(DEFAULT_STAFF_FORM);

  // Auto-Wage Modal
  const [autoWageModalOpen, setAutoWageModalOpen] = useState(false);
  const [autoPeriod, setAutoPeriod] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [autoDaysWorked, setAutoDaysWorked] = useState("30");
  const [autoSelectedStaffIds, setAutoSelectedStaffIds] = useState<number[]>([]);
  const [autoSelectAll, setAutoSelectAll] = useState(true);

  // Quick Individual Wage Modal
  const [quickWageModalOpen, setQuickWageModalOpen] = useState(false);
  const [quickWageStaff, setQuickWageStaff] = useState<KitchenStaff | null>(null);
  const [quickPeriod, setQuickPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [quickDaysWorked, setQuickDaysWorked] = useState("1");
  const [quickBonus, setQuickBonus] = useState("0");
  const [quickDeduction, setQuickDeduction] = useState("0");
  const [quickNotes, setQuickNotes] = useState("");

  // Payment Modal
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentStaffId, setPaymentStaffId] = useState<number | "">("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [paymentMode, setPaymentMode] = useState("Cash");
  const [paymentRef, setPaymentRef] = useState("");
  const [paymentNote, setPaymentNote] = useState("");

  // Voucher Receipt Modal
  const [voucherModalOpen, setVoucherModalOpen] = useState(false);
  const [voucherPayment, setVoucherPayment] = useState<KitchenPayment | null>(null);

  // Staff Details Drawer
  const [selectedStaffDetail, setSelectedStaffDetail] = useState<KitchenStaff | null>(null);

  // Data Loading
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [summaryRes, staffRes, wagesRes, paymentsRes] = await Promise.all([
        fetchWithAuth(`${API_URL}/kitchen/summary`),
        fetchWithAuth(`${API_URL}/kitchen/staff`),
        fetchWithAuth(`${API_URL}/kitchen/wages`),
        fetchWithAuth(`${API_URL}/kitchen/payments`),
      ]);

      if (summaryRes.ok) {
        setSummary(await summaryRes.json());
      }
      if (staffRes.ok) {
        const sList = await staffRes.json();
        setStaffList(Array.isArray(sList) ? sList : []);
      }
      if (wagesRes.ok) {
        const wList = await wagesRes.json();
        setWages(Array.isArray(wList) ? wList : []);
      }
      if (paymentsRes.ok) {
        const pList = await paymentsRes.json();
        setPayments(Array.isArray(pList) ? pList : []);
      }
    } catch (err: any) {
      console.error("Failed to load kitchen data:", err);
      setError("Unable to connect to the backend server. Please verify FastAPI is running.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filtered Staff
  const filteredStaff = useMemo(() => {
    return staffList.filter((s) => {
      const matchSearch =
        search.trim() === "" ||
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.kitchen_role.toLowerCase().includes(search.toLowerCase()) ||
        (s.mobile && s.mobile.includes(search));

      if (!matchSearch) return false;

      if (filterType === "monthly") return s.wage_type === "monthly";
      if (filterType === "daily") return s.wage_type === "daily";
      if (filterType === "pending") return Number(s.balance) > 0;
      return true;
    });
  }, [staffList, search, filterType]);

  // Selected Staff for Payment
  const activePaymentStaff = useMemo(() => {
    if (!paymentStaffId) return null;
    return staffList.find((s) => s.id === Number(paymentStaffId)) || null;
  }, [staffList, paymentStaffId]);

  // Save / Update Staff
  const handleSaveStaff = async (e: FormEvent) => {
    e.preventDefault();
    if (isOwner) {
      alert("Read-only access: Owner role cannot modify staff records.");
      return;
    }
    if (!staffForm.name.trim()) {
      alert("Please enter the staff member's name.");
      return;
    }
    const rate = Number(staffForm.wage_rate);
    if (!Number.isFinite(rate) || rate < 0) {
      alert("Please enter a valid wage rate.");
      return;
    }

    try {
      setSaving(true);
      const payload = {
        name: staffForm.name.trim(),
        mobile: staffForm.mobile.trim() || null,
        kitchen_role: staffForm.kitchen_role.trim(),
        wage_type: staffForm.wage_type,
        wage_rate: rate,
        status: staffForm.status,
        joined_date: staffForm.joined_date || null,
        address: staffForm.address.trim() || null,
        notes: staffForm.notes.trim() || null,
      };

      const url = editingStaffId
        ? `${API_URL}/kitchen/staff/${editingStaffId}`
        : `${API_URL}/kitchen/staff`;
      const method = editingStaffId ? "PUT" : "POST";

      const res = await fetchWithAuth(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.detail || "Failed to save kitchen staff.");
      }

      setSuccess(
        editingStaffId
          ? `Staff member "${staffForm.name.trim()}" updated successfully.`
          : `Kitchen staff member "${staffForm.name.trim()}" added successfully.`
      );
      setStaffModalOpen(false);
      setEditingStaffId(null);
      setStaffForm(DEFAULT_STAFF_FORM);
      await loadData();
      setTimeout(() => setSuccess(null), 3500);
    } catch (err: any) {
      alert(err.message || "Failed to save kitchen staff.");
    } finally {
      setSaving(false);
    }
  };

  // Open Edit Staff
  const openEditStaff = (staff: KitchenStaff) => {
    setEditingStaffId(staff.id);
    setStaffForm({
      name: staff.name,
      mobile: staff.mobile || "",
      kitchen_role: staff.kitchen_role,
      wage_type: staff.wage_type,
      wage_rate: String(staff.wage_rate),
      status: staff.status,
      joined_date: staff.joined_date || new Date().toISOString().slice(0, 10),
      address: staff.address || "",
      notes: staff.notes || "",
    });
    setStaffModalOpen(true);
  };

  // Delete Staff
  const handleDeleteStaff = async (staff: KitchenStaff) => {
    if (isOwner) {
      alert("Read-only access: Owner role cannot delete data.");
      return;
    }
    const confirm = window.confirm(
      `Are you sure you want to delete "${staff.name}"? This will also remove their associated wage and payment history.`
    );
    if (!confirm) return;

    try {
      setSaving(true);
      const res = await fetchWithAuth(`${API_URL}/kitchen/staff/${staff.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete staff member.");
      setSuccess(`Staff member "${staff.name}" deleted.`);
      await loadData();
      setTimeout(() => setSuccess(null), 3500);
    } catch (err: any) {
      alert(err.message || "Failed to delete staff member.");
    } finally {
      setSaving(false);
    }
  };

  // Open Quick Wage Set Modal for Single Staff
  const openQuickWageModal = (staff: KitchenStaff) => {
    setQuickWageStaff(staff);
    setQuickPeriod(new Date().toISOString().slice(0, 7));
    setQuickDaysWorked(staff.wage_type === "daily" ? "1" : "30");
    setQuickBonus("0");
    setQuickDeduction("0");
    setQuickNotes(
      staff.wage_type === "daily"
        ? `Daily wage for 1 day`
        : `Monthly wage for ${new Date().toISOString().slice(0, 7)}`
    );
    setQuickWageModalOpen(true);
  };

  // Submit Quick Wage
  const handleSaveQuickWage = async (e: FormEvent) => {
    e.preventDefault();
    if (isOwner) {
      alert("Read-only access: Owner role cannot record wages.");
      return;
    }
    if (!quickWageStaff) return;

    const days = Number(quickDaysWorked);
    if (!Number.isFinite(days) || days <= 0) {
      alert("Please enter valid days worked (> 0).");
      return;
    }

    try {
      setSaving(true);
      const payload = {
        staff_id: quickWageStaff.id,
        period: quickPeriod.trim(),
        wage_type: quickWageStaff.wage_type,
        days_worked: days,
        base_rate: quickWageStaff.wage_rate,
        bonus: Number(quickBonus) || 0,
        deduction: Number(quickDeduction) || 0,
        date_recorded: new Date().toISOString().slice(0, 10),
        notes: quickNotes.trim() || undefined,
      };

      const res = await fetchWithAuth(`${API_URL}/kitchen/wages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.detail || "Failed to record wage.");
      }

      setSuccess(`Wage recorded for "${quickWageStaff.name}" (${quickPeriod}).`);
      setQuickWageModalOpen(false);
      setQuickWageStaff(null);
      await loadData();
      setTimeout(() => setSuccess(null), 3500);
    } catch (err: any) {
      alert(err.message || "Failed to record wage.");
    } finally {
      setSaving(false);
    }
  };

  // Open Auto-Wage Modal
  const openAutoWageModal = () => {
    const activeStaff = staffList.filter((s) => s.status === "active");
    setAutoPeriod(new Date().toISOString().slice(0, 7));
    setAutoDaysWorked("30");
    setAutoSelectedStaffIds(activeStaff.map((s) => s.id));
    setAutoSelectAll(true);
    setAutoWageModalOpen(true);
  };

  // Toggle Auto-Wage Staff Checkbox
  const toggleStaffSelection = (id: number) => {
    setAutoSelectedStaffIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Submit Batch Auto-Wage
  const handleRunAutoWage = async (e: FormEvent) => {
    e.preventDefault();
    if (isOwner) {
      alert("Read-only access: Owner role cannot execute auto-wage.");
      return;
    }
    if (autoSelectedStaffIds.length === 0) {
      alert("Please select at least one staff member to calculate wages.");
      return;
    }
    const days = Number(autoDaysWorked);
    if (!Number.isFinite(days) || days <= 0) {
      alert("Please enter a valid days worked number (> 0).");
      return;
    }

    try {
      setSaving(true);
      const payload = {
        staff_ids: autoSelectedStaffIds,
        period: autoPeriod.trim(),
        days_worked: days,
        date_recorded: new Date().toISOString().slice(0, 10),
      };

      const res = await fetchWithAuth(`${API_URL}/kitchen/wages/auto-set`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.detail || "Failed to auto-generate wages.");
      }

      const result = await res.json();
      setSuccess(result.message || "Auto-wages generated successfully!");
      setAutoWageModalOpen(false);
      await loadData();
      setTimeout(() => setSuccess(null), 3500);
    } catch (err: any) {
      alert(err.message || "Failed to auto-generate wages.");
    } finally {
      setSaving(false);
    }
  };

  // Open Payment Modal
  const openPaymentModal = (staff?: KitchenStaff) => {
    if (staff) {
      setPaymentStaffId(staff.id);
      setPaymentAmount(staff.balance > 0 ? String(staff.balance) : "");
      setPaymentNote(`Wage disbursement for ${staff.name}`);
    } else {
      setPaymentStaffId("");
      setPaymentAmount("");
      setPaymentNote("");
    }
    setPaymentDate(new Date().toISOString().slice(0, 10));
    setPaymentMode("Cash");
    setPaymentRef("");
    setPaymentModalOpen(true);
  };

  // Submit Payment
  const handleSavePayment = async (e: FormEvent) => {
    e.preventDefault();
    if (isOwner) {
      alert("Read-only access: Owner role cannot record payments.");
      return;
    }
    if (!paymentStaffId) {
      alert("Please select a staff member.");
      return;
    }
    const amt = Number(paymentAmount);
    if (!Number.isFinite(amt) || amt <= 0) {
      alert("Please enter a valid payment amount (> 0).");
      return;
    }

    try {
      setSaving(true);
      const payload = {
        staff_id: Number(paymentStaffId),
        amount: amt,
        payment_date: paymentDate,
        payment_mode: paymentMode,
        reference_no: paymentRef.trim() || undefined,
        note: paymentNote.trim() || undefined,
      };

      const res = await fetchWithAuth(`${API_URL}/kitchen/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.detail || "Failed to record payment.");
      }

      const newPayment = await res.json();
      setSuccess(`Payment of ₹${formatMoney(amt)} recorded successfully.`);
      setPaymentModalOpen(false);
      await loadData();

      // Offer to view voucher
      setVoucherPayment(newPayment);
      setVoucherModalOpen(true);

      setTimeout(() => setSuccess(null), 3500);
    } catch (err: any) {
      alert(err.message || "Failed to record payment.");
    } finally {
      setSaving(false);
    }
  };

  // Delete Wage Record
  const handleDeleteWage = async (wage: KitchenWage) => {
    if (isOwner) {
      alert("Read-only access: Owner role cannot delete wage records.");
      return;
    }
    if (!window.confirm(`Delete wage record #${wage.id} (₹${formatMoney(wage.total_wage)}) for ${wage.staff_name}?`)) {
      return;
    }
    try {
      setSaving(true);
      const res = await fetchWithAuth(`${API_URL}/kitchen/wages/${wage.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete wage record.");
      setSuccess("Wage entry deleted.");
      await loadData();
      setTimeout(() => setSuccess(null), 3500);
    } catch (err: any) {
      alert(err.message || "Failed to delete wage entry.");
    } finally {
      setSaving(false);
    }
  };

  // Delete Payment Record
  const handleDeletePayment = async (p: KitchenPayment) => {
    if (isOwner) {
      alert("Read-only access: Owner role cannot delete payment records.");
      return;
    }
    if (!window.confirm(`Delete payment transaction #${p.id} (₹${formatMoney(p.amount)}) for ${p.staff_name}?`)) {
      return;
    }
    try {
      setSaving(true);
      const res = await fetchWithAuth(`${API_URL}/kitchen/payments/${p.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete payment record.");
      setSuccess("Payment entry deleted.");
      await loadData();
      setTimeout(() => setSuccess(null), 3500);
    } catch (err: any) {
      alert(err.message || "Failed to delete payment entry.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="app-layout">
      {/* Sidebar Navigation */}
      <AppSidebar activeRoute="/kitchen" />

      {/* Main Content Area */}
      <div className="main-content">
        {/* Top Header */}
        <header className="topbar">
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <MobileMenuButton />
            <div>
              <h1 style={{ fontSize: "20px", fontWeight: 800, margin: 0, color: "#1e0836", display: "flex", alignItems: "center", gap: "8px" }}>
                <span>🍳</span> Kitchen Staff & Wages
              </h1>
              <p style={{ margin: "3px 0 0 0", fontSize: "12px", color: "#6b5887" }}>
                Manage kitchen personnel, daily/monthly payroll, auto-wage calculation & manual disbursements
              </p>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {!isOwner && (
              <>
                <button
                  type="button"
                  onClick={openAutoWageModal}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    background: "#f5f3ff",
                    color: "#6d28d9",
                    border: "1px solid #ddd6fe",
                    borderRadius: "8px",
                    padding: "8px 14px",
                    fontWeight: 700,
                    fontSize: "12px",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                  title="Automatically calculate and post wages for monthly or daily staff"
                >
                  <span>⚡</span> Auto-Set Wages
                </button>

                <button
                  type="button"
                  onClick={() => openPaymentModal()}
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
                  title="Record manual wage payment with mode, reference & printable voucher"
                >
                  <span>💳</span> Record Payment
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setEditingStaffId(null);
                    setStaffForm(DEFAULT_STAFF_FORM);
                    setStaffModalOpen(true);
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
                  <span>+</span> Add Kitchen Staff
                </button>
              </>
            )}

            <button
              type="button"
              onClick={loadData}
              title="Refresh Data"
              style={{
                background: "#ffffff",
                border: "1px solid #e2d9f3",
                color: "#6b5887",
                borderRadius: "8px",
                padding: "8px 12px",
                cursor: "pointer",
                fontWeight: 600,
                fontSize: "12px",
              }}
            >
              🔄
            </button>

            <TopbarUserBadge />
          </div>
        </header>

        {/* Page Content */}
        <div className="page-content" style={{ padding: "24px" }}>
          <OwnerBanner />

          {/* Feedback Messages */}
          {success && (
            <div
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
              <span>✓ {success}</span>
              <button
                type="button"
                onClick={() => setSuccess(null)}
                style={{ border: "none", background: "transparent", color: "#0d6832", cursor: "pointer", fontWeight: 700 }}
              >
                ✕
              </button>
            </div>
          )}

          {error && (
            <div
              style={{
                background: "#fef2f2",
                border: "1px solid #fecaca",
                color: "#b91c1c",
                padding: "12px 18px",
                borderRadius: "8px",
                marginBottom: "20px",
                fontSize: "14px",
              }}
            >
              ✕ {error}
            </div>
          )}

          {/* KPI Summary Cards */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
              gap: "16px",
              marginBottom: "24px",
            }}
          >
            {/* Total Staff */}
            <div
              style={{
                background: "#ffffff",
                borderRadius: "12px",
                padding: "18px 20px",
                border: "1px solid #ece4f7",
                boxShadow: "0 2px 8px rgba(30, 8, 54, 0.04)",
              }}
            >
              <span style={{ fontSize: "11px", fontWeight: 700, color: "#826e9e", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Total Kitchen Staff
              </span>
              <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginTop: "8px" }}>
                <span style={{ fontSize: "26px", fontWeight: 800, color: "#1e0836" }}>
                  {summary ? summary.total_staff : staffList.length}
                </span>
                <span style={{ fontSize: "12px", color: "#059669", fontWeight: 600 }}>
                  ({summary ? summary.active_staff : staffList.filter((s) => s.status === "active").length} Active)
                </span>
              </div>
              <div style={{ marginTop: "6px", fontSize: "11px", color: "#7c3aed", fontWeight: 600 }}>
                {summary ? summary.monthly_staff_count : 0} Monthly • {summary ? summary.daily_staff_count : 0} Daily
              </div>
            </div>

            {/* Total Accrued Wages */}
            <div
              style={{
                background: "#ffffff",
                borderRadius: "12px",
                padding: "18px 20px",
                border: "1px solid #ece4f7",
                boxShadow: "0 2px 8px rgba(30, 8, 54, 0.04)",
              }}
            >
              <span style={{ fontSize: "11px", fontWeight: 700, color: "#826e9e", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Total Wages Accrued
              </span>
              <div style={{ marginTop: "8px" }}>
                <span style={{ fontSize: "26px", fontWeight: 800, color: "#3b176d" }}>
                  ₹{formatMoney(summary?.total_wages ?? 0)}
                </span>
              </div>
              <div style={{ marginTop: "6px", fontSize: "11px", color: "#826e9e" }}>
                Cumulative calculated wages
              </div>
            </div>

            {/* Total Paid */}
            <div
              style={{
                background: "#ffffff",
                borderRadius: "12px",
                padding: "18px 20px",
                border: "1px solid #ece4f7",
                boxShadow: "0 2px 8px rgba(30, 8, 54, 0.04)",
              }}
            >
              <span style={{ fontSize: "11px", fontWeight: 700, color: "#826e9e", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Total Disbursed / Paid
              </span>
              <div style={{ marginTop: "8px" }}>
                <span style={{ fontSize: "26px", fontWeight: 800, color: "#059669" }}>
                  ₹{formatMoney(summary?.total_paid ?? 0)}
                </span>
              </div>
              <div style={{ marginTop: "6px", fontSize: "11px", color: "#059669", fontWeight: 600 }}>
                ✓ Settled via Cash, UPI & Bank
              </div>
            </div>

            {/* Outstanding Balance */}
            <div
              style={{
                background: (summary?.total_pending_balance ?? 0) > 0 ? "linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)" : "#f0fdf4",
                borderRadius: "12px",
                padding: "18px 20px",
                border: (summary?.total_pending_balance ?? 0) > 0 ? "1px solid #fde68a" : "1px solid #bbf7d0",
                boxShadow: "0 2px 8px rgba(30, 8, 54, 0.04)",
              }}
            >
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  color: (summary?.total_pending_balance ?? 0) > 0 ? "#92400e" : "#166534",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                }}
              >
                Outstanding Balance Due
              </span>
              <div style={{ marginTop: "8px" }}>
                <span
                  style={{
                    fontSize: "26px",
                    fontWeight: 800,
                    color: (summary?.total_pending_balance ?? 0) > 0 ? "#b45309" : "#15803d",
                  }}
                >
                  ₹{formatMoney(summary?.total_pending_balance ?? 0)}
                </span>
              </div>
              <div
                style={{
                  marginTop: "6px",
                  fontSize: "11px",
                  fontWeight: 600,
                  color: (summary?.total_pending_balance ?? 0) > 0 ? "#b45309" : "#15803d",
                }}
              >
                {(summary?.total_pending_balance ?? 0) > 0
                  ? "⚠ Pending wage disbursements"
                  : "✓ All kitchen staff wages cleared"}
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              borderBottom: "1px solid #e2d9f3",
              marginBottom: "20px",
              gap: "12px",
              flexWrap: "wrap",
            }}
          >
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                type="button"
                onClick={() => setActiveTab("directory")}
                style={{
                  padding: "10px 16px",
                  border: "none",
                  background: "transparent",
                  borderBottom: activeTab === "directory" ? "3px solid #7c3aed" : "3px solid transparent",
                  color: activeTab === "directory" ? "#7c3aed" : "#6b5887",
                  fontWeight: activeTab === "directory" ? 800 : 600,
                  fontSize: "13px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <span>👨‍🍳</span> Staff Directory & Balances
                <span
                  style={{
                    background: activeTab === "directory" ? "#ede9fe" : "#f3f0f8",
                    color: activeTab === "directory" ? "#7c3aed" : "#826e9e",
                    padding: "2px 6px",
                    borderRadius: "10px",
                    fontSize: "11px",
                  }}
                >
                  {staffList.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("wages")}
                style={{
                  padding: "10px 16px",
                  border: "none",
                  background: "transparent",
                  borderBottom: activeTab === "wages" ? "3px solid #7c3aed" : "3px solid transparent",
                  color: activeTab === "wages" ? "#7c3aed" : "#6b5887",
                  fontWeight: activeTab === "wages" ? 800 : 600,
                  fontSize: "13px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <span>📜</span> Wage Accrual Ledger
                <span
                  style={{
                    background: activeTab === "wages" ? "#ede9fe" : "#f3f0f8",
                    color: activeTab === "wages" ? "#7c3aed" : "#826e9e",
                    padding: "2px 6px",
                    borderRadius: "10px",
                    fontSize: "11px",
                  }}
                >
                  {wages.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("payments")}
                style={{
                  padding: "10px 16px",
                  border: "none",
                  background: "transparent",
                  borderBottom: activeTab === "payments" ? "3px solid #7c3aed" : "3px solid transparent",
                  color: activeTab === "payments" ? "#7c3aed" : "#6b5887",
                  fontWeight: activeTab === "payments" ? 800 : 600,
                  fontSize: "13px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <span>💳</span> Payment History & Receipts
                <span
                  style={{
                    background: activeTab === "payments" ? "#ede9fe" : "#f3f0f8",
                    color: activeTab === "payments" ? "#7c3aed" : "#826e9e",
                    padding: "2px 6px",
                    borderRadius: "10px",
                    fontSize: "11px",
                  }}
                >
                  {payments.length}
                </span>
              </button>
            </div>

            {/* Filter pills if in directory */}
            {activeTab === "directory" && (
              <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                <span style={{ fontSize: "11px", color: "#826e9e", fontWeight: 700 }}>Filter:</span>
                {(["all", "monthly", "daily", "pending"] as const).map((ft) => (
                  <button
                    key={ft}
                    type="button"
                    onClick={() => setFilterType(ft)}
                    style={{
                      padding: "4px 10px",
                      borderRadius: "6px",
                      fontSize: "11px",
                      fontWeight: 700,
                      cursor: "pointer",
                      border: "none",
                      background: filterType === ft ? "#7c3aed" : "#f3f0f8",
                      color: filterType === ft ? "#ffffff" : "#6b5887",
                      textTransform: "capitalize",
                    }}
                  >
                    {ft === "pending" ? "Pending Due" : ft}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* TAB 1: STAFF DIRECTORY */}
          {activeTab === "directory" && (
            <div>
              {/* Search & Actions Bar */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "12px",
                  marginBottom: "16px",
                  flexWrap: "wrap",
                }}
              >
                <div style={{ position: "relative", minWidth: "280px", flex: 1, maxWidth: "420px" }}>
                  <input
                    type="text"
                    placeholder="Search by staff name, role, mobile..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "9px 12px 9px 34px",
                      borderRadius: "8px",
                      border: "1px solid #ddd6fe",
                      fontSize: "13px",
                      outline: "none",
                      background: "#ffffff",
                    }}
                  />
                  <span style={{ position: "absolute", left: "10px", top: "9px", color: "#9ca3af", fontSize: "14px" }}>
                    🔍
                  </span>
                  {search && (
                    <button
                      type="button"
                      onClick={() => setSearch("")}
                      style={{
                        position: "absolute",
                        right: "10px",
                        top: "8px",
                        border: "none",
                        background: "transparent",
                        color: "#9ca3af",
                        cursor: "pointer",
                      }}
                    >
                      ✕
                    </button>
                  )}
                </div>

                <div style={{ fontSize: "12px", color: "#6b5887" }}>
                  Showing <strong>{filteredStaff.length}</strong> of {staffList.length} staff
                </div>
              </div>

              {/* Staff Table */}
              <div
                style={{
                  background: "#ffffff",
                  borderRadius: "12px",
                  border: "1px solid #ece4f7",
                  boxShadow: "0 2px 8px rgba(30, 8, 54, 0.04)",
                  overflowX: "auto",
                }}
              >
                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "13px" }}>
                  <thead>
                    <tr style={{ background: "#fbf9fd", borderBottom: "1px solid #ece4f7", color: "#6b5887" }}>
                      <th style={{ padding: "12px 16px", fontWeight: 700 }}>Staff Name</th>
                      <th style={{ padding: "12px 16px", fontWeight: 700 }}>Role</th>
                      <th style={{ padding: "12px 16px", fontWeight: 700 }}>Wage Type & Rate</th>
                      <th style={{ padding: "12px 16px", fontWeight: 700 }}>Status</th>
                      <th style={{ padding: "12px 16px", fontWeight: 700, textAlign: "right" }}>Total Wages</th>
                      <th style={{ padding: "12px 16px", fontWeight: 700, textAlign: "right" }}>Paid</th>
                      <th style={{ padding: "12px 16px", fontWeight: 700, textAlign: "right" }}>Balance Due</th>
                      <th style={{ padding: "12px 16px", fontWeight: 700, textAlign: "center" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={8} style={{ padding: "36px", textAlign: "center", color: "#826e9e" }}>
                          Loading kitchen personnel records...
                        </td>
                      </tr>
                    ) : filteredStaff.length === 0 ? (
                      <tr>
                        <td colSpan={8} style={{ padding: "36px", textAlign: "center", color: "#826e9e" }}>
                          No kitchen staff members found matching your search.
                        </td>
                      </tr>
                    ) : (
                      filteredStaff.map((staff) => {
                        const isMonthly = staff.wage_type === "monthly";
                        const bal = Number(staff.balance);

                        return (
                          <tr
                            key={staff.id}
                            style={{
                              borderBottom: "1px solid #f3eff9",
                              transition: "background 0.15s ease",
                            }}
                          >
                            <td style={{ padding: "12px 16px" }}>
                              <div style={{ fontWeight: 700, color: "#1e0836" }}>{staff.name}</div>
                              {staff.mobile && (
                                <div style={{ fontSize: "11px", color: "#6b5887", marginTop: "2px" }}>
                                  📞 {staff.mobile}
                                </div>
                              )}
                            </td>

                            <td style={{ padding: "12px 16px" }}>
                              <span
                                style={{
                                  background: "#f5f3ff",
                                  color: "#6d28d9",
                                  padding: "3px 8px",
                                  borderRadius: "6px",
                                  fontSize: "12px",
                                  fontWeight: 600,
                                }}
                              >
                                {staff.kitchen_role}
                              </span>
                            </td>

                            <td style={{ padding: "12px 16px" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                <span
                                  style={{
                                    background: isMonthly ? "#eff6ff" : "#ecfdf5",
                                    color: isMonthly ? "#1d4ed8" : "#047857",
                                    border: isMonthly ? "1px solid #bfdbfe" : "1px solid #a7f3d0",
                                    padding: "2px 7px",
                                    borderRadius: "12px",
                                    fontSize: "11px",
                                    fontWeight: 700,
                                    textTransform: "capitalize",
                                  }}
                                >
                                  {isMonthly ? "📅 Monthly" : "⏱️ Daily"}
                                </span>
                                <strong style={{ color: "#1e0836", fontSize: "13px" }}>
                                  ₹{formatMoney(staff.wage_rate)}
                                  <span style={{ fontSize: "11px", color: "#6b5887", fontWeight: 400 }}>
                                    {isMonthly ? "/mo" : "/day"}
                                  </span>
                                </strong>
                              </div>
                            </td>

                            <td style={{ padding: "12px 16px" }}>
                              <span
                                style={{
                                  background: staff.status === "active" ? "#ecfdf5" : "#fef2f2",
                                  color: staff.status === "active" ? "#047857" : "#b91c1c",
                                  padding: "2px 8px",
                                  borderRadius: "6px",
                                  fontSize: "11px",
                                  fontWeight: 700,
                                  textTransform: "capitalize",
                                }}
                              >
                                {staff.status}
                              </span>
                            </td>

                            <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: 600, color: "#3b176d" }}>
                              ₹{formatMoney(staff.total_wages)}
                            </td>

                            <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: 600, color: "#059669" }}>
                              ₹{formatMoney(staff.total_paid)}
                            </td>

                            <td style={{ padding: "12px 16px", textAlign: "right" }}>
                              <span
                                style={{
                                  background: bal > 0 ? "#fef3c7" : "#f0fdf4",
                                  color: bal > 0 ? "#b45309" : "#15803d",
                                  padding: "3px 8px",
                                  borderRadius: "6px",
                                  fontWeight: 800,
                                  fontSize: "12px",
                                }}
                              >
                                ₹{formatMoney(bal)}
                              </span>
                            </td>

                            <td style={{ padding: "12px 16px", textAlign: "center" }}>
                              <div style={{ display: "inline-flex", gap: "6px" }}>
                                {!isOwner && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => openQuickWageModal(staff)}
                                      title="Record or calculate wage for this staff"
                                      style={{
                                        background: "#f5f3ff",
                                        border: "1px solid #ddd6fe",
                                        color: "#6d28d9",
                                        borderRadius: "6px",
                                        padding: "4px 8px",
                                        fontSize: "11px",
                                        fontWeight: 700,
                                        cursor: "pointer",
                                      }}
                                    >
                                      ⚡ Wage
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => openPaymentModal(staff)}
                                      title="Record wage disbursement payment"
                                      style={{
                                        background: "#ecfdf5",
                                        border: "1px solid #a7f3d0",
                                        color: "#047857",
                                        borderRadius: "6px",
                                        padding: "4px 8px",
                                        fontSize: "11px",
                                        fontWeight: 700,
                                        cursor: "pointer",
                                      }}
                                    >
                                      💳 Pay
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => openEditStaff(staff)}
                                      title="Edit staff details"
                                      style={{
                                        background: "#ffffff",
                                        border: "1px solid #e2d9f3",
                                        color: "#6b5887",
                                        borderRadius: "6px",
                                        padding: "4px 8px",
                                        fontSize: "11px",
                                        cursor: "pointer",
                                      }}
                                    >
                                      ✏️
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => handleDeleteStaff(staff)}
                                      title="Delete staff record"
                                      style={{
                                        background: "#fef2f2",
                                        border: "1px solid #fecaca",
                                        color: "#b91c1c",
                                        borderRadius: "6px",
                                        padding: "4px 8px",
                                        fontSize: "11px",
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
          )}

          {/* TAB 2: WAGE ACCRUAL LEDGER */}
          {activeTab === "wages" && (
            <div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "16px",
                  flexWrap: "wrap",
                  gap: "10px",
                }}
              >
                <div>
                  <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "#1e0836" }}>
                    Wage Accrual Entries
                  </h3>
                  <span style={{ fontSize: "12px", color: "#826e9e" }}>
                    Automated & manual wage calculations computed based on staff daily rates and monthly attendance
                  </span>
                </div>

                {!isOwner && (
                  <button
                    type="button"
                    onClick={openAutoWageModal}
                    style={{
                      background: "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)",
                      color: "#ffffff",
                      border: "none",
                      borderRadius: "8px",
                      padding: "8px 16px",
                      fontWeight: 700,
                      fontSize: "12px",
                      cursor: "pointer",
                    }}
                  >
                    ⚡ Run Auto-Wage Calculation
                  </button>
                )}
              </div>

              <div
                style={{
                  background: "#ffffff",
                  borderRadius: "12px",
                  border: "1px solid #ece4f7",
                  boxShadow: "0 2px 8px rgba(30, 8, 54, 0.04)",
                  overflowX: "auto",
                }}
              >
                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "13px" }}>
                  <thead>
                    <tr style={{ background: "#fbf9fd", borderBottom: "1px solid #ece4f7", color: "#6b5887" }}>
                      <th style={{ padding: "12px 16px", fontWeight: 700 }}>Recorded Date</th>
                      <th style={{ padding: "12px 16px", fontWeight: 700 }}>Staff Name</th>
                      <th style={{ padding: "12px 16px", fontWeight: 700 }}>Period</th>
                      <th style={{ padding: "12px 16px", fontWeight: 700 }}>Wage Type</th>
                      <th style={{ padding: "12px 16px", fontWeight: 700, textAlign: "right" }}>Days</th>
                      <th style={{ padding: "12px 16px", fontWeight: 700, textAlign: "right" }}>Base Rate</th>
                      <th style={{ padding: "12px 16px", fontWeight: 700, textAlign: "right" }}>Bonus</th>
                      <th style={{ padding: "12px 16px", fontWeight: 700, textAlign: "right" }}>Deduction</th>
                      <th style={{ padding: "12px 16px", fontWeight: 700, textAlign: "right" }}>Total Accrued</th>
                      <th style={{ padding: "12px 16px", fontWeight: 700 }}>Notes</th>
                      {!isOwner && <th style={{ padding: "12px 16px", fontWeight: 700, textAlign: "center" }}>Action</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {wages.length === 0 ? (
                      <tr>
                        <td colSpan={11} style={{ padding: "36px", textAlign: "center", color: "#826e9e" }}>
                          No wage records generated yet. Click "Run Auto-Wage Calculation" or "Wage" on any staff member to record.
                        </td>
                      </tr>
                    ) : (
                      wages.map((w) => (
                        <tr key={w.id} style={{ borderBottom: "1px solid #f3eff9" }}>
                          <td style={{ padding: "12px 16px", color: "#6b5887" }}>
                            {formatDate(w.date_recorded)}
                          </td>
                          <td style={{ padding: "12px 16px", fontWeight: 700, color: "#1e0836" }}>
                            {w.staff_name || `Staff #${w.staff_id}`}
                          </td>
                          <td style={{ padding: "12px 16px" }}>
                            <span style={{ background: "#f3f0f8", color: "#6b5887", padding: "2px 6px", borderRadius: "4px", fontSize: "11px", fontWeight: 700 }}>
                              {w.period}
                            </span>
                          </td>
                          <td style={{ padding: "12px 16px" }}>
                            <span
                              style={{
                                background: w.wage_type === "monthly" ? "#eff6ff" : "#ecfdf5",
                                color: w.wage_type === "monthly" ? "#1d4ed8" : "#047857",
                                padding: "2px 6px",
                                borderRadius: "4px",
                                fontSize: "11px",
                                fontWeight: 700,
                                textTransform: "capitalize",
                              }}
                            >
                              {w.wage_type}
                            </span>
                          </td>
                          <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: 600 }}>
                            {w.days_worked}
                          </td>
                          <td style={{ padding: "12px 16px", textAlign: "right", color: "#6b5887" }}>
                            ₹{formatMoney(w.base_rate)}
                          </td>
                          <td style={{ padding: "12px 16px", textAlign: "right", color: "#059669" }}>
                            +{formatMoney(w.bonus)}
                          </td>
                          <td style={{ padding: "12px 16px", textAlign: "right", color: "#b91c1c" }}>
                            -{formatMoney(w.deduction)}
                          </td>
                          <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: 800, color: "#7c3aed" }}>
                            ₹{formatMoney(w.total_wage)}
                          </td>
                          <td style={{ padding: "12px 16px", color: "#6b5887", fontSize: "12px" }}>
                            {w.notes || "-"}
                          </td>
                          {!isOwner && (
                            <td style={{ padding: "12px 16px", textAlign: "center" }}>
                              <button
                                type="button"
                                onClick={() => handleDeleteWage(w)}
                                title="Delete wage record"
                                style={{
                                  background: "#fef2f2",
                                  border: "1px solid #fecaca",
                                  color: "#b91c1c",
                                  borderRadius: "6px",
                                  padding: "4px 8px",
                                  fontSize: "11px",
                                  cursor: "pointer",
                                }}
                              >
                                🗑️
                              </button>
                            </td>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: PAYMENT HISTORY & RECEIPTS */}
          {activeTab === "payments" && (
            <div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "16px",
                  flexWrap: "wrap",
                  gap: "10px",
                }}
              >
                <div>
                  <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "#1e0836" }}>
                    Staff Payment Transactions & Receipts
                  </h3>
                  <span style={{ fontSize: "12px", color: "#826e9e" }}>
                    Manual disbursement payments with payment mode, references, and official printable payment vouchers
                  </span>
                </div>

                {!isOwner && (
                  <button
                    type="button"
                    onClick={() => openPaymentModal()}
                    style={{
                      background: "linear-gradient(135deg, #059669 0%, #047857 100%)",
                      color: "#ffffff",
                      border: "none",
                      borderRadius: "8px",
                      padding: "8px 16px",
                      fontWeight: 700,
                      fontSize: "12px",
                      cursor: "pointer",
                    }}
                  >
                    💳 Record New Payment
                  </button>
                )}
              </div>

              <div
                style={{
                  background: "#ffffff",
                  borderRadius: "12px",
                  border: "1px solid #ece4f7",
                  boxShadow: "0 2px 8px rgba(30, 8, 54, 0.04)",
                  overflowX: "auto",
                }}
              >
                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "13px" }}>
                  <thead>
                    <tr style={{ background: "#fbf9fd", borderBottom: "1px solid #ece4f7", color: "#6b5887" }}>
                      <th style={{ padding: "12px 16px", fontWeight: 700 }}>Payment Date</th>
                      <th style={{ padding: "12px 16px", fontWeight: 700 }}>Staff Name</th>
                      <th style={{ padding: "12px 16px", fontWeight: 700 }}>Payment Mode</th>
                      <th style={{ padding: "12px 16px", fontWeight: 700 }}>Reference #</th>
                      <th style={{ padding: "12px 16px", fontWeight: 700, textAlign: "right" }}>Amount Paid</th>
                      <th style={{ padding: "12px 16px", fontWeight: 700 }}>Note</th>
                      <th style={{ padding: "12px 16px", fontWeight: 700, textAlign: "center" }}>Voucher Receipt</th>
                      {!isOwner && <th style={{ padding: "12px 16px", fontWeight: 700, textAlign: "center" }}>Action</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {payments.length === 0 ? (
                      <tr>
                        <td colSpan={8} style={{ padding: "36px", textAlign: "center", color: "#826e9e" }}>
                          No staff payments recorded yet. Click "Record New Payment" to log disbursements.
                        </td>
                      </tr>
                    ) : (
                      payments.map((p) => (
                        <tr key={p.id} style={{ borderBottom: "1px solid #f3eff9" }}>
                          <td style={{ padding: "12px 16px", color: "#6b5887" }}>
                            {formatDate(p.payment_date)}
                          </td>
                          <td style={{ padding: "12px 16px", fontWeight: 700, color: "#1e0836" }}>
                            {p.staff_name || `Staff #${p.staff_id}`}
                          </td>
                          <td style={{ padding: "12px 16px" }}>
                            <span
                              style={{
                                background: "#f5f3ff",
                                color: "#6d28d9",
                                border: "1px solid #ddd6fe",
                                padding: "2px 8px",
                                borderRadius: "6px",
                                fontSize: "11px",
                                fontWeight: 700,
                              }}
                            >
                              {p.payment_mode}
                            </span>
                          </td>
                          <td style={{ padding: "12px 16px", color: "#6b5887", fontSize: "12px" }}>
                            {p.reference_no || "-"}
                          </td>
                          <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: 800, color: "#059669" }}>
                            ₹{formatMoney(p.amount)}
                          </td>
                          <td style={{ padding: "12px 16px", color: "#6b5887", fontSize: "12px" }}>
                            {p.note || "-"}
                          </td>
                          <td style={{ padding: "12px 16px", textAlign: "center" }}>
                            <button
                              type="button"
                              onClick={() => {
                                setVoucherPayment(p);
                                setVoucherModalOpen(true);
                              }}
                              style={{
                                background: "#f5f3ff",
                                border: "1px solid #ddd6fe",
                                color: "#6d28d9",
                                borderRadius: "6px",
                                padding: "4px 10px",
                                fontSize: "11px",
                                fontWeight: 700,
                                cursor: "pointer",
                              }}
                            >
                              🧾 View / Print
                            </button>
                          </td>
                          {!isOwner && (
                            <td style={{ padding: "12px 16px", textAlign: "center" }}>
                              <button
                                type="button"
                                onClick={() => handleDeletePayment(p)}
                                title="Delete payment entry"
                                style={{
                                  background: "#fef2f2",
                                  border: "1px solid #fecaca",
                                  color: "#b91c1c",
                                  borderRadius: "6px",
                                  padding: "4px 8px",
                                  fontSize: "11px",
                                  cursor: "pointer",
                                }}
                              >
                                🗑️
                              </button>
                            </td>
                          )}
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

      {/* ============================================================ */}
      {/* MODAL 1: ADD / EDIT KITCHEN STAFF                             */}
      {/* ============================================================ */}
      {staffModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 4, 25, 0.6)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: "16px",
          }}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: "14px",
              width: "100%",
              maxWidth: "520px",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.2)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "18px 24px",
                borderBottom: "1px solid #e2d9f3",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: "#fbf9fd",
              }}
            >
              <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 800, color: "#1e0836" }}>
                {editingStaffId ? "Edit Kitchen Staff Member" : "Add New Kitchen Staff Member"}
              </h3>
              <button
                type="button"
                onClick={() => setStaffModalOpen(false)}
                style={{ border: "none", background: "transparent", fontSize: "18px", color: "#6b5887", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveStaff} style={{ padding: "24px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginBottom: "14px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#4c3a64", marginBottom: "5px" }}>
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ramesh Kumar"
                    value={staffForm.name}
                    onChange={(e) => setStaffForm({ ...staffForm, name: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: "6px",
                      border: "1px solid #ddd6fe",
                      fontSize: "13px",
                      outline: "none",
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#4c3a64", marginBottom: "5px" }}>
                    Mobile Number
                  </label>
                  <input
                    type="tel"
                    placeholder="e.g. 9876543210"
                    value={staffForm.mobile}
                    onChange={(e) => setStaffForm({ ...staffForm, mobile: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: "6px",
                      border: "1px solid #ddd6fe",
                      fontSize: "13px",
                      outline: "none",
                    }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginBottom: "14px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#4c3a64", marginBottom: "5px" }}>
                    Kitchen Role *
                  </label>
                  <select
                    value={staffForm.kitchen_role}
                    onChange={(e) => setStaffForm({ ...staffForm, kitchen_role: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: "6px",
                      border: "1px solid #ddd6fe",
                      fontSize: "13px",
                      outline: "none",
                      background: "#ffffff",
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
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#4c3a64", marginBottom: "5px" }}>
                    Status
                  </label>
                  <select
                    value={staffForm.status}
                    onChange={(e) => setStaffForm({ ...staffForm, status: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: "6px",
                      border: "1px solid #ddd6fe",
                      fontSize: "13px",
                      outline: "none",
                      background: "#ffffff",
                    }}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              {/* Wage Type Selection (Monthly vs Daily) */}
              <div
                style={{
                  background: "#fbf9fd",
                  border: "1px solid #e9dff7",
                  borderRadius: "10px",
                  padding: "14px",
                  marginBottom: "16px",
                }}
              >
                <label style={{ display: "block", fontSize: "12px", fontWeight: 800, color: "#3b176d", marginBottom: "8px" }}>
                  Wage Structure *
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "12px" }}>
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      padding: "10px",
                      borderRadius: "8px",
                      border: staffForm.wage_type === "monthly" ? "2px solid #7c3aed" : "1px solid #ddd6fe",
                      background: staffForm.wage_type === "monthly" ? "#f5f3ff" : "#ffffff",
                      cursor: "pointer",
                      fontSize: "12px",
                      fontWeight: 700,
                      color: staffForm.wage_type === "monthly" ? "#6d28d9" : "#4c3a64",
                    }}
                  >
                    <input
                      type="radio"
                      name="wage_type"
                      value="monthly"
                      checked={staffForm.wage_type === "monthly"}
                      onChange={(e) => setStaffForm({ ...staffForm, wage_type: e.target.value })}
                    />
                    <div>
                      <div>📅 Monthly Staff</div>
                      <small style={{ fontWeight: 400, color: "#826e9e" }}>Fixed salary / month</small>
                    </div>
                  </label>

                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      padding: "10px",
                      borderRadius: "8px",
                      border: staffForm.wage_type === "daily" ? "2px solid #059669" : "1px solid #ddd6fe",
                      background: staffForm.wage_type === "daily" ? "#ecfdf5" : "#ffffff",
                      cursor: "pointer",
                      fontSize: "12px",
                      fontWeight: 700,
                      color: staffForm.wage_type === "daily" ? "#047857" : "#4c3a64",
                    }}
                  >
                    <input
                      type="radio"
                      name="wage_type"
                      value="daily"
                      checked={staffForm.wage_type === "daily"}
                      onChange={(e) => setStaffForm({ ...staffForm, wage_type: e.target.value })}
                    />
                    <div>
                      <div>⏱️ Daily Staff</div>
                      <small style={{ fontWeight: 400, color: "#826e9e" }}>Per-day wage rate</small>
                    </div>
                  </label>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#4c3a64", marginBottom: "5px" }}>
                    {staffForm.wage_type === "monthly" ? "Monthly Salary (₹) *" : "Daily Wage Rate (₹) *"}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    placeholder={staffForm.wage_type === "monthly" ? "e.g. 18000" : "e.g. 700"}
                    value={staffForm.wage_rate}
                    onChange={(e) => setStaffForm({ ...staffForm, wage_rate: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: "6px",
                      border: "1px solid #ddd6fe",
                      fontSize: "14px",
                      fontWeight: 700,
                      outline: "none",
                    }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginBottom: "14px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#4c3a64", marginBottom: "5px" }}>
                    Joining Date
                  </label>
                  <input
                    type="date"
                    value={staffForm.joined_date}
                    onChange={(e) => setStaffForm({ ...staffForm, joined_date: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: "6px",
                      border: "1px solid #ddd6fe",
                      fontSize: "13px",
                      outline: "none",
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#4c3a64", marginBottom: "5px" }}>
                    Address
                  </label>
                  <input
                    type="text"
                    placeholder="City / Area"
                    value={staffForm.address}
                    onChange={(e) => setStaffForm({ ...staffForm, address: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: "6px",
                      border: "1px solid #ddd6fe",
                      fontSize: "13px",
                      outline: "none",
                    }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: "20px" }}>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#4c3a64", marginBottom: "5px" }}>
                  Notes / Specialization
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Expert in South Indian dishes and tandoor..."
                  value={staffForm.notes}
                  onChange={(e) => setStaffForm({ ...staffForm, notes: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: "6px",
                    border: "1px solid #ddd6fe",
                    fontSize: "13px",
                    outline: "none",
                  }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button
                  type="button"
                  onClick={() => setStaffModalOpen(false)}
                  style={{
                    background: "#f3eff9",
                    color: "#6b5887",
                    border: "none",
                    borderRadius: "8px",
                    padding: "9px 16px",
                    fontWeight: 600,
                    fontSize: "13px",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    background: "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "8px",
                    padding: "9px 20px",
                    fontWeight: 700,
                    fontSize: "13px",
                    cursor: "pointer",
                    boxShadow: "0 4px 14px rgba(124, 58, 237, 0.3)",
                  }}
                >
                  {saving ? "Saving..." : editingStaffId ? "Update Staff" : "Add Staff Member"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL 2: AUTO-SET WAGES (BATCH CALCULATION)                   */}
      {/* ============================================================ */}
      {autoWageModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 4, 25, 0.6)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: "16px",
          }}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: "14px",
              width: "100%",
              maxWidth: "560px",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.2)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "18px 24px",
                borderBottom: "1px solid #e2d9f3",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: "linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)",
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 800, color: "#5b21b6", display: "flex", alignItems: "center", gap: "6px" }}>
                  <span>⚡</span> Auto-Set Kitchen Wages
                </h3>
                <small style={{ color: "#7c3aed", fontSize: "11px", fontWeight: 600 }}>
                  Automated computation for Daily Staff (Days × Daily Rate) & Monthly Staff
                </small>
              </div>
              <button
                type="button"
                onClick={() => setAutoWageModalOpen(false)}
                style={{ border: "none", background: "transparent", fontSize: "18px", color: "#6b5887", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRunAutoWage} style={{ padding: "24px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginBottom: "16px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#4c3a64", marginBottom: "5px" }}>
                    Period / Month (YYYY-MM) *
                  </label>
                  <input
                    type="month"
                    required
                    value={autoPeriod}
                    onChange={(e) => setAutoPeriod(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: "6px",
                      border: "1px solid #ddd6fe",
                      fontSize: "13px",
                      outline: "none",
                      fontWeight: 700,
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#4c3a64", marginBottom: "5px" }}>
                    Default Days Worked *
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    required
                    value={autoDaysWorked}
                    onChange={(e) => setAutoDaysWorked(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: "6px",
                      border: "1px solid #ddd6fe",
                      fontSize: "13px",
                      outline: "none",
                      fontWeight: 700,
                    }}
                  />
                  <small style={{ color: "#826e9e", fontSize: "10px", marginTop: "2px", display: "block" }}>
                    For Daily Staff: Rate × {autoDaysWorked} days. For Monthly: Pro-rated if &lt; 30.
                  </small>
                </div>
              </div>

              {/* Staff Selectable List */}
              <div style={{ marginBottom: "16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                  <label style={{ fontSize: "12px", fontWeight: 700, color: "#4c3a64" }}>
                    Target Staff ({autoSelectedStaffIds.length} of {staffList.filter((s) => s.status === "active").length} selected)
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const activeStaff = staffList.filter((s) => s.status === "active");
                      if (autoSelectAll) {
                        setAutoSelectedStaffIds([]);
                        setAutoSelectAll(false);
                      } else {
                        setAutoSelectedStaffIds(activeStaff.map((s) => s.id));
                        setAutoSelectAll(true);
                      }
                    }}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "#7c3aed",
                      fontSize: "11px",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    {autoSelectAll ? "Deselect All" : "Select All Active"}
                  </button>
                </div>

                <div
                  style={{
                    maxHeight: "180px",
                    overflowY: "auto",
                    border: "1px solid #ddd6fe",
                    borderRadius: "8px",
                    padding: "8px",
                    background: "#fbf9fd",
                  }}
                >
                  {staffList
                    .filter((s) => s.status === "active")
                    .map((s) => {
                      const isChecked = autoSelectedStaffIds.includes(s.id);
                      const isMonthly = s.wage_type === "monthly";
                      const days = Number(autoDaysWorked) || 1;
                      const estimated = isMonthly
                        ? days >= 30
                          ? s.wage_rate
                          : Math.round((s.wage_rate / 30) * days)
                        : s.wage_rate * days;

                      return (
                        <label
                          key={s.id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "6px 8px",
                            borderRadius: "6px",
                            background: isChecked ? "#ede9fe" : "transparent",
                            cursor: "pointer",
                            marginBottom: "4px",
                            fontSize: "12px",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleStaffSelection(s.id)}
                            />
                            <strong>{s.name}</strong>
                            <span style={{ fontSize: "11px", color: "#6b5887" }}>
                              ({s.kitchen_role}) • {isMonthly ? "Monthly" : "Daily"}
                            </span>
                          </div>
                          <span style={{ fontWeight: 700, color: "#6d28d9" }}>
                            ₹{formatMoney(estimated)}
                          </span>
                        </label>
                      );
                    })}
                </div>
              </div>

              <div
                style={{
                  background: "#eff6ff",
                  border: "1px solid #bfdbfe",
                  borderRadius: "8px",
                  padding: "10px 14px",
                  marginBottom: "20px",
                  fontSize: "11px",
                  color: "#1e40af",
                }}
              >
                💡 <strong>Auto-calculation rule:</strong> Daily workers will accrue{" "}
                <code>{autoDaysWorked} days × Daily Rate</code>. Monthly workers will accrue their standard monthly salary.
                Balances update automatically.
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button
                  type="button"
                  onClick={() => setAutoWageModalOpen(false)}
                  style={{
                    background: "#f3eff9",
                    color: "#6b5887",
                    border: "none",
                    borderRadius: "8px",
                    padding: "9px 16px",
                    fontWeight: 600,
                    fontSize: "13px",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || autoSelectedStaffIds.length === 0}
                  style={{
                    background: "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "8px",
                    padding: "9px 20px",
                    fontWeight: 700,
                    fontSize: "13px",
                    cursor: "pointer",
                    boxShadow: "0 4px 14px rgba(124, 58, 237, 0.3)",
                  }}
                >
                  {saving ? "Calculating..." : `Set Wages for ${autoSelectedStaffIds.length} Staff`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL 3: INDIVIDUAL QUICK WAGE MODAL                         */}
      {/* ============================================================ */}
      {quickWageModalOpen && quickWageStaff && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 4, 25, 0.6)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: "16px",
          }}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: "14px",
              width: "100%",
              maxWidth: "480px",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.2)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "18px 24px",
                borderBottom: "1px solid #e2d9f3",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: "#fbf9fd",
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 800, color: "#1e0836" }}>
                  Record Wage: {quickWageStaff.name}
                </h3>
                <small style={{ color: "#6b5887", fontSize: "11px" }}>
                  {quickWageStaff.kitchen_role} • {quickWageStaff.wage_type === "monthly" ? "Monthly Staff" : "Daily Staff"} (₹
                  {formatMoney(quickWageStaff.wage_rate)})
                </small>
              </div>
              <button
                type="button"
                onClick={() => setQuickWageModalOpen(false)}
                style={{ border: "none", background: "transparent", fontSize: "18px", color: "#6b5887", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveQuickWage} style={{ padding: "24px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginBottom: "14px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#4c3a64", marginBottom: "5px" }}>
                    Period *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 2026-10"
                    value={quickPeriod}
                    onChange={(e) => setQuickPeriod(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: "6px",
                      border: "1px solid #ddd6fe",
                      fontSize: "13px",
                      outline: "none",
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#4c3a64", marginBottom: "5px" }}>
                    Days Worked *
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    required
                    value={quickDaysWorked}
                    onChange={(e) => setQuickDaysWorked(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: "6px",
                      border: "1px solid #ddd6fe",
                      fontSize: "13px",
                      outline: "none",
                    }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginBottom: "14px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#4c3a64", marginBottom: "5px" }}>
                    Bonus (₹)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={quickBonus}
                    onChange={(e) => setQuickBonus(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: "6px",
                      border: "1px solid #ddd6fe",
                      fontSize: "13px",
                      outline: "none",
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#4c3a64", marginBottom: "5px" }}>
                    Deduction (₹)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={quickDeduction}
                    onChange={(e) => setQuickDeduction(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: "6px",
                      border: "1px solid #ddd6fe",
                      fontSize: "13px",
                      outline: "none",
                    }}
                  />
                </div>
              </div>

              {/* Live Preview Box */}
              {(() => {
                const days = Number(quickDaysWorked) || 1;
                const isMonthly = quickWageStaff.wage_type === "monthly";
                const base = isMonthly
                  ? days >= 30
                    ? quickWageStaff.wage_rate
                    : Math.round((quickWageStaff.wage_rate / 30) * days)
                  : quickWageStaff.wage_rate * days;
                const bonus = Number(quickBonus) || 0;
                const deduction = Number(quickDeduction) || 0;
                const total = Math.max(0, base + bonus - deduction);

                return (
                  <div
                    style={{
                      background: "#f5f3ff",
                      border: "1px solid #ddd6fe",
                      borderRadius: "8px",
                      padding: "12px 14px",
                      marginBottom: "16px",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "#6b5887", marginBottom: "4px" }}>
                      <span>Base Wage ({days} {days === 1 ? "day" : "days"} @ ₹{formatMoney(quickWageStaff.wage_rate)}):</span>
                      <strong>₹{formatMoney(base)}</strong>
                    </div>
                    {bonus > 0 && (
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "#059669", marginBottom: "4px" }}>
                        <span>+ Bonus:</span>
                        <strong>+₹{formatMoney(bonus)}</strong>
                      </div>
                    )}
                    {deduction > 0 && (
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "#b91c1c", marginBottom: "4px" }}>
                        <span>- Deduction:</span>
                        <strong>-₹{formatMoney(deduction)}</strong>
                      </div>
                    )}
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: "14px",
                        fontWeight: 800,
                        color: "#5b21b6",
                        borderTop: "1px dashed #ddd6fe",
                        paddingTop: "6px",
                        marginTop: "6px",
                      }}
                    >
                      <span>Total Accrued Wage:</span>
                      <span>₹{formatMoney(total)}</span>
                    </div>
                  </div>
                );
              })()}

              <div style={{ marginBottom: "20px" }}>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#4c3a64", marginBottom: "5px" }}>
                  Notes / Reason
                </label>
                <input
                  type="text"
                  placeholder="e.g. Festival extra shift, overtime bonus..."
                  value={quickNotes}
                  onChange={(e) => setQuickNotes(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: "6px",
                    border: "1px solid #ddd6fe",
                    fontSize: "13px",
                    outline: "none",
                  }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button
                  type="button"
                  onClick={() => setQuickWageModalOpen(false)}
                  style={{
                    background: "#f3eff9",
                    color: "#6b5887",
                    border: "none",
                    borderRadius: "8px",
                    padding: "9px 16px",
                    fontWeight: 600,
                    fontSize: "13px",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    background: "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "8px",
                    padding: "9px 20px",
                    fontWeight: 700,
                    fontSize: "13px",
                    cursor: "pointer",
                    boxShadow: "0 4px 14px rgba(124, 58, 237, 0.3)",
                  }}
                >
                  {saving ? "Posting..." : "Confirm & Post Wage"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL 4: RECORD MANUAL STAFF PAYMENT                          */}
      {/* ============================================================ */}
      {paymentModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 4, 25, 0.6)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: "16px",
          }}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: "14px",
              width: "100%",
              maxWidth: "500px",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.2)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "18px 24px",
                borderBottom: "1px solid #e2d9f3",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: "linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)",
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 800, color: "#065f46", display: "flex", alignItems: "center", gap: "6px" }}>
                  <span>💳</span> Record Staff Wage Payment
                </h3>
                <small style={{ color: "#047857", fontSize: "11px", fontWeight: 600 }}>
                  Disburse wages manually via Cash, UPI, Bank Transfer or Cheque
                </small>
              </div>
              <button
                type="button"
                onClick={() => setPaymentModalOpen(false)}
                style={{ border: "none", background: "transparent", fontSize: "18px", color: "#6b5887", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSavePayment} style={{ padding: "24px" }}>
              {/* Staff Selector */}
              <div style={{ marginBottom: "14px" }}>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#4c3a64", marginBottom: "5px" }}>
                  Select Kitchen Staff Member *
                </label>
                <select
                  required
                  value={paymentStaffId}
                  onChange={(e) => {
                    const id = e.target.value ? Number(e.target.value) : "";
                    setPaymentStaffId(id);
                    if (id) {
                      const found = staffList.find((s) => s.id === id);
                      if (found && found.balance > 0) {
                        setPaymentAmount(String(found.balance));
                      }
                    }
                  }}
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: "6px",
                    border: "1px solid #ddd6fe",
                    fontSize: "13px",
                    outline: "none",
                    background: "#ffffff",
                    fontWeight: 600,
                  }}
                >
                  <option value="">-- Choose Staff Member --</option>
                  {staffList.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.kitchen_role}) - Due: ₹{formatMoney(s.balance)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Staff Balance Card & Auto-Fill Shortcut */}
              {activePaymentStaff && (
                <div
                  style={{
                    background: Number(activePaymentStaff.balance) > 0 ? "#fffbeb" : "#f0fdf4",
                    border: Number(activePaymentStaff.balance) > 0 ? "1px solid #fde68a" : "1px solid #bbf7d0",
                    borderRadius: "8px",
                    padding: "10px 14px",
                    marginBottom: "14px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <span style={{ fontSize: "11px", color: "#6b5887" }}>Outstanding Due Balance:</span>
                    <div style={{ fontSize: "16px", fontWeight: 800, color: Number(activePaymentStaff.balance) > 0 ? "#b45309" : "#166534" }}>
                      ₹{formatMoney(activePaymentStaff.balance)}
                    </div>
                  </div>

                  {Number(activePaymentStaff.balance) > 0 && (
                    <button
                      type="button"
                      onClick={() => setPaymentAmount(String(activePaymentStaff.balance))}
                      style={{
                        background: "#fef3c7",
                        border: "1px solid #fde68a",
                        color: "#92400e",
                        borderRadius: "6px",
                        padding: "5px 10px",
                        fontSize: "11px",
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      Pay Full Due →
                    </button>
                  )}
                </div>
              )}

              {/* Amount & Date */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginBottom: "14px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#4c3a64", marginBottom: "5px" }}>
                    Payment Amount (₹) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    required
                    placeholder="e.g. 5000"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: "6px",
                      border: "1px solid #ddd6fe",
                      fontSize: "15px",
                      fontWeight: 800,
                      color: "#065f46",
                      outline: "none",
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#4c3a64", marginBottom: "5px" }}>
                    Payment Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: "6px",
                      border: "1px solid #ddd6fe",
                      fontSize: "13px",
                      outline: "none",
                    }}
                  />
                </div>
              </div>

              {/* Payment Mode & Reference */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginBottom: "14px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#4c3a64", marginBottom: "5px" }}>
                    Payment Mode *
                  </label>
                  <select
                    value={paymentMode}
                    onChange={(e) => setPaymentMode(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: "6px",
                      border: "1px solid #ddd6fe",
                      fontSize: "13px",
                      outline: "none",
                      background: "#ffffff",
                    }}
                  >
                    <option value="Cash">Cash</option>
                    <option value="UPI">UPI / GPay / PhonePe</option>
                    <option value="Bank Transfer">Bank Transfer (NEFT/IMPS)</option>
                    <option value="Cheque">Cheque</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#4c3a64", marginBottom: "5px" }}>
                    Reference / UTR / Cheque #
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. UPI-928410293"
                    value={paymentRef}
                    onChange={(e) => setPaymentRef(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: "6px",
                      border: "1px solid #ddd6fe",
                      fontSize: "13px",
                      outline: "none",
                    }}
                  />
                </div>
              </div>

              {/* Note */}
              <div style={{ marginBottom: "20px" }}>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#4c3a64", marginBottom: "5px" }}>
                  Disbursement Note
                </label>
                <input
                  type="text"
                  placeholder="e.g. October monthly advance / salary release..."
                  value={paymentNote}
                  onChange={(e) => setPaymentNote(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: "6px",
                    border: "1px solid #ddd6fe",
                    fontSize: "13px",
                    outline: "none",
                  }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button
                  type="button"
                  onClick={() => setPaymentModalOpen(false)}
                  style={{
                    background: "#f3eff9",
                    color: "#6b5887",
                    border: "none",
                    borderRadius: "8px",
                    padding: "9px 16px",
                    fontWeight: 600,
                    fontSize: "13px",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || !paymentStaffId || !paymentAmount}
                  style={{
                    background: "linear-gradient(135deg, #059669 0%, #047857 100%)",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "8px",
                    padding: "9px 20px",
                    fontWeight: 700,
                    fontSize: "13px",
                    cursor: "pointer",
                    boxShadow: "0 4px 14px rgba(5, 150, 105, 0.3)",
                  }}
                >
                  {saving ? "Saving..." : "Confirm & Save Payment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL 5: OFFICIAL PRINTABLE PAYMENT VOUCHER RECEIPT           */}
      {/* ============================================================ */}
      {voucherModalOpen && voucherPayment && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 4, 25, 0.6)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: "16px",
          }}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: "14px",
              width: "100%",
              maxWidth: "520px",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.2)",
              overflow: "hidden",
            }}
          >
            {/* Modal Bar */}
            <div
              style={{
                padding: "14px 20px",
                borderBottom: "1px solid #e2d9f3",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: "#fbf9fd",
              }}
            >
              <span style={{ fontSize: "13px", fontWeight: 700, color: "#1e0836" }}>
                Staff Disbursement Voucher
              </span>
              <button
                type="button"
                onClick={() => setVoucherModalOpen(false)}
                style={{ border: "none", background: "transparent", fontSize: "18px", color: "#6b5887", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>

            {/* Printable Voucher Slip */}
            <div id="printable-voucher" style={{ padding: "28px", background: "#ffffff", color: "#1e0836" }}>
              {/* Header */}
              <div style={{ textAlign: "center", borderBottom: "2px solid #7c3aed", paddingBottom: "14px", marginBottom: "18px" }}>
                <h2 style={{ margin: 0, fontSize: "20px", fontWeight: 800, color: "#3b176d", letterSpacing: "1px" }}>
                  FOOD COURT EVENT MANAGEMENT
                </h2>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "#7c3aed", textTransform: "uppercase", marginTop: "2px" }}>
                  Kitchen Staff Wage Disbursement Voucher
                </div>
                <div style={{ fontSize: "11px", color: "#6b5887", marginTop: "4px" }}>
                  Voucher No: #KPV-{voucherPayment.id.toString().padStart(5, "0")} • Date: {formatDate(voucherPayment.payment_date)}
                </div>
              </div>

              {/* Staff Details Grid */}
              <div
                style={{
                  background: "#fbf9fd",
                  borderRadius: "8px",
                  padding: "14px",
                  marginBottom: "18px",
                  border: "1px solid #ece4f7",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px", fontSize: "13px" }}>
                  <span style={{ color: "#6b5887" }}>Staff Name:</span>
                  <strong style={{ color: "#1e0836" }}>{voucherPayment.staff_name || `Staff #${voucherPayment.staff_id}`}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px", fontSize: "13px" }}>
                  <span style={{ color: "#6b5887" }}>Payment Mode:</span>
                  <strong style={{ color: "#7c3aed" }}>{voucherPayment.payment_mode}</strong>
                </div>
                {voucherPayment.reference_no && (
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px", fontSize: "13px" }}>
                    <span style={{ color: "#6b5887" }}>Reference / Txn ID:</span>
                    <span>{voucherPayment.reference_no}</span>
                  </div>
                )}
                {voucherPayment.note && (
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
                    <span style={{ color: "#6b5887" }}>Particulars / Note:</span>
                    <span>{voucherPayment.note}</span>
                  </div>
                )}
              </div>

              {/* Amount Highlight */}
              <div
                style={{
                  background: "#ecfdf5",
                  border: "2px dashed #059669",
                  borderRadius: "10px",
                  padding: "16px",
                  textAlign: "center",
                  marginBottom: "24px",
                }}
              >
                <span style={{ fontSize: "11px", fontWeight: 700, color: "#047857", textTransform: "uppercase" }}>
                  Amount Paid
                </span>
                <div style={{ fontSize: "28px", fontWeight: 900, color: "#065f46", marginTop: "4px" }}>
                  ₹{formatMoney(voucherPayment.amount)}
                </div>
              </div>

              {/* Signatures */}
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: "36px", paddingTop: "14px" }}>
                <div style={{ textAlign: "center", width: "160px" }}>
                  <div style={{ borderTop: "1px solid #9ca3af", paddingTop: "6px", fontSize: "11px", color: "#4b5563", fontWeight: 600 }}>
                    Staff Signature
                  </div>
                </div>
                <div style={{ textAlign: "center", width: "160px" }}>
                  <div style={{ borderTop: "1px solid #9ca3af", paddingTop: "6px", fontSize: "11px", color: "#4b5563", fontWeight: 600 }}>
                    Authorized Signatory
                  </div>
                </div>
              </div>
            </div>

            {/* Print & Close Actions */}
            <div
              style={{
                padding: "14px 20px",
                borderTop: "1px solid #e2d9f3",
                display: "flex",
                justifyContent: "flex-end",
                gap: "10px",
                background: "#fbf9fd",
              }}
            >
              <button
                type="button"
                onClick={() => setVoucherModalOpen(false)}
                style={{
                  background: "#f3eff9",
                  color: "#6b5887",
                  border: "none",
                  borderRadius: "8px",
                  padding: "8px 16px",
                  fontWeight: 600,
                  fontSize: "12px",
                  cursor: "pointer",
                }}
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                style={{
                  background: "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "8px",
                  padding: "8px 18px",
                  fontWeight: 700,
                  fontSize: "12px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <span>🖨️</span> Print Voucher Receipt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
