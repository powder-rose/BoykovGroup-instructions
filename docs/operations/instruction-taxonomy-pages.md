# Public taxonomy pages

Published catalogs, sections and tags now have public HTML pages and matching React routes. They
reuse the existing site shell, instruction cards and rich-text renderer. The server renders content,
ordinary instruction/navigation links, breadcrumbs, search, sorting and pagination into production
HTML. The browser consumes the same public page projection through the JSON API.

This stage connects publication, canonical/robots, navigation, historical 301 redirects and sitemap.
Deploying it does not publish seed entities, apply the CSV distribution or generate SEO copy.

## Publication and the existing general catalog

A catalog is public when published and its route is approved. A section also requires a public parent
catalog. A tag requires its own published status. Published noindex pages remain accessible and linked.
Draft pages, sections under draft parents and unapproved routes return 404 and receive no public
navigation, redirects or sitemap entry. The initial seed keeps H01 blocked; the explicit
[specification activation](./instruction-taxonomy-publication.md) selects `/po-professiyam/` and approves it.

The general catalog stays at `/instrukcii-po-ohrane-truda`. ROOT's initial draft state does not remove
that live page. While ROOT is a draft, its editorial fields do not replace the existing defaults.
Publishing ROOT activates its editable H1, title, description, rich text, canonical and indexing policy.
Review its indexing flag at that point; publication and indexing are independent settings.

The general catalog gains published catalog/section links and topic links with counts. Its existing
search, filters, sort controls, instruction cards and generation action remain available.

## Page content and lists

New pages render the stored introductory and lower SEO rich text. H1 uses its independent field, with
the saved entity name as a display fallback. Title uses the SEO title, then H1/name if absent. Empty
description remains empty. These fallbacks do not write values back or create missing SEO text.

Lists include published instructions with `seoStatus: noindex`; draft records and draft overlays are
excluded. Membership uses exact section/tag IDs and derives the catalog from the section. A public
catalog can list documents assigned to a draft child section, but has no link to that section's page.
Missing/empty legacy titles remain excluded as in the existing catalog.

Search matches title text without Cyrillic case sensitivity. Sorting uses alphabetic title or stored
publication/addition dates (`publishedAt`, then `createdAt`, `generatedAt` or `uploadedAt`). It does
not fabricate timestamps or use modification dates. Pages contain 24 documents.
Pagination uses ordinary links with a bounded number-link window, including first/last/current pages.
Out-of-range pages return 404. Existing tag-label projection remains unchanged.

Public DTOs contain entity content, navigation and minimal card fields. They exclude provenance,
redirect history, document bodies, drafts and editorial metadata. Each request reads the registry and
refreshes the repository's public references. The first indexed refresh reads the instruction JSON;
warm refreshes scan file names and signatures and reuse unchanged references instead of parsing every
document body again. The existing full-record cache and strong writer/backup readers remain. See
[Public taxonomy read performance](./instruction-taxonomy-performance.md) for cold/warm behavior and
filesystem limits. Existing bulk-operation limits on observing cross-process multi-file writes remain;
a public snapshot is not a database transaction.

## URL, indexing and sitemap policy

The general catalog keeps its no-slash URL. New entity paths use lowercase registry slugs and a
trailing slash. Known public case/slash variants redirect to the current path. First-page aliases
such as `page=1`, default sorting and empty search normalize to a clean URL. Historical paths resolve
by stable kind/code directly to the current published path. Draft targets do not receive redirects.
Individual instruction URL normalization and mixed-case slugs retain their existing behavior.

All nonempty parameters on new pages, including pagination, search, sorting and tracking, use
`noindex, follow` and the base page canonical. Links remain crawlable. Arrays, malformed values and
the reserved `path` website query key return a noindex error; that key belongs to the JSON API.

A new taxonomy page or published ROOT is indexable only when indexing is enabled, its list is nonempty and its canonical
is its own absolute URL. Removing the last assignment makes it noindex and removes it from sitemap
on the next request without changing stored flags. An alternative canonical is rendered but excludes
the page from indexing and sitemap. Only eligible base pages enter the map; taxonomy lastmod is
omitted because no stored entity modification date exists. The legacy general catalog with ROOT draft
retains its previous indexing and sitemap entry even when empty. Existing instruction lastmod rules remain.

robots.txt continues allowing public pages so crawlers can read noindex. HTML, navigation and sitemap
use no-store responses. New taxonomy metadata uses `SITE_URL` or `https://boykovdocs.ru`. The public
DTO carries its own site URL for server/browser breadcrumb schema, independent of canonical overrides.
Legacy general-catalog defaults and instruction origins retain their previous fallback behavior.

## Browser metadata and errors

New pages share one CollectionPage/BreadcrumbList schema model. Their canonical, OG and schema are
cleaned up on navigation. Existing instruction SEO uses its current component and fields. The homepage
receives its existing metadata defaults on return, without visual changes.

The general catalog preserves SSR metadata while navigation loads. A failed navigation request keeps
editorial fields and applies conservative noindex, rather than enabling indexing over a published
ROOT noindex policy. A successful response with ROOT draft restores the legacy defaults. Missing or
failed landing loads show a noindex error/retry state.

## API and deployment

The anonymous read-only API returns no-store/noindex JSON:

| Endpoint                                                              | Result                                                 |
| --------------------------------------------------------------------- | ------------------------------------------------------ |
| `GET /api/instruction-taxonomy/navigation`                            | Published ROOT overlay and catalog/section/topic links |
| `GET /api/instruction-taxonomy/page?path=...&q=...&sort=title&page=2` | Page DTO or `{ "redirect": "current-local-path" }`     |

API redirects are JSON so a page fetch does not follow into HTML. Direct page requests use HTTP 301.
Missing/draft pages return 404; storage failures expose no internal paths or source data. Production
Nginx explicitly proxies the deep taxonomy namespace so static files cannot bypass the resolver.

Apply the complete delivery, run the Quality Gate, rebuild client/API and reload the supplied Nginx
config through the existing deployment process. No dependencies, environment variables or automatic
migrations are added. Review content, publication and indexing in a test environment before enabling
pages. Runtime registry, assignments and source dictionaries are not replaced by this code.

Instruction-level hierarchy links, taxonomy-aware related instructions and authorized saved-page
preview are documented in [Instruction taxonomy links and authorized preview](./instruction-taxonomy-links.md).
Legacy assignments and unavailable landing destinations retain their catalog-filter fallback.

## Compact catalog navigation

The homepage and general catalog share two catalog choices and a single scoped filter panel.
The panel links to up to eight published section pages by instruction count, retaining a selected
published section even outside that group. Section cards are ordinary links to the canonical page
paths supplied by the API; sections without a public path stay available through the filter picker.
The direction buttons and searchable section/tag pickers update the existing URL filters. Search,
sort, pagination and request cancellation keep their existing behavior.

The general catalog places the complete directory inside a closed native `details` element.
All published catalog, section and tag links are present in both initial server HTML and React
markup before it is opened. Opening the directory requires no additional API request. Separate
catalog pages still show all their published sections. Compact navigation changes neither route
addresses nor publication, indexing, canonical or sitemap settings. No data migration or repeated
publication/import is required.

## Unified catalog controls

The homepage and general catalog use one shared panel with three direction buttons: all
instructions, professions, and work types. Active scoped filters and the closed full directory
live inside this panel. The duplicate catalog-link row is removed; published destinations remain
available inside the directory, in server HTML and React markup. The homepage fetches the existing
public navigation projection as well; filter metadata supplies catalog links if it is unavailable.

Both lists use the same result toolbar, with the instruction count and sorting side by side on
desktop and stacked on narrow screens. The general catalog links back home with a secondary text
link above its controls. The existing primary home button on instruction pages remains separate.
Sorting retains its existing URL navigation and preserves active query, catalog, category, and tag.
