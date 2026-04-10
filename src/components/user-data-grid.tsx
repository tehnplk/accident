"use client";

import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export type UserGridRow = {
  id: number;
  username: string;
  hcode: string;
  hname: string;
  is_active: boolean;
  not_hospital: boolean;
  created_at: string;
  updated_at: string;
};

type UserDataGridProps = {
  initialRows: UserGridRow[];
  userName?: string | null;
};

type UserFormState = {
  username: string;
  password: string;
  confirmPassword: string;
  hcode: string;
  hname: string;
  is_active: boolean;
  not_hospital: boolean;
};

const EMPTY_FORM: UserFormState = {
  username: "",
  password: "",
  confirmPassword: "",
  hcode: "",
  hname: "",
  is_active: true,
  not_hospital: true,
};

function buildEditForm(row: UserGridRow): UserFormState {
  return {
    username: row.username,
    password: "",
    confirmPassword: "",
    hcode: row.hcode,
    hname: row.hname,
    is_active: row.is_active,
    not_hospital: row.not_hospital,
  };
}

export function UserDataGrid({ initialRows, userName }: UserDataGridProps) {
  const router = useRouter();
  const [rows, setRows] = useState(initialRows);
  const [query, setQuery] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<UserFormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [deleteBusyId, setDeleteBusyId] = useState<number | null>(null);

  const filteredRows = (() => {
    const term = query.trim().toLowerCase();
    if (!term) return rows;

    return rows.filter((row) =>
      [row.username, row.hcode, row.hname]
        .map((value) => value.toLowerCase())
        .some((value) => value.includes(term)),
    );
  })();

  function openCreateModal() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setErrorMessage(null);
    setIsModalOpen(true);
  }

  function openEditModal(row: UserGridRow) {
    setEditingId(row.id);
    setForm(buildEditForm(row));
    setErrorMessage(null);
    setIsModalOpen(true);
  }

  function closeModal() {
    setIsModalOpen(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setErrorMessage(null);
  }

  function updateForm<K extends keyof UserFormState>(key: K, value: UserFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setErrorMessage(null);

    const isEditing = editingId !== null;
    const payload: Record<string, unknown> = {
      username: form.username.trim(),
      hcode: form.hcode.trim(),
      hname: form.hname.trim(),
      is_active: form.is_active,
      not_hospital: form.not_hospital,
    };

    const password = form.password.trim();
    const confirmPassword = form.confirmPassword.trim();

    if ((!isEditing || password) && password !== confirmPassword) {
      setSubmitting(false);
      setErrorMessage("PASSWORD และ CONFIRM-PASSWORD ไม่ตรงกัน");
      return;
    }

    if (!isEditing || password) {
      payload.password = form.password;
    }

    try {
      const response = await fetch(isEditing ? `/api/users/${editingId}` : "/api/users", {
        method: isEditing ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const json = (await response.json()) as { message?: string; row?: UserGridRow };
      if (!response.ok || !json.row) {
        throw new Error(json.message || "Request failed");
      }

      if (isEditing) {
        setRows((current) => current.map((row) => (row.id === json.row!.id ? json.row! : row)));
      } else {
        setRows((current) => [json.row!, ...current]);
      }

      closeModal();
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to save user");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(row: UserGridRow) {
    const confirmed = window.confirm(`Delete user "${row.username}"?`);
    if (!confirmed) return;

    setDeleteBusyId(row.id);
    try {
      const response = await fetch(`/api/users/${row.id}`, {
        method: "DELETE",
      });
      const json = (await response.json()) as { message?: string };
      if (!response.ok) {
        throw new Error(json.message || "Delete failed");
      }

      setRows((current) => current.filter((item) => item.id !== row.id));
      router.refresh();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Failed to delete user");
    } finally {
      setDeleteBusyId(null);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-10">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <header className="rounded-[28px] border border-sky-100/80 bg-white/90 px-6 py-5 shadow-[0_18px_55px_rgba(37,99,235,0.08)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-500">Users</p>
              <h1 className="mt-2 text-2xl font-semibold text-slate-950">จัดการผู้ใช้งานระบบ</h1>
              <p className="mt-2 text-sm text-slate-500">
                เพิ่ม แก้ไข และลบข้อมูลผู้ใช้สำหรับการเข้าสู่ระบบ
              </p>
            </div>

            <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
              <nav className="flex items-center gap-2 text-sm font-medium">
                <Link
                  href="/"
                  className="rounded-full px-4 py-2 text-slate-600 transition hover:bg-slate-100 hover:text-slate-950"
                >
                  Dashboard
                </Link>
                <Link
                  href="/patient"
                  className="rounded-full px-4 py-2 text-slate-600 transition hover:bg-slate-100 hover:text-slate-950"
                >
                  Patient
                </Link>
                <Link
                  href="/sync-log"
                  className="rounded-full px-4 py-2 text-slate-600 transition hover:bg-slate-100 hover:text-slate-950"
                >
                  Sync Log
                </Link>
                <span className="rounded-full bg-sky-600 px-4 py-2 text-white shadow-sm">Users</span>
              </nav>
              <div className="rounded-full bg-slate-100 px-4 py-2 text-xs font-medium text-slate-600">
                {userName || "Signed in"}
              </div>
            </div>
          </div>
        </header>

        <section className="rounded-[28px] border border-sky-100/80 bg-white/95 p-5 shadow-[0_18px_55px_rgba(37,99,235,0.08)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col gap-1">
              <p className="text-sm font-semibold text-slate-900">Users DataGrid</p>
              <p className="text-sm text-slate-500">ทั้งหมด {rows.length} รายการ</p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="ค้นหา username / hcode / hname"
                className="h-11 min-w-[280px] rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-sky-400"
              />
              <button
                type="button"
                onClick={openCreateModal}
                className="h-11 rounded-2xl bg-sky-600 px-5 text-sm font-semibold text-white transition hover:bg-sky-700"
              >
                เพิ่มผู้ใช้
              </button>
            </div>
          </div>

          <div className="mt-5 overflow-hidden rounded-[24px] border border-slate-200">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50">
                  <tr className="text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    <th className="px-4 py-3">ID</th>
                    <th className="px-4 py-3">ชื่อผู้ใช้</th>
                    <th className="px-4 py-3">รหัสหน่วยบริการ</th>
                    <th className="px-4 py-3">ชื่อหน่วยบริการ</th>
                    <th className="px-4 py-3">สถานะใช้งาน</th>
                    <th className="px-4 py-3">ไม่ใช่โรงพยาบาล</th>
                    <th className="px-4 py-3 text-right">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredRows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-500">
                        ไม่พบข้อมูลผู้ใช้
                      </td>
                    </tr>
                  ) : (
                    filteredRows.map((row) => (
                      <tr key={row.id} className="align-top text-slate-700">
                        <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-900">{row.id}</td>
                        <td className="whitespace-nowrap px-4 py-3">{row.username}</td>
                        <td className="whitespace-nowrap px-4 py-3">{row.hcode}</td>
                        <td className="px-4 py-3">{row.hname || "-"}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                              row.is_active ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"
                            }`}
                          >
                            {row.is_active ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                              row.not_hospital ? "bg-amber-100 text-amber-700" : "bg-sky-100 text-sky-700"
                            }`}
                          >
                            {row.not_hospital ? "Yes" : "No"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => openEditModal(row)}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-sky-200 text-sky-700 transition hover:bg-sky-50"
                              aria-label={`Update user ${row.username}`}
                              title="Update"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(row)}
                              disabled={deleteBusyId === row.id}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-rose-200 text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                              aria-label={`Delete user ${row.username}`}
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>

      {isModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4">
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-5xl rounded-[28px] border border-sky-100 bg-white p-6 shadow-[0_30px_90px_rgba(15,23,42,0.25)]"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-500">
                  {editingId === null ? "เพิ่มผู้ใช้" : "แก้ไขผู้ใช้"}
                </p>
                <h2 className="mt-2 text-xl font-semibold text-slate-950">
                  {editingId === null ? "เพิ่มผู้ใช้ใหม่" : `แก้ไขผู้ใช้ #${editingId}`}
                </h2>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                aria-label="Close modal"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
              <div className="grid gap-4 md:grid-cols-3">
                <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                  USER
                  <input
                    value={form.username}
                    onChange={(event) => updateForm("username", event.target.value)}
                    className="h-11 rounded-2xl border border-slate-200 px-4 text-sm text-slate-900 outline-none transition focus:border-sky-400"
                    required
                  />
                </label>

                <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                  PASSWORD {editingId !== null ? "(เว้นว่างถ้าไม่เปลี่ยน)" : ""}
                  <input
                    type="password"
                    value={form.password}
                    onChange={(event) => updateForm("password", event.target.value)}
                    className="h-11 rounded-2xl border border-slate-200 px-4 text-sm text-slate-900 outline-none transition focus:border-sky-400"
                    required={editingId === null}
                  />
                </label>

                <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                  CONFIRM-PASSWORD
                  <input
                    type="password"
                    value={form.confirmPassword}
                    onChange={(event) => updateForm("confirmPassword", event.target.value)}
                    className="h-11 rounded-2xl border border-slate-200 px-4 text-sm text-slate-900 outline-none transition focus:border-sky-400"
                    required={editingId === null}
                  />
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                  ชื่อหน่วยงาน
                  <input
                    value={form.hcode}
                    onChange={(event) => updateForm("hcode", event.target.value)}
                    className="h-11 rounded-2xl border border-slate-200 px-4 text-sm text-slate-900 outline-none transition focus:border-sky-400"
                    required
                  />
                </label>

                <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                  ชื่อเจ้าหน้าที่
                  <input
                    value={form.hname}
                    onChange={(event) => updateForm("hname", event.target.value)}
                    className="h-11 rounded-2xl border border-slate-200 px-4 text-sm text-slate-900 outline-none transition focus:border-sky-400"
                  />
                </label>
              </div>

              <div className="grid w-full gap-3 md:grid-cols-2">
                <label className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.is_active}
                    onChange={(event) => updateForm("is_active", event.target.checked)}
                    className="h-4 w-4"
                  />
                  เปิดใช้งานผู้ใช้
                </label>

                <label className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.not_hospital}
                    onChange={(event) => updateForm("not_hospital", event.target.checked)}
                    className="h-4 w-4"
                  />
                  ไม่ใช่โรงพยาบาล
                </label>
              </div>

              {errorMessage ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {errorMessage}
                </div>
              ) : null}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="h-11 rounded-2xl border border-slate-200 px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="h-11 rounded-2xl bg-sky-600 px-5 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {submitting ? "กำลังบันทึก..." : editingId === null ? "เพิ่มผู้ใช้" : "บันทึกการแก้ไข"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </main>
  );
}
