# Catalog PDF download limit

Each registered user receives five free catalog PDF downloads per rolling calendar
month. The renewal date is **one Moscow-calendar-month after the most recent free
PDF download**, not the first download or a fixed first day of the month. Each
successful free download moves the renewal date forward. A month ending on the
31st clamps to the last day of the next month, keeping the time of day in Moscow.
If the user downloads nothing further, their allowance renews automatically on
the next quota read or consumption once that date has arrived. No cron is needed.
Repeated free downloads of the same instruction count again. Admin downloads and
purchased PDFs are exempt; purchases and wallet balances never expire with quota.

The authenticated `GET /api/instructions/download-quota` endpoint retains the
existing `{ limit, used, remaining }` contract. For the account page, request
`GET /api/instructions/download-quota?schedule=1` to additionally receive
`lastFreeDownloadAt` and `nextResetAt` (ISO timestamps, `null` before the first
free download or after renewal). The schedule endpoint requires the signed-in
user and never accepts another user ID. A disabled or inaccessible quota store
returns HTTP 503 instead of fabricated free downloads or dates.

The account wallet shows the current allowance and exact renewal date, and keeps
the existing **Пополнить баланс** button for paid purchases. It refreshes when
the page loads and returns to the foreground. The catalog UI shows the remaining
free downloads below the PDF button; the same quota service gates free downloads
and paid purchases. Failed reads show errors, never invented balances.

Successful free PDF responses include `X-Download-Limit` and
`X-Download-Remaining`; exhausted users receive HTTP 403 and code
`DOWNLOAD_LIMIT_REACHED`. Only successfully prepared free PDFs commit usage,
before delivery, under a cross-process lease. A disconnect after commit can still
consume an allowance. Paid purchases retain all existing access and price rules.

## Persistence, migration and rollout

- Keep `server/data/download-quotas.json` across all deployments. It stores hashes
  of account IDs, not user emails. Back it up together with the analytics history
  (`server/src/data/analytics/download-events.jsonl`) **before deploying**.
- The new file schema is `version: 2`; each account entry has `used` and
  `lastFreeDownloadAt`. The first read of an old `version: 1` file upgrades it
  atomically under the existing lock without resetting counters prematurely.
- Migration uses the latest valid **free** analytics event for each account to
  determine its last-download date. Paid events, malformed events and events in
  the future are ignored. When a legacy count is nonzero but no trustworthy event
  exists, the migration timestamp is used conservatively as the initial anchor.
  This exceptional fallback delays a reset rather than crediting unverified usage.
- When the quota file does not exist, valid historical free events are replayed
  chronologically using the same rolling renewal rule. Import runs once; never
  delete the quota file to force a refresh.
- `get`, `getSchedule` and `consume` all share one lease and atomic state write.
  Expired allowances reset lazily while holding the lease. Corrupt storage fails
  closed without overwriting the file; simultaneous callers cannot over-consume.
- Deploy the API and static account assets together, preserve the account HTML,
  tracked configuration, ignored runtime files and all archived data. Verify the
  authenticated schedule endpoint and account before enabling user traffic.
- Avoid artificially moving the server clock or manually editing quota records.
  Backups and restored snapshots must retain original timestamps and schema.

Run `npm run quality:check` in Linux CI before release. The tests cover month-end
rules, migration, reuse after expiry, other accounts, concurrent downloads, storage
failures and the wallet's independent purchase flow.
