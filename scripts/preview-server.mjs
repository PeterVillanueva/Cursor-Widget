import http from "node:http";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const rendererDir = path.join(root, "dist", "renderer");
const port = Number(process.env.PORT ?? 4177);

const DEMO = {
  status: "ready",
  snapshot: {
    planName: "PRO",
    cursorModels: {
      label: "Cursor Models",
      usedPercent: 72,
      remainingPercent: 28,
      usedPercentLabel: 72,
      remainingPercentLabel: 28,
      tone: "ok",
    },
    otherModels: {
      label: "Other Models",
      usedPercent: 86,
      remainingPercent: 14,
      usedPercentLabel: 86,
      remainingPercentLabel: 14,
      tone: "warn",
    },
    resetsAtIso: new Date(Date.now() + 12 * 24 * 60 * 60 * 1000).toISOString(),
    fetchedAtIso: new Date(Date.now() - 18_000).toISOString(),
    hitLimit: false,
    limitMessage: null,
  },
};

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".map": "application/json; charset=utf-8",
};

if (!existsSync(path.join(rendererDir, "overlay.html"))) {
  console.error("dist/renderer/overlay.html missing. Run npm run build first.");
  process.exit(1);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? "/", `http://127.0.0.1:${port}`);
  if (url.pathname === "/preview-bridge.js") {
    const body = `window.overlay = {
  getState: async () => (${JSON.stringify(DEMO)}),
  refresh: async () => {},
  openDashboard: async () => { window.open("https://cursor.com/dashboard/spending", "_blank"); },
  quit: async () => { window.close(); },
  onState: (handler) => { handler(${JSON.stringify(DEMO)}); return () => {}; },
};`;
    res.writeHead(200, { "Content-Type": "text/javascript; charset=utf-8" });
    res.end(body);
    return;
  }

  const relative =
    url.pathname === "/" ? "overlay.html" : url.pathname.replace(/^\//, "");
  const filePath = path.normalize(path.join(rendererDir, relative));
  if (!filePath.startsWith(rendererDir) || !existsSync(filePath)) {
    res.writeHead(404).end("Not found");
    return;
  }

  let content = readFileSync(filePath);
  const ext = path.extname(filePath);
  if (ext === ".html") {
    let html = content.toString("utf8");
    html = html.replace(
      "</head>",
      '  <script src="/preview-bridge.js"></script>\n  </head>',
    );
    content = Buffer.from(html, "utf8");
  }

  res.writeHead(200, {
    "Content-Type": MIME[ext] ?? "application/octet-stream",
  });
  res.end(content);
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Preview: http://127.0.0.1:${port}/`);
});
