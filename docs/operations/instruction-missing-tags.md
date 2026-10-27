# Fill missing instruction tags

`server/scripts/fillMissingInstructionTags.js` applies a reviewed, per-document assignment bundle.
It fills only empty tags in public records. Existing nonempty tag sets and all saved drafts are
unchanged. Sections, document content, URLs, editorial fields and manual-review holds are retained.
Only the changed published records receive a new revision and `taxonomyMeta.tagsSource: manual`.

This is a separate action from CSV import, which also assigns a primary section. It does not
change the review rules or holds of the existing CSV importer.

## Bundle and preview

The JSON bundle contains `schemaVersion: 1`, the original CSV SHA-256, new tag definitions
(`code`, `name`, `slug`) and assignments with the actual stored instruction ID, exact public URL,
title, current section, `tagIds` and SHA-256 of `JSON.stringify(getInstructionDocument(record))`.
Export row numbers must never be used as stored instruction IDs.

New tags are published for navigation with indexing disabled. Existing matching definitions may
be reused only when code, name, slug, publication and indexing settings agree. Code/name/slug
collisions fail closed. The tool does not edit SEO text, publish other entities or enable indexing.

```sh
node server/scripts/fillMissingInstructionTags.js \
  --source-root /absolute/repository \
  --bundle /private/reviewed-assignments.json \
  --output-dir /private/new-preview
```

Default mode writes only to a new output directory outside the source. The directory includes the
reviewed bundle, registry before/after, preview rows and a packed journal containing exact backup
bytes. Keep it private. A metadata scan and bounded record reads avoid loading the application
instruction cache. No HTTP server, workers, application startup, migrations or network are used.

Already tagged records are reported as skipped. A changed title, URL, section or document body on
an untagged record fails review. Do not assign a narrower profession merely to eliminate a blank.
Use a supported broader tag when the reviewed source is general; keep unresolved section reviews.

## Apply

Stop all source writers and create a fresh verified backup of all three business-data trees. Ensure
space for the compressed archive, isolated restore and both packed journals. Keep the API stopped
until the operation finishes or explicit recovery completes.

```sh
node server/scripts/fillMissingInstructionTags.js \
  --source-root /absolute/repository \
  --apply-preview /private/new-preview \
  --writers-stopped
```

Apply verifies the bundle, registry, every selected published/draft fingerprint and packed payload
before writing. It creates noindex tag definitions in one registry update, prepares the existing
bulk action `assign-missing-tags`, compares its exact plan with the reviewed plan and applies it
through the normal durable journal. Changing a draft or adding tags after preview invalidates that
preview. The same operation receipt returns the committed result without repeating its writes.

If interrupted after adding definitions, those definitions can remain unused and noindex. A new
preview can reuse identical definitions. They are not automatically deleted: later editorial edits
must not be overwritten. If a prepared operation expires before application, create a new preview.

## Recovery and rollback

The normal journal compensates a failed batch to exact original bytes. If compensation cannot
finish, `active.json` blocks normal taxonomy writers. Keep all writers stopped and use the returned
operation ID:

```sh
node server/scripts/fillMissingInstructionTags.js \
  --source-root /absolute/repository \
  --recover-operation SERVER_OPERATION_UUID \
  --writers-stopped
```

Recovery restores an unfinished operation, or clears a durable committed marker without undoing
committed records. It refuses operations outside this action. Do not delete active markers, plans
or packed payloads by hand. Start the API after recovery confirms success.

A committed assignment can be rolled back from the existing bulk-operation history in the admin
interface. Rollback restores the previous assignments and metadata under the existing conflict
checks and increments only the affected published revisions. It preserves every draft. New tag
definitions remain noindex; deleting unused definitions is a separate editorial action.

After restart, check health, the operation counts, public navigation and several affected documents.
Inspect any remaining untagged records separately: records created after the export are outside the
reviewed bundle. Do not restore an old full business backup over newer live data for routine rollback.
