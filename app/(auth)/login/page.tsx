import { Suspense } from "react";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-50 via-white to-amber-50 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-brand-600 text-white text-3xl mb-3 shadow-lg">
            P
          </div>
          <h1 className="text-3xl font-bold text-stone-900">POLWATTA FOOD HUB</h1>
          <p className="text-stone-600 mt-1">Cafe & BBQ POS System</p>
        </div>

        <Suspense
          fallback={
            <div className="rounded-xl bg-white border border-stone-200 p-6 shadow-sm h-72 animate-pulse" />
          }
        >
          <LoginForm />
        </Suspense>

        <p className="text-center text-xs text-stone-500 mt-6">
          Need an account? Contact your manager.
        </p>
      </div>
    </main>
  );
}
