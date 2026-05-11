import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/sonner";

const FarmDashboard = lazy(() => import("@/components/FarmDashboard"));

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "بيان المزرعة | نظام الإدارة المتكامل ٢٠٢٦" },
      {
        name: "description",
        content:
          "نظام إدارة المزرعة المتقدم - تتبع القطعان، التحصينات، الإنتاج، والمبيعات",
      },
    ],
  }),
});

function Index() {
  return (
    <>
      <Suspense fallback={<div style={{ minHeight: "100vh" }} />}>
        <FarmDashboard />
      </Suspense>
      <Toaster richColors position="top-center" dir="rtl" />
    </>
  );
}
