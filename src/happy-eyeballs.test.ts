import { lookup } from "dns";
import { promisify } from "util";
import { test } from "../test/test";
import { zip } from "./happy-eyeballs";

test.manual('zip addresses', async () => {
  // check and see what the output getAddrInfo
  // have to test this manually, because this will vary based on location
  const addrs = await zip(await promisify(lookup)('api.balena-cloud.com', {verbatim: true, all: true,}), 6);
  for (const addr of Array.from(addrs)) {
    console.log(addr)
  }
});
