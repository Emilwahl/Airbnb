"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

type ApartmentOption = {
  id: string;
  name: string;
};

export function BookingApartmentSelect({
  apartments,
  value,
}: {
  apartments: ApartmentOption[];
  value: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const nextValue = event.target.value;
    const params = new URLSearchParams(searchParams.toString());

    if (nextValue === "all") {
      params.delete("apartment");
    } else {
      params.set("apartment", nextValue);
    }

    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <label className="filter-control">
      <span className="label">Apartment</span>
      <select className="select" value={value} onChange={handleChange}>
        <option value="all">All apartments</option>
        {apartments.map((apt) => (
          <option key={apt.id} value={apt.id}>
            {apt.name}
          </option>
        ))}
      </select>
    </label>
  );
}
