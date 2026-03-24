"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { BabyTamboProvider } from "@/lib/tambo/provider";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("babytalk_token");
    if (token) {
      setReady(true);
    } else {
      router.replace("/auth/login");
    }
  }, [router]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  return <BabyTamboProvider>{children}</BabyTamboProvider>;
}
