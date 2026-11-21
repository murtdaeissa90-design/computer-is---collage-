"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import LoginShell from "@/components/LoginShell";
import LoginForm from "@/components/LoginForm";
import { useAuth } from "@/components/AuthProvider";

export default function LoginPage() {
  const { session, loading, recovery } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && session && !recovery) router.replace("/");
  }, [loading, session, recovery, router]);

  return (
    <LoginShell>
      <LoginForm mode="student" />
    </LoginShell>
  );
}
