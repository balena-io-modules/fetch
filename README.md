## @balena/fetch

This is an browser/node safe implementation of fetch which implements the [happy eyeballs algorithm](#Happy_Eyeballs_Algorithm).

This module implements fetch with the , which .

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

### Happy Eyeballs Algorithm

*Note: The [source code for this algorithm](./src/happy-eyeballs.ts) is fully commented.*

Happy eyeballs improves connection performance/reliability by attempting a connection to all addresses provided by [`getaddrinfo`](https://man7.org/linux/man-pages/man3/getaddrinfo.3.html)

to connect to IPv4/IPv6 dual-stack hosts concurrently, or whichever family is available for single-stack hosts.


All  resolved by  until a connection is accepted by an endpoint.




If only one address family is available, it will it

This library will also iterate over all endpoints returned by DNS, ensuring that we always get a connection as long as one server is reachable


Upon

 lastSuccessfulCtFamily remembers the family of the last successful connection
 It try this family for this host from there on out.
//
// If the host hasn't seen a valid connection, it will try both families concurrently
//
// If only one family is resolved, it just tries
//
// We don't want to save the entire last IP, because netadmins will sometimes
// use multihosted servers as a round robin. We still want to keep the order
// of IP addresses of the same family random.