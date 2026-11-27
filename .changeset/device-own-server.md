---
"@bubsie/api": minor
"@bubsie/web": minor
"@bubsie/standard-config": patch
---

Send a pairing device to your own Bubsie server. On the approve page, "Using your own server?" checks the address you enter, moves the device's code there, and opens that server's approve page once the device has arrived. No account on this server is needed, and sign-in tokens never pass through it. The API adds `redirectDeviceCode`, `confirmDeviceCodeRedirect`, the `deviceCodeRedirect` query, a `redirected` poll status, and an optional `code` on `requestDeviceCode`. `/.well-known/config` is now readable from other origins.
