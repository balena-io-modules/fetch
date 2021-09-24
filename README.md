## @balena/fetch

This module implements fetch with the [happy eyeballs](https://en.wikipedia.org/wiki/Happy_Eyeballs) algorithm.

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