"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useFormStatus } from "react-dom";
import { formatDkk, formatPercent } from "@/lib/format";

type ApartmentOption = {
  id: string;
  name: string;
};

type BookingSummary = {
  bookingRevenue: number;
  totalRevenueBefore: number;
  totalRevenueAfter: number;
  bundfradrag: number;
  taxableBaseBooking: number;
  taxOnBooking: number;
  cutAfterTaxEach: number;
  taxRate: number;
};

const addDays = (dateString: string, days: number) => {
  if (!dateString) return "";
  const date = new Date(`${dateString}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "";
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;
};

const normalizeIsoDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [yearRaw, monthRaw, dayRaw] = value.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(date.getTime())) return null;
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() + 1 !== month ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return `${yearRaw}-${monthRaw}-${dayRaw}`;
};

const autoFormatDateDraft = (value: string) => {
  const compact = value.replace(/\s/g, "");
  if (!compact) return "";

  if (/[./-]/.test(compact)) {
    return compact.replace(/[./]/g, "-").replace(/[^0-9-]/g, "");
  }

  const digits = compact.replace(/\D/g, "").slice(0, 8);
  if (!digits) return "";

  const likelyYearFirst = digits.startsWith("19") || digits.startsWith("20");
  if (likelyYearFirst) {
    if (digits.length <= 4) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
    return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}`;
  }

  if (digits.length === 1) return digits;
  if (digits.length === 2) return `${digits}-`;
  if (digits.length <= 4) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
  return `${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4)}`;
};

const shouldUseMobileDateAutofmt = () => {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod|android/i.test(navigator.userAgent);
};

const parseFlexibleDate = (value: string, fallbackYear: number) => {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const normalized = trimmed.replace(/[./]/g, "-");
  const iso = normalizeIsoDate(normalized);
  if (iso) return iso;

  const parts = normalized.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (parts) {
    const first = parts[1].padStart(2, "0");
    const second = parts[2].padStart(2, "0");
    const year = parts[3];

    const dayMonthYear = normalizeIsoDate(`${year}-${second}-${first}`);
    if (dayMonthYear) return dayMonthYear;

    const monthDayYear = normalizeIsoDate(`${year}-${first}-${second}`);
    if (monthDayYear) return monthDayYear;
  }

  const digits = normalized.replace(/\D/g, "");
  if (digits.length === 4) {
    const first = digits.slice(0, 2);
    const second = digits.slice(2, 4);
    const year = String(fallbackYear);
    const dayMonthYear = normalizeIsoDate(`${year}-${second}-${first}`);
    if (dayMonthYear) return dayMonthYear;
    return normalizeIsoDate(`${year}-${first}-${second}`);
  }

  const twoParts = normalized.match(/^(\d{1,2})-(\d{1,2})$/);
  if (twoParts) {
    const first = twoParts[1].padStart(2, "0");
    const second = twoParts[2].padStart(2, "0");
    const year = String(fallbackYear);
    const dayMonthYear = normalizeIsoDate(`${year}-${second}-${first}`);
    if (dayMonthYear) return dayMonthYear;
    return normalizeIsoDate(`${year}-${first}-${second}`);
  }

  if (digits.length !== 8) return null;

  const yearFirst = normalizeIsoDate(`${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}`);
  if (yearFirst) return yearFirst;

  const dayMonthYear = normalizeIsoDate(`${digits.slice(4)}-${digits.slice(2, 4)}-${digits.slice(0, 2)}`);
  if (dayMonthYear) return dayMonthYear;

  return normalizeIsoDate(`${digits.slice(4)}-${digits.slice(0, 2)}-${digits.slice(2, 4)}`);
};

const clampEndDateToStart = (start: string, end: string) => {
  if (!start || !end) return end;
  return end < start ? start : end;
};

const toNumber = (value: string | null, fallback = 0) => {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeRevenueDigits = (value: string) => value.replace(/[^\d]/g, "");

const formatRevenueInput = (digitsValue: string) => {
  if (!digitsValue) return "";
  const normalized = digitsValue.replace(/^0+(?=\d)/, "");
  if (!normalized) return "";
  return new Intl.NumberFormat("da-DK").format(Number(normalized));
};

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button className="button" type="submit" disabled={pending}>
      {pending ? "Saving..." : "Save booking"}
    </button>
  );
}

export function AddBookingForm({
  apartments,
  defaultBookingDate,
  defaultYear,
  returnTo,
  action,
}: {
  apartments: ApartmentOption[];
  defaultBookingDate: string;
  defaultYear: number;
  returnTo: string;
  action: (formData: FormData) => void | Promise<void>;
}) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const defaultEndDate = addDays(defaultBookingDate, 1);

  const [startDate, setStartDate] = useState(defaultBookingDate);
  const [startDateDraft, setStartDateDraft] = useState(defaultBookingDate);
  const [endDate, setEndDate] = useState(defaultEndDate);
  const [endDateDraft, setEndDateDraft] = useState(defaultEndDate);
  const [endDateIsManual, setEndDateIsManual] = useState(false);
  const [netRevenueInput, setNetRevenueInput] = useState("");
  const [bookingSummary, setBookingSummary] = useState<BookingSummary | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    if (searchParams.get("created") !== "1") return;

    setBookingSummary({
      bookingRevenue: toNumber(searchParams.get("booking_revenue")),
      totalRevenueBefore: toNumber(searchParams.get("total_revenue_before")),
      totalRevenueAfter: toNumber(searchParams.get("total_revenue_after")),
      bundfradrag: toNumber(searchParams.get("bundfradrag")),
      taxableBaseBooking: toNumber(searchParams.get("taxable_base_booking")),
      taxOnBooking: toNumber(searchParams.get("tax_on_booking")),
      cutAfterTaxEach: toNumber(searchParams.get("cut_after_tax_each")),
      taxRate: toNumber(searchParams.get("tax_rate"), 0.35),
    });
    setShowDetails(false);

    const params = new URLSearchParams(searchParams.toString());
    params.delete("created");
    params.delete("booking_revenue");
    params.delete("total_revenue_before");
    params.delete("total_revenue_after");
    params.delete("bundfradrag");
    params.delete("taxable_base_booking");
    params.delete("tax_on_booking");
    params.delete("cut_after_tax_each");
    params.delete("tax_rate");

    const nextQuery = params.toString();
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);

  const onStartDateChange = (value: string, syncDraft = true) => {
    setStartDate(value);
    if (syncDraft) {
      setStartDateDraft(value);
    }
    if (!endDateIsManual) {
      const nextEndDate = addDays(value, 1);
      setEndDate(nextEndDate);
      if (syncDraft) {
        setEndDateDraft(nextEndDate);
      }
      return;
    }

    if (endDate && endDate < value) {
      const clampedEndDate = value;
      setEndDate(clampedEndDate);
      setEndDateDraft(clampedEndDate);
    }
  };

  const onEndDateChange = (value: string, syncDraft = true) => {
    const nextEndDate = clampEndDateToStart(startDate, value);
    setEndDate(nextEndDate);
    if (syncDraft) {
      setEndDateDraft(nextEndDate);
    }
    setEndDateIsManual(Boolean(nextEndDate));
  };

  const onStartDateDraftChange = (value: string) => {
    const formatted = shouldUseMobileDateAutofmt()
      ? autoFormatDateDraft(value)
      : value.replace(/[./]/g, "-");
    setStartDateDraft(formatted);
    const parsedDate = parseFlexibleDate(formatted, defaultYear);
    if (parsedDate) {
      onStartDateChange(parsedDate, true);
    }
  };

  const onEndDateDraftChange = (value: string) => {
    const formatted = shouldUseMobileDateAutofmt()
      ? autoFormatDateDraft(value)
      : value.replace(/[./]/g, "-");
    setEndDateDraft(formatted);
    const parsedDate = parseFlexibleDate(formatted, defaultYear);
    if (parsedDate) {
      onEndDateChange(parsedDate, true);
    }
  };

  const onStartDateDraftBlur = () => {
    const parsedDate = parseFlexibleDate(startDateDraft, defaultYear);
    if (parsedDate) {
      onStartDateChange(parsedDate, true);
      return;
    }
    setStartDateDraft(startDate);
  };

  const onEndDateDraftBlur = () => {
    const parsedDate = parseFlexibleDate(endDateDraft, defaultYear);
    if (parsedDate) {
      onEndDateChange(parsedDate, true);
      return;
    }
    setEndDateDraft(endDate);
  };

  return (
    <>
      <form action={action} className="form-grid">
        <input type="hidden" name="return_to" value={returnTo} />
        <label className="form-field">
          <span className="label">Apartment</span>
          <select className="select" name="apartment_id" required>
            {apartments.map((apt) => (
              <option key={apt.id} value={apt.id}>
                {apt.name}
              </option>
            ))}
          </select>
        </label>
        <div className="grid grid-2 date-range-grid">
          <label className="form-field compact-field">
            <span className="label">Start date</span>
            <div className="date-input-row">
              <input
                className="input date-manual-input"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                placeholder="YYYY-MM-DD"
                value={startDateDraft}
                onChange={(event) => onStartDateDraftChange(event.target.value)}
                onBlur={onStartDateDraftBlur}
              />
              <div className="date-picker-button" title="Open start date calendar">
                <span className="date-picker-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none">
                    <path
                      d="M7 3v3M17 3v3M4.5 9.5h15M7.5 13h3M13.5 13h3M7.5 17h3M13.5 17h3M6 5h12a1.5 1.5 0 0 1 1.5 1.5v12A1.5 1.5 0 0 1 18 20H6a1.5 1.5 0 0 1-1.5-1.5v-12A1.5 1.5 0 0 1 6 5Z"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                <input
                  className="date-picker-native"
                  type="date"
                  name="start_date"
                  value={startDate}
                  onChange={(event) => onStartDateChange(event.target.value)}
                  aria-label="Select start date"
                  required
                />
              </div>
            </div>
          </label>
          <label className="form-field compact-field">
            <span className="label">End date</span>
            <div className="date-input-row">
              <input
                className="input date-manual-input"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                placeholder="YYYY-MM-DD"
                value={endDateDraft}
                onChange={(event) => onEndDateDraftChange(event.target.value)}
                onBlur={onEndDateDraftBlur}
              />
              <div className="date-picker-button" title="Open end date calendar">
                <span className="date-picker-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none">
                    <path
                      d="M7 3v3M17 3v3M4.5 9.5h15M7.5 13h3M13.5 13h3M7.5 17h3M13.5 17h3M6 5h12a1.5 1.5 0 0 1 1.5 1.5v12A1.5 1.5 0 0 1 18 20H6a1.5 1.5 0 0 1-1.5-1.5v-12A1.5 1.5 0 0 1 6 5Z"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                <input
                  className="date-picker-native"
                  type="date"
                  name="end_date"
                  value={endDate}
                  min={startDate || undefined}
                  onChange={(event) => onEndDateChange(event.target.value)}
                  aria-label="Select end date"
                  required
                />
              </div>
            </div>
          </label>
        </div>
        <label className="form-field">
          <span className="label">Net revenue (DKK)</span>
          <input
            className="input"
            type="text"
            name="net_revenue_dkk"
            inputMode="numeric"
            autoComplete="off"
            placeholder="10.000"
            value={formatRevenueInput(netRevenueInput)}
            onChange={(event) => setNetRevenueInput(normalizeRevenueDigits(event.target.value))}
            required
          />
        </label>
        <SubmitButton />
      </form>

      {bookingSummary ? (
        <div className="modal-backdrop" onClick={() => setBookingSummary(null)}>
          <div
            className="card booking-summary-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Booking split summary"
            onClick={(event) => event.stopPropagation()}
          >
            <h3>Booking saved</h3>
            <p>Quick split for charging each other.</p>
            <div className="grid" style={{ gap: "0.75rem", marginTop: "0.5rem" }}>
              <div className="inline" style={{ justifyContent: "space-between" }}>
                <span className="label">Total revenue</span>
                <strong>{formatDkk(bookingSummary.bookingRevenue)}</strong>
              </div>
              <div className="inline" style={{ justifyContent: "space-between" }}>
                <span className="label">Tax</span>
                <strong>- {formatDkk(bookingSummary.taxOnBooking)}</strong>
              </div>
              <div className="inline" style={{ justifyContent: "space-between" }}>
                <span className="label">Cut after tax (each)</span>
                <strong>{formatDkk(bookingSummary.cutAfterTaxEach)}</strong>
              </div>
            </div>

            {showDetails ? (
              <>
                <div
                  className="grid"
                  style={{
                    gap: "0.75rem",
                    marginTop: "1rem",
                    borderTop: "1px solid var(--border)",
                    paddingTop: "1rem",
                  }}
                >
                  <div className="inline" style={{ justifyContent: "space-between" }}>
                    <span className="label">Year total before</span>
                    <strong>{formatDkk(bookingSummary.totalRevenueBefore)}</strong>
                  </div>
                  <div className="inline" style={{ justifyContent: "space-between" }}>
                    <span className="label">Year total after</span>
                    <strong>{formatDkk(bookingSummary.totalRevenueAfter)}</strong>
                  </div>
                  <div className="inline" style={{ justifyContent: "space-between" }}>
                    <span className="label">Bundfradrag</span>
                    <strong>{formatDkk(bookingSummary.bundfradrag)}</strong>
                  </div>
                  <div className="inline" style={{ justifyContent: "space-between" }}>
                    <span className="label">Taxable base from this booking (60%)</span>
                    <strong>{formatDkk(bookingSummary.taxableBaseBooking)}</strong>
                  </div>
                  <div className="inline" style={{ justifyContent: "space-between" }}>
                    <span className="label">Tax rate</span>
                    <strong>{formatPercent(bookingSummary.taxRate)}</strong>
                  </div>
                </div>
                <p style={{ marginTop: "0.75rem" }}>
                  Tax uses 60% of the amount above bundfradrag as taxable base.
                </p>
              </>
            ) : null}

            <div className="inline" style={{ justifyContent: "flex-end", marginTop: "0.8rem" }}>
              <button
                className="button ghost"
                type="button"
                onClick={() => setShowDetails((prev) => !prev)}
              >
                {showDetails ? "Hide details" : "Show details"}
              </button>
              <button className="button" type="button" onClick={() => setBookingSummary(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
