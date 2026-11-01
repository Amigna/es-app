import type { Metadata } from "next";
import ProgressView from "@/components/ProgressView";

export const metadata: Metadata = { title: "Progress · Conjugar" };

export default function ProgressPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">Your progress</h1>
      <ProgressView />
    </div>
  );
}
