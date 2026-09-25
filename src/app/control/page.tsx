import type { Metadata } from "next";
import MissionControl from "@/components/MissionControl";

export const metadata: Metadata = {
  title: "Mission Control · HIMAL",
};

export default function ControlPage() {
  return <MissionControl />;
}
