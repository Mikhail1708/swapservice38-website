# Local web fonts

Inter (300–900 normal) and Oswald (400–700 normal) are self-hosted variable
WOFF2 fonts. Assets were obtained on 2026-09-23 from the official Google Fonts
CSS API for those weight ranges, preserving its Unicode subsets. Files are
unmodified; browsers request only the subsets required by rendered text.
No font download occurs at build time or from a third-party server at runtime.

Official family sources and licenses:

- https://github.com/google/fonts/tree/main/ofl/inter — `inter-OFL.txt`
- https://github.com/google/fonts/tree/main/ofl/oswald — `oswald-OFL.txt`

Both families use SIL Open Font License 1.1. Keep the license files with the
distributed font files. CSS definitions live in `src/app/fonts.css`.
