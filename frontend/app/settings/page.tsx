"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth, ROLE_INFO } from "../lib/auth";
import { SidebarUserCard, OwnerBanner, NavLink, TopbarUserBadge, AppSidebar, MobileMenuButton } from "../components/AuthBar";
import { exportEntireDatabaseToExcel } from "../lib/excelBackup";
import { GoogleDriveBackupModal } from "../components/GoogleDriveBackupModal";

const API_URL = typeof window !== "undefined" ? "/api/py" : "http://127.0.0.1:8000";

type BusinessProfile = {
  companyName: string;
  tagline: string;
  phone: string;
  email: string;
  address: string;
  gstin: string;
  currency: string;
  advancePercentage: string;
  receiptFooter: string;
};

const DEFAULT_PROFILE: BusinessProfile = {
  companyName: "Food Court Event Management & Catering",
  tagline: "Premium Event Planning, Luxury Catering & Production",
  phone: "+91 96333 71320",
  email: "contact@foodcourtkerala.com",
  address: "Puthanathani, Malappuram, Kerala - 676552",
  gstin: "32AAAAA0000A1Z5",
  currency: "₹",
  advancePercentage: "30",
  receiptFooter: "Thank you for partnering with Food Court! We look forward to creating unforgettable celebrations.",
};

export default function SettingsPage() {
  const router = useRouter();
  const { user, isOwner, isManager } = useAuth();

  const [profile, setProfile] = useState<BusinessProfile>(DEFAULT_PROFILE);
  const [activeTab, setActiveTab] = useState<"profile" | "operations" | "diagnostics" | "users">("profile");
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // User Accounts & Logins state
  type AuthUserRecord = {
    id: number;
    username: string;
    name: string;
    role: "admin" | "owner" | "manager";
  };

  const [authUsers, setAuthUsers] = useState<AuthUserRecord[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [editUserModalOpen, setEditUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AuthUserRecord | null>(null);

  // Add User Form State
  const [newUsername, setNewUsername] = useState("");
  const [newName, setNewName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<"admin" | "owner" | "manager">("manager");
  const [userFormError, setUserFormError] = useState<string | null>(null);
  const [userFormSubmitting, setUserFormSubmitting] = useState(false);

  // Edit/Reset Password Form State
  const [editName, setEditName] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editRole, setEditRole] = useState<"admin" | "owner" | "manager">("manager");
  const [editUserError, setEditUserError] = useState<string | null>(null);
  const [editUserSubmitting, setEditUserSubmitting] = useState(false);

  const fetchUsers = async () => {
    try {
      setLoadingUsers(true);
      const res = await fetch(`${API_URL}/auth/users`);
      if (res.ok) {
        const data = await res.json();
        setAuthUsers(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error("Failed to load users", err);
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleCreateUser = async (e: FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim() || !newName.trim() || !newPassword.trim()) {
      setUserFormError("All fields are required.");
      return;
    }
    try {
      setUserFormSubmitting(true);
      setUserFormError(null);
      const res = await fetch(`${API_URL}/auth/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: newUsername.trim(),
          name: newName.trim(),
          password: newPassword.trim(),
          role: newRole,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.detail || "Failed to create user.");
      }
      setSuccessMsg(`✓ User "${newUsername.trim()}" created successfully!`);
      setTimeout(() => setSuccessMsg(null), 5000);
      setUserModalOpen(false);
      setNewUsername("");
      setNewName("");
      setNewPassword("");
      setNewRole("manager");
      fetchUsers();
    } catch (err: any) {
      setUserFormError(err.message || "Failed to create user.");
    } finally {
      setUserFormSubmitting(false);
    }
  };

  const handleOpenEditUser = (u: AuthUserRecord) => {
    setEditingUser(u);
    setEditName(u.name);
    setEditRole(u.role);
    setEditPassword("");
    setEditUserError(null);
    setEditUserModalOpen(true);
  };

  const handleUpdateUser = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    try {
      setEditUserSubmitting(true);
      setEditUserError(null);
      const body: any = {
        name: editName.trim(),
        role: editRole,
      };
      if (editPassword.trim()) {
        body.password = editPassword.trim();
      }
      const res = await fetch(`${API_URL}/auth/users/${editingUser.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.detail || "Failed to update user.");
      }
      setSuccessMsg(`✓ User "${editingUser.username}" updated successfully!`);
      setTimeout(() => setSuccessMsg(null), 5000);
      setEditUserModalOpen(false);
      setEditingUser(null);
      setEditPassword("");
      fetchUsers();
    } catch (err: any) {
      setEditUserError(err.message || "Failed to update user.");
    } finally {
      setEditUserSubmitting(false);
    }
  };

  const handleDeleteUser = async (u: AuthUserRecord) => {
    if (u.username.toLowerCase() === "admin") {
      alert("The primary admin account cannot be deleted.");
      return;
    }
    const ok = window.confirm(`Are you sure you want to delete user "${u.username}" (${u.name})?`);
    if (!ok) return;
    try {
      const res = await fetch(`${API_URL}/auth/users/${u.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.detail || "Failed to delete user.");
      }
      setSuccessMsg(`✓ User "${u.username}" deleted successfully.`);
      setTimeout(() => setSuccessMsg(null), 5000);
      fetchUsers();
    } catch (err: any) {
      alert("Error deleting user: " + err.message);
    }
  };

  // System Health States
  const [apiOnline, setApiOnline] = useState<boolean | null>(null);
  const [systemStats, setSystemStats] = useState({
    events: 0,
    customers: 0,
    staff: 0,
    foodItems: 0,
    decorItems: 0,
    payments: 0,
    expenses: 0,
  });
  const [exporting, setExporting] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [showDriveModal, setShowDriveModal] = useState(false);
  const [exportProgress, setExportProgress] = useState<string | null>(null);

  // Local PostgreSQL Database Backup states
  type LocalBackupStatus = {
    backup_dir: string;
    free_space_gb: number;
    total_backups: number;
    latest_backup: {
      filename: string;
      filepath: string;
      size_mb: number;
      created_at: string;
    } | null;
    recent_backups: Array<{
      filename: string;
      filepath: string;
      size_mb: number;
      created_at: string;
    }>;
  };

  const [localBackupStatus, setLocalBackupStatus] = useState<LocalBackupStatus | null>(null);
  const [localBackupRunning, setLocalBackupRunning] = useState(false);
  const [restoringFilename, setRestoringFilename] = useState<string | null>(null);

  const fetchBackupStatus = async () => {
    try {
      const res = await fetch(`${API_URL}/backup/status`);
      if (res.ok) {
        const data = await res.json();
        setLocalBackupStatus(data);
      }
    } catch (err) {
      console.error("Failed to fetch backup status", err);
    }
  };

  const handleRunLocalBackup = async () => {
    try {
      setLocalBackupRunning(true);
      const res = await fetch(`${API_URL}/backup/run`, { method: "POST" });
      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessMsg(`✓ Database backed up successfully! Saved to: ${data.filepath} (${data.size_mb} MB)`);
        setTimeout(() => setSuccessMsg(null), 8000);
        await fetchBackupStatus();
      } else {
        alert("Backup failed: " + (data.detail || data.error || "Unknown error"));
      }
    } catch (err: any) {
      alert("Error triggering backup: " + err.message);
    } finally {
      setLocalBackupRunning(false);
    }
  };

  const handleRestoreBackup = async (filename: string) => {
    const ok = window.confirm(
      `⚠️ RESTORE DATABASE WARNING:\n\nAre you sure you want to restore:\n"${filename}"?\n\nThis will OVERWRITE your current database records with the contents of this backup file.`
    );
    if (!ok) return;

    try {
      setRestoringFilename(filename);
      const res = await fetch(`${API_URL}/backup/restore`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        alert(`✓ Database restored successfully from ${filename}!\nThe application will now reload.`);
        window.location.reload();
      } else {
        alert("Restore failed: " + (data.detail || data.error || "Unknown error"));
      }
    } catch (err: any) {
      alert("Error restoring database: " + err.message);
    } finally {
      setRestoringFilename(null);
    }
  };

  const handleExportExcel = async () => {
    try {
      setExportingExcel(true);
      const res = await exportEntireDatabaseToExcel((msg) => setExportProgress(msg));
      if (res.success) {
        setSuccessMsg(`✓ Complete Excel database backup downloaded successfully (${res.totalRecords} total records across 11 sheets including kitchen staff).`);
        setTimeout(() => setSuccessMsg(null), 6000);
      } else {
        alert("Failed to export Excel backup: " + res.error);
      }
    } catch (err: any) {
      alert("Error exporting Excel backup: " + err.message);
    } finally {
      setExportingExcel(false);
      setExportProgress(null);
    }
  };

  // Load persisted settings
  useEffect(() => {
    try {
      const saved = localStorage.getItem("fc_settings");
      if (saved) {
        setProfile({ ...DEFAULT_PROFILE, ...JSON.parse(saved) });
      }
    } catch {
      // ignore
    }
  }, []);

  // Check system health
  useEffect(() => {
    async function checkHealth() {
      try {
        const [evRes, custRes, staffRes, foodRes, decorRes, payRes, expRes] = await Promise.all([
          fetch(`${API_URL}/events`).catch(() => null),
          fetch(`${API_URL}/customers`).catch(() => null),
          fetch(`${API_URL}/staff`).catch(() => null),
          fetch(`${API_URL}/food-items`).catch(() => null),
          fetch(`${API_URL}/decor-items`).catch(() => null),
          fetch(`${API_URL}/payments`).catch(() => null),
          fetch(`${API_URL}/expenses`).catch(() => null),
        ]);

        if (evRes && evRes.ok) {
          setApiOnline(true);
          const evData = await evRes.json().catch(() => []);
          const custData = custRes?.ok ? await custRes.json().catch(() => []) : [];
          const staffData = staffRes?.ok ? await staffRes.json().catch(() => []) : [];
          const foodData = foodRes?.ok ? await foodRes.json().catch(() => []) : [];
          const decorData = decorRes?.ok ? await decorRes.json().catch(() => []) : [];
          const payData = payRes?.ok ? await payRes.json().catch(() => []) : [];
          const expData = expRes?.ok ? await expRes.json().catch(() => []) : [];

          setSystemStats({
            events: Array.isArray(evData) ? evData.length : 0,
            customers: Array.isArray(custData) ? custData.length : 0,
            staff: Array.isArray(staffData) ? staffData.length : 0,
            foodItems: Array.isArray(foodData) ? foodData.length : 0,
            decorItems: Array.isArray(decorData) ? decorData.length : 0,
            payments: Array.isArray(payData) ? payData.length : 0,
            expenses: Array.isArray(expData) ? expData.length : 0,
          });
        } else {
          setApiOnline(false);
        }
      } catch {
        setApiOnline(false);
      }
      fetchBackupStatus();
      fetchUsers();
    }
    checkHealth();
  }, []);

  const handleSaveProfile = (e: FormEvent) => {
    e.preventDefault();
    try {
      localStorage.setItem("fc_settings", JSON.stringify(profile));
      setSuccessMsg("Settings and business profile saved successfully.");
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch {
      alert("Failed to save settings to browser storage.");
    }
  };

  const handleExportBackup = async () => {
    try {
      setExporting(true);
      const [events, customers, staff, payments, expenses, roles] = await Promise.all([
        fetch(`${API_URL}/events`).then((r) => r.json()).catch(() => []),
        fetch(`${API_URL}/customers`).then((r) => r.json()).catch(() => []),
        fetch(`${API_URL}/staff`).then((r) => r.json()).catch(() => []),
        fetch(`${API_URL}/payments`).then((r) => r.json()).catch(() => []),
        fetch(`${API_URL}/expenses`).then((r) => r.json()).catch(() => []),
        fetch(`${API_URL}/staff-roles`).then((r) => r.json()).catch(() => []),
      ]);

      const backupData = {
        exportDate: new Date().toISOString(),
        businessProfile: profile,
        data: {
          events,
          customers,
          staff,
          payments,
          expenses,
          roles,
        },
      };

      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData, null, 2));
      const downloadAnchor = document.createElement("a");
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `food_court_backup_${new Date().toISOString().slice(0, 10)}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();

      setSuccessMsg("System data exported and downloaded successfully.");
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      alert("Failed to export backup: " + err.message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <main className="dashboard">
      <AppSidebar activeRoute="/settings" />

      {/* Main Content */}
      <div className="main-content">
        {/* Topbar */}
        <header className="topbar">
          <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            <MobileMenuButton />
            <h1 style={{ margin: 0, fontSize: "19px", fontWeight: 700, color: "#24103f" }}>
              Application & Business Settings
            </h1>
            <span
              style={{
                fontSize: "12px",
                color: apiOnline ? "#166534" : "#991b1b",
                background: apiOnline ? "#dcfce7" : "#fee2e2",
                padding: "4px 10px",
                borderRadius: "12px",
                fontWeight: 700,
              }}
            >
              ● {apiOnline ? "FastAPI Backend Online" : "Backend Disconnected"}
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => setShowDriveModal(true)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
                color: "#ffffff",
                border: "none",
                borderRadius: "8px",
                padding: "8px 14px",
                fontWeight: 700,
                fontSize: "12px",
                cursor: "pointer",
                boxShadow: "0 3px 10px rgba(37, 99, 235, 0.35)",
              }}
              title="Sync complete database to Google Drive in Excel (.xlsx) format"
            >
              ☁️ Google Drive
            </button>

            <button
              type="button"
              onClick={handleRunLocalBackup}
              disabled={localBackupRunning}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                background: "linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)",
                color: "#ffffff",
                border: "none",
                borderRadius: "8px",
                padding: "8px 15px",
                fontWeight: 700,
                fontSize: "12px",
                cursor: localBackupRunning ? "not-allowed" : "pointer",
                boxShadow: "0 3px 10px rgba(79, 70, 229, 0.35)",
              }}
              title="Immediately dump local PostgreSQL database to permanent storage drive"
            >
              💾 {localBackupRunning ? "Backing up..." : "Backup DB (D:)"}
            </button>

            <button
              type="button"
              onClick={handleExportExcel}
              disabled={exportingExcel}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                background: "linear-gradient(135deg, #059669 0%, #047857 100%)",
                color: "#ffffff",
                border: "none",
                borderRadius: "8px",
                padding: "8px 15px",
                fontWeight: 700,
                fontSize: "12px",
                cursor: exportingExcel ? "not-allowed" : "pointer",
                boxShadow: "0 3px 10px rgba(5, 150, 105, 0.35)",
              }}
              title="Download entire database as an Excel (.xlsx) spreadsheet with multiple sheets"
            >
              📊 {exportingExcel ? (exportProgress || "Exporting Excel...") : "Backup to Excel (.xlsx)"}
            </button>

            <button
              type="button"
              onClick={handleExportBackup}
              disabled={exporting}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                background: "#f1f5f9",
                color: "#334155",
                border: "1px solid #cbd5e1",
                borderRadius: "8px",
                padding: "8px 12px",
                fontWeight: 600,
                fontSize: "12px",
                cursor: exporting ? "not-allowed" : "pointer",
              }}
              title="Download raw JSON data backup"
            >
              📦 {exporting ? "Exporting..." : "JSON"}
            </button>

            <TopbarUserBadge />
          </div>
        </header>

        {/* Content Body */}
        <div className="page-content">
          <OwnerBanner />

          {successMsg && (
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
              <span>✓ {successMsg}</span>
              <button
                type="button"
                onClick={() => setSuccessMsg(null)}
                style={{ border: "none", background: "transparent", color: "#0d6832", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>
          )}

          {/* Navigation Tabs */}
          <div
            style={{
              display: "flex",
              gap: "24px",
              borderBottom: "1px solid #e5e0ed",
              marginBottom: "24px",
            }}
          >
            <button
              type="button"
              onClick={() => setActiveTab("profile")}
              style={{
                background: "transparent",
                border: "none",
                borderBottom: activeTab === "profile" ? "3px solid #7c3aed" : "3px solid transparent",
                padding: "12px 6px",
                fontSize: "14px",
                fontWeight: activeTab === "profile" ? 700 : 500,
                color: activeTab === "profile" ? "#7c3aed" : "#6c5e7e",
                cursor: "pointer",
              }}
            >
              Company & Invoice Profile
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("operations")}
              style={{
                background: "transparent",
                border: "none",
                borderBottom: activeTab === "operations" ? "3px solid #7c3aed" : "3px solid transparent",
                padding: "12px 6px",
                fontSize: "14px",
                fontWeight: activeTab === "operations" ? 700 : 500,
                color: activeTab === "operations" ? "#7c3aed" : "#6c5e7e",
                cursor: "pointer",
              }}
            >
              Operational & Quotation Defaults
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("diagnostics")}
              style={{
                background: "transparent",
                border: "none",
                borderBottom: activeTab === "diagnostics" ? "3px solid #7c3aed" : "3px solid transparent",
                padding: "12px 6px",
                fontSize: "14px",
                fontWeight: activeTab === "diagnostics" ? 700 : 500,
                color: activeTab === "diagnostics" ? "#7c3aed" : "#6c5e7e",
                cursor: "pointer",
              }}
            >
              System Diagnostics & Data Backup
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab("users");
                fetchUsers();
              }}
              style={{
                background: "transparent",
                border: "none",
                borderBottom: activeTab === "users" ? "3px solid #7c3aed" : "3px solid transparent",
                padding: "12px 6px",
                fontSize: "14px",
                fontWeight: activeTab === "users" ? 700 : 500,
                color: activeTab === "users" ? "#7c3aed" : "#6c5e7e",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <span>🔐</span>
              <span>User Accounts & Login</span>
            </button>
          </div>

          {/* TAB 1: COMPANY PROFILE */}
          {activeTab === "profile" && (
            <div
              style={{
                background: "#fff",
                borderRadius: "14px",
                border: "1px solid #e9e5f0",
                padding: "28px",
                maxWidth: "750px",
                boxShadow: "0 2px 10px rgba(36, 16, 63, 0.03)",
              }}
            >
              <h3 style={{ margin: "0 0 6px 0", color: "#24103f", fontSize: "17px" }}>
                Company Brand & Contact Details
              </h3>
              <p style={{ margin: "0 0 24px 0", color: "#7a6e8a", fontSize: "13px" }}>
                These details appear on generated quotations, audit statements, and printouts.
              </p>

              <form onSubmit={handleSaveProfile}>
                <div style={{ marginBottom: "18px" }}>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#3c2e4e", marginBottom: "6px" }}>
                    Organization / Brand Name *
                  </label>
                  <input
                    type="text"
                    value={profile.companyName}
                    onChange={(e) => setProfile({ ...profile, companyName: e.target.value })}
                    required
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: "8px",
                      border: "1px solid #d8d3e2",
                      fontSize: "14px",
                      fontWeight: 600,
                      color: "#24103f",
                    }}
                  />
                </div>

                <div style={{ marginBottom: "18px" }}>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#3c2e4e", marginBottom: "6px" }}>
                    Business Tagline / Subtitle
                  </label>
                  <input
                    type="text"
                    value={profile.tagline}
                    onChange={(e) => setProfile({ ...profile, tagline: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: "8px",
                      border: "1px solid #d8d3e2",
                      fontSize: "13px",
                    }}
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "18px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#3c2e4e", marginBottom: "6px" }}>
                      Primary Mobile Number
                    </label>
                    <input
                      type="text"
                      value={profile.phone}
                      onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
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
                      Official Email
                    </label>
                    <input
                      type="email"
                      value={profile.email}
                      onChange={(e) => setProfile({ ...profile, email: e.target.value })}
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

                <div style={{ marginBottom: "18px" }}>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#3c2e4e", marginBottom: "6px" }}>
                    Business Headquarters Address
                  </label>
                  <input
                    type="text"
                    value={profile.address}
                    onChange={(e) => setProfile({ ...profile, address: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: "8px",
                      border: "1px solid #d8d3e2",
                      fontSize: "13px",
                    }}
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "24px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#3c2e4e", marginBottom: "6px" }}>
                      GSTIN / Tax ID
                    </label>
                    <input
                      type="text"
                      value={profile.gstin}
                      onChange={(e) => setProfile({ ...profile, gstin: e.target.value })}
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
                      Default Currency Symbol
                    </label>
                    <input
                      type="text"
                      value={profile.currency}
                      onChange={(e) => setProfile({ ...profile, currency: e.target.value })}
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        borderRadius: "8px",
                        border: "1px solid #d8d3e2",
                        fontSize: "13px",
                        fontWeight: 700,
                      }}
                    />
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  {!isOwner && (
                    <button
                      type="submit"
                      style={{
                        background: "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)",
                        color: "#fff",
                        border: "none",
                        borderRadius: "8px",
                        padding: "10px 24px",
                        fontWeight: 700,
                        fontSize: "14px",
                        cursor: "pointer",
                        boxShadow: "0 4px 14px rgba(124, 58, 237, 0.35)",
                      }}
                    >
                      Save Business Profile
                    </button>
                  )}
                </div>
              </form>
            </div>
          )}

          {/* TAB 2: OPERATIONAL DEFAULTS */}
          {activeTab === "operations" && (
            <div
              style={{
                background: "#fff",
                borderRadius: "14px",
                border: "1px solid #e9e5f0",
                padding: "28px",
                maxWidth: "750px",
                boxShadow: "0 2px 10px rgba(36, 16, 63, 0.03)",
              }}
            >
              <h3 style={{ margin: "0 0 6px 0", color: "#24103f", fontSize: "17px" }}>
                Quotation & Billing Policies
              </h3>
              <p style={{ margin: "0 0 24px 0", color: "#7a6e8a", fontSize: "13px" }}>
                Set company-wide standards for bookings, advance payment policies, and receipt footers.
              </p>

              <form onSubmit={handleSaveProfile}>
                <div style={{ marginBottom: "18px" }}>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#3c2e4e", marginBottom: "6px" }}>
                    Standard Advance Booking Percentage (%)
                  </label>
                  <input
                    type="number"
                    min="10"
                    max="100"
                    value={profile.advancePercentage}
                    onChange={(e) => setProfile({ ...profile, advancePercentage: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: "8px",
                      border: "1px solid #d8d3e2",
                      fontSize: "14px",
                    }}
                  />
                  <small style={{ color: "#7a6e8a", marginTop: "4px", display: "block" }}>
                    Used to suggest required advance on newly created event quotations.
                  </small>
                </div>

                <div style={{ marginBottom: "24px" }}>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#3c2e4e", marginBottom: "6px" }}>
                    Receipt & Invoice Footer Terms
                  </label>
                  <textarea
                    rows={3}
                    value={profile.receiptFooter}
                    onChange={(e) => setProfile({ ...profile, receiptFooter: e.target.value })}
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

                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  {!isOwner && (
                    <button
                      type="submit"
                      style={{
                        background: "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)",
                        color: "#fff",
                        border: "none",
                        borderRadius: "8px",
                        padding: "10px 24px",
                        fontWeight: 700,
                        fontSize: "14px",
                        cursor: "pointer",
                        boxShadow: "0 4px 14px rgba(124, 58, 237, 0.35)",
                      }}
                    >
                      Save Operational Defaults
                    </button>
                  )}
                </div>
              </form>
            </div>
          )}

          {/* TAB 3: SYSTEM DIAGNOSTICS */}
          {activeTab === "diagnostics" && (
            <div>
              <div
                style={{
                  background: "#fff",
                  borderRadius: "14px",
                  border: "1px solid #e9e5f0",
                  padding: "24px",
                  marginBottom: "24px",
                  boxShadow: "0 2px 10px rgba(36, 16, 63, 0.03)",
                }}
              >
                <h3 style={{ margin: "0 0 16px 0", color: "#24103f", fontSize: "17px" }}>
                  Live System Health & Record Volumes
                </h3>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                    gap: "16px",
                  }}
                >
                  <div style={{ background: "#f8f6fc", padding: "16px", borderRadius: "10px", textAlign: "center" }}>
                    <div style={{ fontSize: "24px", fontWeight: 800, color: "#24103f" }}>{systemStats.events}</div>
                    <div style={{ fontSize: "12px", color: "#7a6e8a", marginTop: "4px" }}>Booked Events</div>
                  </div>
                  <div style={{ background: "#f8f6fc", padding: "16px", borderRadius: "10px", textAlign: "center" }}>
                    <div style={{ fontSize: "24px", fontWeight: 800, color: "#24103f" }}>{systemStats.customers}</div>
                    <div style={{ fontSize: "12px", color: "#7a6e8a", marginTop: "4px" }}>Customers</div>
                  </div>
                  <div style={{ background: "#f8f6fc", padding: "16px", borderRadius: "10px", textAlign: "center" }}>
                    <div style={{ fontSize: "24px", fontWeight: 800, color: "#24103f" }}>{systemStats.staff}</div>
                    <div style={{ fontSize: "12px", color: "#7a6e8a", marginTop: "4px" }}>Staff Members</div>
                  </div>
                  <div style={{ background: "#f8f6fc", padding: "16px", borderRadius: "10px", textAlign: "center" }}>
                    <div style={{ fontSize: "24px", fontWeight: 800, color: "#24103f" }}>{systemStats.foodItems}</div>
                    <div style={{ fontSize: "12px", color: "#7a6e8a", marginTop: "4px" }}>Food Items</div>
                  </div>
                  <div style={{ background: "#f8f6fc", padding: "16px", borderRadius: "10px", textAlign: "center" }}>
                    <div style={{ fontSize: "24px", fontWeight: 800, color: "#24103f" }}>{systemStats.decorItems}</div>
                    <div style={{ fontSize: "12px", color: "#7a6e8a", marginTop: "4px" }}>Decor Items</div>
                  </div>
                  <div style={{ background: "#f8f6fc", padding: "16px", borderRadius: "10px", textAlign: "center" }}>
                    <div style={{ fontSize: "24px", fontWeight: 800, color: "#166534" }}>{systemStats.payments}</div>
                    <div style={{ fontSize: "12px", color: "#7a6e8a", marginTop: "4px" }}>Payment Records</div>
                  </div>
                  <div style={{ background: "#f8f6fc", padding: "16px", borderRadius: "10px", textAlign: "center" }}>
                    <div style={{ fontSize: "24px", fontWeight: 800, color: "#b91c1c" }}>{systemStats.expenses}</div>
                    <div style={{ fontSize: "12px", color: "#7a6e8a", marginTop: "4px" }}>Expense Records</div>
                  </div>
                </div>
              </div>

              {/* LOCAL POSTGRESQL DATABASE BACKUP CARD */}
              <div
                style={{
                  background: "#fff",
                  borderRadius: "14px",
                  border: "1px solid #c7d2fe",
                  padding: "24px",
                  boxShadow: "0 4px 16px rgba(79, 70, 229, 0.08)",
                  marginBottom: "24px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px", marginBottom: "14px" }}>
                  <div>
                    <h3 style={{ margin: "0 0 4px 0", color: "#1e1b4b", fontSize: "18px", fontWeight: 800, display: "flex", alignItems: "center", gap: "8px" }}>
                      <span>💾</span> Permanent Drive PostgreSQL Database Backup
                    </h3>
                    <p style={{ margin: 0, color: "#64748b", fontSize: "13px" }}>
                      Automated binary dumps (<code style={{ background: "#f1f5f9", padding: "1px 5px", borderRadius: "4px" }}>pg_dump</code>) stored directly on your permanent drive for disaster recovery.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleRunLocalBackup}
                    disabled={localBackupRunning}
                    style={{
                      background: "linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)",
                      color: "#ffffff",
                      border: "none",
                      borderRadius: "8px",
                      padding: "11px 22px",
                      fontWeight: 700,
                      fontSize: "13.5px",
                      cursor: localBackupRunning ? "not-allowed" : "pointer",
                      boxShadow: "0 4px 14px rgba(79, 70, 229, 0.4)",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "8px",
                      flexShrink: 0,
                    }}
                  >
                    <span>⚡</span>
                    <span>{localBackupRunning ? "Creating Backup..." : "Backup Database Now"}</span>
                  </button>
                </div>

                {/* Storage & Schedule Metrics */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px", marginBottom: "18px" }}>
                  <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "12px 14px" }}>
                    <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Permanent Backup Folder</div>
                    <div style={{ fontSize: "13px", fontWeight: 800, color: "#0f172a", marginTop: "4px", wordBreak: "break-all" }}>
                      📁 {localBackupStatus?.backup_dir || "D:\\food_court_backups"}
                    </div>
                  </div>

                  <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "12px 14px" }}>
                    <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Drive Free Space</div>
                    <div style={{ fontSize: "14px", fontWeight: 800, color: "#059669", marginTop: "4px" }}>
                      💽 {localBackupStatus?.free_space_gb ? `${localBackupStatus.free_space_gb} GB Available` : "Checking..."}
                    </div>
                  </div>

                  <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "12px 14px" }}>
                    <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Daily Automated Schedule</div>
                    <div style={{ fontSize: "13px", fontWeight: 800, color: "#2563eb", marginTop: "4px" }}>
                      ⏰ Daily at 11:59 PM (Windows Task)
                    </div>
                  </div>

                  <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "12px 14px" }}>
                    <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Total Backups Stored</div>
                    <div style={{ fontSize: "14px", fontWeight: 800, color: "#7c3aed", marginTop: "4px" }}>
                      📦 {localBackupStatus?.total_backups || 0} Backup Dumps
                    </div>
                  </div>
                </div>

                {/* Recent Backup Files List */}
                {localBackupStatus?.recent_backups && localBackupStatus.recent_backups.length > 0 && (
                  <div>
                    <div style={{ fontSize: "12px", fontWeight: 700, color: "#334155", marginBottom: "8px" }}>
                      Recent Local PostgreSQL Backups:
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      {localBackupStatus.recent_backups.slice(0, 4).map((b) => (
                        <div
                          key={b.filename}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            background: "#fdfdfd",
                            border: "1px solid #e2e8f0",
                            borderRadius: "6px",
                            padding: "8px 12px",
                            fontSize: "12px",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <span>📄</span>
                            <span style={{ fontWeight: 700, color: "#0f172a" }}>{b.filename}</span>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: "12px", color: "#64748b" }}>
                            <span>{new Date(b.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</span>
                            <span style={{ fontWeight: 800, color: "#059669", background: "#ecfdf5", padding: "2px 8px", borderRadius: "10px" }}>
                              {b.size_mb} MB
                            </span>
                            {!isOwner && (
                              <button
                                type="button"
                                disabled={restoringFilename === b.filename}
                                onClick={() => handleRestoreBackup(b.filename)}
                                style={{
                                  border: "1px solid #fca5a5",
                                  background: "#fef2f2",
                                  color: "#dc2626",
                                  borderRadius: "6px",
                                  padding: "3px 9px",
                                  fontSize: "11px",
                                  fontWeight: 700,
                                  cursor: restoringFilename === b.filename ? "not-allowed" : "pointer",
                                }}
                                title="Restore this database backup (overwrites current data)"
                              >
                                {restoringFilename === b.filename ? "Restoring..." : "↺ Restore"}
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div
                style={{
                  background: "#fff",
                  borderRadius: "14px",
                  border: "1px solid #e9e5f0",
                  padding: "24px",
                  boxShadow: "0 2px 10px rgba(36, 16, 63, 0.03)",
                }}
              >
                <h3 style={{ margin: "0 0 6px 0", color: "#24103f", fontSize: "18px", fontWeight: 800 }}>
                  Database Backup & Complete Data Export
                </h3>
                <p style={{ margin: "0 0 16px 0", color: "#64748b", fontSize: "13px", lineHeight: 1.5 }}>
                  Export all business records into a multi-tab Microsoft Excel (.xlsx) spreadsheet, formatted for direct reporting, accounting, and secure offline storage.
                </p>

                <div
                  style={{
                    background: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    borderRadius: "8px",
                    padding: "12px 16px",
                    marginBottom: "18px",
                    fontSize: "12.5px",
                    color: "#334155",
                  }}
                >
                  <div style={{ fontWeight: 700, color: "#0f172a", marginBottom: "6px" }}>
                    Included in this Complete Backup (11 Sheets across all departments):
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: "6px" }}>
                    <span>✓ <strong>Events & Invoices</strong> (Dates, Pax, Quotes, Balances)</span>
                    <span>✓ <strong>Payments Received</strong> (Receipts, Methods, Categories)</span>
                    <span>✓ <strong>Expenses Ledger</strong> (Payees, Vouchers, Modes)</span>
                    <span>✓ <strong>Expense Settlements</strong> (Cleared Ledger Records)</span>
                    <span>✓ <strong>Kitchen Staff Directory</strong> (Roles, Rates, Balances)</span>
                    <span>✓ <strong>Kitchen Daily Duties</strong> (Attendance, Shifts, Wages)</span>
                    <span>✓ <strong>Kitchen Payments</strong> (Wage Settlements & Payouts)</span>
                    <span>✓ <strong>Event Staff & Crew</strong> (Roles, Contacts, Wage Rates)</span>
                    <span>✓ <strong>Customers Directory</strong> (Names, Mobiles, Venues)</span>
                    <span>✓ <strong>Food Menu Catalog</strong> (Courses, Rates, Items)</span>
                    <span>✓ <strong>Decor Inventory</strong> (Props, Status, Rental Rates)</span>
                  </div>
                </div>

                <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center" }}>
                  <button
                    type="button"
                    onClick={() => setShowDriveModal(true)}
                    style={{
                      background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
                      color: "#ffffff",
                      border: "none",
                      borderRadius: "8px",
                      padding: "11px 20px",
                      fontWeight: 700,
                      fontSize: "13.5px",
                      cursor: "pointer",
                      boxShadow: "0 4px 14px rgba(37, 99, 235, 0.4)",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    <span>☁️</span>
                    <span>Backup to Google Drive</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleExportExcel}
                    disabled={exportingExcel}
                    style={{
                      background: "linear-gradient(135deg, #059669 0%, #047857 100%)",
                      color: "#ffffff",
                      border: "none",
                      borderRadius: "8px",
                      padding: "11px 22px",
                      fontWeight: 700,
                      fontSize: "13.5px",
                      cursor: exportingExcel ? "not-allowed" : "pointer",
                      boxShadow: "0 4px 14px rgba(5, 150, 105, 0.4)",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    <span>📊</span>
                    <span>{exportingExcel ? (exportProgress || "Generating Excel Backup...") : "Download Complete Excel Backup (.xlsx)"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleExportBackup}
                    disabled={exporting}
                    style={{
                      background: "#ffffff",
                      color: "#475569",
                      border: "1.5px solid #cbd5e1",
                      borderRadius: "8px",
                      padding: "10px 18px",
                      fontWeight: 600,
                      fontSize: "13px",
                      cursor: exporting ? "not-allowed" : "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    <span>📦</span>
                    <span>{exporting ? "Generating..." : "Download Raw JSON Backup"}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: USER ACCOUNTS & LOGIN MANAGEMENT */}
          {activeTab === "users" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
              {/* Header Banner & Action Bar */}
              <div
                style={{
                  background: "#ffffff",
                  borderRadius: "14px",
                  border: "1px solid #e9e5f0",
                  padding: "24px 28px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: "16px",
                  boxShadow: "0 2px 10px rgba(36, 16, 63, 0.03)",
                }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
                    <span style={{ fontSize: "22px" }}>🔐</span>
                    <h2 style={{ margin: 0, fontSize: "19px", fontWeight: 700, color: "#1e0836" }}>
                      User Accounts & Login Management
                    </h2>
                  </div>
                  <p style={{ margin: 0, fontSize: "13px", color: "#6c5e7e" }}>
                    Manage login credentials, role-based privileges, and staff access accounts.
                  </p>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={fetchUsers}
                    style={{
                      background: "#f8f6fc",
                      border: "1px solid #dcd2ea",
                      borderRadius: "8px",
                      padding: "9px 14px",
                      fontSize: "12.5px",
                      fontWeight: 600,
                      color: "#5b4a73",
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    <span>🔄</span>
                    <span>Refresh</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setNewUsername("");
                      setNewName("");
                      setNewPassword("");
                      setNewRole("manager");
                      setUserFormError(null);
                      setUserModalOpen(true);
                    }}
                    style={{
                      background: "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)",
                      color: "#ffffff",
                      border: "none",
                      borderRadius: "8px",
                      padding: "9px 16px",
                      fontSize: "13px",
                      fontWeight: 700,
                      cursor: "pointer",
                      boxShadow: "0 3px 12px rgba(124, 58, 237, 0.35)",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    <span>＋</span>
                    <span>Add Login User</span>
                  </button>

                  <Link
                    href="/login"
                    style={{
                      background: "#f1f5f9",
                      border: "1px solid #cbd5e1",
                      borderRadius: "8px",
                      padding: "9px 14px",
                      fontSize: "12.5px",
                      fontWeight: 700,
                      color: "#334155",
                      textDecoration: "none",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    <span>🚪</span>
                    <span>Switch User</span>
                  </Link>
                </div>
              </div>

              {/* System Roles Quick Reference Cards */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                  gap: "16px",
                }}
              >
                {/* Admin Card */}
                <div
                  style={{
                    background: "#ffffff",
                    borderRadius: "12px",
                    border: "1px solid #e9e5f0",
                    borderTop: "3px solid #7c3aed",
                    padding: "18px 20px",
                    boxShadow: "0 2px 8px rgba(36, 16, 63, 0.03)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontSize: "18px" }}>👑</span>
                      <strong style={{ fontSize: "14px", color: "#1e0836" }}>Administrator</strong>
                    </div>
                    <span
                      style={{
                        background: "#f3e8ff",
                        color: "#6b21a8",
                        padding: "3px 8px",
                        borderRadius: "12px",
                        fontSize: "10.5px",
                        fontWeight: 700,
                      }}
                    >
                      Full Access
                    </span>
                  </div>
                  <p style={{ margin: "0 0 10px 0", fontSize: "12px", color: "#6c5e7e", lineHeight: 1.4 }}>
                    Complete read, create, update, and deletion authority across all modules, accounting, and system configurations.
                  </p>
                  <div
                    style={{
                      background: "#faf8fd",
                      border: "1px dashed #dcd2ea",
                      borderRadius: "6px",
                      padding: "7px 10px",
                      fontSize: "11px",
                      color: "#4a3c60",
                      display: "flex",
                      justifyContent: "space-between",
                    }}
                  >
                    <span>Default Login:</span>
                    <strong>admin / admin123</strong>
                  </div>
                </div>

                {/* Owner Card */}
                <div
                  style={{
                    background: "#ffffff",
                    borderRadius: "12px",
                    border: "1px solid #e9e5f0",
                    borderTop: "3px solid #f59e0b",
                    padding: "18px 20px",
                    boxShadow: "0 2px 8px rgba(36, 16, 63, 0.03)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontSize: "18px" }}>👁️</span>
                      <strong style={{ fontSize: "14px", color: "#1e0836" }}>Business Owner</strong>
                    </div>
                    <span
                      style={{
                        background: "#fef3c7",
                        color: "#92400e",
                        padding: "3px 8px",
                        borderRadius: "12px",
                        fontSize: "10.5px",
                        fontWeight: 700,
                      }}
                    >
                      Read Only
                    </span>
                  </div>
                  <p style={{ margin: "0 0 10px 0", fontSize: "12px", color: "#6c5e7e", lineHeight: 1.4 }}>
                    Executive view of all events, reports, and financial balances. Add, edit, and delete operations are safely disabled.
                  </p>
                  <div
                    style={{
                      background: "#fffbeb",
                      border: "1px dashed #fde68a",
                      borderRadius: "6px",
                      padding: "7px 10px",
                      fontSize: "11px",
                      color: "#78350f",
                      display: "flex",
                      justifyContent: "space-between",
                    }}
                  >
                    <span>Default Login:</span>
                    <strong>owner / owner123</strong>
                  </div>
                </div>

                {/* Manager Card */}
                <div
                  style={{
                    background: "#ffffff",
                    borderRadius: "12px",
                    border: "1px solid #e9e5f0",
                    borderTop: "3px solid #3b82f6",
                    padding: "18px 20px",
                    boxShadow: "0 2px 8px rgba(36, 16, 63, 0.03)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontSize: "18px" }}>💼</span>
                      <strong style={{ fontSize: "14px", color: "#1e0836" }}>Staff Wage Manager</strong>
                    </div>
                    <span
                      style={{
                        background: "#dbeafe",
                        color: "#1e40af",
                        padding: "3px 8px",
                        borderRadius: "12px",
                        fontSize: "10.5px",
                        fontWeight: 700,
                      }}
                    >
                      Staff / Wages
                    </span>
                  </div>
                  <p style={{ margin: "0 0 10px 0", fontSize: "12px", color: "#6c5e7e", lineHeight: 1.4 }}>
                    Operational portal focused exclusively on staff roster management and wage payment disbursements.
                  </p>
                  <div
                    style={{
                      background: "#eff6ff",
                      border: "1px dashed #bfdbfe",
                      borderRadius: "6px",
                      padding: "7px 10px",
                      fontSize: "11px",
                      color: "#1e3a8a",
                      display: "flex",
                      justifyContent: "space-between",
                    }}
                  >
                    <span>Default Login:</span>
                    <strong>manager / manager123</strong>
                  </div>
                </div>
              </div>

              {/* Accounts Table Card */}
              <div
                style={{
                  background: "#ffffff",
                  borderRadius: "14px",
                  border: "1px solid #e9e5f0",
                  padding: "24px 28px",
                  boxShadow: "0 2px 10px rgba(36, 16, 63, 0.03)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px" }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "#1e0836" }}>
                      Active Login Accounts ({authUsers.length})
                    </h3>
                    <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#6c5e7e" }}>
                      Users with authorized access to log in to this portal.
                    </p>
                  </div>
                </div>

                {loadingUsers ? (
                  <div style={{ padding: "40px", textAlign: "center", color: "#8b7a9f", fontSize: "13.5px" }}>
                    Loading user accounts...
                  </div>
                ) : authUsers.length === 0 ? (
                  <div style={{ padding: "40px", textAlign: "center", color: "#8b7a9f", fontSize: "13.5px" }}>
                    No user accounts found. Click <strong>"Add Login User"</strong> above to register an account.
                  </div>
                ) : (
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                      <thead>
                        <tr style={{ background: "#faf8fd", borderBottom: "1px solid #e9e5f0", textAlign: "left" }}>
                          <th style={{ padding: "12px 16px", fontWeight: 700, color: "#4a3c60", borderRadius: "8px 0 0 8px" }}>User</th>
                          <th style={{ padding: "12px 16px", fontWeight: 700, color: "#4a3c60" }}>Username</th>
                          <th style={{ padding: "12px 16px", fontWeight: 700, color: "#4a3c60" }}>Assigned Role</th>
                          <th style={{ padding: "12px 16px", fontWeight: 700, color: "#4a3c60", textAlign: "right", borderRadius: "0 8px 8px 0" }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {authUsers.map((u) => {
                          const roleMeta = ROLE_INFO[u.role] || ROLE_INFO.admin;
                          const isPrimaryAdmin = u.username.toLowerCase() === "admin";
                          return (
                            <tr key={u.id} style={{ borderBottom: "1px solid #f3eff8" }}>
                              <td style={{ padding: "14px 16px" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                  <div
                                    style={{
                                      width: "36px",
                                      height: "36px",
                                      borderRadius: "9px",
                                      background: roleMeta.bg,
                                      color: roleMeta.color,
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      fontWeight: 800,
                                      fontSize: "13px",
                                      flexShrink: 0,
                                    }}
                                  >
                                    {u.name.charAt(0).toUpperCase()}
                                  </div>
                                  <div>
                                    <strong style={{ color: "#1e0836", fontSize: "13px", display: "block" }}>{u.name}</strong>
                                    {isPrimaryAdmin && (
                                      <span style={{ fontSize: "10.5px", color: "#7c3aed", fontWeight: 600 }}>Primary System Admin</span>
                                    )}
                                  </div>
                                </div>
                              </td>

                              <td style={{ padding: "14px 16px" }}>
                                <code
                                  style={{
                                    background: "#f3eff8",
                                    color: "#5b21b6",
                                    padding: "3px 8px",
                                    borderRadius: "6px",
                                    fontSize: "12px",
                                    fontFamily: "monospace",
                                    fontWeight: 700,
                                  }}
                                >
                                  @{u.username}
                                </code>
                              </td>

                              <td style={{ padding: "14px 16px" }}>
                                <span
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "5px",
                                    background: roleMeta.bg,
                                    color: roleMeta.color,
                                    padding: "4px 10px",
                                    borderRadius: "8px",
                                    fontSize: "11.5px",
                                    fontWeight: 700,
                                  }}
                                >
                                  <span>{u.role === "admin" ? "👑" : u.role === "owner" ? "👁️" : "💼"}</span>
                                  <span>{roleMeta.title} ({roleMeta.badge})</span>
                                </span>
                              </td>

                              <td style={{ padding: "14px 16px", textAlign: "right" }}>
                                <div style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenEditUser(u)}
                                    style={{
                                      background: "#f5f3ff",
                                      border: "1px solid #ddd6fe",
                                      color: "#6d28d9",
                                      borderRadius: "6px",
                                      padding: "6px 11px",
                                      fontSize: "12px",
                                      fontWeight: 600,
                                      cursor: "pointer",
                                    }}
                                    title="Edit user info or reset password"
                                  >
                                    ✏️ Edit / Password
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleDeleteUser(u)}
                                    disabled={isPrimaryAdmin}
                                    style={{
                                      background: isPrimaryAdmin ? "#f8fafc" : "#fef2f2",
                                      border: isPrimaryAdmin ? "1px solid #e2e8f0" : "1px solid #fecaca",
                                      color: isPrimaryAdmin ? "#94a3b8" : "#dc2626",
                                      borderRadius: "6px",
                                      padding: "6px 11px",
                                      fontSize: "12px",
                                      fontWeight: 600,
                                      cursor: isPrimaryAdmin ? "not-allowed" : "pointer",
                                      opacity: isPrimaryAdmin ? 0.6 : 1,
                                    }}
                                    title={isPrimaryAdmin ? "Primary admin cannot be deleted" : "Delete user account"}
                                  >
                                    🗑️ Delete
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ADD USER MODAL */}
      {userModalOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(18, 4, 34, 0.6)",
            backdropFilter: "blur(4px)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 9999,
            padding: "20px",
          }}
          onClick={() => !userFormSubmitting && setUserModalOpen(false)}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: "16px",
              width: "100%",
              maxWidth: "460px",
              padding: "28px",
              boxShadow: "0 20px 50px rgba(18, 4, 34, 0.35)",
              border: "1px solid #e9e5f0",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "10px",
                    background: "#f3e8ff",
                    color: "#7c3aed",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "17px",
                  }}
                >
                  👤
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: "17px", fontWeight: 700, color: "#1e0836" }}>Add Login User</h3>
                  <small style={{ color: "#6c5e7e" }}>Create a new portal login credential</small>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setUserModalOpen(false)}
                disabled={userFormSubmitting}
                style={{ background: "none", border: "none", fontSize: "18px", color: "#8b7a9f", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>

            {userFormError && (
              <div
                style={{
                  background: "#fef2f2",
                  border: "1px solid #fecaca",
                  color: "#991b1b",
                  padding: "10px 14px",
                  borderRadius: "8px",
                  marginBottom: "16px",
                  fontSize: "12.5px",
                }}
              >
                ⚠️ {userFormError}
              </div>
            )}

            <form onSubmit={handleCreateUser}>
              <div style={{ marginBottom: "14px" }}>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#1e0836", marginBottom: "6px" }}>
                  Username (login identifier)
                </label>
                <input
                  type="text"
                  required
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                  placeholder="e.g. manager_rahul"
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: "1px solid #dcd2ea",
                    fontSize: "13.5px",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
                <small style={{ color: "#8b7a9f", fontSize: "11px", marginTop: "3px", display: "block" }}>
                  Lowercase letters, numbers, and underscores only.
                </small>
              </div>

              <div style={{ marginBottom: "14px" }}>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#1e0836", marginBottom: "6px" }}>
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Rahul Sharma"
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: "1px solid #dcd2ea",
                    fontSize: "13.5px",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div style={{ marginBottom: "14px" }}>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#1e0836", marginBottom: "6px" }}>
                  Password
                </label>
                <input
                  type="text"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimum 4 characters"
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: "1px solid #dcd2ea",
                    fontSize: "13.5px",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div style={{ marginBottom: "22px" }}>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#1e0836", marginBottom: "6px" }}>
                  Assigned Role
                </label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as any)}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: "1px solid #dcd2ea",
                    fontSize: "13.5px",
                    outline: "none",
                    background: "#ffffff",
                    boxSizing: "border-box",
                  }}
                >
                  <option value="admin">👑 Administrator (Full System Access)</option>
                  <option value="owner">👁️ Business Owner (Read-Only Visibility)</option>
                  <option value="manager">💼 Staff Wage Manager (Staff & Wages Only)</option>
                </select>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button
                  type="button"
                  onClick={() => setUserModalOpen(false)}
                  disabled={userFormSubmitting}
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
                  disabled={userFormSubmitting}
                  style={{
                    padding: "9px 18px",
                    borderRadius: "8px",
                    border: "none",
                    background: "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)",
                    color: "#ffffff",
                    fontSize: "13px",
                    fontWeight: 700,
                    cursor: userFormSubmitting ? "not-allowed" : "pointer",
                    boxShadow: "0 2px 8px rgba(124, 58, 237, 0.35)",
                  }}
                >
                  {userFormSubmitting ? "Creating..." : "Create User"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT USER / RESET PASSWORD MODAL */}
      {editUserModalOpen && editingUser && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(18, 4, 34, 0.6)",
            backdropFilter: "blur(4px)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 9999,
            padding: "20px",
          }}
          onClick={() => !editUserSubmitting && setEditUserModalOpen(false)}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: "16px",
              width: "100%",
              maxWidth: "460px",
              padding: "28px",
              boxShadow: "0 20px 50px rgba(18, 4, 34, 0.35)",
              border: "1px solid #e9e5f0",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "10px",
                    background: "#ede9fe",
                    color: "#6d28d9",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "17px",
                  }}
                >
                  ✏️
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: "17px", fontWeight: 700, color: "#1e0836" }}>Edit User Account</h3>
                  <small style={{ color: "#6c5e7e" }}>Update profile or reset password for @{editingUser.username}</small>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditUserModalOpen(false)}
                disabled={editUserSubmitting}
                style={{ background: "none", border: "none", fontSize: "18px", color: "#8b7a9f", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>

            {editUserError && (
              <div
                style={{
                  background: "#fef2f2",
                  border: "1px solid #fecaca",
                  color: "#991b1b",
                  padding: "10px 14px",
                  borderRadius: "8px",
                  marginBottom: "16px",
                  fontSize: "12.5px",
                }}
              >
                ⚠️ {editUserError}
              </div>
            )}

            <form onSubmit={handleUpdateUser}>
              <div style={{ marginBottom: "14px" }}>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#1e0836", marginBottom: "6px" }}>
                  Username
                </label>
                <input
                  type="text"
                  disabled
                  value={editingUser.username}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: "1px solid #e2e8f0",
                    background: "#f8fafc",
                    color: "#64748b",
                    fontSize: "13.5px",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div style={{ marginBottom: "14px" }}>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#1e0836", marginBottom: "6px" }}>
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: "1px solid #dcd2ea",
                    fontSize: "13.5px",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div style={{ marginBottom: "14px" }}>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#1e0836", marginBottom: "6px" }}>
                  Role
                </label>
                <select
                  value={editRole}
                  disabled={editingUser.username.toLowerCase() === "admin"}
                  onChange={(e) => setEditRole(e.target.value as any)}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: "1px solid #dcd2ea",
                    fontSize: "13.5px",
                    outline: "none",
                    background: editingUser.username.toLowerCase() === "admin" ? "#f8fafc" : "#ffffff",
                    boxSizing: "border-box",
                  }}
                >
                  <option value="admin">👑 Administrator (Full System Access)</option>
                  <option value="owner">👁️ Business Owner (Read-Only Visibility)</option>
                  <option value="manager">💼 Staff Wage Manager (Staff & Wages Only)</option>
                </select>
                {editingUser.username.toLowerCase() === "admin" && (
                  <small style={{ color: "#8b7a9f", fontSize: "11px", marginTop: "3px", display: "block" }}>
                    Primary admin role cannot be changed.
                  </small>
                )}
              </div>

              <div style={{ marginBottom: "22px" }}>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#1e0836", marginBottom: "6px" }}>
                  New Password <span style={{ fontWeight: 400, color: "#8b7a9f" }}>(Leave blank to keep existing password)</span>
                </label>
                <input
                  type="text"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  placeholder="Enter new password (optional)"
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: "1px solid #dcd2ea",
                    fontSize: "13.5px",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button
                  type="button"
                  onClick={() => setEditUserModalOpen(false)}
                  disabled={editUserSubmitting}
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
                  disabled={editUserSubmitting}
                  style={{
                    padding: "9px 18px",
                    borderRadius: "8px",
                    border: "none",
                    background: "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)",
                    color: "#ffffff",
                    fontSize: "13px",
                    fontWeight: 700,
                    cursor: editUserSubmitting ? "not-allowed" : "pointer",
                    boxShadow: "0 2px 8px rgba(124, 58, 237, 0.35)",
                  }}
                >
                  {editUserSubmitting ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      <GoogleDriveBackupModal isOpen={showDriveModal} onClose={() => setShowDriveModal(false)} />
    </main>
  );
}
