# Public taxonomy read performance

Public taxonomy lists continue to return 24 instructions per page. This stage also removes repeated
reading and JSON parsing of every unchanged instruction file when serving those lists and their
navigation, counts, sitemap and recommendations. It extends the existing file repository rather
than introducing another persistent catalog or changing assignments.

## Cold and warm reads

The repository's `getPublicReferencesFresh()` keeps a process-local index of the instruction
references needed by public views. Each refresh enumerates the instruction directory and checks
file metadata. The signature includes
the device, inode, size, modification time and change time, using nanosecond values supplied by
Node's filesystem API. Unchanged signatures reuse the validated reference. New or changed files
are read and validated again; removed files disappear from the next successful refresh.

The first indexed refresh reads all instruction JSON files to build its references. The existing
repository constructor also retains its original full-record loading behavior. This change therefore
does not promise a single startup read or eliminate the existing full instruction cache from memory.
After the index is warm, an unchanged request still scans names and file metadata, but does not
read and parse every unchanged document body again.

The index belongs to one repository instance in one Node process. A restart builds it again. There
is no disk index to copy, migration, new environment variable, timer or TTL. Other Node processes
observe their own directory scans. No reset command or deployment data replacement is required.

## Freshness and existing writes

Public views use the refreshed references for membership, search, ordering and related materials.
Their publication, indexing, canonical, redirect and count rules remain the same. New instructions,
saved assignments, renames and removals are picked up when the next refresh observes the directory
or signature change. H01 is not approved, pages are not published and source CSV assignments are
not applied by this optimization.

The legacy general catalog and sitemap continue using the refreshed full-record cache for their
existing selection and date rules. They do not trigger another complete JSON read.

Saving or removing through the repository invalidates the affected file's indexed reference.
Reload clears the index. A successful strong `getAllFreshSnapshots()` refresh also clears it, so
the next public refresh validates every file again rather than pairing old references with a newly
loaded full-record cache.

The strong readers used for editor operations, bulk plans, backups and conflict checks continue to
read actual file bytes. The public index does not replace those snapshots or their checksums. An
invalid changed instruction is an error; it must not become an apparently empty public catalog.

As before, reading several files is not a database transaction against concurrent writers in other
processes. Directory scanning and filesystem signatures also have practical limits: a modification
that leaves every observable signature component identical cannot be detected through that signature.
Nanosecond field names do not guarantee nanosecond timestamp resolution on every filesystem.

For offline restores or other tools that deliberately preserve metadata, stop concurrent writers,
use the existing strong backup/verification procedure and restart the API before checking the
restored public pages. Do not treat an unchanged public reference signature as proof that backup
bytes or document content are unchanged.

## What is checked

Repository and public-flow fixtures verify warm-read reuse, refresh after changed or replaced files,
addition/removal, invalid input handling and preservation of strong byte-reading behavior. Existing
publication, navigation, API, SSR, preview, sitemap, recommendation and pagination tests remain
required. The normal Quality Gate also checks formatting, lint and the production client build.

There is no timing or capacity promise for the production server in this delivery. The real 2,169
document files and filesystem were not available for a benchmark. Directory scans still grow with
the number of files, and filtering/sorting the reference collection still takes server work. A
bounded response or a synthetic large-list fixture is not a production load test.

## Applying and remaining acceptance work

Apply the complete source delivery, run the registry checker and Quality Gate, then use the existing
client/API build and restart process after merge. There are no UI changes, dependencies, Nginx rules
or runtime data files to deploy for this stage.

The final acceptance work still includes a current URL inventory and SEO/link/redirect report,
an administrator runbook, staging browser checks and measurements against the actual instruction
snapshot. A real import report, verified backup and rollback evidence cannot be inferred from
source tests. The 63 disputed records remain subject to individual review, and the H01 route still
requires agreement. This optimization does not claim those operational steps have been completed.
