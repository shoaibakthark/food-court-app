"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth, fetchWithAuth } from "../lib/auth";
import { SidebarUserCard, OwnerBanner, NavLink, TopbarUserBadge, AppSidebar, MobileMenuButton } from "../components/AuthBar";

// ============================================================
// TYPES
// ============================================================

type Customer = {
  id: number;
  name: string;
  mobile: string;
};

// ============================================================
// API
// ============================================================

const API_URL = typeof window !== "undefined" ? "/api/py" : "http://127.0.0.1:8000";

// ============================================================
// CUSTOMERS PAGE
// ============================================================

export default function CustomersPage() {
  const { user, isOwner, isManager, loading: authLoading } = useAuth();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // ==========================================================
  // CUSTOMER STATE
  // ==========================================================

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // ==========================================================
  // SEARCH
  // ==========================================================

  const [search, setSearch] = useState("");

  // ==========================================================
  // ADD / EDIT MODAL
  // ==========================================================

  const [showModal, setShowModal] = useState(false);
  const [editingCustomer, setEditingCustomer] =
    useState<Customer | null>(null);

  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");

  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  // ==========================================================
  // LOAD CUSTOMERS
  // ==========================================================

  async function loadCustomers() {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(`${API_URL}/customers`);

      if (!response.ok) {
        throw new Error("Failed to load customers");
      }

      const data: Customer[] = await response.json();

      setCustomers(data);
    } catch (error) {
      console.error("Customer loading error:", error);

      setError(
        "Unable to load customers. Please make sure the FastAPI server is running."
      );
    } finally {
      setLoading(false);
    }
  }

  // ==========================================================
  // LOAD ON PAGE OPEN
  // ==========================================================

  useEffect(() => {
    if (user) {
      loadCustomers();
    }
  }, [user]);

  // ==========================================================
  // FILTER CUSTOMERS
  // ==========================================================

  const filteredCustomers = useMemo(() => {
    const searchText = search.toLowerCase().trim();

    if (!searchText) {
      return customers;
    }

    return customers.filter((customer) => {
      return (
        customer.name.toLowerCase().includes(searchText) ||
        customer.mobile.toLowerCase().includes(searchText) ||
        String(customer.id).includes(searchText)
      );
    });
  }, [customers, search]);

  // ==========================================================
  // OPEN ADD CUSTOMER
  // ==========================================================

  function openAddCustomer() {
    setEditingCustomer(null);
    setName("");
    setMobile("");
    setFormError("");
    setShowModal(true);
  }

  // ==========================================================
  // OPEN EDIT CUSTOMER
  // ==========================================================

  function openEditCustomer(customer: Customer) {
    setEditingCustomer(customer);
    setName(customer.name);
    setMobile(customer.mobile);
    setFormError("");
    setShowModal(true);
  }

  // ==========================================================
  // CLOSE MODAL
  // ==========================================================

  function closeModal() {
    if (saving) return;

    setShowModal(false);
    setEditingCustomer(null);
    setName("");
    setMobile("");
    setFormError("");
  }

  // ==========================================================
  // SAVE CUSTOMER
  // ==========================================================

  async function saveCustomer() {
    if (!name.trim()) {
      setFormError("Customer name is required.");
      return;
    }

    if (!mobile.trim()) {
      setFormError("Mobile number is required.");
      return;
    }

    try {
      setSaving(true);
      setFormError("");

      const isEditing = editingCustomer !== null;

      const url = isEditing
        ? `${API_URL}/customers/${editingCustomer.id}`
        : `${API_URL}/customers`;

      const response = await fetchWithAuth(url, {
        method: isEditing ? "PUT" : "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          name: name.trim(),
          mobile: mobile.trim(),
        }),
      });

      const result = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          result?.detail || "Failed to save customer"
        );
      }

      if (isEditing) {
        setCustomers((currentCustomers) =>
          currentCustomers.map((customer) =>
            customer.id === result.id ? result : customer
          )
        );
      } else {
        setCustomers((currentCustomers) => [
          result,
          ...currentCustomers,
        ]);
      }

      closeModal();
    } catch (error) {
      console.error("Customer save error:", error);

      setFormError(
        error instanceof Error
          ? error.message
          : "Unable to save customer."
      );
    } finally {
      setSaving(false);
    }
  }

  // ==========================================================
  // DELETE CUSTOMER
  // ==========================================================

  async function deleteCustomer(customer: Customer) {
    const confirmed = window.confirm(
      `Delete customer "${customer.name}"?`
    );

    if (!confirmed) {
      return;
    }

    try {
      const response = await fetchWithAuth(
        `${API_URL}/customers/${customer.id}`,
        {
          method: "DELETE",
        }
      );

      const result = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          result?.detail || "Failed to delete customer"
        );
      }

      setCustomers((currentCustomers) =>
        currentCustomers.filter(
          (item) => item.id !== customer.id
        )
      );
    } catch (error) {
      console.error("Delete customer error:", error);

      alert(
        error instanceof Error
          ? error.message
          : "Unable to delete customer."
      );
    }
  }

  // ==========================================================
  // NAVIGATION ITEM
  // ==========================================================

  const navClass = (path: string) =>
    pathname === path ? "nav-item active" : "nav-item";

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

  // ==========================================================
  // RETURN
  // ==========================================================

  return (
    <main className="dashboard">
      <AppSidebar activeRoute="/customers" />

      {/* ======================================================
          MAIN CONTENT
      ====================================================== */}

      <section className="main-content">

        {/* TOPBAR */}

        <header className="topbar">
          <MobileMenuButton />

          <div className="search-box">
            <span>⌕</span>

            <input
              type="text"
              placeholder="Search customers..."
              value={search}
              onChange={(e) =>
                setSearch(e.target.value)
              }
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

        {/* PAGE */}

        <div className="page-content">
          <OwnerBanner />

          {/* PAGE HEADER */}

          <section className="page-heading">

            <div>
              <span className="eyebrow">
                CUSTOMER MANAGEMENT
              </span>

              <h1>Customers</h1>

              <p>
                Manage your Food Court customers.
              </p>
            </div>

            {!isOwner && (
              <button
                type="button"
                className="primary-button"
                onClick={openAddCustomer}
              >
                <span>＋</span>
                Add Customer
              </button>
            )}

          </section>

          {/* ERROR */}

          {error && (
            <div className="page-error">
              {error}
            </div>
          )}

          {/* SUMMARY */}

          <section className="summary-grid">

            <div className="summary-card">

              <div className="summary-top">

                <div className="summary-icon purple">
                  ♙
                </div>

                <span className="trend positive">
                  Live
                </span>

              </div>

              <span className="summary-label">
                Total Customers
              </span>

              <strong className="summary-value">
                {customers.length}
              </strong>

              <span className="summary-note">
                Customers in database
              </span>

            </div>

            <div className="summary-card">

              <div className="summary-top">

                <div className="summary-icon gold">
                  ⌕
                </div>

                <span className="trend neutral">
                  Results
                </span>

              </div>

              <span className="summary-label">
                Search Results
              </span>

              <strong className="summary-value">
                {filteredCustomers.length}
              </strong>

              <span className="summary-note">
                Matching customers
              </span>

            </div>

          </section>

          {/* CUSTOMER PANEL */}

          <section className="dashboard-panel customers-panel">

            <div className="panel-heading">

              <div>
                <h2>All Customers</h2>

                <p>
                  View and manage your customer database.
                </p>
              </div>

              <span className="panel-count">
                {filteredCustomers.length}{" "}
                {filteredCustomers.length === 1
                  ? "customer"
                  : "customers"}
              </span>

            </div>

            {/* SEARCH */}

            <div className="customer-search-row">

              <div className="customer-search">

                <span>⌕</span>

                <input
                  type="text"
                  placeholder="Search by name, mobile or customer ID..."
                  value={search}
                  onChange={(e) =>
                    setSearch(e.target.value)
                  }
                />

              </div>

            </div>

            {/* TABLE */}

            <div className="events-table-wrapper">

              <table className="events-table customers-table">

                <thead>
                  <tr>
                    <th>CUSTOMER</th>
                    <th>MOBILE</th>
                    <th>CUSTOMER ID</th>
                    <th>ACTION</th>
                  </tr>
                </thead>

                <tbody>

                  {/* LOADING */}

                  {loading && (
                    <tr>
                      <td
                        colSpan={4}
                        className="table-message"
                      >
                        Loading customers...
                      </td>
                    </tr>
                  )}

                  {/* EMPTY */}

                  {!loading &&
                    filteredCustomers.length === 0 && (
                      <tr>
                        <td
                          colSpan={4}
                          className="table-message"
                        >
                          <div className="empty-state">

                            <div className="empty-icon">
                              ♙
                            </div>

                            <strong>
                              No customers found
                            </strong>

                            <p>
                              Add your first customer.
                            </p>

                          </div>
                        </td>
                      </tr>
                    )}

                  {/* CUSTOMERS */}

                  {!loading &&
                    filteredCustomers.map((customer) => (

                      <tr key={customer.id}>

                        {/* CUSTOMER */}

                        <td>
                          <div className="event-name">

                            <div className="event-symbol purple">
                              {customer.name
                                .charAt(0)
                                .toUpperCase()}
                            </div>

                            <div>
                              <strong>
                                {customer.name}
                              </strong>

                              <small>
                                Customer
                              </small>
                            </div>

                          </div>
                        </td>

                        {/* MOBILE */}

                        <td>
                          <span className="mobile-number">
                            {customer.mobile}
                          </span>
                        </td>

                        {/* ID */}

                        <td>
                          <span className="customer-id">
                            #{customer.id}
                          </span>
                        </td>

                        {/* ACTION */}

                        <td>

                          <div className="customer-actions">
                            {isOwner ? (
                              <span style={{ fontSize: "12px", color: "#8a7b9b" }}>Read-only</span>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  className="edit-button"
                                  onClick={() =>
                                    openEditCustomer(customer)
                                  }
                                >
                                  ✎ Edit
                                </button>

                                <button
                                  type="button"
                                  className="delete-button"
                                  onClick={() =>
                                    deleteCustomer(customer)
                                  }
                                >
                                  × Delete
                                </button>
                              </>
                            )}
                          </div>

                        </td>

                      </tr>

                    ))}

                </tbody>

              </table>

            </div>

          </section>

        </div>

      </section>

      {/* ======================================================
          ADD / EDIT CUSTOMER MODAL
      ====================================================== */}

      {showModal && (

        <div className="modal-overlay">

          <div className="customer-modal">

            {/* HEADER */}

            <div className="modal-header">

              <div>
                <h2>
                  {editingCustomer
                    ? "Edit Customer"
                    : "Add Customer"}
                </h2>

                <p>
                  {editingCustomer
                    ? `Customer #${editingCustomer.id}`
                    : "Create a new customer"}
                </p>
              </div>

              <button
                type="button"
                className="modal-close"
                onClick={closeModal}
                disabled={saving}
              >
                ×
              </button>

            </div>

            {/* FORM ERROR */}

            {formError && (
              <div className="form-error">
                {formError}
              </div>
            )}

            {/* NAME */}

            <div className="form-group">

              <label>
                Customer Name
              </label>

              <input
                type="text"
                value={name}
                onChange={(e) =>
                  setName(e.target.value)
                }
                placeholder="Enter customer name"
                autoFocus
              />

            </div>

            {/* MOBILE */}

            <div className="form-group">

              <label>
                Mobile Number
              </label>

              <input
                type="tel"
                value={mobile}
                onChange={(e) =>
                  setMobile(e.target.value)
                }
                placeholder="Enter mobile number"
              />

            </div>

            {/* BUTTONS */}

            <div className="modal-actions">

              <button
                type="button"
                className="cancel-button"
                onClick={closeModal}
                disabled={saving}
              >
                Cancel
              </button>

              <button
                type="button"
                className="save-button"
                onClick={saveCustomer}
                disabled={saving}
              >
                {saving
                  ? "Saving..."
                  : editingCustomer
                    ? "Save Changes"
                    : "Add Customer"}
              </button>

            </div>

          </div>

        </div>

      )}

    </main>
  );
}