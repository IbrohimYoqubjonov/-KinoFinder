# Private beta release checklist

## Implemented and locally checked

- [x] Cinematic responsive UI with Uzbek, Russian and English.
- [x] Video selection/preview, upload consent, upload progress, cancellation, honest error states.
- [x] Frame/audio extraction, OpenAI adapters and TMDB candidate ranking.
- [x] Clearly labeled demo; no fabricated live fallback or confidence percentages.
- [x] Device-local history and watchlist; clear-data and logout controls.
- [x] Web manifest, PNG icons, Apple touch icon and offline shell service worker.
- [x] Signed beta session, same-origin write guard, rate/concurrency limits, temporary file cleanup.
- [x] Dockerfile, Render Blueprint, GitHub Actions checks, environment reference.
- [x] 16 local automated tests passed, including real FFmpeg tests, with 0 skips.
- [x] Browser inspection at desktop and 390×844; sample result, saving, Russian language and persistence checked.
- [x] Hosted GitHub Actions tests and Docker image build passed (run 36076300047).

## Required before calling the beta live

- [ ] Set `OPENAI_API_KEY` and `TMDB_READ_ACCESS_TOKEN` in Render.
- [ ] Complete Render account/GitHub authorization and deploy the private repository.
- [ ] Validate one successful live recognition and one unknown clip against real providers.
- [ ] Test Safari on a real iPhone: install, relaunch, login, MOV/MP4 upload, results and history.
- [ ] Evaluate recognition on a labeled set of known and unknown movie clips. Document mistakes.

No public deployment or real-provider success should be inferred from a passing local mocked-provider test.
