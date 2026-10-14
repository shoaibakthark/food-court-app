"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SidebarUserCard, NavLink } from "./AuthBar";

interface MobileNavContextType {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
}

const MobileNavContext = createContext<MobileNavContextType>({
  isOpen: false,
  open: () => {},
  close: () => {},
  toggle: () => {},
});

export function MobileNavProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  // Automatically close sidebar when route changes
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  // Handle body scroll lock on mobile when sidebar is open
  useEffect(() => {
    if (typeof document !== "undefined") {
      if (isOpen) {
        document.body.style.overflow = "hidden";
      } else {
        document.body.style.overflow = "";
      }
    }
    return () => {
      if (typeof document !== "undefined") {
        document.body.style.overflow = "";
      }
    };
  }, [isOpen]);

  // Handle Escape key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  return (
    <MobileNavContext.Provider
      value={{
        isOpen,
        open: () => setIsOpen(true),
        close: () => setIsOpen(false),
        toggle: () => setIsOpen((prev) => !prev),
      }}
    >
      {children}
    </MobileNavContext.Provider>
  );
}

export function useMobileNav() {
  return useContext(MobileNavContext);
}

export function MobileMenuButton({ className = "" }: { className?: string }) {
  const { toggle, isOpen } = useMobileNav();
  return (
    <button
      type="button"
      className={`mobile-menu-button ${className}`}
      onClick={toggle}
      aria-label={isOpen ? "Close menu" : "Open navigation menu"}
      aria-expanded={isOpen}
      title="Toggle Navigation Menu"
    >
      <span style={{ fontSize: "20px", lineHeight: 1, pointerEvents: "none" }}>☰</span>
    </button>
  );
}

export function AppSidebar({ activeRoute }: { activeRoute: string }) {
  const { isOpen, close } = useMobileNav();

  return (
    <>
      {/* Backdrop overlay for mobile drawer */}
      <div
        className={`mobile-backdrop ${isOpen ? "active" : ""}`}
        onClick={close}
        aria-hidden="true"
      />

      <aside className={`sidebar ${isOpen ? "mobile-open" : ""}`}>
        {/* Mobile close button */}
        <button
          type="button"
          className="mobile-sidebar-close"
          onClick={close}
          aria-label="Close navigation menu"
        >
          ✕
        </button>

        {/* BRAND */}
        <Link href="/" className="brand" onClick={close} style={{ textDecoration: "none" }}>
          <div className="brand-mark">FC</div>
          <div className="brand-text">
            <h2>Food Court</h2>
            <span>EVENT MANAGEMENT</span>
          </div>
        </Link>

        {/* MAIN MENU */}
        <div className="sidebar-section">
          <span className="sidebar-title">MAIN MENU</span>
          <nav onClick={close}>
            <NavLink href="/" icon="⌂" label="Dashboard" active={activeRoute === "/"} />
            <NavLink href="/events" icon="▣" label="Events" active={activeRoute === "/events"} />
            <NavLink href="/customers" icon="♙" label="Customers" active={activeRoute === "/customers"} />
            <NavLink href="/food-menu" icon="◈" label="Food Menu" active={activeRoute === "/food-menu"} />
            <NavLink href="/decor" icon="✦" label="Decor" active={activeRoute === "/decor"} />
            <NavLink href="/equipment" icon="▤" label="Equipment" active={activeRoute === "/equipment"} />
          </nav>
        </div>

        {/* MANAGEMENT */}
        <div className="sidebar-section">
          <span className="sidebar-title">MANAGEMENT</span>
          <nav onClick={close}>
            <NavLink href="/staff" icon="♙" label="Staff" active={activeRoute === "/staff"} />
            <NavLink href="/sub-teams" icon="♧" label="Sub Teams" active={activeRoute === "/sub-teams"} />
            <NavLink href="/billing" icon="🧾" label="Billing & Invoices" active={activeRoute === "/billing"} />
            <NavLink href="/payments" icon="▥" label="Payments" active={activeRoute === "/payments"} />
            <NavLink href="/expenses" icon="◫" label="Expenses" active={activeRoute === "/expenses"} />
            <NavLink href="/reports" icon="◒" label="Reports" active={activeRoute === "/reports"} />
          </nav>
        </div>

        {/* SIDEBAR BOTTOM */}
        <div className="sidebar-bottom">
          <div onClick={close}>
            <NavLink href="/settings" icon="⚙" label="Settings" active={activeRoute === "/settings"} />
          </div>
          <SidebarUserCard />
        </div>
      </aside>
    </>
  );
}
