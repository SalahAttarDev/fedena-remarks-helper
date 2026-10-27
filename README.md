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

## Marks (Gradebook)
1. Open **Gradebook → Manage Gradebook → (grade) → Manage Exams → (exam, e.g. 1st Term Marks) → Enter marks** for a subject and batch.
2. The **🧮 Marks Helper** panel shows the students and mark columns (e.g. HW, Oral, Cw, Attnd, each /10).
3. **📋 Copy marks template** gives the JSON to fill (or export from gmis-platform):
   ```json
   { "batch": "Grade 05 - Green (2026-2027)", "exam": "1st Term Marks (TM1)",
     "students": [ { "name": "…", "admission_no": "S1501",
                     "marks": { "HW": 8.5, "Oral": 7, "Cw": 9, "Attnd": 10 } } ] }
   ```
4. **📥 Paste & Fill Marks** fills each box, matched by admission number. Marks above the maximum are refused (red);
   locked (already submitted) marks are skipped.
5. Check, then click Fedena's **Submit Marks**. The extension never submits on its own.
