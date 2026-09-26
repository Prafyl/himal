import type { Metadata } from "next";
import LakesDashboard from "@/components/LakesDashboard";

export const metadata: Metadata = {
  title: "Lake Registry · HIMAL",
  description: "Live hazard index, exposure and weather for every glacial lake HIMAL monitors in Nepal.",
};

export default function LakesPage() {
  return <LakesDashboard />;
}
