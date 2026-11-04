import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Carrier quote adapter",
  description: "Connects the standard customer profile to a carrier's quote form.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
