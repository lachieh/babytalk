---
"@bubsie/web": minor
---

Rework the app from a design critique so manual logging is reliable and usable with one thumb.

- Fix the first log after onboarding doing nothing until a reload.
- Log optimistically: entries appear at once, failed and offline saves stay visible with a retry, and toasts say whether a timer started or an entry was saved.
- Stop past entries turning into running timers, and show growth measurements on the day they were entered.
- Raise secondary text to WCAG AA contrast in both themes, add a visible focus style, and allow pinch-zoom.
- Enlarge the log buttons and pickers, add start-time and bottle-amount chips, and log bottles as finished feeds.
- Redraw the week chart, growth chart, averages view, app icon, and in-app icons. The growth chart uses recomputed WHO reference tables up to 24 months.
- Simplify sign-in, setup, and the landing page, and reorder the history tabs.
