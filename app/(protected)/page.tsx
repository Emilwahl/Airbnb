import { ensureApartments, getOrCreateTaxSettings, listApartments, listBookings } from "@/lib/db";
import { calculateTax } from "@/lib/tax";
import { formatDkk } from "@/lib/format";
import { createBooking, removeBooking } from "./actions";
import { AddBookingForm } from "./AddBookingForm";
import { BookingsTable } from "./BookingsTable";
import { BookingApartmentSelect } from "./BookingApartmentSelect";
import { YearSelect } from "./YearSelect";
import { MobileTabs } from "./MobileTabs";

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: { year?: string; apartment?: string; created?: string };
}) {
  const currentYear = new Date().getFullYear();
  const yearParam = searchParams?.year;
  const isAllTime = yearParam === "all";
  const parsedYear = Number(yearParam);
  const selectedYear = Number.isFinite(parsedYear) && parsedYear > 0 ? parsedYear : currentYear;
  const selectedPeriod: number | "all" = isAllTime ? "all" : selectedYear;
  const settingsYear = selectedPeriod === "all" ? currentYear : selectedPeriod;
  const today = new Date();
  const defaultBookingDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(today.getDate()).padStart(2, "0")}`;

  await ensureApartments();
  const [apartments, settings, bookings] = await Promise.all([
    listApartments(),
    getOrCreateTaxSettings(settingsYear),
    listBookings(selectedPeriod === "all" ? undefined : selectedPeriod),
  ]);

  const apartmentIds = new Set(apartments.map((apt) => apt.id));
  const selectedApartmentFromParams = searchParams?.apartment ?? "all";
  const selectedBookingApartment =
    selectedApartmentFromParams === "all" || apartmentIds.has(selectedApartmentFromParams)
      ? selectedApartmentFromParams
      : "all";
  const returnQuery = new URLSearchParams();
  if (searchParams?.year) returnQuery.set("year", searchParams.year);
  if (selectedBookingApartment !== "all") returnQuery.set("apartment", selectedBookingApartment);
  const returnTo = returnQuery.size > 0 ? `/?${returnQuery.toString()}` : "/";

  const sortedBookings = [...bookings].sort((a, b) => {
    const apartmentNameA = a.apartments?.name ?? "";
    const apartmentNameB = b.apartments?.name ?? "";

    const byApartment = apartmentNameA.localeCompare(apartmentNameB, "da");
    if (byApartment !== 0) return byApartment;

    const byStartDate = b.start_date.localeCompare(a.start_date);
    if (byStartDate !== 0) return byStartDate;

    return b.end_date.localeCompare(a.end_date);
  });

  const filteredBookings =
    selectedBookingApartment === "all"
      ? sortedBookings
      : sortedBookings.filter((booking) => booking.apartment_id === selectedBookingApartment);

  const bundfradrag = settings.bundfradrag_platform_dkk;

  const totalsByApartment = new Map<string, { total: number }>();
  apartments.forEach((apt) => {
    totalsByApartment.set(apt.id, { total: 0 });
  });

  const monthlyTotalsByApartment = new Map<string, number[]>();
  const monthlyNightsByApartment = new Map<string, number[]>();

  apartments.forEach((apt) => {
    monthlyTotalsByApartment.set(apt.id, Array.from({ length: 12 }, () => 0));
    monthlyNightsByApartment.set(apt.id, Array.from({ length: 12 }, () => 0));
  });

  bookings.forEach((booking) => {
    const revenue = booking.net_revenue_dkk;
    const totals = totalsByApartment.get(booking.apartment_id);
    if (totals) {
      totals.total += revenue;
    }

    const monthIndex = new Date(booking.start_date).getMonth();
    const monthTotals = monthlyTotalsByApartment.get(booking.apartment_id);
    if (monthTotals) {
      monthTotals[monthIndex] += revenue;
    }

    const bookingStart = new Date(`${booking.start_date}T00:00:00Z`);
    const bookingEnd = new Date(`${booking.end_date}T00:00:00Z`);
    const yearStart = new Date(Date.UTC(selectedYear, 0, 1));
    const yearEndExclusive = new Date(Date.UTC(selectedYear + 1, 0, 1));
    const start =
      selectedPeriod === "all"
        ? bookingStart
        : bookingStart < yearStart
          ? yearStart
          : bookingStart;
    const endExclusive =
      selectedPeriod === "all"
        ? bookingEnd
        : bookingEnd > yearEndExclusive
          ? yearEndExclusive
          : bookingEnd;

    if (start < endExclusive) {
      const cursor = new Date(Date.UTC(start.getFullYear(), start.getMonth(), start.getDate()));
      const limit = new Date(
        Date.UTC(endExclusive.getFullYear(), endExclusive.getMonth(), endExclusive.getDate())
      );
      const nightTotals = monthlyNightsByApartment.get(booking.apartment_id);

      while (cursor < limit) {
        const month = cursor.getUTCMonth();
        if (nightTotals) {
          nightTotals[month] += 1;
        }
        cursor.setUTCDate(cursor.getUTCDate() + 1);
      }
    }
  });

  const apartmentSummaries = apartments.map((apt) => {
    const totals = totalsByApartment.get(apt.id) ?? { total: 0 };
    const apartmentBookings = bookings.filter((booking) => booking.apartment_id === apt.id);
    const hasCompleteSnapshots =
      apartmentBookings.length > 0 &&
      apartmentBookings.every((booking) => Boolean(booking.calculation));
    const snapshotTaxableBase = apartmentBookings.reduce(
      (sum, booking) => sum + (booking.calculation?.taxable_base_booking_dkk ?? 0),
      0
    );
    const snapshotTaxDue = apartmentBookings.reduce(
      (sum, booking) => sum + (booking.calculation?.tax_on_booking_dkk ?? 0),
      0
    );
    const tax =
      selectedPeriod === "all" && hasCompleteSnapshots
        ? {
            ownerRevenue: totals.total,
            ownerBundfradrag: 0,
            taxableBase: snapshotTaxableBase,
            taxDue: snapshotTaxDue,
            netAfterTax: totals.total - snapshotTaxDue,
          }
        : calculateTax({
            totalRevenue: totals.total,
            ownershipShare: 1,
            bundfradrag,
            taxRate: settings.tax_rate,
          });

    return { apt, totals, tax };
  });

  const overallRevenue = apartmentSummaries.reduce((sum, item) => sum + item.totals.total, 0);

  const overallTaxDue = apartmentSummaries.reduce((sum, item) => sum + item.tax.taxDue, 0);

  const overallNetAfterTax = apartmentSummaries.reduce(
    (sum, item) => sum + item.tax.netAfterTax,
    0
  );

  const yearOptions = Array.from({ length: 5 }, (_, idx) => currentYear - idx);
  const periodSummaryTitle = selectedPeriod === "all" ? "All time summary" : `${selectedPeriod} summary`;

  return (
    <div className="grid">
      <div className="card add-booking-card">
        <h2>Add booking</h2>
        <p>Use the dates for each guest and the net payout you received.</p>
        <AddBookingForm
          apartments={apartments.map((apt) => ({ id: apt.id, name: apt.name }))}
          defaultBookingDate={defaultBookingDate}
          defaultYear={selectedPeriod === "all" ? currentYear : selectedPeriod}
          returnTo={returnTo}
          action={createBooking}
        />
      </div>

      <MobileTabs>
        <div className="grid" data-section="overview">
          <div className="card">
            <div className="section-title">
              <div>
                <span className="label">Period overview</span>
                <h2>{periodSummaryTitle}</h2>
              </div>
              <YearSelect
                years={yearOptions}
                value={selectedPeriod}
                label="Period"
                includeAll
                allLabel="All time"
              />
            </div>
            <div className="grid grid-3" style={{ marginTop: "1.5rem" }}>
              <div>
                <div className="label">Total revenue</div>
                <h3>{formatDkk(overallRevenue)}</h3>
              </div>
              <div>
                <div className="label">Tax estimate</div>
                <h3>{formatDkk(overallTaxDue)}</h3>
              </div>
              <div>
                <div className="label">Net after tax</div>
                <h3>{formatDkk(overallNetAfterTax)}</h3>
              </div>
            </div>
          </div>

          <div className="grid grid-2">
            {apartmentSummaries.map(({ apt, totals, tax }) => (
              <div key={apt.id} className="card">
                <div className="inline" style={{ justifyContent: "space-between" }}>
                  <div>
                    <div className="label">Apartment</div>
                    <h3>{apt.name}</h3>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div className="label">Revenue total</div>
                    <strong>{formatDkk(totals.total)}</strong>
                  </div>
                </div>
                <div className="grid grid-3" style={{ marginTop: "1rem" }}>
                  <div>
                    <div className="label">Revenue</div>
                    <div>{formatDkk(totals.total)}</div>
                  </div>
                  <div>
                    <div className="label">Tax due</div>
                    <div>{formatDkk(tax.taxDue)}</div>
                  </div>
                  <div>
                    <div className="label">Net after tax</div>
                    <div>{formatDkk(tax.netAfterTax)}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid" data-section="bookings">
          <div className="card">
            <div className="section-title">
              <div>
                <h2>Bookings ({filteredBookings.length})</h2>
                <p>Sorted by apartment, then most recent check-in.</p>
              </div>
              <BookingApartmentSelect
                apartments={apartments.map((apt) => ({ id: apt.id, name: apt.name }))}
                value={selectedBookingApartment}
              />
            </div>
            <div style={{ overflowX: "auto" }}>
              <BookingsTable bookings={filteredBookings} removeAction={removeBooking} />
            </div>
          </div>
        </div>

        <div className="grid" data-section="seasonality">
          <div className="card">
            <h2>Seasonality snapshot</h2>
            <p>
              Revenue is assigned to the month of check-in. Nights show how many
              booked nights fall in each month for each apartment.
            </p>
            <div className="seasonality-columns">
              {apartments.map((apt) => {
                const totals =
                  monthlyTotalsByApartment.get(apt.id) ?? Array.from({ length: 12 }, () => 0);
                const nights =
                  monthlyNightsByApartment.get(apt.id) ?? Array.from({ length: 12 }, () => 0);
                const bestMonthIndex = totals.reduce(
                  (best, value, index) => (value > totals[best] ? index : best),
                  0
                );

                return (
                  <div key={apt.id} className="seasonality-column">
                    <div className="inline" style={{ justifyContent: "space-between" }}>
                      <h3>{apt.name}</h3>
                      <span className="tag">Seasonality</span>
                    </div>
                    <div className="grid" style={{ marginTop: "1rem" }}>
                      {totals.map((value, index) => (
                        <div
                          key={`${apt.id}-${MONTHS[index]}`}
                          className="inline"
                          style={{
                            justifyContent: "space-between",
                            padding: "0.5rem 0",
                            borderBottom: "1px dashed var(--border)",
                            color: index === bestMonthIndex ? "var(--accent)" : "inherit",
                          }}
                        >
                          <div>
                            <span>{MONTHS[index]}</span>
                          </div>
                          <div style={{ textAlign: "right" }}>
                            <strong>{formatDkk(value)}</strong>
                            <div className="label">
                              {nights[index]} night{nights[index] === 1 ? "" : "s"}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </MobileTabs>
    </div>
  );
}
