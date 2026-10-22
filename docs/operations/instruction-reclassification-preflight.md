# Instruction reclassification preflight

This is the first delivery for the supplied catalog specification. It validates the source
classification and optionally compares it with an offline instruction snapshot. It cannot apply
assignments, replace tags, publish pages, or change instruction content.

## Baseline

- Repository: `powder-rose/BoykovGroup-instructions`.
- Reviewed `main`: `5a0ccd26db461937ef50244029a740bdea8ddae6`.
- The existing taxonomy has 10 categories and 371 tags, with lowercase semantic IDs. The supplied
  P/W/T codes belong to an external register and are not those runtime IDs.
- Published instructions are individual JSON files under `server/src/data/instructions/`.
  `InstructionsRepository.getBySlug()` accepts the public slug, internal ID and slug aliases.
- Canonical instruction paths use `/instrukciya-po-ohrane-truda/<slug-or-id>`. The existing general
  catalog is `/instrukcii-po-ohrane-truda` without a trailing slash.
- `routes/seo.js` renders the HTML catalog and instruction pages and generates the sitemap.
  React and server-rendered pages already reuse the existing styles.
- The source tree has no registered nested catalog/section/tag pages under the proposed namespace.
  Production data, deployed static files and live server configuration have not been inspected.

No existing runtime module is replaced in this delivery. The reference JSON in
`docs/reclassification/source-catalog.json` is source evidence for this preflight, not a second
active taxonomy. Later deliveries must extend the existing model and preserve current assignments.

## Source evidence

Both uploaded files opened successfully. The ZIP contains the XLSX register, the import CSV,
the manual-review CSV, the changed-sections CSV and the classification rules TXT.

The XLSX contains 2 catalog rows, 52 sections, 79 tags, 2169 existing instructions, 248 proposed
new instructions and 213 Wordstat rows. The last two groups are research; they are not imported
as existing documents.

The supplied CSVs and XLSX agree on all instruction assignments. The register has 1401 profession
instructions and 768 work instructions. Exactly 63 assignments require manual review. The changed
sections file contains 358 rows, including 14 of those review rows. Counts describe the source
register and are not a statement about the current production database.

The reference JSON retains original names, URLs, H1 proposals, research notes and Excel row
coordinates. Empty H1 proposals for W21–W28 remain empty. No SEO copy is generated.

## Unresolved source decisions

1. The specification proposes `/instrukcii-po-ohrane-truda/po-professiyam/`; the workbook uses
   `/instrukcii-po-ohrane-truda/po-professiyam-i-dolzhnostyam/` for H01 and all P sections.
   Agree on one route before publishing these pages. This delivery activates neither alternative.
2. `BOYKOVDOCS_SEO_SECTIONS_TAGS.txt` is mentioned in the specification but is absent from the ZIP.
   The complete dictionary is available in the XLSX; no missing names or slugs have been invented.
3. The cover label “Без назначенного раздела: 63” actually refers to 63 disputed assignments.
   Every CSV row has a proposed section. These 63 rows remain held for review.
4. W21–W28 and new tags must start with indexing disabled. Blank Excel indexing cells are not
   permission to index them. T19, T20, T47 and T54 have no assigned source instructions.

## Run

Use Node 22 or later from the project root. The preflight itself uses only built-in Node modules.
Supply all three CSV files from the same source package.

```powershell
$SourceDir = 'C:\path\to\unpacked-package\source-data'
$ReportPath = Join-Path $env:TEMP ('boykovdocs-source-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.json')

node server/scripts/checkInstructionReclassification.js `
  --import (Join-Path $SourceDir 'BOYKOVDOCS_IMPORT_2169_NEW_CATEGORIES.csv') `
  --manual (Join-Path $SourceDir 'BOYKOVDOCS_CHECK_MANUALLY.csv') `
  --changed (Join-Path $SourceDir 'BOYKOVDOCS_CHANGED_SECTIONS.csv') `
  --output $ReportPath

if ($LASTEXITCODE -ne 0) { throw "Preflight found errors. Inspect $ReportPath" }
```

Without `--directory`, the report explicitly says `mode: source-only`, `liveDataChecked: false`.
The included source report was generated in this mode. It does not claim that any production
instruction was found or changed.

To compare an offline copy of the actual instruction directory, add:

```powershell
  --directory 'C:\path\to\offline-instructions'
```

Use a complete, consistent snapshot. Files are read and hashed individually; this is not an atomic
snapshot of a database being edited during the check. Production backup and staging setup remain
operational prerequisites for later application, and have not been performed by this package.

The checker refuses missing, empty, malformed or linked instruction inputs rather than silently
creating an empty repository. Reports are new files and must be outside the instruction directory.
An existing report is never overwritten. Without `--output`, the complete JSON is printed to stdout.
There is no `--apply` option.

## Interpret the report

- `sourceValid` means structurally consistent source rows, including rows held for manual review.
  It does not mean expert approval of their meaning.
- `manualReview` includes rows flagged by either the main CSV status or the separate review file.
  They cannot become automatic application candidates in this preflight.
- `matched`, `notFound` and `ambiguous` compare URL paths with the supplied snapshot only.
  `document_id` is retained as a register number and is never used to locate a site document.
- A `candidate` is a uniquely matched, source-consistent proposal outside the manual-review set.
  It is not an approved import plan. Existing IDs and assignments are shown alongside P/W/T
  proposals without guessing a mapping between old and new taxonomy identifiers.
- Duplicate source URLs, duplicate IDs, unknown codes, inconsistent side files and URL collisions
  are reported. Case in instruction slugs is preserved.
- `dictionaryIssues` retains outstanding editorial decisions even when source syntax is valid.
- `applySupported` is always false. This report is not accepted by any apply operation.
- Reports contain hashes and classification metadata, not instruction body text or account data.

## Checks

```powershell
node --test server/tests/instruction-reclassification-preflight.test.js server/tests/instruction-reclassification-cli.test.js
npm run quality:check
```

Tests cover CSV quoting and malformed inputs, matching by URL and aliases, ambiguous matches,
manual-review exclusions, unchanged input bytes and modification times, and report path protection.

## Subsequent deliveries

1. Extend the existing taxonomy into catalogs, sections and tags with persistent codes and separate
   SEO/publication/indexing fields; preserve current links and prepare reviewed ID migration.
2. Add public pages using the existing visual components and HTML rendering, after the profession
   URL decision; include search, sorting, pagination and accurate counts.
3. Add admin management, assignment controls and confirmed bulk actions, plus CSV preview/export.
4. Add safe additive import with assignment backups, import history and guarded rollback; test the
   snapshot reconciliation and keep all disputed rows separate.
5. Complete breadcrumbs, related documents, canonical/robots/sitemap/redirect handling and staging
   validation, then prepare deployment and rollback instructions.

The existing instruction URLs, content, files, publication dates and download mechanism remain
protected throughout those deliveries.
