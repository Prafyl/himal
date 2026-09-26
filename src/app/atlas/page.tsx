import type { Metadata } from "next";
import Atlas from "@/components/Atlas";

export const metadata: Metadata = {
  title: "GLOF Atlas · HIMAL",
  description: "Nearly fifty years of glacial lake outburst floods in Nepal, mapped on satellite imagery.",
};

export default function AtlasPage() {
  return <Atlas />;
}
