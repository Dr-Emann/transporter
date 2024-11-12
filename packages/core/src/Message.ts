import * as JsArray from "./JsArray.js";
import * as JsObject from "./JsObject.js";
import * as UUID from "./UUID.js";

/**
 * Flattens an intersection type into a single type.
 */
type FlattenIntersection<T> = T extends object ? { [K in keyof T]: T[K] } : T;

/**
 * The name of the Transporter protocol is the constant "transporter".
 */
export const protocol = "transporter";

/**
 * The current version of Transporter in semantic versioning. Different versions
 * of Transporter are considered compatible if they have the same major and
 * minor version. Therefore, a server and a client can use different patch
 * versions of transporter.
 *
 * If Transporter receives a message with an incompatible version a warning will
 * be logged to the console. This should hopefully surface any conflicts during
 * development.
 *
 * It is ok for multiple versions of Transporter to exist at runtime as long as
 * clients are using a version compatible with the server they are trying to
 * connect to. For example, a 3rd party dependency could use a different major
 * or minor version of Transporter as long as its servers and clients are using
 * a compatible version.
 */
export const version: Version = "1.1.0";

/**
 * Transporter may send messages with any of these types.
 */
export enum Type {
  Batch = "Batch",
  Call = "Call",
  Error = "Error",
  ObserverComplete = "ObserverComplete",
  ObserverError = "ObserverError",
  ObserverNext = "ObserverNext",
  Return = "Return",
  Subscribe = "Subscribe",
  Subscribed = "Subscribed",
  Unsubscribe = "Unsubscribe",
  Unsubscribed = "Unsubscribed"
}

/**
 * A semantic version string.
 */
export type Version = `${number}.${number}.${number}`;

/**
 * A discriminated union of the different types of messages.
 *
 * While the creation and interpretation of these messages should be
 * considered internal, it is ok to intercept these messages and perform your
 * own encoding on them. By doing so you can create your own protocol stack.
 */
export type Message<IO = unknown> =
  | Batch<IO>
  | Call<IO[]>
  | Error<IO>
  | ObserverComplete
  | ObserverError<IO>
  | ObserverNext<IO>
  | Return<IO>
  | Subscribe<IO>
  | Subscribed
  | Unsubscribe
  | Unsubscribed;

export type { Message as t };

/**
 * All messages sent by Transporter have this shape.
 *
 * Using a type instead of an interface is intentional as a type is a subtype of
 * a type with an index signature but an interface is not. This allows a message
 * to be passed to an encoder of a subprotocol type, with an index signature,
 * without type errors.
 */
type MessageBase = {
  readonly address: string;
  readonly protocol: typeof protocol;
  readonly returnAddress: string;
  readonly traceId: string;
  readonly type: Type;
  readonly version: Version;
};

export type Batch<IO> = FlattenIntersection<
  MessageBase & {
    readonly messages: JsArray.NonEmpty<Exclude<Message<IO>, Batch<IO>>>;
    readonly type: Type.Batch;
  }
>;

/**
 *
 */
export const Batch = <IO>({
  address,
  messages,
  returnAddress,
  traceId = UUID.v4()
}: {
  address: string;
  messages: [
    Exclude<Message<IO>, Batch<IO>>,
    ...Exclude<Message<IO>, Batch<IO>>[]
  ];
  returnAddress: string;
  traceId?: string;
}): Batch<IO> => ({
  address,
  messages,
  protocol,
  returnAddress,
  traceId,
  type: Type.Batch,
  version
});

export type Call<IO> = FlattenIntersection<
  MessageBase & {
    readonly args: IO;
    readonly path: string[];
    readonly type: Type.Call;
  }
>;

/**
 * Creates a message to call a remote function.
 */
export const Call = <IO>({
  address,
  args,
  path,
  returnAddress,
  traceId = UUID.v4()
}: {
  address: string;
  args: IO;
  path: string[];
  returnAddress: string;
  traceId?: string;
}): Call<IO> => ({
  address,
  args,
  path,
  protocol,
  returnAddress,
  traceId,
  type: Type.Call,
  version
});

export type ObserverComplete = FlattenIntersection<
  MessageBase & {
    readonly subscriptionId: string;
    readonly type: Type.ObserverComplete;
  }
>;

/**
 *
 */
export const ObserverComplete = ({
  address,
  returnAddress,
  subscriptionId,
  traceId = UUID.v4()
}: {
  address: string;
  returnAddress: string;
  subscriptionId: string;
  traceId?: string;
}): ObserverComplete => ({
  address,
  protocol,
  returnAddress,
  subscriptionId,
  traceId,
  type: Type.ObserverComplete,
  version
});

export type Error<Error> = FlattenIntersection<
  MessageBase & {
    readonly error: Error;
    readonly type: Type.Error;
  }
>;

/**
 * The server may respond with an error when calling a function.
 */
export const Error = <T>({
  address,
  error,
  returnAddress,
  traceId = UUID.v4()
}: {
  address: string;
  error: T;
  returnAddress: string;
  traceId?: string;
}): Error<T> => ({
  address,
  error,
  protocol,
  returnAddress,
  traceId,
  type: Type.Error,
  version
});

export type ObserverError<Error> = FlattenIntersection<
  MessageBase & {
    readonly error: Error;
    readonly subscriptionId: string;
    readonly type: Type.ObserverError;
  }
>;

/**
 *
 */
export const ObserverError = <T>({
  address,
  error,
  returnAddress,
  subscriptionId,
  traceId = UUID.v4()
}: {
  address: string;
  error: T;
  returnAddress: string;
  subscriptionId: string;
  traceId?: string;
}): ObserverError<T> => ({
  address,
  error,
  protocol,
  returnAddress,
  subscriptionId,
  traceId,
  type: Type.ObserverError,
  version
});

export type ObserverNext<IO> = FlattenIntersection<
  MessageBase & {
    readonly subscriptionId: string;
    readonly type: Type.ObserverNext;
    readonly value: IO;
  }
>;

/**
 *
 */
export const ObserverNext = <IO>({
  address,
  returnAddress,
  subscriptionId,
  traceId = UUID.v4(),
  value
}: {
  address: string;
  returnAddress: string;
  subscriptionId: string;
  traceId?: string;
  value: IO;
}): ObserverNext<IO> => ({
  address,
  protocol,
  returnAddress,
  subscriptionId,
  type: Type.ObserverNext,
  traceId,
  value,
  version
});

export type Return<IO> = FlattenIntersection<
  MessageBase & {
    readonly type: Type.Return;
    readonly value: IO;
  }
>;

/**
 *
 */
export const Return = <IO>({
  address,
  returnAddress,
  traceId = UUID.v4(),
  value
}: {
  address: string;
  returnAddress: string;
  traceId?: string;
  value: IO;
}): Return<IO> => ({
  address,
  protocol,
  returnAddress,
  traceId,
  type: Type.Return,
  value,
  version
});

export type Subscribe<IO> = FlattenIntersection<
  MessageBase & {
    readonly args: IO[];
    readonly path: string[];
    readonly traceId: string;
    readonly type: Type.Subscribe;
  }
>;

/**
 *
 */
export const Subscribe = <IO>({
  address,
  args,
  path,
  returnAddress,
  traceId = UUID.v4()
}: {
  address: string;
  args: IO[];
  path: string[];
  returnAddress: string;
  traceId?: string;
}): Subscribe<IO> => ({
  address,
  args,
  path,
  protocol,
  returnAddress,
  traceId,
  type: Type.Subscribe,
  version
});

export type Subscribed = FlattenIntersection<
  MessageBase & {
    readonly subscriptionId: string;
    readonly type: Type.Return;
  }
>;

/**
 *
 */
export const Subscribed = ({
  address,
  returnAddress,
  subscriptionId,
  traceId = UUID.v4()
}: {
  address: string;
  returnAddress: string;
  subscriptionId: string;
  traceId?: string;
}): Subscribed => ({
  address,
  protocol,
  returnAddress,
  subscriptionId,
  traceId,
  type: Type.Return,
  version
});

export type Unsubscribe = FlattenIntersection<
  MessageBase & {
    readonly subscriptionId: string;
    readonly type: Type.Unsubscribe;
  }
>;

/**
 *
 */
export const Unsubscribe = ({
  address,
  returnAddress,
  traceId = UUID.v4(),
  subscriptionId
}: {
  address: string;
  returnAddress: string;
  subscriptionId: string;
  traceId?: string;
}): Unsubscribe => ({
  address,
  protocol,
  returnAddress,
  subscriptionId,
  traceId,
  type: Type.Unsubscribe,
  version
});

export type Unsubscribed = FlattenIntersection<
  MessageBase & {
    readonly type: Type.Unsubscribed;
  }
>;

/**
 *
 */
export const Unsubscribed = ({
  address,
  returnAddress,
  traceId = UUID.v4()
}: {
  address: string;
  returnAddress: string;
  traceId?: string;
}): Unsubscribed => ({
  address,
  protocol,
  returnAddress,
  traceId,
  type: Type.Unsubscribed,
  version
});

/**
 * Returns `true` if the message is a Transporter message.
 */
export function isMessage<T, IO>(
  message: T | Message<IO>
): message is Message<IO> {
  return (
    JsObject.isObject(message) &&
    JsObject.has(message, "protocol") &&
    message.protocol === protocol
  );
}

/**
 * Checks if a message is compatible with the current version of Transporter.
 */
export function isCompatible(messageVersion: Version): boolean {
  const [messageMajor, messageMinor] = parseVersion(messageVersion);
  const [major, minor] = parseVersion(version);
  return messageMajor === major && messageMinor == minor;
}

/**
 * Returns the major, minor, and patch version of a semantic version string.
 */
export function parseVersion(
  version: Version
): [major: string, minor: string, patch: string] {
  return version.split(".") as [string, string, string];
}
