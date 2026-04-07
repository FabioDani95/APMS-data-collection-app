"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

interface NavigationGuardProps {
  message: string;
}

export function NavigationGuard({ message }: NavigationGuardProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [showToast, setShowToast] = useState(false);

  useEffect(() => {
    if (!pathname || pathname === "/admin") {
      return;
    }

    const handlePopState = () => {
      setShowToast(true);
      router.forward();
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [pathname, router]);

  if (!showToast || pathname === "/admin") {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-1/2 z-50 w-[min(92vw,540px)] -translate-x-1/2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-900 shadow-panel">
      {message}
    </div>
  );
}
