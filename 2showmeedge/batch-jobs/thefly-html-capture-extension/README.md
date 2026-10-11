# TheFly HTML Capture Extension

This is a small unpacked Chrome extension that saves the rendered `outerHTML` from TheFly pages, starting with:

`https://www.thefly.com/research`

It uses your normal Chrome session. Log into TheFly in Chrome before saving. It does not bypass login, CAPTCHA, rate limits, or subscription controls.

## Install

1. Open Chrome.
2. Go to `chrome://extensions`.
3. Turn on **Developer mode**.
4. Click **Load unpacked**.
5. Select this folder:

   `/Users/sreddy/projects/showmeedge/batch-jobs/thefly-html-capture-extension`

6. Pin the extension if you want it visible in the toolbar.

## Use

1. Log into TheFly in Chrome.
2. Click the extension icon.
3. Keep the page URL as `https://www.thefly.com/research`, or edit it to another TheFly page.
4. Set **Extra render wait**. Start with `15` seconds and increase it if the saved page is missing late-loaded content.
5. Click **Open Research and Save**.

Files are saved under your Chrome Downloads folder:

`Downloads/thefly-html/thefly-research-YYYY-MM-DD-HHMM.html`

Chrome will automatically uniquify names if a file already exists.

## Schedule

Scheduled saves are enabled by default for local Pacific wall-clock time:

```text
18:00
04:00
05:00
06:00
```

Chrome must be open, the computer must be awake, and you must still be logged into TheFly. The controller shows the next scheduled run and lets you edit the times later.

## Save an already open tab

Open TheFly manually in Chrome, return to the extension controller tab, and click **Save Most Recent TheFly Tab**.

## Notes

- This saves rendered DOM HTML using `document.documentElement.outerHTML`.
- It does not save DevTools' Inspect view. The extension reads the page DOM directly.
- Chrome extensions can save to the browser Downloads folder or a subfolder inside it. They cannot silently write to an arbitrary absolute path on disk.
