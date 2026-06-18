# TipRanks Forecast HTML Capture Extension

This is a small unpacked Chrome extension that saves the rendered `outerHTML` from TipRanks forecast pages for an editable ticker list.

It uses your normal Chrome session. Log into TipRanks in Chrome before starting a run. It does not bypass login, CAPTCHA, rate limits, or subscription controls.

## Install

1. Open Chrome.
2. Go to `chrome://extensions`.
3. Turn on **Developer mode**.
4. Click **Load unpacked**.
5. Select this folder:

   `/Users/sreddy/projects/showmeedge/batch-jobs/tipranks-html-capture-extension`

6. Pin the extension if you want it visible in the toolbar.

## Use

1. Log into TipRanks in Chrome.
2. Click the extension icon.
3. Edit the ticker textarea. Use one ticker per line, or separate tickers with spaces/commas.
4. Set a delay between tickers. A conservative value such as `45` to `120` seconds is recommended for paid sites.
5. Set the extra page wait. Start with `15` seconds and increase it if saved pages are missing table content.
6. Leave **Click Show More before saving** enabled if the table has expandable rows.
7. Set **Max Show More clicks** high enough for the longest table. Start with `10`.
8. Set **Wait after each click** to `3` to `5` seconds if new rows load slowly.
9. Click **Start**.

Files are saved under your Chrome Downloads folder:

`Downloads/tipranks-html/<TICKER>-forecast.html`

Chrome will automatically uniquify names if a file already exists.

## One-time capture

Open any TipRanks page in Chrome, return to the extension controller tab, and click **Save Active TipRanks Tab Once**. This saves the most recently used TipRanks tab without running the ticker list.

## Notes

- This saves rendered DOM HTML using `document.documentElement.outerHTML`.
- Before saving, the extension can scroll near the bottom and click visible buttons or links with text like `Show More`, `Load More`, `View More`, or `See More`.
- It does not save DevTools' Inspect view. The extension reads the page DOM directly.
- If TipRanks shows a login prompt, challenge, rate-limit, or access-denied page, stop the run and continue manually later.
- Chrome extensions can save to the browser Downloads folder or a subfolder inside it. They cannot silently write to an arbitrary absolute path on disk.
