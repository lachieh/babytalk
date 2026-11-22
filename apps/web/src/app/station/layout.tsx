"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { PebbleLoading } from "@/components/icons";
import { BabyContextProvider } from "@/lib/baby-context";
import { gqlRequest, restoreSession } from "@/lib/gql-request";
import { RuntimeConfigProvider, loadRuntimeConfig } from "@/lib/runtime-config";

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
    const verify = async () => {
      if (!(await restoreSession())) {
        router.replace("/auth/device");
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
        // Continue — station mode can still render its shell
      }
      setReady(true);
    };

    verify();
  }, [router]);

  if (!ready) {
    return <PebbleLoading />;
  }

  return (
    <RuntimeConfigProvider>
      <BabyContextProvider>{children}</BabyContextProvider>
    </RuntimeConfigProvider>
  );
}
