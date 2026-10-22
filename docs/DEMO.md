# Seven-minute demonstration

Rehearse on the same devices and browsers you will use in the competition. Keep Local Demo Mode available as a fallback; it does not claim cross-app synchronisation.

## Before the judges arrive

1. Run tests and build. Reset the fictional dataset. Open all three independent deployed apps.
2. Connected presentation: sign the phone into Alex, the gate laptop into `gate-a`, and the dashboard into `management`. Let the management snapshot finish loading. Check the gate heading is **KK3 · Block A**.
3. Allow the gate camera. Scan a fresh phone QR. Confirm an actual new event reaches the separate dashboard. A missed short-lived QR can be retried after the next refresh.
4. Confirm audio works after a button click, and avoid muted speakers. Demo buttons work if the camera fails; connected buttons require the server-side demo flag (already enabled for this project).
5. For the five-failure demonstration, reset events or wait more than two minutes after earlier denied attempts. Close other gate tabs to avoid confusing simultaneous results. A QR is single use, so reuse should deny access.
6. Use dashboard date filters that include today and all blocks. Keep the correct browser origins in `ALLOWED_ORIGINS` if enabled.

## Presentation sequence

| Time      | Action                                                                      | Explain                                                                                                                                                              |
| --------- | --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0:00–0:45 | Introduce the problem and show three separate app URLs                      | One identity linked to current residential permission; 24-hour access with no curfew.                                                                                |
| 0:45–1:30 | Show Alex's digital card and the circular QR countdown                      | A fresh unpredictable credential every 15 seconds; server expiry and single use in connected mode. It reduces copying risk but cannot stop live relay.               |
| 1:30–2:30 | Scan Alex, then use wrong-block, non-resident and expired scenario controls | Alex opens Block A; the others are denied immediately, with an appropriate reason. The gate closes automatically.                                                    |
| 2:30–3:15 | Trigger five failed attempts; open Security Monitoring                      | Operational alert, human review, no automatic accusation. Set Under Review, then Resolved.                                                                           |
| 3:15–4:15 | Show Overview and Residential Activity; change college/date filters         | Consistent totals, distinct entry days and zero-entry residents. Entry frequency is not nights stayed or housing entitlement.                                        |
| 4:15–5:00 | Open Holiday Planning; declare a stay from the student app                  | Declared stays and recent unique entrants help plan support. They are not a count of people inside.                                                                  |
| 5:00–6:00 | Move Alex to Block B in Residential Records; scan a fresh QR at gate A      | Connected permission change takes effect on the next scan. Restore Alex to Block A afterward. Local fallback uses the dashboard's Test permission control.           |
| 6:00–6:40 | Enable Simulate connection loss at the gate; scan a demo resident           | Clearly labelled fictional verification, pending synthetic events, no frontend signing secrets. Reconnect and upload the demo queue separately from trusted entries. |
| 6:40–7:00 | Close with safeguards                                                       | Free emergency exit, no curfews, minimal individual histories, human-reviewed alerts and responsible aggregate planning.                                             |

## Fallback if Supabase or the venue internet fails

Run `npm run dev` from the already installed repository. Use each app's Local Demo Mode. The gate buttons demonstrate authorisation, animation and the five-failure alarm. Dashboard → Security has its own five-failure control; Residential Records has its own permission test; Holiday Planning has its own declaration toggle. Say explicitly: **“These fallback apps are standalone simulations; real cross-device updates use our shared Supabase backend.”**

A phone cannot load an uncached site without internet. Show the local student portal in a laptop tab if necessary. Local computer cameras work on localhost. No facial recognition or real gate hardware is claimed.

## Connected acceptance checklist

- Scan the fresh displayed phone QR at the real gate page and see ACCESS GRANTED, then see the event at the real dashboard URL.
- Reuse the same token before expiry and confirm it never opens twice (camera duplicate suppression may ignore it; manual input tests backend replay rejection).
- Hold a copied QR for more than 15 seconds and confirm manual verification denies it.
- Wrong block, non-resident and expired scenarios deny access and record events.
- Five distinct denied requests produce one alert, further requests within cooldown do not add duplicates.
- Changing the gate browser's selected block or request body cannot change its server-bound block. Only local simulation offers a block selector.
- Management update changes the next fresh QR verification, and a student/terminal account cannot perform that update.
- Holiday declaration reaches the dashboard. Alerts move through New → Under Review → Resolved.
- Simulated offline events upload to `offline_demo_events` only. Verified entry counts remain unchanged by that upload.
- Phone QR stops renewing offline; background/foreground transitions resume rotation.
- Deployed HTTPS camera and audio work on the actual presentation devices.
