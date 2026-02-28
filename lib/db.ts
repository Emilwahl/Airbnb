import { supabaseAdmin } from "./supabaseAdmin";

export type Apartment = {
  id: string;
  name: string;
  ownership_share: number;
};

export type Booking = {
  id: string;
  apartment_id: string;
  start_date: string;
  end_date: string;
  net_revenue_dkk: number;
  apartments?: { name: string } | null;
  calculation?: BookingCalculationSnapshot | null;
};

export type BookingCalculationSnapshot = {
  year: number;
  booking_revenue_dkk: number;
  total_revenue_before_dkk: number;
  total_revenue_after_dkk: number;
  bundfradrag_dkk: number;
  taxable_base_booking_dkk: number;
  tax_on_booking_dkk: number;
  cut_after_tax_each_dkk: number;
  tax_rate: number;
};

export type TaxSettings = {
  id: string;
  year: number;
  bundfradrag_platform_dkk: number;
  bundfradrag_private_dkk: number;
  uses_platform: boolean;
  tax_rate: number;
};

const DEFAULT_BUNDFRADRAG_PLATFORM = 33500;
const DEFAULT_BUNDFRADRAG_PRIVATE = 13100;
const DEFAULT_TAX_RATE = 0.35;
const CALC_NOTE_PREFIX = "[calc_snapshot]";

const toNumber = (value: unknown, fallback = 0) => {
  const parsed = typeof value === "string" ? Number(value) : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const serializeCalculationSnapshot = (value: BookingCalculationSnapshot) =>
  `${CALC_NOTE_PREFIX}${JSON.stringify(value)}`;

const parseCalculationSnapshotFromNotes = (
  notes: string | null | undefined
): BookingCalculationSnapshot | null => {
  if (!notes || !notes.includes(CALC_NOTE_PREFIX)) return null;
  const markerIndex = notes.lastIndexOf(CALC_NOTE_PREFIX);
  const raw = notes.slice(markerIndex + CALC_NOTE_PREFIX.length).trim();
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    return {
      year: toNumber(parsed.year),
      booking_revenue_dkk: toNumber(parsed.booking_revenue_dkk),
      total_revenue_before_dkk: toNumber(parsed.total_revenue_before_dkk),
      total_revenue_after_dkk: toNumber(parsed.total_revenue_after_dkk),
      bundfradrag_dkk: toNumber(parsed.bundfradrag_dkk),
      taxable_base_booking_dkk: toNumber(parsed.taxable_base_booking_dkk),
      tax_on_booking_dkk: toNumber(parsed.tax_on_booking_dkk),
      cut_after_tax_each_dkk: toNumber(parsed.cut_after_tax_each_dkk),
      tax_rate: toNumber(parsed.tax_rate),
    };
  } catch {
    return null;
  }
};

const isMissingBookingCalculationsInfra = (error: {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
} | null) => {
  if (!error) return false;

  const text = `${error.code ?? ""} ${error.message ?? ""} ${error.details ?? ""} ${error.hint ?? ""}`.toLowerCase();
  return (
    text.includes("booking_calculations") &&
    (text.includes("does not exist") ||
      text.includes("relationship") ||
      text.includes("schema cache") ||
      text.includes("42p01") ||
      text.includes("pgrst"))
  );
};

export async function ensureApartments() {
  const { data, error } = await supabaseAdmin
    .from("apartments")
    .select("id, name")
    .order("created_at", { ascending: true });
  if (error) throw error;
  if (data && data.length > 0) {
    const defaultNames = new Set(["Apartment 1", "Apartment 2"]);
    const hasOnlyDefaults =
      data.length === 2 && data.every((row) => defaultNames.has(row.name));
    if (!hasOnlyDefaults) return;

    const updates = [
      { id: data[0].id, name: "Vesterbro", ownership_share: 1 },
      { id: data[1].id, name: "Århusgade", ownership_share: 1 },
    ];

    for (const update of updates) {
      const { error: updateError } = await supabaseAdmin
        .from("apartments")
        .update({ name: update.name, ownership_share: update.ownership_share })
        .eq("id", update.id);
      if (updateError) throw updateError;
    }

    return;
  }

  const { error: insertError } = await supabaseAdmin.from("apartments").insert([
    { name: "Vesterbro", ownership_share: 1 },
    { name: "Århusgade", ownership_share: 1 },
  ]);
  if (insertError) throw insertError;
}

export async function listApartments(): Promise<Apartment[]> {
  const { data, error } = await supabaseAdmin
    .from("apartments")
    .select("id, name, ownership_share")
    .order("name");
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    ownership_share: toNumber(row.ownership_share, 1),
  }));
}

export async function getOrCreateTaxSettings(year: number): Promise<TaxSettings> {
  const { data, error } = await supabaseAdmin
    .from("tax_settings")
    .select("id, year, bundfradrag_platform_dkk, bundfradrag_private_dkk, uses_platform, tax_rate")
    .eq("year", year)
    .maybeSingle();
  if (error) throw error;
  if (data) {
    return {
      id: data.id,
      year: data.year,
      bundfradrag_platform_dkk: toNumber(data.bundfradrag_platform_dkk),
      bundfradrag_private_dkk: toNumber(data.bundfradrag_private_dkk),
      uses_platform: data.uses_platform,
      tax_rate: toNumber(data.tax_rate, DEFAULT_TAX_RATE),
    };
  }

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from("tax_settings")
    .insert({
      year,
      bundfradrag_platform_dkk: DEFAULT_BUNDFRADRAG_PLATFORM,
      bundfradrag_private_dkk: DEFAULT_BUNDFRADRAG_PRIVATE,
      uses_platform: true,
      tax_rate: DEFAULT_TAX_RATE,
    })
    .select("id, year, bundfradrag_platform_dkk, bundfradrag_private_dkk, uses_platform, tax_rate")
    .single();
  if (insertError) throw insertError;

  return {
    id: inserted.id,
    year: inserted.year,
    bundfradrag_platform_dkk: toNumber(inserted.bundfradrag_platform_dkk),
    bundfradrag_private_dkk: toNumber(inserted.bundfradrag_private_dkk),
    uses_platform: inserted.uses_platform,
    tax_rate: toNumber(inserted.tax_rate, DEFAULT_TAX_RATE),
  };
}

export async function listBookings(year?: number): Promise<Booking[]> {
  let query = supabaseAdmin
    .from("bookings")
    .select("id, apartment_id, start_date, end_date, net_revenue_dkk, notes, apartments(name)");

  if (typeof year === "number") {
    const start = `${year}-01-01`;
    const end = `${year}-12-31`;
    query = query.gte("start_date", start).lte("start_date", end);
  }

  const { data, error } = await query.order("start_date", { ascending: false });
  if (error) throw error;

  const bookingIds = (data ?? []).map((row) => row.id);
  const calculationByBookingId = new Map<string, BookingCalculationSnapshot>();

  if (bookingIds.length > 0) {
    const { data: calculations, error: calculationsError } = await supabaseAdmin
      .from("booking_calculations")
      .select(
        "booking_id, year, booking_revenue_dkk, total_revenue_before_dkk, total_revenue_after_dkk, bundfradrag_dkk, taxable_base_booking_dkk, tax_on_booking_dkk, cut_after_tax_each_dkk, tax_rate"
      )
      .in("booking_id", bookingIds);

    if (calculationsError && !isMissingBookingCalculationsInfra(calculationsError)) {
      throw calculationsError;
    }

    (calculations ?? []).forEach((item) => {
      calculationByBookingId.set(item.booking_id, {
        year: toNumber(item.year),
        booking_revenue_dkk: toNumber(item.booking_revenue_dkk),
        total_revenue_before_dkk: toNumber(item.total_revenue_before_dkk),
        total_revenue_after_dkk: toNumber(item.total_revenue_after_dkk),
        bundfradrag_dkk: toNumber(item.bundfradrag_dkk),
        taxable_base_booking_dkk: toNumber(item.taxable_base_booking_dkk),
        tax_on_booking_dkk: toNumber(item.tax_on_booking_dkk),
        cut_after_tax_each_dkk: toNumber(item.cut_after_tax_each_dkk),
        tax_rate: toNumber(item.tax_rate),
      });
    });
  }

  return (data ?? []).map((row) => {
    const apartment = Array.isArray(row.apartments) ? row.apartments[0] ?? null : row.apartments;
    const calculation = calculationByBookingId.get(row.id) ?? parseCalculationSnapshotFromNotes(row.notes);
    const bookingYear = new Date(`${row.start_date}T00:00:00Z`).getUTCFullYear();

    return {
      id: row.id,
      apartment_id: row.apartment_id,
      start_date: row.start_date,
      end_date: row.end_date,
      net_revenue_dkk: toNumber(row.net_revenue_dkk),
      apartments: apartment ?? null,
      calculation: calculation
        ? {
            ...calculation,
            year: calculation.year || bookingYear,
          }
        : null,
    };
  });
}

export async function getTotalRevenueForYear(year: number): Promise<number> {
  const start = `${year}-01-01`;
  const end = `${year}-12-31`;
  const { data, error } = await supabaseAdmin
    .from("bookings")
    .select("net_revenue_dkk")
    .gte("start_date", start)
    .lte("start_date", end);
  if (error) throw error;

  return (data ?? []).reduce((sum, row) => sum + toNumber(row.net_revenue_dkk), 0);
}

export async function insertBooking(payload: {
  apartment_id: string;
  start_date: string;
  end_date: string;
  net_revenue_dkk: number;
}): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from("bookings")
    .insert({
      apartment_id: payload.apartment_id,
      start_date: payload.start_date,
      end_date: payload.end_date,
      net_revenue_dkk: payload.net_revenue_dkk,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export async function upsertBookingCalculation(payload: {
  booking_id: string;
  year: number;
  booking_revenue_dkk: number;
  total_revenue_before_dkk: number;
  total_revenue_after_dkk: number;
  bundfradrag_dkk: number;
  taxable_base_booking_dkk: number;
  tax_on_booking_dkk: number;
  cut_after_tax_each_dkk: number;
  tax_rate: number;
}) {
  const { error } = await supabaseAdmin.from("booking_calculations").upsert(
    {
      booking_id: payload.booking_id,
      year: payload.year,
      booking_revenue_dkk: payload.booking_revenue_dkk,
      total_revenue_before_dkk: payload.total_revenue_before_dkk,
      total_revenue_after_dkk: payload.total_revenue_after_dkk,
      bundfradrag_dkk: payload.bundfradrag_dkk,
      taxable_base_booking_dkk: payload.taxable_base_booking_dkk,
      tax_on_booking_dkk: payload.tax_on_booking_dkk,
      cut_after_tax_each_dkk: payload.cut_after_tax_each_dkk,
      tax_rate: payload.tax_rate,
    },
    { onConflict: "booking_id" }
  );
  if (error && !isMissingBookingCalculationsInfra(error)) throw error;
  if (error && isMissingBookingCalculationsInfra(error)) {
    await saveBookingCalculationToNotes(payload.booking_id, {
      year: payload.year,
      booking_revenue_dkk: payload.booking_revenue_dkk,
      total_revenue_before_dkk: payload.total_revenue_before_dkk,
      total_revenue_after_dkk: payload.total_revenue_after_dkk,
      bundfradrag_dkk: payload.bundfradrag_dkk,
      taxable_base_booking_dkk: payload.taxable_base_booking_dkk,
      tax_on_booking_dkk: payload.tax_on_booking_dkk,
      cut_after_tax_each_dkk: payload.cut_after_tax_each_dkk,
      tax_rate: payload.tax_rate,
    });
  }
}

export async function saveBookingCalculationToNotes(
  bookingId: string,
  snapshot: BookingCalculationSnapshot
) {
  const { data: booking, error: fetchError } = await supabaseAdmin
    .from("bookings")
    .select("notes")
    .eq("id", bookingId)
    .maybeSingle();
  if (fetchError) throw fetchError;

  const currentNotes = booking?.notes ?? "";
  const markerIndex = currentNotes.lastIndexOf(CALC_NOTE_PREFIX);
  const nextNotes =
    markerIndex >= 0
      ? `${currentNotes.slice(0, markerIndex).trimEnd()}\n\n${serializeCalculationSnapshot(snapshot)}`.trim()
      : currentNotes.trim()
        ? `${currentNotes.trim()}\n\n${serializeCalculationSnapshot(snapshot)}`
        : serializeCalculationSnapshot(snapshot);

  const { error: updateError } = await supabaseAdmin
    .from("bookings")
    .update({ notes: nextNotes })
    .eq("id", bookingId);
  if (updateError) throw updateError;
}

export async function deleteBooking(id: string) {
  const { error } = await supabaseAdmin.from("bookings").delete().eq("id", id);
  if (error) throw error;
}

export async function updateTaxSettings(payload: {
  id: string;
  bundfradrag_platform_dkk: number;
  bundfradrag_private_dkk: number;
  uses_platform: boolean;
  tax_rate: number;
}) {
  const { error } = await supabaseAdmin
    .from("tax_settings")
    .update({
      bundfradrag_platform_dkk: payload.bundfradrag_platform_dkk,
      bundfradrag_private_dkk: payload.bundfradrag_private_dkk,
      uses_platform: payload.uses_platform,
      tax_rate: payload.tax_rate,
    })
    .eq("id", payload.id);
  if (error) throw error;
}

export async function updateApartment(payload: {
  id: string;
  name: string;
}) {
  const { error } = await supabaseAdmin
    .from("apartments")
    .update({ name: payload.name })
    .eq("id", payload.id);
  if (error) throw error;
}

export async function insertApartment(payload: {
  name: string;
}) {
  const { error } = await supabaseAdmin.from("apartments").insert({
    name: payload.name,
    ownership_share: 1,
  });
  if (error) throw error;
}
