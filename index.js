import 'dotenv/config';
import express from "express";
import { createServer } from "node:http";
import { uvPath } from "@titaniumnetwork-dev/ultraviolet";
import { createBareServer } from "@tomphttp/bare-server-node";
import { epoxyPath } from "@mercuryworkshop/epoxy-transport";
import { libcurlPath } from "@mercuryworkshop/libcurl-transport";
import { bareModulePath } from "@mercuryworkshop/bare-as-module3";
import { baremuxPath } from "@mercuryworkshop/bare-mux/node";
import wisp from "wisp-server-node";

const bare = createBareServer("/bare/");
const app = express();
const cache = new Map();
const CACHE_TTL = 300000;

app.use(express.json());
app.use(express.static("public"));
app.use("/uv/", express.static(uvPath));
app.use("/epoxy/", express.static(epoxyPath));
app.use("/libcurl/", express.static(libcurlPath));
app.use("/bareasmodule/", express.static(bareModulePath));
app.use("/baremux/", express.static(baremuxPath));
app.use("/scram/", express.static("scramjet"));

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

app.get(/^\/movie-api\/(.*)/, async (req, res) => {
    try {
        const path = req.params[0];
        const params = new URLSearchParams(req.query);
        params.append('api_key', TMDB_API_KEY);
        const cacheKey = `${path}?${params.toString()}`;
        
        if (cache.has(cacheKey)) {
            const cached = cache.get(cacheKey);
            if (Date.now() - cached.timestamp < CACHE_TTL) {
                return res.json(cached.data);
            }
        }
        
        const url = `${TMDB_BASE_URL}/${path}?${params.toString()}`;
        const response = await fetch(url);
        const data = await response.json();
        
        cache.set(cacheKey, { data, timestamp: Date.now() });
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/chat', async (req, res) => {
    try {
        const response = await fetch('http://localhost:3001/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(req.body),
            timeout: 5000
        });
        
        if (response.ok) {
            const data = await response.json();
            res.json(data);
        } else {
            res.status(response.status).json({ error: "AI service error" });
        }
    } catch (err) {
        res.status(503).json({ error: "AI Bot is offline" });
    }
});

app.get('/api/movie-helper/:endpoint', async (req, res) => {
    try {
        const queryString = req.url.includes('?') ? '?' + req.url.split('?')[1] : '';
        const response = await fetch(`http://localhost:3000/${req.params.endpoint}${queryString}`, {
            timeout: 5000
        });
        
        if (response.ok) {
            const data = await response.json();
            res.json(data);
        } else {
            res.status(response.status).json({ error: "Movie service error" });
        }
    } catch (err) {
        res.status(503).json({ error: "Movie Python API is offline" });
    }
});

const server = createServer();

server.on("request", (req, res) => {
    if (bare.shouldRoute(req)) {
        bare.routeRequest(req, res);
    } else {
        app(req, res);
    }
});

server.on("upgrade", (req, socket, head) => {
    if (bare.shouldRoute(req)) {
        bare.routeUpgrade(req, socket, head);
    } else if (req.url.endsWith("/wisp/")) {
        wisp.routeRequest(req, socket, head);
    } else {
        socket.end();
    }
});

let port = parseInt(process.env.PORT || "");
if (isNaN(port)) port = 8080;

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

function shutdown() {
    console.log("Shutting down gracefully...");
    server.close();
    bare.close();
    process.exit(0);
}

server.listen({ port }, () => {
    console.log(`Server running on port ${port}`);
});

setInterval(() => {
    const now = Date.now();
    for (const [key, value] of cache.entries()) {
        if (now - value.timestamp > CACHE_TTL) {
            cache.delete(key);
        }
    }
}, 600000);