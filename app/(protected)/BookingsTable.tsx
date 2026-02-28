"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { formatDkk, formatPercent } from "@/lib/format";

type BookingRow = {
  id: string;
  apartment_id: string;
  start_date: string;
  end_date: string;
  net_revenue_dkk: number;
  apartments?: { name: string } | null;
  calculation?: {
    year: number;
    booking_revenue_dkk: number;
    total_revenue_before_dkk: number;
    total_revenue_after_dkk: number;
    bundfradrag_dkk: number;
    taxable_base_booking_dkk: number;
    tax_on_booking_dkk: number;
    cut_after_tax_each_dkk: number;
    tax_rate: number;
  } | null;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const getBookingNights = (startDate: string, endDate: string) => {
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  const diffInDays = Math.round((end.getTime() - start.getTime()) / MS_PER_DAY);
  return Math.max(0, diffInDays);
};

export function BookingsTable({
  bookings,
  removeAction,
}: {
  bookings: BookingRow[];
  removeAction: (formData: FormData) => void | Promise<void>;
}) {
  const [selectedBooking, setSelectedBooking] = useState<BookingRow | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const openBooking = (booking: BookingRow) => {
    setSelectedBooking(booking);
    setShowDetails(false);
  };

  const closeBooking = () => {
    setSelectedBooking(null);
    setShowDetails(false);
  };

  return (
    <>
      <table className="table">
        <thead>
          <tr>
            <th>Apartment</th>
            <th>Dates</th>
            <th>Net revenue</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {bookings.map((booking) => {
            const bookingNights = getBookingNights(booking.start_date, booking.end_date);

            return (
              <tr
                key={booking.id}
                className="booking-row"
                onClick={() => openBooking(booking)}
                title="Click to review saved calculation"
              >
                <td>{booking.apartments?.name ?? "-"}</td>
                <td>
                  <div>{booking.start_date} → {booking.end_date}</div>
                  <div className="label">
                    {bookingNights} night{bookingNights === 1 ? "" : "s"}
                  </div>
                </td>
                <td>{formatDkk(booking.net_revenue_dkk)}</td>
                <td onClick={(event) => event.stopPropagation()}>
                  <form action={removeAction}>
                    <input type="hidden" name="booking_id" value={booking.id} />
                    <button className="button ghost" type="submit">
                      Remove
                    </button>
                  </form>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {selectedBooking && isMounted
        ? createPortal(
            <div className="modal-backdrop" onClick={closeBooking}>
              <div
                className="card booking-summary-modal"
                role="dialog"
                aria-modal="true"
                aria-label="Booking calculation review"
                onClick={(event) => event.stopPropagation()}
              >
                <h3>Booking calculation</h3>
                <p>
                  {selectedBooking.apartments?.name ?? "-"}: {selectedBooking.start_date} →{" "}
                  {selectedBooking.end_date}
                </p>

                {selectedBooking.calculation ? (
                  <>
                    <div className="grid" style={{ gap: "0.75rem", marginTop: "0.5rem" }}>
                      <div className="inline" style={{ justifyContent: "space-between" }}>
                        <span className="label">Total revenue</span>
                        <strong>{formatDkk(selectedBooking.calculation.booking_revenue_dkk)}</strong>
                      </div>
                      <div className="inline" style={{ justifyContent: "space-between" }}>
                        <span className="label">Tax</span>
                        <strong>- {formatDkk(selectedBooking.calculation.tax_on_booking_dkk)}</strong>
                      </div>
                      <div className="inline" style={{ justifyContent: "space-between" }}>
                        <span className="label">Cut after tax (each)</span>
                        <strong>{formatDkk(selectedBooking.calculation.cut_after_tax_each_dkk)}</strong>
                      </div>
                    </div>

                    {showDetails ? (
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
                          <strong>{formatDkk(selectedBooking.calculation.total_revenue_before_dkk)}</strong>
                        </div>
                        <div className="inline" style={{ justifyContent: "space-between" }}>
                          <span className="label">Year total after</span>
                          <strong>{formatDkk(selectedBooking.calculation.total_revenue_after_dkk)}</strong>
                        </div>
                        <div className="inline" style={{ justifyContent: "space-between" }}>
                          <span className="label">Bundfradrag</span>
                          <strong>{formatDkk(selectedBooking.calculation.bundfradrag_dkk)}</strong>
                        </div>
                        <div className="inline" style={{ justifyContent: "space-between" }}>
                          <span className="label">Taxable base from this booking (60%)</span>
                          <strong>{formatDkk(selectedBooking.calculation.taxable_base_booking_dkk)}</strong>
                        </div>
                        <div className="inline" style={{ justifyContent: "space-between" }}>
                          <span className="label">Tax rate</span>
                          <strong>{formatPercent(selectedBooking.calculation.tax_rate)}</strong>
                        </div>
                        <div className="inline" style={{ justifyContent: "space-between" }}>
                          <span className="label">Snapshot year</span>
                          <strong>{selectedBooking.calculation.year}</strong>
                        </div>
                      </div>
                    ) : null}
                  </>
                ) : (
                  <p className="notice" style={{ marginTop: "0.75rem" }}>
                    No stored calculation snapshot exists for this booking yet.
                  </p>
                )}

                <div className="inline" style={{ justifyContent: "flex-end", marginTop: "1rem" }}>
                  {selectedBooking.calculation ? (
                    <button
                      className="button ghost"
                      type="button"
                      onClick={() => setShowDetails((prev) => !prev)}
                    >
                      {showDetails ? "Hide details" : "Show details"}
                    </button>
                  ) : null}
                  <button className="button" type="button" onClick={closeBooking}>
                    Close
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
