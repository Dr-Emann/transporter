import * as JsFunction from "./JsFunction.js";
import * as JsObject from "./JsObject.js";
import * as Procedure from "./Procedure.js";
import * as Serializer from "./Serializer.js";
import * as Subscription from "./Subscription.js";

type RestrictIO<T, IO> = {
  [K in keyof T]: T[K] extends Subscription.Subscription<any>
    ? Subscription.Subscription<
        JsFunction.Bivariant<
          (...args: [...IO[], Subscription.Observer<IO>]) => Promise<{
            unsubscribe: Subscription.Unsubscribe;
          }>
        >
      >
    : T[K] extends Procedure.Procedure<any>
      ? Procedure.Procedure<
          JsFunction.Bivariant<(...input: IO[]) => Promise<IO>>
        >
      : T[K] extends Record<any, any>
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
  Procedure.Procedure<any> | Subscription.Subscription<any>
>;

type APIContract<T, IO, TransferFormat> = {
  api: Opaque<T>;
  serializer: Serializer.Serializer<IO, TransferFormat>;
  _tag: "APIContract";
};

// Serializer should be required if IO does not extend TransferFormat
const APIContract = <T, IO, TransferFormat>(
  api: T,
  {
    serializer = Serializer.identity as Serializer.Serializer<
      IO,
      TransferFormat
    >
  }: { serializer: Serializer.Serializer<IO, TransferFormat> }
) => {
  return {
    api: api as Opaque<T>,
    serializer,
    _tag: "APIContract"
  } satisfies APIContract<T, IO, TransferFormat>;
};

export { type Infer, type RestrictIO, APIContract };
