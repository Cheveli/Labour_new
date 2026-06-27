# TODO - Labour App (Approved Spec)

## Remaining Tasks
1. **Material Payment System V2 (payment_system_v2 / paid-unpaid / payment modal)**
   - Update `src/app/(dashboard)/materials/page.tsx`
     - Add v2 toggle/field for new entries (or determine v2 based on existing boolean)
     - Add Paid/Unpaid UI for v2 rows only
     - Implement Payment modal (Cash/Online, Account Name if online, Payment Date)
     - On mark Paid: write `payment_status='paid'`, `payment_date`, `payment_mode`, `payment_account`
     - Ensure unpaid v2 rows do NOT affect totals.

2. **Exclude unpaid v2 materials from dashboard totals, reports, and weekly cron**
   - Update `src/lib/weekly-report-generator.ts`
     - Filter materials: include all non-v2, but for v2 include only `payment_status='paid'`.
   - Update `src/app/(dashboard)/reports/page.tsx`
     - Materials report query + export should exclude unpaid v2 similarly.

3. **Materials Page Improvements**
   - Add search bar (client-side filtering is OK)
   - Change ordering to newest-first (server order desc)
   - Fix pagination to slice newest-first order.

4. **Date Filter UI**
   - From/To inputs hidden by default
   - Show only on calendar button click
   - Fix mobile text/color visibility for filter controls

## Validation
- Run `npm run lint` and ensure TS/ESLint pass.
- Manually verify after implementation:
  - Create v2 unpaid material → appears on Materials page but does NOT count in Dashboard totals, Reports export, or Weekly cron PDF.
  - Mark it Paid → it starts counting everywhere.
  - Materials page shows search results and newest-first pagination.
  - Date filter UI behaves exactly as requested on both desktop and mobile.


