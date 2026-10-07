---
"@bubsie/api": minor
"@bubsie/web": minor
"@bubsie/mcp": minor
"@bubsie/standard-config": patch
---

Rename to Bubsie. Settings are now read from `BUBSIE_API_*` / `BUBSIE_WEB_*`, and every URL, domain, and secret must be set explicitly: the servers exit at startup if one is missing. Adds a self-hosting compose file and guide.
