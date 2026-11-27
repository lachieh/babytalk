"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { PebbleLoading } from "@/components/icons";
import { restoreSession } from "@/lib/gql-request";

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const check = async () => {
      if (await restoreSession()) setReady(true);
      else router.replace("/auth/login");
    };
    check();
  }, [router]);

  if (!ready) return <PebbleLoading />;

  return children;
}
