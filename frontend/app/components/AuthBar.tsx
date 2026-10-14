"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ROLE_INFO, useAuth } from "../lib/auth";

export function SidebarUserCard() {
  const router = useRouter();
  const { user, logout } = useAuth();

  if (!user) {
    return (
      <div className="sidebar-user" style={{ padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Link
          href="/login"
          style={{
            background: "linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)",
            color: "#ffffff",
            padding: "9px 14px",
            borderRadius: "8px",
            fontWeight: 700,
            fontSize: "12px",
            textDecoration: "none",
            display: "inline-block",
            width: "100%",
            textAlign: "center",
            boxShadow: "0 4px 14px rgba(124, 58, 237, 0.35)",
          }}
        >
          Sign In →
        </Link>
      </div>
    );
  }

  const roleMeta = ROLE_INFO[user.role] || ROLE_INFO.admin;

  return (
    <div
      style={{
        padding: "12px",
        background: "rgba(255, 255, 255, 0.05)",
        borderRadius: "10px",
        marginTop: "8px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div
            className="user-avatar"
            style={{
              width: "34px",
              height: "34px",
              borderRadius: "8px",
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
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <strong style={{ color: "#ffffff", fontSize: "12px", display: "block" }}>{user.name}</strong>
            <span
              style={{
                display: "inline-block",
                fontSize: "10px",
                fontWeight: 700,
                background: roleMeta.bg,
                color: roleMeta.color,
                padding: "2px 6px",
                borderRadius: "6px",
                marginTop: "2px",
              }}
            >
              {roleMeta.badge}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={logout}
          title="Sign Out / Switch Role"
          style={{
            background: "rgba(255, 255, 255, 0.12)",
            border: "none",
            color: "#ffffff",
            borderRadius: "6px",
            padding: "5px 8px",
            fontSize: "11px",
            fontWeight: 600,
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
        >
          Logout
        </button>
      </div>
    </div>
  );
}

export function OwnerBanner() {
  const { isOwner } = useAuth();
  if (!isOwner) return null;

  return (
    <div
      style={{
        background: "linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)",
        border: "1px solid #fde68a",
        borderRadius: "10px",
        padding: "10px 16px",
        marginBottom: "20px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "12px",
        boxShadow: "0 2px 6px rgba(180, 83, 9, 0.05)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <span style={{ fontSize: "18px" }}>👁️</span>
        <div>
          <strong style={{ color: "#92400e", fontSize: "13px" }}>Owner Mode: Read-Only Access Active</strong>
          <p style={{ margin: "2px 0 0 0", color: "#b45309", fontSize: "12px" }}>
            You have full operational and financial visibility across all modules. Record creation, updates, and deletions are disabled.
          </p>
        </div>
      </div>
      <span
        style={{
          background: "#b45309",
          color: "#ffffff",
          padding: "3px 8px",
          borderRadius: "12px",
          fontSize: "10px",
          fontWeight: 700,
          whiteSpace: "nowrap",
        }}
      >
        Read Only
      </span>
    </div>
  );
}

export function NavLink({
  href,
  active,
  icon,
  label,
}: {
  href: string;
  active?: boolean;
  icon: string;
  label: string;
}) {
  const { isManager } = useAuth();
  const isLocked = isManager && !href.startsWith("/staff");

  if (isLocked) {
    return (
      <div
        className="nav-item"
        style={{
          opacity: 0.45,
          cursor: "not-allowed",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          userSelect: "none",
        }}
        title="Manager role: access restricted to Staff & Wage Payments"
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span className="nav-icon">{icon}</span>
          <span>{label}</span>
        </div>
        <span style={{ fontSize: "11px", opacity: 0.8 }}>🔒</span>
      </div>
    );
  }

  return (
    <Link href={href} className={`nav-item ${active ? "active" : ""}`}>
      <span className="nav-icon">{icon}</span>
      <span>{label}</span>
    </Link>
  );
}

export function TopbarUserBadge() {
  const { user, logout, isOwner } = useAuth();
  if (!user) return null;

  const roleMeta = ROLE_INFO[user.role] || ROLE_INFO.admin;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
      <div
        className="top-user"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "5px 12px",
          borderRadius: "10px",
          background: "#ffffff",
          border: "1px solid #ebe2f5",
          boxShadow: "0 1px 4px rgba(30, 8, 54, 0.04)",
        }}
      >
        <div
          className="user-avatar"
          style={{
            width: "30px",
            height: "30px",
            borderRadius: "8px",
            background: roleMeta.bg,
            color: roleMeta.color,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 800,
            fontSize: "12px",
          }}
        >
          {user.name.charAt(0).toUpperCase()}
        </div>
        <div style={{ textAlign: "left" }}>
          <strong style={{ display: "block", fontSize: "12px", color: "#1e0836", lineHeight: 1.2 }}>
            {user.name}
          </strong>
          <small style={{ fontSize: "10px", color: roleMeta.color, fontWeight: 700 }}>
            {roleMeta.badge}
          </small>
        </div>
      </div>
      <button
        type="button"
        onClick={logout}
        title="Sign Out"
        style={{
          background: "#f5f3ff",
          border: "1px solid #ddd6fe",
          color: "#6d28d9",
          borderRadius: "8px",
          padding: "6px 12px",
          fontSize: "12px",
          cursor: "pointer",
          fontWeight: 700,
          transition: "all 0.15s ease",
        }}
      >
        🚪 Logout
      </button>
    </div>
  );
}

export { MobileNavProvider, useMobileNav, MobileMenuButton, AppSidebar } from "./NavDrawer";

