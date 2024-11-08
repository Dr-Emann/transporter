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
  Subscription<T extends IO>(): Subscription.Subscription<T>;
  _tag: "DataContract";
};

const DataContract = <IO, TransferFormat = IO>(
  serializer: Serializer.Serializer<
    IO,
    TransferFormat
  > = Serializer.identity as Serializer.Serializer<IO, TransferFormat>
): DataContract<IO, TransferFormat> => {
  return {
    APIContract<T>(api: T) {
      return APIContract.APIContract<T, IO, TransferFormat>(api);
    },
    Procedure(procedure) {
      return Procedure.Procedure(procedure);
    },
    Subscription() {
      return Subscription.Subscription();
    },
    _tag: "DataContract"
  } satisfies DataContract<IO, TransferFormat>;
};

export { DataContract };
