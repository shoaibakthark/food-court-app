"use client";

import * as XLSX from "xlsx";

const API_URL = typeof window !== "undefined" ? "/api/py" : "http://127.0.0.1:8000";

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function autoFitColumns(rows: any[]): Array<{ wch: number }> {
  if (!rows || rows.length === 0) return [];
  const keys = Object.keys(rows[0]);
  return keys.map((key) => {
    let maxLen = key.length;
    rows.forEach((row) => {
      const val = row[key] !== null && row[key] !== undefined ? String(row[key]) : "";
      if (val.length > maxLen) {
        maxLen = val.length;
      }
    });
    return { wch: Math.min(Math.max(maxLen + 3, 10), 45) };
  });
}

export async function exportEntireDatabaseToExcel(
  onProgress?: (msg: string) => void
): Promise<{ success: boolean; totalRecords: number; error?: string }> {
  try {
    if (onProgress) onProgress("Fetching database records from server...");

    const [
      eventsRes,
      customersRes,
      paymentsRes,
      expensesRes,
      settlementsRes,
      staffRes,
      staffPaymentsRes,
      foodItemsRes,
      decorItemsRes,
    ] = await Promise.all([
      fetch(`${API_URL}/events`).then((r) => (r.ok ? r.json() : [])).catch(() => []),
      fetch(`${API_URL}/customers`).then((r) => (r.ok ? r.json() : [])).catch(() => []),
      fetch(`${API_URL}/payments`).then((r) => (r.ok ? r.json() : [])).catch(() => []),
      fetch(`${API_URL}/expenses`).then((r) => (r.ok ? r.json() : [])).catch(() => []),
      fetch(`${API_URL}/expenses/settlements`).then((r) => (r.ok ? r.json() : [])).catch(() => []),
      fetch(`${API_URL}/staff`).then((r) => (r.ok ? r.json() : [])).catch(() => []),
      fetch(`${API_URL}/staff-payments`).then((r) => (r.ok ? r.json() : [])).catch(() => []),
      fetch(`${API_URL}/food-items`).then((r) => (r.ok ? r.json() : [])).catch(() => []),
      fetch(`${API_URL}/decor-items`).then((r) => (r.ok ? r.json() : [])).catch(() => []),
    ]);

    if (onProgress) onProgress("Compiling Excel workbook sheets...");

    const wb = XLSX.utils.book_new();
    let totalRecords = 0;

    // 1. Events & Billing Sheet
    const eventsList = Array.isArray(eventsRes) ? eventsRes : [];
    totalRecords += eventsList.length;
    const formattedEvents = eventsList.map((e: any) => {
      const quote = e.quote ?? e.total_estimate ?? 0;
      const paid = e.paid_amount ?? 0;
      const bal = e.balance ?? Math.max(0, quote - paid);
      const status = bal <= 0 && quote > 0 ? "PAID IN FULL" : paid > 0 && bal > 0 ? "PARTIALLY PAID" : "PAYMENT DUE";

      return {
        "Invoice / Event ID": `INV-2026-${String(e.id).padStart(5, "0")}`,
        "Event Date": formatDate(e.date),
        "Client Name": e.customer_name || "—",
        "Client Mobile": e.customer_mobile || "—",
        "Event Occasion": e.event_type || "—",
        "Venue Location": e.place || "—",
        "Guaranteed Guests (Pax)": e.guest_count || 0,
        "Food Amount (₹)": e.food_amt || 0,
        "Decor Amount (₹)": e.decor_amt || 0,
        "Estimated Total (₹)": e.total_estimate || 0,
        "Agreed Quote (₹)": quote,
        "Amount Paid (₹)": paid,
        "Balance Due (₹)": bal,
        "Payment Status": status,
      };
    });
    if (formattedEvents.length > 0) {
      const ws = XLSX.utils.json_to_sheet(formattedEvents);
      ws["!cols"] = autoFitColumns(formattedEvents);
      XLSX.utils.book_append_sheet(wb, ws, "Events & Billing");
    }

    // 2. Payments Received Sheet
    const paymentsList = Array.isArray(paymentsRes) ? paymentsRes : [];
    totalRecords += paymentsList.length;
    const formattedPayments = paymentsList.map((p: any) => ({
      "Receipt ID": `#PAY-${String(p.id).padStart(5, "0")}`,
      "Payment Date": formatDate(p.payment_date),
      "Linked Event ID": p.event_id ? `EVT-${String(p.event_id).padStart(5, "0")}` : "—",
      "Client Name": p.customer_name || "—",
      "Amount Paid (₹)": p.amount || 0,
      "Payment Method": p.payment_method || "—",
      "Payment Category": p.payment_type || "—",
      "Reference / Note": p.note || "—",
    }));
    if (formattedPayments.length > 0) {
      const ws = XLSX.utils.json_to_sheet(formattedPayments);
      ws["!cols"] = autoFitColumns(formattedPayments);
      XLSX.utils.book_append_sheet(wb, ws, "Payments Received");
    }

    // 3. Expenses Ledger Sheet
    const expensesList = Array.isArray(expensesRes) ? expensesRes : [];
    totalRecords += expensesList.length;
    const formattedExpenses = expensesList.map((exp: any) => ({
      "Expense ID": `#EXP-${String(exp.id).padStart(5, "0")}`,
      "Expense Date": formatDate(exp.expense_date),
      "Payee / Title": exp.title || "—",
      "Expense Category": exp.category || "General",
      "Amount (₹)": exp.amount || 0,
      "Payment Method": exp.payment_method || "Cash",
      "Vendor / Supplier": exp.vendor || "—",
      "Linked Event": exp.event_id ? `EVT-${String(exp.event_id).padStart(5, "0")}` : "General Overhead",
      "Description": exp.description || "—",
    }));
    if (formattedExpenses.length > 0) {
      const ws = XLSX.utils.json_to_sheet(formattedExpenses);
      ws["!cols"] = autoFitColumns(formattedExpenses);
      XLSX.utils.book_append_sheet(wb, ws, "Expenses Ledger");
    }

    // 4. Expense Settlements Sheet
    const settlementsList = Array.isArray(settlementsRes) ? settlementsRes : [];
    totalRecords += settlementsList.length;
    const formattedSettlements = settlementsList.map((s: any) => ({
      "Settlement ID": `#SETTLE-${String(s.id).padStart(5, "0")}`,
      "Settlement Date": formatDate(s.settlement_date || s.created_at),
      "Category / Payee": s.category || s.vendor || "—",
      "Amount Cleared (₹)": s.amount || 0,
      "Payment Mode": s.payment_method || "—",
      "Remarks / Notes": s.note || "—",
    }));
    if (formattedSettlements.length > 0) {
      const ws = XLSX.utils.json_to_sheet(formattedSettlements);
      ws["!cols"] = autoFitColumns(formattedSettlements);
      XLSX.utils.book_append_sheet(wb, ws, "Expense Settlements");
    }

    // 5. Customers Directory Sheet
    const customersList = Array.isArray(customersRes) ? customersRes : [];
    totalRecords += customersList.length;
    const formattedCustomers = customersList.map((c: any) => ({
      "Customer ID": `#CUST-${String(c.id).padStart(5, "0")}`,
      "Client Full Name": c.name || "—",
      "Mobile Phone": c.phone || c.mobile || "—",
      "Primary Address / City": c.place || c.address || "—",
      "Total Events": c.event_count || "—",
      "Notes": c.notes || "—",
    }));
    if (formattedCustomers.length > 0) {
      const ws = XLSX.utils.json_to_sheet(formattedCustomers);
      ws["!cols"] = autoFitColumns(formattedCustomers);
      XLSX.utils.book_append_sheet(wb, ws, "Customers Directory");
    }

    // 6. Staff Roster & Payments Sheet
    const staffList = Array.isArray(staffRes) ? staffRes : [];
    totalRecords += staffList.length;
    const formattedStaff = staffList.map((st: any) => ({
      "Staff ID": `#STF-${String(st.id).padStart(5, "0")}`,
      "Staff Name": st.name || "—",
      "Designation / Role": st.role || "—",
      "Phone Number": st.phone || "—",
      "Daily Wage Rate (₹)": st.daily_wage || st.salary || 0,
      "Employment Status": st.status || "Active",
    }));
    if (formattedStaff.length > 0) {
      const ws = XLSX.utils.json_to_sheet(formattedStaff);
      ws["!cols"] = autoFitColumns(formattedStaff);
      XLSX.utils.book_append_sheet(wb, ws, "Staff Directory");
    }

    // 7. Food Menu Catalog Sheet
    const foodList = Array.isArray(foodItemsRes) ? foodItemsRes : [];
    totalRecords += foodList.length;
    const formattedFood = foodList.map((f: any) => ({
      "Menu Item ID": `#FOOD-${String(f.id).padStart(5, "0")}`,
      "Item Name": f.name || "—",
      "Course / Category": f.category || "—",
      "Rate / Price (₹)": f.rate || f.price || 0,
      "Description": f.description || "—",
    }));
    if (formattedFood.length > 0) {
      const ws = XLSX.utils.json_to_sheet(formattedFood);
      ws["!cols"] = autoFitColumns(formattedFood);
      XLSX.utils.book_append_sheet(wb, ws, "Food Menu Catalog");
    }

    // 8. Decor Inventory Sheet
    const decorList = Array.isArray(decorItemsRes) ? decorItemsRes : [];
    totalRecords += decorList.length;
    const formattedDecor = decorList.map((d: any) => ({
      "Decor Item ID": `#DECOR-${String(d.id).padStart(5, "0")}`,
      "Item Name": d.name || "—",
      "Category": d.category || "—",
      "Rental Price (₹)": d.price || d.rate || 0,
      "Status": d.status || "Available",
    }));
    if (formattedDecor.length > 0) {
      const ws = XLSX.utils.json_to_sheet(formattedDecor);
      ws["!cols"] = autoFitColumns(formattedDecor);
      XLSX.utils.book_append_sheet(wb, ws, "Decor Inventory");
    }

    // If workbook has no sheets (unlikely), add summary sheet
    if (wb.SheetNames.length === 0) {
      const ws = XLSX.utils.json_to_sheet([{ "Status": "No database records found to export" }]);
      XLSX.utils.book_append_sheet(wb, ws, "Empty Database");
    }

    if (onProgress) onProgress("Downloading Excel backup file...");

    const dateSlug = new Date().toISOString().slice(0, 10);
    const filename = `FoodCourt_Complete_Database_Backup_${dateSlug}.xlsx`;
    XLSX.writeFile(wb, filename);

    return { success: true, totalRecords };
  } catch (err: any) {
    return { success: false, totalRecords: 0, error: err.message || "Failed to generate Excel backup" };
  }
}
