---
"@bubsie/api": minor
"@bubsie/web": minor
---

Remove the AI and voice features (voice input, home-screen insights, pump hints) and the Tambo integration behind them. Logging, timers, history, growth, pumping, and station mode work as before.

Breaking for self-hosters: the web app no longer reads `BUBSIE_WEB_TAMBO_URL` or `BUBSIE_WEB_TAMBO_API_KEY`. Remove them from your `.env` and compose file; if they stay set they are ignored. The API no longer exposes the `agentThread` query or `updateAgentThread` mutation. The `agent_threads` table is left in place.
