# Manual instruction taxonomy bindings

The instruction editor now selects one primary section from the editable registry and any number
of relevant tags. Its catalog is derived from the section and is displayed read-only. New documents
created through this editor require a registry section for both draft and published saves. Tags are
optional. Selecting a section does not invent tags or infer a legacy-to-coded mapping.

Existing instructions with legacy categories and tags remain editable without forced migration.
The form identifies historical values and keeps their original IDs until the administrator explicitly
replaces or removes them. Only coded tags are offered as new choices; existing legacy tags remain
visible as removable selected values. T47 and T48 are distinct from one another and from the historical
combined tag. No assignments are migrated by deploying this code.

## Saving and reviewing choices

The section selector is grouped by catalog. Tag search accepts a name or code. Manual bindings are
stored in the existing `primaryCategoryId` and `tagIds` fields; the shape of instruction documents and
their URLs is retained. There is no separately writable catalog assignment.

The existing editor mutation body uses an explicit patch:

```json
{
  "taxonomyPatch": {
    "category": { "mode": "manual", "id": "P10" },
    "tags": { "mode": "manual", "ids": [] },
    "registryRevision": 0
  }
}
```

The revision in this example is illustrative. Submit the actual revision loaded from the assignment
dictionary. An explicit coded choice without a revision is invalid; an outdated revision returns
HTTP 409 with `TAXONOMY_REVISION_CONFLICT`. Instruction revision checks remain separate.

Reloading the dictionary updates available labels and choices without clearing the form or advancing
its saved patch revision. After reviewing the current choices, use the explicit confirmation action
to submit against the new dictionary revision. Missing/deleted IDs remain visible and must be resolved
manually. A failed save keeps the form and its local draft.

An omitted taxonomy patch retains the current selection. Old explicit legacy API patches remain
compatible for existing instructions. A coded primary section cannot be cleared or reset to automatic
legacy classification. Manual coded tags can be cleared to an empty list. There is no five-tag cap
for canonical assignments; the existing automatic legacy suggestion limit remains five.

## Assignment dictionary API

`GET /api/admin/instructions/assignment-taxonomy` uses the existing administrator authorization and
`private, no-store` response policy. It returns only the assignment data needed by the form:

| Property | Entry shape |
| --- | --- |
| `revision` | Current registry revision |
| `catalogs` | `{ id, label }` |
| `sections` | `{ id, label, catalogId }` |
| `tags` | `{ id, label, type: "topic" }` |
| `legacyCategories` | `{ id, label }` |
| `legacyTags` | `{ id, label, type }` |

Coded entries respect the registry's sort order. SEO text, canonical settings, provenance and other
editorial fields are excluded. The previous `/taxonomy` endpoint keeps its legacy response unchanged.

## Reference integrity

Registry writes and online instruction-reference writes share the registry file lease. Editor save,
publication, removal, unpublishing, draft discard, automatic persistence and history rollback validate
against the locked registry state. Lease ownership is checked again before file replacement or removal.
Assignment operations wait briefly for another process; a busy or lost lease returns a conflict instead
of writing with an obsolete dictionary.

Before mutation, the editor refreshes published records through a strict disk read. Registry usage
checks include those current published originals and every saved draft, including older draft overlays.
Malformed, duplicate or nonregular instruction files and malformed drafts cause an error rather than
being silently omitted from the reference set. This prevents a stale in-memory cache from making a
referenced section or tag appear empty.

Automatic persistence reads the current document again inside the lease. It retains current manual
section and tag choices even if generation/import data was prepared before that manual edit. Coded
assignments without explicit source metadata are also retained. Unknown current or incoming IDs fail
validation; they are not replaced with guesses. Existing unclassified legacy records remain outside
automatic migration, and automatic generation of new records retains its existing legacy suggestions.

History rollback validates the exact saved assignment before restoring it. If a referenced code was
deleted after it became unused, rollback is rejected and the history snapshot remains available. It
does not silently drop that assignment or rerun automatic classification.

The legacy backfill's documented offline/stop-writers requirement remains in force. This delivery does
not add an online bulk operation, CSV apply or a multi-document rollback transaction.

## Public labels and filters

Instruction cards, instruction pages and the existing catalog query filters resolve both legacy IDs
and coded IDs from a current safe dictionary snapshot. All stored manual tags are shown. Public
`taxonomyDisplay` retains its `{ category: { id, label } | null, tags: [{ id, label }] }` shape and does
not expose editorial metadata. Exact IDs are accepted; aliases and similar names are not mappings.

Each API/SSR list request reuses one dictionary snapshot for validation, filtering and displayed labels.
Renamed labels appear on the next request while URLs continue to use stable IDs. Filter options count
stored published assignments and deduplicate repeated tags per document; saved drafts do not enter
public counts. The options endpoint disables caching because its dictionary is now editable.

The existing `?category=...` and `?tag=...` links remain query filters. Their current canonical/noindex
behavior is preserved. This stage creates no new taxonomy landing routes, sitemap entries or HTTP 301
handlers. A taxonomy entity's draft status currently controls its future page settings, not whether an
assigned label can appear on an already published instruction. H01 route approval is still pending.

## Deployment and verification

Apply the complete file set, run the project's Quality Gate, rebuild and restart through the existing
deployment process. No new dependency, environment variable, runtime seed replacement or migration
command is needed. Source dictionary counts and values are unchanged. Runtime instruction and registry
JSON, leases and backups must not be committed or copied from the delivery archive.

Test locally: create a draft with one section and no tags, publish it, choose more than five relevant
tags, verify its catalog filters and draft/reference behavior, and check a dictionary revision conflict
from two tabs. Existing instruction URLs, content, SEO authors/dates and downloads must retain their
ordinary behavior. Taxonomy-only edits do not rewrite document text or invent SEO timestamps; ordinary
editor save/publication revision, update-time and version bookkeeping still applies.

Automated coverage uses isolated data for classification, shared-lease behavior, strict disk references,
editor/registry HTTP flows, public API/SSR filters and rollback. Production files/backups and live browser
layout are outside the automated verification performed in this environment.
