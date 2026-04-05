import { Suspense } from "react";
import { LoginCard } from "./login-card";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-gray-50">
          <div className="h-80 w-full max-w-md rounded-2xl bg-white shadow-lg" />
        </div>
      }
    >
      <LoginCard />
    </Suspense>
  );
}
