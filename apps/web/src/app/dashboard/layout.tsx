"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { BabyContextProvider } from "@/lib/baby-context";
import { RuntimeConfigProvider, loadRuntimeConfig } from "@/lib/runtime-config";
import { gqlRequest, restoreSession } from "@/lib/tambo/graphql";
import { BabyTamboProvider } from "@/lib/tambo/provider";

const CHECK_HOUSEHOLD = `
  query { myHousehold { id } myBabies { id } }
`;

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const checkHousehold = async () => {
      if (!(await restoreSession())) {
        router.replace("/auth/login");
        return;
      }

      // Skip household check on setup/join pages
      if (
        pathname.startsWith("/dashboard/setup") ||
        pathname.startsWith("/dashboard/join")
      ) {
        setReady(true);
        return;
      }

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
        // If the check fails, still show dashboard
      }
      setReady(true);
    };

    checkHousehold();
  }, [router, pathname]);

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
