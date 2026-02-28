"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function YearSelect({
  years,
  value,
  label,
  includeAll = false,
  allLabel = "All time",
}: {
  years: number[];
  value: number | "all";
  label: string;
  includeAll?: boolean;
  allLabel?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const nextYear = event.target.value;
    const params = new URLSearchParams(searchParams.toString());
    params.set("year", nextYear);
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <label className="filter-control">
      <span className="label">{label}</span>
      <select className="select" value={String(value)} onChange={handleChange}>
        {includeAll ? <option value="all">{allLabel}</option> : null}
        {years.map((year) => (
          <option key={year} value={year}>
            {year}
          </option>
        ))}
      </select>
    </label>
  );
}
