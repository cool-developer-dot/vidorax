# Backend Compatibility Review — Media Detection Engine

## Scope

Week 4 Day 3 Phase 1 performs **detection only**. No backend endpoints were modified.

## Backend Download API (existing)

| Concern | Status |
|---|---|
| `POST /api/downloads` | Ready for future Download Manager |
| Auth | JWT Bearer required — detection stays local |
| Create fields | `title`, `sourceUrl`, `platform`, `thumbnailUrl`, `fileName`, `fileSize` |
| Status enum | `QUEUED \| DOWNLOADING \| PAUSED \| COMPLETED \| FAILED \| CANCELLED` |

## Mapping from DetectedMedia → CreateDownloadInput

Implemented as `toFutureDownloadContract()` in `services/browser-sync.service.ts`:

| Backend field | Detection source |
|---|---|
| `title` | `DetectedMedia.title` or URL basename |
| `sourceUrl` | `DetectedMedia.url` |
| `platform` | `DetectedMedia.platformHint` (hostname slug) or `WEB` |
| `thumbnailUrl` | `thumbnailUrl` or origin favicon fallback |
| `fileName` | Derived from URL path / extension |
| `fileSize` | `estimatedFileSize` or `0` until download measures |

## Gaps deferred to Download Manager (intentional)

1. Mobile `useDownloadsStore` stub statuses ≠ backend enums — align in download phase.
2. No `downloads.api.ts` yet — add when queue ships.
3. HLS variant qualities live in `mediaDetectionStore.qualities` — quality picker UI is later.
4. Detection never sends cookies / auth headers to backend.

## Verdict

Detection metadata contracts are **compatible** with future Download Manager integration without schema redesign.
