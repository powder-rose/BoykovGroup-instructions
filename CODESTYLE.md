# BoykovDocs Code Style

## 1. Source of truth

The project uses automated formatting and static analysis as the source of truth for code style.

Formatting is controlled by:

- Prettier;
- EditorConfig;
- .gitattributes.

JavaScript and React correctness rules are controlled by ESLint.

The configuration is based on the conventions used in Security-Passport and adapted to the BoykovDocs repository structure.

## 2. Formatting

Canonical formatting:

- UTF-8;
- LF line endings;
- final newline is required;
- spaces only;
- indentation: 2 spaces;
- single quotes in JavaScript;
- semicolons are required;
- trailing commas where supported;
- maximum formatted line width: 100 characters;
- spaces inside object braces;
- parentheses around a single arrow-function argument are omitted.

Do not manually align code with extra spaces or artificial line breaks.

Prettier decides the final layout.

## 3. JavaScript

Use modern ECMAScript modules.

Prefer Node.js built-in imports with the node: prefix.

Example:

    import fs from 'node:fs';
    import path from 'node:path';

Always use strict equality:

    value === expected
    value !== expected

Do not use == or !=.

Unused variables are errors.

An intentionally unused argument or variable must begin with an underscore:

    function handler(_request, response) {
      response.end();
    }

Do not suppress ESLint rules without a concrete technical reason.

## 4. React

React source lives under client/src.

React components use PascalCase.

Hooks use the use prefix.

Follow the Rules of Hooks.

Hook dependency warnings must be reviewed individually. Do not silence them globally only to make ESLint green.

Avoid unstable list keys when a stable domain identifier is available.

Do not introduce dangerouslySetInnerHTML unless the HTML source and sanitization boundary are explicitly understood.

## 5. Node.js backend

Backend source lives under server/src.

Async background work must not create unhandled promise rejections.

Long-running jobs, timers and workers must have an explicit lifecycle when they survive beyond a single request.

Do not introduce module-level runtime side effects unless startup behavior specifically requires them.

## 6. Comments

Comments should explain:

- why a decision exists;
- a non-obvious invariant;
- a safety boundary;
- compatibility behavior;
- business logic that cannot be inferred from the code.

Do not add comments that merely repeat the next line of code.

Existing Russian comments do not need to be translated only for style consistency.

Do not perform mass comment rewrites together with formatting changes.

## 7. Generated and runtime files

The following areas are not code-style targets:

- public_html/**;
- dependency directories;
- generated build output;
- uploaded files;
- runtime databases and JSON/JSONL state;
- production logs;
- backups.

public_html/** contains deployed and historical frontend artifacts and must not be mass-formatted.

## 8. Prettier and ESLint responsibilities

Prettier is responsible for formatting.

ESLint is responsible for code correctness and maintainability rules.

Do not duplicate Prettier formatting rules in ESLint.

eslint-config-prettier must remain the final ESLint configuration layer.

## 9. Commands

Check formatting:

    npm run format:check

Apply formatting:

    npm run format

Run ESLint:

    npm run lint

Apply safe ESLint fixes:

    npm run lint:fix

Run the complete local quality gate:

    npm run quality:check

The quality gate checks formatting, ESLint, backend tests and the frontend production build.

Formatting and semantic fixes should normally be committed separately.

## 10. Migration policy

While the existing repository is being migrated to this style:

1. tooling changes are committed separately;
2. backend formatting is committed separately;
3. frontend formatting is committed separately;
4. semantic ESLint fixes are committed separately;
5. generated production assets are not reformatted.

After migration is complete, all new or modified source code must pass both Prettier and ESLint before merge.
