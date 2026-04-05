"use client";

import React, { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LogIn } from "lucide-react";
import { useSession } from "next-auth/react";
import { signInWithHealthId } from "../actions/sign-in";

export function LoginCard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { status } = useSession();
  const error = searchParams.get("error");
  const displayName = searchParams.get("displayName")?.trim() ?? "";
  const providerId = searchParams.get("providerId")?.trim() ?? "";
  const hcode = searchParams.get("hcode")?.trim() ?? "";
  const hname = searchParams.get("hname")?.trim() ?? "";

  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/patient");
    }
  }, [status, router]);

  const errorMessage =
    error === "unauthorized_hcode"
      ? `${displayName || "ไม่ระบุชื่อ"} (${providerId || "-"})\n${hcode || "-"}-${hname || "-"}\nไม่อนุญาตให้หน่วยบริการนี้เข้าถึงข้อมูล`
      : error
        ? "ไม่สามารถเข้าสู่ระบบได้ กรุณาลองใหม่อีกครั้ง"
        : "";

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg">
        <h2 className="mb-2 text-center text-2xl font-bold text-gray-800">เข้าสู่ระบบ</h2>
        <p className="mb-3 text-center text-sm text-gray-500">
          กรุณาเข้าสู่ระบบด้วย Provider ID เพื่อเข้าถึงข้อมูลผู้ป่วย
        </p>
        {errorMessage ? (
          <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-center text-sm text-amber-800 whitespace-pre-line">
            {errorMessage}
          </div>
        ) : null}

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
      </div>
    </div>
  );
}
