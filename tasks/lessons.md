# Lessons Learned & Anti-Patterns

This file records key lessons learned during development to prevent regressions and improve design decisions in future sessions.

---

## Geolocation & Device Offline Resilience

* **[Anti-Pattern]** -> Relying solely on high-accuracy GPS with strict timeouts for location queries.
* **[Solution]** -> Sequential fallback architecture: first try GPS (high-accuracy), then network (coarse accuracy), and finally retrieve cached/last known position from the past 24 hours.

---

## User Management security limits

* **[Anti-Pattern]** -> Mutating user auth metadata or emails directly from the client application.
* **[Solution]** -> Perform all administrative mutations (creation, updates, deletions) through an Edge Function executing with Supabase Service Role credentials, coupled with strict tenant checking.

---

## Task Sequencing logic

* **[Anti-Pattern]** -> Showing all task actions (e.g., Complete, Suspend) at once, allowing employees to skip the Start action.
* **[Solution]** -> Bind task controls strictly to the active task status (e.g., only show "Complete" when state is `in_progress`).
