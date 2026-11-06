LX ШАРАГА 3.0 — SITE + GITHUB SYNC

GitHub Pages frontend. Publish the contents of this folder to the repository root.
The initial schedule file is data/schedule.json.

GitHub setup:
1. Create a PUBLIC repository. Schedule JSON will be publicly readable; do not store personal information in it.
2. Upload all files from this folder to the repository root and enable GitHub Pages (Settings -> Pages -> Deploy from branch -> main / root).
3. Open the published site -> Settings. Fill GitHub owner, repository, branch=main, path=data/schedule.json.
4. Create a GitHub fine-grained personal access token limited to this one repository, with Contents: Read and write. Enter it in the site settings and save. The token is kept in sessionStorage for this tab only; it is never included in the website files or schedule JSON.
5. Subsequent edits are published automatically to data/schedule.json.

The local Python service reads the public raw JSON URL. Configure GITHUB_SCHEDULE_URL in the service .env. It checks for changes every 30 seconds by default. No tunnel, inbound port, VPS, or Cloudflare service is used.

Security: GitHub Pages is static, so browser-side writes to GitHub require a user-provided token. A token in a browser tab is not perfectly isolated from scripts/extensions. Use a fine-grained token restricted to this repository only, keep it in sessionStorage, and revoke it after use if desired. Never use a broad classic PAT.
