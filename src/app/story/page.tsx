import type { Metadata } from "next";
import Story from "@/components/Story";

export const metadata: Metadata = {
  title: "The Story · HIMAL",
  description: "A three-minute cinematic journey: from the 2024 Thame flood to a live outburst simulation at Tsho Rolpa.",
};

export default function StoryPage() {
  return <Story />;
}
