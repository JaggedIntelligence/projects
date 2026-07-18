# TheFly Research HTML Capture

This batch job opens `https://www.thefly.com/research` in a persistent Playwright browser profile, waits for rendered content, triggers lazy loading, and saves the resulting DOM HTML for later extraction.

It does not store a password in code, bypass login, solve CAPTCHA challenges, or bypass subscription controls.

## First run

From the project root:

```bash
node batch-jobs/thefly-scrape/capture-thefly-research.mjs
```

The default run uses a visible Google Chrome window and a dedicated profile at:

```text
batch-jobs/thefly-scrape/.browser-profile/
```

If TheFly asks you to log in, complete the login in that window using an account that has Street Research access. The job waits for up to five minutes and then continues. Later runs reuse that browser profile.

The dedicated Playwright profile is separate from your normal Chrome profile. Being logged into TheFly in your usual Chrome window does not log this batch job in automatically.

Do not point `--profile-dir` at your normal Chrome profile. Chrome profile directories should not be shared by concurrently running browser processes.

## Output

Each run creates a private timestamped directory:

```text
batch-jobs/thefly-scrape/captures/<timestamp>/
├── final-dom.html
├── final-page.png
└── capture-metadata.json
```

The HTML is the browser's current rendered DOM from `page.content()`. The screenshot is a visual audit artifact. Metadata contains the final URL, sizes, SHA-256 hash, stability observations, scrolling results, and validation results.

If the job detects the free teaser page, a signed-out page, or locked Street Research content, it waits for login during a visible run and fails in headless mode. It saves diagnostics such as `failure-page.html`, `failure-page.png`, and `failure-metadata.json` when possible. A failed page is never presented as a successful capture.

## Subsequent headless runs

After completing a successful visible login and capture:

```bash
node batch-jobs/thefly-scrape/capture-thefly-research.mjs --headless
```

If the session expires, the headless run fails. Run it visibly again and log in manually.

## Page-specific tuning

The defaults wait for visible body text containing `Research`, scroll the window, and wait for the DOM to stabilize. Once the first successful HTML is available, use its stable attributes to tighten readiness:

```bash
node batch-jobs/thefly-scrape/capture-thefly-research.mjs \
  --ready-selector '<stable research container selector>'
```

If research items are virtualized and disappear from the DOM while scrolling, preserve each matching rendered item:

```bash
node batch-jobs/thefly-scrape/capture-thefly-research.mjs \
  --item-selector '<stable item selector>' \
  --min-items 1
```

This creates `collected-items.html` containing unique item fragments. It preserves markup without extracting business fields yet.

If the page uses a nested scrolling panel:

```bash
node batch-jobs/thefly-scrape/capture-thefly-research.mjs \
  --scroll-selector '<scrolling container selector>'
```

For difficult virtualization where no item selector is known yet, add `--save-scroll-snapshots`. This saves the DOM at every scroll position under `scroll-snapshots/` and can consume substantial disk space.

Run `node batch-jobs/thefly-scrape/capture-thefly-research.mjs --help` for all timing and validation options.

## Security

The browser profile and captures may contain account-identifying page data or temporary tokens. They are ignored by Git and created with owner-only file permissions. Keep them local and do not upload them to tickets, chat systems, or source control without reviewing their contents.
