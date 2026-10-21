"use strict";

const http = require("http");

const DEFAULT_PORT = 3000;
const MIN_PORT = 1024;
const MAX_PORT = 65535;
const HELLO_PATH = "/hello";
const HELLO_BODY = "Hello world";
const NOT_FOUND_BODY = "Not Found";
const TEXT_PLAIN = "text/plain";
const SHUTDOWN_MESSAGE = "Server shutting down";

// resolvePort(rawValue): returns the validated port, DEFAULT_PORT when absent, or null.
function resolvePort(rawValue) {
  if (rawValue === undefined || rawValue === "") {
    return DEFAULT_PORT;
  }

  const parsed = Number(rawValue);
  if (!Number.isInteger(parsed) || parsed < MIN_PORT || parsed > MAX_PORT) {
    return null;
  }

  return parsed;
}

// logRequest(req): writes one stdout line - ISO-8601 UTC timestamp, method and url.
// The url is logged verbatim and never decoded, so a client cannot forge log lines.
function logRequest(req) {
  console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
}

// getRequestPath(req): returns the raw request target up to the first "?".
// The query string is dropped before matching and the target is never resolved as a URL,
// because URL resolution rewrites "//x/hello" and "/a/../hello" to the matched "/hello".
function getRequestPath(req) {
  const queryIndex = req.url.indexOf("?");

  return queryIndex === -1 ? req.url : req.url.slice(0, queryIndex);
}

// sendPlainText(res, statusCode, body): writes a plain-text response and ends it.
// This form lets Node set Content-Length; res.writeHead would frame it as chunked.
function sendPlainText(res, statusCode, body) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", TEXT_PLAIN);
  res.end(body);
}

// handleRequest(req, res): the "request" listener - log first, then route.
// Only GET on HELLO_PATH matches; every other request reaches the 404 catch-all.
function handleRequest(req, res) {
  logRequest(req);

  const path = getRequestPath(req);
  if (req.method === "GET" && path === HELLO_PATH) {
    sendPlainText(res, 200, HELLO_BODY);
  } else {
    sendPlainText(res, 404, NOT_FOUND_BODY);
  }
}

// handleServerError(error, port): the server's "error" listener, so a failed bind
// reports an actionable stderr message instead of throwing an uncaught exception.
function handleServerError(error, port) {
  if (error.code === "EADDRINUSE") {
    console.error(
      `Failed to start server: port ${port} is already in use. Stop the process ` +
        `using that port or set PORT to a free port between ${MIN_PORT} and ${MAX_PORT}.`
    );
  } else {
    console.error(
      `Failed to start server on port ${port}: ${error.code}. Check that the ` +
        "port is free and permitted for this process."
    );
  }

  process.exitCode = 1;
}

// handleShutdown(server): the process "SIGINT" handler - log, stop accepting, release.
// exitCode is set in the close callback rather than calling process.exit, which could
// truncate the shutdown line; closeIdleConnections() needs Node v18.2.0, so it is guarded.
function handleShutdown(server) {
  console.log(SHUTDOWN_MESSAGE);

  server.close(() => {
    process.exitCode = 0;
  });

  if (typeof server.closeIdleConnections === "function") {
    server.closeIdleConnections();
  }
}

// startServer(): resolves PORT, wires the listeners, then binds the port and logs the
// start-up line; the listeners go on before listen() so a failed bind is still reported.
function startServer() {
  const rawPort = process.env.PORT;
  const port = resolvePort(rawPort);

  if (port === null) {
    console.error(
      `Invalid PORT value "${rawPort}": PORT must be an integer ` +
        `between ${MIN_PORT} and ${MAX_PORT}.`
    );
    process.exitCode = 1;

    return;
  }

  const server = http.createServer(handleRequest);

  server.on("error", (error) => handleServerError(error, port));
  process.on("SIGINT", () => handleShutdown(server));

  server.listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });
}

// A console sink can fail - a full disk or a closed pipe - and the stream's "error"
// event has no listener by default, which aborts the process with a stack trace.
// Report the failed write once on stderr and keep serving, so the request pipeline
// continues and the shutdown path still reaches the contracted exit status.
let consoleWriteErrorReported = false;

// reportConsoleWriteError(error): reports the first failed console write and marks it
// reported, so a permanently broken sink neither floods stderr nor recurses.
function reportConsoleWriteError(error) {
  if (consoleWriteErrorReported) {
    return;
  }

  consoleWriteErrorReported = true;
  console.error(
    `Failed to write to the console: ${error.message}. Log output is lost until ` +
      "the console accepts writes again; the server keeps running."
  );
}

process.stdout.on("error", reportConsoleWriteError);
process.stderr.on("error", reportConsoleWriteError);

startServer();
