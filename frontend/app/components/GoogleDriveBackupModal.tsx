"use client";

import React, { useState, useEffect } from "react";
import {
  generateExcelBackupBlob,
  triggerFileDownload,
  uploadToAppsScriptWebhook,
  executeGoogleDriveBackup,
  getStoredDriveBackups,
  DriveBackupRecord,
} from "../lib/googleDriveBackup";

interface GoogleDriveBackupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type BackupTab = "one_click" | "webhook" | "oauth";

const APPS_SCRIPT_CODE = `function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var folderName = "Food Court Cloud Backups";
    var folders = DriveApp.getFoldersByName(folderName);
    var folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName);
    
    var decoded = Utilities.base64Decode(data.base64);
    var blob = Utilities.newBlob(decoded, data.mimeType, data.fileName);
    var file = folder.createFile(blob);
    
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      fileId: file.getId(),
      webViewLink: file.getUrl(),
      fileName: file.getName()
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}`;

export function GoogleDriveBackupModal({ isOpen, onClose }: GoogleDriveBackupModalProps) {
  const [activeTab, setActiveTab] = useState<BackupTab>("one_click");
  const [loading, setLoading] = useState(false);
  const [progressMsg, setProgressMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Tab 1 state: 1-Click Save
  const [oneClickResult, setOneClickResult] = useState<{
    fileName: string;
    totalRecords: number;
    downloadUrl: string;
  } | null>(null);

  // Tab 2 state: Webhook
  const [webhookUrl, setWebhookUrl] = useState("");
  const [copiedScript, setCopiedScript] = useState(false);

  // Tab 3 state: OAuth
  const [clientId, setClientId] = useState("");
  const [isEditingClientId, setIsEditingClientId] = useState(false);
  const [showOAuthInstructions, setShowOAuthInstructions] = useState(false);

  // Cloud upload result & history
  const [cloudSuccessResult, setCloudSuccessResult] = useState<{
    fileName: string;
    driveLink: string;
    totalRecords: number;
  } | null>(null);
  const [history, setHistory] = useState<DriveBackupRecord[]>([]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedClientId = localStorage.getItem("fc_google_client_id") || "";
      setClientId(savedClientId);
      const savedWebhook = localStorage.getItem("fc_gdrive_webhook_url") || "";
      setWebhookUrl(savedWebhook);
      setHistory(getStoredDriveBackups());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // TAB 1: 1-Click Save & Open Google Drive
  const handleOneClickSave = async () => {
    setErrorMsg(null);
    try {
      setLoading(true);
      setProgressMsg("Generating complete 11-module database backup...");

      const { blob, fileName, totalRecords } = await generateExcelBackupBlob();

      setProgressMsg("Downloading file and opening Google Drive...");
      triggerFileDownload(blob, fileName);

      // Open Google Drive in new tab
      if (typeof window !== "undefined") {
        window.open("https://drive.google.com/drive/u/0/my-drive", "_blank");
      }

      setOneClickResult({
        fileName,
        totalRecords,
        downloadUrl: "https://drive.google.com/drive/u/0/my-drive",
      });
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to generate Excel backup.");
    } finally {
      setLoading(false);
      setProgressMsg("");
    }
  };

  // TAB 2: Upload via Google Apps Script Webhook
  const handleWebhookUpload = async () => {
    setErrorMsg(null);
    setCloudSuccessResult(null);

    const activeWebhook = webhookUrl.trim();
    if (!activeWebhook) {
      setErrorMsg("Please paste your Google Apps Script Web App URL first.");
      return;
    }

    if (typeof window !== "undefined") {
      localStorage.setItem("fc_gdrive_webhook_url", activeWebhook);
    }

    try {
      setLoading(true);
      setProgressMsg("Connecting to your Google Apps Script...");

      const res = await uploadToAppsScriptWebhook(activeWebhook, (msg) => {
        setProgressMsg(msg);
      });

      if (res.success && res.driveLink && res.fileName) {
        setCloudSuccessResult({
          fileName: res.fileName,
          driveLink: res.driveLink,
          totalRecords: res.totalRecords || 0,
        });
        setHistory(getStoredDriveBackups());
      } else {
        setErrorMsg(res.error || "Failed to upload to Google Drive via Apps Script.");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "An unexpected error occurred during cloud upload.");
    } finally {
      setLoading(false);
      setProgressMsg("");
    }
  };

  // TAB 3: Upload via Google Cloud OAuth
  const handleOAuthUpload = async () => {
    setErrorMsg(null);
    setCloudSuccessResult(null);

    const activeClientId = clientId.trim();
    if (!activeClientId) {
      setErrorMsg("Please enter your Google OAuth Client ID before connecting to Google Drive.");
      setIsEditingClientId(true);
      return;
    }

    if (typeof window !== "undefined") {
      localStorage.setItem("fc_google_client_id", activeClientId);
      setIsEditingClientId(false);
    }

    try {
      setLoading(true);
      setProgressMsg("Starting cloud backup...");

      const res = await executeGoogleDriveBackup(activeClientId, (msg) => {
        setProgressMsg(msg);
      });

      if (res.success && res.driveLink && res.fileName) {
        setCloudSuccessResult({
          fileName: res.fileName,
          driveLink: res.driveLink,
          totalRecords: res.totalRecords || 0,
        });
        setHistory(getStoredDriveBackups());
      } else {
        setErrorMsg(res.error || "Google Drive backup failed.");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "An unexpected error occurred during Google Drive backup.");
    } finally {
      setLoading(false);
      setProgressMsg("");
    }
  };

  const handleCopyScript = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(APPS_SCRIPT_CODE);
      setCopiedScript(true);
      setTimeout(() => setCopiedScript(false), 3000);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(15, 5, 25, 0.75)",
        backdropFilter: "blur(6px)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 99999,
        padding: "16px",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#ffffff",
          borderRadius: "16px",
          width: "100%",
          maxWidth: "720px",
          maxHeight: "92vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 25px 60px rgba(0, 0, 0, 0.45)",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: "18px 24px",
            background: "linear-gradient(135deg, #1e0836 0%, #3b185f 100%)",
            color: "#ffffff",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div
              style={{
                width: "42px",
                height: "42px",
                borderRadius: "10px",
                background: "#ffffff",
                display: "grid",
                placeItems: "center",
                boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
              }}
            >
              <svg width="24" height="24" viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg">
                <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/>
                <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44c-.8 1.4-1.2 2.95-1.2 4.5h27.5z" fill="#00ac47"/>
                <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z" fill="#ea4335"/>
                <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d"/>
                <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc"/>
                <path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00"/>
              </svg>
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: "17px", fontWeight: 800 }}>
                Google Drive Backup Center
              </h3>
              <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#c084fc" }}>
                Backup your full 11-module database to Google Drive in Excel (.xlsx) format
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: "rgba(255, 255, 255, 0.15)",
              border: "none",
              color: "#ffffff",
              borderRadius: "50%",
              width: "32px",
              height: "32px",
              cursor: "pointer",
              fontSize: "16px",
              display: "grid",
              placeItems: "center",
            }}
          >
            ✕
          </button>
        </div>

        {/* Tab Selection Bar */}
        <div
          style={{
            display: "flex",
            background: "#f1f5f9",
            borderBottom: "1px solid #e2e8f0",
            padding: "8px 16px 0 16px",
            gap: "8px",
          }}
        >
          <button
            type="button"
            onClick={() => {
              setActiveTab("one_click");
              setErrorMsg(null);
            }}
            style={{
              padding: "10px 16px",
              border: "none",
              borderBottom: activeTab === "one_click" ? "3px solid #7c3aed" : "3px solid transparent",
              background: activeTab === "one_click" ? "#ffffff" : "transparent",
              color: activeTab === "one_click" ? "#5b21b6" : "#64748b",
              fontWeight: 800,
              fontSize: "13px",
              borderRadius: "8px 8px 0 0",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <span>⚡ Easy 1-Click Save</span>
            <span
              style={{
                fontSize: "10px",
                background: "#dcfce7",
                color: "#15803d",
                padding: "2px 6px",
                borderRadius: "10px",
                fontWeight: 800,
              }}
            >
              Recommended
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab("webhook");
              setErrorMsg(null);
            }}
            style={{
              padding: "10px 16px",
              border: "none",
              borderBottom: activeTab === "webhook" ? "3px solid #7c3aed" : "3px solid transparent",
              background: activeTab === "webhook" ? "#ffffff" : "transparent",
              color: activeTab === "webhook" ? "#5b21b6" : "#64748b",
              fontWeight: 800,
              fontSize: "13px",
              borderRadius: "8px 8px 0 0",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <span>🔗 Auto Webhook</span>
            <span
              style={{
                fontSize: "10px",
                background: "#f3e8ff",
                color: "#6b21a8",
                padding: "2px 6px",
                borderRadius: "10px",
                fontWeight: 800,
              }}
            >
              1-Min Setup
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab("oauth");
              setErrorMsg(null);
            }}
            style={{
              padding: "10px 16px",
              border: "none",
              borderBottom: activeTab === "oauth" ? "3px solid #7c3aed" : "3px solid transparent",
              background: activeTab === "oauth" ? "#ffffff" : "transparent",
              color: activeTab === "oauth" ? "#5b21b6" : "#64748b",
              fontWeight: 800,
              fontSize: "13px",
              borderRadius: "8px 8px 0 0",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <span>⚙️ Google Cloud API</span>
            <span
              style={{
                fontSize: "10px",
                background: "#f1f5f9",
                color: "#475569",
                padding: "2px 6px",
                borderRadius: "10px",
                fontWeight: 800,
              }}
            >
              Advanced
            </span>
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: "20px 24px", overflowY: "auto", flex: 1, background: "#faf8fc" }}>
          {/* Error Banner */}
          {errorMsg && (
            <div
              style={{
                background: "#fef2f2",
                border: "1px solid #fecaca",
                color: "#991b1b",
                padding: "12px 16px",
                borderRadius: "10px",
                marginBottom: "16px",
                fontSize: "13px",
                lineHeight: 1.45,
              }}
            >
              <strong>⚠ Backup Notice:</strong> {errorMsg}
            </div>
          )}

          {/* Cloud Success Banner (For Webhook & OAuth) */}
          {cloudSuccessResult && (
            <div
              style={{
                background: "#f0fdf4",
                border: "1.5px solid #86efac",
                color: "#166534",
                padding: "16px 20px",
                borderRadius: "12px",
                marginBottom: "18px",
                boxShadow: "0 4px 12px rgba(22, 101, 52, 0.08)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 800, fontSize: "15px" }}>
                <span>✓</span> Successfully Uploaded to Google Drive!
              </div>
              <p style={{ margin: "6px 0 12px 0", fontSize: "13px", color: "#15803d" }}>
                <strong>{cloudSuccessResult.fileName}</strong> ({cloudSuccessResult.totalRecords} records across 11 sheets) was saved in your <strong>&quot;Food Court Cloud Backups&quot;</strong> Google Drive folder.
              </p>
              <a
                href={cloudSuccessResult.driveLink}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  background: "#16a34a",
                  color: "#ffffff",
                  padding: "8px 18px",
                  borderRadius: "8px",
                  fontWeight: 700,
                  fontSize: "13px",
                  textDecoration: "none",
                  boxShadow: "0 2px 8px rgba(22, 163, 74, 0.3)",
                }}
              >
                <span>🔗</span> Open in Google Drive / Sheets
              </a>
            </div>
          )}

          {/* ========================================================
              TAB 1: EASY 1-CLICK SAVE (NO SETUP)
             ======================================================== */}
          {activeTab === "one_click" && (
            <div>
              <div
                style={{
                  background: "linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)",
                  border: "1.5px solid #ddd6fe",
                  borderRadius: "14px",
                  padding: "20px",
                  marginBottom: "20px",
                  textAlign: "center",
                }}
              >
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                    background: "#ffffff",
                    padding: "6px 14px",
                    borderRadius: "20px",
                    fontSize: "12px",
                    fontWeight: 800,
                    color: "#6b21a8",
                    marginBottom: "12px",
                    boxShadow: "0 2px 6px rgba(107, 33, 168, 0.1)",
                  }}
                >
                  <span>✨</span> No Google Cloud Console or API Key Required
                </div>

                <h4 style={{ margin: "0 0 6px 0", fontSize: "17px", fontWeight: 800, color: "#1e1b4b" }}>
                  Save Complete Database to Google Drive
                </h4>
                <p style={{ margin: "0 0 16px 0", fontSize: "13px", color: "#475569", maxWidth: "520px", marginLeft: "auto", marginRight: "auto", lineHeight: 1.5 }}>
                  Click below to generate your 11-module Excel database backup file and immediately open Google Drive ready for you to save.
                </p>

                <button
                  type="button"
                  onClick={handleOneClickSave}
                  disabled={loading}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "10px",
                    background: loading
                      ? "#94a3b8"
                      : "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "10px",
                    padding: "13px 26px",
                    fontWeight: 800,
                    fontSize: "14.5px",
                    cursor: loading ? "not-allowed" : "pointer",
                    boxShadow: "0 4px 16px rgba(124, 58, 237, 0.35)",
                    transition: "all 0.15s ease",
                  }}
                >
                  <svg width="20" height="20" viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg">
                    <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#ffffff" opacity="0.9"/>
                    <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44c-.8 1.4-1.2 2.95-1.2 4.5h27.5z" fill="#ffffff" opacity="0.8"/>
                    <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z" fill="#ffffff" opacity="0.9"/>
                  </svg>
                  <span>{loading ? (progressMsg || "Generating Backup...") : "⚡ 1-Click Save & Open Google Drive"}</span>
                </button>
              </div>

              {/* Success Result Step Guide */}
              {oneClickResult && (
                <div
                  style={{
                    background: "#ffffff",
                    border: "1.5px solid #86efac",
                    borderRadius: "14px",
                    padding: "18px 22px",
                    marginBottom: "20px",
                    boxShadow: "0 4px 14px rgba(22, 101, 52, 0.08)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#15803d", fontWeight: 800, fontSize: "15px" }}>
                    <span>✓</span> Backup Downloaded! Follow These 2 Quick Steps:
                  </div>
                  <p style={{ margin: "6px 0 14px 0", fontSize: "13px", color: "#334155" }}>
                    File: <strong>{oneClickResult.fileName}</strong> ({oneClickResult.totalRecords} records across 11 sheets)
                  </p>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "16px" }}>
                    <div
                      style={{
                        background: "#f8fafc",
                        border: "1px solid #e2e8f0",
                        borderRadius: "10px",
                        padding: "12px 14px",
                      }}
                    >
                      <div style={{ fontWeight: 800, fontSize: "12px", color: "#0284c7", marginBottom: "4px" }}>
                        STEP 1: SWITCH TO DRIVE
                      </div>
                      <div style={{ fontSize: "12.5px", color: "#475569", lineHeight: 1.4 }}>
                        We opened your <strong>Google Drive</strong> tab in your browser. If not opened, click the button below.
                      </div>
                    </div>

                    <div
                      style={{
                        background: "#f8fafc",
                        border: "1px solid #e2e8f0",
                        borderRadius: "10px",
                        padding: "12px 14px",
                      }}
                    >
                      <div style={{ fontWeight: 800, fontSize: "12px", color: "#16a34a", marginBottom: "4px" }}>
                        STEP 2: DRAG & DROP
                      </div>
                      <div style={{ fontSize: "12.5px", color: "#475569", lineHeight: 1.4 }}>
                        Drag the downloaded <code>.xlsx</code> file from your downloads bar right into Google Drive, or click <strong>+ New &rarr; File upload</strong>.
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                    <a
                      href="https://drive.google.com/drive/my-drive"
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        background: "#2563eb",
                        color: "#ffffff",
                        padding: "8px 16px",
                        borderRadius: "8px",
                        fontWeight: 700,
                        fontSize: "12.5px",
                        textDecoration: "none",
                      }}
                    >
                      <span>🚀</span> Open Google Drive Tab
                    </a>

                    <a
                      href="https://sheets.google.com"
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        background: "#16a34a",
                        color: "#ffffff",
                        padding: "8px 16px",
                        borderRadius: "8px",
                        fontWeight: 700,
                        fontSize: "12.5px",
                        textDecoration: "none",
                      }}
                    >
                      <span>📊</span> Open Google Sheets
                    </a>

                    <button
                      type="button"
                      onClick={handleOneClickSave}
                      style={{
                        background: "#f1f5f9",
                        border: "1px solid #cbd5e1",
                        color: "#334155",
                        padding: "8px 14px",
                        borderRadius: "8px",
                        fontWeight: 700,
                        fontSize: "12.5px",
                        cursor: "pointer",
                      }}
                    >
                      ⬇ Download Again
                    </button>
                  </div>
                </div>
              )}

              {/* Modules Included in Every Backup */}
              <div
                style={{
                  background: "#ffffff",
                  border: "1px solid #e9ddf5",
                  borderRadius: "12px",
                  padding: "16px 20px",
                  marginBottom: "16px",
                }}
              >
                <div style={{ fontWeight: 800, fontSize: "13.5px", color: "#180828", marginBottom: "8px", display: "flex", alignItems: "center", gap: "6px" }}>
                  <span>📋</span> 11 Database Modules Automatically Included in Every Backup:
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "8px", fontSize: "12px", color: "#475569" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span style={{ color: "#7c3aed" }}>✓</span> Events & Billing (All Invoices)
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span style={{ color: "#7c3aed" }}>✓</span> Payments Received
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span style={{ color: "#7c3aed" }}>✓</span> Expenses Ledger
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span style={{ color: "#7c3aed" }}>✓</span> Expense Settlements
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span style={{ color: "#7c3aed" }}>✓</span> Kitchen Staff Directory
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span style={{ color: "#7c3aed" }}>✓</span> Kitchen Daily Duties Log
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span style={{ color: "#7c3aed" }}>✓</span> Kitchen Payments & Advances
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span style={{ color: "#7c3aed" }}>✓</span> Event Staff Directory
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span style={{ color: "#7c3aed" }}>✓</span> Customers Directory
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span style={{ color: "#7c3aed" }}>✓</span> Food Menu Catalog
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span style={{ color: "#7c3aed" }}>✓</span> Decor Inventory
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================
              TAB 2: AUTOMATED WEBHOOK (GOOGLE APPS SCRIPT)
             ======================================================== */}
          {activeTab === "webhook" && (
            <div>
              <div
                style={{
                  background: "#ffffff",
                  border: "1.5px solid #e9ddf5",
                  borderRadius: "12px",
                  padding: "16px 20px",
                  marginBottom: "16px",
                }}
              >
                <div style={{ fontWeight: 800, fontSize: "14px", color: "#180828", marginBottom: "4px" }}>
                  1-Minute Direct Cloud Upload Setup
                </div>
                <p style={{ margin: "0 0 12px 0", fontSize: "12.5px", color: "#64748b", lineHeight: 1.45 }}>
                  This allows you to upload backups straight into your Google Drive with 1 click without ever opening Google Cloud Console.
                </p>

                {/* 3 Step Setup Instructions */}
                <div
                  style={{
                    background: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    borderRadius: "10px",
                    padding: "12px 14px",
                    fontSize: "12px",
                    color: "#334155",
                    lineHeight: 1.55,
                    marginBottom: "14px",
                  }}
                >
                  <div style={{ fontWeight: 800, color: "#1e293b", marginBottom: "6px" }}>
                    Quick 3-Step Setup:
                  </div>
                  <ol style={{ margin: 0, paddingLeft: "18px" }}>
                    <li>
                      Open{" "}
                      <a
                        href="https://script.google.com/home/start"
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: "#7c3aed", fontWeight: 700, textDecoration: "underline" }}
                      >
                        script.google.com &rarr; New project
                      </a>
                    </li>
                    <li>
                      Replace the default code with the snippet below and click <strong>Save</strong>.
                    </li>
                    <li>
                      Click <strong>Deploy &rarr; New deployment</strong> &rarr; Select type <strong>Web app</strong> &rarr; Set <em>Execute as: Me</em> &amp; <em>Who has access: Anyone</em> &rarr; Click <strong>Deploy</strong> and copy the Web App URL!
                    </li>
                  </ol>
                </div>

                {/* Code Snippet Box */}
                <div style={{ position: "relative", marginBottom: "14px" }}>
                  <pre
                    style={{
                      background: "#1e1b4b",
                      color: "#e0e7ff",
                      padding: "12px 14px",
                      borderRadius: "8px",
                      fontSize: "11px",
                      fontFamily: "monospace",
                      overflowX: "auto",
                      maxHeight: "150px",
                      margin: 0,
                    }}
                  >
                    {APPS_SCRIPT_CODE}
                  </pre>
                  <button
                    type="button"
                    onClick={handleCopyScript}
                    style={{
                      position: "absolute",
                      top: "8px",
                      right: "8px",
                      background: copiedScript ? "#16a34a" : "#7c3aed",
                      color: "#ffffff",
                      border: "none",
                      borderRadius: "6px",
                      padding: "4px 10px",
                      fontSize: "11px",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    {copiedScript ? "✓ Copied!" : "📋 Copy Script"}
                  </button>
                </div>

                {/* Webhook URL Input */}
                <div style={{ marginBottom: "14px" }}>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>
                    Paste Your Deployed Web App URL:
                  </label>
                  <input
                    type="text"
                    placeholder="https://script.google.com/macros/s/.../exec"
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      borderRadius: "8px",
                      border: "1.5px solid #cbd5e1",
                      fontSize: "12.5px",
                      fontFamily: "monospace",
                      boxSizing: "border-box",
                      outline: "none",
                    }}
                  />
                </div>

                <button
                  type="button"
                  onClick={handleWebhookUpload}
                  disabled={loading}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                    background: loading
                      ? "#94a3b8"
                      : "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "8px",
                    padding: "11px 22px",
                    fontWeight: 800,
                    fontSize: "13.5px",
                    cursor: loading ? "not-allowed" : "pointer",
                    boxShadow: "0 4px 14px rgba(37, 99, 235, 0.3)",
                  }}
                >
                  <span>☁️</span>
                  <span>{loading ? (progressMsg || "Uploading to Google Drive...") : "Upload Directly to Google Drive"}</span>
                </button>
              </div>
            </div>
          )}

          {/* ========================================================
              TAB 3: GOOGLE CLOUD OAUTH API (ADVANCED)
             ======================================================== */}
          {activeTab === "oauth" && (
            <div>
              <div
                style={{
                  background: "#ffffff",
                  border: "1.5px solid #e9ddf5",
                  borderRadius: "12px",
                  padding: "16px 20px",
                  marginBottom: "16px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                  <div style={{ fontWeight: 800, fontSize: "14px", color: "#180828", display: "flex", alignItems: "center", gap: "6px" }}>
                    <span>🔑</span> Google OAuth 2.0 Web Client ID
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowOAuthInstructions((prev) => !prev)}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "#7c3aed",
                      fontWeight: 700,
                      fontSize: "12px",
                      cursor: "pointer",
                    }}
                  >
                    {showOAuthInstructions ? "Hide Setup Guide ▲" : "How to get a Client ID? ▼"}
                  </button>
                </div>

                {showOAuthInstructions && (
                  <div
                    style={{
                      background: "#f5f3ff",
                      border: "1px solid #ddd6fe",
                      borderRadius: "8px",
                      padding: "12px 16px",
                      marginBottom: "12px",
                      fontSize: "12px",
                      color: "#4c1d95",
                      lineHeight: 1.55,
                    }}
                  >
                    <strong>3 Steps to configure Google Cloud OAuth:</strong>
                    <ol style={{ margin: "6px 0 0 0", paddingLeft: "18px" }}>
                      <li>
                        Visit{" "}
                        <a
                          href="https://console.cloud.google.com/apis/credentials"
                          target="_blank"
                          rel="noreferrer"
                          style={{ color: "#7c3aed", fontWeight: 700, textDecoration: "underline" }}
                        >
                          Google Cloud Console &rarr; Credentials
                        </a>
                      </li>
                      <li>Enable the <strong>Google Drive API</strong>.</li>
                      <li>
                        Create an <strong>OAuth 2.0 Client ID</strong> (Web application), add your origin (e.g. <code>{typeof window !== "undefined" ? window.location.origin : "http://localhost:3000"}</code>) to <strong>Authorized JavaScript origins</strong>, and paste the Client ID below.
                      </li>
                    </ol>
                  </div>
                )}

                {isEditingClientId ? (
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "16px" }}>
                    <input
                      type="text"
                      placeholder="e.g. 123456789-abcdefgh.apps.googleusercontent.com"
                      value={clientId}
                      onChange={(e) => setClientId(e.target.value)}
                      style={{
                        flex: "1 1 280px",
                        padding: "9px 12px",
                        borderRadius: "8px",
                        border: "1.5px solid #c084fc",
                        fontSize: "12.5px",
                        fontFamily: "monospace",
                        outline: "none",
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (typeof window !== "undefined") {
                          localStorage.setItem("fc_google_client_id", clientId.trim());
                          setIsEditingClientId(false);
                        }
                      }}
                      style={{
                        background: "#7c3aed",
                        color: "#ffffff",
                        border: "none",
                        borderRadius: "8px",
                        padding: "9px 16px",
                        fontWeight: 700,
                        fontSize: "12.5px",
                        cursor: "pointer",
                      }}
                    >
                      Save ID
                    </button>
                  </div>
                ) : (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#f8fafc", padding: "8px 12px", borderRadius: "8px", border: "1px solid #e2e8f0", marginBottom: "16px" }}>
                    <span style={{ fontSize: "12px", fontFamily: "monospace", color: "#334155", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "420px" }}>
                      {clientId || "(No Google Client ID set)"}
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsEditingClientId(true)}
                      style={{
                        background: "#f1f5f9",
                        border: "1px solid #cbd5e1",
                        borderRadius: "6px",
                        padding: "4px 10px",
                        fontSize: "11px",
                        fontWeight: 700,
                        cursor: "pointer",
                        color: "#475569",
                      }}
                    >
                      ✏️ Edit
                    </button>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleOAuthUpload}
                  disabled={loading}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                    background: loading
                      ? "#94a3b8"
                      : "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "8px",
                    padding: "11px 22px",
                    fontWeight: 800,
                    fontSize: "13.5px",
                    cursor: loading ? "not-allowed" : "pointer",
                    boxShadow: "0 4px 14px rgba(37, 99, 235, 0.3)",
                  }}
                >
                  <span>☁️</span>
                  <span>{loading ? (progressMsg || "Connecting to Google Account...") : "Connect & Upload via Google OAuth"}</span>
                </button>
              </div>
            </div>
          )}

          {/* Backup History */}
          {history.length > 0 && (
            <div
              style={{
                background: "#ffffff",
                border: "1px solid #e9ddf5",
                borderRadius: "12px",
                padding: "16px 20px",
              }}
            >
              <div style={{ fontWeight: 800, fontSize: "13.5px", color: "#180828", marginBottom: "10px", display: "flex", alignItems: "center", gap: "6px" }}>
                <span>📁</span> Recent Google Drive Backups
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {history.map((rec) => (
                  <div
                    key={rec.id + rec.backupDate}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "10px 14px",
                      background: "#f8fafc",
                      border: "1px solid #e2e8f0",
                      borderRadius: "8px",
                      fontSize: "12px",
                      flexWrap: "wrap",
                      gap: "8px",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, color: "#0f172a" }}>{rec.fileName}</div>
                      <div style={{ color: "#64748b", fontSize: "11px", marginTop: "2px" }}>
                        {new Date(rec.backupDate).toLocaleString("en-IN")} • {rec.totalRecords} records
                      </div>
                    </div>

                    <a
                      href={rec.driveLink}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        color: "#2563eb",
                        fontWeight: 700,
                        textDecoration: "none",
                        background: "#eff6ff",
                        padding: "4px 10px",
                        borderRadius: "6px",
                        border: "1px solid #bfdbfe",
                      }}
                    >
                      🔗 Open in Drive
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
