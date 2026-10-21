"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

export type UserRole = "admin" | "owner" | "manager";

export type AuthUser = {
  id: number;
  username: string;
  name: string;
  role: UserRole;
  token: string;
  permissions?: {
    all: boolean;
    read_only: boolean;
    manager_only: boolean;
    allowed_pages: string[];
  };
};

export const AUTH_STORAGE_KEY = "fc_current_user";

export const ROLE_INFO: Record<
  UserRole,
  {
    title: string;
    badge: string;
    color: string;
    bg: string;
    desc: string;
  }
> = {
  admin: {
    title: "Administrator",
    badge: "Full Access",
    color: "#3b176d",
    bg: "#eee7f8",
    desc: "Unrestricted read, write, and deletion access across all system modules.",
  },
  owner: {
    title: "Business Owner",
    badge: "Read Only",
    color: "#92400e",
    bg: "#fef3c7",
    desc: "Full operational & financial visibility. Modifications and deletions are disabled.",
  },
  manager: {
    title: "Staff Wage Manager",
    badge: "Staff Payments Only",
    color: "#1d4ed8",
    bg: "#dbeafe",
    desc: "Dedicated access restricted strictly to Staff directory and wage disbursements.",
  },
};

export function getAuthUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
    const cookies = document.cookie.split(";").map((c) => c.trim());
    const userCookie = cookies.find((c) => c.startsWith("fc_user="));
    if (userCookie) {
      const decoded = decodeURIComponent(userCookie.substring("fc_user=".length));
      return JSON.parse(decoded);
    }
    return null;
  } catch {
    return null;
  }
}

export function setAuthUser(user: AuthUser): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
  document.cookie = `fc_role=${user.role}; path=/; max-age=604800; SameSite=Lax`;
  document.cookie = `fc_user=${encodeURIComponent(JSON.stringify(user))}; path=/; max-age=604800; SameSite=Lax`;
  // Dispatch custom storage event for live tab synchronization
  window.dispatchEvent(new Event("auth-changed"));
}

export function clearAuthUser(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(AUTH_STORAGE_KEY);
  document.cookie = "fc_role=; path=/; max-age=0; SameSite=Lax";
  document.cookie = "fc_user=; path=/; max-age=0; SameSite=Lax";
  window.dispatchEvent(new Event("auth-changed"));
}

export function isManagerAllowedPath(pathname: string): boolean {
  if (!pathname) return false;
  return pathname.startsWith("/staff") || pathname.startsWith("/kitchen") || pathname.startsWith("/login");
}

export function canAccessPage(user: AuthUser | null, pathname: string): boolean {
  if (!user) return pathname === "/login";
  if (user.role === "admin" || user.role === "owner") return true;
  if (user.role === "manager") {
    return isManagerAllowedPath(pathname);
  }
  return false;
}

export function useAuth() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    function syncUser() {
      const current = getAuthUser();
      setUser(current);
      setLoading(false);

      if (!current) {
        if (typeof document !== "undefined") {
          document.cookie = "fc_role=; path=/; max-age=0; SameSite=Lax";
          document.cookie = "fc_user=; path=/; max-age=0; SameSite=Lax";
        }
        if (pathname !== "/login") {
          router.replace("/login");
          return;
        }
      } else {
        if (typeof document !== "undefined") {
          document.cookie = `fc_role=${current.role}; path=/; max-age=604800; SameSite=Lax`;
          document.cookie = `fc_user=${encodeURIComponent(JSON.stringify(current))}; path=/; max-age=604800; SameSite=Lax`;
        }
      }

      if (current && current.role === "manager" && !isManagerAllowedPath(pathname)) {
        router.replace("/staff");
      }
    }

    syncUser();

    window.addEventListener("auth-changed", syncUser);
    window.addEventListener("storage", syncUser);

    return () => {
      window.removeEventListener("auth-changed", syncUser);
      window.removeEventListener("storage", syncUser);
    };
  }, [pathname, router]);

  const logout = () => {
    clearAuthUser();
    router.replace("/login");
  };

  return {
    user,
    loading,
    role: user?.role,
    isAdmin: user?.role === "admin",
    isOwner: user?.role === "owner",
    isManager: user?.role === "manager",
    logout,
  };
}

export function getApiUrl(): string {
  if (typeof window !== "undefined") {
    return "/api/py";
  }
  return process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
}

export function authHeaders(): Record<string, string> {
  const user = getAuthUser();
  if (!user) return {};
  const headers: Record<string, string> = {
    "X-User-Role": user.role,
    "X-User-Id": String(user.id),
  };
  if (user.token) {
    headers["Authorization"] = `Bearer ${user.token}`;
  }
  return headers;
}

export async function fetchWithAuth(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const user = getAuthUser();
  const headers = new Headers(init?.headers || {});
  if (user) {
    headers.set("X-User-Role", user.role);
    headers.set("X-User-Id", String(user.id));
    if (user.token) {
      headers.set("Authorization", `Bearer ${user.token}`);
    }
  }

  let finalInput = input;
  if (typeof input === "string" && typeof window !== "undefined") {
    finalInput = input.replace(/^https?:\/\/[^/]+:8000/, "/api/py");
  }

  return fetch(finalInput, { ...init, headers });
}

