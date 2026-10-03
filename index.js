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
            proxyRes: responseInterceptor(async (buffer, proxyRes) => {
                //loose the headers that would block injected code
                delete proxyRes.headers["content-security-policy"];
                delete proxyRes.headers["x-frame-options"];

                const type = proxyRes.headers["content-type"] || "";
                if (!type.includes("text/html")) return buffer;

                let html = buffer.toString("utf8");
                html = html.split(TARGET).join(""); //make absolute links relative
                const inject =
                '<link rel="stylesheet" href="/plus/skin.css">' +
                '<script src="/plus/skin.js" defer></script>';
                return html.replace("</head>", inject + "</head>");
            }),
        },
    })
);

app.listen(process.env.PORT || 3000);
