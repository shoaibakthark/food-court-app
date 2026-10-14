"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth, fetchWithAuth } from "../lib/auth";
import { SidebarUserCard, OwnerBanner, NavLink, TopbarUserBadge, AppSidebar, MobileMenuButton } from "../components/AuthBar";

// ============================================================
// TYPES
// ============================================================

type DecorSession = {
  id: number;
  name: string;
  price: number;
};

type DecorItem = {
  id: number;
  name: string;
  price: number;
  session_id: number;
};

// ============================================================
// API
// ============================================================

const API_URL = typeof window !== "undefined" ? "/api/py" : "http://127.0.0.1:8000";

// ============================================================
// DECOR PAGE
// ============================================================

export default function DecorPage() {
  const { user, isOwner, isManager, loading: authLoading } = useAuth();
  const pathname = usePathname();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // ==========================================================
  // DATA
  // ==========================================================

  const [sessions, setSessions] = useState<DecorSession[]>([]);
  const [items, setItems] = useState<DecorItem[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // ==========================================================
  // SEARCH
  // ==========================================================

  const [search, setSearch] = useState("");

  // ==========================================================
  // CATEGORY MODAL
  // ==========================================================

  const [showCategoryModal, setShowCategoryModal] =
    useState(false);

  const [editingCategory, setEditingCategory] =
    useState<DecorSession | null>(null);

  const [categoryName, setCategoryName] = useState("");
  const [categoryPrice, setCategoryPrice] = useState("");

  // ==========================================================
  // ITEM MODAL
  // ==========================================================

  const [showItemModal, setShowItemModal] =
    useState(false);

  const [editingItem, setEditingItem] =
    useState<DecorItem | null>(null);

  const [itemName, setItemName] = useState("");
  const [itemPrice, setItemPrice] = useState("");
  const [itemSessionId, setItemSessionId] = useState("");

  // ==========================================================
  // SAVE STATE
  // ==========================================================

  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  // ==========================================================
  // LOAD DATA
  // ==========================================================

  async function loadDecorData() {
    try {
      setLoading(true);
      setError("");

      const [sessionsResponse, itemsResponse] =
        await Promise.all([
          fetch(`${API_URL}/decor-sessions`),
          fetch(`${API_URL}/decor-items`),
        ]);

      if (!sessionsResponse.ok) {
        throw new Error("Failed to load decoration categories");
      }

      if (!itemsResponse.ok) {
        throw new Error("Failed to load decoration items");
      }

      const sessionsData: DecorSession[] =
        await sessionsResponse.json();

      const itemsData: DecorItem[] =
        await itemsResponse.json();

      setSessions(sessionsData);
      setItems(itemsData);
    } catch (error) {
      console.error("Decor loading error:", error);

      setError(
        "Unable to load decoration data. Please make sure the FastAPI server is running."
      );
    } finally {
      setLoading(false);
    }
  }

  // ==========================================================
  // LOAD PAGE
  // ==========================================================

  useEffect(() => {
    if (user) {
      loadDecorData();
    }
  }, [user]);

  // ==========================================================
  // SEARCH FILTER
  // ==========================================================

  const filteredItems = useMemo(() => {
    const searchText = search.toLowerCase().trim();

    if (!searchText) {
      return items;
    }

    return items.filter((item) => {
      const session = sessions.find(
        (s) => s.id === item.session_id
      );

      return (
        item.name.toLowerCase().includes(searchText) ||
        String(item.id).includes(searchText) ||
        session?.name
          .toLowerCase()
          .includes(searchText)
      );
    });
  }, [items, sessions, search]);

  // ==========================================================
  // GET CATEGORY NAME
  // ==========================================================

  function getCategoryName(sessionId: number) {
    const session = sessions.find(
      (item) => item.id === sessionId
    );

    return session?.name || "Uncategorized";
  }

  // ==========================================================
  // OPEN ADD CATEGORY
  // ==========================================================

  function openAddCategory() {
    setEditingCategory(null);

    setCategoryName("");
    setCategoryPrice("");

    setFormError("");
    setShowCategoryModal(true);
  }

  // ==========================================================
  // OPEN EDIT CATEGORY
  // ==========================================================

  function openEditCategory(category: DecorSession) {
    setEditingCategory(category);

    setCategoryName(category.name);
    setCategoryPrice(String(category.price ?? 0));

    setFormError("");
    setShowCategoryModal(true);
  }

  // ==========================================================
  // CLOSE CATEGORY MODAL
  // ==========================================================

  function closeCategoryModal() {
    if (saving) return;

    setShowCategoryModal(false);
    setEditingCategory(null);

    setCategoryName("");
    setCategoryPrice("");

    setFormError("");
  }

  // ==========================================================
  // SAVE CATEGORY
  // ==========================================================

  async function saveCategory() {
    if (!categoryName.trim()) {
      setFormError(
        "Decoration category name is required."
      );
      return;
    }

    try {
      setSaving(true);
      setFormError("");

      const isEditing =
        editingCategory !== null;

      const url = isEditing
        ? `${API_URL}/decor-sessions/${editingCategory.id}`
        : `${API_URL}/decor-sessions`;

      const response = await fetchWithAuth(url, {
        method: isEditing ? "PUT" : "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          name: categoryName.trim(),
          price: Number(categoryPrice) || 0,
        }),
      });

      const result = await response
        .json()
        .catch(() => null);

      if (!response.ok) {
        throw new Error(
          result?.detail ||
            "Failed to save decoration category"
        );
      }

      if (isEditing) {
        setSessions((current) =>
          current.map((session) =>
            session.id === result.id
              ? result
              : session
          )
        );
      } else {
        setSessions((current) => [
          ...current,
          result,
        ]);
      }

      closeCategoryModal();
    } catch (error) {
      console.error(
        "Save category error:",
        error
      );

      setFormError(
        error instanceof Error
          ? error.message
          : "Unable to save category."
      );
    } finally {
      setSaving(false);
    }
  }

  // ==========================================================
  // DELETE CATEGORY
  // ==========================================================

  async function deleteCategory(
    category: DecorSession
  ) {
    const categoryItems = items.filter(
      (item) =>
        item.session_id === category.id
    );

    if (categoryItems.length > 0) {
      alert(
        `Cannot delete "${category.name}" because it has ${categoryItems.length} item(s). Delete the items first.`
      );

      return;
    }

    const confirmed = window.confirm(
      `Delete decoration category "${category.name}"?`
    );

    if (!confirmed) return;

    try {
      const response = await fetchWithAuth(
        `${API_URL}/decor-sessions/${category.id}`,
        {
          method: "DELETE",
        }
      );

      const result = await response
        .json()
        .catch(() => null);

      if (!response.ok) {
        throw new Error(
          result?.detail ||
            "Failed to delete category"
        );
      }

      setSessions((current) =>
        current.filter(
          (item) => item.id !== category.id
        )
      );
    } catch (error) {
      console.error(
        "Delete category error:",
        error
      );

      alert(
        error instanceof Error
          ? error.message
          : "Unable to delete category."
      );
    }
  }

  // ==========================================================
  // OPEN ADD ITEM
  // ==========================================================

  function openAddItem() {
    setEditingItem(null);

    setItemName("");
    setItemPrice("");

    setItemSessionId(
      sessions.length > 0
        ? String(sessions[0].id)
        : ""
    );

    setFormError("");
    setShowItemModal(true);
  }

  // ==========================================================
  // OPEN EDIT ITEM
  // ==========================================================

  function openEditItem(item: DecorItem) {
    setEditingItem(item);

    setItemName(item.name);
    setItemPrice(String(item.price ?? 0));
    setItemSessionId(String(item.session_id));

    setFormError("");
    setShowItemModal(true);
  }

  // ==========================================================
  // CLOSE ITEM MODAL
  // ==========================================================

  function closeItemModal() {
    if (saving) return;

    setShowItemModal(false);
    setEditingItem(null);

    setItemName("");
    setItemPrice("");
    setItemSessionId("");

    setFormError("");
  }

  // ==========================================================
  // SAVE ITEM
  // ==========================================================

  async function saveItem() {
    if (!itemName.trim()) {
      setFormError(
        "Decoration item name is required."
      );
      return;
    }

    if (!itemSessionId) {
      setFormError(
        "Please select a decoration category."
      );
      return;
    }

    try {
      setSaving(true);
      setFormError("");

      const isEditing =
        editingItem !== null;

      const url = isEditing
        ? `${API_URL}/decor-items/${editingItem.id}`
        : `${API_URL}/decor-items`;

      const response = await fetchWithAuth(url, {
        method: isEditing ? "PUT" : "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          name: itemName.trim(),
          price: Number(itemPrice) || 0,
          session_id: Number(itemSessionId),
        }),
      });

      const result = await response
        .json()
        .catch(() => null);

      if (!response.ok) {
        throw new Error(
          result?.detail ||
            "Failed to save decoration item"
        );
      }

      if (isEditing) {
        setItems((current) =>
          current.map((item) =>
            item.id === result.id
              ? result
              : item
          )
        );
      } else {
        setItems((current) => [
          ...current,
          result,
        ]);
      }

      closeItemModal();
    } catch (error) {
      console.error(
        "Save item error:",
        error
      );

      setFormError(
        error instanceof Error
          ? error.message
          : "Unable to save decoration item."
      );
    } finally {
      setSaving(false);
    }
  }

  // ==========================================================
  // DELETE ITEM
  // ==========================================================

  async function deleteItem(item: DecorItem) {
    const confirmed = window.confirm(
      `Delete decoration item "${item.name}"?`
    );

    if (!confirmed) return;

    try {
      const response = await fetchWithAuth(
        `${API_URL}/decor-items/${item.id}`,
        {
          method: "DELETE",
        }
      );

      const result = await response
        .json()
        .catch(() => null);

      if (!response.ok) {
        throw new Error(
          result?.detail ||
            "Failed to delete decoration item"
        );
      }

      setItems((current) =>
        current.filter(
          (existing) =>
            existing.id !== item.id
        )
      );
    } catch (error) {
      console.error(
        "Delete item error:",
        error
      );

      alert(
        error instanceof Error
          ? error.message
          : "Unable to delete decoration item."
      );
    }
  }

  // ==========================================================
  // NAVIGATION
  // ==========================================================

  const navClass = (path: string) =>
    pathname === path
      ? "nav-item active"
      : "nav-item";

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
      <AppSidebar activeRoute="/decor" />

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
              placeholder="Search decoration..."
              value={search}
              onChange={(e) =>
                setSearch(
                  e.target.value
                )
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

        {/* ====================================================
            PAGE CONTENT
        ==================================================== */}

        <div className="page-content">
          <OwnerBanner />

          {/* PAGE HEADER */}

          <section className="page-heading">

            <div>

              <span className="eyebrow">
                DECORATION MANAGEMENT
              </span>

              <h1>Decor</h1>

              <p>
                Manage decoration categories
                and items for your events.
              </p>

            </div>

            {!isOwner && (
              <div
                style={{
                  display: "flex",
                  gap: "10px",
                  flexWrap: "wrap",
                }}
              >

                <button
                  type="button"
                  className="primary-button"
                  onClick={
                    openAddCategory
                  }
                >
                  <span>＋</span>
                  Add Category
                </button>

                <button
                  type="button"
                  className="primary-button"
                  onClick={
                    openAddItem
                  }
                  disabled={
                    sessions.length === 0
                  }
                >
                  <span>＋</span>
                  Add Decor Item
                </button>

              </div>
            )}

          </section>

          {/* ERROR */}

          {error && (
            <div className="page-error">
              {error}
            </div>
          )}

          {/* ====================================================
              SUMMARY
          ==================================================== */}

          <section className="summary-grid">

            <div className="summary-card">

              <div className="summary-top">

                <div className="summary-icon purple">
                  ✦
                </div>

                <span className="trend positive">
                  Live
                </span>

              </div>

              <span className="summary-label">
                Decor Categories
              </span>

              <strong className="summary-value">
                {sessions.length}
              </strong>

              <span className="summary-note">
                Categories in database
              </span>

            </div>

            <div className="summary-card">

              <div className="summary-top">

                <div className="summary-icon gold">
                  ◈
                </div>

                <span className="trend positive">
                  Live
                </span>

              </div>

              <span className="summary-label">
                Decor Items
              </span>

              <strong className="summary-value">
                {items.length}
              </strong>

              <span className="summary-note">
                Total decoration items
              </span>

            </div>

            <div className="summary-card">

              <div className="summary-top">

                <div className="summary-icon purple">
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
                {filteredItems.length}
              </strong>

              <span className="summary-note">
                Matching decoration items
              </span>

            </div>

          </section>

          {/* ====================================================
              CATEGORIES PANEL
          ==================================================== */}

          <section className="dashboard-panel">

            <div className="panel-heading">

              <div>

                <h2>
                  Decoration Categories
                </h2>

                <p>
                  Organize your decoration
                  items by category.
                </p>

              </div>

              <span className="panel-count">
                {sessions.length}{" "}
                {sessions.length === 1
                  ? "category"
                  : "categories"}
              </span>

            </div>

            <div className="events-table-wrapper">

              <table className="events-table">

                <thead>

                  <tr>
                    <th>CATEGORY</th>
                    <th>BASE PRICE</th>
                    <th>ITEMS</th>
                    <th>ACTION</th>
                  </tr>

                </thead>

                <tbody>

                  {loading && (
                    <tr>

                      <td
                        colSpan={4}
                        className="table-message"
                      >
                        Loading decoration
                        categories...
                      </td>

                    </tr>
                  )}

                  {!loading &&
                    sessions.length === 0 && (
                      <tr>

                        <td
                          colSpan={4}
                          className="table-message"
                        >

                          <div className="empty-state">

                            <div className="empty-icon">
                              ✦
                            </div>

                            <strong>
                              No categories found
                            </strong>

                            <p>
                              Add your first
                              decoration category.
                            </p>

                          </div>

                        </td>

                      </tr>
                    )}

                  {!loading &&
                    sessions.map(
                      (category) => {

                        const categoryItemCount =
                          items.filter(
                            (item) =>
                              item.session_id ===
                              category.id
                          ).length;

                        return (
                          <tr
                            key={
                              category.id
                            }
                          >

                            <td>

                              <div className="event-name">

                                <div className="event-symbol purple">
                                  ✦
                                </div>

                                <div>

                                  <strong>
                                    {
                                      category.name
                                    }
                                  </strong>

                                  <small>
                                    Decoration
                                    category
                                  </small>

                                </div>

                              </div>

                            </td>

                            <td>

                              <span className="mobile-number">
                                ₹
                                {Number(
                                  category.price ||
                                    0
                                ).toLocaleString(
                                  "en-IN"
                                )}
                              </span>

                            </td>

                            <td>

                              <span className="customer-id">
                                {
                                  categoryItemCount
                                }{" "}
                                {categoryItemCount ===
                                1
                                  ? "item"
                                  : "items"}
                              </span>

                            </td>

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
                                        openEditCategory(
                                          category
                                        )
                                      }
                                    >
                                      ✎ Edit
                                    </button>

                                    <button
                                      type="button"
                                      className="delete-button"
                                      onClick={() =>
                                        deleteCategory(
                                          category
                                        )
                                      }
                                    >
                                      × Delete
                                    </button>
                                  </>
                                )}
                              </div>

                            </td>

                          </tr>
                        );
                      }
                    )}

                </tbody>

              </table>

            </div>

          </section>

          {/* ====================================================
              ITEMS PANEL
          ==================================================== */}

          <section className="dashboard-panel">

            <div className="panel-heading">

              <div>

                <h2>
                  Decoration Items
                </h2>

                <p>
                  View and manage all
                  decoration items.
                </p>

              </div>

              <span className="panel-count">
                {filteredItems.length}{" "}
                {filteredItems.length === 1
                  ? "item"
                  : "items"}
              </span>

            </div>

            {/* SEARCH */}

            <div className="customer-search-row">

              <div className="customer-search">

                <span>⌕</span>

                <input
                  type="text"
                  placeholder="Search by item, category or ID..."
                  value={search}
                  onChange={(e) =>
                    setSearch(
                      e.target.value
                    )
                  }
                />

              </div>

            </div>

            {/* TABLE */}

            <div className="events-table-wrapper">

              <table className="events-table">

                <thead>

                  <tr>
                    <th>DECOR ITEM</th>
                    <th>CATEGORY</th>
                    <th>PRICE</th>
                    <th>ACTION</th>
                  </tr>

                </thead>

                <tbody>

                  {loading && (
                    <tr>

                      <td
                        colSpan={4}
                        className="table-message"
                      >
                        Loading decoration
                        items...
                      </td>

                    </tr>
                  )}

                  {!loading &&
                    filteredItems.length ===
                      0 && (
                      <tr>

                        <td
                          colSpan={4}
                          className="table-message"
                        >

                          <div className="empty-state">

                            <div className="empty-icon">
                              ◈
                            </div>

                            <strong>
                              No decoration
                              items found
                            </strong>

                            <p>
                              Add your first
                              decoration item.
                            </p>

                          </div>

                        </td>

                      </tr>
                    )}

                  {!loading &&
                    filteredItems.map(
                      (item) => (

                        <tr
                          key={item.id}
                        >

                          {/* ITEM */}

                          <td>

                            <div className="event-name">

                              <div className="event-symbol gold">
                                {item.name
                                  .charAt(0)
                                  .toUpperCase()}
                              </div>

                              <div>

                                <strong>
                                  {item.name}
                                </strong>

                                <small>
                                  Decor Item
                                </small>

                              </div>

                            </div>

                          </td>

                          {/* CATEGORY */}

                          <td>

                            <span className="status-badge">
                              {
                                getCategoryName(
                                  item.session_id
                                )
                              }
                            </span>

                          </td>

                          {/* PRICE */}

                          <td>

                            <span className="mobile-number">
                              ₹
                              {Number(
                                item.price ||
                                  0
                              ).toLocaleString(
                                "en-IN"
                              )}
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
                                      openEditItem(
                                        item
                                      )
                                    }
                                  >
                                    ✎ Edit
                                  </button>

                                  <button
                                    type="button"
                                    className="delete-button"
                                    onClick={() =>
                                      deleteItem(
                                        item
                                      )
                                    }
                                  >
                                    × Delete
                                  </button>
                                </>
                              )}
                            </div>

                          </td>

                        </tr>

                      )
                    )}

                </tbody>

              </table>

            </div>

          </section>

        </div>

      </section>

      {/* ======================================================
          CATEGORY MODAL
      ====================================================== */}

      {showCategoryModal && (

        <div className="modal-overlay">

          <div className="customer-modal">

            <div className="modal-header">

              <div>

                <h2>
                  {editingCategory
                    ? "Edit Decor Category"
                    : "Add Decor Category"}
                </h2>

                <p>
                  {editingCategory
                    ? `Category #${editingCategory.id}`
                    : "Create a new decoration category"}
                </p>

              </div>

              <button
                type="button"
                className="modal-close"
                onClick={
                  closeCategoryModal
                }
                disabled={saving}
              >
                ×
              </button>

            </div>

            {formError && (
              <div className="form-error">
                {formError}
              </div>
            )}

            <div className="form-group">

              <label>
                Category Name
              </label>

              <input
                type="text"
                value={categoryName}
                onChange={(e) =>
                  setCategoryName(
                    e.target.value
                  )
                }
                placeholder="Example: Stage Decoration"
                autoFocus
              />

            </div>

            <div className="form-group">

              <label>
                Base Price
              </label>

              <input
                type="number"
                min="0"
                value={categoryPrice}
                onChange={(e) =>
                  setCategoryPrice(
                    e.target.value
                  )
                }
                placeholder="0"
              />

            </div>

            <div className="modal-actions">

              <button
                type="button"
                className="cancel-button"
                onClick={
                  closeCategoryModal
                }
                disabled={saving}
              >
                Cancel
              </button>

              <button
                type="button"
                className="save-button"
                onClick={
                  saveCategory
                }
                disabled={saving}
              >
                {saving
                  ? "Saving..."
                  : editingCategory
                    ? "Save Changes"
                    : "Add Category"}
              </button>

            </div>

          </div>

        </div>

      )}

      {/* ======================================================
          ITEM MODAL
      ====================================================== */}

      {showItemModal && (

        <div className="modal-overlay">

          <div className="customer-modal">

            <div className="modal-header">

              <div>

                <h2>
                  {editingItem
                    ? "Edit Decor Item"
                    : "Add Decor Item"}
                </h2>

                <p>
                  {editingItem
                    ? `Item #${editingItem.id}`
                    : "Create a new decoration item"}
                </p>

              </div>

              <button
                type="button"
                className="modal-close"
                onClick={
                  closeItemModal
                }
                disabled={saving}
              >
                ×
              </button>

            </div>

            {formError && (
              <div className="form-error">
                {formError}
              </div>
            )}

            {/* NAME */}

            <div className="form-group">

              <label>
                Decoration Item
              </label>

              <input
                type="text"
                value={itemName}
                onChange={(e) =>
                  setItemName(
                    e.target.value
                  )
                }
                placeholder="Example: Flower Arch"
                autoFocus
              />

            </div>

            {/* CATEGORY */}

            <div className="form-group">

              <label>
                Decoration Category
              </label>

              <select
                value={itemSessionId}
                onChange={(e) =>
                  setItemSessionId(
                    e.target.value
                  )
                }
              >

                <option value="">
                  Select category
                </option>

                {sessions.map(
                  (session) => (
                    <option
                      key={
                        session.id
                      }
                      value={
                        session.id
                      }
                    >
                      {session.name}
                    </option>
                  )
                )}

              </select>

            </div>

            {/* PRICE */}

            <div className="form-group">

              <label>
                Price
              </label>

              <input
                type="number"
                min="0"
                value={itemPrice}
                onChange={(e) =>
                  setItemPrice(
                    e.target.value
                  )
                }
                placeholder="0"
              />

            </div>

            {/* BUTTONS */}

            <div className="modal-actions">

              <button
                type="button"
                className="cancel-button"
                onClick={
                  closeItemModal
                }
                disabled={saving}
              >
                Cancel
              </button>

              <button
                type="button"
                className="save-button"
                onClick={
                  saveItem
                }
                disabled={saving}
              >
                {saving
                  ? "Saving..."
                  : editingItem
                    ? "Save Changes"
                    : "Add Decor Item"}
              </button>

            </div>

          </div>

        </div>

      )}

    </main>
  );
}

