import * as Message from "./Message.js";
import * as JsFunction from "./JsFunction.js";

const identity = {
  serialize: JsFunction.identity,
  deserialize: JsFunction.identity
};

type Serializer<IO = unknown, TransferFormat = IO> = {
  deserialize(value: TransferFormat): Message.t<IO>;
  serialize(value: Message.t<IO>): TransferFormat;
};

export { type Serializer, identity };
