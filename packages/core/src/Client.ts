import * as APIProxy from "./APIProxy.js";
import * as APIContract from "./APIContract.js";
import * as JsFunction from "./JsFunction.js";
import * as JsObject from "./JsObject.js";
import * as Metadata from "./Metadata.js";
import * as Message from "./Message.js";
import * as Observable from "./Observable/index.js";
import * as Procedure from "./Procedure.js";
import * as Serializer from "./Serializer.js";
import * as Transport from "./Transport.js";
import * as UUID from "./UUID.js";

type Client<Contract, ConnectionMode extends Transport.ConnectionMode> = {
  api: ConnectionMode extends Transport.ConnectionMode.Connectionless
    ? APIProxy.APIProxy<
        JsObject.PickDeep<
          APIContract.Infer<Contract, "API">,
          Procedure.Procedure
        >
      >
    : APIProxy.APIProxy<APIContract.Infer<Contract, "API">>;
  _tag: "Client";
};

type ClientOptions<
  Contract,
  ConnectionMode extends Transport.ConnectionMode
> = APIContract.Infer<Contract, "IO"> extends APIContract.Infer<
  Contract,
  "TransferFormat"
>
  ? {
      serverAddress?: string;
      transport: Transport.Transport<
        APIContract.Infer<Contract, "TransferFormat">,
        ConnectionMode
      >;
    }
  : {
      serializer: Serializer.Serializer<
        APIContract.Infer<Contract, "IO">,
        APIContract.Infer<Contract, "TransferFormat">
      >;
      serverAddress?: string;
      transport: Transport.Transport<
        APIContract.Infer<Contract, "TransferFormat">,
        ConnectionMode
      >;
    };

const Client = <
  Contract extends APIContract.APIContract<any, any, any>,
  ConnectionMode extends Transport.ConnectionMode
>({
  serializer = Serializer.identity,
  serverAddress = "",
  transport
}: ClientOptions<Contract, ConnectionMode>) => {
  const address = UUID.v4();
  const subscriptions = new Map<
    string,
    { path: string[]; observers: JsFunction.t[] }
  >();

  if (transport.mode === Transport.ConnectionMode.ConnectionOriented) {
    const connected = transport.connectionStateChange.pipe(
      Observable.filter(
        (state) => state === Transport.ConnectionState.Connected
      )
    );

    connected.subscribe(() => {
      const messages = [...subscriptions.entries()]
        .filter(([, { observers }]) => observers.length > 0)
        .map(([, { path }]) =>
          Message.Subscribe({
            address: serverAddress,
            path,
            returnAddress: address
          })
        );

      if (messages.length > 0) {
        transport.send(
          serializer.serialize(
            Message.Batch({
              address: serverAddress,
              messages,
              returnAddress: address
            })
          )
        );
      }
    });
  }

  transport.receive
    .pipe(
      Observable.map((message) => serializer.deserialize(message)),
      Observable.filter(Message.isMessage),
      Observable.filter((message) => message.address === address),
      Observable.flatMap((message) => {
        switch (message.type) {
          case Message.Type.Batch:
            return Observable.of(...message.messages);
          default:
            return Observable.of(message);
        }
      }),
      Observable.filter((message) => message.type === Message.Type.Next)
    )
    .subscribe((message) => {
      const subscription = subscriptions.get(message.subscriptionId);
      subscription?.observers.forEach((observer) => observer(message.value));
    });

  const awaitResponse = (
    message: Message.Call<unknown[]> | Message.Subscribe
  ) => {
    const { traceId } = message;

    const promise = transport.receive.pipe(
      Observable.map((value) => serializer.deserialize(value)),
      Observable.filter(Message.isMessage),
      Observable.filter((message) => message.address === address),
      Observable.filter((message) => message.traceId === traceId),
      Observable.flatMap((reply) => {
        switch (reply.type) {
          case Message.Type.Error:
            return Observable.fail(reply.error);
          case Message.Type.Return:
            return Observable.of(reply.value);
          default:
            return Observable.fail("invalid message");
        }
      }),
      Observable.firstValueFrom
    );

    transport.send(serializer.serialize(message));

    return promise;
  };

  const createProxy = (path: string[] = []) => {
    const children: Record<string, unknown> = {};

    const meta: Metadata.t = {
      clientAgentId: "",
      objectPath: path
    };

    const proxy = new Proxy(() => {}, {
      apply: (_target, _thisArg, args) => {
        if (path.at(-1) === "subscribe" && JsFunction.isFunction(args[0])) {
          const [observer] = args;
          const p = path.slice(0, -1);

          const message = Message.Subscribe({
            address: serverAddress,
            path: p,
            returnAddress: address
          });

          return awaitResponse(message).then((subscriptionId) => {
            const id = subscriptionId as string;
            const observers = subscriptions.get(id)?.observers ?? [];

            subscriptions.set(id, {
              path: p,
              observers: [...observers, observer]
            });

            return () => {
              const observers =
                subscriptions
                  .get(id)
                  ?.observers.filter((o) => o !== observer) ?? [];

              subscriptions.set(id, { path: p, observers });

              if (!observers.length) {
                transport.send(
                  serializer.serialize(
                    Message.Unsubscribe({
                      address: serverAddress,
                      returnAddress: address,
                      subscriptionId: id
                    })
                  )
                );
              }
            };
          });
        }

        const message = Message.Call({
          address: serverAddress,
          args,
          path,
          returnAddress: address
        });

        return awaitResponse(message);
      },
      get: (target, prop, receiver) => {
        switch (true) {
          case prop === Metadata.symbol:
            return meta;
          case typeof prop === "symbol":
            return Reflect.get(target, prop, receiver);
          case prop === "then":
            // Prevents promise chaining if the proxy is awaited or resolved.
            return undefined;
          case prop === "toJSON":
            return undefined;
          default:
            if (!children[prop]) children[prop] = createProxy([...path, prop]);
            return children[prop];
        }
      },
      getOwnPropertyDescriptor: (target, property) => {
        switch (property) {
          case Metadata.symbol:
            return { configurable: true };
          default:
            return Reflect.getOwnPropertyDescriptor(target, property);
        }
      },
      has(target, property) {
        switch (property) {
          case Metadata.symbol:
            return true;
          default:
            return Reflect.has(target, property);
        }
      },
      ownKeys(_target) {
        // Prevents enumeration of the proxy. Attempting to enumerate the proxy
        // will throw a `TypeError`, this includes using the rest syntax when
        // destructuring the proxy.
        return undefined as unknown as [];
      }
    });

    return proxy;
  };

  return createProxy() as unknown as Client<Contract, ConnectionMode>;
};

function abort(req: Promise<any>) {}

export { abort, Client };
