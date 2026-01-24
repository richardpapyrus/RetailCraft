---
trigger: always_on
---

# Agent Constraints & Safety Protocols

## 🚨 Critical: Data Integrity
- **Database Protection:** You are strictly prohibited from executing `DROP`, `TRUNCATE`, or `DELETE` commands on any database table.
- **Data Modification:** Any `UPDATE` or `INSERT` operations must be explicitly detailed in the **Implementation Plan** and require a "Manual Approval" before execution.
- **No Schema Deletion:** Do not suggest or implement code that removes existing database columns or tables.

## 🔄 Regression Prevention
- **Feature Lockdown:** Any feature listed in `@docs/working_features.md` (or equivalent) is considered "Confirmed Working."
- **Immutable Logic:** You must not refactor or alter the core logic of working features unless the primary task is specifically to upgrade them.
- **Mandatory Verification:** After any code change, you must use the **Browser Agent** or **Terminal** to run existing tests. If no tests exist, you must create a **Walkthrough Artifact** demonstrating that the change did not break the existing UI/UX.