cc-backlinks CLI reference

Usage

```bash
npm run backlinks -- [domain ...] [top_n]
node ./src/cc-backlinks.js [domain ...] [top_n]
```

Arguments

- `domain` or `domain ...`: One or more hostnames to query. You can pass them as separate arguments or as a comma-separated list. If no domain is provided, the CLI defaults to `example.com`.
- `top_n`: Optional trailing integer that limits how many backlink rows are shown per domain. If omitted, the CLI shows all rows.
- `all`, `unlimited`, or `--all`: Optional trailing flag that disables the per-domain limit entirely.

Examples

```bash
npm run backlinks -- edzy.ai
npm run backlinks -- edzy.ai 25
npm run backlinks -- edzy.ai
npm run backlinks -- edzy.ai roots.io 50
npm run backlinks -- edzy.ai roots.io
npm run backlinks -- edzy.ai,roots.io,example.com 20
npm run backlinks -- edzy.ai,roots.io,example.com
npm run backlinks -- edzy.ai all
npm run backlinks -- edzy.ai roots.io unlimited
npm run backlinks -- edzy.ai,roots.io,example.com --all
node ./src/cc-backlinks.js www.edzy.ai
```

Environment variables

- `CC_RELEASE`: Common Crawl hyperlink graph release to use. Defaults to `cc-main-2026-jan-feb-mar`.
- `CC_THREADS`: Optional DuckDB thread count. Set this to a positive integer to override the default thread count.

Behavior

- The CLI downloads and caches the Common Crawl vertex and edge files under `~/.cache/cc-backlinks/<release>`.
- Download progress is printed in the terminal while files are streaming.
- If a `www.` hostname is not present in the vertex file, the CLI retries the apex domain without `www.`.
- Results are printed as CSV-like rows in the terminal, grouped by input domain.
- If a domain is not found in the selected release, the CLI continues to the next domain instead of stopping the whole run.
- A markdown report is written for each run under `backlink-reports/` in the repo root using the pattern `domain-DD-MM-YYYY.md`.

Output columns

- `linking_domain`: The domain that links to the target.
- `host_count`: The `num_hosts` value from the Common Crawl vertex file for the linking domain.
- `edge_count`: The number of edges found for that linking domain.
