"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { PebbleLoading } from "@/components/icons";
import { BabyContextProvider } from "@/lib/baby-context";
import { gqlRequest, restoreSession } from "@/lib/gql-request";
import { RuntimeConfigProvider, loadRuntimeConfig } from "@/lib/runtime-config";

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
    return <PebbleLoading />;
  }

  return (
    <RuntimeConfigProvider>
      <BabyContextProvider>{children}</BabyContextProvider>
    </RuntimeConfigProvider>
  );
}
