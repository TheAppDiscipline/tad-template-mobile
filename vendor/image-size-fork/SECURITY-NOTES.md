# image-size security maintenance fork

This directory is a local, reviewable fork used only because every currently
supported Metro release still requires the archived `image-size` package and
the upstream package has no release that fixes the two high-severity infinite
loops.

## Provenance

- Upstream: <https://github.com/image-size/image-size>
- Upstream tag: `v1.2.1`
- Tag object: `e786bd2353039863ee5345e9a9dfe47c96a967e9`
- Source commit: `a4178fbb334ddb22d94cb4228ed597c24fd02e10`
- Upstream license: MIT; the original `LICENSE` and `Readme.md` are included.
- Consulted: 2026-08-12 (America/Costa_Rica).

The fork preserves the synchronous CommonJS API used by Metro. Its package
version is `2.0.3-tad.1`; `tadFork.upstreamVersion` records that the code base is
upstream 1.2.1, so the version is not presented as an unmodified upstream
release.

## Security changes

1. Upstream commit `640a67d` makes `findBox` advance by at least the eight-byte
   box header when a JXL/HEIF box declares size zero. That change is already in
   upstream 1.2.1 and remains in `lib/types/utils.ts` and the built `dist` file.
2. The TAD patch rejects ICNS entries shorter than their mandatory eight-byte
   header before advancing the parser. This prevents a zero-length entry from
   permanently blocking the Node.js event loop.

Regression coverage lives in `tests/mobile-asset-security.test.js`. It runs the
published malicious ICNS and HEIF shapes in child processes with a hard timeout,
checks a valid image, and verifies the installed package provenance.

## Installation and maintenance

`npm pack` creates `vendor/image-size-2.0.3-tad.1.tgz`. The root dependency and
override both reference that checked-in tarball through `$image-size`; the
lockfile records its SHA-512 integrity. No private registry, account, remote
fork, install script, or personal infrastructure is required.

At each Expo/React Native upgrade:

1. Check whether every resolved Metro copy has removed `image-size` or moved to
   a maintained, patched release.
2. If upstream is safe, remove the direct dependency, override, fork directory,
   tarball, and regression-specific provenance assertions; regenerate the lock
   and rerun both npm audits, the full gate, export, and clean-package tests.
3. If Metro still depends on this fork, compare upstream source, reapply only
   reviewed patches, increment the `-tad.N` version, rebuild the tarball, and
   review the new integrity hash.

Primary references consulted on 2026-08-12:

- <https://github.com/advisories/GHSA-w3rx-r6r6-pgpr>
- <https://github.com/advisories/GHSA-5p2g-fcmc-qvqq>
- <https://github.com/image-size/image-size/commit/640a67d>
- <https://github.com/image-size/image-size/releases>
- <https://github.com/react/metro/blob/main/packages/metro/package.json>
