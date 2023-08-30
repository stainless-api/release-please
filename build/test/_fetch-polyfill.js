"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// nock, used to mock HTTP requests, currently does not support the undici network stack from node v18+. As a
// consequence node native fetch isn't supported either and won't be intercepted.
// See https://github.com/nock/nock/issues/2183 and https://github.com/nock/nock/issues/2397.
//
// This file replace the native fetch by the polyfill node-fetch when node v18 is run with the flag
// --no-experimental-fetch. That's only intended as a temporary solution, the experimental flag is expected to be
// removed starting from node v22.
const node_fetch_1 = require("node-fetch");
/* eslint-disable @typescript-eslint/no-explicit-any */
if (!globalThis.fetch) {
    globalThis.fetch = node_fetch_1.default;
    globalThis.Headers = node_fetch_1.Headers;
    globalThis.Request = node_fetch_1.Request;
    globalThis.Response = node_fetch_1.Response;
}
//# sourceMappingURL=_fetch-polyfill.js.map