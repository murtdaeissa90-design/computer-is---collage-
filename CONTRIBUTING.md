# Contributing

Thanks for helping improve Students IS.

## Reporting a problem or suggesting a feature
Open an issue and choose the matching template. For bugs, include the page, what you expected, what happened, your device and browser, and a screenshot if possible. Do not post passwords, tokens or personal data.

## Making a change
1. Create a branch from `main` (for example `fix/upload-message` or `feat/study-streak`).
2. Keep each pull request focused on one change.
3. Run `npm run build` and make sure it passes.
4. Open a pull request and fill in the template. Merging to `main` deploys the site to Netlify, which uses build credits, so group small changes.

## Content (subjects, links, questions)
Content lives in `src/data/`. See [docs/EDITING.md](docs/EDITING.md) (Arabic).

## Security
Never commit secrets (`service_role` keys, API keys, `.env` files). To report a vulnerability privately, read [SECURITY.md](SECURITY.md).
