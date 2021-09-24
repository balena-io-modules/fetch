## @balena/fetch

This module implements fetch with the [happy eyeballs](https://en.wikipedia.org/wiki/Happy_Eyeballs) algorithm, which improves connection performance by try to connect to IPv4 and IPv6 addresses for a host concurrently. This library will also iterate over all endpoints returned by DNS, ensuring that we always get a connection as long as one server is reachable.

This means it checks for both IPv4 and IPv6 addresses before giving up on making a connection.

It remembers the last successful address family and uses that for subsequent connections.

It is also browser/node safe.

This is meant to replace all naked calls to `http.request`, `fetch`, `node-fetch`, `@balena/request`, etc.


This was created for Balena use, but it would probably be a good idea if everyone used it.

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
