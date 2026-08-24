# Week 7 — Final Certification Matrix

Status legend:

- **PASS** — verified by automated suite or executed manual run
- **FAIL** — verified failure (must be fixed or block release)
- **BLOCKED** — cannot execute (missing credentials/device/env)
- **NOT APPLICABLE** — out of product scope for this release
- **REQUIRES DEVICE QA** — must be run on physical Android; not claimed PASS from unit/script alone

Automated coverage is marked where a `verify:*` suite exercises the behavior. Device rows stay **REQUIRES DEVICE QA** until a human records PASS/FAIL.

## Progressive

| Case | Result | Notes |
| ---- | ------ | ----- |
| complete | REQUIRES DEVICE QA | Logic covered Day 2/3 suites; full file path needs device |
| pause | REQUIRES DEVICE QA | |
| resume | REQUIRES DEVICE QA | |
| cancel | REQUIRES DEVICE QA | |
| auto retry | REQUIRES DEVICE QA | Policy covered in Day 3 Phase 2 / Day 4 Phase 2 |
| manual retry | REQUIRES DEVICE QA | |
| source changed | REQUIRES DEVICE QA | Day 3 Phase 2 policy automated |

## Queue

| Case | Result | Notes |
| ---- | ------ | ----- |
| 3+ jobs | REQUIRES DEVICE QA | Scheduler logic automated Day 2 |
| concurrency 1 | REQUIRES DEVICE QA | Setting bounds automated (1–4) |
| concurrency 2 | REQUIRES DEVICE QA | |
| concurrency 3 | REQUIRES DEVICE QA | |
| concurrency 4 | REQUIRES DEVICE QA | |

## Settings

| Case | Result | Notes |
| ---- | ------ | ----- |
| Wi-Fi Only | REQUIRES DEVICE QA | Hold policy automated Day 4 Phase 2 |
| Auto Resume | REQUIRES DEVICE QA | |
| Max Concurrent | REQUIRES DEVICE QA | Normalize 1–4 automated |
| Notifications | REQUIRES DEVICE QA | Preference + permission model automated Day 2 Phase 3 |
| restart persistence | REQUIRES DEVICE QA | MMKV envelope path covered in settings policy tests |

## HLS

| Case | Result | Notes |
| ---- | ------ | ----- |
| master | REQUIRES DEVICE QA | Parser/reject paths Day 3 Phase 1 |
| media | REQUIRES DEVICE QA | |
| MPEG-TS | REQUIRES DEVICE QA | |
| fMP4 | REQUIRES DEVICE QA | |
| retry | REQUIRES DEVICE QA | Segment retry policy automated |
| encrypted rejection | PASS (automated) | Day 3 Phase 1 |
| live rejection | PASS (automated) | Day 3 Phase 1 |

## Multi-range

| Case | Result | Notes |
| ---- | ------ | ----- |
| eligible | REQUIRES DEVICE QA | Eligibility + plan Day 3 Phase 3 |
| fallback | PASS (automated) | Ineligible → progressive path |
| 2 workers | REQUIRES DEVICE QA | |
| 4 workers | REQUIRES DEVICE QA | Cap automated |
| pause/resume | REQUIRES DEVICE QA | |
| retry | REQUIRES DEVICE QA | |
| merge | REQUIRES DEVICE QA | Chunked merge logic automated |
| exact size | PASS (automated) | Verification not weakened |

## Lifecycle

| Case | Result | Notes |
| ---- | ------ | ----- |
| foreground/background | REQUIRES DEVICE QA | FGS display truth automated (strict `running`) |
| restart | REQUIRES DEVICE QA | Recovery decisions Day 4 Phase 2 |
| process recreation | REQUIRES DEVICE QA | |
| Wi-Fi loss/return | REQUIRES DEVICE QA | `shouldHoldActiveTransfer` automated |

## Realtime

| Case | Result | Notes |
| ---- | ------ | ----- |
| WS | PASS (automated) | Day 4 Phase 1 backend + mobile |
| disconnect | PASS (automated) | |
| polling | PASS (automated) | Interest + interval constants |
| reconnect | PASS (automated) | |
| reconciliation | PASS (automated) | Durable refresh on reconnect |

## Files

| Case | Result | Notes |
| ---- | ------ | ----- |
| Open | REQUIRES DEVICE QA | See known limitation: Android `file://` |
| Share | REQUIRES DEVICE QA | Cancel-safe; FileProvider gap documented |
| Delete | REQUIRES DEVICE QA | |
| cleanup | REQUIRES DEVICE QA | Workspace cleanup paths Day 3 |

## Build / security freeze (automated where noted)

| Case | Result | Notes |
| ---- | ------ | ----- |
| TypeScript mobile | see regression log | `npx tsc --noEmit` |
| TypeScript backend | see regression log | `npm run typecheck` |
| Expo Android export | see regression log | `npx expo export --platform android` |
| Signed release APK | BLOCKED | No JDK in this environment; release `signingConfig` still uses debug.keystore |
| Android `assembleDebug` | BLOCKED | JDK not installed on certification host |
| WS query-token off in prod | PASS (code audit + Day 4 Phase 3) | `NODE_ENV=production` disables unless override |
| `.env` gitignored | PASS | `.gitignore` + examples placeholders only |
| Idempotent CANCELLED cancel | PASS (automated) | Download contract 34/34 |

Update this matrix after each device QA session; do not mark device rows PASS from scripts alone.
