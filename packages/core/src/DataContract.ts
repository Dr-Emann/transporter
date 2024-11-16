import * as APIContract from "./APIContract.js";
import * as Future from "./Future.js";
import * as Message from "./Message.js";
import * as Observable from "./Observable/Observable.js";
import * as Procedure from "./Procedure.js";
import * as Serializer from "./Serializer.js";
import * as Subscription from "./Subscription.js";
import * as Try from "./Try.js";

type ObservableType<T> = T extends Observable.Observable<infer V> ? V : never;

type DataContract<IO, TransferFormat> = {
  APIContract<T extends APIContract.RestrictIO<T, IO>>(
    api: T
  ): APIContract.APIContract<T, IO, TransferFormat>;
  Procedure<
    const Args extends readonly IO[],
    Return extends
      | Future.Future<IO, IO>
      | Promise<Try.Try<IO, IO>>
      | Promise<IO>
      | Try.Try<IO, IO>
      | IO
  >(
    procedure: (...args: Args) => Return
  ): (
    ...args: Args
  ) => Future.Future<
    Procedure.SuccessType<Return>,
    Procedure.FailureType<Return>
  >;
  Subscription<
    const Args extends readonly IO[],
    Return extends
      | Future.Future<Observable.Observable<IO>, IO>
      | Promise<Try.Try<Observable.Observable<IO>, IO>>
      | Promise<Observable.Observable<IO>>
      | Try.Try<Observable.Observable<IO>, IO>
      | Observable.Observable<IO>
  >(
    subscription: (...args: Args) => Return
  ): (
    ...args: [
      ...Args,
      observer: Subscription.Observer<
        ObservableType<Procedure.SuccessType<Return>>
      >
    ]
  ) => Future.Future<Observable.Subscription, Procedure.FailureType<Return>>;
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
    APIContract<T extends APIContract.RestrictIO<T, IO>>(api: T) {
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
  };
};

export { DataContract };
