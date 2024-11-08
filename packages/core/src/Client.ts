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

type Client<
  Contract,
  ConnectionMode extends Transport.ConnectionMode
> = (ConnectionMode extends Transport.ConnectionMode.Connectionless
  ? APIProxy.APIProxy<
      JsObject.PickDeep<
        APIContract.Infer<Contract, "API">,
        Procedure.Procedure<any>
      >
    >
  : APIProxy.APIProxy<APIContract.Infer<Contract, "API">>) & { _tag: "Client" };

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
  const observers = new Map<string, JsFunction.t[]>();

  if (transport.mode === Transport.ConnectionMode.ConnectionOriented) {
    const connected = transport.connectionState.pipe(
      Observable.filter(
        (state) => state === Transport.ConnectionState.Connected
      )
    );

    connected.subscribe(() => {
      const messages = Object.entries(observers)
        .filter(([, observers]) => Boolean(observers.length))
        .map(([key]) =>
          Message.Subscribe({
            address: serverAddress,
            path: key.split(".")
          })
        );

      if (messages.length > 0) {
        transport.send(
          serializer.serialize(
            Message.Batch({ address: serverAddress, messages })
          )
        );
      }
    });
  }

  transport.receive
    .pipe(
      Observable.map((message) => serializer.deserialize(message)),
      Observable.filter(Message.isMessage),
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
      observers
        .get(message.path.join("."))
        ?.forEach((observer) => observer(message.value));
    });

  const awaitResponse = (message: Message.Call<unknown[]>) => {
    const promise = transport.receive.pipe(
      Observable.map((message) => serializer.deserialize(message)),
      Observable.filter(Message.isMessage),
      Observable.filter(({ address }) => address === message.returnAddress),
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
          const p = path.slice(0, -1);
          const key = p.join(".");
          const [observer] = args;

          const message = Message.Subscribe({
            address: serverAddress,
            path: p
          });

          observers.set(key, [...(observers.get(key) ?? []), observer]);
          transport.send(serializer.serialize(message));

          return () => {
            const o = observers.get(key)?.filter((o) => o !== observer) ?? [];
            observers.set(key, o);

            if (!o.length) {
              transport.send(
                serializer.serialize(
                  Message.Unsubscribe({
                    address: serverAddress,
                    path: p
                  })
                )
              );
            }
          };
        }

        const message = Message.Call({
          address: serverAddress,
          args,
          path
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
