import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Noto_Sans_Devanagari, Space_Grotesk } from "next/font/google";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const grotesk = Space_Grotesk({ variable: "--font-space-grotesk", subsets: ["latin"] });
const mono = JetBrains_Mono({ variable: "--font-jetbrains", subsets: ["latin"] });
const devanagari = Noto_Sans_Devanagari({
  variable: "--font-devanagari",
  subsets: ["devanagari"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: "HIMAL · Glacial Lake Early Warning for Nepal",
  description:
    "A live 3D digital twin of Nepal's most dangerous glacial lakes. Real-time conditions, flood-path simulation and bilingual evacuation alerts for every village downstream.",
  openGraph: {
    title: "HIMAL · Glacial Lake Early Warning for Nepal",
    description: "47 glacial lakes could burst. HIMAL watches them so villages don't have to guess.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#03060c",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${grotesk.variable} ${mono.variable} ${devanagari.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
