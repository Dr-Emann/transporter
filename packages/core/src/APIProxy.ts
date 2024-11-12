import * as Subscription from "./Subscription.js";
import * as Procedure from "./Procedure.js";

type APIProxy<API> = {
  [K in keyof API]: API[K] extends Subscription.Subscription<any>
    ? API[K]
    : API[K] extends Procedure.Procedure<any>
      ? API[K]
      : APIProxy<API[K]>;
};

const APIProxy = <API>() => {
  return {
    // _tag: "APIProxy"
  } as APIProxy<API>;
};

export { APIProxy };
