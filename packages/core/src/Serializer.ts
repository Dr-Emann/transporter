import * as Message from "./Message.js";
import * as JsFunction from "./JsFunction.js";

const identity = {
  serialize: JsFunction.identity,
  deserialize: JsFunction.identity
};

type Serializer<IO extends Message.t<never>, TransferFormat = IO> = {
  deserialize(value: TransferFormat): IO;
  serialize(value: IO): TransferFormat;
};

export { type Serializer, identity };
