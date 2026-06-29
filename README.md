# undici HTTP/2 + `Expect: 100-continue` hang

Minimal reproduction of an undici bug: over HTTP/2, when a server answers a
request carrying `Expect: 100-continue` with a **final response** instead of
`100 (Continue)`, the request **hangs** — undici withholds the body correctly
but never delivers the response and never completes.

RFC 9110 [Section 10.1.1](https://www.rfc-editor.org/rfc/rfc9110.html#section-10.1.1)
permits a server to send a final status determinable from the header fields
(success, redirect, or error) in place of `100 (Continue)`; the client must then
deliver that response and not send the body. undici delivers nothing.

## Run

```sh
npm install
npm start
```

- **Buggy undici (8.5.0):** prints `FAIL: request hung ...` after 5s.
- **Fixed undici:** prints `PASS: status=401 ... bodyBytesSentToServer=0`.

## Environment

- undici 8.5.0
- Node.js v25 (reproduces on current LTS too)
- HTTP/2 only (HTTP/1.1 has separate handling)
