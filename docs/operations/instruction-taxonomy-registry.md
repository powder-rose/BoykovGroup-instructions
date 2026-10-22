# Instruction taxonomy registry foundation

This delivery adds the taxonomy model, persistent storage and internal service that later admin and
public-page work will use. It does not register HTTP endpoints, publish pages or migrate instruction
assignments. Existing instruction content, URLs, downloads and the current visual components retain
their behavior.

## One source with an explicit compatibility boundary

The committed `server/src/data/instructionTaxonomyCatalog.json` retains every value of the legacy
version-2 dictionary: 10 categories and 371 tags. A new `registrySeed` property contains the general
catalog metadata, 2 catalogs, 52 sections and 79 coded tags from the reviewed reference.

`instructionTaxonomySource.js` exposes two detached projections of that same committed source.
The current `instructionTaxonomyService.js` reads the legacy projection, preserving its API, automatic
suggestions, saved IDs and existing selectors. Legacy definitions are read-only in the new service.
Its current module-level maps therefore cannot become stale through a registry edit.

The new registry service resolves both legacy IDs and new codes for inspection and validation. It
does not infer a mapping. In particular, source tags T47 and T48 remain distinct, while the historical
tag that combined those topics keeps its original ID and assignments. Future migration must use
explicit, reviewed instruction assignments, rather than names or aliases as a guessed mapping.

When later screens begin using coded assignments, their display/filter adapters must use the current
registry revision. They must not reuse the legacy-only static maps for editable coded entities.

## Model

The persisted registry has `schemaVersion`, `revision`, `root`, `catalogs`, `sections`, `tags`,
`redirects` and `sourceIssues`.

Each entity has one stable `code`, `kind`, `name`, `slug`, `parentCode`, `h1`, `seoTitle`,
`seoDescription`, `introContent`, `seoContent`, `canonicalUrl`, `status`, `indexingEnabled` and
`sortOrder`. Source-derived entities also retain immutable provenance. Catalogs have a separate
`routeApproved` flag.

The existing general-catalog path `/instrukcii-po-ohrane-truda` and technical code `ROOT` cannot
change. Sections have exactly one catalog parent. A section's parent determines the instruction's
catalog; there is no independently editable instruction catalog field.

Codes and URL paths are validated for uniqueness. The number of sections or tags is extensible.
SEO fields are independent: changing a name does not replace H1 or SEO title. Rich introductory and
SEO content reuse the existing document normalizer for headings, paragraphs, lists and safe links.

All 134 initial metadata entities, including the general-catalog metadata, start as drafts with
indexing disabled. This draft metadata does not unpublish the existing general-catalog page: the
new rendering integration is not active in this delivery. Existing general-catalog SEO must be
preserved when that integration is added. Source H1 proposals are retained; W21–W28 remain blank.
SEO copy is not generated.

The H01 route remains unapproved because the specification and workbook disagree between
`po-professiyam` and `po-professiyam-i-dolzhnostyam`. Neither route is activated. Publication of H01
or its sections is blocked in the service until an explicit route confirmation. That confirmation
has not been performed by this delivery.

## Storage

`createInstructionTaxonomyRegistryRepository()` uses `server/data/instruction-taxonomy.json` by
default. Its constructor and reads do not create that file or its directory. Missing storage returns
a detached copy of the seed; malformed JSON, invalid UTF-8 or invalid model data is an error.
Corrupt storage is never replaced automatically with a fresh seed.

Writes require `expectedRevision`, acquire a file lease, read the current state again, validate the
new state, flush a temporary regular file and atomically rename it. The repository owns revision
increments and detects lost locks. Readers see fresh persisted state without a process-local cache.
Regular-file synchronization is mandatory on Windows and POSIX; directory handles are not flushed
by this repository.

The runtime JSON and lock are ignored through the existing server data rules. Do not commit runtime
state, locks or backups. The existing backup manifest already includes `server/data`; no production
backup was created or inspected during this delivery. An initialized runtime registry is not silently
reseeded after a future code update; seed/schema changes will need an explicit migration.

## Internal service

`createInstructionTaxonomyRegistryService({ repository, getInstructions })` is an internal factory;
there is no automatically instantiated writable service or HTTP route. The provider is required and
must supply the complete set of published and draft instruction references. Include both versions
when a published instruction has a separate draft. Counts use unique instruction IDs, and malformed
provider records abort reference-sensitive operations.

The service exposes:

- `read()`, `get(kind, code)` and `getUsage(kind, code)`.
- `create(kind, input, { expectedRevision })` and `update(kind, code, patch, options)`.
- `remove(kind, code, options)`, refusing referenced sections/tags and catalogs with children.
- `confirmCatalogRoute(code, slug, options)` for an explicitly agreed catalog route.
- `validateAssignment(input, { requireSection })` and `inspectInstruction(instruction)`.

The service never writes instruction files. Assignment validation reuses `primaryCategoryId` and
`tagIds` as the future common reference fields, returns the derived catalog and accepts explicit
selections without the old five-tag ceiling. The existing legacy editor and auto-suggestion limits
remain unchanged until their separate UI integration.

Publication and indexing are stored separately. Publishing an empty page with indexing enabled is
rejected using actual supplied instruction references; source spreadsheet counts are not used as
live counts. Published pages with indexing disabled are valid model states. Public HTTP, robots and
sitemap behavior will be implemented with the renderers in a later delivery.

When a published entity changes slug or parent path, the service records its old path against its
stable entity code. Catalog renames also record old paths of published sections. Redirects resolve
directly to the current entity path, preventing redirect chains; returning to an old path removes a
self-redirect. Those records reserve historical addresses. HTTP 301 responses are not active yet.

## Read-only check

From the project root:

```powershell
node server/scripts/checkInstructionTaxonomyRegistry.js
if ($LASTEXITCODE -ne 0) { throw 'Taxonomy registry validation failed' }
```

Without initialized runtime storage, expected counts are 2 catalogs, 52 sections, 79 tags,
134 draft metadata entities, zero published/index-enabled entities, and legacy counts 10/371.
H01 appears in `pendingCatalogRoutes`. This command validates the registry and prints a report;
it neither initializes storage nor changes any instruction or route.

To inspect a specific existing offline registry file:

```powershell
node server/scripts/checkInstructionTaxonomyRegistry.js --file 'C:\path\to\instruction-taxonomy.json'
```

## Remaining integration

The following work is intentionally deferred to later logical deliveries: admin HTTP/UI and
authorization wiring, manual and bulk instruction assignment controls, safe CSV application/history/
rollback, review of disputed assignments, public catalogs/sections/tags, actual 301 handlers,
breadcrumbs, related documents, canonical/robots/sitemap rendering and deployment checks.

Before exposing mutations, connect the complete reference provider and keep all admin actions under
the existing authorization boundary. Before publishing the profession hierarchy, obtain the agreed
URL. These are integration requirements, not actions completed by this foundation package.
