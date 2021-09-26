## @balena/fetch

This is Balena's implementation of `fetch`, but others could find it useful too.

Features:
* [happy eyeballs](#happy-eyeballs-algorithm)
  * Attempt connections to all addresses provided [`getaddrinfo`](https://man7.org/linux/man-pages/man3/getaddrinfo.3.html), not just the first one
  * Attempt connection to both IPv6 and IPv4 concurrently for dual-stack hosts
  * Remember last successful connection type and try that first for next request
* browser/node safe
* ...more to come

This is meant to replace all naked calls to `http.request`, `fetch`, `node-fetch`, `@balena/request`, etc.


### Installation

```
npm i --save @balena/fetch
```

### Usage

```js
import fetch from '@balena/fetch';

const resp = await fetch('https://api.balena-cloud.com/ping');
console.log(await resp.text()) // <= OK
```