# Catalog PDF download limit

Each verified user account may download catalog PDFs five times in total. The
allowance never resets. Repeated downloads of the same instruction count again.
Admin downloads and PDFs from purchased orders are exempt.

The catalog UI explains the limit. A successful response includes
`X-Download-Limit` and `X-Download-Remaining`. Exhausted accounts receive HTTP 403
with code `DOWNLOAD_LIMIT_REACHED`; unavailable or corrupted quota storage returns
HTTP 503 without delivering a PDF. Paid orders keep their existing access rules.

## Persistence and rollout

- `server/data/download-quotas.json` stores capped counts keyed by the SHA-256 hash
  of the account ID. It is runtime data, excluded from Git and already covered by
  the production data volume and backup manifest.
- On first use, the service imports valid existing catalog download events from
  `server/src/data/analytics/download-events.jsonl`. Users with five or more
  recorded downloads have no remaining allowance. Missing history means no
  recorded previous downloads; malformed log lines are skipped.
- Import runs only when the quota file is absent. Preserve the file across
  deployments; never remove it as a way to refresh application code.
- A short filesystem lock protects the final check and atomic counter update
  across requests and processes. Counts survive application restarts.
- The counter is committed after successful PDF generation and validation, just
  before delivery. Missing files, denied access, HEAD requests, generation errors
  and connections closed before delivery do not spend an allowance. If the
  connection or process fails after the commit, the allowance remains spent;
  the server cannot confirm that a browser saved the file.

Run `npm run quality:check` before release. The download quota tests cover
historical import, persistence, isolated accounts, concurrent requests/processes,
failure handling and the paid-order exemption.
