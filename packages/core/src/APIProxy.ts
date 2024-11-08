import * as Subscription from "./Subscription.js";
import * as Procedure from "./Procedure.js";
import * as Observable from "./Observable/index.js";

type APIProxy<API> = {
  [K in keyof API]: API[K] extends Subscription.Subscription<infer I>
    ? Observable.t<I>
    : API[K] extends Procedure.Procedure<infer P>
      ? P
      : APIProxy<API[K]>;
};

const APIProxy = <API>() => {
  return {
    // _tag: "APIProxy"
  } as APIProxy<API>;
};

export { APIProxy };
