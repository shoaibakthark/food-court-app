"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth, fetchWithAuth } from "../lib/auth";
import { SidebarUserCard, OwnerBanner, NavLink, TopbarUserBadge, AppSidebar, MobileMenuButton } from "../components/AuthBar";

const API_URL = typeof window !== "undefined" ? "/api/py" : "http://127.0.0.1:8000";

type StaffRole = {
  id: number;
  name: string;
  wage: number;
};

type StaffMember = {
  id: number;
  name: string;
  mobile?: string | null;
  role_id?: number | null;
  role?: string | null;
  role_name?: string | null;
  salary?: number | string | null;
  daily_wage?: number | string | null;
  wage?: number | string | null;
  address?: string | null;
  events_count?: number;
  total_earnings?: number;
  total_paid?: number;
  pending_balance?: number;
};

type StaffForm = {
  name: string;
  mobile: string;
  role_id: string;
  daily_wage: string;
  salary: string;
  address: string;
};

const EMPTY_FORM: StaffForm = {
  name: "",
  mobile: "",
  role_id: "",
  daily_wage: "",
  salary: "",
  address: "",
};

function formatMoney(amount: number | string | null | undefined): string {
  return Number(amount ?? 0).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  });
}

export default function StaffPage() {
  const router = useRouter();
  const { user, isOwner, isManager } = useAuth();

  const [roles, setRoles] = useState<StaffRole[]>([]);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // Staff Modal
  const [staffModalOpen, setStaffModalOpen] = useState(false);
  const [editingStaffId, setEditingStaffId] = useState<number | null>(null);
  const [form, setForm] = useState<StaffForm>(EMPTY_FORM);

  // Role Modal
  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [roleName, setRoleName] = useState("");
  const [roleWage, setRoleWage] = useState("700");

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [rolesRes, staffRes] = await Promise.all([
        fetch(`${API_URL}/staff-roles`, { cache: "no-store" }),
        fetch(`${API_URL}/staff`, { cache: "no-store" }),
      ]);

      if (rolesRes.ok) {
        const rData = await rolesRes.json();
        const normalizedRoles = Array.isArray(rData)
          ? rData.map((r: any) => ({
              id: Number(r.id),
              name: String(r.role ?? r.name ?? ""),
              wage: Number(r.wage ?? 0),
            }))
          : [];
        setRoles(normalizedRoles);
      }

      if (staffRes.ok) {
        const sData = await staffRes.json();
        setStaffList(Array.isArray(sData) ? sData : []);
      }
    } catch (err: any) {
      console.error("Failed to load staff data:", err);
      setError("Unable to connect to the backend server. Please verify FastAPI is running.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Role lookup map
  const rolesMap = useMemo(() => {
    const map = new Map<number, StaffRole>();
    roles.forEach((r) => map.set(r.id, r));
    return map;
  }, [roles]);

  const getRoleName = (staff: StaffMember) => {
    if (staff.role_id && rolesMap.has(staff.role_id)) {
      return rolesMap.get(staff.role_id)!.name;
    }
    return staff.role || "General Staff";
  };

  const getStaffWage = (staff: StaffMember) => {
    if (staff.daily_wage) return Number(staff.daily_wage);
    if (staff.role_id && rolesMap.has(staff.role_id)) {
      return rolesMap.get(staff.role_id)!.wage;
    }
    return 0;
  };

  // Filtered staff
  const filteredStaff = useMemo(() => {
    if (!search.trim()) return staffList;
    const q = search.toLowerCase().trim();
    return staffList.filter((s) => {
      const rName = getRoleName(s).toLowerCase();
      return (
        s.name.toLowerCase().includes(q) ||
        (s.mobile && s.mobile.includes(q)) ||
        rName.includes(q) ||
        String(s.id).includes(q)
      );
    });
  }, [staffList, search, rolesMap]);

  // Open add staff
  const openAddStaff = () => {
    setEditingStaffId(null);
    const defaultRole = roles[0];
    setForm({
      ...EMPTY_FORM,
      role_id: defaultRole ? String(defaultRole.id) : "",
      daily_wage: defaultRole ? String(defaultRole.wage) : "",
    });
    setError(null);
    setSuccess(null);
    setStaffModalOpen(true);
  };

  // Open edit staff
  const openEditStaff = (staff: StaffMember) => {
    setEditingStaffId(staff.id);
    setForm({
      name: staff.name,
      mobile: staff.mobile || "",
      role_id: staff.role_id ? String(staff.role_id) : "",
      daily_wage: String(getStaffWage(staff)),
      salary: staff.salary ? String(staff.salary) : "",
      address: staff.address || "",
    });
    setError(null);
    setSuccess(null);
    setStaffModalOpen(true);
  };

  // Submit staff form
  const handleStaffSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      alert("Please enter staff member's name.");
      return;
    }

    try {
      setSaving(true);
      const payload: any = {
        name: form.name.trim(),
        mobile: form.mobile.trim() || undefined,
        role_id: form.role_id ? Number(form.role_id) : undefined,
        daily_wage: form.daily_wage.trim() ? Number(form.daily_wage) : undefined,
        salary: form.salary.trim() ? Number(form.salary) : undefined,
        address: form.address.trim() || undefined,
      };

      const url = editingStaffId ? `${API_URL}/staff/${editingStaffId}` : `${API_URL}/staff`;
      const method = editingStaffId ? "PUT" : "POST";

      const res = await fetchWithAuth(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.detail || "Failed to save staff record.");
      }

      setSuccess(
        editingStaffId
          ? `Staff member "${form.name.trim()}" updated successfully.`
          : `Staff member "${form.name.trim()}" added to directory.`
      );
      setStaffModalOpen(false);
      setForm(EMPTY_FORM);
      await loadData();
      setTimeout(() => setSuccess(null), 3500);
    } catch (err: any) {
      alert(err.message || "Failed to save staff record.");
    } finally {
      setSaving(false);
    }
  };

  // Submit new role
  const handleCreateRole = async (e: FormEvent) => {
    e.preventDefault();
    if (!roleName.trim()) {
      alert("Please enter a role name.");
      return;
    }
    const wage = Number(roleWage);
    if (!Number.isFinite(wage) || wage < 0) {
      alert("Please enter a valid daily wage.");
      return;
    }

    try {
      setSaving(true);
      const res = await fetchWithAuth(`${API_URL}/staff-roles`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: roleName.trim(),
          wage,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.detail || "Failed to create staff role.");
      }

      setSuccess(`Role "${roleName.trim()}" created successfully.`);
      setRoleModalOpen(false);
      setRoleName("");
      setRoleWage("700");
      await loadData();
      setTimeout(() => setSuccess(null), 3500);
    } catch (err: any) {
      alert(err.message || "Failed to create role.");
    } finally {
      setSaving(false);
    }
  };

  // Delete staff
  const handleDeleteStaff = async (staff: StaffMember) => {
    if (!window.confirm(`Are you sure you want to delete staff member "${staff.name}"?`)) {
      return;
    }
    try {
      const res = await fetchWithAuth(`${API_URL}/staff/${staff.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete staff member.");

      setSuccess(`Staff member "${staff.name}" deleted.`);
      await loadData();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      alert(err.message || "Unable to delete staff member.");
    }
  };

  return (
    <main className="dashboard">
      <AppSidebar activeRoute="/staff" />

      {/* Main Content */}
      <div className="main-content">
        {/* Topbar */}
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
          <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0, flex: "1 1 260px" }}>
            <MobileMenuButton />
            <h1 style={{ margin: 0, fontSize: "19px", fontWeight: 700, color: "#24103f", whiteSpace: "nowrap" }}>
              Staff & Crew Management
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
              {staffList.length} Team Members
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", justifyContent: "flex-end", flex: "1 1 auto" }}>
            <div
              className="search-box"
              style={{
                width: "250px",
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
                placeholder="Search staff, role, phone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  border: "none",
                  background: "transparent",
                  outline: "none",
                  width: "100%",
                  fontSize: "13px",
                  color: "#0f172a",
                }}
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  style={{ border: "none", background: "transparent", color: "#8a7b9b", cursor: "pointer", fontSize: "14px" }}
                >
                  ✕
                </button>
              )}
            </div>

            {!isOwner && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setRoleName("");
                    setRoleWage("700");
                    setRoleModalOpen(true);
                  }}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    height: "38px",
                    background: "#f5f3ff",
                    color: "#6d28d9",
                    border: "1px solid #ddd6fe",
                    borderRadius: "8px",
                    padding: "0 14px",
                    fontWeight: 700,
                    fontSize: "12px",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    flexShrink: 0,
                    transition: "all 0.15s ease",
                  }}
                >
                  + Create Role
                </button>

                <button
                  type="button"
                  onClick={openAddStaff}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    height: "38px",
                    background: "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "8px",
                    padding: "0 16px",
                    fontWeight: 700,
                    fontSize: "12px",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    flexShrink: 0,
                    boxShadow: "0 2px 6px rgba(124, 58, 237, 0.25)",
                    transition: "all 0.15s ease",
                  }}
                >
                  <span>+</span> Add Staff Member
                </button>
              </>
            )}

            <TopbarUserBadge />
          </div>
        </header>

        {/* Content Body */}
        <div className="page-content">
          <OwnerBanner />

          {/* Notifications */}
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
                style={{ border: "none", background: "transparent", color: "#0d6832", cursor: "pointer" }}
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

          {/* Metric Summary Cards */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
              gap: "20px",
              marginBottom: "28px",
            }}
          >
            <div
              style={{
                background: "#fff",
                border: "1px solid #e9e5f0",
                borderRadius: "12px",
                padding: "20px",
                boxShadow: "0 2px 8px rgba(36, 16, 63, 0.04)",
              }}
            >
              <div style={{ fontSize: "12px", color: "#7a6e8a", fontWeight: 600, textTransform: "uppercase" }}>
                Total Staff
              </div>
              <div style={{ fontSize: "26px", fontWeight: 800, color: "#24103f", marginTop: "8px" }}>
                {staffList.length}
              </div>
              <div style={{ fontSize: "12px", color: "#8d819e", marginTop: "6px" }}>
                Active crew & chefs
              </div>
            </div>

            <div
              style={{
                background: "#fff",
                border: "1px solid #e9e5f0",
                borderRadius: "12px",
                padding: "20px",
                boxShadow: "0 2px 8px rgba(36, 16, 63, 0.04)",
              }}
            >
              <div style={{ fontSize: "12px", color: "#7a6e8a", fontWeight: 600, textTransform: "uppercase" }}>
                Staff Roles
              </div>
              <div style={{ fontSize: "26px", fontWeight: 800, color: "#4f46e5", marginTop: "8px" }}>
                {roles.length}
              </div>
              <div style={{ fontSize: "12px", color: "#8d819e", marginTop: "6px" }}>
                Configured job categories
              </div>
            </div>

            <div
              style={{
                background: "linear-gradient(135deg, #f0fdf4 0%, #e6f9ed 100%)",
                border: "1px solid #bbf7d0",
                borderRadius: "12px",
                padding: "20px",
                boxShadow: "0 2px 8px rgba(22, 101, 52, 0.04)",
              }}
            >
              <div style={{ fontSize: "12px", color: "#166534", fontWeight: 600, textTransform: "uppercase" }}>
                Total Wages Earned
              </div>
              <div style={{ fontSize: "26px", fontWeight: 800, color: "#15803d", marginTop: "8px" }}>
                ₹{formatMoney(staffList.reduce((acc, s) => acc + (s.total_earnings || 0), 0))}
              </div>
              <div style={{ fontSize: "12px", color: "#166534", marginTop: "6px", fontWeight: 600 }}>
                Across all worked events
              </div>
            </div>

            <div
              style={{
                background:
                  staffList.reduce((acc, s) => acc + (s.pending_balance || 0), 0) > 0
                    ? "linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)"
                    : "#fff",
                border:
                  staffList.reduce((acc, s) => acc + (s.pending_balance || 0), 0) > 0
                    ? "1px solid #fde68a"
                    : "1px solid #e9e5f0",
                borderRadius: "12px",
                padding: "20px",
                boxShadow: "0 2px 8px rgba(180, 83, 9, 0.04)",
              }}
            >
              <div
                style={{
                  fontSize: "12px",
                  color: staffList.reduce((acc, s) => acc + (s.pending_balance || 0), 0) > 0 ? "#92400e" : "#7a6e8a",
                  fontWeight: 600,
                  textTransform: "uppercase",
                }}
              >
                Pending Wage Balance
              </div>
              <div
                style={{
                  fontSize: "26px",
                  fontWeight: 800,
                  color: staffList.reduce((acc, s) => acc + (s.pending_balance || 0), 0) > 0 ? "#b45309" : "#166534",
                  marginTop: "8px",
                }}
              >
                ₹{formatMoney(staffList.reduce((acc, s) => acc + (s.pending_balance || 0), 0))}
              </div>
              <div
                style={{
                  fontSize: "12px",
                  color: staffList.reduce((acc, s) => acc + (s.pending_balance || 0), 0) > 0 ? "#92400e" : "#15803d",
                  marginTop: "6px",
                  fontWeight: 600,
                }}
              >
                {staffList.reduce((acc, s) => acc + (s.pending_balance || 0), 0) > 0
                  ? "⚠️ Wage disbursements pending"
                  : "✓ All wages settled"}
              </div>
            </div>
          </div>

          {/* Roles Quick Strip */}
          <div
            style={{
              background: "#fff",
              borderRadius: "12px",
              border: "1px solid #e9e5f0",
              padding: "20px 24px",
              marginBottom: "28px",
              boxShadow: "0 2px 8px rgba(36, 16, 63, 0.03)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ margin: 0, fontSize: "16px", color: "#24103f" }}>Job Roles & Standard Wages</h3>
              <button
                type="button"
                onClick={() => {
                  setRoleName("");
                  setRoleWage("700");
                  setRoleModalOpen(true);
                }}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#4f46e5",
                  fontWeight: 700,
                  fontSize: "13px",
                  cursor: "pointer",
                }}
              >
                + Add Another Role
              </button>
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
              {roles.map((r) => (
                <div
                  key={r.id}
                  style={{
                    background: "#f9f8fc",
                    border: "1px solid #ece7f2",
                    borderRadius: "10px",
                    padding: "10px 16px",
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                  }}
                >
                  <span style={{ fontSize: "16px" }}>♙</span>
                  <div>
                    <strong style={{ color: "#24103f", fontSize: "13px" }}>{r.name}</strong>
                    <div style={{ fontSize: "11px", color: "#6b5b7e" }}>₹{formatMoney(r.wage)} / event</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Staff Members Table */}
          <div
            style={{
              background: "#fff",
              borderRadius: "12px",
              border: "1px solid #e9e5f0",
              overflow: "hidden",
              boxShadow: "0 2px 10px rgba(36, 16, 63, 0.03)",
            }}
          >
            <div style={{ padding: "20px 24px", borderBottom: "1px solid #e9e5f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0, fontSize: "16px", color: "#24103f" }}>Staff Directory & Earnings Ledger</h3>
              <span style={{ fontSize: "12px", color: "#7a6e8a" }}>
                Showing {filteredStaff.length} members
              </span>
            </div>

            {loading ? (
              <div style={{ padding: "48px", textAlign: "center", color: "#7a6e8a" }}>Loading staff directory...</div>
            ) : filteredStaff.length === 0 ? (
              <div style={{ padding: "50px 20px", textAlign: "center" }}>
                <div style={{ fontSize: "36px", marginBottom: "12px" }}>♙</div>
                <h3 style={{ margin: "0 0 6px 0", color: "#24103f" }}>No staff members found</h3>
                <p style={{ color: "#7a6e8a", fontSize: "14px", margin: "0 0 16px 0" }}>
                  {search ? "Try another search term." : "Add staff members to assign them to events and track wage payouts."}
                </p>
                {!isOwner && (
                  <button
                    type="button"
                    onClick={openAddStaff}
                    style={{
                      background: "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)",
                      color: "#ffffff",
                      border: "none",
                      padding: "10px 18px",
                      borderRadius: "8px",
                      fontWeight: 700,
                      cursor: "pointer",
                      boxShadow: "0 4px 14px rgba(124, 58, 237, 0.3)",
                    }}
                  >
                    + Add First Staff Member
                  </button>
                )}
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", minWidth: "750px", borderCollapse: "collapse", fontSize: "13px", textAlign: "left" }}>
                  <thead>
                    <tr style={{ background: "#f8f7fb", borderBottom: "1px solid #e9e5f0", color: "#5d4e70", fontWeight: 600 }}>
                      <th style={{ padding: "14px 18px", verticalAlign: "middle", whiteSpace: "nowrap" }}>Staff Member</th>
                      <th style={{ padding: "14px 18px", verticalAlign: "middle", whiteSpace: "nowrap" }}>Mobile Number</th>
                      <th style={{ padding: "14px 18px", verticalAlign: "middle", whiteSpace: "nowrap" }}>Assigned Role</th>
                      <th style={{ padding: "14px 18px", verticalAlign: "middle", textAlign: "center", whiteSpace: "nowrap" }}>Events Worked</th>
                      <th style={{ padding: "14px 18px", verticalAlign: "middle", textAlign: "right", whiteSpace: "nowrap" }}>Daily Wage</th>
                      <th style={{ padding: "14px 18px", verticalAlign: "middle", textAlign: "right", whiteSpace: "nowrap" }}>Total Earned</th>
                      <th style={{ padding: "14px 18px", verticalAlign: "middle", textAlign: "right", whiteSpace: "nowrap" }}>Pending Wage</th>
                      <th style={{ padding: "14px 18px", verticalAlign: "middle", textAlign: "center", whiteSpace: "nowrap" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStaff.map((staff) => (
                      <tr
                        key={staff.id}
                        style={{
                          borderBottom: "1px solid #f2eff7",
                          transition: "background 0.15s ease",
                        }}
                      >
                        <td style={{ padding: "14px 18px" }}>
                          <Link
                            href={`/staff/${staff.id}`}
                            style={{
                              textDecoration: "none",
                              color: "inherit",
                              display: "flex",
                              alignItems: "center",
                              gap: "12px",
                            }}
                          >
                            <div
                              style={{
                                width: "38px",
                                height: "38px",
                                borderRadius: "50%",
                                background: "#f3eaf7",
                                color: "#603b7d",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontWeight: 800,
                                fontSize: "14px",
                                flexShrink: 0,
                              }}
                            >
                              {staff.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <strong style={{ color: "#24103f", display: "block" }}>{staff.name}</strong>
                              <small style={{ color: "#7a6e8a" }}>Staff ID #{staff.id} • View Worked Events & Wages →</small>
                            </div>
                          </Link>
                        </td>
                        <td style={{ padding: "14px 18px", color: "#3c2e4e" }}>
                          {staff.mobile || <span style={{ color: "#a59cb3" }}>—</span>}
                        </td>
                        <td style={{ padding: "14px 18px" }}>
                          <span
                            style={{
                              display: "inline-block",
                              padding: "4px 10px",
                              borderRadius: "12px",
                              fontSize: "11px",
                              fontWeight: 700,
                              background: "#f3eaf7",
                              color: "#603b7d",
                            }}
                          >
                            {getRoleName(staff)}
                          </span>
                        </td>
                        <td style={{ padding: "14px 18px", textAlign: "center" }}>
                          <Link
                            href={`/staff/${staff.id}`}
                            style={{
                              display: "inline-block",
                              padding: "4px 10px",
                              borderRadius: "12px",
                              fontSize: "12px",
                              fontWeight: 700,
                              background: (staff.events_count || 0) > 0 ? "#e0e7ff" : "#f3f4f6",
                              color: (staff.events_count || 0) > 0 ? "#3730a3" : "#6b7280",
                              textDecoration: "none",
                            }}
                          >
                            {staff.events_count || 0} events
                          </Link>
                        </td>
                        <td style={{ padding: "14px 18px", textAlign: "right", fontWeight: 700, color: "#166534" }}>
                          ₹{formatMoney(getStaffWage(staff))}
                        </td>
                        <td style={{ padding: "14px 18px", textAlign: "right", fontWeight: 700, color: "#24103f" }}>
                          ₹{formatMoney(staff.total_earnings || 0)}
                        </td>
                        <td style={{ padding: "14px 18px", textAlign: "right" }}>
                          <span
                            style={{
                              display: "inline-block",
                              padding: "3px 9px",
                              borderRadius: "12px",
                              fontSize: "12px",
                              fontWeight: 800,
                              background: (staff.pending_balance || 0) > 0 ? "#fef3c7" : "#dcfce7",
                              color: (staff.pending_balance || 0) > 0 ? "#b45309" : "#15803d",
                            }}
                          >
                            ₹{formatMoney(staff.pending_balance || 0)}
                          </span>
                        </td>
                        <td style={{ padding: "14px 18px", textAlign: "center", verticalAlign: "middle", whiteSpace: "nowrap" }}>
                          <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
                            <Link
                              href={`/staff/${staff.id}`}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                height: "30px",
                                padding: "0 10px",
                                borderRadius: "6px",
                                background: "#f0edf5",
                                color: "#24103f",
                                fontWeight: 700,
                                fontSize: "12px",
                                textDecoration: "none",
                                whiteSpace: "nowrap",
                              }}
                            >
                              Worked Events & Wages
                            </Link>
                            {!isOwner && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => openEditStaff(staff)}
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    height: "30px",
                                    padding: "0 10px",
                                    borderRadius: "6px",
                                    background: "#f8f7fb",
                                    color: "#5d4e70",
                                    border: "1px solid #dcd7e5",
                                    fontSize: "12px",
                                    fontWeight: 600,
                                    cursor: "pointer",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteStaff(staff)}
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    height: "30px",
                                    padding: "0 10px",
                                    borderRadius: "6px",
                                    background: "#fee2e2",
                                    color: "#b91c1c",
                                    border: "none",
                                    fontSize: "12px",
                                    fontWeight: 600,
                                    cursor: "pointer",
                                    whiteSpace: "nowrap",
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

      {/* ADD / EDIT STAFF MODAL */}
      {staffModalOpen && (
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
              maxWidth: "540px",
              boxShadow: "0 20px 50px rgba(0, 0, 0, 0.25)",
              overflow: "hidden",
            }}
          >
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
                  {editingStaffId ? "Edit Staff Member" : "Add Staff Member"}
                </h3>
                <span style={{ fontSize: "12px", color: "#c084fc" }}>Crew profile & wage parameters</span>
              </div>
              <button
                type="button"
                onClick={() => setStaffModalOpen(false)}
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

            <form onSubmit={handleStaffSubmit} style={{ padding: "24px" }}>
              <div style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#3c2e4e", marginBottom: "6px" }}>
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Kumar"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: "1px solid #d8d3e2",
                    fontSize: "13px",
                  }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginBottom: "16px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#3c2e4e", marginBottom: "6px" }}>
                    Mobile Number
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 9633371320"
                    value={form.mobile}
                    onChange={(e) => setForm({ ...form, mobile: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: "8px",
                      border: "1px solid #d8d3e2",
                      fontSize: "13px",
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#3c2e4e", marginBottom: "6px" }}>
                    Assigned Role
                  </label>
                  <select
                    value={form.role_id}
                    onChange={(e) => {
                      const rId = e.target.value;
                      const sel = roles.find((r) => String(r.id) === rId);
                      setForm({
                        ...form,
                        role_id: rId,
                        daily_wage: sel ? String(sel.wage) : form.daily_wage,
                      });
                    }}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: "8px",
                      border: "1px solid #d8d3e2",
                      fontSize: "13px",
                      background: "#fff",
                    }}
                  >
                    <option value="">-- Choose Role --</option>
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} (₹{r.wage})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginBottom: "16px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#3c2e4e", marginBottom: "6px" }}>
                    Daily / Event Wage (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="700"
                    value={form.daily_wage}
                    onChange={(e) => setForm({ ...form, daily_wage: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: "8px",
                      border: "1px solid #d8d3e2",
                      fontSize: "14px",
                      fontWeight: 700,
                      color: "#166534",
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#3c2e4e", marginBottom: "6px" }}>
                    Monthly Salary (Optional)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Optional"
                    value={form.salary}
                    onChange={(e) => setForm({ ...form, salary: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: "8px",
                      border: "1px solid #d8d3e2",
                      fontSize: "13px",
                    }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: "24px" }}>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#3c2e4e", marginBottom: "6px" }}>
                  Residential Address (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Address or city..."
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: "1px solid #d8d3e2",
                    fontSize: "13px",
                    fontFamily: "inherit",
                  }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setStaffModalOpen(false)}
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
                  disabled={saving}
                  style={{
                    padding: "10px 22px",
                    borderRadius: "8px",
                    border: "none",
                    background: "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)",
                    color: "#ffffff",
                    fontWeight: 700,
                    fontSize: "13px",
                    cursor: saving ? "not-allowed" : "pointer",
                    boxShadow: "0 4px 14px rgba(124, 58, 237, 0.3)",
                  }}
                >
                  {saving ? "Saving..." : editingStaffId ? "Update Member" : "Add Staff Member"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE ROLE MODAL */}
      {roleModalOpen && (
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
              maxWidth: "460px",
              boxShadow: "0 20px 50px rgba(0, 0, 0, 0.25)",
              overflow: "hidden",
            }}
          >
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
                <h3 style={{ margin: 0, fontSize: "17px", fontWeight: 700 }}>Create Job Role</h3>
                <span style={{ fontSize: "12px", color: "#c084fc" }}>Define position & default daily wage</span>
              </div>
              <button
                type="button"
                onClick={() => setRoleModalOpen(false)}
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

            <form onSubmit={handleCreateRole} style={{ padding: "24px" }}>
              <div style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#3c2e4e", marginBottom: "6px" }}>
                  Role Title *
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="e.g. Master Chef, Assistant Waiter, Bartender"
                  value={roleName}
                  onChange={(e) => setRoleName(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: "1px solid #d8d3e2",
                    fontSize: "13px",
                  }}
                />
              </div>

              <div style={{ marginBottom: "24px" }}>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#3c2e4e", marginBottom: "6px" }}>
                  Default Daily Wage (₹) *
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  placeholder="700"
                  value={roleWage}
                  onChange={(e) => setRoleWage(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: "1px solid #d8d3e2",
                    fontSize: "14px",
                    fontWeight: 700,
                    color: "#166534",
                  }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setRoleModalOpen(false)}
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
                  disabled={saving}
                  style={{
                    padding: "10px 22px",
                    borderRadius: "8px",
                    border: "none",
                    background: "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)",
                    color: "#ffffff",
                    fontWeight: 700,
                    fontSize: "13px",
                    cursor: saving ? "not-allowed" : "pointer",
                    boxShadow: "0 4px 14px rgba(124, 58, 237, 0.3)",
                  }}
                >
                  {saving ? "Creating..." : "Create Role"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
