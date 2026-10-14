"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "../lib/auth";
import { SidebarUserCard, OwnerBanner, NavLink, TopbarUserBadge, AppSidebar, MobileMenuButton } from "../components/AuthBar";

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
              onClick={handleExportBackup}
              disabled={exporting}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                background: "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)",
                color: "#ffffff",
                border: "none",
                borderRadius: "8px",
                padding: "8px 14px",
                fontWeight: 700,
                fontSize: "12px",
                cursor: exporting ? "not-allowed" : "pointer",
                boxShadow: "0 4px 14px rgba(124, 58, 237, 0.35)",
              }}
            >
              💾 {exporting ? "Exporting..." : "Export Backup"}
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

              <div
                style={{
                  background: "#fff",
                  borderRadius: "14px",
                  border: "1px solid #e9e5f0",
                  padding: "24px",
                  boxShadow: "0 2px 10px rgba(36, 16, 63, 0.03)",
                }}
              >
                <h3 style={{ margin: "0 0 8px 0", color: "#24103f", fontSize: "17px" }}>
                  Database Backup & Archival
                </h3>
                <p style={{ margin: "0 0 16px 0", color: "#7a6e8a", fontSize: "13px" }}>
                  Download a complete portable JSON export of all events, customers, staff, payments, and expenses for safekeeping.
                </p>
                <button
                  type="button"
                  onClick={handleExportBackup}
                  disabled={exporting}
                  style={{
                    background: "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "8px",
                    padding: "10px 20px",
                    fontWeight: 700,
                    fontSize: "13px",
                    cursor: exporting ? "not-allowed" : "pointer",
                    boxShadow: "0 4px 14px rgba(124, 58, 237, 0.35)",
                  }}
                >
                  {exporting ? "Generating Backup File..." : "Download Complete JSON Backup"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
