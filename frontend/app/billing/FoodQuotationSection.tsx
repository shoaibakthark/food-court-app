"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";

const API_URL = typeof window !== "undefined" ? "/api/py" : "http://127.0.0.1:8000";

export interface QuotationItem {
  id: string;
  name: string;
  quantity: string;
  price: string;
}

export interface QuotationCategory {
  id: string;
  category: string;
  layout?: "single" | "two-column";
  items: QuotationItem[];
}

export interface FoodQuotation {
  id?: number;
  quotation_no: string;
  date: string;
  client_name: string;
  venue: string;
  event_name: string;
  guest_count: number;
  phone: string;
  location_tag: string;
  coverage_tag: string;
  terms: string;
  total_amount: number | string | null;
  categories: QuotationCategory[];
  event_id?: number | null;
  created_at?: string;
  updated_at?: string;
}

// Default initial sample matching user's exact uploaded image
export const DEFAULT_SHADI_MAHAL_SAMPLE: FoodQuotation = {
  quotation_no: "FC-QT-2026-001",
  date: "14 - Nov - 2026",
  client_name: "Shadi Mahal",
  venue: "Shadi Mahal",
  event_name: "1500 Guests",
  guest_count: 1500,
  phone: "+91 8592991909",
  location_tag: "BASED IN ATHAHAKKAD - KOTTAMELAD",
  coverage_tag: "TRAVEL ALL OVER TN",
  terms: "Prices are subject to final guest count.",
  total_amount: "",
  categories: [
    {
      id: "cat_1",
      category: "PRE EVENT ( THALEN )",
      layout: "single",
      items: [
        { id: "item_1_1", name: "Ghee rice", quantity: "60 kg", price: "-" },
        { id: "item_1_2", name: "Chicken curry", quantity: "50 kg", price: "-" },
        { id: "item_1_3", name: "Salad", quantity: "-", price: "-" },
        { id: "item_1_4", name: "Pickle", quantity: "-", price: "-" },
      ],
    },
    {
      id: "cat_2",
      category: "WELCOME DRINKS",
      layout: "single",
      items: [
        { id: "item_2_1", name: "Watermelon", quantity: "-", price: "-" },
        { id: "item_2_2", name: "Pineapple", quantity: "-", price: "-" },
        { id: "item_2_3", name: "Mint cooler", quantity: "-", price: "-" },
      ],
    },
    {
      id: "cat_3",
      category: "MAIN COURSE",
      layout: "single",
      items: [
        { id: "item_3_1", name: "Kuttan biriyani", quantity: "100 kg + 50 kg extra meat", price: "-" },
        { id: "item_3_2", name: "Chicken fried pulav", quantity: "100 kg + 40 kg extra meat", price: "-" },
        { id: "item_3_3", name: "Chicken kondattam", quantity: "180 kg", price: "-" },
        { id: "item_3_4", name: "Mixed salad", quantity: "-", price: "-" },
        { id: "item_3_5", name: "Pickle", quantity: "-", price: "-" },
      ],
    },
    {
      id: "cat_4",
      category: "KERALA MEAL",
      layout: "single",
      items: [
        { id: "item_4_1", name: "Plain rice", quantity: "15 kg", price: "-" },
        { id: "item_4_2", name: "Upperi", quantity: "-", price: "-" },
        { id: "item_4_3", name: "Aviyal", quantity: "-", price: "-" },
        { id: "item_4_4", name: "Sambar / Moru curry", quantity: "-", price: "-" },
        { id: "item_4_5", name: "Fish curry", quantity: "-", price: "-" },
        { id: "item_4_6", name: "Fish fry", quantity: "150 pcs", price: "-" },
      ],
    },
    {
      id: "cat_5",
      category: "DESSERTS",
      layout: "single",
      items: [
        { id: "item_5_1", name: "Luqimath", quantity: "-", price: "-" },
        { id: "item_5_2", name: "Popcorn", quantity: "-", price: "-" },
        { id: "item_5_3", name: "Herbal tea", quantity: "-", price: "-" },
      ],
    },
    {
      id: "cat_6",
      category: "SETTING & OTHERS",
      layout: "two-column",
      items: [
        { id: "item_6_1", name: "Welcome conter", quantity: "-", price: "" },
        { id: "item_6_2", name: "Dessert counter", quantity: "-", price: "" },
        { id: "item_6_3", name: "Islamic counter", quantity: "-", price: "" },
        { id: "item_6_4", name: "Clothes", quantity: "-", price: "" },
        { id: "item_6_5", name: "Chair cover", quantity: "-", price: "" },
        { id: "item_6_6", name: "Service boys", quantity: "-", price: "" },
        { id: "item_6_7", name: "Ceramic plate", quantity: "-", price: "" },
        { id: "item_6_8", name: "Glass", quantity: "-", price: "" },
        { id: "item_6_9", name: "Owel plate (thatt)", quantity: "-", price: "" },
        { id: "item_6_10", name: "Salad bowl spoon", quantity: "-", price: "" },
        { id: "item_6_11", name: "Qater plate spoon", quantity: "-", price: "" },
        { id: "item_6_12", name: "Curry bowl", quantity: "-", price: "" },
        { id: "item_6_13", name: "Bucket", quantity: "-", price: "" },
        { id: "item_6_14", name: "Waste bin", quantity: "-", price: "" },
        { id: "item_6_15", name: "Dissposile items", quantity: "-", price: "" },
      ],
    },
  ],
};

function formatDisplayDate(dateStr: string): string {
  if (!dateStr) return "";
  if (dateStr.includes("-") && dateStr.split("-").length === 3 && dateStr.length > 10) {
    return dateStr;
  }
  try {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      const day = String(d.getDate()).padStart(2, "0");
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const month = monthNames[d.getMonth()];
      const year = d.getFullYear();
      return `${day} - ${month} - ${year}`;
    }
  } catch {
    // fallback
  }
  return dateStr;
}

// Convert "14 - Nov - 2026" back to "YYYY-MM-DD" for HTML date picker
function parseToInputDate(dateStr: string): string {
  if (!dateStr) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr.trim())) return dateStr.trim();
  const parts = dateStr.split("-").map((p) => p.trim());
  if (parts.length === 3) {
    const day = parts[0].padStart(2, "0");
    const monthNames: Record<string, string> = {
      jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
      jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12"
    };
    const mStr = parts[1].toLowerCase().slice(0, 3);
    const month = monthNames[mStr] || "01";
    const year = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
    if (year.length === 4) {
      return `${year}-${month}-${day}`;
    }
  }
  return "";
}

// Vector Filigree Ornaments
function GoldCorner({ flipX = false, flipY = false }: { flipX?: boolean; flipY?: boolean }) {
  const transform = `${flipX ? "scaleX(-1) " : ""}${flipY ? "scaleY(-1)" : ""}`.trim();
  return (
    <svg
      width="38"
      height="38"
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{
        transform: transform || undefined,
        display: "block",
        flexShrink: 0,
      }}
    >
      <path
        d="M3 45V14C3 7.92487 7.92487 3 14 3H45M7 45V16C7 11.0294 11.0294 7 16 7H45"
        stroke="#C5A059"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="16" cy="16" r="3.5" fill="#C5A059" />
      <path
        d="M16 19.5C16 26 21 31 27.5 31C34 31 39 26 39 19.5"
        stroke="#C5A059"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <circle cx="27.5" cy="31" r="2" fill="#C5A059" />
      <circle cx="3" cy="45" r="2" fill="#8A6B2D" />
      <circle cx="45" cy="3" r="2" fill="#8A6B2D" />
    </svg>
  );
}

function GoldFlourishHeader() {
  return (
    <svg width="120" height="18" viewBox="0 0 160 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M5 12C30 12 45 4 65 12C72 15 76 15 80 12C84 15 88 15 95 12C115 4 130 12 155 12"
        stroke="#C5A059"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="80" cy="12" r="4" fill="#6B1D25" stroke="#C5A059" strokeWidth="1.5" />
      <circle cx="70" cy="12" r="2" fill="#C5A059" />
      <circle cx="90" cy="12" r="2" fill="#C5A059" />
      <circle cx="80" cy="4" r="1.5" fill="#C5A059" />
      <circle cx="80" cy="20" r="1.5" fill="#C5A059" />
    </svg>
  );
}

function GoldFlourishFooter() {
  return (
    <svg width="140" height="22" viewBox="0 0 180 28" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M10 14C40 14 55 6 75 14C83 17 87 17 90 14C93 17 97 17 105 14C125 6 140 14 170 14"
        stroke="#C5A059"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <polygon points="90,4 97,14 90,24 83,14" fill="#C5A059" />
      <circle cx="90" cy="14" r="2" fill="#6B1D25" />
      <circle cx="60" cy="14" r="2" fill="#C5A059" />
      <circle cx="120" cy="14" r="2" fill="#C5A059" />
    </svg>
  );
}

// Chef Hat Vector Icon for Logo Medallion
function ChefHatIcon() {
  return (
    <svg width="40" height="34" viewBox="0 0 48 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M10 24C6.5 23 4 19.5 4 15.5C4 10.8 7.8 7 12.5 7C13.5 7 14.5 7.2 15.4 7.6C17.2 3.1 21.7 0 27 0C33.2 0 38.4 4.3 39.7 10.1C40.4 10 41.2 10 42 10C45.3 10 48 12.7 48 16C48 19.1 45.6 21.6 42.6 22L40 32H12L10 24Z"
        fill="url(#goldGradient)"
        stroke="#E6CA85"
        strokeWidth="1"
      />
      <rect x="12" y="32" width="28" height="5" rx="1.5" fill="#C5A059" stroke="#E6CA85" strokeWidth="0.8" />
      <line x1="16" y1="34.5" x2="36" y2="34.5" stroke="#1B1617" strokeWidth="1" strokeLinecap="round" />
      <defs>
        <linearGradient id="goldGradient" x1="4" y1="0" x2="48" y2="34" gradientUnits="userSpaceOnUse">
          <stop stopColor="#F7E7B4" />
          <stop offset="0.5" stopColor="#D4AF37" />
          <stop offset="1" stopColor="#AA822A" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function FoodQuotationSection({
  initialEventId,
  autoCreate = false,
}: {
  initialEventId?: number;
  autoCreate?: boolean;
}) {
  const [quotations, setQuotations] = useState<FoodQuotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeQuotation, setActiveQuotation] = useState<FoodQuotation | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isLivePreviewOpen, setIsLivePreviewOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [eventList, setEventList] = useState<any[]>([]);

  // Draft state for editor
  const [draft, setDraft] = useState<FoodQuotation>(DEFAULT_SHADI_MAHAL_SAMPLE);
  const [inputDate, setInputDate] = useState<string>("2026-11-14");

  const printAreaRef = useRef<HTMLDivElement>(null);

  // Show Toast
  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  // Load Quotations from API & LocalStorage
  const loadQuotations = async () => {
    setLoading(true);
    let loaded: FoodQuotation[] = [];

    try {
      const res = await fetch(`${API_URL}/quotations`);
      if (res.ok) {
        const data = await res.json();
        loaded = data.map((q: any) => {
          let parsedCategories: QuotationCategory[] = [];
          try {
            parsedCategories = typeof q.items_json === "string" ? JSON.parse(q.items_json) : q.items_json;
          } catch {
            parsedCategories = [];
          }
          return {
            id: q.id,
            quotation_no: q.quotation_no || `FC-QT-${q.id}`,
            date: q.date,
            client_name: q.client_name,
            venue: q.venue || "",
            event_name: q.event_name || "",
            guest_count: q.guest_count || 0,
            event_id: q.event_id,
            phone: q.phone || "+91 8592991909",
            location_tag: q.location_tag || "BASED IN ATHAHAKKAD - KOTTAMELAD",
            coverage_tag: q.coverage_tag || "TRAVEL ALL OVER TN",
            terms: q.terms || "Prices are subject to final guest count.",
            total_amount: q.total_amount,
            categories: Array.isArray(parsedCategories) && parsedCategories.length > 0 ? parsedCategories : DEFAULT_SHADI_MAHAL_SAMPLE.categories,
            created_at: q.created_at,
            updated_at: q.updated_at,
          };
        });
      }
    } catch (err) {
      console.warn("Backend API not reachable, checking localStorage fallback", err);
    }

    // Check localStorage fallback if empty
    if (loaded.length === 0 && typeof window !== "undefined") {
      try {
        const local = localStorage.getItem("food_court_quotations");
        if (local) {
          loaded = JSON.parse(local);
        }
      } catch (e) {
        console.error("Failed to parse local quotations", e);
      }
    }

    // If still empty, seed default Shadi Mahal sample so user immediately sees what it looks like!
    if (loaded.length === 0) {
      loaded = [DEFAULT_SHADI_MAHAL_SAMPLE];
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem("food_court_quotations", JSON.stringify(loaded));
        } catch {}
      }
    }

    setQuotations(loaded);
    setLoading(false);
  };

  // Fetch events for quick dropdown selection
  useEffect(() => {
    fetch(`${API_URL}/events`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setEventList(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadQuotations();
  }, []);

  // Filtered list
  const filteredQuotations = useMemo(() => {
    if (!searchQuery.trim()) return quotations;
    const q = searchQuery.toLowerCase().trim();
    return quotations.filter(
      (item) =>
        item.client_name.toLowerCase().includes(q) ||
        item.venue.toLowerCase().includes(q) ||
        item.quotation_no.toLowerCase().includes(q) ||
        item.date.toLowerCase().includes(q) ||
        item.event_name.toLowerCase().includes(q)
    );
  }, [quotations, searchQuery]);

  // Handle open editor for new quotation
  const handleOpenNew = () => {
    const nextNum = quotations.length + 1;
    const initial: FoodQuotation = {
      ...DEFAULT_SHADI_MAHAL_SAMPLE,
      id: undefined,
      quotation_no: `FC-QT-2026-${String(nextNum).padStart(3, "0")}`,
      client_name: "",
      venue: "",
      event_name: "",
      guest_count: 500,
      date: formatDisplayDate(new Date().toISOString().split("T")[0]),
    };
    setDraft(initial);
    setInputDate(new Date().toISOString().split("T")[0]);
    setIsEditorOpen(true);
  };

  // Handle open editor for existing quotation
  const handleOpenEdit = (q: FoodQuotation) => {
    setDraft(JSON.parse(JSON.stringify(q)));
    setInputDate(parseToInputDate(q.date) || new Date().toISOString().split("T")[0]);
    setIsEditorOpen(true);
  };

  // Handle View / Print
  const handleOpenPrintPreview = (q: FoodQuotation) => {
    setActiveQuotation(q);
    setIsLivePreviewOpen(true);
  };

  // Handle Save
  const handleSaveQuotation = async () => {
    if (!draft.client_name.trim()) {
      alert("Please enter the Client Name before saving.");
      return;
    }
    setSaving(true);

    const payload = {
      quotation_no: draft.quotation_no.trim() || undefined,
      date: draft.date.trim() || formatDisplayDate(inputDate),
      client_name: draft.client_name.trim(),
      venue: draft.venue.trim() || undefined,
      event_name: draft.event_name.trim() || undefined,
      guest_count: Number(draft.guest_count) || 0,
      event_id: draft.event_id || undefined,
      phone: draft.phone.trim() || "+91 8592991909",
      location_tag: draft.location_tag || "BASED IN ATHAHAKKAD - KOTTAMELAD",
      coverage_tag: draft.coverage_tag || "TRAVEL ALL OVER TN",
      terms: draft.terms || "Prices are subject to final guest count.",
      total_amount: draft.total_amount ? Number(draft.total_amount) : null,
      items_json: JSON.stringify(draft.categories),
    };

    let savedItem: FoodQuotation = { ...draft };

    try {
      const url = draft.id ? `${API_URL}/quotations/${draft.id}` : `${API_URL}/quotations`;
      const method = draft.id ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const savedData = await res.json();
        savedItem = {
          ...draft,
          id: savedData.id,
          quotation_no: savedData.quotation_no,
          date: savedData.date,
          created_at: savedData.created_at,
          updated_at: savedData.updated_at,
        };
        showToast(draft.id ? "✓ Quotation updated successfully!" : "✓ New Quotation created & saved to database!");
      } else {
        throw new Error("API returned status " + res.status);
      }
    } catch (err) {
      console.warn("Saving to local storage fallback due to API error", err);
      if (!savedItem.id) {
        savedItem.id = Date.now();
      }
      showToast("✓ Quotation saved locally!");
    }

    // Sync to local state and localStorage
    const updatedList = draft.id
      ? quotations.map((item) => (item.id === savedItem.id ? savedItem : item))
      : [savedItem, ...quotations];

    setQuotations(updatedList);
    try {
      localStorage.setItem("food_court_quotations", JSON.stringify(updatedList));
    } catch {}

    setSaving(false);
    setIsEditorOpen(false);
    setActiveQuotation(savedItem);
  };

  // Handle Delete
  const handleDeleteQuotation = async (q: FoodQuotation) => {
    if (!confirm(`Are you sure you want to delete quotation "${q.quotation_no}" for ${q.client_name}?`)) {
      return;
    }

    if (q.id) {
      try {
        await fetch(`${API_URL}/quotations/${q.id}`, { method: "DELETE" });
      } catch (e) {
        console.warn("Failed deleting from backend", e);
      }
    }

    const updated = quotations.filter((item) => item !== q && item.id !== q.id);
    setQuotations(updated);
    try {
      localStorage.setItem("food_court_quotations", JSON.stringify(updated));
    } catch {}
    if (activeQuotation?.id === q.id) {
      setActiveQuotation(null);
      setIsLivePreviewOpen(false);
    }
    showToast("Quotation deleted");
  };

  // Handle Duplicate
  const handleDuplicate = (q: FoodQuotation) => {
    const copy: FoodQuotation = JSON.parse(JSON.stringify(q));
    delete copy.id;
    copy.quotation_no = `${q.quotation_no}-COPY`;
    copy.client_name = `${q.client_name} (Copy)`;
    setDraft(copy);
    setInputDate(parseToInputDate(copy.date) || new Date().toISOString().split("T")[0]);
    setIsEditorOpen(true);
  };

  // Import from existing Event
  const handleImportEvent = (eventIdStr: string) => {
    const evId = Number(eventIdStr);
    const ev = eventList.find((e) => e.id === evId);
    if (!ev) return;

    setDraft((prev) => ({
      ...prev,
      event_id: ev.id,
      client_name: ev.customer_name || ev.client_name || prev.client_name,
      venue: ev.place || prev.venue,
      event_name: `${ev.event_type || "Event"} (${ev.guest_count || 0} Guests)`,
      guest_count: ev.guest_count || prev.guest_count,
      date: formatDisplayDate(ev.date) || prev.date,
    }));
    if (ev.date) {
      setInputDate(ev.date);
    }
    showToast(`✓ Auto-filled details from event: ${ev.event_type || "Event"}`);
  };

  // Add Item to a Category
  const handleAddItem = (catId: string) => {
    setDraft((prev) => {
      const updatedCategories = prev.categories.map((cat) => {
        if (cat.id === catId) {
          const newItem: QuotationItem = {
            id: `item_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            name: "New Item",
            quantity: "-",
            price: "-",
          };
          return {
            ...cat,
            items: [...cat.items, newItem],
          };
        }
        return cat;
      });
      return { ...prev, categories: updatedCategories };
    });
  };

  // Remove Item
  const handleRemoveItem = (catId: string, itemId: string) => {
    setDraft((prev) => ({
      ...prev,
      categories: prev.categories.map((cat) =>
        cat.id === catId
          ? { ...cat, items: cat.items.filter((item) => item.id !== itemId) }
          : cat
      ),
    }));
  };

  // Update Item field
  const handleUpdateItem = (catId: string, itemId: string, field: keyof QuotationItem, val: string) => {
    setDraft((prev) => ({
      ...prev,
      categories: prev.categories.map((cat) =>
        cat.id === catId
          ? {
              ...cat,
              items: cat.items.map((item) => (item.id === itemId ? { ...item, [field]: val } : item)),
            }
          : cat
      ),
    }));
  };

  // Add Category
  const handleAddCategory = () => {
    const catName = prompt("Enter new section name (e.g. LIVE COUNTER, WELCOME SNACKS, DESSERTS):");
    if (!catName || !catName.trim()) return;

    const newCat: QuotationCategory = {
      id: `cat_${Date.now()}`,
      category: catName.trim().toUpperCase(),
      layout: "single",
      items: [
        {
          id: `item_${Date.now()}_1`,
          name: "Item 1",
          quantity: "-",
          price: "-",
        },
      ],
    };

    setDraft((prev) => ({
      ...prev,
      categories: [...prev.categories, newCat],
    }));
  };

  // Remove Category
  const handleRemoveCategory = (catId: string) => {
    if (!confirm("Are you sure you want to remove this category and all its items?")) return;
    setDraft((prev) => ({
      ...prev,
      categories: prev.categories.filter((cat) => cat.id !== catId),
    }));
  };

  // Print function
  const triggerPrint = () => {
    window.print();
  };

  // Share on WhatsApp
  const handleShareWhatsApp = (q: FoodQuotation) => {
    const phone = q.phone.replace(/[^0-9]/g, "");
    let text = `*EVENT FOOD QUOTATION — FOOD COURT*\n`;
    text += `*Quotation No:* ${q.quotation_no}\n`;
    text += `*Date:* ${q.date}\n`;
    text += `*Client Name:* ${q.client_name}\n`;
    text += `*Venue:* ${q.venue || "—"}\n`;
    text += `*Guests:* ${q.guest_count}\n\n`;

    q.categories.forEach((cat) => {
      text += `*${cat.category}*\n`;
      cat.items.forEach((item) => {
        text += `• ${item.name}${item.quantity && item.quantity !== "-" ? ` (${item.quantity})` : ""}\n`;
      });
      text += `\n`;
    });

    if (q.total_amount) {
      text += `*TOTAL AMOUNT:* ₹ ${Number(q.total_amount).toLocaleString("en-IN")}\n`;
    }
    text += `\n*Note:* ${q.terms}\n`;
    text += `Food Court Catering & Event Planners • +91 8592991909`;

    const encoded = encodeURIComponent(text);
    window.open(`https://wa.me/?text=${encoded}`, "_blank");
  };

  return (
    <div className="food-quotations-section">
      {/* Toast Alert */}
      {toast && (
        <div
          style={{
            position: "fixed",
            bottom: "24px",
            right: "24px",
            background: "#180828",
            color: "#ffffff",
            padding: "12px 20px",
            borderRadius: "10px",
            boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
            zIndex: 100000,
            fontSize: "14px",
            fontWeight: 600,
            border: "1px solid #7c3aed",
          }}
        >
          {toast}
        </div>
      )}

      {/* Section Sub-header */}
      <div
        className="no-print"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "16px",
          marginBottom: "24px",
          padding: "20px 24px",
          background: "linear-gradient(135deg, #2b0b14 0%, #4a121c 100%)",
          borderRadius: "16px",
          color: "#ffffff",
          boxShadow: "0 10px 25px rgba(74, 18, 28, 0.25)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div
            style={{
              width: "52px",
              height: "52px",
              borderRadius: "14px",
              background: "#1b070b",
              border: "2px solid #c5a059",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
            }}
          >
            <ChefHatIcon />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
              <h2 style={{ margin: 0, fontSize: "20px", fontWeight: 800, letterSpacing: "0.5px" }}>
                Event Food Quotations (Bills Out)
              </h2>
              <span
                style={{
                  background: "#c5a059",
                  color: "#2b0b14",
                  fontSize: "11px",
                  fontWeight: 800,
                  padding: "2px 8px",
                  borderRadius: "10px",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                }}
              >
                Royal Catering Style
              </span>
            </div>
            <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "#f3e8d6", opacity: 0.9 }}>
              Create, customize, and print high-class vintage catering food quotation bills with custom items, weights & save-the-date
            </p>
          </div>
        </div>

        <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => {
              setDraft(JSON.parse(JSON.stringify(DEFAULT_SHADI_MAHAL_SAMPLE)));
              setInputDate("2026-11-14");
              setIsEditorOpen(true);
            }}
            style={{
              background: "rgba(255, 255, 255, 0.12)",
              color: "#f5e6ca",
              border: "1px solid rgba(197, 160, 89, 0.5)",
              padding: "10px 16px",
              borderRadius: "8px",
              fontWeight: 700,
              fontSize: "13px",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              cursor: "pointer",
            }}
            title="Load default Shadi Mahal 1500 Guests template"
          >
            <span>📜</span> Load Shadi Mahal Sample
          </button>

          <button
            type="button"
            onClick={handleOpenNew}
            style={{
              background: "linear-gradient(135deg, #d4af37 0%, #aa822a 100%)",
              color: "#2b0b14",
              border: "none",
              padding: "10px 20px",
              borderRadius: "8px",
              fontWeight: 800,
              fontSize: "13.5px",
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              boxShadow: "0 4px 14px rgba(212, 175, 55, 0.4)",
              cursor: "pointer",
            }}
          >
            <span style={{ fontSize: "16px", fontWeight: 900 }}>+</span> Create New Food Quotation
          </button>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div
        className="no-print"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "12px",
          marginBottom: "20px",
        }}
      >
        <div style={{ position: "relative", minWidth: "280px", flex: 1, maxWidth: "450px" }}>
          <input
            type="text"
            placeholder="Search by client, quotation #, venue, or date..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: "100%",
              padding: "10px 14px 10px 38px",
              borderRadius: "10px",
              border: "1px solid #e2d9cc",
              background: "#ffffff",
              fontSize: "13.5px",
              color: "#2b0b14",
              outline: "none",
            }}
          />
          <span
            style={{
              position: "absolute",
              left: "12px",
              top: "50%",
              transform: "translateY(-50%)",
              fontSize: "16px",
              color: "#8a6b2d",
            }}
          >
            🔍
          </span>
        </div>

        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <span style={{ fontSize: "13px", color: "#666", fontWeight: 600 }}>
            Showing <b>{filteredQuotations.length}</b> quotation bills
          </span>
        </div>
      </div>

      {/* Quotation Cards Grid */}
      <div className="no-print">
        {loading ? (
          <div style={{ padding: "40px", textAlign: "center", color: "#666" }}>
            <p>Loading food quotations & bills...</p>
          </div>
        ) : filteredQuotations.length === 0 ? (
          <div
            style={{
              padding: "48px 24px",
              textAlign: "center",
              background: "#ffffff",
              borderRadius: "16px",
              border: "1px dashed #d5ba7f",
            }}
          >
            <div style={{ fontSize: "40px", marginBottom: "12px" }}>📜</div>
            <h3 style={{ margin: "0 0 8px 0", color: "#2b0b14" }}>No Food Quotations Found</h3>
            <p style={{ margin: "0 0 20px 0", color: "#666", fontSize: "14px" }}>
              Click below to create your first event food quotation bill.
            </p>
            <button
              type="button"
              onClick={handleOpenNew}
              style={{
                background: "#6b1d25",
                color: "#ffffff",
                border: "none",
                padding: "10px 22px",
                borderRadius: "8px",
                fontWeight: 700,
                fontSize: "13.5px",
                cursor: "pointer",
              }}
            >
              + Create Quotation Now
            </button>
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
              gap: "20px",
            }}
          >
            {filteredQuotations.map((q, idx) => (
              <div
                key={q.id || idx}
                style={{
                  background: "#ffffff",
                  borderRadius: "14px",
                  border: "1px solid #e8dec8",
                  boxShadow: "0 4px 16px rgba(107, 29, 37, 0.06)",
                  display: "flex",
                  flexDirection: "column",
                  overflow: "hidden",
                  transition: "transform 0.15s ease, box-shadow 0.15s ease",
                }}
              >
                {/* Card Top Banner */}
                <div
                  style={{
                    background: "linear-gradient(135deg, #3d0c15 0%, #601420 100%)",
                    color: "#ffffff",
                    padding: "14px 18px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                  }}
                >
                  <div>
                    <span
                      style={{
                        fontSize: "11px",
                        fontWeight: 700,
                        letterSpacing: "0.5px",
                        color: "#e6ca85",
                        textTransform: "uppercase",
                      }}
                    >
                      {q.quotation_no}
                    </span>
                    <h3
                      style={{
                        margin: "4px 0 0 0",
                        fontSize: "17px",
                        fontWeight: 800,
                        color: "#ffffff",
                      }}
                    >
                      {q.client_name || "Untitled Client"}
                    </h3>
                  </div>

                  <span
                    style={{
                      background: "rgba(197, 160, 89, 0.25)",
                      border: "1px solid #c5a059",
                      color: "#f5e6ca",
                      fontSize: "11.5px",
                      fontWeight: 700,
                      padding: "4px 8px",
                      borderRadius: "6px",
                      whiteSpace: "nowrap",
                    }}
                  >
                    📅 {q.date}
                  </span>
                </div>

                {/* Card Body */}
                <div style={{ padding: "16px 18px", flex: 1 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "14px" }}>
                    <div>
                      <small style={{ color: "#777", fontSize: "11px", display: "block" }}>VENUE</small>
                      <b style={{ color: "#222", fontSize: "13px" }}>{q.venue || "—"}</b>
                    </div>
                    <div>
                      <small style={{ color: "#777", fontSize: "11px", display: "block" }}>GUESTS</small>
                      <b style={{ color: "#222", fontSize: "13px" }}>{q.guest_count} Guests</b>
                    </div>
                  </div>

                  <div
                    style={{
                      background: "#faf7f0",
                      borderRadius: "8px",
                      padding: "10px 12px",
                      border: "1px solid #ebdcc5",
                      marginBottom: "14px",
                    }}
                  >
                    <small style={{ color: "#8a6b2d", fontWeight: 700, fontSize: "11px", display: "block" }}>
                      MENU SECTIONS ({q.categories.length})
                    </small>
                    <span style={{ fontSize: "12px", color: "#444", marginTop: "2px", display: "block" }}>
                      {q.categories.map((c) => c.category).join(" • ").substring(0, 75)}
                      {q.categories.map((c) => c.category).join(" • ").length > 75 ? "..." : ""}
                    </span>
                  </div>

                  {q.total_amount && (
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: "12px", color: "#666", fontWeight: 600 }}>Total Quoted:</span>
                      <strong style={{ fontSize: "15px", color: "#6b1d25" }}>
                        ₹ {Number(q.total_amount).toLocaleString("en-IN")}
                      </strong>
                    </div>
                  )}
                </div>

                {/* Card Actions */}
                <div
                  style={{
                    padding: "12px 18px",
                    background: "#fbf9f4",
                    borderTop: "1px solid #ebdcc5",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <div style={{ display: "flex", gap: "6px" }}>
                    <button
                      type="button"
                      onClick={() => handleOpenPrintPreview(q)}
                      style={{
                        background: "#6b1d25",
                        color: "#ffffff",
                        border: "none",
                        padding: "7px 14px",
                        borderRadius: "6px",
                        fontSize: "12px",
                        fontWeight: 700,
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                      }}
                      title="View & Print Bill Out"
                    >
                      🖨️ View & Print
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOpenEdit(q)}
                      style={{
                        background: "#f0ebe1",
                        color: "#4a121c",
                        border: "1px solid #c5a059",
                        padding: "7px 12px",
                        borderRadius: "6px",
                        fontSize: "12px",
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                      title="Edit Items & Date"
                    >
                      ✏️ Edit
                    </button>
                  </div>

                  <div style={{ display: "flex", gap: "4px" }}>
                    <button
                      type="button"
                      onClick={() => handleShareWhatsApp(q)}
                      style={{
                        background: "#25D366",
                        color: "#ffffff",
                        border: "none",
                        padding: "7px 10px",
                        borderRadius: "6px",
                        fontSize: "12px",
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                      title="Share to client on WhatsApp"
                    >
                      💬
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDuplicate(q)}
                      style={{
                        background: "#ffffff",
                        color: "#666",
                        border: "1px solid #ccc",
                        padding: "7px 10px",
                        borderRadius: "6px",
                        fontSize: "12px",
                        cursor: "pointer",
                      }}
                      title="Duplicate this quotation"
                    >
                      📋
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeleteQuotation(q)}
                      style={{
                        background: "#fff1f2",
                        color: "#be123c",
                        border: "1px solid #fecdd3",
                        padding: "7px 10px",
                        borderRadius: "6px",
                        fontSize: "12px",
                        cursor: "pointer",
                      }}
                      title="Delete quotation"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ============================================================
          INTERACTIVE BUILDER / EDITOR MODAL ("Add Items & Save Date")
      ============================================================ */}
      {isEditorOpen && (
        <div
          className="no-print"
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(20, 5, 8, 0.75)",
            backdropFilter: "blur(6px)",
            zIndex: 99999,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            padding: "16px",
            overflowY: "auto",
          }}
          onClick={() => setIsEditorOpen(false)}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: "16px",
              width: "100%",
              maxWidth: "960px",
              maxHeight: "92vh",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 25px 60px rgba(0,0,0,0.5)",
              overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: "16px 24px",
                background: "linear-gradient(135deg, #3d0c15 0%, #601420 100%)",
                color: "#ffffff",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                borderBottom: "1px solid rgba(197, 160, 89, 0.4)",
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 800 }}>
                  {draft.id ? "Edit Food Quotation Bill" : "Create New Food Quotation Bill"}
                </h3>
                <span style={{ fontSize: "12px", color: "#e6ca85" }}>
                  Add / customize menu items, quantities, portions, categories, and save the event date
                </span>
              </div>

              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <button
                  type="button"
                  onClick={() => setIsLivePreviewOpen(true)}
                  style={{
                    background: "rgba(255, 255, 255, 0.15)",
                    border: "1px solid #c5a059",
                    color: "#f5e6ca",
                    padding: "6px 14px",
                    borderRadius: "6px",
                    fontSize: "12.5px",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  👁️ Live Preview
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditorOpen(false)}
                  style={{
                    background: "rgba(255, 255, 255, 0.2)",
                    border: "none",
                    color: "#fff",
                    borderRadius: "50%",
                    width: "32px",
                    height: "32px",
                    fontSize: "16px",
                    cursor: "pointer",
                    display: "grid",
                    placeItems: "center",
                  }}
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Modal Body / Scrollable Form */}
            <div
              style={{
                padding: "24px",
                overflowY: "auto",
                flex: 1,
                background: "#faf8f5",
              }}
            >
              {/* Event Auto-Fill Helper if events exist */}
              {eventList.length > 0 && (
                <div
                  style={{
                    background: "#f4ede0",
                    border: "1px solid #d5ba7f",
                    borderRadius: "10px",
                    padding: "12px 16px",
                    marginBottom: "20px",
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    flexWrap: "wrap",
                  }}
                >
                  <span style={{ fontSize: "13px", fontWeight: 700, color: "#6b1d25" }}>
                    ⚡ Load From Existing Event:
                  </span>
                  <select
                    style={{
                      flex: 1,
                      minWidth: "220px",
                      padding: "8px 12px",
                      borderRadius: "6px",
                      border: "1px solid #c5a059",
                      background: "#fff",
                      fontSize: "13px",
                    }}
                    defaultValue=""
                    onChange={(e) => e.target.value && handleImportEvent(e.target.value)}
                  >
                    <option value="" disabled>
                      Select an event to auto-fill details...
                    </option>
                    {eventList.map((ev) => (
                      <option key={ev.id} value={ev.id}>
                        #{ev.id} - {ev.customer_name || ev.client_name || "Customer"} | {ev.event_type} | {ev.place} (
                        {ev.date})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* SECTION 1: HEADER & EVENT DETAILS */}
              <div
                style={{
                  background: "#ffffff",
                  borderRadius: "12px",
                  padding: "18px 20px",
                  border: "1px solid #e5dac6",
                  marginBottom: "24px",
                }}
              >
                <h4 style={{ margin: "0 0 14px 0", fontSize: "14px", fontWeight: 800, color: "#6b1d25" }}>
                  1. Quotation & Event Header Details
                </h4>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                    gap: "14px",
                  }}
                >
                  {/* Date & Save the Date */}
                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#555", marginBottom: "4px" }}>
                      📅 Event Date (Save the Date) *
                    </label>
                    <div style={{ display: "flex", gap: "6px" }}>
                      <input
                        type="date"
                        value={inputDate}
                        onChange={(e) => {
                          setInputDate(e.target.value);
                          setDraft((prev) => ({
                            ...prev,
                            date: formatDisplayDate(e.target.value),
                          }));
                        }}
                        style={{
                          flex: 1,
                          padding: "8px 10px",
                          borderRadius: "6px",
                          border: "1px solid #ccc",
                          fontSize: "13px",
                        }}
                      />
                    </div>
                    <small style={{ fontSize: "11px", color: "#8a6b2d", marginTop: "3px", display: "block" }}>
                      Displays as: <b>{draft.date}</b>
                    </small>
                  </div>

                  {/* Quotation No */}
                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#555", marginBottom: "4px" }}>
                      Quotation No
                    </label>
                    <input
                      type="text"
                      value={draft.quotation_no}
                      onChange={(e) => setDraft((prev) => ({ ...prev, quotation_no: e.target.value }))}
                      placeholder="e.g. FC-QT-2026-001"
                      style={{
                        width: "100%",
                        padding: "8px 10px",
                        borderRadius: "6px",
                        border: "1px solid #ccc",
                        fontSize: "13px",
                      }}
                    />
                  </div>

                  {/* Client Name */}
                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#555", marginBottom: "4px" }}>
                      Client Name *
                    </label>
                    <input
                      type="text"
                      value={draft.client_name}
                      onChange={(e) => setDraft((prev) => ({ ...prev, client_name: e.target.value }))}
                      placeholder="e.g. Shadi Mahal / Mr. Rahman"
                      style={{
                        width: "100%",
                        padding: "8px 10px",
                        borderRadius: "6px",
                        border: "1px solid #ccc",
                        fontSize: "13px",
                      }}
                    />
                  </div>

                  {/* Venue */}
                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#555", marginBottom: "4px" }}>
                      Venue *
                    </label>
                    <input
                      type="text"
                      value={draft.venue}
                      onChange={(e) => setDraft((prev) => ({ ...prev, venue: e.target.value }))}
                      placeholder="e.g. Shadi Mahal Convention Center"
                      style={{
                        width: "100%",
                        padding: "8px 10px",
                        borderRadius: "6px",
                        border: "1px solid #ccc",
                        fontSize: "13px",
                      }}
                    />
                  </div>

                  {/* Event Title */}
                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#555", marginBottom: "4px" }}>
                      Event Type / Title
                    </label>
                    <input
                      type="text"
                      value={draft.event_name}
                      onChange={(e) => setDraft((prev) => ({ ...prev, event_name: e.target.value }))}
                      placeholder="e.g. 1500 Guests / Wedding Reception"
                      style={{
                        width: "100%",
                        padding: "8px 10px",
                        borderRadius: "6px",
                        border: "1px solid #ccc",
                        fontSize: "13px",
                      }}
                    />
                  </div>

                  {/* Guest Count */}
                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#555", marginBottom: "4px" }}>
                      No. of Guests
                    </label>
                    <input
                      type="number"
                      value={draft.guest_count}
                      onChange={(e) => setDraft((prev) => ({ ...prev, guest_count: Number(e.target.value) }))}
                      placeholder="1500"
                      style={{
                        width: "100%",
                        padding: "8px 10px",
                        borderRadius: "6px",
                        border: "1px solid #ccc",
                        fontSize: "13px",
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 2: MENU ITEMS BY CATEGORY */}
              <div
                style={{
                  background: "#ffffff",
                  borderRadius: "12px",
                  padding: "18px 20px",
                  border: "1px solid #e5dac6",
                  marginBottom: "24px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "16px",
                    flexWrap: "wrap",
                    gap: "8px",
                  }}
                >
                  <div>
                    <h4 style={{ margin: 0, fontSize: "14px", fontWeight: 800, color: "#6b1d25" }}>
                      2. Menu Categories & Items List
                    </h4>
                    <span style={{ fontSize: "12px", color: "#666" }}>
                      Add items, enter quantities/weights (e.g. "60 kg", "180 kg", "150 pcs", "-"), and price
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddCategory}
                    style={{
                      background: "#fdf8ee",
                      border: "1px solid #c5a059",
                      color: "#6b1d25",
                      padding: "6px 14px",
                      borderRadius: "6px",
                      fontSize: "12.5px",
                      fontWeight: 700,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    + Add New Category
                  </button>
                </div>

                {/* Categories Accordions / Blocks */}
                {draft.categories.map((cat, catIdx) => (
                  <div
                    key={cat.id || catIdx}
                    style={{
                      border: "1px solid #ebdcc5",
                      borderRadius: "8px",
                      marginBottom: "16px",
                      overflow: "hidden",
                    }}
                  >
                    {/* Category Title Bar */}
                    <div
                      style={{
                        background: "#6b1d25",
                        color: "#ffffff",
                        padding: "8px 14px",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <input
                        type="text"
                        value={cat.category}
                        onChange={(e) => {
                          const val = e.target.value;
                          setDraft((prev) => ({
                            ...prev,
                            categories: prev.categories.map((c) =>
                              c.id === cat.id ? { ...c, category: val.toUpperCase() } : c
                            ),
                          }));
                        }}
                        style={{
                          background: "transparent",
                          border: "none",
                          color: "#ffffff",
                          fontWeight: 800,
                          fontSize: "13px",
                          letterSpacing: "0.5px",
                          width: "70%",
                          outline: "none",
                        }}
                      />

                      <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                        <span style={{ fontSize: "11px", color: "#e6ca85" }}>{cat.items.length} items</span>
                        <button
                          type="button"
                          onClick={() => handleAddItem(cat.id)}
                          style={{
                            background: "rgba(255, 255, 255, 0.2)",
                            color: "#fff",
                            border: "none",
                            borderRadius: "4px",
                            padding: "3px 8px",
                            fontSize: "11px",
                            fontWeight: 700,
                            cursor: "pointer",
                          }}
                        >
                          + Add Item
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveCategory(cat.id)}
                          style={{
                            background: "rgba(255, 255, 255, 0.15)",
                            color: "#fca5a5",
                            border: "none",
                            borderRadius: "4px",
                            padding: "3px 6px",
                            fontSize: "11px",
                            cursor: "pointer",
                          }}
                          title="Delete category"
                        >
                          ✕
                        </button>
                      </div>
                    </div>

                    {/* Items Table for this Category */}
                    <div style={{ padding: "10px 14px", background: "#fdfbf7" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12.5px" }}>
                        <thead>
                          <tr style={{ color: "#777", textAlign: "left", borderBottom: "1px solid #ebdcc5" }}>
                            <th style={{ padding: "6px 8px", width: "40%" }}>ITEM NAME</th>
                            <th style={{ padding: "6px 8px", width: "35%" }}>QUANTITY / WEIGHT / PORTION</th>
                            <th style={{ padding: "6px 8px", width: "15%" }}>PRICE (₹)</th>
                            <th style={{ padding: "6px 8px", width: "10%", textAlign: "center" }}>ACTION</th>
                          </tr>
                        </thead>
                        <tbody>
                          {cat.items.map((item, itemIdx) => (
                            <tr key={item.id || itemIdx} style={{ borderBottom: "1px solid #f3ece0" }}>
                              <td style={{ padding: "6px 8px" }}>
                                <input
                                  type="text"
                                  value={item.name}
                                  onChange={(e) => handleUpdateItem(cat.id, item.id, "name", e.target.value)}
                                  placeholder="e.g. Ghee rice / Chicken curry"
                                  style={{
                                    width: "100%",
                                    padding: "6px 8px",
                                    borderRadius: "4px",
                                    border: "1px solid #d5c8b5",
                                    fontSize: "12.5px",
                                  }}
                                />
                              </td>
                              <td style={{ padding: "6px 8px" }}>
                                <input
                                  type="text"
                                  value={item.quantity}
                                  onChange={(e) => handleUpdateItem(cat.id, item.id, "quantity", e.target.value)}
                                  placeholder="e.g. 60 kg / 180 kg / 150 pcs / -"
                                  style={{
                                    width: "100%",
                                    padding: "6px 8px",
                                    borderRadius: "4px",
                                    border: "1px solid #d5c8b5",
                                    fontSize: "12.5px",
                                  }}
                                />
                              </td>
                              <td style={{ padding: "6px 8px" }}>
                                <input
                                  type="text"
                                  value={item.price}
                                  onChange={(e) => handleUpdateItem(cat.id, item.id, "price", e.target.value)}
                                  placeholder="-"
                                  style={{
                                    width: "100%",
                                    padding: "6px 8px",
                                    borderRadius: "4px",
                                    border: "1px solid #d5c8b5",
                                    fontSize: "12.5px",
                                  }}
                                />
                              </td>
                              <td style={{ padding: "6px 8px", textAlign: "center" }}>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveItem(cat.id, item.id)}
                                  style={{
                                    background: "#fee2e2",
                                    border: "none",
                                    color: "#b91c1c",
                                    borderRadius: "4px",
                                    padding: "4px 8px",
                                    cursor: "pointer",
                                    fontSize: "11px",
                                  }}
                                  title="Remove item"
                                >
                                  ✕
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>

                      <div style={{ marginTop: "8px", textAlign: "right" }}>
                        <button
                          type="button"
                          onClick={() => handleAddItem(cat.id)}
                          style={{
                            background: "transparent",
                            border: "1px dashed #c5a059",
                            color: "#6b1d25",
                            borderRadius: "4px",
                            padding: "4px 10px",
                            fontSize: "11.5px",
                            fontWeight: 700,
                            cursor: "pointer",
                          }}
                        >
                          + Add Item to {cat.category}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* SECTION 3: TOTAL & FOOTER */}
              <div
                style={{
                  background: "#ffffff",
                  borderRadius: "12px",
                  padding: "18px 20px",
                  border: "1px solid #e5dac6",
                }}
              >
                <h4 style={{ margin: "0 0 14px 0", fontSize: "14px", fontWeight: 800, color: "#6b1d25" }}>
                  3. Total Amount & Terms
                </h4>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "14px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#555", marginBottom: "4px" }}>
                      Total Amount (₹) (Leave blank or "-" for quotation)
                    </label>
                    <input
                      type="text"
                      value={draft.total_amount ?? ""}
                      onChange={(e) => setDraft((prev) => ({ ...prev, total_amount: e.target.value }))}
                      placeholder="e.g. 275000 or -"
                      style={{
                        width: "100%",
                        padding: "8px 10px",
                        borderRadius: "6px",
                        border: "1px solid #ccc",
                        fontSize: "13px",
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#555", marginBottom: "4px" }}>
                      Terms & Conditions Note
                    </label>
                    <input
                      type="text"
                      value={draft.terms}
                      onChange={(e) => setDraft((prev) => ({ ...prev, terms: e.target.value }))}
                      placeholder="Prices are subject to final guest count."
                      style={{
                        width: "100%",
                        padding: "8px 10px",
                        borderRadius: "6px",
                        border: "1px solid #ccc",
                        fontSize: "13px",
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer Controls */}
            <div
              style={{
                padding: "14px 24px",
                background: "#ffffff",
                borderTop: "1px solid #e5dac6",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <button
                type="button"
                onClick={() => setIsEditorOpen(false)}
                style={{
                  background: "#f0ebe1",
                  border: "none",
                  padding: "10px 18px",
                  borderRadius: "8px",
                  fontWeight: 600,
                  fontSize: "13px",
                  color: "#555",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>

              <div style={{ display: "flex", gap: "10px" }}>
                <button
                  type="button"
                  onClick={handleSaveQuotation}
                  disabled={saving}
                  style={{
                    background: "linear-gradient(135deg, #6b1d25 0%, #4a121c 100%)",
                    color: "#ffffff",
                    border: "none",
                    padding: "10px 24px",
                    borderRadius: "8px",
                    fontWeight: 800,
                    fontSize: "13.5px",
                    cursor: "pointer",
                    boxShadow: "0 4px 14px rgba(107, 29, 37, 0.35)",
                  }}
                >
                  {saving ? "Saving to Database..." : "💾 Save Food Quotation"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================
          LIVE PREVIEW & PRINT MODAL (Exact Royal Golden & Maroon Style)
      ============================================================ */}
      {(isLivePreviewOpen || activeQuotation) && (
        <div
          className="quotation-print-overlay"
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(18, 5, 8, 0.82)",
            backdropFilter: "blur(8px)",
            zIndex: 99999,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            padding: "12px",
            overflowY: "auto",
          }}
          onClick={() => {
            setIsLivePreviewOpen(false);
            setActiveQuotation(null);
          }}
        >
          <div
            className="quotation-print-dialog"
            style={{
              background: "#1c080d",
              borderRadius: "16px",
              width: "100%",
              maxWidth: "880px",
              maxHeight: "96vh",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 30px 70px rgba(0,0,0,0.6)",
              overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Screen Action Bar (Hidden on Print) */}
            <div
              className="no-print"
              style={{
                padding: "12px 20px",
                background: "linear-gradient(135deg, #2b0b14 0%, #4a121c 100%)",
                color: "#ffffff",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "10px",
                borderBottom: "1px solid rgba(197, 160, 89, 0.3)",
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 800 }}>
                  Event Food Quotation — {activeQuotation?.quotation_no || draft.quotation_no}
                </h3>
                <span style={{ fontSize: "11.5px", color: "#e6ca85" }}>
                  Official Print & PDF Format • Formatted for 1-Page A4
                </span>
              </div>

              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <button
                  type="button"
                  onClick={() => handleShareWhatsApp(activeQuotation || draft)}
                  style={{
                    background: "#25D366",
                    color: "#ffffff",
                    border: "none",
                    padding: "7px 14px",
                    borderRadius: "7px",
                    fontWeight: 700,
                    fontSize: "12px",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "5px",
                    cursor: "pointer",
                  }}
                >
                  <span>💬</span> WhatsApp
                </button>

                <button
                  type="button"
                  onClick={triggerPrint}
                  style={{
                    background: "linear-gradient(135deg, #d4af37 0%, #aa822a 100%)",
                    color: "#2b0b14",
                    border: "none",
                    padding: "7px 18px",
                    borderRadius: "7px",
                    fontWeight: 800,
                    fontSize: "12.5px",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    boxShadow: "0 3px 12px rgba(212, 175, 55, 0.4)",
                    cursor: "pointer",
                  }}
                >
                  🖨️ Print / Save as PDF
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsLivePreviewOpen(false);
                    setActiveQuotation(null);
                  }}
                  style={{
                    background: "rgba(255, 255, 255, 0.15)",
                    border: "none",
                    color: "#ffffff",
                    borderRadius: "50%",
                    width: "30px",
                    height: "30px",
                    cursor: "pointer",
                    fontSize: "15px",
                    display: "grid",
                    placeItems: "center",
                  }}
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Scrollable Printable Container */}
            <div
              style={{
                padding: "20px 16px",
                overflowY: "auto",
                flex: 1,
                background: "#230a10",
                display: "flex",
                justifyContent: "center",
              }}
            >
              {/* THE VINTAGE ROYAL A4 QUOTATION CARD */}
              <PrintableCateringQuotation quotation={activeQuotation || draft} />
            </div>
          </div>
        </div>
      )}

      {/* Global Print Styles for Perfect 1-Page A4 Printing */}
      <style jsx global>{`
        @media print {
          @page {
            size: A4 portrait !important;
            margin: 4mm 6mm !important;
          }
          html,
          body {
            background: #ffffff !important;
            color: #1a080c !important;
            margin: 0 !important;
            padding: 0 !important;
            height: auto !important;
            overflow: visible !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .no-print,
          .topbar,
          .sidebar,
          .mobile-menu-button,
          .dashboard-header {
            display: none !important;
          }
          .food-quotations-section {
            padding: 0 !important;
            margin: 0 !important;
          }
          .quotation-print-overlay {
            position: static !important;
            background: transparent !important;
            padding: 0 !important;
            overflow: visible !important;
          }
          .quotation-print-dialog {
            background: transparent !important;
            box-shadow: none !important;
            max-width: 100% !important;
            border-radius: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .royal-quotation-card {
            box-shadow: none !important;
            border-radius: 0 !important;
            margin: 0 auto !important;
            width: 100% !important;
            max-width: 100% !important;
            page-break-inside: avoid !important;
          }
        }
      `}</style>
    </div>
  );
}

// ============================================================
// THE EXACT ROYAL CATERING QUOTATION A4 COMPONENT
// Matching user's uploaded reference image
// ============================================================
function PrintableCateringQuotation({ quotation }: { quotation: FoodQuotation }) {
  const q = quotation;

  return (
    <div
      id="printable-quotation-bill"
      className="royal-quotation-card"
      style={{
        width: "100%",
        maxWidth: "790px",
        background: "#FAF7EE", // Royal cream / parchment
        borderRadius: "12px",
        boxShadow: "0 8px 30px rgba(0, 0, 0, 0.2)",
        position: "relative",
        padding: "16px 20px 14px 20px",
        color: "#1A080C",
        fontFamily: "'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
        boxSizing: "border-box",
      }}
    >
      {/* Outer Double Vintage Border */}
      <div
        style={{
          position: "absolute",
          top: "8px",
          left: "8px",
          right: "8px",
          bottom: "8px",
          border: "2px solid #8A6B2D",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: "12px",
          left: "12px",
          right: "12px",
          bottom: "12px",
          border: "1px solid #C5A059",
          pointerEvents: "none",
        }}
      />

      {/* Four Filigree Corner Ornaments */}
      <div style={{ position: "absolute", top: "10px", left: "10px", pointerEvents: "none" }}>
        <GoldCorner />
      </div>
      <div style={{ position: "absolute", top: "10px", right: "10px", pointerEvents: "none" }}>
        <GoldCorner flipX />
      </div>
      <div style={{ position: "absolute", bottom: "10px", left: "10px", pointerEvents: "none" }}>
        <GoldCorner flipY />
      </div>
      <div style={{ position: "absolute", bottom: "10px", right: "10px", pointerEvents: "none" }}>
        <GoldCorner flipX flipY />
      </div>

      {/* ============================================================
          HEADER: LOGO BADGE (Left) | EVENT FOOD QUOTATION (Center) | META (Right)
      ============================================================ */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "12px",
          position: "relative",
          zIndex: 1,
          padding: "4px 8px",
        }}
      >
        {/* Left: Chef Hat Medallion Logo */}
        <div style={{ display: "flex", alignItems: "center", width: "230px" }}>
          <div
            style={{
              width: "105px",
              height: "105px",
              borderRadius: "50%",
              background: "#181415",
              border: "3px solid #D4AF37",
              boxShadow: "0 0 0 2px #8A6B2D, 0 4px 10px rgba(0,0,0,0.3)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
              padding: "4px",
              color: "#ffffff",
              flexShrink: 0,
            }}
          >
            <ChefHatIcon />
            <span
              style={{
                fontFamily: "'Playfair Display', Georgia, cursive, serif",
                fontSize: "14px",
                fontWeight: 900,
                color: "#F7E7B4",
                marginTop: "1px",
                lineHeight: 1,
              }}
            >
              Food Court
            </span>
            <span
              style={{
                fontSize: "6.5px",
                fontWeight: 800,
                letterSpacing: "0.5px",
                color: "#D4AF37",
                marginTop: "2px",
                lineHeight: 1,
              }}
            >
              CATERING & EVENT PLANNERS
            </span>
            <span
              style={{
                fontSize: "7.5px",
                fontWeight: 700,
                color: "#ffffff",
                marginTop: "2px",
                lineHeight: 1,
              }}
            >
              📞 {q.phone || "+91 8592991909"}
            </span>
            <span
              style={{
                fontSize: "5.5px",
                fontWeight: 600,
                color: "#E2D3B3",
                marginTop: "1.5px",
                lineHeight: 1,
              }}
            >
              {q.location_tag || "BASED IN ATHAHAKKAD - KOTTAMELAD"}
            </span>
            <span
              style={{
                fontSize: "5.5px",
                fontWeight: 700,
                color: "#F7E7B4",
                marginTop: "1px",
                lineHeight: 1,
              }}
            >
              {q.coverage_tag || "TRAVEL ALL OVER TN"} 📍
            </span>
          </div>
        </div>

        {/* Center: EVENT FOOD QUOTATION with Ornamental Dividers */}
        <div style={{ textAlign: "center", flex: 1, padding: "0 6px" }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: "2px" }}>
            <GoldFlourishHeader />
          </div>

          <h2
            style={{
              margin: 0,
              fontSize: "19px",
              fontWeight: 800,
              letterSpacing: "3px",
              color: "#251214",
              fontFamily: "'Playfair Display', Georgia, serif",
              lineHeight: 1.1,
            }}
          >
            EVENT FOOD
          </h2>

          <h1
            style={{
              margin: "1px 0",
              fontSize: "36px",
              fontWeight: 900,
              letterSpacing: "1.5px",
              color: "#5A121B", // Regal Maroon / Burgundy
              fontFamily: "'Playfair Display', Georgia, serif",
              lineHeight: 1,
              textTransform: "uppercase",
              textShadow: "1px 1px 0px rgba(197, 160, 89, 0.4)",
            }}
          >
            QUOTATION
          </h1>

          <div
            style={{
              fontSize: "10.5px",
              fontWeight: 700,
              letterSpacing: "3px",
              color: "#4A181C",
              marginTop: "2px",
              textTransform: "uppercase",
            }}
          >
            PREMIUM CATERING SERVICES
          </div>

          <div style={{ display: "flex", justifyContent: "center", marginTop: "3px" }}>
            <GoldFlourishHeader />
          </div>
        </div>

        {/* Right: Quotation No & Date */}
        <div style={{ width: "210px", textAlign: "right", fontSize: "13px", fontWeight: 700 }}>
          <div style={{ marginBottom: "6px" }}>
            <span style={{ color: "#333" }}>Quotation No : </span>
            <span
              style={{
                color: "#5A121B",
                fontWeight: 800,
                borderBottom: "1px solid #777",
                paddingBottom: "1px",
                minWidth: "75px",
                display: "inline-block",
                textAlign: "center",
              }}
            >
              {q.quotation_no || "_______"}
            </span>
          </div>
          <div>
            <span style={{ color: "#333" }}>Date : </span>
            <span
              style={{
                color: "#5A121B",
                fontWeight: 800,
                borderBottom: "1px solid #777",
                paddingBottom: "1px",
                minWidth: "95px",
                display: "inline-block",
                textAlign: "center",
              }}
            >
              {q.date || "14 - Nov - 2026"}
            </span>
          </div>
        </div>
      </div>

      {/* ============================================================
          CLIENT & EVENT DETAILS BOX
      ============================================================ */}
      <div
        style={{
          border: "1.5px solid #CCA665",
          borderRadius: "8px",
          background: "#F5F0E4",
          padding: "8px 16px",
          marginBottom: "12px",
          position: "relative",
          zIndex: 1,
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "12px",
          fontSize: "13px",
        }}
      >
        {/* Left Column */}
        <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
          <div style={{ display: "flex" }}>
            <span style={{ width: "115px", fontWeight: 700, color: "#2B0B14" }}>Client Name</span>
            <span style={{ marginRight: "10px" }}>:</span>
            <b style={{ color: "#111", fontWeight: 800 }}>{q.client_name || "—"}</b>
          </div>
          <div style={{ display: "flex" }}>
            <span style={{ width: "115px", fontWeight: 700, color: "#2B0B14" }}>Event</span>
            <span style={{ marginRight: "10px" }}>:</span>
            <span style={{ color: "#111", fontWeight: 700 }}>{q.event_name || `${q.guest_count} Guests`}</span>
          </div>
        </div>

        {/* Right Column */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "5px",
            borderLeft: "1px solid #D5C29A",
            paddingLeft: "16px",
          }}
        >
          <div style={{ display: "flex" }}>
            <span style={{ width: "105px", fontWeight: 700, color: "#2B0B14" }}>Venue</span>
            <span style={{ marginRight: "10px" }}>:</span>
            <b style={{ color: "#111", fontWeight: 800 }}>{q.venue || "—"}</b>
          </div>
          <div style={{ display: "flex" }}>
            <span style={{ width: "105px", fontWeight: 700, color: "#2B0B14" }}>No. of Guests</span>
            <span style={{ marginRight: "10px" }}>:</span>
            <b style={{ color: "#111", fontWeight: 800 }}>{q.guest_count}</b>
          </div>
        </div>
      </div>

      {/* ============================================================
          MENU ITEMS & PRICING TABLE (Maroon & Ivory)
      ============================================================ */}
      <div
        style={{
          border: "1.5px solid #5A121B",
          position: "relative",
          zIndex: 1,
          marginBottom: "12px",
          background: "#FAF7EE",
        }}
      >
        {/* Main Header Bar */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 140px",
            background: "#5A121B",
            color: "#ffffff",
            fontWeight: 800,
            fontSize: "13.5px",
            letterSpacing: "1px",
            textAlign: "center",
          }}
        >
          <div
            style={{
              padding: "7px 14px",
              textAlign: "center",
              borderRight: "1.5px solid rgba(255, 255, 255, 0.4)",
            }}
          >
            MENU ITEM
          </div>
          <div style={{ padding: "7px 10px" }}>PRICE (₹)</div>
        </div>

        {/* Category Rows and Items */}
        {q.categories.map((cat, catIdx) => {
          const isTwoColumn = cat.layout === "two-column" || cat.category.includes("SETTING");
          const half = Math.ceil(cat.items.length / 2);
          const col1Items = isTwoColumn ? cat.items.slice(0, half) : cat.items;
          const col2Items = isTwoColumn ? cat.items.slice(half) : [];

          return (
            <div key={cat.id || catIdx} style={{ borderBottom: "1px solid #5A121B" }}>
              {/* Category Header Banner */}
              <div
                style={{
                  background: "#5A121B",
                  color: "#ffffff",
                  padding: "4px 14px",
                  fontWeight: 800,
                  fontSize: "12px",
                  letterSpacing: "1px",
                  textTransform: "uppercase",
                }}
              >
                {cat.category}
              </div>

              {/* Items Row with Price column on the right */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 140px" }}>
                {/* Left Side: Items */}
                <div
                  style={{
                    padding: "7px 14px",
                    borderRight: "1.5px solid #5A121B",
                    fontSize: "12px",
                  }}
                >
                  {isTwoColumn ? (
                    /* Two-column layout (e.g. for Setting & Others) */
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                        {col1Items.map((item, idx) => (
                          <div
                            key={item.id || idx}
                            style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
                          >
                            <span style={{ fontWeight: 600 }}>
                              • {item.name}
                            </span>
                            <span style={{ color: "#333", fontSize: "11px", fontWeight: 700 }}>
                              {item.quantity && item.quantity !== "-" ? item.quantity : ""}
                            </span>
                          </div>
                        ))}
                      </div>

                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "3px",
                          borderLeft: "1px dashed #D5BA7F",
                          paddingLeft: "10px",
                        }}
                      >
                        {col2Items.map((item, idx) => (
                          <div
                            key={item.id || idx}
                            style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
                          >
                            <span style={{ fontWeight: 600 }}>
                              • {item.name}
                            </span>
                            <span style={{ color: "#333", fontSize: "11px", fontWeight: 700 }}>
                              {item.quantity && item.quantity !== "-" ? item.quantity : ""}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    /* Single-column standard list with right-aligned weights/portions */
                    <div style={{ display: "flex", flexDirection: "column", gap: "3.5px" }}>
                      {cat.items.map((item, idx) => (
                        <div
                          key={item.id || idx}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                          }}
                        >
                          <span style={{ fontWeight: 600 }}>
                            • {item.name}
                          </span>
                          <span
                            style={{
                              fontWeight: 700,
                              color: "#1A080C",
                              fontSize: "11.5px",
                              textAlign: "right",
                            }}
                          >
                            {item.quantity || "-"}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Right Side: Price Column (Blank, hyphen, or specific item price) */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "6px",
                    fontWeight: 700,
                    fontSize: "12px",
                    color: "#333",
                  }}
                >
                  -
                </div>
              </div>
            </div>
          );
        })}

        {/* TOTAL AMOUNT ROW */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 140px",
            background: "#5A121B",
            color: "#ffffff",
            fontWeight: 800,
            fontSize: "13px",
            letterSpacing: "1px",
          }}
        >
          <div
            style={{
              padding: "6px 14px",
              textAlign: "center",
              borderRight: "1.5px solid rgba(255, 255, 255, 0.4)",
            }}
          >
            TOTAL AMOUNT
          </div>
          <div style={{ padding: "6px 10px", textAlign: "center" }}>
            {q.total_amount ? `₹ ${Number(q.total_amount).toLocaleString("en-IN")}` : "-"}
          </div>
        </div>
      </div>

      {/* ============================================================
          TERMS & SIGNATURE FOOTER
      ============================================================ */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.2fr 1fr",
          gap: "16px",
          position: "relative",
          zIndex: 1,
          padding: "6px 8px 4px 8px",
          fontSize: "11.5px",
        }}
      >
        {/* Left: Terms & Conditions */}
        <div style={{ borderRight: "1px solid #D5BA7F", paddingRight: "16px" }}>
          <div style={{ fontWeight: 800, color: "#5A121B", marginBottom: "4px", fontSize: "11.5px" }}>
            TERMS & CONDITIONS
          </div>
          <div style={{ width: "120px", height: "1px", background: "#CCA665", marginBottom: "6px" }} />
          <ul style={{ margin: 0, paddingLeft: "16px", color: "#333", lineHeight: 1.4 }}>
            <li>{q.terms || "Prices are subject to final guest count."}</li>
          </ul>
        </div>

        {/* Right: Signatures */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            paddingLeft: "10px",
            gap: "14px",
          }}
        >
          <div>
            <div
              style={{
                borderBottom: "1px solid #777",
                width: "100%",
                height: "14px",
                marginBottom: "3px",
              }}
            />
            <div style={{ textAlign: "center", fontSize: "11px", fontWeight: 700, color: "#444" }}>
              Customer Signature
            </div>
          </div>

          <div>
            <div
              style={{
                borderBottom: "1px solid #777",
                width: "100%",
                height: "14px",
                marginBottom: "3px",
              }}
            />
            <div style={{ textAlign: "center", fontSize: "11px", fontWeight: 700, color: "#444" }}>
              Authorized Signature
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================
          CENTER CALLIGRAPHY: "Thank You!" WITH FLOURISH EMBLEM
      ============================================================ */}
      <div
        style={{
          textAlign: "center",
          position: "relative",
          zIndex: 1,
          marginTop: "6px",
          paddingBottom: "2px",
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "12px",
            fontFamily: "'Brush Script MT', 'Great Vibes', 'Playfair Display', cursive, serif",
            fontSize: "26px",
            color: "#5A121B",
            fontWeight: 700,
          }}
        >
          <span style={{ color: "#C5A059", fontSize: "14px" }}>✧ ──</span>
          Thank You!
          <span style={{ color: "#C5A059", fontSize: "14px" }}>── ✧</span>
        </div>

        <div style={{ display: "flex", justifyContent: "center", marginTop: "1px" }}>
          <GoldFlourishFooter />
        </div>
      </div>
    </div>
  );
}
