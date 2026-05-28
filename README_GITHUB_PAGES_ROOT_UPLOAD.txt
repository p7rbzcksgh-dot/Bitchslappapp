TCG BOMAPP v07 HARD FIX - GitHub Pages Root Upload

This package is flat. No folders inside.

What changed:
- index.html now contains the app CSS and JavaScript inline so GitHub cannot fail to load styles/scripts.
- Dashboard background is still also included as bomapp-thumbnail.png and referenced directly.
- Service worker is disabled/no-cache and unregisters old cached service workers.
- BOM Update Needed button is neutral by default.
- BOM Update Needed button only glows red when an open BOM update alert exists.
- Future SOP Wizard reverse link: index.html?request=bom-update-needed

Upload steps:
1. Delete the old repo files.
2. Unzip this package.
3. Upload ALL files directly to the GitHub repo root.
4. Make sure .nojekyll is included.
5. Wait for GitHub Pages to redeploy.
6. Open github-test.html first.
7. Open index.html.

Do not upload the ZIP itself as the website.
