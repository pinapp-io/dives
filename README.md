# @pinapp-io/dives

A pinapp for reef monitoring and dive-site logbooks. Each minted instance
represents one dive site. Divers log dives, coral health observations, species
sightings, and underwater photos. Data anchors to an H3 hex grid so nearby
observations cluster on the map view.

Built on [`@pinapp-io/harness`](https://github.com/pinapp-io/harness).

## Install on epistery-host

### Local dev (symlink)

```bash
ln -s /path/to/pinapp/dives ~/.epistery/.agents/dives
# restart epistery-host
```

After restart, `http://localhost:4080/admin#services` will list **Dives**.
The agent mounts at:

- `/agent/pinapp-io/dives` — landing / mint a new site
- `/agent/pinapp-io/dives/admin` — access control
- `/agent/pinapp-io/dives/{address}` — a specific site's logbook (QR target)

### Production (registry)

Ask the epistery.host operator to add `https://github.com/pinapp-io/dives`
(repo TBD) to the registry at
`https://epistery.host/agent/epistery/registry/admin`. See the
[harness README](https://github.com/pinapp-io/harness#making-a-pinapp-available)
for the full registration story.

## Template

This package contributes only the dive-specific pieces; everything else
(on-chain factory, instance storage, ACL, refinery, admin) comes from the
harness:

- `template/template.json` — site attributes (name, dive shop, region, max
  depth, certification) and event types (dive log, coral, species, photo,
  conditions, note)
- `template/mint.html` — the create form
- `template/app.html` — the mobile PWA-style UI shell
- `template/client/` — ES modules: map view, capture flow, history,
  share-card export, species photo lookup (iNaturalist), state/store
- `template/site-packages/` — seed packages (Anse Chastanet, Kittiwake Wreck)
