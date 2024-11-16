import * as Future from "./Future.js";
import * as JsFunction from "./JsFunction.js";
import * as JsObject from "./JsObject.js";
import * as Observable from "./Observable/Observable.js";
import * as Procedure from "./Procedure.js";
import * as Serializer from "./Serializer.js";
import * as Subscription from "./Subscription.js";

type RestrictIO<T, IO> = {
  [K in keyof T]: T[K] extends Subscription.Subscription
    ? (
        ...args: [...IO[], observer: Subscription.Observer<IO>]
      ) => Future.Future<Observable.Subscription, IO>
    : T[K] extends Procedure.Procedure
      ? JsFunction.Bivariant<(...args: IO[]) => Future.Future<IO, IO>>
      : T[K] extends Record<PropertyKey, unknown>
        ? RestrictIO<T[K], IO>
        : T[K];
};

// type ExtractIO<T> = T extends Subscription.Subscription<infer I>
//   ? I
//   : T extends Procedure.Procedure<infer F>
//     ? F extends (...input: infer I) => Promise<infer O>
//       ? I[number] | O
//       : never
//     : never;

// type InferIO<T> = ExtractIO<
//   JsObject.ExtractDeep<
//     T,
//     Subscription.Subscription<any> | Procedure.Procedure<any>
//   >
// >;

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

type APIContract<T, IO, TransferFormat> = {
  api: Opaque<T>;
  serializer: Serializer.Serializer<IO, TransferFormat>;
  _tag: "APIContract";
};

type Options<IO, TransferFormat> = {
  serializer: Serializer.Serializer<IO, TransferFormat>;
};

const APIContract = <
  const T extends RestrictIO<T, IO>,
  const IO,
  const TransferFormat
>(
  api: T,
  ...options: [IO] extends [TransferFormat] ? [] : [Options<IO, TransferFormat>]
): APIContract<T, IO, TransferFormat> => {
  const [
    {
      serializer = Serializer.identity as Serializer.Serializer<
        IO,
        TransferFormat
      >
    } = {} as Options<IO, TransferFormat>
  ] = options;

  return {
    api: api as Opaque<T>,
    serializer,
    _tag: "APIContract"
  };
};

export { type Infer, type Options, type RestrictIO, APIContract };
