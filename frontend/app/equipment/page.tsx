"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "../lib/auth";
import { SidebarUserCard, OwnerBanner, NavLink, TopbarUserBadge, AppSidebar, MobileMenuButton } from "../components/AuthBar";

type EquipmentItem = {
  id: number;
  name: string;
  category: string;
  quantity: number;
  condition: "Good" | "Needs Service" | "In Use";
  location: string;
};

const SAMPLE_EQUIPMENT: EquipmentItem[] = [
  { id: 1, name: "Chafing Dishes (Stainless Steel)", category: "Catering", quantity: 24, condition: "Good", location: "Store Room A" },
  { id: 2, name: "Buffet Warmers & Fuel Holders", category: "Catering", quantity: 30, condition: "Good", location: "Store Room A" },
  { id: 3, name: "Industrial Gas Burners (2-Ring)", category: "Kitchen", quantity: 8, condition: "Good", location: "Kitchen Bay 1" },
  { id: 4, name: "Heavy Cooking Cauldrons (Biryani Chembu)", category: "Kitchen", quantity: 6, condition: "Good", location: "Kitchen Bay 2" },
  { id: 5, name: "Round Banquet Tables (6ft)", category: "Furniture", quantity: 45, condition: "Good", location: "Warehouse 1" },
  { id: 6, name: "Cushioned Banquet Chairs", category: "Furniture", quantity: 350, condition: "Good", location: "Warehouse 1" },
  { id: 7, name: "LED Par Stage Lights (RGBW)", category: "Lighting & Audio", quantity: 16, condition: "Good", location: "Electronics Rack" },
  { id: 8, name: "PA Speaker System & Cordless Mics", category: "Lighting & Audio", quantity: 4, condition: "In Use", location: "AV Kit" },
  { id: 9, name: "Commercial Ice Cooler Boxes (100L)", category: "Catering", quantity: 10, condition: "Good", location: "Store Room B" },
  { id: 10, name: "Stainless Steel Serving Spoons & Cutlery Set", category: "Catering", quantity: 120, condition: "Good", location: "Store Room A" },
];

export default function EquipmentPage() {
  const { user, isOwner, isManager } = useAuth();
  const [equipmentList, setEquipmentList] = useState<EquipmentItem[]>(SAMPLE_EQUIPMENT);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");

  const categories = ["All", "Catering", "Kitchen", "Furniture", "Lighting & Audio"];

  const filteredItems = equipmentList.filter((item) => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.location.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === "All" || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <main className="dashboard">
      <AppSidebar activeRoute="/equipment" />

      {/* Main Content */}
      <div className="main-content">
        {/* Topbar */}
        <header className="topbar">
          <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            <MobileMenuButton />
            <h1 style={{ margin: 0, fontSize: "19px", fontWeight: 700, color: "#24103f" }}>
              Equipment & Asset Management
            </h1>
            <span style={{ fontSize: "12px", color: "#6b5b7e", background: "#f0edf5", padding: "4px 10px", borderRadius: "12px", fontWeight: 600 }}>
              {equipmentList.length} Asset Types
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            <div className="search-box">
              <span style={{ color: "#8a7b9b" }}>🔍</span>
              <input
                type="text"
                placeholder="Search equipment or location..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ border: "none", background: "transparent", outline: "none", width: "100%", fontSize: "13px" }}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  style={{ border: "none", background: "transparent", color: "#8a7b9b", cursor: "pointer", fontSize: "14px" }}
                >
                  ✕
                </button>
              )}
            </div>

            {!isOwner && (
              <button
                type="button"
                onClick={() => alert("Asset registration modal will be available in the upcoming inventory release.")}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  background: "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "8px",
                  padding: "8px 14px",
                  fontWeight: 700,
                  fontSize: "12px",
                  cursor: "pointer",
                  boxShadow: "0 4px 14px rgba(124, 58, 237, 0.35)",
                }}
              >
                <span>+</span> Add Equipment
              </button>
            )}

            <TopbarUserBadge />
          </div>
        </header>

        {/* Content Body */}
        <div className="page-content">
          <OwnerBanner />

          {/* Category Tabs */}
          <div style={{ display: "flex", gap: "8px", marginBottom: "24px", overflowX: "auto", paddingBottom: "4px" }}>
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                style={{
                  padding: "8px 16px",
                  borderRadius: "20px",
                  border: selectedCategory === cat ? "1px solid #7c3aed" : "1px solid #e2d9ec",
                  background: selectedCategory === cat ? "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)" : "#ffffff",
                  color: selectedCategory === cat ? "#ffffff" : "#4a3b60",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Table */}
          <div className="dashboard-panel" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", minWidth: "650px", borderCollapse: "collapse", textAlign: "left", fontSize: "13px" }}>
              <thead>
                <tr style={{ background: "#f8f5fb", borderBottom: "1px solid #ece5f3", color: "#6b5b7e" }}>
                  <th style={{ padding: "14px 20px", fontWeight: 600 }}>Equipment Item</th>
                  <th style={{ padding: "14px 20px", fontWeight: 600 }}>Category</th>
                  <th style={{ padding: "14px 20px", fontWeight: 600 }}>Quantity</th>
                  <th style={{ padding: "14px 20px", fontWeight: 600 }}>Status</th>
                  <th style={{ padding: "14px 20px", fontWeight: 600 }}>Storage Location</th>
                  <th style={{ padding: "14px 20px", fontWeight: 600, textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => (
                  <tr key={item.id} style={{ borderBottom: "1px solid #f2ecf8" }}>
                    <td style={{ padding: "14px 20px", fontWeight: 600, color: "#24103f" }}>
                      {item.name}
                    </td>
                    <td style={{ padding: "14px 20px", color: "#6b5b7e" }}>
                      {item.category}
                    </td>
                    <td style={{ padding: "14px 20px", fontWeight: 700, color: "#24103f" }}>
                      {item.quantity} units
                    </td>
                    <td style={{ padding: "14px 20px" }}>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "4px 10px",
                          borderRadius: "12px",
                          fontSize: "11px",
                          fontWeight: 700,
                          background: item.condition === "Good" ? "#e8f8f0" : item.condition === "In Use" ? "#eef2ff" : "#fef3c7",
                          color: item.condition === "Good" ? "#0d6832" : item.condition === "In Use" ? "#3730a3" : "#92400e",
                        }}
                      >
                        {item.condition}
                      </span>
                    </td>
                    <td style={{ padding: "14px 20px", color: "#6b5b7e" }}>
                      📍 {item.location}
                    </td>
                    <td style={{ padding: "14px 20px", textAlign: "right" }}>
                      {isOwner ? (
                        <span style={{ fontSize: "12px", color: "#8a7b9b" }}>Read-only</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => alert(`Edit asset #${item.id}`)}
                          style={{
                            background: "transparent",
                            border: "1px solid #dcd3e7",
                            color: "#4a3b60",
                            padding: "4px 10px",
                            borderRadius: "6px",
                            fontSize: "12px",
                            fontWeight: 600,
                            cursor: "pointer",
                          }}
                        >
                          ✎ Details
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}