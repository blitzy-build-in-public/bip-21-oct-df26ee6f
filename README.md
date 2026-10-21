# nodejs-tutorial-hello-world

A minimal, dependency-free Node.js HTTP server written as a beginner tutorial. It exposes one route,
`GET /hello`, plus a catch-all that answers `404` to every other request the handler receives. Both
respond as plain text. The server rests on Node.js's built-in `http` module alone — no framework,
no middleware, no routing library, and no dependency of any kind.

Minimal does not mean incomplete. `server.js` is the entire program, and reading it end to end shows
the full lifecycle of an HTTP service: the port is resolved and validated, the port is bound, every
accepted request is logged, a route is matched, a response is written, and CTRL+C shuts the server
down cleanly. It fits in one file you can read in one sitting.

## Prerequisites

- **Node.js v18.0.0 or higher** — `package.json` declares `"engines": { "node": ">=18.0.0" }`.

Nothing else is needed: no other runtime, no build or test tool, no global package. Check the
version you have with:

```bash
node --version
```

## Installation

There is no installation step. The project declares no dependencies and no dev dependencies, so
there is nothing to download, nothing to build and no `npm install` to run. Once Node.js is
installed, the server is ready to start.

## Running the server

Start it from the project root with either entry point:

```bash
node server.js
```

```bash
npm start
```

`npm start` runs `node server.js`, as declared by `"scripts": { "start": "node server.js" }`.

The server binds its port at start-up and then stays in the foreground, writing to your terminal
until you interrupt it. When it is ready it prints:

```text
Server listening on port 3000
```

## Testing the server

With the server running, request the one route:

```bash
curl http://localhost:3000/hello
```

Add `-i` to see the status line and headers as well as the body:

```bash
curl -i http://localhost:3000/hello
```

Then request a path that does not exist, which demonstrates the catch-all:

```bash
curl -i http://localhost:3000/invalid
```

Every accepted request is also written as one line to the terminal the server runs in, before it is
routed, so unmatched requests are logged too.

## Expected output

### `GET /hello` — 200

```text
HTTP/1.1 200 OK
Content-Type: text/plain
Date: Thu, 15 Jan 2026 10:20:30 GMT
Connection: keep-alive
Keep-Alive: timeout=5
Content-Length: 11

Hello world
```

### Any other method or path the handler receives — 404

```text
HTTP/1.1 404 Not Found
Content-Type: text/plain
Date: Thu, 15 Jan 2026 10:20:30 GMT
Connection: keep-alive
Keep-Alive: timeout=5
Content-Length: 9

Not Found
```

`Date`, `Connection` and `Keep-Alive` are added by Node.js itself, and the `Date` value is the time
of each response, so it differs from request to request. `Content-Type` is sent verbatim as
`text/plain`. The bodies are exactly `Hello world` (11 bytes) and `Not Found` (9 bytes), with no
trailing newline. A `HEAD` request receives the `404` status and headers without a body.

### Request log lines

Each accepted request produces one stdout line in the format
`[ISO-8601 timestamp] [HTTP method] [request path]`:

```text
2026-01-15T10:20:30.000Z GET /hello
2026-01-15T10:20:31.000Z GET /invalid
2026-01-15T10:20:32.000Z POST /hello
```

The timestamp is UTC with milliseconds, and the URL is printed exactly as received, query string
included.

### Which requests match

Only `GET /hello` returns `Hello world`; every other method and path the request handler receives
returns `Not Found`. Four details are worth knowing:

- The query string is removed before the path is compared, so `GET /hello?x=1` returns `200` with
  `Hello world`. No query parameter is ever read.
- A trailing slash is not normalised, so `GET /hello/` returns `404`.
- The request target is compared literally, so `//x/hello`, `http://evil.com/hello` and
  `/a/../hello` all return `404` rather than being interpreted as `/hello`.
- Requests Node.js settles itself never reach the handler, so the catch-all cannot answer them and
  they are not written to the request log: a malformed request target is refused with `400 Bad
  Request`, and a `CONNECT` request — the method that asks for a tunnel, which this server does
  not provide — is closed by Node.js with no response at all. Every request the handler receives
  is answered `200` or `404`.

### Start-up errors

An invalid `PORT` is refused before the server is created. The message goes to stderr and the exit
status is `1`:

```text
Invalid PORT value "abc": PORT must be an integer between 1024 and 65535.
```

If the port is already in use, the failed bind is reported the same way and the exit status is `1`:

```text
Failed to start server: port 3000 is already in use. Stop the process using that port or set PORT to a free port between 1024 and 65535.
```

Any other bind failure reports the code Node gives it:

```text
Failed to start server on port 3000: EACCES. Check that the port is free and permitted for this process.
```

## Shutting down

Stop the server with **CTRL+C** in the terminal where it is running. It prints:

```text
Server shutting down
```

and exits with status `0`. The port is then free, so the server can be started again immediately.

## Configuration: the `PORT` environment variable

The port is read once, at start-up, from the `PORT` environment variable.

- **Default:** `3000`, used when `PORT` is unset or empty.
- **Valid values:** an integer between `1024` and `65535`.
- **Read once:** changing `PORT` afterwards has no effect on a server that is already running.

To use another port, set `PORT` on the same command line:

```bash
PORT=8080 node server.js
```

The server confirms the port it actually bound:

```text
Server listening on port 8080
```

and requests then go to that port:

```bash
curl http://localhost:8080/hello
```

A value that is not an integer in that range — for example `abc`, `3000.5`, `80` or `70000` — is
refused with the message shown above on stderr and exit status `1`. Ports below `1024` are
privileged and are refused by the same range check, so there is no way to bind one by default.
