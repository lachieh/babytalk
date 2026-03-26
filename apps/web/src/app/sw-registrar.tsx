"use client";

import { useEffect } from "react";

import { registerServiceWorker } from "@/lib/register-sw";

export const ServiceWorkerRegistrar = () => {
  useEffect(() => {
    registerServiceWorker();
  }, []);

  return null;
};
