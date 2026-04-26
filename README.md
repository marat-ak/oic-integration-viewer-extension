# OIC Integration Viewer

Chrome extension that renders an Oracle Integration Cloud integration blueprint as an interactive, searchable, themeable vertical tree — with full archive inspection, side-by-side comparison, and offline mode.

## What it does

OIC's built-in designer is heavy and online-only. This extension loads an integration's `.iar` archive — either downloaded live from OIC or uploaded from disk — parses it locally, and renders the orchestration as a clean tree you can search, filter, color, fullscreen, copy, or compare against another version.

### Features

- **Two load modes** — **Import Live** (download `.iar` directly from OIC using your session) or **Upload Archive** (open any `.iar` / `.zip` from disk, no OIC access needed).
- **Interactive vertical tree** — full orchestration with collapsible branches.
- **Search** — match across activity names, types, XPath expressions, descriptions.
- **Type filter** — show only assigns / invokes / scopes / etc.
- **Side-by-side compare** — diff two integrations or two versions.
- **Archive file viewer** — browse `project.xml`, `applications.xml`, `processors.xml`, `.jca`, `.nxsd`, `expr.properties` extracted from the `.iar`.
- **Themes** — light / dark / high-contrast / solarized, with **per-activity-type color overrides** saved per theme.
- **XPath preview** — configurable inline preview length, click to expand.
- **Fullscreen / copy / download** for any activity or fragment.
- **Standalone mode** — open `standalone.html` in any browser to view a previously imported blueprint without OIC access.

## Installation

### From source (developer mode)

1. Open `chrome://extensions`.
2. Enable **Developer mode** (top right).
3. Click **Load unpacked** and select the `oic-integration-viewer-extension/` folder.
4. Pin the extension to your toolbar.

### From Chrome Web Store

_(Pending — will be linked here once published.)_

## Usage

### Import Live (from OIC)

1. Open the OIC console on any `*.oraclecloud.com` page (you must be authenticated).
2. Click the toolbar icon → **Open Viewer**.
3. In the viewer toolbar, type the integration **code** and **version** (e.g. `MY_INT` / `01.00.0000`), then click **Import Live**.

The extension fetches:
```
GET /ic/api/integration/v1/integrations/{code}|{version}/archive
    ?includeRecordingFlag=false&allowLockedProject=true&integrationInstance={inst}
```
with your existing session cookies, then parses the `.iar` (ZIP) archive locally with JSZip.

### Upload Archive (from disk)

1. Click the toolbar icon → **Open Viewer**.
2. Click **Upload Archive** in the viewer toolbar.
3. Select any `.iar` or `.zip` exported from OIC.

No OIC session required. Works on any page or in standalone mode. Use this for offline analysis, support cases, or sharing integrations with colleagues who don't have OIC access.

### Import a pre-parsed blueprint JSON

1. Toolbar icon → **Import JSON**.
2. Select a JSON file with an `.orchestration` field at root.

### Standalone (no OIC access required)

Open `standalone.html` directly in a browser. Use **Upload Archive** for `.iar` files or **Import JSON** for pre-parsed blueprints.

### Settings

- **Color theme** — light / dark / high-contrast / solarized.
- **XPath preview length** — max characters shown inline (10–500).
- **Activity colors per theme** — override the color for any activity type. Reset per row.

Settings are stored in `chrome.storage.local` under `ivTheme`, `ivColorOverrides`, `ivMaxXpathCharsInPreview`.

## Permissions

| Permission | Why |
|---|---|
| `activeTab` | Inject the viewer overlay into the current OIC tab. |
| `storage` | Persist theme, color overrides, XPath preview length. |
| `scripting` | Inject viewer assets when launched from the popup. |
| `*://*.oraclecloud.com/*` | Match OIC console domains. |
| `web_accessible_resources` (`content.css`) | Style the viewer overlay. |

The extension does **not** send blueprint data anywhere. Archive download, parsing, and rendering all happen in your browser tab using your existing OIC session.

## Compatibility

- Chrome / Edge / Brave (Manifest V3).
- OIC Generation 2 design console (`design.integration.<region>.ocp.oraclecloud.com`).

## Troubleshooting

| Problem | Fix |
|---|---|
| Archive download returns 401 | Re-authenticate to OIC in the same tab; cookies must be live. |
| Viewer empty | Confirm the integration code + version are correct and not deleted. |
| Imported JSON shows nothing | The JSON must have a top-level `orchestration` field. |
| Color overrides not sticking | They are saved **per theme** — switching theme reveals different overrides. |

## How it works (technical)

- Single request: `GET .../archive` with `Authorization: session` + same-origin cookies.
- JSZip extracts orchestration + referenced files.
- `mergeArchiveIntoBlueprint()` merges schema / connection / sample files onto activities.
- Sample / derived schemas exploded from `nxsdmetadata.properties` JSON.
- Renders an interactive tree from `orchestration.globalTry` downward.
- Popup ↔ content script messages: `iv-openEmptyViewer`, `iv-importData`, `iv-themeChanged`, `ping`.

## Bug reports & feature requests

- **Bugs:** https://github.com/marat-ak/oic-integration-viewer-extension/issues/new?template=bug_report.yml
- **Feature ideas:** https://github.com/marat-ak/oic-integration-viewer-extension/issues/new?template=feature_request.yml
- **Browse existing:** https://github.com/marat-ak/oic-integration-viewer-extension/issues

Before filing, please scrub any tenant-specific data (integration code/version, archive contents, payloads).

## License

Internal / unpublished. Contact the maintainer before redistributing.
