# Instruction taxonomy administration

Manual instruction assignments are now connected by the follow-up stage described in
`instruction-taxonomy-bindings.md`. The metadata-only boundaries below describe the initial admin
delivery; public landing pages, CSV application and bulk transfer are still separate stages.

The existing admin dashboard now has a **Структура каталога** tab for the general catalog,
catalogs, sections and tags. It edits the persistent taxonomy registry introduced by
`instruction-taxonomy-registry.md`. The current instruction editor, public pages, instruction
assignments and download routes retain their existing behavior.

This stage exposes metadata management only. Instruction assignment, related-document lists,
confirmed bulk transfer, CSV application and public taxonomy landing pages are separate stages.
Publication and indexing values saved here are registry settings; they do not activate the future
landing-page routes or change the current general-catalog renderer.

## Editing

Select the entity group, search by name or code, and open an entity. Each form offers independent
name, H1, SEO title, meta description, canonical, publication, indexing and ordering fields. The
introductory and additional SEO texts use the existing rich-text editor. Blank SEO fields remain
blank; names do not fill other fields automatically.

Creating a catalog, section or tag requires a unique permanent uppercase code and a lowercase Latin
slug. Codes and source provenance cannot be changed after creation. A section has exactly one
catalog parent. Catalogs and tags belong to the general catalog. New entities default to a draft
with indexing disabled. There is no limit of 52 sections or 79 tags.

The general catalog cannot be created or deleted, and its existing code and URL are fixed.
The H01 route is still awaiting a decision between the specification and the workbook. Its slug
is read-only in this screen; no route-approval action is exposed. Publishing H01 or a section
under it is rejected until that separate decision is made. H1 proposals missing from the source
remain empty, including W21–W28. The screen does not write SEO copy or infer legacy mappings.

The form shows usage counts obtained from both published instructions and saved drafts. A published
original remains a reference even if its editable draft uses different taxonomy values. Counts
deduplicate instruction IDs; the published count includes only published versions. Legacy IDs
are not guessed to be new codes.

Only empty entities can be deleted. Catalogs with child sections are also protected. Deleting an
entity never deletes instructions. The server repeats these checks during the revision-protected
write; disabling a button is not the authorization or integrity boundary. Moving the last populated
section out of an indexed catalog is also rejected. Disable that catalog's indexing explicitly
before an intentional move. The transfer workflow will be added with instruction assignment and
bulk-operation confirmation.

## Concurrent edits and unsaved forms

Every mutation submits the registry revision captured when the form was opened or last saved.
The server rejects stale revisions with HTTP 409. A conflict keeps the entered values in the form
and offers an explicit reload. Review the current saved version before repeating an edit; the
screen does not silently advance an old form to a new revision.

Unsaved edits are guarded when switching entities, creating a new entity or explicitly reloading.
The browser also receives a before-unload guard. Switching dashboard tabs retains the mounted
form. Form contents are held in memory and are not a durable draft after closing the page.

## HTTP API

All routes are under `/api/admin/instruction-taxonomy`, require the existing administrator session
and set `Cache-Control: private, no-store`. Normal user sessions do not grant access. No new public
dictionary endpoint or route-approval endpoint is added.

| Method | Relative path | Request | Result |
| --- | --- | --- | --- |
| GET | `/` | — | `{ registry }` |
| GET | `/:kind/:code/usage` | — | `{ usage: { references, publishedInstructions } }` |
| POST | `/:kind` | `{ entity, expectedRevision }` | HTTP 201, `{ registry }` |
| PUT | `/:kind/:code` | `{ patch, expectedRevision }` | `{ registry }` |
| DELETE | `/:kind/:code` | `{ expectedRevision }` | `{ registry }` |

`kind` is `root`, `catalog`, `section` or `tag`. Root creation and deletion are rejected.
Each mutation requires a nonnegative safe-integer `expectedRevision`; unknown envelope fields are
rejected. Registry responses omit the separate legacy dictionary. Successful mutations return the
actual state produced by the atomic write.

Errors use `{ error, code, details? }`. Validation failures return 400, unknown entities 404, and
revision or lock conflicts 409. Storage failures fail closed. The client retains the status, code
and details so that a failed save does not clear the form. The request body limit is 2 MB, matching
the existing instruction editor.

## Persistence and deployment

Reading the screen does not create `server/data/instruction-taxonomy.json`. The first successful
explicit save initializes that runtime file from the seed plus the edit. Existing runtime state
is read afresh and is never replaced with the seed after an update. Corrupt registry or draft data
is reported rather than treated as an empty reference set.

The runtime registry is already ignored by Git and included in the server data backup manifest.
Do not copy it into a source archive, commit it, or replace it while the server is writing. Source
rollback alone does not restore metadata changed through the admin screen; use the existing backup
procedure if those runtime changes also need to be restored.

Apply the complete source-file set, run `npm run quality:check`, then rebuild and restart through
the existing deployment process. No dependency, lockfile, environment-variable or migration-command
change is required. Do not run the legacy backfill or CSV application for this stage.

Smoke-check with an administrator: open the tab, edit and save a temporary tag, reload, verify its
independent SEO fields, and delete it. Check normal-user denial, an occupied entity's delete guard,
and stale saves from two tabs. Confirm that existing instruction URLs, editor and downloads still
work. Browser workflow checks use isolated test data and do not verify production data or backups.
