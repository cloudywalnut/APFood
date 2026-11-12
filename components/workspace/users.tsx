"use client";

import { useCallback, useState } from "react";
import { apiClient } from "../../lib/backend/client";
import { ErrorMessage, Modal, replaceFilters } from "../shared";
import { useSearchParams } from "next/navigation";
import { messageOf, RemoteStatus, useApi, useRemote } from "./common";

type User = Awaited<ReturnType<typeof apiClient.users>>["users"][number];
type Membership = User["memberships"][number];

export function Users() {
  const api = useApi();
  const params = useSearchParams();
  const search = params.get("search") ?? "";
  const role = params.get("role") ?? "";
  const status = params.get("status") ?? "";
  const page = Math.max(1, Number(params.get("page")) || 1);
  const [input, setInput] = useState(search);
  const load = useCallback(
    () => api.users(new URLSearchParams({ search, role, status, page: String(page) })),
    [api, search, role, status, page],
  );
  const result = useRemote(load);
  const vendors = useRemote(apiClient.vendors);
  const [selected, setSelected] = useState<User>();
  const [invite, setInvite] = useState(false);
  return (
    <div className="stack">
      <div className="line spread wrap">
        <p className="muted">Manage people, workspace access, and stall assignments.</p>
        <button className="button primary" onClick={() => setInvite(true)}>
          Invite user
        </button>
      </div>
      <form
        className="filters"
        onSubmit={(event) => {
          event.preventDefault();
          replaceFilters({ search: input, page: "1" });
        }}
      >
        <label className="field grow">
          Find a user
          <input
            type="search"
            maxLength={100}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Name or email"
          />
        </label>
        <button className="button secondary">Search</button>
        <label className="field compact">
          Role
          <select value={role} onChange={(event) => replaceFilters({ role: event.target.value, page: "1" })}>
            <option value="">All roles</option>
            {["student", "vendor", "admin"].map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label className="field compact">
          Status
          <select value={status} onChange={(event) => replaceFilters({ status: event.target.value, page: "1" })}>
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
          </select>
        </label>
      </form>
      {!result.value ? (
        <RemoteStatus error={result.error} reload={result.reload} />
      ) : (
        <section className="panel">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Person</th>
                  <th>Email</th>
                  <th>Access</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {result.value.users.map((user) => (
                  <tr key={user.id}>
                    <th scope="row">
                      {user.display_name || "Account"}
                      <small>{user.email_confirmed_at ? "Verified" : "Email awaiting confirmation"}</small>
                    </th>
                    <td>{user.email}</td>
                    <td>
                      {user.memberships
                        .map(
                          (entry) =>
                            entry.role +
                            (entry.vendor_id
                              ? " · " +
                                (vendors.value?.find((stall) => stall.id === entry.vendor_id)?.name ?? entry.vendor_id)
                              : ""),
                        )
                        .join(", ")}
                    </td>
                    <td>
                      <span className={"badge " + (user.status === "active" ? "good" : "warning")}>{user.status}</span>
                    </td>
                    <td>
                      <button className="button secondary" onClick={() => setSelected(user)}>
                        Manage access
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!result.value.users.length && <p>No accounts match these filters.</p>}
          <div className="line spread wrap">
            <p className="small muted">
              {result.value.total} users · Page {page}
            </p>
            <div className="line">
              <button
                className="button secondary"
                disabled={page <= 1}
                onClick={() => replaceFilters({ page: String(page - 1) })}
              >
                Previous
              </button>
              <button
                className="button secondary"
                disabled={page * 20 >= result.value.total}
                onClick={() => replaceFilters({ page: String(page + 1) })}
              >
                Next
              </button>
            </div>
          </div>
        </section>
      )}
      {selected && (
        <UserAccess
          user={selected}
          stalls={vendors.value ?? []}
          close={() => setSelected(undefined)}
          saved={() => {
            setSelected(undefined);
            result.reload();
          }}
        />
      )}
      {invite && (
        <InviteUser
          stalls={vendors.value ?? []}
          close={() => setInvite(false)}
          saved={() => {
            setInvite(false);
            result.reload();
          }}
        />
      )}
    </div>
  );
}

type Stall = { id: string; name: string };
function UserAccess({
  user,
  stalls,
  close,
  saved,
}: {
  user: User;
  stalls: Stall[];
  close: () => void;
  saved: () => void;
}) {
  const api = useApi();
  const [memberships, setMemberships] = useState(user.memberships);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const audit = useRemote(api.audit);
  function toggle(entry: Membership, checked: boolean) {
    setMemberships((current) =>
      checked
        ? [...current, entry]
        : current.filter((value) => value.role !== entry.role || value.vendor_id !== entry.vendor_id),
    );
  }
  return (
    <Modal
      title={"Manage " + (user.display_name || user.email)}
      close={() => {
        if (!busy) close();
      }}
    >
      <form
        className="stack"
        onSubmit={async (event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          setBusy(true);
          setError("");
          try {
            await api.manageUser(user.id, {
              memberships,
              status: data.get("status") === "suspended" ? "suspended" : "active",
              reason: String(data.get("reason")),
            });
            saved();
          } catch (problem) {
            setError(messageOf(problem));
          } finally {
            setBusy(false);
          }
        }}
      >
        <p>{user.email}</p>
        <fieldset className="stack">
          <legend>Workspace access</legend>
          {(["student", "admin"] as const).map((role) => (
            <label className="check" key={role}>
              <input
                type="checkbox"
                checked={memberships.some((entry) => entry.role === role)}
                onChange={(event) => toggle({ role, vendor_id: null }, event.target.checked)}
              />
              {role === "admin" ? "Administrator" : "Student ordering"}
            </label>
          ))}
        </fieldset>
        <fieldset className="stack">
          <legend>Vendor stall assignments</legend>
          {stalls.map((stall) => (
            <label className="check" key={stall.id}>
              <input
                type="checkbox"
                checked={memberships.some((entry) => entry.role === "vendor" && entry.vendor_id === stall.id)}
                onChange={(event) => toggle({ role: "vendor", vendor_id: stall.id }, event.target.checked)}
              />
              {stall.name}
            </label>
          ))}
        </fieldset>
        <label className="field">
          Account status
          <select name="status" defaultValue={user.status}>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
          </select>
        </label>
        <label className="field">
          Reason for this change
          <textarea name="reason" required maxLength={250} />
        </label>
        <ErrorMessage message={error} />
        <button className="button primary" disabled={busy || !memberships.length}>
          {busy ? "Saving…" : "Save access"}
        </button>
      </form>
      <details className="account-form">
        <summary>Recent account activity</summary>
        {audit.value
          ?.filter((entry) => entry.target === user.id)
          .map((entry) => (
            <p key={entry.id}>
              {entry.action} · {entry.reason}
            </p>
          ))}
        {!audit.value?.some((entry) => entry.target === user.id) && (
          <p className="small muted">No recent account changes.</p>
        )}
      </details>
    </Modal>
  );
}

function InviteUser({ stalls, close, saved }: { stalls: Stall[]; close: () => void; saved: () => void }) {
  const api = useApi();
  const [role, setRole] = useState<"student" | "vendor" | "admin">("student");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <Modal
      title="Invite a user"
      close={() => {
        if (!busy) close();
      }}
    >
      <form
        className="stack"
        onSubmit={async (event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          setBusy(true);
          setError("");
          try {
            await api.invite({
              email: String(data.get("email")),
              displayName: String(data.get("name")),
              role,
              vendorId: role === "vendor" ? String(data.get("stall")) : null,
            });
            saved();
          } catch (problem) {
            setError(messageOf(problem));
          } finally {
            setBusy(false);
          }
        }}
      >
        <label className="field">
          Name
          <input name="name" required maxLength={80} autoComplete="name" />
        </label>
        <label className="field">
          Email
          <input name="email" required type="email" autoComplete="email" />
        </label>
        <label className="field">
          Role
          <select value={role} onChange={(event) => setRole(event.target.value as typeof role)}>
            <option value="student">Student</option>
            <option value="vendor">Vendor</option>
            <option value="admin">Administrator</option>
          </select>
        </label>
        {role === "vendor" && (
          <label className="field">
            Stall
            <select name="stall" required>
              {stalls.map((stall) => (
                <option key={stall.id} value={stall.id}>
                  {stall.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <ErrorMessage message={error} />
        <button className="button primary" disabled={busy}>
          {busy ? "Sending invitation…" : "Send invitation"}
        </button>
      </form>
    </Modal>
  );
}
