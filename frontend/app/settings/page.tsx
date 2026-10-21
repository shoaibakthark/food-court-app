"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "../lib/auth";
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
  const [activeTab, setActiveTab] = useState<"profile" | "operations" | "diagnostics">("profile");
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

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
        </div>
      </div>
      <GoogleDriveBackupModal isOpen={showDriveModal} onClose={() => setShowDriveModal(false)} />
    </main>
  );
}
