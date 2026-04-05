"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { LogIn } from "lucide-react";
import { useSession } from "next-auth/react";
import { signInWithHealthId } from "../actions/sign-in";

export default function LoginPage() {
  const router = useRouter();
  const { status } = useSession();

  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/patient");
    }
  }, [status, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded-2xl shadow-lg w-full max-w-md">
        <h2 className="text-2xl font-bold text-center mb-2 text-gray-800">
          เข้าสู่ระบบ
        </h2>
        <p className="text-center text-gray-500 mb-8 text-sm">
          กรุณาเข้าสู่ระบบด้วย Provider ID เพื่อเข้าถึงข้อมูลผู้ป่วย
        </p>

        <form action={signInWithHealthId}>
          <input type="hidden" name="redirectTo" value="/patient" />
          <button
            type="submit"
            className="w-full px-6 py-4 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-all flex items-center justify-center gap-3 font-semibold text-lg shadow-md hover:shadow-lg cursor-pointer"
          >
            <LogIn size={24} />
            เข้าสู่ระบบด้วย Provider ID
          </button>
        </form>
      </div>
    </div>
  );
}
