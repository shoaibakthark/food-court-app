"use client";



import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useAuth, authHeaders } from "../../lib/auth";
import { OwnerBanner } from "../../components/AuthBar";



const API = typeof window !== "undefined" ? "/api/py" : "http://127.0.0.1:8000";



const money = (value: number) =>

  new Intl.NumberFormat("en-IN", {

    style: "currency",

    currency: "INR",

    maximumFractionDigits: 2,

  }).format(Number(value || 0));

const formatDateDisplay = (value?: string | null) => {
  if (!value) return "-";
  try {
    const raw = String(value).trim();
    const datePart = raw.includes("T") ? raw.split("T")[0] : raw;
    if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
      const [y, m, d] = datePart.split("-");
      const dt = new Date(Number(y), Number(m) - 1, Number(d));
      return dt.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    }
    return datePart;
  } catch {
    return String(value);
  }
};




type EventRow = {

  id: number;

  date?: string | null;

  guest_count?: number | null;

  food_amt?: number | null;

  decor_amt?: number | null;

  total_estimate?: number | null;

  place?: string | null;

  customer_id?: number | null;

  event_type?: string | null;

  quote?: number | null;

  customer?: { name?: string; mobile?: string } | null;

};



type Item = {
  id: number;

  name: string;

  price?: number | string | null;

  session_id?: number | null;

};



type SubTeam = {
  id: number;
  event_id: number;
  name: string;
  purpose?: string | null;
  phone?: string | null;
  amount?: number | string | null;
  note?: string | null;
  event_name?: string | null;
};

type SavedEventItem = {

  id: number;

  food_item_id?: number;

  decor_item_id?: number;

  name: string;

  quantity: number;

  price: number | string;

  unit_price?: number | string;

  session_id?: number | null;

};



type Person = {

  id: number;

  name: string;

  mobile?: string;

  daily_wage?: number | string | null;

};



type StaffRole = {

  id: number;

  role?: string;

  name?: string;

  wage?: number | string;

  daily_wage?: number | string;

};



type Line = {

  id: number;

  name: string;

  qty: number;

  price: number;

};



type Task = {

  id: string;

  label: string;

  done: boolean;

};



type Payment = {

  id: number | string;

  amount: number;

  payment_method?: string | null;

  payment_type?: string | null;

  payment_date?: string | null;

  note?: string | null;

  date?: string | null;

};



type StaffPaymentItem = {

  id: number;

  event_id: number;

  staff_id: number;

  payment: number | string;

  note?: string | null;

};




type Draft = {

  menu: Line[];

  decor: Line[];

  staff: Record<string, string>;

  tasks: Task[];

  payments: Payment[];

  quote: string;

  search: string;

};



const defaultTasks: Task[] = [

  { id: "menu", label: "Menu confirmed", done: false },

  { id: "decor", label: "Decor confirmed", done: false },

  { id: "staff", label: "Staff assigned", done: false },

  { id: "advance", label: "Advance payment received", done: false },

  { id: "venue", label: "Venue and setup confirmed", done: false },

  { id: "final", label: "Final event check completed", done: false },

];



const blankDraft = (): Draft => ({

  menu: [],

  decor: [],

  staff: {},

  tasks: defaultTasks.map((task) => ({ ...task })),

  payments: [],

  quote: "",

  search: "",

});



async function request<T>(path: string, init?: RequestInit): Promise<T> {

  const response = await fetch(`${API}${path}`, {

    ...init,

    headers: {

      "Content-Type": "application/json",

      ...authHeaders(),

      ...(init?.headers || {}),

    },

    cache: "no-store",

  });



  const text = await response.text();



  if (!response.ok) {

    let message = text || `HTTP ${response.status}`;



    try {

      const parsed = JSON.parse(text);

      message =

        typeof parsed.detail === "string"

          ? parsed.detail

          : JSON.stringify(parsed.detail ?? parsed);

    } catch {

      // Keep the original response text.

    }



    throw new Error(message);

  }



  return (text ? JSON.parse(text) : undefined) as T;

}



export default function EventDetailsPage() {

  const { user, isOwner, isManager } = useAuth();

  const params = useParams<{ id: string }>();

  const router = useRouter();



  const id = String(params.id);

  const storageKey = `fc-event-draft-${id}`;



  const [event, setEvent] = useState<EventRow | null>(null);

  const [food, setFood] = useState<Item[]>([]);

  const [decor, setDecor] = useState<Item[]>([]);

  const [people, setPeople] = useState<Person[]>([]);

  const [staffRoles, setStaffRoles] = useState<StaffRole[]>([]);

  const [rolesLoading, setRolesLoading] = useState(true);

  const [rolesError, setRolesError] = useState("");



  const [draft, setDraft] = useState<Draft>(blankDraft());

  const [tab, setTab] = useState("Overview");



  const [foodPick, setFoodPick] = useState("");

  const [decorPick, setDecorPick] = useState("");

  const [staffPicks, setStaffPicks] = useState<string[]>([]);



  const [loading, setLoading] = useState(true);

  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");

  const [status, setStatus] = useState("");
  const [subTeams, setSubTeams] = useState<SubTeam[]>([]);
  const [subTeamsLoading, setSubTeamsLoading] = useState(false);
  const [subTeamSaving, setSubTeamSaving] = useState(false);
  const [subTeamName, setSubTeamName] = useState("");
  const [subTeamPurpose, setSubTeamPurpose] = useState("");
  const [subTeamPhone, setSubTeamPhone] = useState("");
  const [subTeamAmount, setSubTeamAmount] = useState("");
  const [subTeamNote, setSubTeamNote] = useState("");




  const [payAmount, setPayAmount] = useState("");

  const [payDate, setPayDate] = useState(() => new Date().toISOString().slice(0, 10));

  const [payMethod, setPayMethod] = useState("Cash");

  const [payType, setPayType] = useState("Advance");

  const [payNote, setPayNote] = useState("");

  const [paymentSaving, setPaymentSaving] = useState(false);

  const [deletingPaymentId, setDeletingPaymentId] = useState<number | string | null>(null);

  const [staffPayments, setStaffPayments] = useState<StaffPaymentItem[]>([]);

  const [staffPaymentsLoading, setStaffPaymentsLoading] = useState(false);

  const [staffPayStaffId, setStaffPayStaffId] = useState("");

  const [staffPayAmount, setStaffPayAmount] = useState("");

  const [staffPayNote, setStaffPayNote] = useState("");

  const [staffPaySaving, setStaffPaySaving] = useState(false);

  const [paymentSubTab, setPaymentSubTab] = useState<"client" | "staff">("client");




  // Load event, master items, staff, and saved event items.

  useEffect(() => {

    let active = true;



    async function load() {

      try {

        const [

          eventData,

          foodData,

          decorData,

          staffData,

          savedFoodData,

          savedDecorData,

          serverPaymentsData,

          serverStaffPaymentsData,

          subTeamsData,

          serverAssignedStaff,

        ] = await Promise.all([

          request<EventRow>(`/events/${id}`),

          request<Item[]>("/food-items"),

          request<Item[]>("/decor-items"),

          request<Person[]>("/staff"),

          request<SavedEventItem[]>(`/events/${id}/menu-items`),

          request<SavedEventItem[]>(`/events/${id}/decor-items`),

          request<Payment[]>(`/events/${id}/payments`).catch(() => [] as Payment[]),

          request<StaffPaymentItem[]>("/staff-payments").catch(() => [] as StaffPaymentItem[]),

          request<SubTeam[] | { data?: SubTeam[] }>("/sub-teams").catch(() => [] as SubTeam[]),

          request<any[]>(`/events/${id}/staff`).catch(() => [] as any[]),

        ]);



        if (!active) return;



        setEvent(eventData);

        setFood(Array.isArray(foodData) ? foodData : []);

        setDecor(Array.isArray(decorData) ? decorData : []);

        setPeople(Array.isArray(staffData) ? staffData : []);

        if (Array.isArray(serverStaffPaymentsData)) {
          setStaffPayments(serverStaffPaymentsData.filter((item) => Number(item.event_id) === Number(id)));
        }

        const rawSubTeams = Array.isArray(subTeamsData)
          ? subTeamsData
          : Array.isArray(subTeamsData?.data)
            ? subTeamsData.data
            : [];
        setSubTeams(rawSubTeams.filter((t) => Number(t.event_id) === Number(id)));

        const serverStaffMap: Record<string, string> = {};
        if (Array.isArray(serverAssignedStaff) && serverAssignedStaff.length > 0) {
          serverAssignedStaff.forEach((s: any) => {
            if (s && s.id) {
              serverStaffMap[String(s.id)] = String(s.role_id || "1");
            }
          });
        }



        let saved: Partial<Draft> = {};



        try {

          saved = JSON.parse(localStorage.getItem(storageKey) || "{}");

        } catch {

          saved = {};

        }



        const serverMenu: Line[] = Array.isArray(savedFoodData)

          ? savedFoodData.map((item) => ({

              id: Number(item.food_item_id ?? item.id),

              name: item.name,

              qty: Math.max(1, Number(item.quantity || 1)),

              price: Number(item.unit_price ?? item.price ?? 0),

            }))

          : [];



        const serverDecor: Line[] = Array.isArray(savedDecorData)

          ? savedDecorData.map((item) => ({

              id: Number(item.decor_item_id ?? item.id),

              name: item.name,

              qty: Math.max(1, Number(item.quantity || 1)),

              price: Number(item.unit_price ?? item.price ?? 0),

            }))

          : [];



        const normalizedPayments: Payment[] =
          Array.isArray(serverPaymentsData) && serverPaymentsData.length > 0
            ? serverPaymentsData.map((p) => ({
                id: p.id,
                amount: Number(p.amount || 0),
                payment_method: p.payment_method || "Cash",
                payment_type: p.payment_type || "Advance",
                payment_date: p.payment_date || p.date,
                date: formatDateDisplay(p.payment_date || p.date),
                note: p.note || "",
              }))
            : Array.isArray(saved.payments)
              ? saved.payments.map((p) => ({
                  ...p,
                  amount: Number(p.amount || 0),
                  date: formatDateDisplay(p.payment_date || p.date),
                }))
              : [];

        const hasPaid = normalizedPayments.some((p) => Number(p.amount) > 0);

        const initialTasks = (Array.isArray(saved.tasks) && saved.tasks.length ? saved.tasks : defaultTasks).map(
          (t) => (t.id === "advance" && hasPaid ? { ...t, done: true } : { ...t })
        );



        setDraft({

          ...blankDraft(),

          ...saved,

          menu: serverMenu,

          decor: serverDecor,

          tasks: initialTasks,

          payments: normalizedPayments,

          staff: { ...(saved.staff ?? {}), ...serverStaffMap },

          quote: String(

            eventData.quote ??

              eventData.total_estimate ??

              saved.quote ??

              ""

          ),

          search: saved.search ?? "",

        });




        setError("");

        setStatus("Event data loaded.");

      } catch (err) {

        if (active) {

          setError(

            err instanceof Error ? err.message : "Unable to load event data."

          );

        }

      } finally {

        if (active) setLoading(false);

      }

    }



    load();



    return () => {

      active = false;

    };

  }, [id, storageKey]);



  // Load available staff roles.

  useEffect(() => {

    let active = true;



    async function loadStaffRoles() {

      setRolesLoading(true);

      setRolesError("");



      try {

        const result = await request<

          StaffRole[] | { data?: StaffRole[] }

        >("/staff-roles");



        const rows = Array.isArray(result)

          ? result

          : Array.isArray(result?.data)

            ? result.data

            : [];



        const normalized: StaffRole[] = rows.map((role) => ({

          ...role,

          id: Number(role.id),

          role: String(role.role ?? role.name ?? "Unnamed role"),

          wage: Number(role.wage ?? role.daily_wage ?? 0),

          daily_wage: Number(role.daily_wage ?? role.wage ?? 0),

        }));



        if (active) {

          setStaffRoles(normalized);



          if (!normalized.length) {

            setRolesError("No staff roles were returned by the API.");

          }

        }

      } catch (err) {

        if (active) {

          setRolesError(

            err instanceof Error ? err.message : "Unable to load staff roles."

          );

        }

      } finally {

        if (active) setRolesLoading(false);

      }

    }



    loadStaffRoles();



    return () => {

      active = false;

    };

  }, []);



  // Save the working draft in this browser.

  useEffect(() => {

    if (loading) return;



    try {

      localStorage.setItem(storageKey, JSON.stringify(draft));

    } catch {

      setStatus("Autosave unavailable in this browser.");

    }

  }, [draft, loading, storageKey]);



  const foodTotal = useMemo(

    () => draft.menu.reduce((sum, item) => sum + item.qty * item.price, 0),

    [draft.menu]

  );



  const decorTotal = useMemo(

    () => draft.decor.reduce((sum, item) => sum + item.qty * item.price, 0),

    [draft.decor]

  );



  // Staff selection stores the assigned role ID, not the staff member's wage.

  const staffTotal = useMemo(

    () =>

      Object.values(draft.staff).reduce((sum, roleId) => {

        const role = staffRoles.find((item) => String(item.id) === roleId);

        return sum + Number(role?.wage ?? role?.daily_wage ?? 0);

      }, 0),

    [draft.staff, staffRoles]

  );



  const total = foodTotal + decorTotal + staffTotal;



  const paid = draft.payments.reduce(

    (sum, payment) => sum + Number(payment.amount || 0),

    0

  );



  const quote =

    draft.quote.trim() === ""

      ? total

      : Math.max(0, Number(draft.quote) || 0);



  const balance = Math.max(0, quote - paid);

  const overpaid = Math.max(0, paid - quote);

  const paymentPercentage = quote > 0 ? Math.min(100, Math.round((paid / quote) * 100)) : 0;

  const staffPaymentsTotal = useMemo(
    () => staffPayments.reduce((sum, sp) => sum + Number(sp.payment || 0), 0),
    [staffPayments]
  );

  const staffWagesBalance = Math.max(0, staffTotal - staffPaymentsTotal);

  const subTeamsTotal = useMemo(
    () => subTeams.reduce((sum, st) => sum + Number(st.amount || 0), 0),
    [subTeams]
  );

  const paymentStatus = useMemo(() => {
    if (quote <= 0 && paid <= 0) {
      return { label: "No Quotation", cls: "pillMuted" };
    }
    if (paid <= 0) {
      return { label: "Unpaid", cls: "pillUnpaid" };
    }
    if (paid >= quote && quote > 0) {
      return paid > quote
        ? { label: `Overpaid (${money(paid - quote)})`, cls: "pillOverpaid" }
        : { label: "Paid in full", cls: "pillPaid" };
    }
    return { label: `Partially paid (${paymentPercentage}%)`, cls: "pillPartial" };
  }, [quote, paid, paymentPercentage]);

  const guests = Number(event?.guest_count || 0);




  const completedTasks = draft.tasks.filter((task) => task.done).length;



  const progress = draft.tasks.length

    ? Math.round((completedTasks / draft.tasks.length) * 100)

    : 0;



  function patchDraft(update: Partial<Draft>) {


    setDraft((current) => ({ ...current, ...update }));

  }



  function addItem(kind: "menu" | "decor", selectedId: string) {

    const masterList = kind === "menu" ? food : decor;

    const item = masterList.find((entry) => String(entry.id) === selectedId);



    if (!item) {

      setError("Please choose an item first.");

      return;

    }



    setDraft((current) => {

      const rows = current[kind];

      const existing = rows.find((row) => row.id === item.id);



      const updated = existing

        ? rows.map((row) =>

            row.id === item.id ? { ...row, qty: row.qty + 1 } : row

          )

        : [

            ...rows,

            {

              id: item.id,

              name: item.name,

              qty: 1,

              price: Number(item.price || 0),

            },

          ];



      return { ...current, [kind]: updated };

    });



    if (kind === "menu") setFoodPick("");

    else setDecorPick("");



    setError("");

  }



  function updateLine(

    kind: "menu" | "decor",

    itemId: number,

    update: (line: Line) => Line

  ) {

    setDraft((current) => ({

      ...current,

      [kind]: current[kind].map((line) =>

        line.id === itemId ? update(line) : line

      ),

    }));

  }



  function removeLine(kind: "menu" | "decor", itemId: number) {

    setDraft((current) => ({

      ...current,

      [kind]: current[kind].filter((line) => line.id !== itemId),

    }));

  }



  async function saveEventTotals() {

    const updated = await request<EventRow>(`/events/${id}`, {

      method: "PUT",

      body: JSON.stringify({

        food_amt: foodTotal,

        decor_amt: decorTotal,

        total_estimate: total,

        quote,

      }),

    });



    if (updated && typeof updated === "object") {

      setEvent((current) => (current ? { ...current, ...updated } : updated));

    }

  }



  async function saveEventItems() {

    if (saving) return;



    setSaving(true);

    setError("");

    setStatus("Saving menu and decor items…");



    try {

      await Promise.all([

        request(`/events/${id}/menu-items`, {

          method: "PUT",

          body: JSON.stringify(

            draft.menu.map((item) => ({

              food_item_id: item.id,

              quantity: item.qty,

              price: item.price,

            }))

          ),

        }),

        request(`/events/${id}/decor-items`, {

          method: "PUT",

          body: JSON.stringify(

            draft.decor.map((item) => ({

              decor_item_id: item.id,

              quantity: item.qty,

              price: item.price,

            }))

          ),

        }),

        request(`/events/${id}/staff`, {

          method: "PUT",

          body: JSON.stringify({

            staff_ids: Object.keys(draft.staff).map(Number),

          }),

        }).catch((e) => console.error("Error syncing staff:", e)),

      ]);



      await saveEventTotals();

      setStatus("Event items and totals saved successfully.");

    } catch (err) {

      setError(

        err instanceof Error ? err.message : "Could not save event items."

      );

      setStatus("Save failed. Your browser draft is still available.");

    } finally {

      setSaving(false);

    }

  }



  async function saveTotalsOnly() {

    if (saving) return;



    setSaving(true);

    setError("");

    setStatus("Saving event totals…");



    try {

      await saveEventTotals();

      setStatus("Event totals saved successfully.");

    } catch (err) {


      setError(

        err instanceof Error ? err.message : "Failed to save event totals."

      );

      setStatus("Save failed. Please try again.");

    } finally {

      setSaving(false);

    }

  }



  function assignStaff() {

    if (!staffPicks.length) {

      setError("Please select at least one staff member.");

      return;

    }



    if (!staffRoles.length) {

      setError("No staff roles are available. Check the staff roles API.");

      return;

    }



    const defaultRoleId = String(staffRoles[0].id);



    const picks = [...staffPicks];

    setDraft((current) => {

      const updatedStaff = { ...current.staff };

      picks.forEach((staffId) => {

        if (!updatedStaff[staffId]) {

          updatedStaff[staffId] = defaultRoleId;

        }

      });

      return { ...current, staff: updatedStaff };

    });

    request(`/events/${id}/staff`, {
      method: "POST",
      body: JSON.stringify({ staff_ids: picks.map(Number) }),
    }).catch((e) => console.error("Failed to assign staff on server:", e));

    setStaffPicks([]);

    setError("");

    setStatus("Staff assigned successfully.");

  }



  function removeStaff(staffId: string) {

    setDraft((current) => {

      const staff = { ...current.staff };

      delete staff[staffId];

      return { ...current, staff };

    });

    setStaffPicks((current) => current.filter((id) => id !== staffId));

    request(`/events/${id}/staff/${staffId}`, {
      method: "DELETE",
    }).catch((e) => console.error("Failed to delete staff assignment on server:", e));

  }



    async function loadSubTeams() {
    setSubTeamsLoading(true);
    try {
      const result = await request<SubTeam[] | { data?: SubTeam[] }>("/sub-teams");
      const rows = Array.isArray(result) ? result : Array.isArray(result?.data) ? result.data : [];
      setSubTeams(rows.filter((team) => Number(team.event_id) === Number(id)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load sub teams.");
    } finally {
      setSubTeamsLoading(false);
    }
  }

  async function createSubTeam() {
    const name = subTeamName.trim();
    if (!name) {
      setError("Enter a sub team name.");
      return;
    }
    const amount = subTeamAmount.trim() === "" ? 0 : Number(subTeamAmount);
    if (!Number.isFinite(amount) || amount < 0) {
      setError("Enter a valid amount of zero or more.");
      return;
    }
    setSubTeamSaving(true);
    setError("");
    setStatus("Creating sub team…");
    try {
      const created = await request<SubTeam>("/sub-teams", {
        method: "POST",
        body: JSON.stringify({
          event_id: Number(id),
          name,
          purpose: subTeamPurpose.trim() || null,
          phone: subTeamPhone.trim() || null,
          amount,
          note: subTeamNote.trim() || null,
        }),
      });
      setSubTeams((current) => [...current, { ...created, event_id: Number(created.event_id ?? id) }]);
      setSubTeamName("");
      setSubTeamPurpose("");
      setSubTeamPhone("");
      setSubTeamAmount("");
      setSubTeamNote("");
      setStatus("Sub team created successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create sub team.");
      setStatus("Sub team creation failed.");
    } finally {
      setSubTeamSaving(false);
    }
  }



  async function recordPayment() {

    const amount = Number(payAmount);



    if (!Number.isFinite(amount) || amount <= 0) {

      setError("Enter a payment amount greater than zero.");

      return;

    }



    setPaymentSaving(true);

    setError("");

    setStatus("Recording payment…");



    const payload = {

      event_id: Number(id),

      amount,

      payment_method: payMethod,

      payment_type: payType,

      payment_date: payDate || new Date().toISOString().slice(0, 10),

      note: payNote.trim() || null,

    };



    try {

      const created = await request<Payment>(`/events/${id}/payments`, {

        method: "POST",

        body: JSON.stringify(payload),

      });



      const newPayment: Payment = {

        id: created.id,

        amount: Number(created.amount || amount),

        payment_method: created.payment_method || payMethod,

        payment_type: created.payment_type || payType,

        payment_date: created.payment_date || payDate,

        date: formatDateDisplay(created.payment_date || payDate),

        note: created.note ?? payNote.trim(),

      };



      patchDraft({

        payments: [newPayment, ...draft.payments],

        tasks: draft.tasks.map((t) => (t.id === "advance" ? { ...t, done: true } : t)),

      });



      setPayAmount("");

      setPayNote("");

      setStatus("Payment recorded successfully to database.");

    } catch (err) {

      console.warn("Server payment error, saving to local draft:", err);

      const fallbackPayment: Payment = {

        id:

          typeof crypto !== "undefined" && "randomUUID" in crypto

            ? crypto.randomUUID()

            : String(Date.now()),

        amount,

        payment_method: payMethod,

        payment_type: payType,

        payment_date: payDate,

        date: formatDateDisplay(payDate),

        note: payNote.trim(),

      };



      patchDraft({

        payments: [fallbackPayment, ...draft.payments],

        tasks: draft.tasks.map((t) => (t.id === "advance" ? { ...t, done: true } : t)),

      });



      setPayAmount("");

      setPayNote("");

      setStatus("Payment recorded in this browser draft.");

    } finally {

      setPaymentSaving(false);

    }

  }



  async function removePayment(paymentId: number | string) {

    setDeletingPaymentId(paymentId);

    setError("");

    setStatus("Removing payment…");



    try {

      if (typeof paymentId === "number" || /^\d+$/.test(String(paymentId))) {

        await request(`/events/${id}/payments/${paymentId}`, {

          method: "DELETE",

        });

      }

      patchDraft({

        payments: draft.payments.filter((payment) => String(payment.id) !== String(paymentId)),

      });

      setStatus("Payment removed successfully.");

    } catch (err) {

      patchDraft({

        payments: draft.payments.filter((payment) => String(payment.id) !== String(paymentId)),

      });

      setStatus("Payment removed from local draft.");

    } finally {

      setDeletingPaymentId(null);

    }

  }



  async function recordStaffPayment() {

    if (!staffPayStaffId) {

      setError("Please select a staff member to record payment.");

      return;

    }

    const amount = Number(staffPayAmount);

    if (!Number.isFinite(amount) || amount <= 0) {

      setError("Enter a valid disbursement amount greater than zero.");

      return;

    }



    setStaffPaySaving(true);

    setError("");

    setStatus("Recording staff payment…");



    try {

      const created = await request<StaffPaymentItem>("/staff-payments", {

        method: "POST",

        body: JSON.stringify({

          event_id: Number(id),

          staff_id: Number(staffPayStaffId),

          payment: amount,

          note: staffPayNote.trim() || null,

        }),

      });



      setStaffPayments((current) => [created, ...current]);

      setStaffPayAmount("");

      setStaffPayNote("");

      setStatus("Staff payment recorded successfully.");

    } catch (err) {

      setError(err instanceof Error ? err.message : "Failed to record staff payment.");

    } finally {

      setStaffPaySaving(false);

    }

  }



  async function removeStaffPayment(paymentId: number) {

    setError("");

    setStatus("Removing staff payment…");



    try {

      await request(`/staff-payments/${paymentId}`, {

        method: "DELETE",

      });

      setStaffPayments((current) => current.filter((p) => p.id !== paymentId));

      setStatus("Staff payment removed successfully.");

    } catch (err) {

      setError(err instanceof Error ? err.message : "Failed to remove staff payment.");

    }

  }




  const tabs = [

    "Overview",

    "Menu",

    "Decor",

    "Staff",

    "Sub Teams",

    "Checklist",

    "Payments",

    "Quotation",

  ];



  function renderItemSection(kind: "menu" | "decor") {

    const isFood = kind === "menu";

    const rows = draft[kind];

    const masterList = isFood ? food : decor;

    const selected = isFood ? foodPick : decorPick;

    const search = draft.search.trim().toLowerCase();



    const filteredItems = masterList.filter((item) =>

      item.name.toLowerCase().includes(search)

    );



    return (

      <section className="card">

        <div className="head">

          <div>

            <h2>{isFood ? "Menu planner" : "Decor planner"}</h2>

            <p>Find items, add them quickly, and update quantities.</p>

          </div>



          <input

            className="input search"

            placeholder="Search master items..."

            value={draft.search}

            onChange={(e) => patchDraft({ search: e.target.value })}

          />

        </div>



        <div className="add">

          <select

            className="input"

            value={selected}

            onChange={(e) =>

              isFood ? setFoodPick(e.target.value) : setDecorPick(e.target.value)

            }

          >

            <option value="">Choose an item</option>

            {filteredItems.map((item) => (

              <option key={item.id} value={item.id}>

                {item.name} · {money(Number(item.price || 0))}

              </option>

            ))}

          </select>



          <button

            type="button"

            className="primary"

            onClick={() => addItem(kind, selected)}

          >

            + Add item

          </button>

        </div>



        <div className="tablewrap">

          <table>

            <thead>

              <tr>

                <th>Item</th>

                <th>Unit price</th>

                <th>Quantity</th>

                <th>Subtotal</th>

                <th />

              </tr>

            </thead>

            <tbody>

              {rows.map((item, index) => (

                <tr key={`${item.id}-${index}`}>

                  <td><b>{item.name}</b></td>

                  <td>

                    <input

                      className="price"

                      type="number"

                      min="0"

                      value={item.price}

                      onChange={(e) =>

                        updateLine(kind, item.id, (line) => ({

                          ...line,

                          price: Math.max(0, Number(e.target.value) || 0),

                        }))

                      }

                    />

                  </td>

                  <td>

                    <div className="quantity">

                      <button

                        type="button"

                        className="small"

                        onClick={() =>

                          updateLine(kind, item.id, (line) => ({

                            ...line,

                            qty: Math.max(1, line.qty - 1),

                          }))

                        }

                      >

                        −

                      </button>

                      <b>{item.qty}</b>

                      <button

                        type="button"

                        className="small"

                        onClick={() =>

                          updateLine(kind, item.id, (line) => ({

                            ...line,

                            qty: line.qty + 1,

                          }))

                        }

                      >

                        +

                      </button>

                    </div>

                  </td>

                  <td><b>{money(item.qty * item.price)}</b></td>

                  <td>

                    <button

                      type="button"

                      className="remove"

                      onClick={() => removeLine(kind, item.id)}

                    >

                      Remove

                    </button>

                  </td>

                </tr>

              ))}



              {!rows.length && (

                <tr>

                  <td colSpan={5} className="empty">

                    No items added yet. Choose an item above to begin.

                  </td>

                </tr>

              )}

            </tbody>

          </table>

        </div>



        <div className="totalrow">

          <span>{isFood ? "Food subtotal" : "Decor subtotal"}</span>

          <b>{money(isFood ? foodTotal : decorTotal)}</b>

        </div>



        {!isOwner && (
          <div className="saveItems">

            <button

              type="button"

              className="primary"

              disabled={saving}

              onClick={saveEventItems}

            >

              {saving ? "Saving…" : "Save Menu & Decor Items"}

            </button>

          </div>
        )}



        <p className="notice">

          Menu and decor items are saved to the server when you click Save.

          Other draft-only features remain stored in this browser.

        </p>

      </section>

    );

  }



  if (loading) {

    return (

      <main className="fc">

        <style>{css}</style>

        <div className="card">Loading event workspace…</div>

      </main>

    );

  }



  if (!event) {

    return (

      <main className="fc">

        <style>{css}</style>

        <div className="alert">

          {error || "Event not found. Check the event ID and API."}

        </div>

      </main>

    );

  }



  return (

    <main className="fc">

      <style>{css}</style>



      <header className="top">

        <div>

          <div className="topNavLinks no-print">

            <button

              type="button"

              className="backBtn"

              onClick={() => router.push("/events")}

            >

              ← Back to Events

            </button>

          </div>

          <div className="eyebrow">FOOD COURT · EVENT WORKSPACE</div>

          <div className="titleRow">

            <h1>

              {event.event_type || "Event"} <span>#{event.id}</span>

            </h1>

            <span className={`pill ${paymentStatus.cls}`}>

              {paymentStatus.label}

            </span>

          </div>

          <p>

            {event.place || "Venue not set"} · {event.date || "Date not set"} ·{" "}

            {guests} guests · Customer: {event.customer?.name || `Customer #${event.customer_id ?? "—"}`}

          </p>

        </div>



        <div className="actions">

          <small className="saveStatus">{status || "Draft autosave enabled"}</small>

          {!isOwner && (
            <button

              type="button"

              className="primary"

              disabled={saving}

              onClick={saveTotalsOnly}

            >

              {saving ? "Saving…" : "Save event totals"}

            </button>
          )}

          <Link
            href={`/billing?eventId=${event.id}`}
            className="btn"
            style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "6px" }}
          >
            🧾 Billing & Invoice
          </Link>

          <button type="button" className="btn" onClick={() => window.print()}>

            Print / PDF

          </button>

        </div>

      </header>

      <OwnerBanner />



      {error && (

        <div className="alert">

          <span>{error}</span>

          <button type="button" onClick={() => setError("")}>×</button>

        </div>

      )}



      <section className="metrics">

        {[

          { label: "Food Total", value: foodTotal },

          { label: "Decor Total", value: decorTotal },

          { label: "Staff Wages", value: staffTotal },

          { label: "Sub Teams", value: subTeamsTotal },

          { label: "Estimated Cost", value: total + subTeamsTotal, perGuest: guests > 0 },

          { label: "Quotation Total", value: quote },

          { label: "Total Paid", value: paid, isPaid: true },

          {

            label: balance > 0 ? "Balance Due" : overpaid > 0 ? "Surplus Amount" : "Balance Due",

            value: overpaid > 0 ? overpaid : balance,

            isBalance: true,

          },

        ].map((metric) => (

          <div

            className={`card metric ${

              metric.isBalance

                ? balance === 0 && paid > 0

                  ? "metricSuccess"

                  : balance > 0

                  ? "metricWarning"

                  : "metricInfo"

                : ""

            }`}

            key={metric.label}

          >

            <small>{metric.label}</small>

            <strong>{money(metric.value)}</strong>

            {metric.perGuest && guests > 0 && (

              <small>{money((total + subTeamsTotal) / guests)} per guest</small>

            )}

            {metric.isPaid && quote > 0 && (

              <small>{paymentPercentage}% of quote received</small>

            )}

          </div>

        ))}

      </section>



      <nav className="tabs">

        {tabs.map((name) => (

          <button

            type="button"

            key={name}

            className={tab === name ? "active" : ""}

            onClick={() => setTab(name)}

          >

            {name}

          </button>

        ))}

      </nav>



      {tab === "Overview" && (

        <div className="grid">

          <section className="card">

            <h2>Event overview</h2>

            <div className="details">

              {[

                ["Customer ID", event.customer_id ?? "—"],

                ["Event type", event.event_type || "—"],

                ["Venue", event.place || "—"],

                ["Date", event.date || "—"],

                ["Guests", guests],

              ].map(([label, value]) => (

                <div key={String(label)}>

                  <small>{label}</small>

                  <b>{value}</b>

                </div>

              ))}

            </div>

          </section>



          <section className="card">

            <h2>Preparation progress</h2>

            <div

              className="progress"

              role="progressbar"

              aria-valuenow={progress}

              aria-valuemin={0}

              aria-valuemax={100}

            >

              <i style={{ width: `${progress}%` }} />

            </div>

            <b>{completedTasks} of {draft.tasks.length} tasks complete</b>

            <p className="muted">{progress}% completed</p>

            <div className="quick">

              {tabs.slice(1).map((name) => (

                <button type="button" key={name} onClick={() => setTab(name)}>

                  {name} <span>→</span>

                </button>

              ))}

            </div>

          </section>



          <section className="card">

            <h2>Cost & financial summary</h2>

            {[

              ["Food", foodTotal],

              ["Decor", decorTotal],

              ["Staff wages", staffTotal],

              ["Sub teams", subTeamsTotal],

              ["Estimated event cost", total + subTeamsTotal],

              ["Quotation", quote],

              ["Payments received", paid],

              [balance > 0 ? "Remaining balance due" : overpaid > 0 ? "Surplus / Change due" : "Balance due", overpaid > 0 ? overpaid : balance],

            ].map(([label, value]) => (

              <div className="breakdown" key={String(label)}>

                <span>{label}</span>

                <b>{money(Number(value))}</b>

              </div>

            ))}

            {guests > 0 && (

              <div className="breakdown highlight">

                <span>Estimated cost per guest</span>

                <b>{money((total + subTeamsTotal) / guests)}</b>

              </div>

            )}

          </section>

        </div>

      )}



      {tab === "Menu" && renderItemSection("menu")}

      {tab === "Decor" && renderItemSection("decor")}



      {tab === "Staff" && (

        <section className="card staffCard">

          <div className="head staffHeader">

            <div>

              <h2>Staff allocation</h2>

              <p>Select team members and assign them to event duties.</p>

            </div>

            <span className="pill">{Object.keys(draft.staff).length} assigned</span>

          </div>



          {rolesLoading && <p className="notice">Loading staff roles…</p>}

          {rolesError && <p className="alert">{rolesError}</p>}



          <div className="staffPicker">

            <div className="staffPickerTop">

              <div>

                <h3>Available team members</h3>

                <p>Click a card to select or deselect a person.</p>

              </div>

              <span className="selectedCount">{staffPicks.length} selected</span>

            </div>



            <div className="staffGrid">

              {people

                .filter((person) => !draft.staff[String(person.id)])

                .map((person) => {

                  const staffId = String(person.id);

                  const selected = staffPicks.includes(staffId);



                  return (

                    <button

                      type="button"

                      key={person.id}

                      className={`staffPickCard ${selected ? "selected" : ""}`}

                      aria-pressed={selected}

                      onClick={() => {

                        setStaffPicks((current) =>

                          selected

                            ? current.filter((id) => id !== staffId)

                            : [...current, staffId]

                        );

                        setError("");

                      }}

                    >

                      <span className="staffAvatar">

                        {person.name.trim().charAt(0).toUpperCase() || "S"}

                      </span>

                      <span className="staffPickInfo">

                        <strong>{person.name}</strong>

                        <small>{person.mobile || "No mobile number"}</small>

                        <small className="staffWage">

                          {money(Number(person.daily_wage || 0))} / day

                        </small>

                      </span>

                      <span className={`staffCheck ${selected ? "checked" : ""}`}>

                        {selected ? "✓" : "+"}

                      </span>

                    </button>

                  );

                })}

            </div>



            {!people.filter((person) => !draft.staff[String(person.id)]).length && (

              <div className="staffEmpty">

                <strong>All staff members are assigned</strong>

                <p>Remove an assigned person to make them available again.</p>

              </div>

            )}



            <div className="staffPickerFooter">

              <span>

                {staffPicks.length

                  ? `${staffPicks.length} team member(s) ready to assign`

                  : "Select one or more team members"}

              </span>

              <div className="staffPickerActions">

                <button

                  type="button"

                  className="btn"

                  disabled={!staffPicks.length}

                  onClick={() => setStaffPicks([])}

                >

                  Clear selection

                </button>

                <button

                  type="button"

                  className="primary"

                  disabled={!staffPicks.length || !staffRoles.length}

                  onClick={assignStaff}

                >

                  + Assign {staffPicks.length || ""} staff

                </button>

              </div>

            </div>

          </div>



          <div className="assignedHeader">

            <div>

              <h3>Assigned team</h3>

              <p>Choose a duty for each assigned staff member.</p>

            </div>

            <span className="assignedCount">

              {Object.keys(draft.staff).length} members

            </span>

          </div>



          {Object.entries(draft.staff).map(([staffId, roleId]) => {

            const person = people.find((item) => String(item.id) === staffId);

            if (!person) return null;



            const selectedRole = staffRoles.find(

              (role) => String(role.id) === roleId

            );



            return (

              <div className="staffrow" key={staffId}>

                <span className="staffAvatar assignedAvatar">

                  {person.name.trim().charAt(0).toUpperCase() || "S"}

                </span>

                <div className="staffInfo">

                  <b>{person.name}</b>

                  <small>{person.mobile || "No mobile number"}</small>

                  <small>

                    Role wage: {money(Number(selectedRole?.wage ?? selectedRole?.daily_wage ?? 0))}

                  </small>

                </div>

                <div className="staffDuty">

                  <label htmlFor={`duty-${staffId}`}>Assigned duty</label>

                  <select

                    id={`duty-${staffId}`}

                    className="input team"

                    value={roleId}

                    onChange={(e) =>

                      patchDraft({

                        staff: { ...draft.staff, [staffId]: e.target.value },

                      })

                    }

                  >

                    {staffRoles.map((role) => (

                      <option key={role.id} value={String(role.id)}>

                        {role.role ?? role.name ?? "Unnamed role"} —{" "}

                        {money(Number(role.wage ?? role.daily_wage ?? 0))}

                      </option>

                    ))}

                  </select>

                </div>

                <button

                  type="button"

                  className="remove"

                  onClick={() => removeStaff(staffId)}

                >

                  Remove

                </button>

              </div>

            );

          })}



          {!Object.keys(draft.staff).length && (

            <div className="staffEmpty assignedEmpty">

              <strong>No staff assigned yet</strong>

              <p>Select staff members above and click Assign staff.</p>

            </div>

          )}



          <p className="notice">

            Staff assignments are stored in this browser draft. Staff wages are

            calculated from the selected role's wage.

          </p>

        </section>

      )}



      {tab === "Sub Teams" && (
        <section className="card subTeamsCard">
          <div className="head subTeamsHeader">
            <div>
              <h2>Event sub teams</h2>
              <p>Create and manage sub teams linked to this event.</p>
            </div>
            <span className="pill">{subTeams.length} sub team{subTeams.length === 1 ? "" : "s"}</span>
          </div>

          {!isOwner && (
            <div className="subTeamForm">
              <h3>Add a sub team</h3>
              <div className="subTeamFields">
                <label>Team name <span className="required">*</span>
                  <input className="input" value={subTeamName} onChange={(e) => setSubTeamName(e.target.value)} placeholder="e.g. Service Team A" />
                </label>
                <label>Purpose / responsibility
                  <input className="input" value={subTeamPurpose} onChange={(e) => setSubTeamPurpose(e.target.value)} placeholder="e.g. Dining service" />
                </label>
                <label>Contact phone
                  <input className="input" value={subTeamPhone} onChange={(e) => setSubTeamPhone(e.target.value)} placeholder="Phone number" />
                </label>
                <label>Budget / amount (₹)
                  <input className="input" type="number" min="0" step="0.01" value={subTeamAmount} onChange={(e) => setSubTeamAmount(e.target.value)} placeholder="0.00" />
                </label>
                <label className="subTeamNote">Notes
                  <textarea className="input" rows={3} value={subTeamNote} onChange={(e) => setSubTeamNote(e.target.value)} placeholder="Additional notes" />
                </label>
              </div>
              <div className="subTeamFormActions">
                <button type="button" className="primary" disabled={subTeamSaving} onClick={createSubTeam}>
                  {subTeamSaving ? "Creating…" : "+ Add Sub Team"}
                </button>
                <button type="button" className="btn" disabled={subTeamSaving} onClick={() => {
                  setSubTeamName(""); setSubTeamPurpose(""); setSubTeamPhone(""); setSubTeamAmount(""); setSubTeamNote("");
                }}>Clear form</button>
              </div>
            </div>
          )}

          <div className="assignedHeader">
            <div><h3>Sub teams for this event</h3><p>Only teams linked to event #{event.id} are shown.</p></div>
            <button type="button" className="btn" disabled={subTeamsLoading} onClick={loadSubTeams}>{subTeamsLoading ? "Refreshing…" : "Refresh"}</button>
          </div>

          {subTeamsLoading ? <p className="notice">Loading sub teams…</p> : subTeams.length ? (
            <div className="subTeamGrid">
              {subTeams.map((team) => (
                <article className="subTeamCard" key={team.id}>
                  <div className="subTeamCardTop">
                    <span className="subTeamIcon">ST</span>
                    <div className="subTeamTitle"><h3>{team.name}</h3><small>Sub Team #{team.id}</small></div>
                  </div>
                  <div className="subTeamDetails">
                    <div><small>Purpose</small><b>{team.purpose || "Not specified"}</b></div>
                    <div><small>Phone</small><b>{team.phone || "Not specified"}</b></div>
                    <div><small>Amount</small><b>{money(Number(team.amount || 0))}</b></div>
                  </div>
                  {team.note && <p className="subTeamNoteText">{team.note}</p>}
                </article>
              ))}
            </div>
          ) : (
            <div className="staffEmpty"><strong>No sub teams added yet</strong><p>Use the form above to create the first sub team.</p></div>
          )}
          <p className="notice">Sub teams are saved through the /sub-teams API and linked to this event. Staff assignment to individual sub teams is not changed by this form.</p>
        </section>
      )}

      {tab === "Checklist" && (
        <section className="card">

          <div className="head">

            <div>

              <h2>Event checklist</h2>

              <p>Keep track of event preparation tasks.</p>

            </div>

            <span className="pill">{progress}% complete</span>

          </div>



          {draft.tasks.map((task) => (

            <label className="task" key={task.id}>

              <input

                type="checkbox"

                checked={task.done}

                onChange={(e) =>

                  patchDraft({

                    tasks: draft.tasks.map((item) =>

                      item.id === task.id

                        ? { ...item, done: e.target.checked }

                        : item

                    ),

                  })

                }

              />

              <span className={task.done ? "done" : ""}>{task.label}</span>

              <small>{task.done ? "Completed" : "Pending"}</small>

            </label>

          ))}



          <p className="notice">Checklist changes autosave to this browser.</p>

        </section>

      )}



      {tab === "Payments" && (

        <section className="card paymentsCard">

          <div className="head paymentsHead">

            <div>

              <h2>Payment tracker</h2>

              <p>Record client payments, track balance due, and manage payment methods.</p>

            </div>

            <div className="paymentHeadActions">

              <span className={`pill ${paymentStatus.cls}`}>

                {paymentStatus.label}

              </span>

              <div className="subTabToggle">

                <button

                  type="button"

                  className={paymentSubTab === "client" ? "subTabActive" : ""}

                  onClick={() => setPaymentSubTab("client")}

                >

                  Client Payments ({draft.payments.length})

                </button>

                <button

                  type="button"

                  className={paymentSubTab === "staff" ? "subTabActive" : ""}

                  onClick={() => setPaymentSubTab("staff")}

                >

                  Staff Disbursements ({staffPayments.length})

                </button>

              </div>

            </div>

          </div>



          {paymentSubTab === "client" ? (

            <>

              <div className="paymentmetrics">

                <div>

                  <small>Quotation Amount</small>

                  <b>{money(quote)}</b>

                  <small className="muted">Total agreement amount</small>

                </div>

                <div>

                  <small>Recorded Payments</small>

                  <b className="textGreen">{money(paid)}</b>

                  <small className="muted">{paymentPercentage}% of quotation received</small>

                </div>

                <div>

                  <small>{balance > 0 ? "Balance Due" : overpaid > 0 ? "Surplus / Change Due" : "Balance Due"}</small>

                  <b className={balance > 0 ? "textRed" : "textGreen"}>

                    {money(overpaid > 0 ? overpaid : balance)}

                  </b>

                  <small className="muted">

                    {balance > 0 ? "Pending collection" : overpaid > 0 ? "Excess received" : "Fully settled"}

                  </small>

                </div>

              </div>



              {quote > 0 && (

                <div className="paymentProgressWrap">

                  <div className="paymentProgressLabels">

                    <span>Payment collection progress</span>

                    <b>{paymentPercentage}% ({money(paid)} / {money(quote)})</b>

                  </div>

                  <div className="paymentProgressBar">

                    <div

                      className={`paymentProgressFill ${balance === 0 && paid > 0 ? "fillPaid" : "fillPartial"}`}

                      style={{ width: `${Math.min(100, paymentPercentage)}%` }}

                    />

                  </div>

                </div>

              )}



              {!isOwner && (
                <div className="paymentFormCard">

                  <div className="paymentFormHeader">

                    <h3>Record client payment</h3>

                    {balance > 0 && (

                      <button

                        type="button"

                        className="btn quickPayBtn"

                        onClick={() => {

                          setPayAmount(String(balance));

                          setPayType(paid === 0 ? "Advance" : "Final Settlement");

                        }}

                      >

                        ⚡ Auto-fill Balance: {money(balance)}

                      </button>

                    )}

                  </div>



                  <div className="paymentFormFields">

                    <label>

                      Payment amount (₹) <span className="required">*</span>

                      <input

                        className="input"

                        type="number"

                        min="0.01"

                        step="0.01"

                        placeholder="0.00"

                        value={payAmount}

                        onChange={(e) => setPayAmount(e.target.value)}

                      />

                    </label>



                    <label>

                      Payment date <span className="required">*</span>

                      <input

                        className="input"

                        type="date"

                        value={payDate}

                        onChange={(e) => setPayDate(e.target.value)}

                      />

                    </label>



                    <label>

                      Payment method

                      <select

                        className="input"

                        value={payMethod}

                        onChange={(e) => setPayMethod(e.target.value)}

                      >

                        <option value="Cash">Cash</option>

                        <option value="UPI">UPI / Google Pay / PhonePe</option>

                        <option value="Bank Transfer">Bank Transfer (NEFT/IMPS)</option>

                        <option value="Cheque">Cheque / Demand Draft</option>

                        <option value="Card">Credit / Debit Card</option>

                        <option value="Other">Other</option>

                      </select>

                    </label>



                    <label>

                      Payment category

                      <select

                        className="input"

                        value={payType}

                        onChange={(e) => setPayType(e.target.value)}

                      >

                        <option value="Advance">Advance Payment</option>

                        <option value="Part Payment">Part Payment / Installment</option>

                        <option value="Final Settlement">Final Settlement</option>

                        <option value="Security Deposit">Security Deposit</option>

                        <option value="Other">Other</option>

                      </select>

                    </label>



                    <label className="spanFull">

                      Reference / Transaction Note

                      <input

                        className="input"

                        placeholder="e.g. UPI Ref # / Cheque # / Bank transaction ID / Receipt notes"

                        value={payNote}

                        onChange={(e) => setPayNote(e.target.value)}

                      />

                    </label>

                  </div>



                  <div className="paymentFormActions">

                    <button

                      type="button"

                      className="primary"

                      disabled={paymentSaving}

                      onClick={recordPayment}

                    >

                      {paymentSaving ? "Recording payment…" : "+ Record Payment"}

                    </button>

                    <button

                      type="button"

                      className="btn"

                      disabled={paymentSaving}

                      onClick={() => {

                        setPayAmount("");

                        setPayNote("");

                      }}

                    >

                      Clear Form

                    </button>

                  </div>

                </div>
              )}



              <div className="tablewrap">

                <table>

                  <thead>

                    <tr>

                      <th>Date</th>

                      <th>Category</th>

                      <th>Method</th>

                      <th>Reference / Note</th>

                      <th>Amount</th>

                      <th />

                    </tr>

                  </thead>

                  <tbody>

                    {draft.payments.map((payment) => (

                      <tr key={String(payment.id)}>

                        <td>{payment.date || formatDateDisplay(payment.payment_date)}</td>

                        <td>

                          <span className="badgeCategory">

                            {payment.payment_type || "Payment"}

                          </span>

                        </td>

                        <td>

                          <span className="badgeMethod">

                            {payment.payment_method || "Cash"}

                          </span>

                        </td>

                        <td>{payment.note || "—"}</td>

                        <td><b>{money(payment.amount)}</b></td>

                        <td>

                          {isOwner ? (
                            <span style={{ fontSize: "12px", color: "#8a7b9b" }}>Read-only</span>
                          ) : (
                            <button

                              type="button"

                              className="remove"

                              disabled={deletingPaymentId === payment.id}

                              onClick={() => removePayment(payment.id)}

                            >

                              {deletingPaymentId === payment.id ? "Removing…" : "Remove"}

                            </button>
                          )}

                        </td>

                      </tr>

                    ))}

                    {draft.payments.length > 0 && (

                      <tr className="tableSummaryRow">

                        <td colSpan={4}><b>Total Client Payments Received</b></td>

                        <td colSpan={2}><b className="textGreen">{money(paid)}</b></td>

                      </tr>

                    )}

                    {!draft.payments.length && (

                      <tr>

                        <td colSpan={6} className="empty">

                          No client payments recorded yet. Use the form above to record advances or settlements.

                        </td>

                      </tr>

                    )}

                  </tbody>

                </table>

              </div>



              <p className="notice">

                ✓ Client payments are synchronized with the backend database.

              </p>

            </>

          ) : (

            <>

              <div className="paymentmetrics">

                <div>

                  <small>Staff Wages Allocated</small>

                  <b>{money(staffTotal)}</b>

                  <small className="muted">{Object.keys(draft.staff).length} members assigned</small>

                </div>

                <div>

                  <small>Total Wages Disbursed</small>

                  <b className="textGreen">{money(staffPaymentsTotal)}</b>

                  <small className="muted">{staffPayments.length} disbursements made</small>

                </div>

                <div>

                  <small>Remaining Wages Due</small>

                  <b className={staffWagesBalance > 0 ? "textRed" : "textGreen"}>

                    {money(staffWagesBalance)}

                  </b>

                  <small className="muted">

                    {staffWagesBalance === 0 && staffTotal > 0 ? "Fully paid to staff" : "Pending disbursement"}

                  </small>

                </div>

              </div>



              {!isOwner && (
                <div className="paymentFormCard">

                  <h3>Disburse wage to assigned staff</h3>

                  <div className="paymentFormFields">

                    <label>

                      Staff Member <span className="required">*</span>

                      <select

                        className="input"

                        value={staffPayStaffId}

                        onChange={(e) => {

                          const sid = e.target.value;

                          setStaffPayStaffId(sid);

                          const roleId = draft.staff[sid];

                          const r = staffRoles.find((sr) => String(sr.id) === roleId);

                          if (r) {

                            setStaffPayAmount(String(r.wage ?? r.daily_wage ?? ""));

                          }

                        }}

                      >

                        <option value="">Select an assigned staff member</option>

                        {Object.keys(draft.staff).map((sid) => {

                          const person = people.find((p) => String(p.id) === sid);

                          const role = staffRoles.find((r) => String(r.id) === draft.staff[sid]);

                          return (

                            <option key={sid} value={sid}>

                              {person?.name || `Staff #${sid}`} — {role?.role || "Duty"} ({money(Number(role?.wage ?? role?.daily_wage ?? 0))})

                            </option>

                          );

                        })}

                      </select>

                    </label>



                    <label>

                      Disbursement Amount (₹) <span className="required">*</span>

                      <input

                        className="input"

                        type="number"

                        min="0.01"

                        step="0.01"

                        placeholder="0.00"

                        value={staffPayAmount}

                        onChange={(e) => setStaffPayAmount(e.target.value)}

                      />

                    </label>



                    <label className="spanFull">

                      Disbursement Note / Details

                      <input

                        className="input"

                        placeholder="e.g. Day shift wage payment, cash handed over"

                        value={staffPayNote}

                        onChange={(e) => setStaffPayNote(e.target.value)}

                      />

                    </label>

                  </div>



                  <div className="paymentFormActions">

                    <button

                      type="button"

                      className="primary"

                      disabled={staffPaySaving || !Object.keys(draft.staff).length}

                      onClick={recordStaffPayment}

                    >

                      {staffPaySaving ? "Disbursing…" : "+ Record Staff Disbursement"}

                    </button>

                    <button

                      type="button"

                      className="btn"

                      disabled={staffPaySaving}

                      onClick={() => {

                        setStaffPayStaffId("");

                        setStaffPayAmount("");

                        setStaffPayNote("");

                      }}

                    >

                      Clear Form

                    </button>

                  </div>

                </div>
              )}



              <div className="tablewrap">

                <table>

                  <thead>

                    <tr>

                      <th>Staff Member</th>

                      <th>Allocated Role / Duty</th>

                      <th>Note</th>

                      <th>Disbursed Amount</th>

                      <th />

                    </tr>

                  </thead>

                  <tbody>

                    {staffPayments.map((sp) => {

                      const person = people.find((p) => Number(p.id) === Number(sp.staff_id));

                      const roleId = draft.staff[String(sp.staff_id)];

                      const role = staffRoles.find((r) => String(r.id) === roleId);

                      return (

                        <tr key={sp.id}>

                          <td><b>{person?.name || `Staff #${sp.staff_id}`}</b></td>

                          <td>{role?.role || "Staff Duty"}</td>

                          <td>{sp.note || "Staff wage"}</td>

                          <td><b>{money(Number(sp.payment))}</b></td>

                          <td>

                            {isOwner ? (
                              <span style={{ fontSize: "12px", color: "#8a7b9b" }}>Read-only</span>
                            ) : (
                              <button

                                type="button"

                                className="remove"

                                onClick={() => removeStaffPayment(sp.id)}

                              >

                                Remove

                              </button>
                            )}

                          </td>

                        </tr>

                      );

                    })}

                    {staffPayments.length > 0 && (

                      <tr className="tableSummaryRow">

                        <td colSpan={3}><b>Total Staff Wages Disbursed</b></td>

                        <td colSpan={2}><b className="textGreen">{money(staffPaymentsTotal)}</b></td>

                      </tr>

                    )}

                    {!staffPayments.length && (

                      <tr>

                        <td colSpan={5} className="empty">

                          No staff wage disbursements recorded yet.

                        </td>

                      </tr>

                    )}

                  </tbody>

                </table>

              </div>



              <p className="notice">

                ✓ Staff disbursements are recorded via the staff payments ledger API.

              </p>

            </>

          )}

        </section>

      )}



      {tab === "Quotation" && (

        <section className="card quotation">

          <div className="head no-print">

            <div>

              <h2>Quotation builder</h2>

              <p>Print this quotation or save it as a PDF.</p>

            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
              <Link
                href={`/billing?eventId=${event.id}&print=1`}
                className="btn"
                style={{
                  textDecoration: "none",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  borderColor: "#7c3aed",
                  color: "#6d28d9",
                }}
              >
                🧾 Official Tax Bill (PDF)
              </Link>

              <button type="button" className="primary" onClick={() => window.print()}>
                Print / Save PDF
              </button>
            </div>

          </div>



          <div className="paper">

            <div className="brand">

              <div className="logo">FC</div>

              <div>

                <h2>FOOD COURT</h2>

                <small>EVENT MANAGEMENT · QUOTATION</small>

              </div>

            </div>



            <hr />



            <div className="quoteMeta">

              <div>

                <small>Quotation for</small>

                <b>{event.customer?.name || `Customer #${event.customer_id ?? "—"}`}</b>

                <span>{event.customer?.mobile || ""}</span>

              </div>

              <div>

                <small>Event</small>

                <b>{event.event_type || "Event"}</b>

                <span>{event.place || "Venue not set"} · {event.date || "Date not set"}</span>

              </div>

              <div>

                <small>Guests</small>

                <b>{guests}</b>

              </div>

              <div>

                <small>Quotation number</small>

                <b>FC-{String(event.id).padStart(5, "0")}</b>

              </div>

            </div>



            <div className="tablewrap">

              <table>

                <thead><tr><th>Description</th><th>Amount</th></tr></thead>

                <tbody>

                  <tr><td>Food and menu</td><td>{money(foodTotal)}</td></tr>

                  <tr><td>Decor</td><td>{money(decorTotal)}</td></tr>

                  <tr><td>Staff wages</td><td>{money(staffTotal)}</td></tr>

                  {subTeamsTotal > 0 && (
                    <tr><td>Sub teams</td><td>{money(subTeamsTotal)}</td></tr>
                  )}

                  <tr><td><b>Estimated cost</b></td><td><b>{money(total + subTeamsTotal)}</b></td></tr>

                </tbody>

              </table>

            </div>



            <div className="quoteInput no-print">

              <label>

                Final quoted amount (₹)

                <input

                  className="input"

                  type="number"

                  min="0"

                  step="0.01"

                  value={draft.quote}

                  placeholder={String(total)}

                  onChange={(e) => patchDraft({ quote: e.target.value })}

                />

              </label>

            </div>



            <div className="grand">

              <span>QUOTATION TOTAL</span>

              <b>{money(quote)}</b>

            </div>



            <div className="quotePaymentSummary">

              <div className="quotePaymentRow">

                <span>Quotation Total</span>

                <b>{money(quote)}</b>

              </div>

              <div className="quotePaymentRow">

                <span>Payments Received ({draft.payments.length})</span>

                <b className="textGreen">− {money(paid)}</b>

              </div>

              <div className="quotePaymentRow grandBalance">

                <span>{balance > 0 ? "Balance Payable" : overpaid > 0 ? "Surplus Amount" : "Balance Due"}</span>

                <b className={balance > 0 ? "textRed" : "textGreen"}>

                  {money(overpaid > 0 ? overpaid : balance)}

                </b>

              </div>

              <div className="quotePaymentRow">

                <span>Payment Status</span>

                <span className={`pill ${paymentStatus.cls}`}>{paymentStatus.label}</span>

              </div>

            </div>



            {draft.payments.length > 0 && (

              <div className="quoteReceiptsSection">

                <h4>Payment receipts to date</h4>

                <div className="tablewrap">

                  <table className="quoteReceiptsTable">

                    <thead>

                      <tr>

                        <th>Date</th>

                        <th>Category</th>

                        <th>Method</th>

                        <th>Reference / Note</th>

                        <th>Amount</th>

                      </tr>

                    </thead>

                    <tbody>

                      {draft.payments.map((p) => (

                        <tr key={String(p.id)}>

                          <td>{p.date || formatDateDisplay(p.payment_date)}</td>

                          <td>{p.payment_type || "Payment"}</td>

                          <td>{p.payment_method || "Cash"}</td>

                          <td>{p.note || "—"}</td>

                          <td><b>{money(p.amount)}</b></td>

                        </tr>

                      ))}

                    </tbody>

                  </table>

                </div>

              </div>

            )}



            <p className="foot">

              Thank you for choosing Food Court. Please confirm the final menu,

              event details and payment terms with our team.

            </p>

          </div>

        </section>

      )}



      <footer className="footer">

        <span>FOOD COURT · Premium Event Workspace</span>

        <span>{status}</span>

      </footer>

    </main>

  );

}



const css = `

.fc{min-height:100vh;background:#f7f5f8;color:#211a25;padding:28px clamp(14px,3vw,42px);font-family:Inter,system-ui,sans-serif}

.top{max-width:1500px;margin:0 auto 22px;display:flex;justify-content:space-between;align-items:flex-start;gap:20px;flex-wrap:wrap}

.eyebrow{font-size:11px;letter-spacing:.18em;color:#7c3aed;font-weight:800}

.top h1{font-size:clamp(25px,3vw,36px);color:#1e0836;margin:8px 0;letter-spacing:-.04em}

.top h1 span{font-size:13px;color:#7c3aed}

.top p,.head p{font-size:12px;color:#82798a;margin:5px 0}

.actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap}

.actions small{font-size:10px;color:#628069}

.btn,.primary{border:1px solid #ddd6fe;background:#fff;color:#6d28d9;border-radius:10px;padding:10px 14px;font-size:12px;font-weight:800;cursor:pointer}

.primary{background:linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%);color:#fff;border-color:transparent;box-shadow:0 4px 14px rgba(124, 58, 237, 0.35)}

button:disabled{opacity:.6;cursor:not-allowed}

.card{background:#fff;border:1px solid #ebe4f5;border-radius:16px;padding:22px;box-shadow:0 8px 28px rgba(124, 58, 237, 0.04);min-width:0}

.metrics{max-width:1500px;margin:0 auto 18px;display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:11px}

.metric{display:flex;flex-direction:column;gap:8px}

.metric small,.details small,.paymentmetrics small,.quoteMeta small{font-size:11px;color:#82798a}

.metric strong{font-size:clamp(18px,2vw,25px);color:#1e0836;overflow-wrap:anywhere}

.tabs{max-width:1500px;margin:0 auto 18px;display:flex;gap:4px;padding:6px;background:#eee9f2;border-radius:12px;overflow-x:auto}

.tabs button{border:0;background:transparent;color:#716778;border-radius:8px;padding:11px 14px;white-space:nowrap;font-size:12px;font-weight:750;cursor:pointer}

.tabs button.active{background:#fff;color:#7c3aed;box-shadow:0 2px 8px rgba(124, 58, 237, 0.15)}

.grid{max-width:1500px;margin:auto;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:15px}

.card h2{font-size:17px;color:#2a1a37;margin:0}

.head{display:flex;align-items:center;justify-content:space-between;gap:15px;flex-wrap:wrap}

.details{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:22px;margin-top:25px}

.details div{display:flex;flex-direction:column;gap:7px;overflow-wrap:anywhere}

.details b{font-size:12px}

.input{width:100%;min-width:0;border:1px solid #e3dce8;border-radius:9px;padding:11px 12px;background:#fff;font:inherit;font-size:12px;color:#2b2032}

.search{max-width:240px}

.add{display:flex;gap:9px;margin:14px 0 18px}

.add>*{flex:1}

.tablewrap{overflow-x:auto;-webkit-overflow-scrolling:touch}

table{border-collapse:collapse;width:100%;min-width:590px;text-align:left;font-size:12px}

th{padding:12px 10px;background:#faf8fb;color:#82788a;font-size:10px;letter-spacing:.08em;text-transform:uppercase}

td{padding:13px 10px;border-bottom:1px solid #f0edf2}

td b{color:#32223e}

.price{width:88px;padding:7px;border:1px solid #e6dfea;border-radius:7px}

.quantity{display:flex;align-items:center;gap:9px}

.small{border:1px solid #ddd6fe;border-radius:7px;background:#fff;color:#6d28d9;padding:4px 8px;cursor:pointer}

.remove{border:0;background:transparent;color:#a14b54;font-size:11px;font-weight:750;cursor:pointer}

.empty{text-align:center!important;color:#908797;padding:28px!important}

.totalrow{display:flex;justify-content:flex-end;gap:25px;padding:17px 10px 0;font-size:13px}

.totalrow b{font-size:20px;color:#7c3aed}

.saveItems{display:flex;justify-content:flex-end;margin-top:18px}

.notice{background:#fbf7ee;border:1px solid #f0e5cc;color:#7e693f;padding:11px 13px;border-radius:9px;font-size:11px;line-height:1.6;margin:17px 0 0}

.alert{max-width:1500px;margin:0 auto 16px;background:#fff0f0;border:1px solid #f0caca;color:#943f48;border-radius:10px;padding:12px 15px;font-size:12px;display:flex;justify-content:space-between;gap:10px}

.alert button{border:0;background:transparent;color:inherit;cursor:pointer}

.progress{height:7px;background:#eee8f1;border-radius:20px;overflow:hidden;margin:22px 0 13px}

.progress i{display:block;height:100%;background:linear-gradient(90deg, #a855f7, #7c3aed);transition:width .2s ease}

.quick{display:grid;gap:7px;margin-top:18px}

.quick button{display:flex;justify-content:space-between;text-align:left;border:1px solid #eee8f1;background:#fff;border-radius:9px;padding:11px;color:#39234b;font-size:12px;font-weight:750;cursor:pointer}

.breakdown{display:flex;justify-content:space-between;gap:15px;border-bottom:1px solid #f0edf2;padding:12px 0;font-size:12px}

.breakdown b{text-align:right}

.highlight{color:#7c3aed}

.staffCard{max-width:1500px;margin:0 auto}

.staffHeader{margin-bottom:24px}

.staffPicker{padding:18px;border:1px solid #eee8f1;border-radius:14px;background:#fcfbfd}

.staffPickerTop,.assignedHeader{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:16px}

.staffPickerTop h3,.assignedHeader h3{margin:0;color:#2a1a37;font-size:15px}

.staffPickerTop p,.assignedHeader p{margin:5px 0 0;color:#82798a;font-size:12px}

.selectedCount,.assignedCount{border-radius:30px;padding:7px 11px;background:#f5f3ff;color:#6d28d9;font-size:11px;font-weight:800;white-space:nowrap}

.staffGrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}

.staffPickCard{display:flex;align-items:center;gap:12px;min-width:0;padding:14px;border:1px solid #e8e0ed;border-radius:12px;background:#fff;color:#2b2032;text-align:left;cursor:pointer;transition:.2s ease}

.staffPickCard:hover{border-color:#a855f7;box-shadow:0 4px 14px rgba(124, 58, 237, 0.12);transform:translateY(-1px)}

.staffPickCard.selected{border-color:#7c3aed;background:#faf8ff;box-shadow:0 0 0 1px #7c3aed}

.staffAvatar{display:grid;place-items:center;flex-shrink:0;width:44px;height:44px;border-radius:50%;background:#f5f3ff;color:#7c3aed;font-size:17px;font-weight:800}

.staffPickInfo{display:flex;flex:1;flex-direction:column;gap:5px;min-width:0}

.staffPickInfo strong{font-size:13px;overflow-wrap:anywhere}

.staffPickInfo small,.staffInfo small{color:#82798a;font-size:11px;overflow-wrap:anywhere}

.staffPickInfo .staffWage{color:#7c3aed;font-weight:700}

.staffCheck{display:grid;place-items:center;flex-shrink:0;width:25px;height:25px;border:1px solid #dcd2e5;border-radius:7px;color:#6b527e;background:#fff;font-weight:800}

.staffPickCard.selected .staffCheck{border-color:#7c3aed;background:#7c3aed;color:#fff}

.staffPickerFooter{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;padding-top:17px;margin-top:18px;border-top:1px solid #eee8f1;color:#82798a;font-size:12px}

.staffPickerActions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}

.staffPickerActions button{min-height:38px}

.staffEmpty{display:flex;flex-direction:column;align-items:center;gap:7px;padding:25px 15px;border:1px dashed #dcd2e5;border-radius:12px;background:#fff;color:#82798a;text-align:center}

.staffEmpty strong{color:#7c3aed;font-size:13px}

.staffEmpty p{margin:0;font-size:12px}

.assignedHeader{margin-top:28px}

.staffrow{display:flex;align-items:center;gap:12px;border:1px solid #eee8f1;border-radius:11px;padding:13px;margin-top:9px}

.assignedAvatar{width:42px;height:42px}

.staffInfo{flex:1;min-width:100px;display:flex;flex-direction:column;gap:5px}

.staffInfo b,.staffrow b{font-size:12px;overflow-wrap:anywhere}

.staffrow small{font-size:10px;color:#82798a}

.staffDuty{display:flex;flex-direction:column;gap:6px;width:200px}

.staffDuty label{color:#82798a;font-size:11px;font-weight:700}

.team{width:100%}

.pill{border-radius:30px;background:#f3eaf7;color:#603b7d;padding:7px 10px;font-size:11px;font-weight:800}

.task{display:flex;align-items:center;gap:12px;padding:15px;border:1px solid #eee8f1;border-radius:11px;margin-top:9px;cursor:pointer}

.task input{accent-color:#7c3aed}

.task span{flex:1;font-size:13px;font-weight:700}

.task span.done{text-decoration:line-through;color:#9991a1}

.task small{font-size:10px;color:#82798a}

.paymentmetrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-bottom:18px}

.paymentmetrics div{background:#faf8fb;border-radius:10px;padding:15px;display:flex;flex-direction:column;gap:8px}

.paymentmetrics b{font-size:20px;color:#7c3aed;overflow-wrap:anywhere}

.paper{max-width:900px;margin:auto;border:1px solid #eee8f1;padding:clamp(18px,4vw,42px);border-radius:12px}

.brand{display:flex;align-items:center;gap:13px}

.brand h2{font-size:21px;letter-spacing:.12em;color:#1e0836}

.brand small{display:block;color:#7c3aed;font-size:9px;letter-spacing:.16em;margin-top:5px}

.logo{width:48px;height:48px;display:grid;place-items:center;border-radius:14px;background:linear-gradient(135deg, #a855f7 0%, #7c3aed 100%);color:#fff;font-weight:900;box-shadow:0 4px 12px rgba(124, 58, 237, 0.35)}

.paper hr{border:0;height:2px;background:linear-gradient(90deg, #a855f7, #7c3aed);margin:25px 0}

.quoteMeta{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:22px;margin-bottom:25px}

.quoteMeta div{display:flex;flex-direction:column;gap:6px;overflow-wrap:anywhere}

.quoteMeta b{font-size:12px}

.quoteMeta span{font-size:11px;color:#82798a}

.quoteInput{margin:22px 0}

.quoteInput label{font-size:12px;color:#82798a;display:block}

.quoteInput input{display:block;max-width:280px;margin-top:8px}

.grand{display:flex;align-items:center;justify-content:space-between;gap:15px;padding:20px;background:linear-gradient(135deg, #180828 0%, #2b0c4c 100%);color:#fff;border-radius:10px;margin-top:20px}

.grand span{font-size:11px;letter-spacing:.12em;color:#c084fc;font-weight:800}

.grand b{font-size:clamp(20px,3vw,29px)}

.foot{font-size:11px;color:#82798a;line-height:1.7;margin-top:24px}

.muted{color:#82798a;font-size:11px}

.footer{max-width:1500px;margin:22px auto 0;display:flex;justify-content:space-between;gap:10px;color:#9991a1;font-size:10px}


.subTeamsCard{max-width:1500px;margin:0 auto}
.subTeamsHeader{margin-bottom:22px}
.subTeamForm{border:1px solid #eee8f1;background:#fcfbfd;border-radius:14px;padding:18px;margin-bottom:26px}
.subTeamForm h3{margin:0 0 16px;color:#2a1a37;font-size:15px}
.subTeamFields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
.subTeamFields label{display:flex;flex-direction:column;gap:7px;color:#62566e;font-size:11px;font-weight:750}
.subTeamFields .required{color:#a14b54}
.subTeamNote{grid-column:1/-1}
.subTeamFields textarea{resize:vertical}
.subTeamFormActions{display:flex;gap:9px;justify-content:flex-end;flex-wrap:wrap;margin-top:15px}
.subTeamGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
.subTeamCard{border:1px solid #eee8f1;border-radius:13px;padding:16px;min-width:0;background:#fff}
.subTeamCardTop{display:flex;align-items:center;gap:11px;margin-bottom:16px}
.subTeamIcon{display:grid;place-items:center;width:42px;height:42px;border-radius:12px;background:#f5f3ff;color:#7c3aed;font-size:12px;font-weight:900;flex-shrink:0}
.subTeamTitle{flex:1;min-width:0}
.subTeamTitle h3{font-size:14px;margin:0 0 4px;color:#2a1a37;overflow-wrap:anywhere}
.subTeamTitle small{font-size:10px;color:#82798a}
.subTeamDetails{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
.subTeamDetails div{display:flex;flex-direction:column;gap:6px;min-width:0}
.subTeamDetails small{font-size:10px;color:#82798a}
.subTeamDetails b{font-size:11px;overflow-wrap:anywhere}
.subTeamNoteText{font-size:11px;color:#716778;line-height:1.6;border-top:1px solid #f0edf2;padding-top:11px;margin:13px 0 0;white-space:pre-wrap}

.topNavLinks{margin-bottom:10px}
.backBtn{border:0;background:transparent;color:#716778;font-size:12px;font-weight:750;cursor:pointer;padding:0;transition:color .2s;display:inline-flex;align-items:center;gap:4px}
.backBtn:hover{color:#7c3aed;text-decoration:underline}
.titleRow{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin:8px 0}
.titleRow h1{margin:0}
.pillPaid{background:#e6f8ec;color:#1e7e45}
.pillPartial{background:#fff4e5;color:#b45309}
.pillUnpaid{background:#fde8e8;color:#9b1c1c}
.pillOverpaid{background:#e0f2fe;color:#0369a1}
.pillMuted{background:#f3eaf7;color:#603b7d}
.metricSuccess strong{color:#1e7e45!important}
.metricWarning strong{color:#b45309!important}
.metricInfo strong{color:#7c3aed!important}
.textGreen{color:#1e7e45!important}
.textRed{color:#b42318!important}
.paymentsCard{max-width:1500px;margin:0 auto}
.paymentsHead{margin-bottom:20px}
.paymentHeadActions{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.subTabToggle{display:flex;background:#eee9f2;border-radius:10px;padding:3px;gap:3px}
.subTabToggle button{border:0;background:transparent;padding:6px 14px;border-radius:8px;font-size:12px;font-weight:700;color:#6d5f78;cursor:pointer}
.subTabToggle button.subTabActive{background:#fff;color:#7c3aed;box-shadow:0 1px 4px rgba(0,0,0,0.08)}
.paymentProgressWrap{background:#faf8fb;border:1px solid #eee8f1;border-radius:12px;padding:14px 18px;margin-bottom:20px}
.paymentProgressLabels{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;font-size:12px;color:#62566e}
.paymentProgressBar{height:10px;background:#eee8f1;border-radius:10px;overflow:hidden}
.paymentProgressFill{height:100%;border-radius:10px;transition:width .3s ease}
.fillPaid{background:linear-gradient(90deg, #10b981, #059669)}
.fillPartial{background:linear-gradient(90deg, #f59e0b, #d97706)}
.paymentFormCard{border:1px solid #eee8f1;background:#fcfbfd;border-radius:14px;padding:18px;margin-bottom:24px}
.paymentFormHeader{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:16px}
.paymentFormHeader h3,.paymentFormCard h3{margin:0 0 16px;font-size:15px;color:#2a1a37}
.paymentFormHeader h3{margin:0}
.quickPayBtn{background:#f5f3ff;color:#6d28d9;border:1px solid #ddd6fe;padding:6px 12px;font-size:11px}
.paymentFormFields{display:grid;grid-template-columns:repeat(auto-fit, minmax(200px, 1fr));gap:14px}
.paymentFormFields label{display:flex;flex-direction:column;gap:7px;color:#62566e;font-size:11px;font-weight:750}
.spanFull{grid-column:1/-1}
.paymentFormActions{display:flex;gap:10px;justify-content:flex-end;margin-top:16px}
.badgeCategory{display:inline-block;padding:3px 9px;border-radius:20px;background:#f3eaf7;color:#5a377d;font-size:10px;font-weight:800}
.badgeMethod{display:inline-block;padding:3px 9px;border-radius:20px;background:#eef2f6;color:#334155;font-size:10px;font-weight:700}
.tableSummaryRow td{background:#faf8fb;font-weight:700;border-top:2px solid #e2d9e8}
.quotePaymentSummary{margin-top:20px;background:#faf8fb;border:1px solid #eee8f1;border-radius:10px;padding:16px;display:flex;flex-direction:column;gap:10px}
.quotePaymentRow{display:flex;justify-content:space-between;align-items:center;font-size:13px}
.quotePaymentRow.grandBalance{padding-top:10px;border-top:1px dashed #dcd2e5;font-size:15px}
.quoteReceiptsSection{margin-top:22px}
.quoteReceiptsSection h4{margin:0 0 10px;font-size:13px;color:#2a1a37}
.quoteReceiptsTable{border:1px solid #eee8f1}

@media(max-width:900px){.subTeamGrid{grid-template-columns:1fr}}
@media(max-width:680px){.subTeamFields{grid-template-columns:1fr}.subTeamNote{grid-column:auto}.subTeamDetails{grid-template-columns:1fr}.subTeamFormActions{flex-direction:column}.subTeamFormActions button{width:100%}}


@media(max-width:1000px){.metrics{grid-template-columns:repeat(3,minmax(0,1fr))}.details{grid-template-columns:repeat(2,minmax(0,1fr))}.staffGrid{grid-template-columns:repeat(2,minmax(0,1fr))}}

@media(max-width:680px){.fc{padding:15px 11px}.metrics{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.grid{grid-template-columns:1fr}.card{padding:15px}.add{flex-wrap:wrap}.add>*{flex-basis:100%}.search{max-width:none}.paymentmetrics{grid-template-columns:1fr}.quoteMeta{grid-template-columns:1fr}.staffPicker{padding:12px}.staffGrid{grid-template-columns:1fr}.staffPickerFooter{align-items:stretch;flex-direction:column}.staffPickerActions{width:100%}.staffPickerActions button{flex:1}.staffrow{align-items:stretch;flex-wrap:wrap}.staffInfo{flex-basis:calc(100% - 65px)}.staffDuty{flex:1;min-width:130px}.footer{flex-direction:column}}

@media print{body{background:#fff}.fc{padding:0;background:#fff}.top,.metrics,.tabs,.footer,.no-print,.alert{display:none!important}.card{box-shadow:none;border:0;padding:0}.paper{border:0;padding:0;max-width:none}.grand{print-color-adjust:exact;-webkit-print-color-adjust:exact}}

`;