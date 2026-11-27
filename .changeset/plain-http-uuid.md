---
"@bubsie/web": patch
---

Sign-in and logging work on a self-hosted Bubsie reached over plain http (a LAN address): ids no longer need `crypto.randomUUID`, which browsers only offer on https and localhost.
