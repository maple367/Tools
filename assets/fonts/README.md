# Homepage web fonts

These WOFF2 subsets are derived from **Maple Mono NF CN**, version and input
checksums recorded in `manifest.json`. Font outlines are unchanged; coverage is
partitioned across CSS `unicode-range` rules. All source cmap codepoints are
covered, including Chinese and Nerd Font glyphs. Regular and Bold are supplied;
other requested weights use these faces, and italics may be synthesized.

- Upstream: https://github.com/subframe7536/maple-font
- Copyright 2022 The Maple Mono Project Authors.
- License: SIL Open Font License 1.1; see `OFL.txt` and original metadata inside
  the fonts. All redistributed font files remain under that license.
- The modified font family is named **Home Start Mono** to respect the upstream
  Reserved Font Name. This is an internal web-font alias, not a new font design.

`fonts.css` first tries installed Maple Mono NF CN faces. If absent, the browser
fetches only the WOFF2 character partitions used by visible text. Latin and
public application UI characters share a common subset; the remaining original
codepoints are grouped by 256-codepoint blocks. Private bookmark files are not
used to build the subsets. No font CDN or third-party font request is needed.
`font-display: swap` keeps text visible while fonts load, and browsers cache
font responses according to the static host's HTTP headers. URL hashes change
when generated font content changes. No service worker or localStorage cache
is used.

Rebuild from an authorized copy of the original TTF directory, from repository
root (requires uv or equivalent Python packages `fonttools` and `brotli`):

```sh
uv run --with fonttools --with brotli python scripts/build-webfonts.py FONT_DIR
```

Input filenames: `MapleMono-NF-CN-Regular.ttf`, `MapleMono-NF-CN-Bold.ttf`.
The checked-in subsets are deployable static assets; visitors need no Python,
build tools, font installation, or account. Updating the original font or public
UI text requires rebuilding. Remove obsolete generated WOFF2 assets only after
checking the new manifest; no automatic broad directory cleanup is performed.
