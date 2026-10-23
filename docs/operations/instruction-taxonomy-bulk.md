# Confirmed bulk taxonomy operations

The existing **Structure** administration tab has three local views: dictionaries, instruction
bindings and operation history. Bulk actions set one primary registry section, add registry tags or
remove exact selected tags. A section determines its catalog. Existing legacy assignments remain
visible; removal accepts their exact IDs. T47, T48 and the historical combined tag are independent.

## Selection and confirmation

Search by title or internal ID and filter by section or tag. Filters match any saved version of a
document. The header checkbox selects the current page; explicit selections persist across pages.
Changing a filter clears the selection. Selection and action changes invalidate the preview.

An operation includes the published record and every saved draft of each selected ID, including an
older draft ignored by the normal editor. The administrator explicitly acknowledges this scope.
Drafts keep their status. Preview rows show each version's assignments before and after the action,
along with selected, changed, unchanged and updated-version counts. An unchanged sibling may need
a revision update: when any version changes assignments, all existing versions of that ID advance
their revision by one. This preserves whether a draft was newer than its published sibling.

The server stores an immutable preview for 30 minutes and binds it to the authenticated administrator
and registry revision. Apply accepts only the preview ID and explicit confirmation. It checks exact
file fingerprints and the saved-version inventory before the first write. Any intervening edit,
new/discarded draft or registry change requires a new preview. Replaying a committed preview returns
its saved result. Up to 5,000 explicitly selected IDs are supported; oversized journal data fails
before instruction writes.

The metadata form remains mounted when changing local views. Bulk completion refreshes usage counts
without replacing unsaved metadata or advancing its captured registry revision. A busy operation
temporarily disables changing these views.

The common strict reader validates UTF-8 JSON, regular files, safe portable instruction IDs,
filename/ID agreement, assignment field types and stored revisions. A malformed record stops the
operation instead of disappearing from the reference set. Unicode, historical mixed-case/dotted IDs
and published records with a missing or zero revision remain supported.

## Backup, interruption and rollback

Runtime operation files live in `server/data/instruction-taxonomy-operations/`, alongside the runtime
registry. Every preview includes server-private before/after bytes and checksums. The operation plan
and active marker are saved before the first instruction write. Files use atomic replacement and
regular-file fsync. Journal directory synchronization runs on supported POSIX systems; Windows does
not open directories for fsync. Existing site backups already cover this directory through
`server/data`.

All normal registry, editor, persistence and instruction-history mutations share the taxonomy lease.
A pending operation blocks these writers until recovery. Recovery first verifies all affected files
against the known before/after states, then restores interrupted writes. An unexpected edit or missing
version stops recovery and retains the block. A committed operation with a leftover active marker is
finalized without undoing its saved changes. Corrupt journal data fails closed. Keep the complete
operation directory with the instructions and drafts when investigating an interruption.

The history view offers a separate preview and confirmation for rollback of a committed bulk action.
Rollback restores only the original assignment fields and taxonomy metadata into current records,
then advances revisions. Later text, SEO, URLs, status, document versions, content hashes, files and
dates remain intact. Changed assignments, deleted codes, missing versions or changed version topology
cause a conflict. Rollback does not recreate removed documents. A completed rollback cannot be applied
twice. Recovery of an interrupted transaction and rollback of a completed action are separate actions.

The shared lease serializes participating writers. Multi-file replacement is not a database-level
atomic snapshot for public reads in other processes. Do not run offline writers, old server versions
or filesystem maintenance concurrently with these operations. Existing offline backfill requirements
continue to apply.

## Transfer before deletion

An occupied section offers viewing its related instructions and transferring them to another section.
The source filter includes saved drafts. Select the intended documents, inspect the preview and apply
the transfer; reload usage before deleting the now-unused section. A related tag offers the same list
with an exact-tag removal action. Removing a catalog still requires handling its child sections.
Documents are retained throughout the workflow.

## CSV export

The export button downloads all current published assignments. Draft-only records and saved draft
overlays are excluded. The API also supports explicit query, section and tag filters on published
records. Export acquires the shared lease for a consistent registry/file read and creates no registry,
journal or instruction data. A pending operation blocks export until recovery.

CSV uses UTF-8 with BOM, semicolons, CRLF and the source package's eleven columns:

```text
document_id;url;title_from_url_verify;catalog;section_id;section_name;tags_ids;tags_names;review_status;lastmod;notes
```

`document_id` is a row ordinal. Future imports must match by `url`. URLs use the existing public-path
helper and `SITE_URL`, with the established `https://boykovdocs.ru` fallback. Stored slug case is
preserved. Names come from the current dictionary; legacy categories have a blank catalog. Tags use
their exact stored IDs. Stored `review_status` and `notes` are exported when present; otherwise they
are blank. `lastmod` uses existing stored date precedence, with no generated current date.

Human-readable cells beginning with spreadsheet formula markers or leading controls/whitespace receive
an apostrophe prefix. Machine IDs and URLs are untouched. This escaping can change exported display
names; a future strict importer must report such mismatches for review rather than silently stripping
the prefix. Unknown assignments, duplicate current URLs and malformed stored values produce a conflict.

## Administrator API

All routes require the existing administrator authorization and return `Cache-Control: private, no-store`.
The prefix is `/api/admin/instruction-taxonomy-operations`.

| Method | Path                                                | Purpose                                |
| ------ | --------------------------------------------------- | -------------------------------------- |
| GET    | `/bindings?query=&section=&tag=&page=1&pageSize=25` | Bindings grouped by instruction ID     |
| GET    | `/history?page=1&pageSize=25`                       | Safe operation summaries               |
| GET    | `/status`                                           | Pending-operation status               |
| POST   | `/preview`                                          | Store a proposed manual action         |
| POST   | `/apply`                                            | Confirm a stored preview               |
| POST   | `/history/:id/rollback-preview`                     | Preview assignment-only rollback       |
| POST   | `/recover`                                          | Confirm interrupted-operation recovery |
| GET    | `/export`                                           | Download published-assignment CSV      |

Preview body:

```json
{
  "ids": ["existing-instruction-id"],
  "registryRevision": 0,
  "includeDrafts": true,
  "action": { "type": "set-section", "sectionId": "P10" }
}
```

Use the actual registry revision. Other actions are `{ "type": "add-tags", "tagIds": ["T47"] }`
and `{ "type": "remove-tags", "tagIds": ["T47"] }`. Apply body is
`{ "previewId": "server-issued-uuid", "confirmed": true }`. Recovery body is
`{ "operationId": "pending-operation-uuid", "confirmed": true }`. The authenticated actor comes
from the session. API DTOs and downloadable preview reports exclude private backup bytes and paths.

## Deployment scope

Apply the complete source-file set and run the Quality Gate before the normal rebuild/restart.
There are no new dependencies, environment variables or migration commands. Deployment itself
does not reclassify instructions. Runtime records and operation backups are not part of the delivery.

Source CSV application, the 2,169-row migration and its 63 manual-review cases remain a later stage.
H01 route approval remains unresolved. Existing instruction URLs, source dictionaries, public landing
routes, sitemap and redirect handling are unchanged by this batch.
