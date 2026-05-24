"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { isDeviceMode } from "@/lib/use-device-mode";

/**
 * Redirects logged-in users away from public pages (home, login).
 * Device-mode devices go to /station; everyone else to /dashboard.
 */
export const useRedirectIfLoggedIn = () => {
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("babytalk_token");
    if (!token) return;
    router.replace(isDeviceMode() ? "/station" : "/dashboard");
  }, [router]);
};
