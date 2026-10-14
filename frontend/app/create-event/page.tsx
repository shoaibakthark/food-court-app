"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../lib/auth";

const API_URL = typeof window !== "undefined" ? "/api/py" : "http://127.0.0.1:8000";

type Session = {
  id: number;
  name: string;
  price: number;
};

type FoodItem = {
  id: number;
  name: string;
  price: number;
  session_id: number;
};

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

export default function CreateEventPage() {
  const router = useRouter();
  const { isOwner, isManager } = useAuth();

  useEffect(() => {
    if (isOwner) {
      router.replace("/events");
    }
  }, [isOwner, router]);

  // ============================================================
  // CUSTOMER
  // ============================================================

  const [customerName, setCustomerName] = useState("");
  const [mobile, setMobile] = useState("");

  // ============================================================
  // EVENT
  // ============================================================

  const [eventDate, setEventDate] = useState("");
  const [venue, setVenue] = useState("");
  const [eventType, setEventType] = useState("");
  const [guestCount, setGuestCount] = useState("");

  // ============================================================
  // MENU SESSIONS
  // ============================================================

  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSession, setSelectedSession] = useState("");

  const [menuLoading, setMenuLoading] = useState(false);
  const [menuError, setMenuError] = useState("");

  // ============================================================
  // FOOD ITEMS
  // ============================================================

  const [foodItems, setFoodItems] = useState<FoodItem[]>([]);

  const [selectedFoodItems, setSelectedFoodItems] =
    useState<number[]>([]);

  const [foodQuantities, setFoodQuantities] =
    useState<Record<number, number>>({});

  const [foodLoading, setFoodLoading] = useState(false);
  const [foodError, setFoodError] = useState("");

  // ============================================================
  // DECORATION
  // ============================================================

  const [decorSessions, setDecorSessions] =
    useState<DecorSession[]>([]);

  const [selectedDecorSession, setSelectedDecorSession] =
    useState("");

  const [decorItems, setDecorItems] =
    useState<DecorItem[]>([]);

  const [selectedDecorItems, setSelectedDecorItems] =
    useState<number[]>([]);

  // Decoration quantity for each selected item
  const [decorQuantities, setDecorQuantities] =
    useState<Record<number, number>>({});

  const [decorLoading, setDecorLoading] = useState(false);
  const [decorError, setDecorError] = useState("");

  // ============================================================
  // QUOTE AMOUNT
  // ============================================================

  const [quoteAmount, setQuoteAmount] = useState("");

  // ============================================================
  // FORM
  // ============================================================

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  // ============================================================
  // LOAD MENU SESSIONS
  // ============================================================

  useEffect(() => {
    async function loadSessions() {
      try {
        setMenuLoading(true);
        setMenuError("");

        const response = await fetch(
          `${API_URL}/sessions`
        );

        if (!response.ok) {
          throw new Error("Failed to load sessions");
        }

        const data: Session[] = await response.json();

        setSessions(data);
      } catch (error) {
        console.error("Session loading error:", error);

        setMenuError(
          "Failed to load menu categories. Please check the backend."
        );
      } finally {
        setMenuLoading(false);
      }
    }

    loadSessions();
  }, []);

  // ============================================================
  // LOAD FOOD ITEMS
  // ============================================================

  useEffect(() => {
    async function loadFoodItems() {
      try {
        setFoodLoading(true);
        setFoodError("");

        const response = await fetch(
          `${API_URL}/food-items`
        );

        if (!response.ok) {
          throw new Error("Failed to load food items");
        }

        const data: FoodItem[] = await response.json();

        setFoodItems(data);
      } catch (error) {
        console.error("Food item loading error:", error);

        setFoodError(
          "Failed to load food items. Please check the backend."
        );
      } finally {
        setFoodLoading(false);
      }
    }

    loadFoodItems();
  }, []);

  // ============================================================
  // LOAD DECORATION SESSIONS
  // ============================================================

  useEffect(() => {
    async function loadDecorSessions() {
      try {
        setDecorLoading(true);
        setDecorError("");

        const response = await fetch(
          `${API_URL}/decor-sessions`
        );

        if (!response.ok) {
          throw new Error(
            "Failed to load decoration categories"
          );
        }

        const data: DecorSession[] = await response.json();

        setDecorSessions(data);
      } catch (error) {
        console.error(
          "Decoration session error:",
          error
        );

        setDecorError(
          "Failed to load decoration categories. Please check the backend."
        );
      } finally {
        setDecorLoading(false);
      }
    }

    loadDecorSessions();
  }, []);

  // ============================================================
  // LOAD DECORATION ITEMS
  // ============================================================

  useEffect(() => {
    async function loadDecorItems() {
      try {
        setDecorLoading(true);
        setDecorError("");

        const response = await fetch(
          `${API_URL}/decor-items`
        );

        if (!response.ok) {
          throw new Error(
            "Failed to load decoration items"
          );
        }

        const data: DecorItem[] = await response.json();

        setDecorItems(data);
      } catch (error) {
        console.error(
          "Decoration item error:",
          error
        );

        setDecorError(
          "Failed to load decoration items. Please check the backend."
        );
      } finally {
        setDecorLoading(false);
      }
    }

    loadDecorItems();
  }, []);

  // ============================================================
  // FILTER FOOD ITEMS
  // ============================================================

  const filteredFoodItems = foodItems.filter(
    (item) =>
      String(item.session_id) === selectedSession
  );

  // ============================================================
  // FILTER DECOR ITEMS
  // ============================================================

  const filteredDecorItems = decorItems.filter(
    (item) =>
      String(item.session_id) === selectedDecorSession
  );

  // ============================================================
  // TOGGLE FOOD ITEM
  // ============================================================

  function toggleFoodItem(foodItemId: number) {
    setSelectedFoodItems((current) => {
      if (current.includes(foodItemId)) {
        setFoodQuantities((quantities) => {
          const updated = { ...quantities };

          delete updated[foodItemId];

          return updated;
        });

        return current.filter(
          (id) => id !== foodItemId
        );
      }

      setFoodQuantities((quantities) => ({
        ...quantities,
        [foodItemId]: 1,
      }));

      return [...current, foodItemId];
    });
  }

  // ============================================================
  // UPDATE FOOD QUANTITY
  // ============================================================

  function updateFoodQuantity(
    foodItemId: number,
    quantity: number
  ) {
    const safeQuantity = Math.max(
      1,
      quantity || 1
    );

    setFoodQuantities((current) => ({
      ...current,
      [foodItemId]: safeQuantity,
    }));
  }

  // ============================================================
  // TOGGLE DECOR ITEM
  // ============================================================

  function toggleDecorItem(decorItemId: number) {
    setSelectedDecorItems((current) => {
      if (current.includes(decorItemId)) {
        setDecorQuantities((quantities) => {
          const updated = { ...quantities };

          delete updated[decorItemId];

          return updated;
        });

        return current.filter(
          (id) => id !== decorItemId
        );
      }

      // New decoration item starts with quantity 1
      setDecorQuantities((quantities) => ({
        ...quantities,
        [decorItemId]: 1,
      }));

      return [...current, decorItemId];
    });
  }

  // ============================================================
  // UPDATE DECOR QUANTITY
  // ============================================================

  function updateDecorQuantity(
    decorItemId: number,
    quantity: number
  ) {
    const safeQuantity = Math.max(
      1,
      quantity || 1
    );

    setDecorQuantities((current) => ({
      ...current,
      [decorItemId]: safeQuantity,
    }));
  }

  // ============================================================
  // FOOD AMOUNT
  // ============================================================

  const foodAmount = selectedFoodItems.reduce(
    (total, foodId) => {
      const food = foodItems.find(
        (item) => item.id === foodId
      );

      if (!food) {
        return total;
      }

      const quantity =
        foodQuantities[food.id] || 1;

      return (
        total +
        Number(food.price) * quantity
      );
    },
    0
  );

  // ============================================================
  // DECORATION AMOUNT
  // ============================================================

  const decorAmount = selectedDecorItems.reduce(
    (total, decorId) => {
      const decor = decorItems.find(
        (item) => item.id === decorId
      );

      if (!decor) {
        return total;
      }

      const quantity =
        decorQuantities[decor.id] || 1;

      return (
        total +
        Number(decor.price) * quantity
      );
    },
    0
  );

  // ============================================================
  // TOTAL
  // ============================================================

  const totalAmount =
    foodAmount + decorAmount;

  // ============================================================
  // CREATE EVENT
  // ============================================================

  async function handleSubmit(
    e: React.FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();

    setLoading(true);
    setMessage("");

    try {
      // ========================================================
      // FOOD DATA
      // ========================================================

      const selectedFoodData = selectedFoodItems
        .map((foodId) => {
          const food = foodItems.find(
            (item) => item.id === foodId
          );

          if (!food) {
            return null;
          }

          return {
            food_item_id: food.id,

            quantity:
              foodQuantities[food.id] || 1,

            price: Number(food.price),
          };
        })
        .filter(
          (
            item
          ): item is {
            food_item_id: number;
            quantity: number;
            price: number;
          } => item !== null
        );

      // ========================================================
      // DECORATION DATA
      // ========================================================

      const selectedDecorData = selectedDecorItems
        .map((decorId) => {
          const decor = decorItems.find(
            (item) => item.id === decorId
          );

          if (!decor) {
            return null;
          }

          return {
            decor_item_id: decor.id,

            quantity:
              decorQuantities[decor.id] || 1,

            price: Number(decor.price),
          };
        })
        .filter(
          (
            item
          ): item is {
            decor_item_id: number;
            quantity: number;
            price: number;
          } => item !== null
        );

      // ========================================================
      // QUOTE
      // ========================================================

      const parsedQuoteAmount =
        quoteAmount.trim() === ""
          ? null
          : Number(quoteAmount);

      // ========================================================
      // REQUEST BODY
      // ========================================================

      const requestBody = {
        customer: {
          name: customerName,
          mobile: mobile,
        },

        event_date: eventDate,

        venue: venue,

        event_type: eventType,

        guest_count: Number(guestCount),

        food_items: selectedFoodData,

        decor_items: selectedDecorData,

        food_amount: foodAmount,

        decor_amount: decorAmount,

        total_amount: totalAmount,

        quote_amount: parsedQuoteAmount,
      };

      console.log(
        "Sending event:",
        requestBody
      );

      // ========================================================
      // SEND TO FASTAPI
      // ========================================================

      const response = await fetch(
        `${API_URL}/events`,
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify(requestBody),
        }
      );

      const data = await response.json();

      console.log(
        "Backend response:",
        data
      );

      if (!response.ok) {
        throw new Error(
          data?.detail ||
            "Failed to create event"
        );
      }

      // ========================================================
      // SUCCESS
      // ========================================================

      setMessage(
        "Event created successfully."
      );

      // ========================================================
      // CLEAR FORM
      // ========================================================

      setCustomerName("");
      setMobile("");

      setEventDate("");
      setVenue("");
      setEventType("");
      setGuestCount("");

      setSelectedSession("");

      setSelectedFoodItems([]);
      setFoodQuantities({});

      setSelectedDecorSession("");

      setSelectedDecorItems([]);
      setDecorQuantities({});

      setQuoteAmount("");
    } catch (error) {
      console.error(
        "Create event error:",
        error
      );

      setMessage(
        error instanceof Error
          ? error.message
          : "Something went wrong"
      );
    } finally {
      setLoading(false);
    }
  }

  // ============================================================
  // UI
  // ============================================================

  return (
    <main className="create-event-page">

      {/* ======================================================
          HEADER
      ====================================================== */}

      <div className="create-event-header">

        <div>
          <span className="eyebrow">
            EVENT MANAGEMENT
          </span>

          <h1>Create Event</h1>

          <p>
            Create a new Food Court event
            and customer booking.
          </p>
        </div>

        <a
          href="/"
          className="secondary-button"
        >
          ← Dashboard
        </a>

      </div>

      {/* ======================================================
          FORM
      ====================================================== */}

      <form
        className="event-form"
        onSubmit={handleSubmit}
      >

        {/* ====================================================
            CUSTOMER
        ==================================================== */}

        <section className="form-card">

          <div className="form-card-header">

            <div className="form-number">
              01
            </div>

            <div>
              <h2>Customer Details</h2>

              <p>
                Enter the customer information.
              </p>
            </div>

          </div>

          <div className="form-grid">

            <div className="form-group">

              <label>
                Customer Name
              </label>

              <input
                type="text"
                placeholder="Enter customer name"
                value={customerName}
                onChange={(e) =>
                  setCustomerName(
                    e.target.value
                  )
                }
                required
              />

            </div>

            <div className="form-group">

              <label>
                Mobile Number
              </label>

              <input
                type="tel"
                placeholder="Enter mobile number"
                value={mobile}
                onChange={(e) =>
                  setMobile(
                    e.target.value
                  )
                }
                required
              />

            </div>

          </div>

        </section>

        {/* ====================================================
            EVENT DETAILS
        ==================================================== */}

        <section className="form-card">

          <div className="form-card-header">

            <div className="form-number">
              02
            </div>

            <div>
              <h2>Event Details</h2>

              <p>
                Enter the basic event information.
              </p>
            </div>

          </div>

          <div className="form-grid">

            <div className="form-group">

              <label>
                Event Date
              </label>

              <input
                type="date"
                value={eventDate}
                onChange={(e) =>
                  setEventDate(
                    e.target.value
                  )
                }
                required
              />

            </div>

            <div className="form-group">

              <label>
                Venue
              </label>

              <input
                type="text"
                placeholder="Example: Kottakkal"
                value={venue}
                onChange={(e) =>
                  setVenue(
                    e.target.value
                  )
                }
                required
              />

            </div>

            <div className="form-group">

              <label>
                Event Type
              </label>

              <select
                value={eventType}
                onChange={(e) =>
                  setEventType(
                    e.target.value
                  )
                }
                required
              >

                <option value="">
                  Select event type
                </option>

                <option value="Wedding">
                  Wedding
                </option>

                <option value="Engagement">
                  Engagement
                </option>

                <option value="Birthday">
                  Birthday
                </option>

                <option value="Corporate">
                  Corporate
                </option>

                <option value="Other">
                  Other
                </option>

              </select>

            </div>

            <div className="form-group">

              <label>
                Number of Guests
              </label>

              <input
                type="number"
                min="1"
                placeholder="Example: 500"
                value={guestCount}
                onChange={(e) =>
                  setGuestCount(
                    e.target.value
                  )
                }
                required
              />

            </div>

          </div>

        </section>

        {/* ====================================================
            FOOD
        ==================================================== */}

        <section className="form-card">

          <div className="form-card-header">

            <div className="form-number">
              03
            </div>

            <div>
              <h2>Food Selection</h2>

              <p>
                Select menu category,
                food items and quantities.
              </p>
            </div>

          </div>

          {/* MENU CATEGORY */}

          <div className="form-group">

            <label>
              Menu Category
            </label>

            {menuLoading && (
              <div className="menu-loading">
                Loading menu categories...
              </div>
            )}

            {menuError && (
              <div className="form-message error">
                {menuError}
              </div>
            )}

            {!menuLoading &&
              !menuError && (
                <select
                  value={selectedSession}
                  onChange={(e) =>
                    setSelectedSession(
                      e.target.value
                    )
                  }
                >

                  <option value="">
                    Select Menu Category
                  </option>

                  {sessions.map(
                    (session) => (
                      <option
                        key={session.id}
                        value={session.id}
                      >
                        {session.name}
                      </option>
                    )
                  )}

                </select>
              )}

          </div>

          {/* FOOD ITEMS */}

          {selectedSession && (
            <div className="food-items-section">

              <div className="food-section-header">

                <div>
                  <h3>
                    Food Items
                  </h3>

                  <p>
                    Select food items
                    and set quantity.
                  </p>
                </div>

                {selectedFoodItems.length > 0 && (
                  <span className="selected-count">
                    {selectedFoodItems.length} selected
                  </span>
                )}

              </div>

              {foodLoading && (
                <div className="food-loading">
                  Loading food items...
                </div>
              )}

              {foodError && (
                <div className="form-message error">
                  {foodError}
                </div>
              )}

              {!foodLoading &&
                !foodError &&
                filteredFoodItems.length === 0 && (
                  <div className="no-food-items">
                    No food items found
                    for this category.
                  </div>
                )}

              {!foodLoading &&
                !foodError &&
                filteredFoodItems.length > 0 && (
                  <div className="food-item-grid">

                    {filteredFoodItems.map(
                      (item) => {

                        const isSelected =
                          selectedFoodItems.includes(
                            item.id
                          );

                        const quantity =
                          foodQuantities[
                            item.id
                          ] || 1;

                        return (
                          <div
                            key={item.id}
                            className={`food-item-card ${
                              isSelected
                                ? "selected"
                                : ""
                            }`}
                          >

                            {/* ITEM SELECT AREA */}

                            <button
                              type="button"
                              className="food-item-select-area"
                              onClick={() =>
                                toggleFoodItem(
                                  item.id
                                )
                              }
                            >

                              <div className="food-item-left">

                                <div
                                  className={`food-checkbox ${
                                    isSelected
                                      ? "checked"
                                      : ""
                                  }`}
                                >
                                  {isSelected &&
                                    "✓"}
                                </div>

                                <div className="food-item-info">

                                  <span className="food-item-name">
                                    {item.name}
                                  </span>

                                  {Number(
                                    item.price
                                  ) > 0 && (
                                    <span className="food-item-price">
                                      ₹
                                      {Number(
                                        item.price
                                      ).toFixed(
                                        2
                                      )}
                                    </span>
                                  )}

                                </div>

                              </div>

                            </button>

                            {/* QUANTITY */}

                            {isSelected ? (
                              <div
                                className="food-quantity-control"
                                onClick={(e) =>
                                  e.stopPropagation()
                                }
                              >

                                <button
                                  type="button"
                                  onClick={() =>
                                    updateFoodQuantity(
                                      item.id,
                                      quantity - 1
                                    )
                                  }
                                  disabled={
                                    quantity <= 1
                                  }
                                >
                                  −
                                </button>

                                <input
                                  type="number"
                                  min="1"
                                  value={quantity}
                                  onChange={(e) =>
                                    updateFoodQuantity(
                                      item.id,
                                      Number(
                                        e.target.value
                                      )
                                    )
                                  }
                                />

                                <button
                                  type="button"
                                  onClick={() =>
                                    updateFoodQuantity(
                                      item.id,
                                      quantity + 1
                                    )
                                  }
                                >
                                  +
                                </button>

                              </div>
                            ) : (
                              <span className="food-select-text">
                                Select
                              </span>
                            )}

                          </div>
                        );
                      }
                    )}

                  </div>
                )}

              {/* SELECTED FOOD */}

              {selectedFoodItems.length > 0 && (
                <div className="selected-food-box">

                  <div className="selected-food-header">

                    <h3>
                      Selected Food Items
                    </h3>

                    <button
                      type="button"
                      className="clear-food-button"
                      onClick={() => {
                        setSelectedFoodItems([]);
                        setFoodQuantities({});
                      }}
                    >
                      Clear all
                    </button>

                  </div>

                  <div className="selected-food-list">

                    {selectedFoodItems.map(
                      (foodId) => {

                        const food =
                          foodItems.find(
                            (item) =>
                              item.id === foodId
                          );

                        if (!food) {
                          return null;
                        }

                        const quantity =
                          foodQuantities[
                            food.id
                          ] || 1;

                        const itemTotal =
                          Number(food.price) *
                          quantity;

                        return (
                          <div
                            key={food.id}
                            className="selected-food-row"
                          >

                            <div className="selected-food-info">

                              <strong>
                                {food.name}
                              </strong>

                              <span>
                                ₹
                                {Number(
                                  food.price
                                ).toFixed(
                                  2
                                )}{" "}
                                × {quantity}
                              </span>

                            </div>

                            <div className="selected-food-total">
                              ₹
                              {itemTotal.toFixed(
                                2
                              )}
                            </div>

                            <button
                              type="button"
                              className="remove-food-button"
                              onClick={() =>
                                toggleFoodItem(
                                  food.id
                                )
                              }
                            >
                              ×
                            </button>

                          </div>
                        );
                      }
                    )}

                  </div>

                </div>
              )}

            </div>
          )}

        </section>

        {/* ====================================================
            DECORATION
        ==================================================== */}

        <section className="form-card">

          <div className="form-card-header">

            <div className="form-number">
              04
            </div>

            <div>
              <h2>
                Decoration
              </h2>

              <p>
                Select decoration category,
                items and quantities.
              </p>
            </div>

          </div>

          {/* DECOR CATEGORY */}

          <div className="form-group">

            <label>
              Decoration Category
            </label>

            {decorLoading && (
              <div className="menu-loading">
                Loading decoration categories...
              </div>
            )}

            {decorError && (
              <div className="form-message error">
                {decorError}
              </div>
            )}

            {!decorLoading &&
              !decorError && (
                <select
                  value={selectedDecorSession}
                  onChange={(e) =>
                    setSelectedDecorSession(
                      e.target.value
                    )
                  }
                >

                  <option value="">
                    Select Decoration Category
                  </option>

                  {decorSessions.map(
                    (session) => (
                      <option
                        key={session.id}
                        value={session.id}
                      >
                        {session.name}
                      </option>
                    )
                  )}

                </select>
              )}

          </div>

          {/* DECOR ITEMS */}

          {selectedDecorSession && (
            <div className="food-items-section">

              <div className="food-section-header">

                <div>
                  <h3>
                    Decoration Items
                  </h3>

                  <p>
                    Select decoration items
                    and set quantity.
                  </p>
                </div>

                {selectedDecorItems.length > 0 && (
                  <span className="selected-count">
                    {selectedDecorItems.length} selected
                  </span>
                )}

              </div>

              {!decorLoading &&
                !decorError &&
                filteredDecorItems.length === 0 && (
                  <div className="no-food-items">
                    No decoration items found
                    for this category.
                  </div>
                )}

              {!decorLoading &&
                !decorError &&
                filteredDecorItems.length > 0 && (
                  <div className="food-item-grid">

                    {filteredDecorItems.map(
                      (item) => {

                        const isSelected =
                          selectedDecorItems.includes(
                            item.id
                          );

                        const quantity =
                          decorQuantities[
                            item.id
                          ] || 1;

                        return (
                          <div
                            key={item.id}
                            className={`food-item-card ${
                              isSelected
                                ? "selected"
                                : ""
                            }`}
                          >

                            {/* ITEM SELECT AREA */}

                            <button
                              type="button"
                              className="food-item-select-area"
                              onClick={() =>
                                toggleDecorItem(
                                  item.id
                                )
                              }
                            >

                              <div className="food-item-left">

                                <div
                                  className={`food-checkbox ${
                                    isSelected
                                      ? "checked"
                                      : ""
                                  }`}
                                >
                                  {isSelected &&
                                    "✓"}
                                </div>

                                <div className="food-item-info">

                                  <span className="food-item-name">
                                    {item.name}
                                  </span>

                                  {Number(
                                    item.price
                                  ) > 0 && (
                                    <span className="food-item-price">
                                      ₹
                                      {Number(
                                        item.price
                                      ).toFixed(
                                        2
                                      )}
                                    </span>
                                  )}

                                </div>

                              </div>

                            </button>

                            {/* DECOR QUANTITY */}

                            {isSelected ? (
                              <div
                                className="food-quantity-control"
                                onClick={(e) =>
                                  e.stopPropagation()
                                }
                              >

                                <button
                                  type="button"
                                  onClick={() =>
                                    updateDecorQuantity(
                                      item.id,
                                      quantity - 1
                                    )
                                  }
                                  disabled={
                                    quantity <= 1
                                  }
                                >
                                  −
                                </button>

                                <input
                                  type="number"
                                  min="1"
                                  value={quantity}
                                  onChange={(e) =>
                                    updateDecorQuantity(
                                      item.id,
                                      Number(
                                        e.target.value
                                      )
                                    )
                                  }
                                />

                                <button
                                  type="button"
                                  onClick={() =>
                                    updateDecorQuantity(
                                      item.id,
                                      quantity + 1
                                    )
                                  }
                                >
                                  +
                                </button>

                              </div>
                            ) : (
                              <span className="food-select-text">
                                Select
                              </span>
                            )}

                          </div>
                        );
                      }
                    )}

                  </div>
                )}

              {/* SELECTED DECORATION */}

              {selectedDecorItems.length > 0 && (
                <div className="selected-food-box">

                  <div className="selected-food-header">

                    <h3>
                      Selected Decoration Items
                    </h3>

                    <button
                      type="button"
                      className="clear-food-button"
                      onClick={() => {
                        setSelectedDecorItems([]);
                        setDecorQuantities({});
                      }}
                    >
                      Clear all
                    </button>

                  </div>

                  <div className="selected-food-list">

                    {selectedDecorItems.map(
                      (decorId) => {

                        const decor =
                          decorItems.find(
                            (item) =>
                              item.id === decorId
                          );

                        if (!decor) {
                          return null;
                        }

                        const quantity =
                          decorQuantities[
                            decor.id
                          ] || 1;

                        const itemTotal =
                          Number(decor.price) *
                          quantity;

                        return (
                          <div
                            key={decor.id}
                            className="selected-food-row"
                          >

                            <div className="selected-food-info">

                              <strong>
                                {decor.name}
                              </strong>

                              <span>
                                ₹
                                {Number(
                                  decor.price
                                ).toFixed(
                                  2
                                )}{" "}
                                × {quantity}
                              </span>

                            </div>

                            <div className="selected-food-total">
                              ₹
                              {itemTotal.toFixed(
                                2
                              )}
                            </div>

                            <button
                              type="button"
                              className="remove-food-button"
                              onClick={() =>
                                toggleDecorItem(
                                  decor.id
                                )
                              }
                            >
                              ×
                            </button>

                          </div>
                        );
                      }
                    )}

                  </div>

                </div>
              )}

            </div>
          )}

        </section>

        {/* ====================================================
            AMOUNT SUMMARY
        ==================================================== */}

        <section className="form-card amount-summary-card">

          <div className="form-card-header">

            <div className="form-number">
              05
            </div>

            <div>
              <h2>
                Event Summary
              </h2>

              <p>
                Review the selected services
                and estimated amount.
              </p>
            </div>

          </div>

          <div className="amount-summary">

            <div className="amount-row">

              <span>
                Food Amount
              </span>

              <strong>
                ₹{foodAmount.toFixed(2)}
              </strong>

            </div>

            <div className="amount-row">

              <span>
                Decoration Amount
              </span>

              <strong>
                ₹{decorAmount.toFixed(2)}
              </strong>

            </div>

            <div className="amount-row total">

              <span>
                Total Amount
              </span>

              <strong>
                ₹{totalAmount.toFixed(2)}
              </strong>

            </div>

            <div className="amount-row quote-row">

              <div>

                <span>
                  Quote Amount
                </span>

                <small>
                  Enter the final amount
                  quoted to the customer
                </small>

              </div>

              <div className="quote-input-wrapper">

                <span className="quote-currency">
                  ₹
                </span>

                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={quoteAmount}
                  onChange={(e) =>
                    setQuoteAmount(
                      e.target.value
                    )
                  }
                  className="quote-amount-input"
                />

              </div>

            </div>

          </div>

        </section>

        {/* ====================================================
            MESSAGE
        ==================================================== */}

        {message && (
          <div
            className={
              message.includes(
                "successfully"
              )
                ? "form-message success"
                : "form-message error"
            }
          >
            {message}
          </div>
        )}

        {/* ====================================================
            ACTIONS
        ==================================================== */}

        <div className="form-actions">

          <a
            href="/"
            className="cancel-button"
          >
            Cancel
          </a>

          <button
            type="submit"
            className="primary-button"
            disabled={loading}
          >
            {loading
              ? "Creating..."
              : "Create Event"}
          </button>

        </div>

      </form>

    </main>
  );
}