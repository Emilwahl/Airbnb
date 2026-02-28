# Rental Tax Tracker

Mobile-first Next.js app for tracking Airbnb revenue, bookings, and Danish tax estimates.

## Setup
1. Create a Supabase project.
2. In the Supabase SQL editor, run `supabase/schema.sql`.
3. Copy `.env.example` to `.env.local` and fill in values.
4. Generate a shared-password hash:
   ```bash
   node scripts/hash-password.mjs "your-shared-password"
   ```
   Base64-encode the hash and paste into `APP_PASSWORD_HASH_B64`.
   Example:
   ```bash
   node scripts/hash-password.mjs "your-shared-password" | base64
   ```
5. Install dependencies:
   ```bash
   npm install
   ```
6. Run the app:
   ```bash
   npm run dev
   ```

## Security model
- The app uses a **single shared password** and a signed, httpOnly session cookie.
- Supabase data is accessed **server-side** with the service role key.
- Row Level Security (RLS) is enabled and no policies are defined, so only the service role can read/write data.
- No private data is rendered unless the session cookie is valid.

## Notes
- Revenue is assigned to the month of check-in.
- Long-term rentals (4+ months) are excluded from tax calculations until a dedicated rule is defined.
- Bundfradrag and tax rates are editable per year.
