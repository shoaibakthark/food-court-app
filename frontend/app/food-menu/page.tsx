"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth, fetchWithAuth } from "../lib/auth";
import { SidebarUserCard, OwnerBanner, NavLink, TopbarUserBadge, AppSidebar, MobileMenuButton } from "../components/AuthBar";

// ============================================================
// TYPES
// ============================================================

type Session = {
  id: number;
  name: string;
  price: number | null;
};

type FoodItem = {
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
// FOOD MENU PAGE
// ============================================================

export default function FoodMenuPage() {
  const { user, isOwner, isManager, loading: authLoading } = useAuth();
  const pathname = usePathname();

  // ==========================================================
  // MOBILE MENU
  // ==========================================================

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // ==========================================================
  // SESSION STATE
  // ==========================================================

  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSession, setSelectedSession] = useState<number | null>(
    null
  );

  // ==========================================================
  // FOOD ITEM STATE
  // ==========================================================

  const [foodItems, setFoodItems] = useState<FoodItem[]>([]);

  // ==========================================================
  // LOADING / ERROR
  // ==========================================================

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // ==========================================================
  // SEARCH
  // ==========================================================

  const [search, setSearch] = useState("");

  // ==========================================================
  // FOOD ITEM MODAL
  // ==========================================================

  const [showFoodModal, setShowFoodModal] = useState(false);

  const [editingFood, setEditingFood] =
    useState<FoodItem | null>(null);

  const [foodName, setFoodName] = useState("");
  const [foodPrice, setFoodPrice] = useState("");
  const [foodSessionId, setFoodSessionId] =
    useState<number | "">("");

  const [savingFood, setSavingFood] = useState(false);
  const [foodFormError, setFoodFormError] = useState("");

  // ==========================================================
  // SESSION MODAL
  // ==========================================================

  const [showSessionModal, setShowSessionModal] =
    useState(false);

  const [editingSession, setEditingSession] =
    useState<Session | null>(null);

  const [sessionName, setSessionName] = useState("");
  const [sessionPrice, setSessionPrice] = useState("");

  const [savingSession, setSavingSession] =
    useState(false);

  const [sessionFormError, setSessionFormError] =
    useState("");

  // ==========================================================
  // BODY SCROLL LOCK
  // ==========================================================

  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileMenuOpen]);

  // ==========================================================
  // LOAD SESSIONS
  // ==========================================================

  async function loadSessions() {
    try {
      const response = await fetch(
        `${API_URL}/sessions`
      );

      if (!response.ok) {
        throw new Error("Failed to load menu categories");
      }

      const data: Session[] =
        await response.json();

      setSessions(data);

      if (
        data.length > 0 &&
        selectedSession === null
      ) {
        setSelectedSession(data[0].id);
      }
    } catch (err) {
      console.error(
        "Session loading error:",
        err
      );

      setError(
        "Unable to load menu categories."
      );
    }
  }

  // ==========================================================
  // LOAD FOOD ITEMS
  // ==========================================================

  async function loadFoodItems() {
    try {
      const response = await fetch(
        `${API_URL}/food-items`
      );

      if (!response.ok) {
        throw new Error(
          "Failed to load food items"
        );
      }

      const data: FoodItem[] =
        await response.json();

      setFoodItems(data);
    } catch (err) {
      console.error(
        "Food item loading error:",
        err
      );

      setError(
        "Unable to load food items. Please make sure FastAPI is running."
      );
    }
  }

  // ==========================================================
  // LOAD DATA
  // ==========================================================

  async function loadMenu() {
    try {
      setLoading(true);
      setError("");

      await Promise.all([
        loadSessions(),
        loadFoodItems(),
      ]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (user) {
      loadMenu();
    }
  }, [user]);

  // ==========================================================
  // SELECTED SESSION
  // ==========================================================

  const currentSession = useMemo(() => {
    return sessions.find(
      (session) =>
        session.id === selectedSession
    );
  }, [sessions, selectedSession]);

  // ==========================================================
  // FILTER FOOD ITEMS
  // ==========================================================

  const filteredFoodItems = useMemo(() => {
    const searchText =
      search.toLowerCase().trim();

    return foodItems.filter((item) => {
      const matchesSession =
        selectedSession === null ||
        item.session_id === selectedSession;

      const matchesSearch =
        !searchText ||
        item.name
          .toLowerCase()
          .includes(searchText);

      return (
        matchesSession &&
        matchesSearch
      );
    });
  }, [
    foodItems,
    selectedSession,
    search,
  ]);

  // ==========================================================
  // SESSION FOOD COUNT
  // ==========================================================

  function getSessionFoodCount(
    sessionId: number
  ) {
    return foodItems.filter(
      (item) =>
        item.session_id === sessionId
    ).length;
  }

  // ==========================================================
  // FORMAT MONEY
  // ==========================================================

  function formatMoney(
    amount: number | null
  ) {
    return Number(
      amount ?? 0
    ).toLocaleString("en-IN");
  }

  // ==========================================================
  // TOTAL FOOD ITEMS
  // ==========================================================

  const totalFoodItems =
    foodItems.length;

  // ==========================================================
  // TOTAL CATEGORIES
  // ==========================================================

  const totalCategories =
    sessions.length;

  // ==========================================================
  // AVERAGE PRICE
  // ==========================================================

  const averagePrice =
    foodItems.length > 0
      ? foodItems.reduce(
          (total, item) =>
            total +
            Number(item.price || 0),
          0
        ) / foodItems.length
      : 0;

  // ==========================================================
  // OPEN ADD FOOD
  // ==========================================================

  function openAddFood() {
    setEditingFood(null);

    setFoodName("");
    setFoodPrice("");

    setFoodSessionId(
      selectedSession ??
        (sessions.length > 0
          ? sessions[0].id
          : "")
    );

    setFoodFormError("");

    setShowFoodModal(true);
  }

  // ==========================================================
  // OPEN EDIT FOOD
  // ==========================================================

  function openEditFood(
    item: FoodItem
  ) {
    setEditingFood(item);

    setFoodName(item.name);

    setFoodPrice(
      String(item.price)
    );

    setFoodSessionId(
      item.session_id
    );

    setFoodFormError("");

    setShowFoodModal(true);
  }

  // ==========================================================
  // CLOSE FOOD MODAL
  // ==========================================================

  function closeFoodModal() {
    if (savingFood) return;

    setShowFoodModal(false);

    setEditingFood(null);

    setFoodName("");
    setFoodPrice("");
    setFoodSessionId("");

    setFoodFormError("");
  }

  // ==========================================================
  // SAVE FOOD
  // ==========================================================

  async function saveFood() {
    if (!foodName.trim()) {
      setFoodFormError(
        "Food item name is required."
      );
      return;
    }

    if (
      foodPrice === "" ||
      Number(foodPrice) < 0
    ) {
      setFoodFormError(
        "Please enter a valid price."
      );
      return;
    }

    if (foodSessionId === "") {
      setFoodFormError(
        "Please select a category."
      );
      return;
    }

    try {
      setSavingFood(true);
      setFoodFormError("");

      const isEditing =
        editingFood !== null;

      const url = isEditing
        ? `${API_URL}/food-items/${editingFood.id}`
        : `${API_URL}/food-items`;

      const response = await fetchWithAuth(
        url,
        {
          method: isEditing
            ? "PUT"
            : "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            name: foodName.trim(),
            price: Number(foodPrice),
            session_id:
              Number(foodSessionId),
          }),
        }
      );

      const result =
        await response
          .json()
          .catch(() => null);

      if (!response.ok) {
  console.error("FOOD ITEM SAVE ERROR");
  console.error("Status:", response.status);
  console.error("Response:", result);

  throw new Error(
    result?.detail ||
      `Failed to save food item (${response.status})`
  );
}

      if (isEditing) {
        setFoodItems(
          (current) =>
            current.map(
              (item) =>
                item.id === result.id
                  ? result
                  : item
            )
        );
      } else {
        setFoodItems(
          (current) => [
            result,
            ...current,
          ]
        );
      }

      closeFoodModal();
    } catch (err) {
      console.error(
        "Save food error:",
        err
      );

      setFoodFormError(
        err instanceof Error
          ? err.message
          : "Unable to save food item."
      );
    } finally {
      setSavingFood(false);
    }
  }

  // ==========================================================
  // DELETE FOOD
  // ==========================================================

  async function deleteFood(
    item: FoodItem
  ) {
    const confirmed =
      window.confirm(
        `Delete "${item.name}"?`
      );

    if (!confirmed) return;

    try {
      const response =
        await fetchWithAuth(
          `${API_URL}/food-items/${item.id}`,
          {
            method: "DELETE",
          }
        );

      const result =
        await response
          .json()
          .catch(() => null);

      if (!response.ok) {
        throw new Error(
          result?.detail ||
            "Failed to delete food item"
        );
      }

      setFoodItems(
        (current) =>
          current.filter(
            (food) =>
              food.id !== item.id
          )
      );
    } catch (err) {
      console.error(
        "Delete food error:",
        err
      );

      alert(
        err instanceof Error
          ? err.message
          : "Unable to delete food item."
      );
    }
  }

  // ==========================================================
  // OPEN ADD SESSION
  // ==========================================================

  function openAddSession() {
    setEditingSession(null);

    setSessionName("");
    setSessionPrice("");

    setSessionFormError("");

    setShowSessionModal(true);
  }

  // ==========================================================
  // OPEN EDIT SESSION
  // ==========================================================

  function openEditSession(
    session: Session
  ) {
    setEditingSession(session);

    setSessionName(
      session.name
    );

    setSessionPrice(
      session.price !== null
        ? String(session.price)
        : ""
    );

    setSessionFormError("");

    setShowSessionModal(true);
  }

  // ==========================================================
  // CLOSE SESSION MODAL
  // ==========================================================

  function closeSessionModal() {
    if (savingSession) return;

    setShowSessionModal(false);

    setEditingSession(null);

    setSessionName("");
    setSessionPrice("");

    setSessionFormError("");
  }

  // ==========================================================
  // SAVE SESSION
  // ==========================================================

  async function saveSession() {
    if (!sessionName.trim()) {
      setSessionFormError(
        "Category name is required."
      );
      return;
    }

    try {
      setSavingSession(true);
      setSessionFormError("");

      const isEditing =
        editingSession !== null;

      const url = isEditing
        ? `${API_URL}/sessions/${editingSession.id}`
        : `${API_URL}/sessions`;

      const response =
        await fetchWithAuth(
          url,
          {
            method: isEditing
              ? "PUT"
              : "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              name:
                sessionName.trim(),

              price:
                sessionPrice === ""
                  ? null
                  : Number(
                      sessionPrice
                    ),
            }),
          }
        );

      const result =
        await response
          .json()
          .catch(() => null);

      if (!response.ok) {
        throw new Error(
          result?.detail ||
            "Failed to save category"
        );
      }

      if (isEditing) {
        setSessions(
          (current) =>
            current.map(
              (session) =>
                session.id ===
                result.id
                  ? result
                  : session
            )
        );
      } else {
        setSessions(
          (current) => [
            ...current,
            result,
          ]
        );

        setSelectedSession(
          result.id
        );
      }

      closeSessionModal();
    } catch (err) {
      console.error(
        "Save session error:",
        err
      );

      setSessionFormError(
        err instanceof Error
          ? err.message
          : "Unable to save category."
      );
    } finally {
      setSavingSession(false);
    }
  }

  // ==========================================================
  // DELETE SESSION
  // ==========================================================

  async function deleteSession(
    session: Session
  ) {
    const itemCount =
      getSessionFoodCount(
        session.id
      );

    if (itemCount > 0) {
      alert(
        `Cannot delete "${session.name}" because it contains ${itemCount} food item${
          itemCount === 1
            ? ""
            : "s"
        }. Delete or move the food items first.`
      );

      return;
    }

    const confirmed =
      window.confirm(
        `Delete category "${session.name}"?`
      );

    if (!confirmed) return;

    try {
      const response =
        await fetchWithAuth(
          `${API_URL}/sessions/${session.id}`,
          {
            method: "DELETE",
          }
        );

      const result =
        await response
          .json()
          .catch(() => null);

      if (!response.ok) {
        throw new Error(
          result?.detail ||
            "Failed to delete category"
        );
      }

      setSessions(
        (current) =>
          current.filter(
            (item) =>
              item.id !== session.id
          )
      );

      if (
        selectedSession ===
        session.id
      ) {
        setSelectedSession(
          null
        );
      }
    } catch (err) {
      console.error(
        "Delete session error:",
        err
      );

      alert(
        err instanceof Error
          ? err.message
          : "Unable to delete category."
      );
    }
  }

  // ==========================================================
  // NAVIGATION HELPER
  // ==========================================================

  function navClass(
    path: string
  ) {
    return `nav-item ${
      pathname === path
        ? "active"
        : ""
    }`;
  }

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
      <AppSidebar activeRoute="/food-menu" />

      {/* ====================================================
          MAIN CONTENT
      ==================================================== */}

      <section className="main-content">

        {/* TOPBAR */}

        <header className="topbar">
          <MobileMenuButton />

          <div className="search-box">

            <span>
              ⌕
            </span>

            <input
              type="text"
              placeholder="Search food items..."
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

        {/* PAGE CONTENT */}

        <div className="page-content">
          <OwnerBanner />

          {/* PAGE HEADER */}

          <section className="page-heading">

            <div>

              <span className="eyebrow">
                FOOD MANAGEMENT
              </span>

              <h1>
                Food Menu
              </h1>

              <p>
                Manage your food categories,
                items and prices.
              </p>

            </div>

            {!isOwner && (
              <button
                type="button"
                className="primary-button"
                onClick={
                  openAddFood
                }
                disabled={
                  sessions.length === 0
                }
              >
                <span>
                  ＋
                </span>

                Add Food Item
              </button>
            )}

          </section>

          {/* ERROR */}

          {error && (
            <div
              style={{
                background:
                  "#fff1f2",
                color:
                  "#b42318",
                padding:
                  "14px 18px",
                borderRadius:
                  "10px",
                marginBottom:
                  "20px",
              }}
            >
              {error}
            </div>
          )}

          {/* SUMMARY */}

          <section className="summary-grid">

            <div className="summary-card">

              <div className="summary-top">

                <div className="summary-icon purple">
                  ◈
                </div>

                <span className="trend positive">
                  Live
                </span>

              </div>

              <span className="summary-label">
                Food Items
              </span>

              <strong className="summary-value">
                {totalFoodItems}
              </strong>

              <span className="summary-note">
                Items in menu
              </span>

            </div>

            <div className="summary-card">

              <div className="summary-top">

                <div className="summary-icon gold">
                  ▦
                </div>

                <span className="trend neutral">
                  Categories
                </span>

              </div>

              <span className="summary-label">
                Menu Categories
              </span>

              <strong className="summary-value">
                {totalCategories}
              </strong>

              <span className="summary-note">
                Food sessions
              </span>

            </div>

            <div className="summary-card">

              <div className="summary-top">

                <div className="summary-icon green">
                  ₹
                </div>

                <span className="trend neutral">
                  Average
                </span>

              </div>

              <span className="summary-label">
                Average Price
              </span>

              <strong className="summary-value">
                ₹
                {formatMoney(
                  averagePrice
                )}
              </strong>

              <span className="summary-note">
                Across food items
              </span>

            </div>

          </section>

          {/* =================================================
              CATEGORY SECTION
          ================================================= */}

          <section className="dashboard-panel">

            <div className="panel-heading">

              <div>

                <h2>
                  Menu Categories
                </h2>

                <p>
                  Select a category to
                  manage its food items.
                </p>

              </div>

              {!isOwner && (
                <button
                  type="button"
                  className="secondary-button"
                  onClick={
                    openAddSession
                  }
                >
                  ＋ Category
                </button>
              )}

            </div>

            {/* CATEGORY LIST */}

            <div className="food-category-grid">

              {loading &&
                sessions.length ===
                  0 && (
                  <div className="food-loading">
                    Loading categories...
                  </div>
                )}

              {!loading &&
                sessions.length ===
                  0 && (
                  <div className="food-empty">
                    No menu categories found.
                  </div>
                )}

              {sessions.map(
                (session) => {

                  const active =
                    selectedSession ===
                    session.id;

                  const count =
                    getSessionFoodCount(
                      session.id
                    );

                  return (
                    <div
                      key={
                        session.id
                      }
                      className={`food-category-card ${
                        active
                          ? "active"
                          : ""
                      }`}
                    >

                      <button
                        type="button"
                        className="category-main-button"
                        onClick={() =>
                          setSelectedSession(
                            session.id
                          )
                        }
                      >

                        <div className="category-icon">
                          ◈
                        </div>

                        <div className="category-info">

                          <strong>
                            {session.name}
                          </strong>

                          <span>
                            {count} item
                            {count !== 1
                              ? "s"
                              : ""}
                          </span>

                        </div>

                      </button>

                      {!isOwner && (
                        <div className="category-actions">

                          <button
                            type="button"
                            onClick={() =>
                              openEditSession(
                                session
                              )
                            }
                            title="Edit category"
                          >
                            ✎
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              deleteSession(
                                session
                              )
                            }
                            title="Delete category"
                          >
                            ×
                          </button>

                        </div>
                      )}

                    </div>
                  );
                }
              )}

            </div>

          </section>

          {/* =================================================
              FOOD ITEMS
          ================================================= */}

          <section className="dashboard-panel">

            <div className="panel-heading">

              <div>

                <h2>
                  {currentSession
                    ? currentSession.name
                    : "Food Items"}
                </h2>

                <p>
                  {currentSession
                    ? `Manage food items in ${currentSession.name}.`
                    : "Select a category to view food items."}
                </p>

              </div>

              <span
                style={{
                  color: "#777",
                  fontSize:
                    "14px",
                }}
              >
                {
                  filteredFoodItems.length
                }{" "}
                item
                {filteredFoodItems.length !==
                1
                  ? "s"
                  : ""}
              </span>

            </div>

            {/* SEARCH */}

            <div
              className="food-search-row"
            >

              <div className="food-search">

                <span>
                  ⌕
                </span>

                <input
                  type="text"
                  placeholder="Search food item..."
                  value={
                    search
                  }
                  onChange={(
                    e
                  ) =>
                    setSearch(
                      e.target
                        .value
                    )
                  }
                />

              </div>

            </div>

            {/* TABLE */}

            <div className="events-table-wrapper">

              <table className="events-table food-table">

                <thead>

                  <tr>

                    <th>
                      FOOD ITEM
                    </th>

                    <th>
                      CATEGORY
                    </th>

                    <th>
                      PRICE
                    </th>

                    <th>
                      ACTION
                    </th>

                  </tr>

                </thead>

                <tbody>

                  {loading && (
                    <tr>

                      <td
                        colSpan={4}
                        style={{
                          textAlign:
                            "center",
                          padding:
                            "40px",
                        }}
                      >
                        Loading food items...
                      </td>

                    </tr>
                  )}

                  {!loading &&
                    filteredFoodItems.length ===
                      0 && (
                      <tr>

                        <td
                          colSpan={4}
                          style={{
                            textAlign:
                              "center",
                            padding:
                              "50px",
                          }}
                        >

                          <div
                            style={{
                              fontSize:
                                "32px",
                              marginBottom:
                                "10px",
                            }}
                          >
                            ◈
                          </div>

                          <strong>
                            No food items found
                          </strong>

                          <p
                            style={{
                              color:
                                "#888",
                              marginTop:
                                "6px",
                            }}
                          >
                            Add a food item
                            to this
                            category.
                          </p>

                        </td>

                      </tr>
                    )}

                  {!loading &&
                    filteredFoodItems.map(
                      (item) => {

                        const itemSession =
                          sessions.find(
                            (
                              session
                            ) =>
                              session.id ===
                              item.session_id
                          );

                        return (
                          <tr
                            key={
                              item.id
                            }
                          >

                            <td>

                              <div className="event-name">

                                <div className="event-symbol purple">
                                  {item.name
                                    .charAt(
                                      0
                                    )
                                    .toUpperCase()}
                                </div>

                                <div>

                                  <strong>
                                    {
                                      item.name
                                    }
                                  </strong>

                                  <small>
                                    Food Item #
                                    {
                                      item.id
                                    }
                                  </small>

                                </div>

                              </div>

                            </td>

                            <td>
                              {itemSession
                                ?.name ||
                                "-"}
                            </td>

                            <td>

                              <strong
                                style={{
                                  color:
                                    "#1e0836",
                                }}
                              >
                                ₹
                                {formatMoney(
                                  item.price
                                )}
                              </strong>

                            </td>

                            <td>

                              <div className="food-actions">
                                {isOwner ? (
                                  <span style={{ fontSize: "12px", color: "#8a7b9b" }}>Read-only</span>
                                ) : (
                                  <>
                                    <button
                                      type="button"
                                      className="edit-button"
                                      onClick={() =>
                                        openEditFood(
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
                                        deleteFood(
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
                        );
                      }
                    )}

                </tbody>

              </table>

            </div>

          </section>

        </div>

      </section>

      {/* ====================================================
          ADD / EDIT FOOD MODAL
      ==================================================== */}

      {showFoodModal && (
        <div
          className="modal-overlay"
        >

          <div className="customer-modal">

            <div className="modal-header">

              <div>

                <h2>
                  {editingFood
                    ? "Edit Food Item"
                    : "Add Food Item"}
                </h2>

                <p>
                  {editingFood
                    ? `Food Item #${editingFood.id}`
                    : "Create a new food item"}
                </p>

              </div>

              <button
                type="button"
                className="modal-close"
                onClick={
                  closeFoodModal
                }
                disabled={
                  savingFood
                }
              >
                ×
              </button>

            </div>

            {foodFormError && (
              <div className="form-error">
                {foodFormError}
              </div>
            )}

            {/* FOOD NAME */}

            <div className="form-group">

              <label>
                Food Item Name
              </label>

              <input
                type="text"
                value={
                  foodName
                }
                onChange={(e) =>
                  setFoodName(
                    e.target.value
                  )
                }
                placeholder="Example: Chicken Biriyani"
                autoFocus
              />

            </div>

            {/* CATEGORY */}

            <div className="form-group">

              <label>
                Category
              </label>

              <select
                value={
                  foodSessionId
                }
                onChange={(e) =>
                  setFoodSessionId(
                    e.target.value
                      ? Number(
                          e.target
                            .value
                        )
                      : ""
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
                      {
                        session.name
                      }
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

              <div className="price-input">

                <span>
                  ₹
                </span>

                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={
                    foodPrice
                  }
                  onChange={(e) =>
                    setFoodPrice(
                      e.target
                        .value
                    )
                  }
                  placeholder="0"
                />

              </div>

            </div>

            {/* BUTTONS */}

            <div className="modal-actions">

              <button
                type="button"
                className="cancel-button"
                onClick={
                  closeFoodModal
                }
                disabled={
                  savingFood
                }
              >
                Cancel
              </button>

              <button
                type="button"
                className="save-button"
                onClick={
                  saveFood
                }
                disabled={
                  savingFood
                }
              >
                {savingFood
                  ? "Saving..."
                  : editingFood
                    ? "Save Changes"
                    : "Add Food Item"}
              </button>

            </div>

          </div>

        </div>
      )}

      {/* ====================================================
          ADD / EDIT CATEGORY MODAL
      ==================================================== */}

      {showSessionModal && (
        <div
          className="modal-overlay"
        >

          <div className="customer-modal">

            <div className="modal-header">

              <div>

                <h2>
                  {editingSession
                    ? "Edit Category"
                    : "Add Category"}
                </h2>

                <p>
                  {editingSession
                    ? `Category #${editingSession.id}`
                    : "Create a new menu category"}
                </p>

              </div>

              <button
                type="button"
                className="modal-close"
                onClick={
                  closeSessionModal
                }
                disabled={
                  savingSession
                }
              >
                ×
              </button>

            </div>

            {sessionFormError && (
              <div className="form-error">
                {sessionFormError}
              </div>
            )}

            {/* CATEGORY NAME */}

            <div className="form-group">

              <label>
                Category Name
              </label>

              <input
                type="text"
                value={
                  sessionName
                }
                onChange={(e) =>
                  setSessionName(
                    e.target.value
                  )
                }
                placeholder="Example: Starters"
                autoFocus
              />

            </div>

            {/* DEFAULT PRICE */}

            <div className="form-group">

              <label>
                Default Price
                <span
                  style={{
                    color:
                      "#999",
                    fontWeight:
                      400,
                    marginLeft:
                      "6px",
                  }}
                >
                  Optional
                </span>
              </label>

              <div className="price-input">

                <span>
                  ₹
                </span>

                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={
                    sessionPrice
                  }
                  onChange={(e) =>
                    setSessionPrice(
                      e.target
                        .value
                    )
                  }
                  placeholder="0"
                />

              </div>

            </div>

            {/* BUTTONS */}

            <div className="modal-actions">

              <button
                type="button"
                className="cancel-button"
                onClick={
                  closeSessionModal
                }
                disabled={
                  savingSession
                }
              >
                Cancel
              </button>

              <button
                type="button"
                className="save-button"
                onClick={
                  saveSession
                }
                disabled={
                  savingSession
                }
              >
                {savingSession
                  ? "Saving..."
                  : editingSession
                    ? "Save Changes"
                    : "Add Category"}
              </button>

            </div>

          </div>

        </div>
      )}

    </main>
  );
}