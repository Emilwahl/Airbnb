import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Rental Tax Tracker",
  description: "Track Airbnb rentals, revenue, and tax estimates in Denmark.",
  icons: {
    icon: [{ url: "/icon-180x180.png", sizes: "180x180", type: "image/png" }],
    apple: [{ url: "/icon-180x180.png", sizes: "180x180", type: "image/png" }],
  },
};

const themeInitScript = `
(() => {
  try {
    const key = "rental-tax-theme";
    const savedTheme = localStorage.getItem(key);
    const theme = savedTheme === "light" || savedTheme === "dark"
      ? savedTheme
      : (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    document.documentElement.setAttribute("data-theme", theme);
  } catch {
    // Ignore errors when storage is unavailable.
  }
})();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="da" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
