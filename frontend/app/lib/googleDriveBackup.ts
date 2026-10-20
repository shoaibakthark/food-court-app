"use client";

import * as XLSX from "xlsx";

const API_URL = typeof window !== "undefined" ? "/api/py" : "http://127.0.0.1:8000";

export type DriveBackupRecord = {
  id: string;
  fileName: string;
  backupDate: string;
  driveLink: string;
  totalRecords: number;
};

// Default Google OAuth Client ID placeholder (can be overridden by user in settings)
export const DEFAULT_GOOGLE_CLIENT_ID = "YOUR_GOOGLE_CLIENT_ID_HERE.apps.googleusercontent.com";

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

// 1. Dynamically load Google Identity Services client
export function loadGoogleIdentityScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") return resolve();
    if ((window as any).google?.accounts?.oauth2) {
      return resolve();
    }
    const existingScript = document.getElementById("google-gsi-script");
    if (existingScript) {
      existingScript.addEventListener("load", () => resolve());
      existingScript.addEventListener("error", (e) => reject(e));
      return;
    }
    const script = document.createElement("script");
    script.id = "google-gsi-script";
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = (err) => reject(new Error("Failed to load Google Identity Services: " + err));
    document.body.appendChild(script);
  });
}

// 2. Request OAuth Access Token from user
export async function requestGoogleDriveToken(clientId: string): Promise<string> {
  await loadGoogleIdentityScript();

  return new Promise((resolve, reject) => {
    if (!(window as any).google?.accounts?.oauth2) {
      return reject(new Error("Google Identity SDK not initialized. Please refresh and try again."));
    }

    try {
      const tokenClient = (window as any).google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: "https://www.googleapis.com/auth/drive.file",
        callback: (response: any) => {
          if (response.error !== undefined) {
            return reject(new Error(response.error_description || response.error || "Google authorization failed."));
          }
          if (response.access_token) {
            resolve(response.access_token);
          } else {
            reject(new Error("No access token returned from Google authentication."));
          }
        },
      });

      tokenClient.requestAccessToken({ prompt: "consent" });
    } catch (err: any) {
      reject(err);
    }
  });
}

// 3. Compile all 11 database collections into an Excel Workbook Blob
export async function generateExcelBackupBlob(): Promise<{ blob: Blob; fileName: string; totalRecords: number }> {
  const [
    eventsRes,
    customersRes,
    paymentsRes,
    expensesRes,
    settlementsRes,
    staffRes,
    staffPaymentsRes,
    kitchenStaffRes,
    kitchenDutiesRes,
    kitchenPaymentsRes,
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
    fetch(`${API_URL}/kitchen/staff`).then((r) => (r.ok ? r.json() : [])).catch(() => []),
    fetch(`${API_URL}/kitchen/duties`).then((r) => (r.ok ? r.json() : [])).catch(() => []),
    fetch(`${API_URL}/kitchen/payments`).then((r) => (r.ok ? r.json() : [])).catch(() => []),
    fetch(`${API_URL}/food-items`).then((r) => (r.ok ? r.json() : [])).catch(() => []),
    fetch(`${API_URL}/decor-items`).then((r) => (r.ok ? r.json() : [])).catch(() => []),
  ]);

  const wb = XLSX.utils.book_new();
  let totalRecords = 0;

  // 1. Events & Billing
  const eventsList = Array.isArray(eventsRes) ? eventsRes : [];
  totalRecords += eventsList.length;
  const formattedEvents = eventsList.map((e: any) => {
    const quote = Number(e.quote ?? e.total_estimate ?? 0);
    const paid = Number(e.paid_amount ?? 0);
    const bal = Number(e.balance ?? Math.max(0, quote - paid));
    const status = bal <= 0 && quote > 0 ? "PAID IN FULL" : paid > 0 && bal > 0 ? "PARTIALLY PAID" : "PAYMENT DUE";

    return {
      "Invoice / Event ID": `INV-2026-${String(e.id).padStart(5, "0")}`,
      "Event Date": formatDate(e.date),
      "Client Name": e.customer_name || "—",
      "Client Mobile": e.customer_mobile || "—",
      "Event Occasion": e.event_type || "—",
      "Venue Location": e.place || "—",
      "Guaranteed Guests (Pax)": Number(e.guest_count) || 0,
      "Food Amount (₹)": Number(e.food_amt) || 0,
      "Decor Amount (₹)": Number(e.decor_amt) || 0,
      "Estimated Total (₹)": Number(e.total_estimate) || 0,
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

  // 2. Payments Received
  const paymentsList = Array.isArray(paymentsRes) ? paymentsRes : [];
  totalRecords += paymentsList.length;
  const formattedPayments = paymentsList.map((p: any) => ({
    "Receipt ID": `#PAY-${String(p.id).padStart(5, "0")}`,
    "Payment Date": formatDate(p.payment_date),
    "Linked Event ID": p.event_id ? `EVT-${String(p.event_id).padStart(5, "0")}` : "—",
    "Client Name": p.customer_name || "—",
    "Amount Paid (₹)": Number(p.amount) || 0,
    "Payment Method": p.payment_method || "—",
    "Payment Category": p.payment_type || "—",
    "Reference / Note": p.note || "—",
  }));
  if (formattedPayments.length > 0) {
    const ws = XLSX.utils.json_to_sheet(formattedPayments);
    ws["!cols"] = autoFitColumns(formattedPayments);
    XLSX.utils.book_append_sheet(wb, ws, "Payments Received");
  }

  // 3. Expenses Ledger
  const expensesList = Array.isArray(expensesRes) ? expensesRes : [];
  totalRecords += expensesList.length;
  const formattedExpenses = expensesList.map((exp: any) => ({
    "Expense ID": `#EXP-${String(exp.id).padStart(5, "0")}`,
    "Expense Date": formatDate(exp.expense_date),
    "Payee / Title": exp.title || "—",
    "Expense Category": exp.category || "General",
    "Amount (₹)": Number(exp.amount) || 0,
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

  // 4. Expense Settlements
  const settlementsList = Array.isArray(settlementsRes) ? settlementsRes : [];
  totalRecords += settlementsList.length;
  const formattedSettlements = settlementsList.map((s: any) => ({
    "Settlement ID": `#SETTLE-${String(s.id).padStart(5, "0")}`,
    "Settlement Date": formatDate(s.settlement_date || s.created_at),
    "Category / Payee": s.category || s.vendor || "—",
    "Amount Cleared (₹)": Number(s.amount) || 0,
    "Payment Mode": s.payment_method || "—",
    "Remarks / Notes": s.note || "—",
  }));
  if (formattedSettlements.length > 0) {
    const ws = XLSX.utils.json_to_sheet(formattedSettlements);
    ws["!cols"] = autoFitColumns(formattedSettlements);
    XLSX.utils.book_append_sheet(wb, ws, "Expense Settlements");
  }

  // 5. Kitchen Staff Directory
  const kitchenStaffList = Array.isArray(kitchenStaffRes) ? kitchenStaffRes : [];
  totalRecords += kitchenStaffList.length;
  const formattedKitchenStaff = kitchenStaffList.map((ks: any) => ({
    "Kitchen Staff ID": `#KS-${String(ks.id).padStart(4, "0")}`,
    "Staff Name": ks.name || "—",
    "Mobile Phone": ks.mobile || "—",
    "Kitchen Designation / Role": ks.kitchen_role || "Kitchen Staff",
    "Wage Frequency": ks.wage_type === "monthly" ? "Monthly Salary" : "Daily Wage",
    "Wage Rate (₹)": Number(ks.wage_rate) || 0,
    "Total Duties Logged": Number(ks.duties_count) || 0,
    "Total Wages Earned (₹)": Number(ks.total_wages) || 0,
    "Total Paid to Date (₹)": Number(ks.total_paid) || 0,
    "Current Pending Balance (₹)": Number(ks.balance) || 0,
    "Employment Status": (ks.status || "active").toUpperCase(),
    "Date Joined": formatDate(ks.joined_date),
    "Address": ks.address || "—",
    "Notes / Comments": ks.notes || "—",
  }));
  if (formattedKitchenStaff.length > 0) {
    const ws = XLSX.utils.json_to_sheet(formattedKitchenStaff);
    ws["!cols"] = autoFitColumns(formattedKitchenStaff);
    XLSX.utils.book_append_sheet(wb, ws, "Kitchen Staff");
  }

  // 6. Kitchen Daily Duties
  const kitchenDutiesList = Array.isArray(kitchenDutiesRes) ? kitchenDutiesRes : [];
  totalRecords += kitchenDutiesList.length;
  const formattedKitchenDuties = kitchenDutiesList.map((kd: any) => ({
    "Duty Record ID": `#KDUTY-${String(kd.id).padStart(5, "0")}`,
    "Duty Date": formatDate(kd.duty_date),
    "Staff Name": kd.staff_name || "—",
    "Kitchen Role": kd.kitchen_role || "—",
    "Shift Assigned": kd.shift || "Full Day",
    "Attendance Status": (kd.duty_status || "present").toUpperCase(),
    "Duty Units": Number(kd.duty_units) || 1,
    "Daily Rate (₹)": Number(kd.daily_rate) || 0,
    "Duty Wage (₹)": Number(kd.duty_wage) || 0,
    "Bonus Added (₹)": Number(kd.bonus) || 0,
    "Deduction (₹)": Number(kd.deduction) || 0,
    "Total Day Wage (₹)": Number(kd.total_wage) || 0,
    "Paid Same Day?": kd.paid_today ? "YES" : "NO",
    "Same-Day Paid Amount (₹)": Number(kd.paid_amount) || 0,
    "Payment Mode": kd.payment_mode || "Cash",
    "Duty Remarks": kd.note || "—",
  }));
  if (formattedKitchenDuties.length > 0) {
    const ws = XLSX.utils.json_to_sheet(formattedKitchenDuties);
    ws["!cols"] = autoFitColumns(formattedKitchenDuties);
    XLSX.utils.book_append_sheet(wb, ws, "Kitchen Duties");
  }

  // 7. Kitchen Payments
  const kitchenPaymentsList = Array.isArray(kitchenPaymentsRes) ? kitchenPaymentsRes : [];
  totalRecords += kitchenPaymentsList.length;
  const formattedKitchenPayments = kitchenPaymentsList.map((kp: any) => ({
    "Kitchen Payment ID": `#KPAY-${String(kp.id).padStart(5, "0")}`,
    "Payout Date": formatDate(kp.payment_date),
    "Staff Name": kp.staff_name || "—",
    "Amount Paid (₹)": Number(kp.amount) || 0,
    "Payment Mode": kp.payment_mode || "Cash",
    "Reference #": kp.reference_no || "—",
    "Purpose / Note": kp.note || "Wage Settlement",
  }));
  if (formattedKitchenPayments.length > 0) {
    const ws = XLSX.utils.json_to_sheet(formattedKitchenPayments);
    ws["!cols"] = autoFitColumns(formattedKitchenPayments);
    XLSX.utils.book_append_sheet(wb, ws, "Kitchen Payments");
  }

  // 8. Event Operations Staff Directory
  const staffList = Array.isArray(staffRes) ? staffRes : [];
  totalRecords += staffList.length;
  const formattedStaff = staffList.map((st: any) => ({
    "Staff ID": `#STF-${String(st.id).padStart(5, "0")}`,
    "Staff Name": st.name || "—",
    "Designation / Role": st.role || "—",
    "Phone Number": st.phone || "—",
    "Daily Wage Rate (₹)": Number(st.daily_wage || st.salary) || 0,
    "Employment Status": (st.status || "Active").toUpperCase(),
  }));
  if (formattedStaff.length > 0) {
    const ws = XLSX.utils.json_to_sheet(formattedStaff);
    ws["!cols"] = autoFitColumns(formattedStaff);
    XLSX.utils.book_append_sheet(wb, ws, "Event Staff");
  }

  // 9. Customers Directory
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

  // 10. Food Menu Catalog
  const foodList = Array.isArray(foodItemsRes) ? foodItemsRes : [];
  totalRecords += foodList.length;
  const formattedFood = foodList.map((f: any) => ({
    "Menu Item ID": `#FOOD-${String(f.id).padStart(5, "0")}`,
    "Item Name": f.name || "—",
    "Course / Category": f.category || "—",
    "Rate / Price (₹)": Number(f.rate || f.price) || 0,
    "Description": f.description || "—",
  }));
  if (formattedFood.length > 0) {
    const ws = XLSX.utils.json_to_sheet(formattedFood);
    ws["!cols"] = autoFitColumns(formattedFood);
    XLSX.utils.book_append_sheet(wb, ws, "Food Menu Catalog");
  }

  // 11. Decor Inventory
  const decorList = Array.isArray(decorItemsRes) ? decorItemsRes : [];
  totalRecords += decorList.length;
  const formattedDecor = decorList.map((d: any) => ({
    "Decor Item ID": `#DECOR-${String(d.id).padStart(5, "0")}`,
    "Item Name": d.name || "—",
    "Category": d.category || "—",
    "Rental Price (₹)": Number(d.price || d.rate) || 0,
    "Status": d.status || "Available",
  }));
  if (formattedDecor.length > 0) {
    const ws = XLSX.utils.json_to_sheet(formattedDecor);
    ws["!cols"] = autoFitColumns(formattedDecor);
    XLSX.utils.book_append_sheet(wb, ws, "Decor Inventory");
  }

  const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([wbout], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const dateSlug = new Date().toISOString().slice(0, 10);
  const fileName = `FoodCourt_Complete_Database_Backup_${dateSlug}.xlsx`;

  return { blob, fileName, totalRecords };
}

// 4. Locate or create a dedicated "Food Court Cloud Backups" folder in Google Drive
async function getOrCreateDriveFolder(accessToken: string, folderName = "Food Court Cloud Backups"): Promise<string> {
  // Check if folder already exists
  const query = encodeURIComponent(`name = '${folderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`);
  const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (searchRes.ok) {
    const data = await searchRes.json();
    if (data.files && data.files.length > 0) {
      return data.files[0].id;
    }
  }

  // Create folder if not found
  const createRes = await fetch("https://www.googleapis.com/drive/v3/files", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: folderName,
      mimeType: "application/vnd.google-apps.folder",
    }),
  });

  if (!createRes.ok) {
    throw new Error("Unable to create folder in Google Drive: " + createRes.statusText);
  }

  const created = await createRes.json();
  return created.id;
}

// 5. Upload Excel file to Google Drive using Multipart Upload
async function uploadToDrive(
  accessToken: string,
  folderId: string,
  fileBlob: Blob,
  fileName: string
): Promise<{ fileId: string; webViewLink: string }> {
  const boundary = "-------FoodCourtDriveBoundary" + Math.random().toString(36).substring(2);
  const delimiter = "\r\n--" + boundary + "\r\n";
  const closeDelimiter = "\r\n--" + boundary + "--";

  const metadata = {
    name: fileName,
    parents: [folderId],
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  };

  const fileArrayBuffer = await fileBlob.arrayBuffer();

  // Construct multipart body
  const metaHeader = delimiter + "Content-Type: application/json; charset=UTF-8\r\n\r\n" + JSON.stringify(metadata) + delimiter;
  const fileHeader = "Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet\r\n\r\n";

  const metaBlob = new Blob([metaHeader + fileHeader]);
  const closeBlob = new Blob([closeDelimiter]);

  const multipartBlob = new Blob([metaBlob, fileArrayBuffer, closeBlob], {
    type: `multipart/related; boundary=${boundary}`,
  });

  const uploadRes = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: multipartBlob,
    }
  );

  if (!uploadRes.ok) {
    const errText = await uploadRes.text();
    throw new Error(`Google Drive upload failed (${uploadRes.status}): ${errText}`);
  }

  const uploadData = await uploadRes.json();
  return {
    fileId: uploadData.id,
    webViewLink: uploadData.webViewLink || `https://drive.google.com/file/d/${uploadData.id}/view`,
  };
}

// 6. Manage backup history in localStorage
export function getStoredDriveBackups(): DriveBackupRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const saved = localStorage.getItem("fc_gdrive_backups");
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

export function saveDriveBackupRecord(record: DriveBackupRecord) {
  if (typeof window === "undefined") return;
  try {
    const list = getStoredDriveBackups();
    list.unshift(record);
    localStorage.setItem("fc_gdrive_backups", JSON.stringify(list.slice(0, 20))); // Keep last 20 backups
  } catch {
    // ignore
  }
}

// 7. Full Google Drive backup execution
export async function executeGoogleDriveBackup(
  clientId: string,
  onProgress?: (msg: string) => void
): Promise<{
  success: boolean;
  fileName?: string;
  driveLink?: string;
  totalRecords?: number;
  error?: string;
}> {
  try {
    if (!clientId || clientId.trim() === "" || clientId.includes("YOUR_GOOGLE_CLIENT_ID")) {
      throw new Error(
        "Google OAuth Client ID is required. Please provide your Google Cloud Console Client ID to connect Google Drive."
      );
    }

    if (onProgress) onProgress("Compiling complete database into Excel format...");
    const { blob, fileName, totalRecords } = await generateExcelBackupBlob();

    if (onProgress) onProgress("Connecting to Google Account...");
    const accessToken = await requestGoogleDriveToken(clientId.trim());

    if (onProgress) onProgress("Accessing 'Food Court Cloud Backups' folder in Drive...");
    const folderId = await getOrCreateDriveFolder(accessToken);

    if (onProgress) onProgress("Uploading Excel backup (.xlsx) to Google Drive...");
    const { fileId, webViewLink } = await uploadToDrive(accessToken, folderId, blob, fileName);

    const record: DriveBackupRecord = {
      id: fileId,
      fileName,
      backupDate: new Date().toISOString(),
      driveLink: webViewLink,
      totalRecords,
    };
    saveDriveBackupRecord(record);

    return {
      success: true,
      fileName,
      driveLink: webViewLink,
      totalRecords,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Failed to backup to Google Drive",
    };
  }
}
