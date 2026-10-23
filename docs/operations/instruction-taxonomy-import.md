# Confirmed CSV assignment import

The existing Structure administration tab includes an **Import CSV** view. Upload the prepared
UTF-8 BOM, semicolon-delimited CSV and inspect its report before applying any assignments. This
workflow uses the bulk operation journal, backup, lease, recovery and assignment-only rollback.
The existing command-line preflight stays read-only.

## File and matching rules

The uploaded file is limited to 4 MiB and 5,000 records. The browser transfers its original bytes;
the server checks canonical base64, BOM, fatal UTF-8 decoding, CSV syntax and the eleven expected
columns. Extra or missing columns and malformed CSV fail before creating an operation.

```text
document_id;url;title_from_url_verify;catalog;section_id;section_name;tags_ids;tags_names;review_status;lastmod;notes
```

Each record must resolve through `url` to exactly one currently published instruction. Matching reuses
the existing current-slug, internal-ID-address and saved-alias index. Slug case is retained; trailing
slashes normalize as in the existing preflight. The configured HTTP(S) origin must match and URLs
with credentials, query strings or fragments are rejected. A draft-only record has no established
published URL and is not selected by this importer. Duplicate CSV addresses, repeated source ordinals,
multiple aliases targeting one instruction and ambiguous live addresses are reported and excluded.

`document_id` is a source row identifier, never the site's internal ID. The uploaded title is an
unconfirmed display/checking value and cannot establish a match or overwrite the document title.
The importer requires exact current registry section/tag IDs and matching dictionary names. A catalog
is derived from its section and checked against the uploaded label. Historical category/tag IDs or
escaped/renamed labels that fail these checks appear as row errors; there is no inferred mapping.

The report shows matched, missing, ambiguous, invalid, held and eligible records. These counts can
overlap: a matched row can also require manual review or contain a dictionary error. Unknown section
and tag counts identify distinct missing codes; row-level errors identify every affected record.
Only eligible rows enter the assignment preview. If none are eligible, the report is still available
and no executable preview is created. Both the report and the assignment preview can be downloaded
as safe JSON without private backup bytes.

## Manual review

The 63 URLs from the supplied `BOYKOVDOCS_CHECK_MANUALLY.csv` are a server-owned source reference in
`server/src/data/instructionTaxonomyReviewSource.json`. Its provenance and normalized records are
checked against pinned checksums. Source fields, including reasons and confidence strings, are kept
verbatim and do not establish approval.

These records are held even if the upload clears `review_status`. References resolve through saved
live aliases as well, so using a different current address for the same instruction does not bypass
the hold. Newly flagged or unrecognized review statuses are also held for examination. Held records
remain in the report and never enter the CSV plan. Review and assign these instructions individually
through the existing editor; this batch adds no bulk approval of disputed classifications.

## Tag modes and scope

**Add** is the default mode. It preserves each saved version's existing tags and adds the exact CSV
tag IDs without duplication. An empty CSV tag list preserves the existing tags.

**Replace** requires a separate acknowledgement before preview. It uses exactly the CSV tag list,
including clearing all tags when that list is empty. The final assignment preview requires its own
explicit application confirmation. The selected mode is bound to the stored operation.

After matching a published ID, the assignment applies to its published record and every saved draft,
including an older draft. The administrator explicitly acknowledges this scope. Each version's
before/after assignments are visible. When any version changes, both existing sibling revisions
advance by one, preserving which draft was active. Drafts retain their status.

Imported fields are the primary section and tags, together with existing assignment-source metadata.
The CSV does not overwrite title, H1, SEO, body, URL, files, content hashes, document versions, dates,
stored `review_status` or notes. Uploaded `lastmod` never becomes a document modification date.

## Confirmation and history

The immutable 30-minute preview captures the authenticated administrator, dictionary revision,
selected file fingerprints and saved-version inventory. It also captures the published address
namespace. A newly added or changed URL/alias invalidates confirmation even when it belongs to an
otherwise unselected instruction. An unrelated body-only edit outside the selected records does
not alter the address snapshot. Any relevant conflict requires another preview before writing.

Apply submits only the server-issued preview ID and confirmation. The journal records the source
filename, SHA-256, tag mode, report counts and ordinary operation counts. Repeat upload uses current
data and produces an updated report; identical assignments are no-ops. It does not create documents,
tags or sections. Replaying an already committed preview returns its saved result.

CSV operations use the existing interrupted-write recovery and committed-operation rollback. Rollback
restores assignments into current records while retaining later document/SEO edits. Later assignment
changes, removed codes or changed version topology stop automatic rollback. Keep the journal with
the corresponding instruction/draft backups as described in the bulk operations guide.

## API and deployment

`POST /api/admin/instruction-taxonomy-operations/import-preview` requires the existing administrator
session and returns `Cache-Control: private, no-store`. Its exact body is:

```json
{
  "fileName": "BOYKOVDOCS_IMPORT_2169_NEW_CATEGORIES.csv",
  "csvBase64": "base64-of-original-file-bytes",
  "registryRevision": 0,
  "includeDrafts": true,
  "tagMode": "add",
  "replaceConfirmed": false
}
```

Use the actual dictionary revision. Replacement uses `tagMode: "replace"` and
`replaceConfirmed: true`. The import endpoint has a narrow 8 MiB JSON parser limit to accommodate
base64 overhead; existing operation endpoints retain their 2 MiB limit. Successful previews reuse
`POST /apply`, history, rollback-preview and recovery. A report-only response has `previewId: null`.

Apply the complete file set and run the Quality Gate before the existing rebuild/restart process.
The new source JSON must be included in the commit despite the repository's ignored data directory.
Production Compose bind-mounts `app/server/src/data` over the image's data directory. Verify the new
JSON exists in that host checkout before restarting the API; an image-only copy is insufficient.
Copy this one source file through the normal tracked-file update, preserving runtime records.
No new dependencies, environment variables, offline apply commands or automatic migration are added.
Use a test environment for the first source-file import and review its downloadable report.

Deployment itself does not change the 2,169 assignments. Production matching cannot be confirmed
without the real instruction records. H01 route approval, public taxonomy landing pages, sitemap,
redirects and the remaining publication work stay outside this batch.
