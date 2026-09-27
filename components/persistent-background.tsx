"use client";

import { usePathname } from "next/navigation";

function routePosition(pathname: string) {
  if (pathname.includes("file-privacy-inspector")) return "file";
  if (pathname.includes("screenshot-privacy-cleaner")) return "screenshot";
  if (pathname.includes("url-redirect-visualizer")) return "url";
  if (pathname.includes("/privacy")) return "privacy";
  if (pathname.includes("/about")) return "about";
  return "home";
}

export function PersistentBackground() {
  const pathname = usePathname();
  return (
    <div className={`ambient-background ambient-${routePosition(pathname)}`} aria-hidden="true">
      <div className="ambient-orb ambient-orb-primary" />
      <div className="ambient-orb ambient-orb-secondary" />
    </div>
  );
}
