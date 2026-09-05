# Remote media cache

Existing mirrored author media retained for continuity. New submissions link to
publisher-hosted media. Serving a local cache does not guarantee reachability
in any particular country.

Files are byte-identical copies of the upstream artifacts. Upstream links and
licensing live in each behavior descriptor under `registry/behaviors/`
(`sources` section). Behavior → upstream mapping:

| File                 | Upstream                                                                    |
| -------------------- | --------------------------------------------------------------------------- |
| `courier.mp4`        | selinayfilizp/microduck-courier @ `2cd9da8d1` `artifacts/courier-policy-track.mp4` |
| `courier.gif`        | selinayfilizp/microduck-courier @ `2cd9da8d1` `artifacts/courier-policy.gif`       |
| `flamingo-cycle.mp4` | RemiFabre/microduck-flamingo-cycle @ `6646428` `media/preview.mp4`           |
| `rough-walk-e.mp4`   | RemiFabre/microduck-rough-walk-e @ `fa7b27ee` `media/preview.mp4`            |
| `rough-walk-g.mp4`   | RemiFabre/microduck-rough-walk-g @ `242876a0` `media/preview.mp4`            |
| `running.mp4`        | HannesVonEssen/microduck-running @ `d839a07c` `media/preview.mp4`            |

If you are an upstream author and want your media removed or updated, open an
issue or PR — the canonical artifacts remain on your repo; these are caches,
not forks.
