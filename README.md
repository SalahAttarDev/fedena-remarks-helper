# Fedena Remarks Helper (Chrome extension)

## Install (once)
1. Open `chrome://extensions` and switch on **Developer mode** (top right).
2. Click **Load unpacked** and choose this `extension` folder.

## Use (each class)
1. Log in to Fedena → **Menu → Academics → Remarks → Add custom remarks**.
2. Choose the **Grade** and **Batch**. The **📝 Remarks Helper** panel (bottom right) shows how many students it found.
3. Fill **Subject**, **Remark by** and **Lesson plan / topics** (remembered for next time).
4. Click **📋 Copy for AI** and paste into ChatGPT / Claude. Optionally add notes per student (e.g. "Habiba excellent, Rayan shy").
5. Copy the AI's JSON answer, click **📥 Paste & Fill**, paste, and click **Fill remarks**.
   Green = filled, red = still empty.
6. Read through, then click Fedena's **Finish** button. The extension never saves on its own.

Students are matched by admission number (then by name), so order doesn't matter.

## Firefox
- **Quick (temporary):** open `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on…** → pick `manifest.json` in this folder. Firefox removes it when it restarts, so repeat after each restart.
- **Permanent:** Firefox only keeps add-ons that Mozilla has signed. Zip this folder's contents, upload it to addons.mozilla.org as an **unlisted** add-on (free, private, nobody else sees it), then install the signed `.xpi` it gives you.
