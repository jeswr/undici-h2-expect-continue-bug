'use strict'

// Minimal reproduction of an undici HTTP/2 client bug.
//
// When a server answers a request carrying `Expect: 100-continue` with a FINAL
// response (here 401) instead of `100 (Continue)` — which RFC 9110 Section
// 10.1.1 explicitly permits — undici correctly withholds the request body but
// never delivers the response. The request hangs.
//
//   npm install && npm start
//
// Buggy undici (<= 8.5.0):  "FAIL: request hung ..." after 5s.
// Fixed undici:             "PASS: status=401 ... bodyBytesSentToServer=0".

const http2 = require('node:http2')
const { once } = require('node:events')
const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const { Client } = require('undici')

const key = readFileSync(join(__dirname, 'key.pem'))
const cert = readFileSync(join(__dirname, 'cert.pem'))

async function main () {
  let bodyBytesReceived = 0

  const server = http2.createSecureServer({ key, cert })
  server.on('stream', (stream) => {
    stream.on('data', (chunk) => { bodyBytesReceived += chunk.length })
    // Answer from the request headers alone; do NOT send 100 (Continue).
    stream.respond({ ':status': 401, 'content-type': 'text/plain' })
    stream.end('denied')
  })
  await once(server.listen(0), 'listening')

  const client = new Client(`https://localhost:${server.address().port}`, {
    allowH2: true,
    connect: { rejectUnauthorized: false }
  })

  const hang = setTimeout(() => {
    console.error('FAIL: request hung — undici did not deliver the early 401 within 5s')
    process.exit(1)
  }, 5000)

  const res = await client.request({
    path: '/',
    method: 'POST',
    headers: { 'content-type': 'text/plain' },
    body: 'x'.repeat(1024),
    expectContinue: true
  })
  const text = await res.body.text()
  clearTimeout(hang)

  console.log(`PASS: status=${res.statusCode} body=${JSON.stringify(text)} bodyBytesSentToServer=${bodyBytesReceived}`)
  await client.close()
  server.close()
  process.exit(res.statusCode === 401 && bodyBytesReceived === 0 ? 0 : 3)
}

main().catch((err) => { console.error(err); process.exit(2) })
