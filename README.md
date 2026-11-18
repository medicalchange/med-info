# Med Info (Jekyll)

Static Jekyll site with a generated counselling PDF.

## Local Build

### Prerequisites
- Ruby `3.3.13` (see `site/.ruby-version`; CI reads the same file)
- Bundler `4.0.6` (matches `site/Gemfile.lock`)
- Python 3

If you use `rbenv`, initialize it in your shell before building.

### Commands
From repo root:

```bash
make build
```

This will:
1. Generate `site/assets/pdfs/Counselling-Options.pdf` from `site/data/counselling-links.txt`
2. Build Jekyll output to `_site/`

Run locally:

```bash
make serve
```

## Tools

### FHO+ Hour Tracker
- The tracker now lives in the separate `medicalchange/fhohours` repository and is no longer served from this Jekyll site.
- Keep `med-info` public and deploy the tracker privately from the standalone repo.

## Analytics

[Umami Cloud](https://cloud.umami.is/) records visits across the site, including the
standalone lab and calculator pages. The public website ID is configured in
`site/_config.yml`. Clear `analytics_provider` to disable tracking.

The shared `analytics.html` include installs the tracker. `site/assets/analytics.js`
adds these events, available in the website's Umami Events view:

- **External link / Internal link / Section link:** destination and public link label.
- **PDF click / File click:** clicks on PDF or download links, not confirmed downloads.
- **Phone link / Email link:** contact-link clicks, without contact details.
- **Button click:** a fixed `data-analytics-action` label, such as printing or copying a note.
- **Tool use:** a fixed `data-analytics-submit` label when a calculator form is submitted.

Events include the source page. Select an event in Umami to inspect its properties.
Both scripts restrict recording to `medicallinks.ca` and `www.medicallinks.ca`, so
previews and CI do not add traffic. URL query strings and fragments are excluded.
No form values, clinical report text, calculation results, search text, or clipboard
content are read by the custom analytics code. It never blocks links or calculator
behavior if Umami is unavailable. GoatCounter has been replaced; existing historical
data remains in the previous service.

## CI/CD

GitHub Actions workflow:
- `.github/workflows/build-and-deploy.yml`

Build/deploy path:
1. `make build`
2. Verify required output files exist
3. Upload `_site` artifact
4. Deploy to GitHub Pages

