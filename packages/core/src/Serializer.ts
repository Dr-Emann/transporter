import * as JsFunction from "./JsFunction.js";

const identity = {
  serialize: JsFunction.identity,
  deserialize: JsFunction.identity
};

type Serializer<IO, TransferFormat = IO> = {
  deserialize(value: TransferFormat): IO;
  serialize(value: IO): TransferFormat;
};

export { type Serializer, identity };
