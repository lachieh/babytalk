"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { BabyContextProvider } from "@/lib/baby-context";
import { RuntimeConfigProvider, loadRuntimeConfig } from "@/lib/runtime-config";
import { gqlRequest } from "@/lib/tambo/graphql";
import { BabyTamboProvider } from "@/lib/tambo/provider";

const CHECK_HOUSEHOLD = `
  query { myHousehold { id } myBabies { id } }
`;

export default function StationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("babytalk_token");
    if (!token) {
      router.replace("/auth/device");
      return;
    }

    const verify = async () => {
      await loadRuntimeConfig();
      try {
        const data = await gqlRequest<{
          myBabies: { id: string }[];
          myHousehold: { id: string } | null;
        }>(CHECK_HOUSEHOLD);

        if (!data.myHousehold || data.myBabies.length === 0) {
          router.replace("/dashboard/setup");
          return;
        }
      } catch {
        // Continue — station mode can still render its shell
      }
      setReady(true);
    };

    verify();
  }, [router]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface">
        <div className="h-8 w-8 animate-breathe rounded-full bg-primary-200" />
      </div>
    );
  }

  return (
    <RuntimeConfigProvider>
      <BabyTamboProvider>
        <BabyContextProvider>{children}</BabyContextProvider>
      </BabyTamboProvider>
    </RuntimeConfigProvider>
  );
}
