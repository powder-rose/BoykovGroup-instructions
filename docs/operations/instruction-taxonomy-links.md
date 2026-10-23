# Instruction taxonomy links and authorized preview

Instruction pages now use published taxonomy pages for their section/tag links and hierarchical
breadcrumbs. The instruction URL, title, SEO fields, document body, downloads and PDF layout are
not migrated. Source assignments and publication settings are not changed by deploying this code.

## Public instruction navigation

The public instruction page API provides a `taxonomyNavigation` projection alongside the existing
`taxonomyDisplay`. The same projection supplies server-rendered HTML and breadcrumb structured data.
Breadcrumbs start at the homepage and existing general catalog, include the available published
catalog and section, and end with the instruction title. Intermediate entries use ordinary links.

A section needs a published parent catalog and an approved route to have a public landing link.
Published noindex pages are valid destinations. Draft or blocked routes never become public links.
Existing legacy assignments and unpublished taxonomy labels retain their general-catalog query
filter links. No label matching, legacy-to-canonical mapping or H01 route approval is performed.
When tags are absent, no empty tag block is rendered.

## Related instructions

The automatic selection prioritizes the same exact primary section, then overlapping assigned tags.
Shared tags order candidates within those groups. Existing meaningful title/profession relevance
provides a fallback for older or sparsely assigned documents. Unknown IDs receive no taxonomy
priority. The current document, duplicate IDs/URLs and draft documents are excluded. Published
noindex documents remain eligible as in the new public taxonomy lists.

The default and maximum are eight suitable documents. If fewer candidates are relevant, the block
shows only those available; unrelated documents are not added to reach five. The current block
is omitted when there are no candidates. Manual recommendation pinning is optional in the supplied
specification and is not introduced by this stage.

## Administrative preview

The existing taxonomy form provides a preview of the saved ROOT/catalog/section/tag. Save changes
first; the preview does not accept an unsaved form as a substitute for stored data. It reuses the
public presentation components for rich text, breadcrumbs, counts, cards, sorting and pagination,
while displaying the saved SEO fields and publication state inside the administrative panel.

ROOT preview covers its saved editorial fields and an associated-document list, using the same
24-item projection as the new taxonomy pages, including published noindex documents. It is not a
copy of the legacy general catalog's complete filter interface or indexable-only SSR list. The
existing general catalog keeps those behaviors.

`GET /api/admin/instruction-taxonomy/:kind/:code/preview` uses the existing administrator middleware
and bearer session. The JSON response is private/no-store and noindex/nofollow. The preview itself
does not change the browser's document metadata. There is no public preview URL or query token.
Search, sorting and page changes read through the protected endpoint again.

Draft hierarchy names may be shown to the administrator. Navigation destinations remain limited
to real published pages. A blocked H01 route stays unset in the preview; it is not automatically
selected from either conflicting source. The preview always reports noindex/nofollow independently
of the entity's saved indexing flag. It does not publish, assign, rename, write SEO text or update
the sitemap.

## Applying and checking

Apply the complete delivery on top of the merged public-page stage, then run the registry checker
and full Quality Gate. No package installation, migration or automatic source-CSV apply is required.
Use the existing client/API build and restart process after merge. This stage does not add another
Nginx route; the prior public-page configuration still needs to be active in the mounted host file.

Verify public HTML and React transitions with published section/tag fixtures, including noindex
destinations, draft parents, legacy assignments and instructions without tags. Confirm the H1,
canonical, SEO description, document content and download behavior are unchanged. Compare the
visible breadcrumb sequence with its JSON-LD sequence. Confirm both renderers show the same related
documents and preserve mixed-case instruction suffixes.

In the administrator form, test saved previews of every entity kind, search, sorting and multiple
pages; change the selected entity or session during loading to check that old results disappear.
Check anonymous/non-admin requests are rejected and public draft pages still return 404. Test
desktop/mobile layout, long names and narrow administrative columns locally; automated DOM/HTTP
checks do not replace live browser verification.

Reverting source code does not roll back assignments, publications or renames made separately
through the existing administration tools. Continue using the established backup and rollback
procedure for runtime data.
