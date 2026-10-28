//edited to work with cloudflare worker
const TARGET = "https://www.sisedu.org";

export default {
    async fetch(req, env) {
        const url = new URL(req.url);

        //serve skin.css / skin.js / early.js from /plus/ (idk if i added it yet i forgot) 
        if (url.pathname.startsWith("/plus/")) {
            return env.ASSETS.fetch(req);
        }

        //build the request going to the school site
        const upstreamUrl = TARGET + url.pathname + url.search;
        const upstreamReq = new Request(upstreamUrl, req);

        //make the school site think requests come from itself (fixes sveltekit origin checks) (& a epic prank)
        upstreamReq.headers.set("origin", TARGET);
        if (req.headers.get("referer")) {
            upstreamReq.headers.set("referer", TARGET + url.pathname);
        }

        let res = await fetch(upstreamReq, { redirect: "manual" });

        //keep redirects inside the proxy
        const loc = res.headers.get("location");
        if (loc) {
            try {
                const u = new URL(loc, TARGET);
                if (u.host === new URL(TARGET).host) {
                    const headers = new Headers(res.headers);
                    headers.set("location", u.pathname + u.search + u.hash);
                    res = new Response(res.body, { status: res.status, headers });
                }
            } catch (e) {}
        }

        const type = res.headers.get("content-type") || "";
        const isHtml = type.includes("text/html");
        const isJs = type.includes("javascript");

        //non html/js (images, fonts, etc) just pass through, headers loosened
        if (!isHtml && !isJs) {
            const headers = new Headers(res.headers);
            headers.delete("content-security-policy");
            headers.delete("x-frame-options");
            return new Response(res.body, { status: res.status, headers });
        }

        const publicUrl = "https://" + url.host;
        let body = await res.text();
        body = body.split(TARGET).join(publicUrl); //make absolute links point at the proxy

        if (isHtml) {
            //early.js (idk if i added it yet i forgot) goes first in <head>, so it runs before the portal's own scripts
            body = body.replace(/<head[^>]*>/, (m) => m + '<script src="/plus/early.js"></script>');

            //skin files go at the end of <head>
            const inject =
                '<link rel="stylesheet" href="/plus/skin.css">' +
                '<script src="/plus/skin.js" defer></script>';
            body = body.replace("</head>", inject + "</head>");
        }

        const headers = new Headers(res.headers);
        headers.delete("content-security-policy");
        headers.delete("x-frame-options");
        headers.delete("content-length"); //body length changed since i edited it
        return new Response(body, { status: res.status, headers });
    },
};
