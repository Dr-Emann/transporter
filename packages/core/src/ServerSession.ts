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
  messageQueue: Observable.t<Message.t<TransferFormat>>;
  send(message: Message.t<TransferFormat>): void;
  sendAwait(
    message: Message.t<TransferFormat>
  ): Promise<Message.t<TransferFormat>> | Promise<void>;
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
  const messageQueue = Subject.init<Message.t<TransferFormat>>();
  const subscriptions = new Map<string, Observable.Subscription>();
  const stateChange = Subject.init<State>();
  let state = State.Active;

  const callFunction = ({
    args,
    path
  }: {
    args: TransferFormat[];
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
    path: string[],
    observer: (next: TransferFormat) => void
  ) => {
    if (subscriptions.has(path.join("."))) return;

    const observable = JsObject.getIn(
      contract.api,
      path
    ) as Observable.t<TransferFormat>;

    subscriptions.set(path.join("."), observable.subscribe(observer));
  };

  const handleMessage = async (
    message: Message.t<TransferFormat>
  ): Promise<Message.t<TransferFormat>> => {
    if (state === State.Terminated)
      return Message.Error({
        address: message.returnAddress,
        error: "session terminated" as TransferFormat,
        returnAddress: address
      });

    if (!Message.isCompatible(message.version)) {
      return Message.Error({
        address: message.returnAddress,
        error: "incompatible version" as TransferFormat,
        returnAddress: address
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
          returnAddress: address
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
            value
          });
        } catch (error) {
          return Message.Error({
            address: message.returnAddress,
            returnAddress: address,
            error: error as TransferFormat
          });
        }

      case Message.Type.Subscribe:
        createSubscription(message.path, (value) =>
          messageQueue.next(
            Message.Next({
              address: message.returnAddress,
              path: message.path,
              returnAddress: address,
              value
            })
          )
        );

        return Message.Return({
          address: message.returnAddress,
          returnAddress: address,
          value: "ok" as TransferFormat
        });

      case Message.Type.Unsubscribe: {
        const subscription = subscriptions.get(message.path.join("."));
        subscription?.unsubscribe();
        subscriptions.delete(message.path.join("."));

        return Message.Return({
          address: message.returnAddress,
          returnAddress: address,
          value: "ok" as TransferFormat
        });
      }

      default:
        return Message.Error({
          address: message.returnAddress,
          error: "invalid message" as TransferFormat,
          returnAddress: address
        });
    }
  };

  const send = (message: Message.t<TransferFormat>) => {
    if (message.address === address)
      handleMessage(message).then((message) => messageQueue.next(message));
  };

  const sendAwait = (message: Message.t<TransferFormat>) => {
    return message.address === address
      ? handleMessage(message)
      : Promise.resolve();
  };

  const terminate = () => {
    state = State.Terminated;

    for (const subscription of subscriptions.values()) {
      subscription.unsubscribe();
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
