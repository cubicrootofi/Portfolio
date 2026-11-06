<<<<<<< HEAD
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

Everything still to replace has `class="ph"` and shows a dashed violet underline on the page. Search `index.html` for `class="ph"`:

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

## Adding a video

Anywhere an image goes, a `<video>` works too: in a project's `.work__thumb`, or in a gallery `.shot__frame`.

```html
<div class="work__thumb">
  <video src="assets/media/delta-demo.mp4" poster="assets/media/etabs-delta.png"
         aria-label="ETABS Delta running a full comparison" muted loop playsinline></video>
</div>
```

- It plays muted and looping while it's on screen, and pauses when it isn't. With reduced motion turned on, it stays on the poster.
- The row's hover preview uses the same clip automatically. To preview a different, shorter clip, put `data-video="assets/media/short.mp4"` on the `<li>`.
- Clicking it opens the lightbox with player controls, continuing from the same moment. It starts muted; add `data-sound` to the `<video>` to start with sound.
- The `aria-label` becomes the caption in the lightbox.

Keep clips short (10 to 30 s), about 1280 px wide, and a few MB each. Windows' Snipping Tool can record the screen. To shrink a recording:

```
ffmpeg -i input.mp4 -vf "scale=1280:-2" -c:v libx264 -crf 26 -preset slow -an -movflags +faststart assets/media/clip.mp4
```

`-an` drops the audio track; leave it out if the clip has narration. `+faststart` lets the clip start before it has fully downloaded.

Bump the `?v=` on the CSS/JS links in `index.html` when you change them, so browsers don't serve a stale copy.

## Before publishing

The screenshots and several descriptions cover internal Dar tools. Two of the screenshots also show a project model name (`R1ULT_JLT.EDB`, "JLT Integrated Model"). Check what you're allowed to show publicly, and crop or blur model names if needed.

## Deploy

Any static host works: GitHub Pages (push the folder, enable Pages), Netlify or Vercel (drag and drop the folder), or Cloudflare Pages.
=======
Portfolio for my work
>>>>>>> 17df06e58462d9e6868029f61fc8b2b2bff7db73
