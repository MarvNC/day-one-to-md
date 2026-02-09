# Day One to Markdown

Local web app to convert a Day One export into one chronological markdown file.

## Run

```bash
bun install
bun run dev
```

Then open the local URL from Vite and drag in either:

- `Journal.json`
- Day One `.zip` export containing `Journal.json`

## Output format

- Entries sorted oldest to newest by `creationDate` (fallback `modifiedDate`)
- Entry header format: `# yyyy-mm-dd hh-mm-ss` (UTC)
- Separator between entries: `---`

## Privacy

All parsing and conversion happens in-browser. No file upload.
