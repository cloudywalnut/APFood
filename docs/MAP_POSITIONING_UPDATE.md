# Cafeteria positioning update · 11 November 2026

Repositioned the existing vector counters, tables, planters and stepped walls using the supplied APFoods Cafeteria Layout reference. Existing counter, tree and table drawing functions and colours are preserved.

Left, top to bottom: Japanese & Korean, Kopitiam, Fried Chicken, Chinese.
Top, behind one shared glass window: Local Corner, Shawarma, Local Corner.
Right, top to bottom: Western, Malay, Indian.
Centre: six existing table graphics in two rows of three. Enter here and an upward arrow sit at the bottom centre.

Each of the ten physical counters has its own unique ID, focus/hover target and preview. Non-interactive counter drawings and large area hover targets were removed. Both Local Corners are independent. Four counters without catalogue entries have previews with Menu coming soon; existing six vendor IDs and menus are preserved. Kopitiam maps to the existing refreshments counter.

The preview card is 150 px wide (previously 300 px), and its image is 73 px tall (previously 145 px). Compact previews fit desktop and phone layouts. The image itself does not intercept hover targets beneath it; preview buttons remain interactive.

Validation: 40 automated checks, TypeScript, production build, individual focus/preview checks for all ten counters, map target hit testing, a working Indian menu drill-down, and 390 px viewport bounds with no horizontal overflow.

Local update only. No GitHub push or backend changes.

Label and boundary refinement: all ten stall names now use the same cream pill, brown border and 13px semibold typography as Enter here. The selected-area yellow outline has been removed. The outer grey structure is rectangular with a centred entrance gap; corner plants were moved clear of the lower stall labels. Browser geometry checks found no nameplate/counter overlaps.
