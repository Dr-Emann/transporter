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
  Next = "Next",
  Return = "Return",
  Subscribe = "Subscribe",
  Unsubscribe = "Unsubscribe"
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
  | Next<IO>
  | Return<IO>
  | Subscribe
  | Unsubscribe;

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
  returnAddress = UUID.v4()
}: {
  address: string;
  messages: [
    Exclude<Message<IO>, Batch<IO>>,
    ...Exclude<Message<IO>, Batch<IO>>[]
  ];
  returnAddress?: string;
}): Batch<IO> => ({
  address,
  messages,
  protocol,
  returnAddress,
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
  returnAddress = UUID.v4()
}: {
  address: string;
  args: IO;
  path: string[];
  returnAddress?: string;
}): Call<IO> => ({
  address,
  args,
  path,
  protocol,
  returnAddress,
  type: Type.Call,
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
  returnAddress = UUID.v4()
}: {
  address: string;
  error: T;
  returnAddress?: string;
}): Error<T> => ({
  address,
  error,
  protocol,
  returnAddress,
  type: Type.Error,
  version
});

export type Next<IO> = FlattenIntersection<
  MessageBase & {
    readonly path: string[];
    readonly type: Type.Next;
    readonly value: IO;
  }
>;

/**
 *
 */
export const Next = <IO>({
  address,
  path,
  returnAddress = UUID.v4(),
  value
}: {
  address: string;
  path: string[];
  returnAddress?: string;
  value: IO;
}): Next<IO> => ({
  address,
  protocol,
  path,
  returnAddress,
  type: Type.Next,
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
  returnAddress = UUID.v4(),
  value
}: {
  address: string;
  returnAddress?: string;
  value: IO;
}): Return<IO> => ({
  address,
  protocol,
  returnAddress,
  type: Type.Return,
  value,
  version
});

export type Subscribe = FlattenIntersection<
  MessageBase & {
    readonly path: string[];
    readonly type: Type.Subscribe;
  }
>;

/**
 *
 */
export const Subscribe = ({
  address,
  path,
  returnAddress = UUID.v4()
}: {
  address: string;
  noReply?: boolean;
  path: string[];
  returnAddress?: string;
}): Subscribe => ({
  address,
  path,
  protocol,
  returnAddress,
  type: Type.Subscribe,
  version
});

export type Unsubscribe = FlattenIntersection<
  MessageBase & {
    readonly path: string[];
    readonly type: Type.Unsubscribe;
  }
>;

/**
 *
 */
export const Unsubscribe = ({
  address,
  path,
  returnAddress = UUID.v4()
}: {
  address: string;
  path: string[];
  returnAddress?: string;
}): Unsubscribe => ({
  address,
  path,
  protocol,
  returnAddress,
  type: Type.Unsubscribe,
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
