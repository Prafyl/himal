import type { Metadata } from "next";
import { notFound } from "next/navigation";
import LakeDossier from "@/components/LakeDossier";
import { LAKES } from "@/data/lakes";

type Params = { params: Promise<{ id: string }> };

export function generateStaticParams() {
  return LAKES.map((l) => ({ id: l.id }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const lake = LAKES.find((l) => l.id === id);
  return lake ? { title: `${lake.name} · HIMAL`, description: lake.note } : {};
}

export default async function LakePage({ params }: Params) {
  const { id } = await params;
  if (!LAKES.some((l) => l.id === id)) notFound();
  return <LakeDossier id={id} />;
}
