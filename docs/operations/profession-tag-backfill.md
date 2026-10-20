# Backfill instruction profession tags

Use `server/scripts/backfillInstructionProfessionTags.js` after deploying the new
API code and taxonomy catalog. The CLI adds missing suggested profession tags to
existing instruction JSON files. Deploying code alone does not update these files.

Run the commands below from the repository root, using absolute paths visible to
that Node process. If running in a container, use its mounted runtime and backup
paths. `server/src/data/instructions/*.json` contains ignored runtime data; do not
commit these files, reports or backups to Git.

## Preview

```bash
node server/scripts/backfillInstructionProfessionTags.js \
  --directory /absolute/path/to/runtime/instructions
```

Dry-run is the default and writes nothing. `--directory` is required. Use `--help`
for the CLI summary; `--backup` is accepted only with `--apply`.

The JSON report lists `records`, status `counts`, the number of proposed
`addedTags`, and `affected` records with their proposed `addedTagIds` or skip
reason. These are forecasts from the current snapshot, not saved assignments.

| Status           | Meaning                                                                       |
| ---------------- | ----------------------------------------------------------------------------- |
| `change`         | Missing profession tags can be appended.                                      |
| `unchanged`      | No missing suggested profession tags.                                         |
| `manual`         | Explicit manual tags are preserved, including an empty selection.             |
| `unknown-source` | Existing tags lack recognized automatic provenance, or the source is unknown. |
| `limit`          | Adding the proposed tags would exceed five tags; the whole record is skipped. |
| `invalid`        | Invalid record, metadata or tag selection; all apply operations are blocked.  |

`invalid` also makes dry-run exit with a nonzero status. Malformed JSON, duplicate
instruction IDs and nonregular JSON entries abort the run. Review these errors
before applying.

## Apply while instruction writers are stopped

Stop the API and all other instruction writers before applying. Keep them stopped
until the command completes successfully. The CLI does not control service
lifecycle; use the deployment's established stop and start commands.

Choose a new backup directory outside the instructions directory. Its parent must
already exist and be writable; the new directory itself must not exist.

```bash
node server/scripts/backfillInstructionProfessionTags.js \
  --directory /absolute/path/to/runtime/instructions \
  --apply \
  --backup /absolute/path/to/backup-parent/profession-tags-NEW-RUN
```

The CLI creates a private backup containing every original file's exact bytes,
changed candidates, and a manifest with hashes and file metadata before the first
replacement. It rechecks the snapshot and uses atomic replacements preserving
file mode, owner and group.

Only missing profession IDs are appended. Existing tags retain their order, and
categories, document content, URLs, SEO and other instruction fields retain their
values. When tags are added, `taxonomyMeta.tagsSource` becomes `auto`,
`schemaVersion` becomes the current catalog version, and `needsReview` reflects
whether the saved category is absent. Other metadata is preserved. Unchanged and
skipped files are not rewritten.

Apply first prints the forecast report. Confirm a zero exit status and the final
`applied` result; a successful nonempty run also writes `completed.json` in the
backup directory. With no eligible changes, it returns `applied: 0` and
`backupDirectory: null`, creating no backup. Repeating the run with unchanged data
and catalog adds nothing further; every apply invocation still requires an unused
backup path.

After success, start the API again so its cached instruction repository reloads
the saved tags. Verify the live filters and cards after this restart.

If a write fails, the CLI attempts rollback only while files still match the
original or prepared bytes. External changes block rollback rather than being
overwritten. Preserve the backup and inspect the error and `failed.json`, when
available. After failure or an interrupted process, keep writers stopped until
the resulting data state has been checked; an interrupted process may leave its
lock file. The CLI has no manual restore command.
