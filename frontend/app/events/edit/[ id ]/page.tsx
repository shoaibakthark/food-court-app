
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth, fetchWithAuth } from "../../../lib/auth";

type EventData = {
  id: number;
  customer_id: number | null;
  customer_name?: string;
  date: string | null;
  place: string | null;
  guest_count: number;
  event_type: string | null;
  food_amt: number;
  decor_amt: number;
  total_estimate: number;
  quote: string | null;
};

type Customer = {
  id: number;
  name: string;
};

const API = typeof window !== "undefined" ? "/api/py" : "http://127.0.0.1:8000";

export default function EventDetailsPage() {
  const { user, isOwner, isManager } = useAuth();
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;

  useEffect(() => {
    if (isOwner) {
      router.replace("/events");
    }
  }, [isOwner, router]);

  const [event, setEvent] = useState<EventData | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      setLoading(true);
      setMessage("");
      setEvent(null);

      if (!id || !/^\d+$/.test(id)) {
        setMessage(`Invalid event ID in URL: "${id}"`);
        setLoading(false);
        return;
      }

      try {
        const [eventResponse, customerResponse] = await Promise.all([
          fetch(`${API}/events/${encodeURIComponent(id)}`),
          fetch(`${API}/customers`),
        ]);

        if (!eventResponse.ok) {
          const errorText = await eventResponse.text();
          throw new Error(
            `Event API error (${eventResponse.status}): ${
              errorText || eventResponse.statusText
            }`
          );
        }

        if (!customerResponse.ok) {
          throw new Error(
            `Customers API error (${customerResponse.status})`
          );
        }

        const eventData: EventData = await eventResponse.json();
        const customerData: Customer[] = await customerResponse.json();

        console.log("Event URL ID:", id);
        console.log("Event API response:", eventData);

        if (cancelled) return;

        if (!eventData || Number(eventData.id) !== Number(id)) {
          throw new Error(
            `The API returned event ID ${eventData?.id}, but the URL requests event ID ${id}.`
          );
        }

        setEvent(eventData);
        setCustomers(customerData);
      } catch (error) {
        if (cancelled) return;

        console.error("Failed to load event:", error);
        setMessage(
          error instanceof Error
            ? error.message
            : "Could not load event details. Check the API server."
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadData();

    return () => {
      cancelled = true;
    };
  }, [id]);

  function updateField(
    field: keyof EventData,
    value: string | number | null
  ) {
    setEvent((previous) =>
      previous ? { ...previous, [field]: value } : previous
    );
  }

  async function saveEvent() {
    if (!event) return;

    setSaving(true);
    setMessage("");

    try {
      const response = await fetch(`${API}/events/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          customer_id: event.customer_id,
          date: event.date || null,
          place: event.place || "",
          guest_count: Number(event.guest_count) || 0,
          event_type: event.event_type || "",
          food_amt: Number(event.food_amt) || 0,
          decor_amt: Number(event.decor_amt) || 0,
          total_estimate: Number(event.total_estimate) || 0,
          quote: event.quote || "",
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Save failed (${response.status}): ${errorText}`
        );
      }

      const result = await response.json().catch(() => null);

      if (result && typeof result === "object" && result.id) {
        setEvent(result as EventData);
      }

      setMessage("Event saved successfully.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not save event."
      );
    } finally {
      setSaving(false);
    }
  }

  const inputClass =
    "mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 outline-none focus:border-red-700";

  if (loading) {
    return <main className="p-8">Loading event details...</main>;
  }

  if (!event) {
    return (
      <main className="min-h-screen bg-gray-50 p-8">
        <button
          onClick={() => router.push("/events")}
          className="font-semibold text-red-800"
        >
          ← Back to Events
        </button>

        <p className="mt-4 font-semibold text-red-700">
          {message || "Event not found."}
        </p>

        <p className="mt-2 text-sm text-gray-600">
          Requested event ID: {id}
        </p>

        <p className="mt-2 text-sm text-gray-600">
          Check the browser console for the detailed error.
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 p-4 sm:p-8">
      <div className="mx-auto max-w-5xl">
        <button
          onClick={() => router.push("/events")}
          className="mb-4 text-sm font-semibold text-red-800"
        >
          ← Back to Events
        </button>

        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Event #{event.id}
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              View and edit event information.
            </p>
          </div>

          <button
            onClick={saveEvent}
            disabled={saving}
            className="rounded-lg bg-red-800 px-5 py-3 font-semibold text-white disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>

        {message && (
          <div className="mb-4 rounded-lg bg-white p-3 text-sm shadow-sm">
            {message}
          </div>
        )}

        <section className="rounded-2xl border bg-white p-5 shadow-sm sm:p-7">
          <h2 className="mb-5 text-xl font-bold">
            Event Information
          </h2>

          <div className="grid gap-5 sm:grid-cols-2">
            <label className="text-sm font-medium text-gray-700">
              Customer
              <select
                className={inputClass}
                value={event.customer_id ?? ""}
                onChange={(e) =>
                  updateField(
                    "customer_id",
                    e.target.value
                      ? Number(e.target.value)
                      : null
                  )
                }
              >
                <option value="">Select customer</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm font-medium text-gray-700">
              Event Date
              <input
                type="date"
                className={inputClass}
                value={event.date ? event.date.slice(0, 10) : ""}
                onChange={(e) =>
                  updateField("date", e.target.value || null)
                }
              />
            </label>

            <label className="text-sm font-medium text-gray-700">
              Event Type
              <input
                className={inputClass}
                value={event.event_type || ""}
                onChange={(e) =>
                  updateField("event_type", e.target.value)
                }
              />
            </label>

            <label className="text-sm font-medium text-gray-700">
              Venue / Place
              <input
                className={inputClass}
                value={event.place || ""}
                onChange={(e) =>
                  updateField("place", e.target.value)
                }
              />
            </label>

            <label className="text-sm font-medium text-gray-700">
              Number of Guests
              <input
                type="number"
                min="0"
                className={inputClass}
                value={event.guest_count ?? 0}
                onChange={(e) =>
                  updateField("guest_count", Number(e.target.value))
                }
              />
            </label>

            <label className="text-sm font-medium text-gray-700">
              Food Amount
              <input
                type="number"
                min="0"
                className={inputClass}
                value={event.food_amt ?? 0}
                onChange={(e) =>
                  updateField("food_amt", Number(e.target.value))
                }
              />
            </label>

            <label className="text-sm font-medium text-gray-700">
              Decor Amount
              <input
                type="number"
                min="0"
                className={inputClass}
                value={event.decor_amt ?? 0}
                onChange={(e) =>
                  updateField("decor_amt", Number(e.target.value))
                }
              />
            </label>

            <label className="text-sm font-medium text-gray-700">
              Total Estimate
              <input
                type="number"
                min="0"
                className={inputClass}
                value={event.total_estimate ?? 0}
                onChange={(e) =>
                  updateField("total_estimate", Number(e.target.value))
                }
              />
            </label>

            <label className="text-sm font-medium text-gray-700 sm:col-span-2">
              Quote / Notes
              <textarea
                rows={4}
                className={inputClass}
                value={event.quote || ""}
                onChange={(e) =>
                  updateField("quote", e.target.value)
                }
              />
            </label>
          </div>

          <div className="mt-7 flex justify-end">
            <button
              onClick={saveEvent}
              disabled={saving}
              className="rounded-lg bg-red-800 px-6 py-3 font-semibold text-white disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
