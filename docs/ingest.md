# Pushing a snapshot

The raw list payload is past Vercel's 4.5 MB request-body ceiling, so a push
must be **gzipped** — the route sniffs the magic number, so the
`Content-Encoding` header is optional. From anywhere with an Iranian IP:

```sh
UA="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
WELCOME="https://eauc.setadiran.ir/eauc/welcome.action?gateway=setad"

# welcome.action first: the list endpoint answers a session-less request with
# a Struts error page, not JSON.
curl -s -c /tmp/jar -A "$UA" "$WELCOME" -o /dev/null

curl -s -b /tmp/jar -A "$UA" -H "Referer: $WELCOME" \
  -H "X-Requested-With: XMLHttpRequest" \
  "https://eauc.setadiran.ir/eauc/mainEstate-Load.action?rows=5000&page=1" \
  | gzip -c \
  | curl -s -X POST https://the-setad-auctions.vercel.app/api/ingest \
      -H "Authorization: Bearer $CRON_SECRET" \
      -H "Content-Type: application/json" \
      -H "Content-Encoding: gzip" --data-binary @-
```

A success answers `{"ok":true,"records":1051,...}`. The daily driver is an iOS
Shortcut doing the same two requests on a 07:00 automation, with a
**Make Archive** step in between to gzip the payload.

As a bookmarklet, run from a tab already on `eauc.setadiran.ir` (same-origin, so
no CORS and the session cookie comes along):

```js
javascript:(async()=>{const d=await(await fetch('/eauc/mainEstate-Load.action?rows=5000&page=1',{headers:{'x-requested-with':'XMLHttpRequest'}})).blob();const b=await new Response(d.stream().pipeThrough(new CompressionStream('gzip'))).blob();const r=await fetch('https://the-setad-auctions.vercel.app/api/ingest',{method:'POST',headers:{'authorization':'Bearer YOUR_CRON_SECRET','content-encoding':'gzip'},body:b});alert(await r.text())})()
```

To push to staging, swap the host for `the-auctions-staging.vercel.app` and use
the staging `CRON_SECRET` (currently identical). See [staging.md](staging.md).
