"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  deleteBooking,
  getOrCreateTaxSettings,
  getTotalRevenueForYear,
  insertApartment,
  insertBooking,
  upsertBookingCalculation,
  updateApartment,
  updateTaxSettings,
} from "@/lib/db";
import { readSessionCookie, validateSessionToken } from "@/lib/session";

const parseNumber = (value: FormDataEntryValue | null, fallback = 0) => {
  if (!value) return fallback;
  const raw = String(value).trim().replace(/\s/g, "");
  if (!raw) return fallback;

  const hasDot = raw.includes(".");
  const hasComma = raw.includes(",");
  let normalized = raw;

  if (hasDot && hasComma) {
    normalized = raw.replace(/\./g, "").replace(/,/g, ".");
  } else if (hasDot) {
    normalized = /^-?\d{1,3}(\.\d{3})+$/.test(raw) ? raw.replace(/\./g, "") : raw;
  } else if (hasComma) {
    normalized = /^-?\d{1,3}(,\d{3})+$/.test(raw) ? raw.replace(/,/g, "") : raw.replace(",", ".");
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeReturnPath = (value: string) => {
  if (!value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
};

const toTwoDecimals = (value: number) => Math.round(value * 100) / 100;

type BookingSummaryPayload = {
  bookingRevenue: number;
  totalRevenueBefore: number;
  totalRevenueAfter: number;
  bundfradrag: number;
  taxableBaseBooking: number;
  taxOnBooking: number;
  cutAfterTaxEach: number;
  taxRate: number;
};

const calculateBookingSummary = (
  existingRevenue: number,
  netRevenue: number,
  taxRate: number,
  bundfradragDkk: number
): BookingSummaryPayload => {
  const safeTaxRate = Math.max(0, Math.min(1, taxRate));
  const safeExistingRevenue = Math.max(0, existingRevenue);
  const safeBookingRevenue = Math.max(0, netRevenue);
  const safeBundfradrag = Math.max(0, bundfradragDkk);

  const totalRevenueAfter = safeExistingRevenue + safeBookingRevenue;
  const taxableBefore = Math.max(0, safeExistingRevenue - safeBundfradrag) * 0.6;
  const taxableAfter = Math.max(0, totalRevenueAfter - safeBundfradrag) * 0.6;
  const taxableBaseBooking = Math.max(0, taxableAfter - taxableBefore);
  const taxOnBooking = taxableBaseBooking * safeTaxRate;
  const cutAfterTaxEach = Math.max(0, safeBookingRevenue - taxOnBooking) / 2;

  return {
    bookingRevenue: safeBookingRevenue,
    totalRevenueBefore: safeExistingRevenue,
    totalRevenueAfter,
    bundfradrag: safeBundfradrag,
    taxableBaseBooking,
    taxOnBooking,
    cutAfterTaxEach,
    taxRate: safeTaxRate,
  };
};

const withBookingSummary = (value: string, summary: BookingSummaryPayload) => {
  const [path, query = ""] = value.split("?");
  const params = new URLSearchParams(query);

  params.set("created", "1");
  params.set("booking_revenue", String(toTwoDecimals(summary.bookingRevenue)));
  params.set("total_revenue_before", String(toTwoDecimals(summary.totalRevenueBefore)));
  params.set("total_revenue_after", String(toTwoDecimals(summary.totalRevenueAfter)));
  params.set("bundfradrag", String(toTwoDecimals(summary.bundfradrag)));
  params.set("taxable_base_booking", String(toTwoDecimals(summary.taxableBaseBooking)));
  params.set("tax_on_booking", String(toTwoDecimals(summary.taxOnBooking)));
  params.set("cut_after_tax_each", String(toTwoDecimals(summary.cutAfterTaxEach)));
  params.set("tax_rate", String(toTwoDecimals(summary.taxRate)));

  const nextQuery = params.toString();
  return nextQuery ? `${path}?${nextQuery}` : path;
};

function requireSession() {
  const token = readSessionCookie();
  if (!validateSessionToken(token)) redirect("/login");
}

export async function createBooking(formData: FormData) {
  requireSession();

  const apartmentId = String(formData.get("apartment_id") ?? "");
  const startDate = String(formData.get("start_date") ?? "");
  const endDate = String(formData.get("end_date") ?? "");
  const netRevenue = parseNumber(formData.get("net_revenue_dkk"));
  const returnTo = normalizeReturnPath(String(formData.get("return_to") ?? "/"));

  if (!apartmentId || !startDate || !endDate || netRevenue <= 0) {
    return;
  }

  if (new Date(startDate) > new Date(endDate)) {
    return;
  }

  const bookingYear = new Date(`${startDate}T00:00:00Z`).getUTCFullYear();
  const settings = await getOrCreateTaxSettings(bookingYear);
  const bundfradragDkk = settings.bundfradrag_platform_dkk;
  const existingTotalRevenue = await getTotalRevenueForYear(bookingYear);

  const summary = calculateBookingSummary(
    existingTotalRevenue,
    netRevenue,
    settings.tax_rate,
    bundfradragDkk
  );

  const bookingId = await insertBooking({
    apartment_id: apartmentId,
    start_date: startDate,
    end_date: endDate,
    net_revenue_dkk: netRevenue,
  });

  await upsertBookingCalculation({
    booking_id: bookingId,
    year: bookingYear,
    booking_revenue_dkk: summary.bookingRevenue,
    total_revenue_before_dkk: summary.totalRevenueBefore,
    total_revenue_after_dkk: summary.totalRevenueAfter,
    bundfradrag_dkk: summary.bundfradrag,
    taxable_base_booking_dkk: summary.taxableBaseBooking,
    tax_on_booking_dkk: summary.taxOnBooking,
    cut_after_tax_each_dkk: summary.cutAfterTaxEach,
    tax_rate: summary.taxRate,
  });

  revalidatePath("/");
  redirect(withBookingSummary(returnTo, summary));
}

export async function removeBooking(formData: FormData) {
  requireSession();
  const bookingId = String(formData.get("booking_id") ?? "");
  if (!bookingId) return;
  await deleteBooking(bookingId);
  revalidatePath("/");
}

export async function saveTaxSettings(formData: FormData) {
  requireSession();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const bundfradragPlatform = parseNumber(formData.get("bundfradrag_platform_dkk"));
  const taxRate = parseNumber(formData.get("tax_rate")) / 100;

  await updateTaxSettings({
    id,
    bundfradrag_platform_dkk: bundfradragPlatform,
    bundfradrag_private_dkk: bundfradragPlatform,
    uses_platform: true,
    tax_rate: taxRate,
  });

  revalidatePath("/settings");
  revalidatePath("/");
}

export async function saveApartment(formData: FormData) {
  requireSession();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  await updateApartment({ id, name });
  revalidatePath("/settings");
  revalidatePath("/");
}

export async function addApartment(formData: FormData) {
  requireSession();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  await insertApartment({ name });
  revalidatePath("/settings");
  revalidatePath("/");
}
