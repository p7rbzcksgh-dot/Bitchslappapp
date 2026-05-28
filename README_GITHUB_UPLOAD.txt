TCG BOM Bitchslap APP / BOMAPP v01

Upload:
1. Unzip.
2. Upload all files directly to a GitHub repo root or Azure Static Web App root.
3. Open index.html.

Main functions included:
- Dashboard with Create BOM and UPDATE BOM.
- BOM type options: MA, SA, SSA, INASS, RNDASS, Procedural BOM.
- Easy multi-level BOM sections with add-line buttons.
- Secondary sub-sections inside SSA / INASS and any custom section.
- Add custom sections.
- Add another full BOM section.
- Save draft to phone/browser using localStorage.
- Download editable JSON draft.
- Update/import a saved JSON draft.
- Import SOLIDWORKS BOM CSV/TXT/TSV.
- Import inventory CSV and use prefix-style part search.
- Verify BOM before exporting.
- Export MRPeasy pack as two CSV downloads: Items first, BOM second.
- Export Odoo BOM CSV.
- Local internal alert queue for Required SOP / Urgent Process Change.
- Alert bridge file included for future TEAMAPP / SOP Wizard integration.

Important integration note:
Static web apps cannot push live alerts between different deployed domains without a backend/database.
This package queues alerts in browser localStorage under key:
  tcg-internal-alerts-v1

To make TEAMAPP / SOP Wizard badges read the same queue, host them under the same app/domain or connect a backend later.

Update v02:
- Dashboard background now uses the BOMAPP thumbnail art instead of the previous Craig shop background.
- Added responsive portrait/landscape dashboard layout tuning for phones, tablets, desktops, and wide aspect ratios.

Update v03:
- Rebranded dashboard closer to the TCG SOP WIZARD dashboard style.
- Uses thumbnail art as main dashboard background with dark overlay, metallic title treatment, and glowing pill buttons.
- Added portrait, landscape, short landscape, tablet, desktop, and wide aspect-ratio dashboard tuning.

Update v04:
- Font styling pass only: removed the goofy chunky feel and made the app typography more modern, tighter, and closer to the SOP Wizard/TEAMAPP family.
- App functionality and layout are unchanged from v03.

Update v05:
- Cleaned dashboard per redline: removed the large title lockup and bottom info panel from dashboard.
- Dashboard now has two clean main buttons: Create BOM and Update BOM.
- Added BOM Update Needed Alert button.
- Added incoming reverse link support: index.html?request=bom-update-needed queues a BOM update alert.
- Added SOP_WIZARD_REQUEST_BOM_UPDATE_BUTTON_SNIPPET.html for adding a Request BOM Update button in SOP Wizard.
