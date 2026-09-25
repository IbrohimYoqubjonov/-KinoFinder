# KinoFinder · private beta

A standalone movie-discovery PWA, separate from NovaVerse. Uzbek, Russian and English interface, cinematic responsive design, video upload, analysis/results, device-local history and watchlist, iPhone home-screen support, and a protected server-side recognition pipeline.

**Current delivery:** functional application and Render configuration. Live recognition requires your OpenAI and TMDB credentials. No claim of validated recognition accuracy is made. The clearly labeled sample result is fixed demo content and is never substituted for a failed live API call.

## Run locally

Requirements: Node.js 24, FFmpeg and FFprobe on PATH (or set their paths below).

```sh
npm ci
cp .env.example .env
# Fill .env using the table below.
npm start
```

Open http://localhost:3000. Without credentials the interface, demo, settings and watchlist work, while live recognition stays disabled. A private beta code is mandatory even in development; there is no default public password.

| Variable | Purpose |
| --- | --- |
| `OPENAI_API_KEY` | Secret OpenAI API project key with funded API access. A ChatGPT subscription alone is not this key. |
| `TMDB_READ_ACCESS_TOKEN` | Secret TMDB API **Read Access Token**, not the short v3 API key. |
| `BETA_ACCESS_CODE` | Shared invitation secret, at least 16 characters. Render generates it. |
| `SESSION_SECRET` | Session signing secret, at least 32 characters. Render generates it. |
| `OPENAI_VISION_MODEL` | Default `gpt-4.1-mini`; use a model with image inputs and strict structured outputs. |
| `OPENAI_TRANSCRIBE_MODEL` | Default `gpt-4o-mini-transcribe`. |
| `MAX_RECOGNITIONS_PER_DAY` | Per-process rolling 24-hour attempt cap, default 50. |
| `FFMPEG_PATH`, `FFPROBE_PATH` | Optional executable paths; Docker installs both. |
| `PORT` | Default 3000 locally. Render sets its port. |
| `NODE_ENV` | `production` enables Secure cookies and HSTS. Requires HTTPS ingress. |

Never put secrets into frontend files, screenshots, commits, or issue comments. `.env` is ignored by Git and excluded from Docker builds. The server never returns provider keys to the browser.

## Deploy to Render

1. In Render, create a **Blueprint** and connect `IbrohimYoqubjonov/-KinoFinder`. If GitHub requests installation, grant access to this repository only.
2. Select `main`; Render reads `render.yaml`. It defines one Docker web service, `kinofinder-private-beta`, on the free plan. No paid service is created by this configuration.
3. Supply `OPENAI_API_KEY` and `TMDB_READ_ACCESS_TOKEN` in Render's secret fields. `BETA_ACCESS_CODE` and `SESSION_SECRET` are generated automatically. Retrieve the beta code privately in Render Environment and share only with invited testers.
4. Deploy. The Docker image includes FFmpeg/FFprobe and runs as a non-root user. `/api/health` checks the web process; `/api/status` reports whether recognition is configured. The health check deliberately does not incur API charges.
5. Open the generated HTTPS URL, enter the beta code, and test a known short movie clip. Verify that results are plausible, and test an unrelated clip that should return no candidates.
6. On iPhone, use **Safari → Share → Add to Home Screen**. Open the installed app, enter the beta code if asked, upload a 1–60 second MP4/MOV and test from that device.

The free Render instance can sleep and has limited CPU/memory. Cold starts and video processing can be slow. This is a small invited beta, not a production SLA. Do not choose a paid upgrade without the owner's approval. GitHub Actions checks tests and the Docker build; auto-deploy waits for checks to pass.

## Recognition architecture

1. Browser obtains consent and uploads a clip via authenticated multipart POST `/api/recognize` (60 MB maximum).
2. Server writes into a unique OS temp folder, validates the media with FFprobe, rejects clips outside 1–60 seconds or over 4096×4096 pixels.
3. FFmpeg extracts up to eight evenly sampled JPEGs, longest edge 768 px, plus mono 16 kHz audio when present. Subprocesses have timeouts, one decoder thread and restricted input protocols.
4. Audio is transcribed through OpenAI. If transcription fails, visual analysis continues and the result explicitly indicates audio was unavailable.
5. OpenAI Responses receives sampled frames and any transcript, with a strict schema for at most three movie hypotheses and specific evidence. `store: false` is requested. Embedded subtitles/transcripts are treated as data, not instructions.
6. TMDB searches each hypothesized title. Candidate ranking combines the model's qualitative evidence strength, exact normalized title, and release-year match. IDs are deduplicated. Internal sorting scores are **not probabilities** and are not exposed as confidence percentages.
7. UI presents **possible matches**, evidence and a TMDB detail link. Empty evidence or no catalog candidates produces an unknown result. Provider failures produce an error, never a demo match.
8. Temporary video, frames and audio are removed in `finally`, including error paths. A disconnected client cancels processing. History stores only result metadata locally; no raw clip, frame or transcript is retained in history.

This is general-purpose multimodal inference, not a licensed fingerprint catalog. It can guess incorrectly, miss obscure movies, struggle with dubbing, and is not currently intended for TV episode recognition. Evaluate it with a representative, labeled clip set before widening the beta. The sample is not an evaluation of accuracy.

## Privacy and access

- Same-origin API, signed seven-day HttpOnly/SameSite=Strict cookies, Secure in production. Changing the beta code or session secret invalidates existing sessions.
- No provider secrets in localStorage. Only language, film results and watchlist are device-local. Clear them in Settings. Logout ends access but intentionally retains that device's collection.
- Server rejects cross-origin writes. Security headers include CSP and frame denial. Results are rendered with escaped text and approved poster/link origins.
- Maximum one active recognition, five attempts per IP/hour, global daily cap; login attempts are also limited. The cap counts attempted uploads and is not a billing guarantee.
- Rate limits are in memory: restart resets them, and multiple replicas do not share counters. Use one replica for this beta; add a shared limiter and per-user auth before scaling. Set a provider budget/alert as well.
- The app shell is public/cacheable for PWA installation; recognition is invite-only. The service worker never caches `/api/`, uploaded videos or third-party posters.
- OpenAI receives frames/audio, TMDB receives proposed film titles. Provider retention policies still apply despite `store:false`. A server crash may leave temporary files until the ephemeral instance is recycled; routine success, failure and cancellation paths clean them up.
- TMDB attribution is shown in Settings. Metadata may fall back to English for Uzbek; saved explanations retain their original language.

## Verification

```sh
npm run check
npm test
docker build -t kinofinder .
```

Tests cover signed-cookie tampering/expiry, credential rotation, rate limits, auth/origin guards, credential fail-closed behavior, metadata ranking, provider errors, temp-file cleanup, multipart upload, real FFmpeg frame/audio extraction, silent clips, corrupt clips and duration rejection. Media tests skip when FFmpeg/FFprobe are unavailable; CI installs them so those tests run.

Manual release acceptance still requires live API credentials, a deployed HTTPS URL, and an actual iPhone Safari test. A desktop browser at iPhone dimensions does not verify iOS codecs or installation behavior.

## Official references

- [OpenAI image input](https://developers.openai.com/api/docs/guides/images-vision)
- [OpenAI structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs)
- [OpenAI transcription](https://developers.openai.com/api/docs/guides/speech-to-text)
- [TMDB bearer authentication](https://developer.themoviedb.org/docs/authentication-application)
- [TMDB movie search](https://developer.themoviedb.org/reference/search-movie)
- [Render Blueprint specification](https://render.com/docs/blueprint-spec)
