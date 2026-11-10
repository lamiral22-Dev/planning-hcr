import React from "react";
import { isDemoModeEnabled } from "@/lib/demo-mode";
import { LoginForm } from "@/components/features/auth/login-form";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  const isDemo = isDemoModeEnabled();

  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-gray-50">
      <LoginForm isDemoMode={isDemo} />
    </div>
  );
}
