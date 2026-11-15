# Make Mylo Chat installable

Development import is only on your Mac. To let your partner **search and install**, publish the plugin.

## Fastest path (same Figma team)

Use this if you and your partner share a **Figma team / org**.

1. Open **Figma Desktop**.
2. **Plugins** → **Development** → **Mylo Chat** (run it once so it’s selected).
3. **Plugins** → **Development** → **Publish…** (or right‑click the plugin in the list → Publish).
4. Fill in:
   - **Name:** Mylo Chat  
   - **Description:** Room chat for your Mylo pod — each person signs in with their own account.  
   - **Icon:** `figma-plugin/icon.png`  
5. Choose **Publish for team** / **Private to team** (wording varies) — **not** Community yet if you want it only for you two.
6. Confirm publish.

**Her side:**
1. **Plugins** → **Manage plugins** / browse **team plugins**
2. Search **Mylo Chat** → **Run** / **Save**
3. Open the **shared Figma file** (you must share the file with her separately)
4. Run Mylo Chat → sign in as herself

## Public install (Figma Community)

Same publish flow, but choose **Publish to Community**.  
Figma **reviews** Community plugins — can take days. Until approved, team publish is better for you two.

## She still needs the file

Installable plugin ≠ shared file.

| Need | How |
|---|---|
| Plugin on her Figma | Team/Community install |
| Same canvas + same room link | You **share the Figma file** with her (can edit) |

## If Publish is greyed out / ID error

1. **Plugins** → **Development** → **New plugin…**  
2. Name it **Mylo Chat**, choose **With UI**.  
3. Point it at this folder’s files (or copy `code.js` + `ui.html` + `manifest.json` fields into the generated plugin).  
4. Replace `manifest.json` `id` with the **numeric id** Figma generated.  
5. Publish again.

## After publish

Tell her: search **Mylo Chat** in team plugins → install → open your shared file → run → sign in.
