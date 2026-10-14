
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth, fetchWithAuth } from "../lib/auth";
import { SidebarUserCard, OwnerBanner, NavLink, TopbarUserBadge, AppSidebar, MobileMenuButton } from "../components/AuthBar";

const API_URL = typeof window !== "undefined" ? "/api/py" : "http://127.0.0.1:8000";

type Customer = {
  id?: number;
  name?: string | null;
  mobile?: string | null;
};

type EventStatus = "Pending" | "Approved" | "Completed";

type EventData = {
  id: number;
  date: string;
  guest_count: number;
  food_amt: number;
  total_estimate: number;
  place: string;
  customer_id: number;
  customer_name?: string | null;
  customer_mobile?: string | null;
  customer?: Customer | null;
  event_type: string;
  decor_amt: number;
  quote: number | null;
  paid_amount?: number | null;
  balance?: number | null;
  status?: string | null;
};

type EditEventData = {
  date: string;
  event_type: string;
  place: string;
  guest_count: number;
  food_amt: number;
  decor_amt: number;
  total_estimate: number;
  quote: number | null;
  status: EventStatus;
};

const statusOptions: EventStatus[] = [
  "Pending",
  "Approved",
  "Completed",
];

function normalizeStatus(status?: string | null): EventStatus {
  const value = (status || "").trim().toLowerCase();

  if (value === "completed" || value === "complete") {
    return "Completed";
  }

  if (
    value === "approved" ||
    value === "confirmed" ||
    value === "accepted"
  ) {
    return "Approved";
  }

  return "Pending";
}

function customerName(event: EventData): string {
  const name = event.customer?.name || event.customer_name;
  return name?.trim() || `Customer #${event.customer_id}`;
}

function formatMoney(amount: number | null | undefined): string {
  return Number(amount ?? 0).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  });
}

function formatDate(date: string): string {
  if (!date) return "-";

  const parsed = new Date(`${date.slice(0, 10)}T00:00:00`);

  if (Number.isNaN(parsed.getTime())) return date;

  return parsed.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getEventColor(eventType: string): string {
  switch (eventType?.toLowerCase()) {
    case "wedding":
      return "purple";
    case "engagement":
      return "gold";
    case "birthday":
      return "blue";
    case "corporate":
      return "green";
    default:
      return "purple";
  }
}

function getEventSymbol(eventType: string): string {
  return eventType?.charAt(0).toUpperCase() || "E";
}

function getEventStatus(event: EventData): EventStatus {
  if (event.status) {
    return normalizeStatus(event.status);
  }

  if (event.date) {
    const eventDate = new Date(`${event.date.slice(0, 10)}T00:00:00`);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (!Number.isNaN(eventDate.getTime()) && eventDate < today) {
      return "Completed";
    }
  }

  return "Pending";
}

async function getApiErrorMessage(
  response: Response,
  fallback: string
): Promise<string> {
  const data = await response.json().catch(() => null);

  if (Array.isArray(data?.detail)) {
    return data.detail
      .map((item: { loc?: (string | number)[]; msg?: string }) => {
        const field = item.loc
          ?.filter((part) => part !== "body")
          .join(".");

        const message = item.msg || "Invalid value";

        return field ? `${field}: ${message}` : message;
      })
      .join(" | ");
  }

  if (typeof data?.detail === "string") {
    return data.detail;
  }

  if (data?.detail && typeof data.detail === "object") {
    return (
      data.detail.message ||
      data.detail.msg ||
      JSON.stringify(data.detail)
    );
  }

  if (typeof data?.message === "string") {
    return data.message;
  }

  return fallback;
}

export default function EventsPage() {
  const router = useRouter();
  const { user, isOwner, isManager, loading: authLoading } = useAuth();

  const [events, setEvents] = useState<EventData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("All");
  const [filterStatus, setFilterStatus] = useState("All");

  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");

  const loadEvents = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(`${API_URL}/events`, {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(
          await getApiErrorMessage(
            response,
            `Failed to load events (${response.status}).`
          )
        );
      }

      const data: EventData[] = await response.json();
      setEvents(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Events loading error:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load events. Check that the FastAPI server is running."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) {
      void loadEvents();
    }
  }, [user, loadEvents]);

  const eventTypes = useMemo(() => {
    const types = events
      .map((event) => event.event_type)
      .filter((type): type is string => Boolean(type));

    return ["All", ...Array.from(new Set(types))];
  }, [events]);

  const filteredEvents = useMemo(() => {
    const query = search.trim().toLowerCase();

    return events.filter((event) => {
      const name = customerName(event).toLowerCase();

      const mobile = (
        event.customer?.mobile ||
        event.customer_mobile ||
        ""
      ).toLowerCase();

      const matchesSearch =
        !query ||
        (event.event_type || "").toLowerCase().includes(query) ||
        (event.place || "").toLowerCase().includes(query) ||
        String(event.id).includes(query) ||
        String(event.customer_id).includes(query) ||
        name.includes(query) ||
        mobile.includes(query);

      const matchesType =
        filterType === "All" || event.event_type === filterType;

      const matchesStatus =
        filterStatus === "All" ||
        getEventStatus(event) === filterStatus;

      return matchesSearch && matchesType && matchesStatus;
    });
  }, [events, search, filterType, filterStatus]);

  const upcomingEvents = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return events.filter((event) => {
      if (!event.date) return false;

      const date = new Date(`${event.date.slice(0, 10)}T00:00:00`);
      return !Number.isNaN(date.getTime()) && date >= today;
    });
  }, [events]);

  const totalGuests = useMemo(
    () =>
      events.reduce(
        (total, event) => total + Number(event.guest_count || 0),
        0
      ),
    [events]
  );

  const totalQuote = useMemo(
    () =>
      events.reduce(
        (total, event) =>
          total + Number(event.quote ?? event.total_estimate ?? 0),
        0
      ),
    [events]
  );

  const pendingCount = useMemo(
    () =>
      events.filter((event) => getEventStatus(event) === "Pending").length,
    [events]
  );

  const approvedCount = useMemo(
    () =>
      events.filter((event) => getEventStatus(event) === "Approved").length,
    [events]
  );

  const completedCount = useMemo(
    () =>
      events.filter((event) => getEventStatus(event) === "Completed").length,
    [events]
  );

  function openEvent(eventId: number) {
    router.push(`/events/${eventId}`);
  }

  async function handleQuickStatusChange(
    event: EventData,
    nextStatus: EventStatus
  ) {
    try {
      setError("");
      setSuccess("");

      const response = await fetchWithAuth(`${API_URL}/events/${event.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: event.date,
          event_type: event.event_type,
          place: event.place,
          guest_count: event.guest_count,
          food_amt: event.food_amt,
          decor_amt: event.decor_amt,
          total_estimate: event.total_estimate,
          quote: event.quote,
          status: nextStatus,
        }),
      });

      if (!response.ok) {
        throw new Error(
          await getApiErrorMessage(
            response,
            `Could not save status (${response.status}).`
          )
        );
      }

      const result = await response.json();

      setEvents((current) =>
        current.map((item) =>
          item.id === event.id
            ? {
                ...item,
                ...result,
                customer: result.customer ?? item.customer,
                customer_name:
                  result.customer_name ??
                  item.customer_name ??
                  item.customer?.name ??
                  null,
                status: result.status ?? nextStatus,
              }
            : item
        )
      );

      setSuccess(`Event #${event.id} marked ${nextStatus.toLowerCase()}.`);
    } catch (err) {
      console.error("Status update error:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Unable to update event status."
      );
    }
  }

  const inputStyle: CSSProperties = {
    width: "100%",
    boxSizing: "border-box",
    padding: "11px 12px",
    border: "1px solid #e5e0eb",
    borderRadius: "8px",
    background: "#fff",
    fontSize: "14px",
  };

  const labelStyle: CSSProperties = {
    display: "block",
    marginBottom: "7px",
    color: "#4b3c5b",
    fontSize: "13px",
    fontWeight: 600,
  };

  // ==========================================================
  // AUTH GUARD
  // ==========================================================

  if (authLoading || !user) {
    return (
      <main className="dashboard" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "#f8f5fb" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "28px", fontWeight: 800, color: "#1e0836", marginBottom: "8px" }}>Food Court</div>
          <div style={{ fontSize: "14px", color: "#6b5b7e" }}>Checking authentication…</div>
        </div>
      </main>
    );
  }

  return (
    <main className="dashboard">
      <AppSidebar activeRoute="/events" />

      <section className="main-content">
        <header className="topbar">
          <MobileMenuButton />
          <div className="search-box">
            <span>⌕</span>
            <input
              type="text"
              placeholder="Search events..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="top-actions">
            <button
              className="icon-button"
              type="button"
              title="Notifications"
            >
              ♢
            </button>
            <TopbarUserBadge />
          </div>
        </header>

        <div className="page-content">
          <OwnerBanner />

          <section className="page-heading">
            <div>
              <span className="eyebrow">EVENT MANAGEMENT</span>
              <h1>Events</h1>
              <p>Manage all your Food Court events.</p>
            </div>
            {!isOwner && (
              <Link href="/create-event" className="primary-button">
                <span>＋</span>
                Create Event
              </Link>
            )}
          </section>

          {error && (
            <div className="notice error-notice">
              <span>{error}</span>
              <button type="button" onClick={() => setError("")}>
                ×
              </button>
            </div>
          )}

          {success && (
            <div className="notice success-notice">
              <span>{success}</span>
              <button type="button" onClick={() => setSuccess("")}>
                ×
              </button>
            </div>
          )}

          <section className="summary-grid">
            <div className="summary-card">
              <div className="summary-top">
                <div className="summary-icon purple">▣</div>
                <span className="trend positive">Live</span>
              </div>
              <span className="summary-label">Total Events</span>
              <strong className="summary-value">{events.length}</strong>
              <span className="summary-note">Events in database</span>
            </div>

            <div className="summary-card">
              <div className="summary-top">
                <div className="summary-icon gold">◷</div>
                <span className="trend warning">Scheduled</span>
              </div>
              <span className="summary-label">Upcoming Events</span>
              <strong className="summary-value">
                {upcomingEvents.length}
              </strong>
              <span className="summary-note">Today and future events</span>
            </div>

            <div className="summary-card">
              <div className="summary-top">
                <div className="summary-icon blue">♙</div>
                <span className="trend neutral">Guests</span>
              </div>
              <span className="summary-label">Total Guests</span>
              <strong className="summary-value">
                {totalGuests.toLocaleString("en-IN")}
              </strong>
              <span className="summary-note">Across all events</span>
            </div>

            <div className="summary-card">
              <div className="summary-top">
                <div className="summary-icon green">₹</div>
                <span className="trend positive">Quotes</span>
              </div>
              <span className="summary-label">Total Quoted</span>
              <strong className="summary-value">
                ₹{formatMoney(totalQuote)}
              </strong>
              <span className="summary-note">Event quote value</span>
            </div>
          </section>

          <section className="status-summary">
            <button
              type="button"
              className={
                filterStatus === "All"
                  ? "status-filter selected"
                  : "status-filter"
              }
              onClick={() => setFilterStatus("All")}
            >
              <span>All Events</span>
              <strong>{events.length}</strong>
            </button>

            <button
              type="button"
              className={
                filterStatus === "Pending"
                  ? "status-filter selected pending-card"
                  : "status-filter pending-card"
              }
              onClick={() => setFilterStatus("Pending")}
            >
              <span>Pending</span>
              <strong>{pendingCount}</strong>
            </button>

            <button
              type="button"
              className={
                filterStatus === "Approved"
                  ? "status-filter selected approved-card"
                  : "status-filter approved-card"
              }
              onClick={() => setFilterStatus("Approved")}
            >
              <span>Approved</span>
              <strong>{approvedCount}</strong>
            </button>

            <button
              type="button"
              className={
                filterStatus === "Completed"
                  ? "status-filter selected completed-card"
                  : "status-filter completed-card"
              }
              onClick={() => setFilterStatus("Completed")}
            >
              <span>Completed</span>
              <strong>{completedCount}</strong>
            </button>
          </section>

          <section className="dashboard-panel events-panel">
            <div className="panel-heading">
              <div>
                <h2>All Events</h2>
                <p>View and manage your events</p>
              </div>
            </div>

            <div className="filter-bar">
              <input
                type="text"
                placeholder="Search event, venue, customer name or ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />

              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
              >
                {eventTypes.map((type) => (
                  <option key={type} value={type}>
                    {type === "All" ? "All Event Types" : type}
                  </option>
                ))}
              </select>

              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <option value="All">All Statuses</option>
                {statusOptions.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>

              <span className="event-count">
                {filteredEvents.length} event
                {filteredEvents.length !== 1 ? "s" : ""}
              </span>
            </div>

            <div className="events-table-wrapper">
              <table className="events-table">
                <thead>
                  <tr>
                    <th>CUSTOMER</th>
                    <th>DATE</th>
                    <th>VENUE</th>
                    <th>EVENT</th>
                    <th>GUESTS</th>
                    <th>AMOUNT</th>
                    <th>STATUS</th>
                    <th>ACTION</th>
                  </tr>
                </thead>

                <tbody>
                  {loading && (
                    <tr>
                      <td colSpan={8} className="empty-cell">
                        Loading events...
                      </td>
                    </tr>
                  )}

                  {!loading && filteredEvents.length === 0 && (
                    <tr>
                      <td colSpan={8} className="empty-cell">
                        No events found.
                      </td>
                    </tr>
                  )}

                  {!loading &&
                    filteredEvents.map((event) => {
                      const status = getEventStatus(event);
                      const mobile =
                        event.customer?.mobile ||
                        event.customer_mobile ||
                        "";

                      return (
                        <tr
                          key={event.id}
                          onClick={() => openEvent(event.id)}
                          className="event-clickable-row"
                          title={`View event #${event.id}`}
                        >
                          <td>
                            <div className="customer-cell">
                              <strong>{customerName(event)}</strong>
                              {mobile && <small>{mobile}</small>}
                              <small>ID: {event.customer_id}</small>
                            </div>
                          </td>

                          <td>{formatDate(event.date)}</td>

                          <td>{event.place || "-"}</td>

                          <td>
                            <div className="event-name">
                              <div
                                className={`event-symbol ${getEventColor(
                                  event.event_type
                                )}`}
                              >
                                {getEventSymbol(event.event_type)}
                              </div>
                              <div>
                                <strong>{event.event_type || "Event"}</strong>
                                <small>Event #{event.id}</small>
                              </div>
                            </div>
                          </td>

                          <td>
                            {Number(event.guest_count || 0).toLocaleString(
                              "en-IN"
                            )}
                          </td>

                          <td>
                            <strong>
                              ₹
                              {formatMoney(
                                event.quote ?? event.total_estimate ?? 0
                              )}
                            </strong>
                            {Number(event.paid_amount || 0) > 0 && (
                              <small style={{ display: "block", color: "#166534", fontSize: "11px", fontWeight: 600 }}>
                                Paid: ₹{formatMoney(event.paid_amount)}
                              </small>
                            )}
                            {Number(event.balance || 0) > 0 ? (
                              <small style={{ display: "block", color: "#b45309", fontSize: "11px", fontWeight: 600 }}>
                                Due: ₹{formatMoney(event.balance)}
                              </small>
                            ) : Number(event.paid_amount || 0) > 0 ? (
                              <small style={{ display: "block", color: "#15803d", fontSize: "10px", fontWeight: 700 }}>
                                ✓ Fully Paid
                              </small>
                            ) : null}
                          </td>

                          <td>
                            <span
                              className={`status status-${status.toLowerCase()}`}
                            >
                              {status}
                            </span>
                          </td>

                          <td>
                            <button
                              type="button"
                              className="edit-button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openEvent(event.id);
                              }}
                            >
                              {isOwner ? "👁 View" : "✎ Edit"}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </section>

      <style jsx global>{`
        .event-clickable-row {
          cursor: pointer;
          transition: background-color 0.15s ease;
        }

        .event-clickable-row:hover {
          background-color: #f7f2ff;
        }

        .notice {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
          padding: 12px 16px;
          border-radius: 9px;
          margin-bottom: 16px;
          font-size: 13px;
          overflow-wrap: anywhere;
        }

        .notice button {
          flex-shrink: 0;
          border: 0;
          background: transparent;
          cursor: pointer;
          font-size: 18px;
        }

        .error-notice {
          background: #fff1f2;
          color: #b42318;
        }

        .success-notice {
          background: #ecfdf3;
          color: #067647;
        }

        .status-summary {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 16px;
          margin: 20px 0;
        }

        .status-filter {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          border: 1px solid #eee5f5;
          border-radius: 12px;
          background: white;
          color: #6d28d9;
          padding: 17px;
          cursor: pointer;
          text-align: left;
        }

        .status-filter strong {
          font-size: 22px;
        }

        .status-filter.selected {
          outline: 2px solid #7c3aed;
        }

        .pending-card {
          border-left: 4px solid #d69e25;
        }

        .approved-card {
          border-left: 4px solid #24945b;
        }

        .completed-card {
          border-left: 4px solid #5582c8;
        }

        .filter-bar {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 10px;
          margin-bottom: 20px;
        }

        .filter-bar input,
        .filter-bar select {
          min-height: 42px;
          padding: 10px 12px;
          border: 1px solid #e5e0eb;
          border-radius: 8px;
          background: white;
          color: #1e0836;
          font-size: 13px;
        }

        .filter-bar input {
          min-width: 250px;
          flex: 1;
        }

        .event-count {
          margin-left: auto;
          color: #777;
          font-size: 13px;
        }

        .customer-cell strong,
        .customer-cell small {
          display: block;
        }

        .customer-cell small {
          margin-top: 4px;
          color: #999;
          font-size: 11px;
        }

        .status {
          display: inline-block;
          padding: 6px 10px;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 700;
          white-space: nowrap;
        }

        .status-pending {
          color: #925d00;
          background: #fff1cc;
        }

        .status-approved {
          color: #067647;
          background: #dcfce7;
        }

        .status-completed {
          color: #2457a6;
          background: #e4efff;
        }

        .empty-cell {
          text-align: center;
          padding: 40px !important;
          color: #777;
        }

        @media (max-width: 900px) {
          .status-summary {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .events-table-wrapper {
            overflow-x: auto;
          }

          .events-table {
            min-width: 900px;
          }
        }

        @media (max-width: 560px) {
          .status-summary {
            grid-template-columns: 1fr 1fr;
            gap: 8px;
          }

          .status-filter {
            padding: 12px;
            font-size: 12px;
          }

          .status-filter strong {
            font-size: 18px;
          }

          .filter-bar input {
            min-width: 100%;
          }
        }
      `}</style>
    </main>
  );
}