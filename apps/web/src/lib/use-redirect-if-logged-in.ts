"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Redirects to /dashboard if a babytalk_token exists in localStorage.
 * Use on public pages (home, login) to skip past them for logged-in users.
 */
export const useRedirectIfLoggedIn = () => {
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("babytalk_token");
    if (token) {
      router.replace("/dashboard");
    }
  }, [router]);
};
