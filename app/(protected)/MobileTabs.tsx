"use client";

import { useState } from "react";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "seasonality", label: "Seasonality" },
  { id: "bookings", label: "Bookings" },
] as const;

export type MobileTabId = (typeof TABS)[number]["id"];

export function MobileTabs({
  defaultTab = "overview",
  children,
}: {
  defaultTab?: MobileTabId;
  children: React.ReactNode;
}) {
  const [activeTab, setActiveTab] = useState<MobileTabId>(defaultTab);

  return (
    <div className="mobile-tabs-wrapper" data-view={activeTab}>
      <div className="mobile-tabs">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`tab-button ${activeTab === tab.id ? "active" : ""}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {children}
    </div>
  );
}
