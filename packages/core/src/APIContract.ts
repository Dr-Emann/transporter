import * as Future from "./Future.js";
import * as JsFunction from "./JsFunction.js";
import * as JsObject from "./JsObject.js";
import * as Observable from "./Observable/Observable.js";
import * as Procedure from "./Procedure.js";
import * as Subscription from "./Subscription.js";

type RestrictIO<T, IO> = {
  [K in keyof T]: T[K] extends Subscription.Subscription
    ? JsFunction.Bivariant<
        (
          ...args: [
            ...IO[],
            observer: Subscription.Observer<never> & Subscription.Observer<IO>
          ]
        ) => Future.Future<Observable.Subscription, never>
      >
    : T[K] extends Procedure.Procedure
      ? JsFunction.Bivariant<(...args: IO[]) => Future.Future<IO, IO>>
      : RestrictIO<T[K], IO>;
};

type Infer<
  Contract,
  Type extends "API" | "IO" | "TransferFormat"
> = Contract extends APIContract<infer API, infer IO, infer TransferFormat>
  ? { API: API; IO: IO; TransferFormat: TransferFormat }[Type]
  : never;

type Opaque<T> = JsObject.PickDeep<
  T,
  Procedure.Procedure | Subscription.Subscription
>;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
type APIContract<T, IO, TransferFormat> = {
  api: T;
  _tag: "APIContract";
};

const APIContract = <
  const T extends RestrictIO<Opaque<T>, IO>,
  const IO,
  const TransferFormat
>(
  api: T
): APIContract<Opaque<T>, IO, TransferFormat> => {
  return {
    api: api as Opaque<T>,
    _tag: "APIContract"
  };
};

export { type Infer, type Opaque, type RestrictIO, APIContract };
