import * as APIContract from "./APIContract.js";
import * as JsFunction from "./JsFunction.js";
import * as Procedure from "./Procedure.js";
import * as Serializer from "./Serializer.js";
import * as Subscription from "./Subscription.js";

type DataContract<IO, TransferFormat> = {
  APIContract<T extends APIContract.RestrictIO<T, IO>>(
    api: T
  ): APIContract.APIContract<T, IO, TransferFormat>;
  Procedure<T extends JsFunction.Bivariant<(...input: IO[]) => Promise<IO>>>(
    procedure: T
  ): Procedure.Procedure<T>;
  Subscription<
    T extends JsFunction.Async,
    Args extends readonly [...IO[], observer: Subscription.Observer<IO>]
  >(
    subscription: T &
      JsFunction.Bivariant<
        (...args: Args) => Promise<{ unsubscribe: Subscription.Unsubscribe }>
      >
  ): Subscription.Subscription<T>;
  _tag: "DataContract";
};

type DataContractOptions<IO, TransferFormat> = {
  serializer?: Serializer.Serializer<IO, TransferFormat>;
};

const DataContract = <IO, TransferFormat = IO>({
  serializer = Serializer.identity as Serializer.Serializer<IO, TransferFormat>
}: DataContractOptions<IO, TransferFormat> = {}): DataContract<
  IO,
  TransferFormat
> => {
  return {
    APIContract<T>(api: T) {
      return APIContract.APIContract<T, IO, TransferFormat>(api, {
        serializer
      });
    },
    Procedure(...args) {
      return Procedure.Procedure(...args);
    },
    Subscription(...args) {
      return Subscription.Subscription(...args);
    },
    _tag: "DataContract"
  } satisfies DataContract<IO, TransferFormat>;
};

export { DataContract };
