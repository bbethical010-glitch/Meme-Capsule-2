# Android analytics follow-up request

Do not change the event schema. Update the Android client to:

1. Flush queued events every 20 seconds in the foreground, immediately at 10 queued events,
   at `session_start`, and on background/exit.
2. At session start, obtain a Play Integrity token. The backend should verify it and issue a
   short-lived signed session token sent as `X-Analytics-Session`; backend enforcement will be
   enabled after rollout.
3. Ship the new analytics app token before retiring the previous token.
4. Optionally send a client send-time header so upload delay can be measured against `received_at`.

Keep consent gating, queue purging on revocation, and the existing response contract unchanged.
