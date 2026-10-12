"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Phone, Mail, MapPin, Plus, Trash2 } from "lucide-react";
import { ClientForm } from "@/components/client-form";

type EmergencyContact = {
  id: string;
  name: string;
  relationship: string;
  phone: string;
  email?: string | null;
  isPrimary: boolean;
};

type ClientDetailData = {
  id: string;
  clientReference: string;
  firstName: string;
  lastName: string;
  preferredName?: string | null;
  dateOfBirth?: string | null;
  email?: string | null;
  phone?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  postcode?: string | null;
  careNotes?: string | null;
  status: string;
  createdAt: string;
  updatedAt?: string;
  emergencyContacts?: EmergencyContact[];
};

type CurrentUser = { role: string };

const statusColors: Record<string, string> = {
  ACTIVE: "bg-emerald-50 text-emerald-800",
  INACTIVE: "bg-amber-50 text-amber-800",
  ARCHIVED: "bg-slate-100 text-slate-600",
};

const statusLabel: Record<string, string> = {
  ACTIVE: "Active",
  INACTIVE: "Inactive",
  ARCHIVED: "Archived",
};

export function ClientDetail({ id }: { id: string }) {
  const [client, setClient] = useState<ClientDetailData>();
  const [role, setRole] = useState("");
  const [editing, setEditing] = useState(false);
  const [addingContact, setAddingContact] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(true);

  async function load() {
    setBusy(true);
    try {
      const [clientResponse, meResponse] = await Promise.all([
        fetch(`/api/v1/clients/${id}`),
        fetch("/api/v1/me"),
      ]);
      const [clientBody, meBody] = await Promise.all([clientResponse.json(), meResponse.json()]);
      if (!clientResponse.ok) throw new Error(clientBody.error ?? "Unable to load client.");
      if (!meResponse.ok) throw new Error(meBody.error ?? "Unable to load your access details.");
      setClient(clientBody.data);
      setRole((meBody.data as CurrentUser).role);
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load client.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    let active = true;
    Promise.all([fetch(`/api/v1/clients/${id}`), fetch("/api/v1/me")])
      .then(async ([clientResponse, meResponse]) => {
        const [clientBody, meBody] = await Promise.all([clientResponse.json(), meResponse.json()]);
        if (!clientResponse.ok) throw new Error(clientBody.error ?? "Unable to load client.");
        if (!meResponse.ok) throw new Error(meBody.error ?? "Unable to load your access details.");
        if (active) {
          setClient(clientBody.data);
          setRole((meBody.data as CurrentUser).role);
        }
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : "Unable to load client.");
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => { active = false; };
  }, [id]);

  async function archiveClient() {
    if (!window.confirm("Archive this client? Their records will be retained but they will no longer appear in active lists.")) return;
    const response = await fetch(`/api/v1/clients/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "ARCHIVED" }),
    });
    const body = await response.json();
    if (!response.ok) setError(body.error ?? "Unable to archive client.");
    else await load();
  }

  if (busy) return <p className="py-12 text-center text-sm text-slate-500">Loading client…</p>;
  if (error || !client) return <div role="alert" className="rounded-xl bg-rose-50 p-5 text-sm text-rose-800">{error || "Client not found."}</div>;

  const canUpdate = ["ORG_ADMIN", "MANAGER", "COORDINATOR"].includes(role);
  const canArchive = ["ORG_ADMIN", "MANAGER"].includes(role);
  const address = [client.addressLine1, client.addressLine2, client.city, client.postcode].filter(Boolean).join(", ");

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link href="/clients" className="text-sm font-medium text-teal-700 hover:text-teal-900">← Client directory</Link>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        {editing ? (
          <>
            <h1 className="mb-6 text-2xl font-semibold text-slate-900">Edit client</h1>
            <ClientForm
              id={id}
              initial={{
                ...client,
                preferredName: client.preferredName ?? "",
                dateOfBirth: client.dateOfBirth?.slice(0, 10) ?? "",
                email: client.email ?? "",
                phone: client.phone ?? "",
                addressLine1: client.addressLine1 ?? "",
                addressLine2: client.addressLine2 ?? "",
                city: client.city ?? "",
                postcode: client.postcode ?? "",
                careNotes: client.careNotes ?? "",
              }}
            />
          </>
        ) : (
          <>
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
              <div>
                <p className="text-sm font-medium text-teal-700">{client.clientReference}</p>
                <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">
                  {client.firstName} {client.lastName}
                </h1>
                {client.preferredName && (
                  <p className="mt-1 text-slate-500">Prefers: {client.preferredName}</p>
                )}
              </div>
              <span className={`w-fit rounded-full px-3 py-1 text-sm font-medium ${statusColors[client.status] ?? "bg-slate-100 text-slate-600"}`}>
                {statusLabel[client.status] ?? client.status}
              </span>
            </div>

            <dl className="mt-8 grid gap-5 border-t border-slate-200 pt-6 sm:grid-cols-2">
              {client.dateOfBirth && (
                <Detail label="Date of birth" value={new Date(client.dateOfBirth).toLocaleDateString("en-GB")} />
              )}
              {client.phone && (
                <div className="flex items-start gap-2">
                  <Phone size={16} className="mt-1 text-slate-400" />
                  <Detail label="Phone" value={client.phone} />
                </div>
              )}
              {client.email && (
                <div className="flex items-start gap-2">
                  <Mail size={16} className="mt-1 text-slate-400" />
                  <Detail label="Email" value={client.email} />
                </div>
              )}
              {address && (
                <div className="flex items-start gap-2 sm:col-span-2">
                  <MapPin size={16} className="mt-1 shrink-0 text-slate-400" />
                  <Detail label="Address" value={address} />
                </div>
              )}
              <Detail label="Profile created" value={new Date(client.createdAt).toLocaleDateString("en-GB")} />
            </dl>

            {client.careNotes && (
              <div className="mt-6 border-t border-slate-200 pt-6">
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Care notes</dt>
                <dd className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{client.careNotes}</dd>
              </div>
            )}

            <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-slate-200 pt-5">
              {canUpdate && (
                <button onClick={() => setEditing(true)} className="h-10 rounded-lg bg-teal-700 px-4 text-sm font-semibold text-white hover:bg-teal-800">
                  Edit client
                </button>
              )}
              {canArchive && client.status !== "ARCHIVED" && (
                <button onClick={archiveClient} className="h-10 rounded-lg border border-rose-200 px-4 text-sm font-semibold text-rose-700 hover:bg-rose-50">
                  Archive
                </button>
              )}
            </div>
          </>
        )}
      </section>

      {/* Emergency Contacts Section */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Emergency contacts</h2>
          {canUpdate && !addingContact && (
            <button
              onClick={() => setAddingContact(true)}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-teal-700 hover:text-teal-900"
            >
              <Plus size={16} /> Add contact
            </button>
          )}
        </div>

        {addingContact && (
          <EmergencyContactForm
            clientId={id}
            onCancel={() => setAddingContact(false)}
            onSaved={() => {
              setAddingContact(false);
              load();
            }}
          />
        )}

        {client.emergencyContacts && client.emergencyContacts.length > 0 ? (
          <div className="mt-4 divide-y divide-slate-100">
            {client.emergencyContacts.map((contact) => (
              <div key={contact.id} className="flex items-start justify-between py-4">
                <div>
                  <p className="font-medium text-slate-900">
                    {contact.name}
                    {contact.isPrimary && (
                      <span className="ml-2 rounded-full bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-700">Primary</span>
                    )}
                  </p>
                  <p className="mt-0.5 text-sm text-slate-500">{contact.relationship}</p>
                  <div className="mt-2 flex flex-wrap gap-4 text-sm text-slate-600">
                    <span className="flex items-center gap-1">
                      <Phone size={14} className="text-slate-400" /> {contact.phone}
                    </span>
                    {contact.email && (
                      <span className="flex items-center gap-1">
                        <Mail size={14} className="text-slate-400" /> {contact.email}
                      </span>
                    )}
                  </div>
                </div>
                {canUpdate && (
                  <DeleteContactButton contactId={contact.id} clientId={id} onDeleted={load} />
                )}
              </div>
            ))}
          </div>
        ) : !addingContact && (
          <p className="mt-4 text-sm text-slate-500">No emergency contacts registered.</p>
        )}
      </section>
    </div>
  );
}

function EmergencyContactForm({
  clientId,
  onCancel,
  onSaved,
}: {
  clientId: string;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const fields = new FormData(event.currentTarget);
    try {
      const response = await fetch(`/api/v1/clients/${clientId}/emergency-contacts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: fields.get("name"),
          relationship: fields.get("relationship"),
          phone: fields.get("phone"),
          email: fields.get("email") || null,
          isPrimary: fields.get("isPrimary") === "on",
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Unable to add contact.");
      onSaved();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to add contact.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-medium text-slate-700">
          Name <span className="text-rose-500">*</span>
          <input className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm" name="name" required />
        </label>
        <label className="text-sm font-medium text-slate-700">
          Relationship <span className="text-rose-500">*</span>
          <input className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm" name="relationship" required />
        </label>
        <label className="text-sm font-medium text-slate-700">
          Phone <span className="text-rose-500">*</span>
          <input className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm" name="phone" type="tel" required />
        </label>
        <label className="text-sm font-medium text-slate-700">
          Email
          <input className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm" name="email" type="email" />
        </label>
        <label className="flex items-center gap-2 text-sm font-medium text-slate-700 sm:col-span-2">
          <input type="checkbox" name="isPrimary" className="size-4 rounded border-slate-300" />
          Primary contact
        </label>
      </div>
      {message && <p role="alert" className="mt-3 text-sm text-rose-700">{message}</p>}
      <div className="mt-4 flex gap-3">
        <button disabled={busy} className="h-9 rounded-lg bg-teal-700 px-4 text-sm font-semibold text-white disabled:opacity-60">
          {busy ? "Saving…" : "Add contact"}
        </button>
        <button type="button" onClick={onCancel} className="h-9 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700">
          Cancel
        </button>
      </div>
    </form>
  );
}

function DeleteContactButton({
  contactId,
  clientId,
  onDeleted,
}: {
  contactId: string;
  clientId: string;
  onDeleted: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);

  async function handleDelete() {
    if (!window.confirm("Remove this emergency contact?")) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/v1/clients/${clientId}/emergency-contacts/${contactId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const body = await response.json();
        throw new Error(body.error ?? "Unable to delete contact.");
      }
      await onDeleted();
    } catch {
      // Error handling is silent for delete, contact remains
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={handleDelete}
      disabled={busy}
      className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-rose-600 disabled:opacity-50"
      title="Remove contact"
    >
      <Trash2 size={16} />
    </button>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 text-sm text-slate-900">{value}</dd>
    </div>
  );
}
