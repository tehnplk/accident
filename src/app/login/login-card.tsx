"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LogIn, KeyRound, User } from "lucide-react";
import { useSession } from "next-auth/react";
import { signInWithHealthId, signInWithCredentials } from "../actions/sign-in";

export function LoginCard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { status } = useSession();
  const error = searchParams.get("error");
  const displayName = searchParams.get("displayName")?.trim() ?? "";
  const providerId = searchParams.get("providerId")?.trim() ?? "";
  const hcode = searchParams.get("hcode")?.trim() ?? "";
  const hname = searchParams.get("hname")?.trim() ?? "";
  const [showUserPass, setShowUserPass] = useState(false);

  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/patient");
    }
  }, [status, router]);

  const errorMessage =
    error === "unauthorized_hcode"
      ? `${displayName || "ไม่ระบุชื่อ"} (${providerId || "-"})\n${hcode || "-"}-${hname || "-"}\nไม่อนุญาตให้หน่วยบริการนี้เข้าถึงข้อมูล`
      : error === "invalid_credentials"
        ? "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง"
        : error
          ? "ไม่สามารถเข้าสู่ระบบได้ กรุณาลองใหม่อีกครั้ง"
          : "";

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg">
        <h2 className="mb-2 text-center text-2xl font-bold text-gray-800">เข้าสู่ระบบ</h2>

        {errorMessage ? (
          <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-center text-sm text-amber-800 whitespace-pre-line">
            {errorMessage}
          </div>
        ) : null}

        {/* Provider ID */}
        <form action={signInWithHealthId}>
          <input type="hidden" name="redirectTo" value="/patient" />
          <button
            type="submit"
            className="flex w-full cursor-pointer items-center justify-center gap-3 rounded-xl bg-green-600 px-6 py-4 text-lg font-semibold text-white shadow-md transition-all hover:bg-green-700 hover:shadow-lg"
          >
            <LogIn size={24} />
            เข้าสู่ระบบด้วย Provider ID
          </button>
        </form>

        {/* Divider */}
        <div className="my-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-gray-200" />
          <span className="text-sm text-gray-400">หรือ</span>
          <div className="h-px flex-1 bg-gray-200" />
        </div>

        {/* User/Pass toggle button */}
        {!showUserPass ? (
          <button
            type="button"
            onClick={() => setShowUserPass(true)}
            className="flex w-full cursor-pointer items-center justify-center gap-3 rounded-xl border border-blue-600 px-6 py-4 text-lg font-semibold text-blue-600 transition-all hover:bg-blue-50"
          >
            <KeyRound size={24} />
            เข้าสู่ระบบด้วย User/Pass
          </button>
        ) : (
          <form action={signInWithCredentials} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="username">
                ชื่อผู้ใช้
              </label>
              <div className="relative">
                <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  id="username"
                  name="username"
                  type="text"
                  required
                  autoComplete="username"
                  placeholder="ชื่อผู้ใช้"
                  className="w-full rounded-xl border border-gray-300 py-3 pl-9 pr-4 text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="password">
                รหัสผ่าน
              </label>
              <div className="relative">
                <KeyRound size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  placeholder="รหัสผ่าน"
                  className="w-full rounded-xl border border-gray-300 py-3 pl-9 pr-4 text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"
                />
              </div>
            </div>
            <button
              type="submit"
              className="flex w-full cursor-pointer items-center justify-center gap-3 rounded-xl bg-blue-600 px-6 py-4 text-lg font-semibold text-white shadow-md transition-all hover:bg-blue-700 hover:shadow-lg"
            >
              <KeyRound size={24} />
              เข้าสู่ระบบ
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
