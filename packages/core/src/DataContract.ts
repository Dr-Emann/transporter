import * as APIContract from "./APIContract.js";
import * as Future from "./Future.js";
import * as Message from "./Message.js";
import * as Observable from "./Observable/Observable.js";
import * as Procedure from "./Procedure.js";
import * as Serializer from "./Serializer.js";
import * as Subscription from "./Subscription.js";

type DataContract<IO, TransferFormat> = {
  APIContract<T extends APIContract.RestrictIO<T, IO>>(
    api: T
  ): APIContract.APIContract<T, IO, TransferFormat>;
  Procedure<
    const Args extends readonly IO[],
    R extends IO,
    E extends IO = never
  >(
    procedure: (...args: Args) => Future.Future<R, E> | Promise<R> | R
  ): (...args: Args) => Future.Future<R, E>;
  Subscription<
    const Args extends readonly IO[],
    R extends IO,
    E extends IO = never
  >(
    subscription: (
      ...args: Args
    ) =>
      | Future.Future<Observable.Observable<R>, E>
      | Promise<Observable.Observable<R>>
      | Observable.Observable<R>
  ): (
    ...args: [...Args, observer: Subscription.Observer<R>]
  ) => Future.Future<Observable.Subscription, E>;
  _tag: "DataContract";
};

type DataContractOptions<IO, TransferFormat> = {
  serializer?: Serializer.Serializer<IO, TransferFormat>;
};

const DataContract = <
  // Forces IO to be a supertype of Message.DataType https://stackoverflow.com/q/77582884/4752186
  IO extends Message.DataType extends IO ? unknown : never,
  TransferFormat = IO
>({
  serializer = Serializer.identity as Serializer.Serializer<IO, TransferFormat>
}: DataContractOptions<IO, TransferFormat> = {}): DataContract<
  IO,
  TransferFormat
> => {
  return {
    APIContract<T>(api: T) {
      return APIContract.APIContract<T, IO, TransferFormat>(api, {
        serializer
      });
    },
    Procedure(...args) {
      return Procedure.Procedure(...args);
    },
    Subscription(...args) {
      return Subscription.Subscription(...args);
    },
    _tag: "DataContract"
  } satisfies DataContract<IO, TransferFormat>;
};

export { DataContract };
