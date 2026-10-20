"use client";

import React, { useState, useEffect } from "react";
import {
  executeGoogleDriveBackup,
  getStoredDriveBackups,
  DriveBackupRecord,
} from "../lib/googleDriveBackup";

interface GoogleDriveBackupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function GoogleDriveBackupModal({ isOpen, onClose }: GoogleDriveBackupModalProps) {
  const [clientId, setClientId] = useState("");
  const [isEditingClientId, setIsEditingClientId] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progressMsg, setProgressMsg] = useState("");
  const [successResult, setSuccessResult] = useState<{ fileName: string; driveLink: string; totalRecords: number } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [history, setHistory] = useState<DriveBackupRecord[]>([]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("fc_google_client_id") || "";
      setClientId(saved);
      if (!saved) {
        setIsEditingClientId(true);
      }
      setHistory(getStoredDriveBackups());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSaveClientId = () => {
    if (typeof window !== "undefined") {
      localStorage.setItem("fc_google_client_id", clientId.trim());
      setIsEditingClientId(false);
    }
  };

  const handleStartBackup = async () => {
    setErrorMsg(null);
    setSuccessResult(null);

    const activeClientId = clientId.trim();
    if (!activeClientId) {
      setErrorMsg("Please enter your Google OAuth Client ID before connecting to Google Drive.");
      setIsEditingClientId(true);
      return;
    }

    try {
      setLoading(true);
      setProgressMsg("Starting cloud backup...");

      const res = await executeGoogleDriveBackup(activeClientId, (msg) => {
        setProgressMsg(msg);
      });

      if (res.success && res.driveLink && res.fileName) {
        setSuccessResult({
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

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(15, 5, 25, 0.72)",
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
          maxWidth: "680px",
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
                Google Drive Cloud Backup
              </h3>
              <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#c084fc" }}>
                Safely sync your entire database into your Google Drive in Excel (.xlsx) format
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

        {/* Modal Body */}
        <div style={{ padding: "24px", overflowY: "auto", flex: 1, background: "#faf8fc" }}>
          {/* Error Banner */}
          {errorMsg && (
            <div
              style={{
                background: "#fef2f2",
                border: "1px solid #fecaca",
                color: "#991b1b",
                padding: "12px 16px",
                borderRadius: "10px",
                marginBottom: "18px",
                fontSize: "13px",
                lineHeight: 1.45,
              }}
            >
              <strong>⚠ Backup Error:</strong> {errorMsg}
            </div>
          )}

          {/* Success Banner with Direct Google Drive Link */}
          {successResult && (
            <div
              style={{
                background: "#f0fdf4",
                border: "1.5px solid #86efac",
                color: "#166534",
                padding: "16px 20px",
                borderRadius: "12px",
                marginBottom: "20px",
                boxShadow: "0 4px 12px rgba(22, 101, 52, 0.08)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 800, fontSize: "15px" }}>
                <span>✓</span> Successfully Uploaded to Google Drive!
              </div>
              <p style={{ margin: "6px 0 12px 0", fontSize: "13px", color: "#15803d" }}>
                <strong>{successResult.fileName}</strong> ({successResult.totalRecords} records across 11 sheets) was saved in the <strong>&quot;Food Court Cloud Backups&quot;</strong> folder in your Google Drive.
              </p>
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                <a
                  href={successResult.driveLink}
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
            </div>
          )}

          {/* Step 1: Google OAuth Client ID Configuration */}
          <div
            style={{
              background: "#ffffff",
              border: "1px solid #e9ddf5",
              borderRadius: "12px",
              padding: "16px 20px",
              marginBottom: "18px",
              boxShadow: "0 2px 8px rgba(36, 16, 63, 0.02)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
              <div style={{ fontWeight: 800, fontSize: "14px", color: "#180828", display: "flex", alignItems: "center", gap: "6px" }}>
                <span>🔑</span> Google OAuth Client ID
              </div>
              <button
                type="button"
                onClick={() => setShowInstructions((prev) => !prev)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#7c3aed",
                  fontWeight: 700,
                  fontSize: "12px",
                  cursor: "pointer",
                }}
              >
                {showInstructions ? "Hide Setup Guide ▲" : "How to get a Client ID? ▼"}
              </button>
            </div>

            {/* Instruction Accordion */}
            {showInstructions && (
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
                <strong>3 Simple Steps to enable Google Drive OAuth:</strong>
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
                  <li>Enable the <strong>Google Drive API</strong> on your project.</li>
                  <li>
                    Create an <strong>OAuth 2.0 Client ID</strong> (Application type: <em>Web application</em>), add your URL (e.g. <code>{typeof window !== "undefined" ? window.location.origin : "http://localhost:3000"}</code>) to <strong>Authorized JavaScript origins</strong>, and paste the Client ID below.
                  </li>
                </ol>
              </div>
            )}

            {/* Client ID input or display */}
            {isEditingClientId ? (
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
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
                    fontSize: "13px",
                    fontFamily: "monospace",
                    outline: "none",
                  }}
                />
                <button
                  type="button"
                  onClick={handleSaveClientId}
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
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#f8fafc", padding: "8px 12px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                <span style={{ fontSize: "12.5px", fontFamily: "monospace", color: "#334155", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "420px" }}>
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
          </div>

          {/* Step 2: Big Action Button */}
          <div
            style={{
              background: "#ffffff",
              border: "1.5px solid #e9ddf5",
              borderRadius: "12px",
              padding: "20px",
              marginBottom: "20px",
              textAlign: "center",
              boxShadow: "0 4px 14px rgba(124, 58, 237, 0.05)",
            }}
          >
            <h4 style={{ margin: "0 0 6px 0", fontSize: "16px", fontWeight: 800, color: "#180828" }}>
              Upload Complete Database to Google Drive
            </h4>
            <p style={{ margin: "0 0 16px 0", fontSize: "13px", color: "#64748b", maxWidth: "480px", marginLeft: "auto", marginRight: "auto" }}>
              Exports all 11 database modules into a formatted Excel (.xlsx) file and uploads it into your private Google Drive folder.
            </p>

            <button
              type="button"
              onClick={handleStartBackup}
              disabled={loading}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "10px",
                background: loading
                  ? "#94a3b8"
                  : "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
                color: "#ffffff",
                border: "none",
                borderRadius: "10px",
                padding: "13px 28px",
                fontWeight: 800,
                fontSize: "14px",
                cursor: loading ? "not-allowed" : "pointer",
                boxShadow: "0 4px 16px rgba(37, 99, 235, 0.35)",
                transition: "all 0.15s ease",
              }}
            >
              <svg width="20" height="20" viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg">
                <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#ffffff" opacity="0.9"/>
                <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44c-.8 1.4-1.2 2.95-1.2 4.5h27.5z" fill="#ffffff" opacity="0.8"/>
                <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z" fill="#ffffff" opacity="0.9"/>
              </svg>
              <span>{loading ? (progressMsg || "Connecting to Google Drive...") : "☁️ Connect & Upload to Google Drive"}</span>
            </button>

            {loading && (
              <div style={{ marginTop: "12px", fontSize: "12.5px", color: "#2563eb", fontWeight: 700 }}>
                ⏳ {progressMsg}
              </div>
            )}
          </div>

          {/* Step 3: Google Drive Backup History */}
          {history.length > 0 && (
            <div
              style={{
                background: "#ffffff",
                border: "1px solid #e9ddf5",
                borderRadius: "12px",
                padding: "16px 20px",
              }}
            >
              <div style={{ fontWeight: 800, fontSize: "14px", color: "#180828", marginBottom: "10px", display: "flex", alignItems: "center", gap: "6px" }}>
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
