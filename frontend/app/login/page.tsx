"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { getAuthUser, setAuthUser, getApiUrl } from "../lib/auth";

export default function LoginPage() {
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // If already logged in, redirect based on role
  useEffect(() => {
    const existing = getAuthUser();
    if (existing) {
      if (existing.role === "manager") {
        router.replace("/staff");
      } else {
        router.replace("/");
      }
    }
  }, [router]);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();

    const u = username.trim();
    const p = password.trim();

    if (!u || !p) {
      setError("Please enter both username and password.");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const apiUrl = getApiUrl();
      const res = await fetch(`${apiUrl}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: u, password: p }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.detail || "Invalid username or password.");
      }

      const userData = await res.json();
      setAuthUser(userData);

      // Clean redirect to dashboard or staff page
      window.location.href = userData.role === "manager" ? "/staff" : "/";
    } catch (err: any) {
      if (err.name === "TypeError" && (err.message?.includes("fetch") || err.message?.includes("NetworkError"))) {
        setError("Unable to connect to backend server. Please check your connection.");
      } else {
        setError(err.message || "Failed to log in.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        background: "radial-gradient(circle at 50% 15%, #250b44 0%, #120422 100%)",
        padding: "clamp(16px, 4vw, 32px)",
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "440px",
          background: "#ffffff",
          borderRadius: "18px",
          boxShadow: "0 24px 60px rgba(18, 4, 34, 0.45), 0 0 0 1px rgba(124, 58, 237, 0.12)",
          overflow: "hidden",
        }}
      >
        {/* Brand Header */}
        <div
          style={{
            background: "linear-gradient(135deg, #180828 0%, #2b0c4c 100%)",
            padding: "32px 24px 28px",
            color: "#ffffff",
            textAlign: "center",
            borderBottom: "1px solid rgba(168, 85, 247, 0.15)",
          }}
        >
          <div
            style={{
              width: "54px",
              height: "54px",
              borderRadius: "14px",
              background: "linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)",
              color: "#ffffff",
              fontWeight: 800,
              fontSize: "19px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 14px auto",
              boxShadow: "0 8px 24px rgba(124, 58, 237, 0.4)",
            }}
          >
            FC
          </div>
          <h1 style={{ margin: "0 0 6px 0", fontSize: "22px", fontWeight: 700, letterSpacing: "-0.02em" }}>
            Food Court Portal
          </h1>
          <span style={{ fontSize: "12px", color: "#c084fc", fontWeight: 500, display: "block" }}>
            Sign in to access your management dashboard
          </span>
        </div>

        {/* Form Body */}
        <div style={{ padding: "clamp(22px, 5vw, 32px)" }}>
          {/* Error Banner */}
          {error && (
            <div
              style={{
                background: "#fef2f2",
                border: "1px solid #fecaca",
                color: "#991b1b",
                padding: "11px 14px",
                borderRadius: "8px",
                marginBottom: "20px",
                fontSize: "13px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <span style={{ fontSize: "15px" }}>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: "18px" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "12px",
                  fontWeight: 700,
                  color: "#1e0836",
                  marginBottom: "7px",
                  letterSpacing: "0.2px",
                }}
              >
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your username"
                required
                autoFocus
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  borderRadius: "8px",
                  border: "1px solid #dcd2ea",
                  fontSize: "14px",
                  background: "#faf8fd",
                  color: "#1e0836",
                  outline: "none",
                  boxSizing: "border-box",
                  transition: "border-color 0.15s ease, box-shadow 0.15s ease",
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "#7c3aed";
                  e.currentTarget.style.boxShadow = "0 0 0 3px rgba(124, 58, 237, 0.15)";
                  e.currentTarget.style.background = "#ffffff";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = "#dcd2ea";
                  e.currentTarget.style.boxShadow = "none";
                  e.currentTarget.style.background = "#faf8fd";
                }}
              />
            </div>

            <div style={{ marginBottom: "26px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "7px" }}>
                <label
                  style={{
                    fontSize: "12px",
                    fontWeight: 700,
                    color: "#1e0836",
                    letterSpacing: "0.2px",
                  }}
                >
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "#7c3aed",
                    fontSize: "12px",
                    cursor: "pointer",
                    fontWeight: 600,
                    padding: 0,
                  }}
                >
                  {showPassword ? "Hide password" : "Show password"}
                </button>
              </div>
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  borderRadius: "8px",
                  border: "1px solid #dcd2ea",
                  fontSize: "14px",
                  background: "#faf8fd",
                  color: "#1e0836",
                  outline: "none",
                  boxSizing: "border-box",
                  transition: "border-color 0.15s ease, box-shadow 0.15s ease",
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "#7c3aed";
                  e.currentTarget.style.boxShadow = "0 0 0 3px rgba(124, 58, 237, 0.15)";
                  e.currentTarget.style.background = "#ffffff";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = "#dcd2ea";
                  e.currentTarget.style.boxShadow = "none";
                  e.currentTarget.style.background = "#faf8fd";
                }}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%",
                padding: "13px 20px",
                borderRadius: "8px",
                background: "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)",
                color: "#ffffff",
                border: "none",
                fontWeight: 700,
                fontSize: "14px",
                cursor: loading ? "not-allowed" : "pointer",
                boxShadow: "0 6px 18px rgba(124, 58, 237, 0.35)",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                gap: "8px",
                transition: "transform 0.15s ease, box-shadow 0.15s ease",
              }}
              onMouseEnter={(e) => {
                if (!loading) {
                  e.currentTarget.style.transform = "translateY(-1px)";
                  e.currentTarget.style.boxShadow = "0 8px 22px rgba(124, 58, 237, 0.45)";
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "none";
                e.currentTarget.style.boxShadow = "0 6px 18px rgba(124, 58, 237, 0.35)";
              }}
            >
              {loading ? (
                "Signing In..."
              ) : (
                <>
                  <span>Sign In</span>
                  <span style={{ fontSize: "16px" }}>→</span>
                </>
              )}
            </button>
          </form>

          {/* Security Footer Notice */}
          <div
            style={{
              marginTop: "26px",
              paddingTop: "18px",
              borderTop: "1px solid #f0eaf7",
              textAlign: "center",
              fontSize: "12px",
              color: "#8a7b9b",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
            }}
          >
            <span>🔒</span>
            <span>Secure Role-Based Access Control</span>
          </div>
        </div>
      </div>
    </div>
  );
}
