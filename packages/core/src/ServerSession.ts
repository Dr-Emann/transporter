import * as APIContract from "./APIContract.js";
import * as Injector from "./Injector.js";
import * as JsFunction from "./JsFunction.js";
import * as JsArray from "./JsArray.js";
import * as JsObject from "./JsObject.js";
import * as Message from "./Message.js";
import * as Observable from "./Observable/index.js";
import * as Procedure from "./Procedure.js";
import * as Subject from "./Subject.js";

enum State {
  Active = "Active",
  Terminated = "Terminated"
}

type ServerSession<TransferFormat> = {
  messageQueue: Observable.t<TransferFormat>;
  send(message: TransferFormat): void;
  sendAwait(message: TransferFormat): Promise<TransferFormat> | Promise<void>;
  state: State;
  stateChange: Observable.t<State>;
  terminate(): void;
  [Symbol.dispose](): void;
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
  const subscriptions = new Map<string, Map<string, Observable.Subscription>>();
  const stateChange = Subject.init<State>();
  let state = State.Active;

  const callFunction = ({
    args,
    path
  }: {
    args: unknown[];
    path: string[];
  }): Promise<TransferFormat> => {
    const getDependencies = (func: JsFunction.t) =>
      Injector.getTags(func).map((tag) => injector?.get(tag)) ?? [];

    const procedure = JsObject.getIn(
      contract.api,
      path
    ) as Procedure.Procedure<JsFunction.Async>;

    const dependencies = getDependencies(procedure.call);
    return procedure.call(...dependencies, ...args);
  };

  const createSubscription = (
    clientAddress: string,
    path: string[],
    observer: (next: TransferFormat) => void
  ) => {
    const clientSubscriptions = subscriptions.get(clientAddress) ?? new Map();
    const subscriptionId = path.join(".");

    if (clientSubscriptions.get(subscriptionId)) return subscriptionId;

    const observable = JsObject.getIn(
      contract.api,
      path
    ) as Observable.t<TransferFormat>;

    clientSubscriptions.set(subscriptionId, observable.subscribe(observer));
    subscriptions.set(clientAddress, clientSubscriptions);

    return subscriptionId;
  };

  const handleMessage = async (
    message: Message.t<unknown>
  ): Promise<Message.t<unknown>> => {
    if (state === State.Terminated)
      return Message.Error({
        address: message.returnAddress,
        error: "session terminated" as TransferFormat,
        returnAddress: address,
        traceId: message.traceId
      });

    if (!Message.isCompatible(message.version)) {
      return Message.Error({
        address: message.returnAddress,
        error: "incompatible version" as TransferFormat,
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
        const subscriptionId = createSubscription(
          message.returnAddress,
          message.path,
          (value) =>
            messageQueue.next(
              contract.serializer.serialize(
                Message.Next({
                  address: message.returnAddress,
                  returnAddress: address,
                  subscriptionId,
                  value
                })
              )
            )
        );

        return Message.Return({
          address: message.returnAddress,
          returnAddress: address,
          traceId: message.traceId,
          value: subscriptionId as TransferFormat
        });
      }

      case Message.Type.Unsubscribe: {
        const clientSubscriptions = subscriptions.get(message.returnAddress);
        const subscription = clientSubscriptions?.get(message.subscriptionId);

        subscription?.unsubscribe();
        clientSubscriptions?.delete(message.subscriptionId);

        return Message.Return({
          address: message.returnAddress,
          returnAddress: address,
          traceId: message.traceId,
          value: "ok" as TransferFormat
        });
      }

      default:
        return Message.Error({
          address: message.returnAddress,
          error: "invalid message" as TransferFormat,
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

  const terminate = () => {
    state = State.Terminated;

    for (const clientSubscriptions of subscriptions.values()) {
      for (const subscription of clientSubscriptions.values()) {
        subscription.unsubscribe();
      }
    }

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
    [Symbol.dispose]: terminate,
    _tag: "ServerSession"
  };
};

export { ServerSession, State };
