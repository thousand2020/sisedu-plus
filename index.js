const express = require("express");
const { createProxyMiddleware, responseInterceptor } = require("http-proxy-middleware");

const TARGET = "https://www.sisedu.org";
const app = express();

app.use("/plus", express.static("public"));

app.use(
    "/",
    createProxyMiddleware({
        target: TARGET,
        changeOrigin: true,
        autoRewrite: true,          //fix redirect location header(s)
    cookieDomainRewrite: "",    //yummy cookies
    selfHandleResponse: true,   //need for editing responses
    on: {
        //tricks sveltekit into thinking its the portal
        proxyReq: (proxyReq, req) => {
            if (req.headers.origin) proxyReq.setHeader("origin", TARGET);
            if (req.headers.referer) proxyReq.setHeader("referer", TARGET + req.url);
        },

        proxyRes: responseInterceptor(async (buffer, proxyRes, req, res) => {
            //loose the headers that would block injected code
            res.removeHeader("content-security-policy");
            res.removeHeader("x-frame-options");

            //keep redirects inside the proxy
            const loc = res.getHeader("location");
            if (loc) {
                try {
                    const u = new URL(String(loc), TARGET);
                    if (u.host === new URL(TARGET).host) {
                        res.setHeader("location", u.pathname + u.search + u.hash);
                    }
                } catch (e) {}
            }

            const type = String(proxyRes.headers["content-type"] || "");
            const isHtml = type.includes("text/html");
            const isJs = type.includes("javascript");
            if (!isHtml && !isJs) return buffer;

            const publicUrl = "https://" + req.headers.host;
            let body = buffer.toString("utf8");
            body = body.split(TARGET).join(publicUrl); //point absolute links at the proxy

            if (isHtml) {
                const inject =
                '<link rel="stylesheet" href="/plus/skin.css">' +
                '<script src="/plus/skin.js" defer></script>';
                body = body.replace("</head>", inject + "</head>");
            }
            return body;
        }),
    },
    })
);

app.listen(process.env.PORT || 3000);
