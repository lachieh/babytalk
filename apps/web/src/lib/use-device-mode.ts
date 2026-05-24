"use client";

const DEVICE_MODE_KEY = "babytalk_device_mode";

export const isDeviceMode = (): boolean => {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(DEVICE_MODE_KEY) === "1";
};

export const enableDeviceMode = (): void => {
  if (typeof window === "undefined") return;
  localStorage.setItem(DEVICE_MODE_KEY, "1");
};

export const disableDeviceMode = (): void => {
  if (typeof window === "undefined") return;
  localStorage.removeItem(DEVICE_MODE_KEY);
};
