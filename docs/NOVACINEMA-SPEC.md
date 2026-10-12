# NovaCinema — texnik zadaniye va bosqichli reja (v1, 2026-10-13)

NovaCinema — NovaVerse tarkibidagi **public mahsulot**: Netflix va Kinopoisk'dan ilhomlangan, o'z dizayni va brendiga ega kino platformasi.
Bu repo (`-KinoFinder`) uning kodi; **repo nomi, Render xizmati (`kinofinder-private-beta`), ichki kesh/temp nomlari o'zgartirilmagan** — mavjud deploy buzilmasin. "Public mahsulot" ≠ kod reposini ochish; repo private qoladi (hozir public — qaror Ibrohimdan).

## Mavjud holat (audit, 2026-10-13)
- Node 24 + Express, PWA (uz/ru/en), FFmpeg; sahna (klip) orqali filmni aniqlash: OpenAI (vision+transcribe) + TMDB; private beta kodi; 16 lokal test (real FFmpeg bilan), GitHub Actions + Docker build o'tgan.
- Ishlaydigan: UI, demo (aniq "DEMO" belgisi), yuklash/jarayon/natija, qurilma-lokal tarix va ro'yxat, xavfsizlik (sessiya, rate limit, temp tozalash).
- Jonli aniqlash: OpenAI/TMDB kalitlari va Render deploy **hali yo'q** (RELEASE-CHECKLIST ochiq bandlari).

## Birinchi ishlaydigan versiya (MVP) tarkibi
Streaming YO'Q. Katalog + kashfiyot:
1. **Katalog** — filmlar va seriallar (TMDB metadata: poster, tavsif, janr, yil, reyting, aktyorlar; uz/ru/en lokalizatsiya TMDB'dan, yetishmasa en).
2. **Qidiruv va filtrlar** — nom, janr, yil, til, reyting; "Trend / Yangi / Top".
3. **Film/serial sahifasi** — tafsilot, treyler (YouTube embed — TMDB videos), o'xshash filmlar.
4. **Profil** — ro'yxatdan o'tish (email yoki Telegram login), sevimlilar, tomosha ro'yxati (hozirgi qurilma-lokal ro'yxat → serverga sinxron).
5. **Tavsiyalar** — v1: TMDB "similar/recommendations" + foydalanuvchi ro'yxatidan oddiy skoring (LLM emas).
6. **Sahna orqali aniqlash** — mavjud KinoFinder funksiyasi NovaCinema ichida "Sahnadan top" bo'limi sifatida (o'zgarishsiz).
7. **Admin panel** — kontent ko'rinishini boshqarish (tanlangan to'plamlar, banner), foydalanuvchilar, aniqlash limitlari.
8. **Tillar** — uz/ru/en (mavjud i18n kengaytiriladi).

Texnik: hozirgi Express + vanilla PWA saqlanadi (qayta yozish yo'q); ma'lumotlar bazasi — SQLite (dev) / Postgres (Render) — qaror; TMDB API bepul (attribution shart); auth — sessiya cookie (mavjud) + email magic-link yoki Telegram Login.

## Bosqichlar
| # | Bosqich | Natija (dalil) | Tasdiq kerak |
|---|---|---|---|
| 0 | Brend: ko'rinadigan nom NovaCinema (shu PR) | testlar yashil, UI nomi | — |
| 1 | Katalog + qidiruv (TMDB), uz/ru/en | `/catalog`, `/search`, testlar | TMDB token (bepul) |
| 2 | Film sahifasi + treyler + o'xshashlar | sahifa, testlar | — |
| 3 | Profil + sevimlilar + ro'yxat (server) | DB, auth, testlar | DB tanlovi |
| 4 | Tavsiyalar v1 + admin panel | testlar | — |
| 5 | "Sahnadan top" integratsiyasi + jonli sinov | 1 real klip | OpenAI xarajati |
| 6 | **Streaming (alohida bosqich)** — manba, namoyish huquqlari (litsenziya), video saqlash/CDN xarajati; v1'da yo'q | hujjat + taklif | **Ibrohim** |

Demo ma'lumot har doim "Demo" deb belgilanadi; jonli manbasiz natija ko'rsatilmaydi.

## Agent
**Dilnoza — NovaCinema — Dasturchi** (`novacinema-dev`, eski id `kinofinder-dev`). NOVA AI rejani va vazifalarni boshqaradi (`control/state/novacinema.json`, nova repo).
