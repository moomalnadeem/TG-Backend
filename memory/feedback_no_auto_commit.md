---
name: feedback_no_auto_commit
description: User does not want Claude to run git commits — always ask the user to commit themselves
metadata:
  type: feedback
---

Never run `git commit` commands. Make code changes, then tell the user what's ready and let them commit.

**Why:** User wants full control over commits.

**How to apply:** After making changes, summarize what's changed and prompt the user to commit when ready. Do not run git add + git commit under any circumstance.
