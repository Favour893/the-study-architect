"use client";

import { usePathname } from "next/navigation";
import { PageGuideCoach } from "@/components/onboarding/page-guide-coach";
import { pathnameToPageGuideId } from "@/lib/onboarding/page-guides";

export function PageGuideRouter() {
  const pathname = usePathname();
  const guideId = pathnameToPageGuideId(pathname);

  if (!guideId) {
    return null;
  }

  return <PageGuideCoach key={guideId} guideId={guideId} />;
}
