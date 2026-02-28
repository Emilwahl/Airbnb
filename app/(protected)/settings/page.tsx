import {
  ensureApartments,
  getOrCreateTaxSettings,
  listApartments,
} from "@/lib/db";
import { addApartment, saveApartment, saveTaxSettings } from "../actions";
import { YearSelect } from "../YearSelect";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams?: { year?: string };
}) {
  const currentYear = new Date().getFullYear();
  const selectedYear = Number(searchParams?.year) || currentYear;

  await ensureApartments();
  const [apartments, settings] = await Promise.all([
    listApartments(),
    getOrCreateTaxSettings(selectedYear),
  ]);

  const yearOptions = Array.from({ length: 5 }, (_, idx) => currentYear - idx);

  return (
    <div className="grid">
      <div className="card">
        <div className="section-title">
          <div>
            <span className="label">Tax settings</span>
            <h2>Bundfradrag & tax rate</h2>
          </div>
          <YearSelect years={yearOptions} value={selectedYear} label="Year" />
        </div>
        <form action={saveTaxSettings} className="form-grid" style={{ marginTop: "1rem" }}>
          <input type="hidden" name="id" value={settings.id} />
          <div className="grid grid-2">
            <label className="form-field">
              <span className="label">Bundfradrag (Airbnb)</span>
              <input
                className="input"
                type="number"
                name="bundfradrag_platform_dkk"
                min="0"
                step="1"
                defaultValue={settings.bundfradrag_platform_dkk}
              />
            </label>
            <label className="form-field">
              <span className="label">Tax rate (%)</span>
              <input
                className="input"
                type="number"
                name="tax_rate"
                min="0"
                step="0.1"
                defaultValue={settings.tax_rate * 100}
              />
            </label>
          </div>
          <button className="button" type="submit">
            Save tax settings
          </button>
        </form>
      </div>

      <div className="card">
        <span className="label">Apartments</span>
        <h2>Apartment labels</h2>
        <div className="grid" style={{ marginTop: "1rem" }}>
          {apartments.map((apt) => (
            <form action={saveApartment} key={apt.id} className="form-grid">
              <input type="hidden" name="id" value={apt.id} />
              <label className="form-field">
                <span className="label">Name</span>
                <input className="input" name="name" defaultValue={apt.name} />
              </label>
              <div className="inline" style={{ justifyContent: "flex-end" }}>
                <button className="button secondary" type="submit">
                  Update apartment
                </button>
              </div>
            </form>
          ))}
        </div>
      </div>

      <div className="card">
        <span className="label">Add new</span>
        <h2>Add apartment</h2>
        <form action={addApartment} className="form-grid" style={{ marginTop: "1rem" }}>
          <label className="form-field">
            <span className="label">Apartment name</span>
            <input className="input" name="name" placeholder="Apartment 3" />
          </label>
          <button className="button" type="submit">
            Add apartment
          </button>
        </form>
      </div>
    </div>
  );
}
