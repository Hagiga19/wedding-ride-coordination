/*
# Add date, time, and location to weddings table

1. Modified Tables
- `weddings`
  - `wedding_date` (date, nullable) — the date of the wedding
  - `wedding_time` (text, nullable) — the time of the wedding (e.g. "19:00")
  - `wedding_location` (text, nullable) — the venue address of the wedding

2. Security
- No changes to RLS policies. Existing policies remain in place.
- All new columns are nullable so existing weddings are unaffected.

3. Notes
- These columns store the wedding venue details so that car forms can
  auto-fill the static "to" or "from" location based on direction.
- The wedding_location is also displayed on the wedding page and made
  clickable to open navigation in a maps app.
*/

ALTER TABLE weddings
  ADD COLUMN IF NOT EXISTS wedding_date date,
  ADD COLUMN IF NOT EXISTS wedding_time text,
  ADD COLUMN IF NOT EXISTS wedding_location text;
