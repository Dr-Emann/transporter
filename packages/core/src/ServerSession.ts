import * as APIContract from "./APIContract.js";
import * as Injector from "./Injector.js";
import * as JsFunction from "./JsFunction.js";
import * as JsArray from "./JsArray.js";
import * as JsObject from "./JsObject.js";
import * as Message from "./Message.js";
import * as Observable from "./Observable/index.js";
import * as Procedure from "./Procedure.js";
import * as Subject from "./Subject.js";
import * as Subscription from "./Subscription.js";
import * as UUID from "./UUID.js";

enum State {
  Active = "Active",
  Terminated = "Terminated"
}

type IncompatibleMessageError = {
  message: string;
  type: "IncompatibleMessageError";
};

const IncompatibleMessageError = (
  version: string
): IncompatibleMessageError => ({
  message: `Message with version ${version} is not compatible with version ${Message.version}.`,
  type: "IncompatibleMessageError"
});

type InvalidMessageError = {
  message: string;
  type: "InvalidMessageError";
};

const InvalidMessageError = (type: string): InvalidMessageError => ({
  message: `Message with type ${type} is invalid.`,
  type: "InvalidMessageError"
});

type SessionTerminatedError = {
  message: string;
  type: "SessionTerminatedError";
};

const SessionTerminatedError = (): SessionTerminatedError => ({
  message: "The session is terminated.",
  type: "SessionTerminatedError"
});

type TypeError = {
  message: string;
  type: "TypeError";
};

const TypeError = (message: string): TypeError => ({
  message,
  type: "TypeError"
});

type Error =
  | IncompatibleMessageError
  | InvalidMessageError
  | SessionTerminatedError
  | TypeError;

type ServerSession<TransferFormat> = {
  messageQueue: Observable.t<TransferFormat>;
  send(message: TransferFormat): void;
  sendAwait(message: TransferFormat): Promise<TransferFormat> | Promise<void>;
  state: State;
  stateChange: Observable.t<State>;
  terminate(): Promise<void>;
  [Symbol.asyncDispose](): Promise<void>;
  _tag: "ServerSession";
};

const ServerSession = <TransferFormat>(
  contract: APIContract.APIContract<any, any, TransferFormat>,
  {
    address = "",
    injector
  }: {
    address?: string;
    injector?: Injector.t;
  } = {}
): ServerSession<TransferFormat> => {
  const messageQueue = Subject.init<TransferFormat>();
  const subscriptions = new Map<
    string,
    { unsubscribe: Subscription.Unsubscribe }
  >();
  const stateChange = Subject.init<State>();
  let state = State.Active;

  const getDependencies = (func: JsFunction.t) =>
    Injector.getTags(func).map((tag) => injector?.get(tag)) ?? [];

  const callFunction = ({
    args,
    path
  }: {
    args: unknown[];
    path: string[];
  }): Promise<TransferFormat> => {
    const procedure = JsObject.getIn(contract.api, path);

    if (!Procedure.isProcedure(procedure))
      return Promise.reject(
        TypeError(`The value at path '${path.join(".")}' is not a procedure.`)
      );

    const dependencies = getDependencies(procedure.call);
    return procedure.call(...dependencies, ...args);
  };

  const createSubscription = (
    args: unknown[],
    path: string[],
    observer: Subscription.Observer<unknown>
  ) => {
    const subscription = JsObject.getIn(contract.api, path);

    if (!Subscription.isSubscription(subscription))
      return Promise.reject(
        TypeError(
          `The value at path '${path.join(".")}' is not a subscription.`
        )
      );

    const dependencies = getDependencies(subscription.subscribe);

    return subscription
      .subscribe(...dependencies, ...args, observer)
      .then((subscription) => {
        const subscriptionId = UUID.v4();
        subscriptions.set(subscriptionId, subscription);
        return subscriptionId;
      });
  };

  const handleMessage = async (
    message: Message.t<unknown>
  ): Promise<Message.t<unknown>> => {
    if (state === State.Terminated)
      return Message.Error({
        address: message.returnAddress,
        error: SessionTerminatedError() as TransferFormat,
        returnAddress: address,
        traceId: message.traceId
      });

    if (!Message.isCompatible(message.version)) {
      return Message.Error({
        address: message.returnAddress,
        error: IncompatibleMessageError(message.version) as TransferFormat,
        returnAddress: address,
        traceId: message.traceId
      });
    }

    switch (message.type) {
      case Message.Type.Batch:
        return Message.Batch({
          address: message.returnAddress,
          messages: (await Promise.all(
            message.messages.map(handleMessage)
          )) as JsArray.NonEmpty<
            Exclude<Message.t<TransferFormat>, Message.Batch<TransferFormat>>
          >,
          returnAddress: address,
          traceId: message.traceId
        });

      case Message.Type.Call:
        try {
          const value = await callFunction({
            args: message.args,
            path: message.path
          });

          return Message.Return({
            address: message.returnAddress,
            returnAddress: address,
            traceId: message.traceId,
            value
          });
        } catch (error) {
          return Message.Error({
            address: message.returnAddress,
            error: error as TransferFormat,
            returnAddress: address,
            traceId: message.traceId
          });
        }

      case Message.Type.Subscribe: {
        let subscribeController!: {
          resolve(value: string | PromiseLike<string>): void;
          reject(reason?: unknown): void;
        };

        const subscribePromise = new Promise<string>((resolve, reject) => {
          subscribeController = { resolve, reject };
        });

        const messagePromise = subscribePromise
          .then((subscriptionId) =>
            Message.Subscribed({
              address: message.returnAddress,
              returnAddress: address,
              subscriptionId,
              traceId: message.traceId
            })
          )
          .catch((error) =>
            Message.Error({
              address: message.returnAddress,
              error: error as TransferFormat,
              returnAddress: address,
              traceId: message.traceId
            })
          );

        createSubscription(message.args, message.path, {
          complete: () => {
            subscribePromise.then((subscriptionId) => {
              subscriptions.delete(subscriptionId);

              messageQueue.next(
                contract.serializer.serialize(
                  Message.ObserverComplete({
                    address: message.returnAddress,
                    returnAddress: address,
                    subscriptionId
                  })
                )
              );
            });
          },
          error: (error) => {
            subscribePromise.then((subscriptionId) => {
              subscriptions.delete(subscriptionId);

              messageQueue.next(
                contract.serializer.serialize(
                  Message.ObserverError({
                    address: message.returnAddress,
                    error,
                    returnAddress: address,
                    subscriptionId
                  })
                )
              );
            });
          },
          next: (value) =>
            subscribePromise.then((subscriptionId) =>
              messageQueue.next(
                contract.serializer.serialize(
                  Message.ObserverNext({
                    address: message.returnAddress,
                    returnAddress: address,
                    subscriptionId,
                    value
                  })
                )
              )
            )
        }).then(subscribeController.resolve, subscribeController.reject);

        return messagePromise;
      }

      case Message.Type.Unsubscribe: {
        const subscription = subscriptions?.get(message.subscriptionId);

        try {
          await subscription?.unsubscribe();

          return Message.Unsubscribed({
            address: message.returnAddress,
            returnAddress: address,
            traceId: message.traceId
          });
        } catch (error) {
          return Message.Error({
            address: message.returnAddress,
            error: error as TransferFormat,
            returnAddress: address,
            traceId: message.traceId
          });
        }
      }

      default:
        return Message.Error({
          address: message.returnAddress,
          error: InvalidMessageError(message.type) as TransferFormat,
          returnAddress: address,
          traceId: message.traceId
        });
    }
  };

  const send = (message: TransferFormat) => {
    const value = contract.serializer.deserialize(message);

    if (Message.isMessage(value) && value.address === address)
      handleMessage(value).then((message) =>
        messageQueue.next(contract.serializer.serialize(message))
      );
  };

  const sendAwait = (message: TransferFormat) => {
    const value = contract.serializer.deserialize(message);

    if (Message.isMessage(value) && value.address === address)
      return handleMessage(value).then((message) =>
        contract.serializer.serialize(message)
      );

    return Promise.resolve();
  };

  const terminate = async () => {
    state = State.Terminated;

    await Promise.all(
      [...subscriptions.values()].map((subscription) =>
        subscription.unsubscribe()
      )
    );

    messageQueue.complete();
    stateChange.next(state);
    stateChange.complete();
    subscriptions.clear();
  };

  return {
    messageQueue: messageQueue.asObservable(),
    send,
    sendAwait,
    get state() {
      return state;
    },
    stateChange: stateChange.asObservable(),
    terminate,
    [Symbol.asyncDispose]: terminate,
    _tag: "ServerSession"
  };
};

export {
  type Error,
  type IncompatibleMessageError,
  type InvalidMessageError,
  type SessionTerminatedError,
  type TypeError,
  ServerSession,
  State
};
