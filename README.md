# Med Info (Jekyll)

Static Jekyll site with a generated counselling PDF.

## Local Build

### Prerequisites
- Ruby `3.3.6` (see `medicalchange/.ruby-version`)
- Bundler `4.0.6` (matches `medicalchange/Gemfile.lock`)
- Python 3

If you use `rbenv`, initialize it in your shell before building.

### Commands
From repo root:

```bash
make build
```

This will:
1. Generate `medicalchange/assets/pdfs/Counselling-Options.pdf` from `medicalchange/data/counselling-links.txt`
2. Build Jekyll output to `_site/`

Run locally:

```bash
make serve
```

## CI/CD

GitHub Actions workflow:
- `.github/workflows/build-and-deploy.yml`

Build/deploy path:
1. `make build`
2. Verify required output files exist
3. Upload `_site` artifact
4. Deploy to GitHub Pages
