# Portfolio

A static site with no build step: `index.html`, `assets/style.css`, `assets/main.js`, `assets/field.js`, plus screenshots in `assets/media/`.
GSAP, ScrollTrigger and Lenis load from CDNs. If any of them fail to load, the page falls back to a plain, readable document.

## Run it locally

Serve the folder over http. Opening the file directly (`file://`) can skip the scripts and screenshots:

```
python -m http.server 5174 --directory Portfolio
```

Then open http://localhost:5174.

## Fill in the placeholders

Everything still to replace has `class="ph"` and shows a dashed ember underline on the page. Search `index.html` for `class="ph"`:

- Facts under the statement: years of experience, city
- ORCA: your role on it (the repository belongs to another account)
- Rows 12 to 14: open slots for other projects (delete any you don't need, and update "11 projects · 3 open slots")
- "Also built": descriptors for Triton, UI Automation API, Connection Joint Forces and Spot Coordinates
- Case study facts: role, users
- Experience: titles, dates, companies, education
- Contact: email, LinkedIn, GitHub, CV link
- Footer: city, plus `data-tz` on the clock (an IANA zone such as `Asia/Dubai`)

## Adding a project

Copy a `<li class="work__row">` block. For the hover preview, either:

- give the `<li>` a `data-img="assets/media/your-shot.png"` and put an `<img>` in `.work__thumb`, or
- give it `data-kind="…"` and the thumb `data-plate="…"`, which draws a sheet in the same style.
  Kinds: `chat`, `mesh`, `typed`, `pair`, `slab`, `joint`, `tiles`, `tokens`, `drift`, `ph`.

Bump the `?v=` on the CSS/JS links in `index.html` when you change them, so browsers don't serve a stale copy.

## Before publishing

The screenshots and several descriptions cover internal Dar tools. Two of the screenshots also show a project model name (`R1ULT_JLT.EDB`, "JLT Integrated Model"). Check what you're allowed to show publicly, and crop or blur model names if needed.

## Deploy

Any static host works: GitHub Pages (push the folder, enable Pages), Netlify or Vercel (drag and drop the folder), or Cloudflare Pages.
