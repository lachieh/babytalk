"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { gqlRequest } from "@/lib/tambo/graphql";
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
    const token = localStorage.getItem("babytalk_token");
    if (!token) {
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

    const checkHousehold = async () => {
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
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  return <BabyTamboProvider>{children}</BabyTamboProvider>;
}
