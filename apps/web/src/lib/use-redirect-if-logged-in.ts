"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { restoreSession } from "@/lib/tambo/graphql";
import { isDeviceMode } from "@/lib/use-device-mode";

/**
 * Redirects logged-in users away from public pages (home, login).
 * Device-mode devices go to /station; everyone else to /dashboard.
 */
export const useRedirectIfLoggedIn = () => {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const restore = async () => {
      const authenticated = await restoreSession();
      if (authenticated) {
        router.replace(isDeviceMode() ? "/station" : "/dashboard");
        return;
      }
      setChecking(false);
    };
    restore();
  }, [router]);

  return checking;
};
