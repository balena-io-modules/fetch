import { test } from "../test/test";
import { getAddrInfo } from "./he-connect";

test.manual('getaddrinfo', async () => {
  // check and see what the output getAddrInfo
  // have to test this manually, because this will vary based on location
  const addrs = await getAddrInfo('api.balena-cloud.com');
  for (const addr of Array.from(addrs)) {
    console.log(addr)
  }
})
