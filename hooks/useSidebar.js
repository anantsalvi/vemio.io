"use client";

import { useState, useEffect, useCallback } from "react";

const BREAKPOINTS = {
  mobile: 768,
  tablet: 1024,
};

function getMode(width) {
  if (width < BREAKPOINTS.mobile) return "mobile";
  if (width < BREAKPOINTS.tablet) return "tablet";
  return "desktop";
}

export function useSidebar() {
  const [mode, setMode] = useState("desktop");
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    function handleResize() {
      const next = getMode(window.innerWidth);
      setMode(next);
      // Close drawer when resizing to desktop/tablet
      if (next !== "mobile") setDrawerOpen(false);
    }

    handleResize(); // Set initial value
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const toggleDrawer = useCallback(() => {
    setDrawerOpen((v) => !v);
  }, []);

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
  }, []);

  // On mobile: sidebar hidden unless drawerOpen
  // On tablet: rail (icons + labels, 72px wide)
  // On desktop: full sidebar (260px)
  const sidebarVisible =
    mode === "desktop" || mode === "tablet" || (mode === "mobile" && drawerOpen);

  const sidebarWidth =
    mode === "desktop" ? 260 : mode === "tablet" ? 72 : 260;

  const isRail = mode === "tablet";
  const isMobile = mode === "mobile";

  return {
    mode,
    drawerOpen,
    toggleDrawer,
    closeDrawer,
    sidebarVisible,
    sidebarWidth,
    isRail,
    isMobile,
  };
}