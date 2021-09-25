// @ts-ignore
import {fetch as fetchProxy} from 'whatwg-fetch';
export default typeof window !== "undefined" && window.fetch || fetchProxy as WindowOrWorkerGlobalScope["fetch"];