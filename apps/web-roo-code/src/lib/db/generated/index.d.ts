/**
 * Client
 **/

import * as runtime from "./runtime/library.js"
import $Types = runtime.Types // general types
import $Public = runtime.Types.Public
import $Utils = runtime.Types.Utils
import $Extensions = runtime.Types.Extensions
import $Result = runtime.Types.Result

export type PrismaPromise<T> = $Public.PrismaPromise<T>

/**
 * Model User
 *
 */
export type User = $Result.DefaultSelection<Prisma.$UserPayload>
/**
 * Model Task
 *
 */
export type Task = $Result.DefaultSelection<Prisma.$TaskPayload>
/**
 * Model Checkpoint
 *
 */
export type Checkpoint = $Result.DefaultSelection<Prisma.$CheckpointPayload>
/**
 * Model Settings
 *
 */
export type Settings = $Result.DefaultSelection<Prisma.$SettingsPayload>
/**
 * Model FileCache
 *
 */
export type FileCache = $Result.DefaultSelection<Prisma.$FileCachePayload>

/**
 * ##  Prisma Client ʲˢ
 *
 * Type-safe database client for TypeScript & Node.js
 * @example
 * ```
 * const prisma = new PrismaClient()
 * // Fetch zero or more Users
 * const users = await prisma.user.findMany()
 * ```
 *
 *
 * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client).
 */
export class PrismaClient<
	ClientOptions extends Prisma.PrismaClientOptions = Prisma.PrismaClientOptions,
	const U = "log" extends keyof ClientOptions
		? ClientOptions["log"] extends Array<Prisma.LogLevel | Prisma.LogDefinition>
			? Prisma.GetEvents<ClientOptions["log"]>
			: never
		: never,
	ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
> {
	[K: symbol]: { types: Prisma.TypeMap<ExtArgs>["other"] }

	/**
	 * ##  Prisma Client ʲˢ
	 *
	 * Type-safe database client for TypeScript & Node.js
	 * @example
	 * ```
	 * const prisma = new PrismaClient()
	 * // Fetch zero or more Users
	 * const users = await prisma.user.findMany()
	 * ```
	 *
	 *
	 * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client).
	 */

	constructor(optionsArg?: Prisma.Subset<ClientOptions, Prisma.PrismaClientOptions>)
	$on<V extends U>(
		eventType: V,
		callback: (event: V extends "query" ? Prisma.QueryEvent : Prisma.LogEvent) => void,
	): PrismaClient

	/**
	 * Connect with the database
	 */
	$connect(): $Utils.JsPromise<void>

	/**
	 * Disconnect from the database
	 */
	$disconnect(): $Utils.JsPromise<void>

	/**
	 * Executes a prepared raw query and returns the number of affected rows.
	 * @example
	 * ```
	 * const result = await prisma.$executeRaw`UPDATE User SET cool = ${true} WHERE email = ${'user@email.com'};`
	 * ```
	 *
	 * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
	 */
	$executeRaw<T = unknown>(query: TemplateStringsArray | Prisma.Sql, ...values: any[]): Prisma.PrismaPromise<number>

	/**
	 * Executes a raw query and returns the number of affected rows.
	 * Susceptible to SQL injections, see documentation.
	 * @example
	 * ```
	 * const result = await prisma.$executeRawUnsafe('UPDATE User SET cool = $1 WHERE email = $2 ;', true, 'user@email.com')
	 * ```
	 *
	 * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
	 */
	$executeRawUnsafe<T = unknown>(query: string, ...values: any[]): Prisma.PrismaPromise<number>

	/**
	 * Performs a prepared raw query and returns the `SELECT` data.
	 * @example
	 * ```
	 * const result = await prisma.$queryRaw`SELECT * FROM User WHERE id = ${1} OR email = ${'user@email.com'};`
	 * ```
	 *
	 * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
	 */
	$queryRaw<T = unknown>(query: TemplateStringsArray | Prisma.Sql, ...values: any[]): Prisma.PrismaPromise<T>

	/**
	 * Performs a raw query and returns the `SELECT` data.
	 * Susceptible to SQL injections, see documentation.
	 * @example
	 * ```
	 * const result = await prisma.$queryRawUnsafe('SELECT * FROM User WHERE id = $1 OR email = $2;', 1, 'user@email.com')
	 * ```
	 *
	 * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
	 */
	$queryRawUnsafe<T = unknown>(query: string, ...values: any[]): Prisma.PrismaPromise<T>

	/**
	 * Allows the running of a sequence of read/write operations that are guaranteed to either succeed or fail as a whole.
	 * @example
	 * ```
	 * const [george, bob, alice] = await prisma.$transaction([
	 *   prisma.user.create({ data: { name: 'George' } }),
	 *   prisma.user.create({ data: { name: 'Bob' } }),
	 *   prisma.user.create({ data: { name: 'Alice' } }),
	 * ])
	 * ```
	 *
	 * Read more in our [docs](https://www.prisma.io/docs/concepts/components/prisma-client/transactions).
	 */
	$transaction<P extends Prisma.PrismaPromise<any>[]>(
		arg: [...P],
		options?: { isolationLevel?: Prisma.TransactionIsolationLevel },
	): $Utils.JsPromise<runtime.Types.Utils.UnwrapTuple<P>>

	$transaction<R>(
		fn: (prisma: Omit<PrismaClient, runtime.ITXClientDenyList>) => $Utils.JsPromise<R>,
		options?: { maxWait?: number; timeout?: number; isolationLevel?: Prisma.TransactionIsolationLevel },
	): $Utils.JsPromise<R>

	$extends: $Extensions.ExtendsHook<
		"extends",
		Prisma.TypeMapCb<ClientOptions>,
		ExtArgs,
		$Utils.Call<
			Prisma.TypeMapCb<ClientOptions>,
			{
				extArgs: ExtArgs
			}
		>
	>

	/**
	 * `prisma.user`: Exposes CRUD operations for the **User** model.
	 * Example usage:
	 * ```ts
	 * // Fetch zero or more Users
	 * const users = await prisma.user.findMany()
	 * ```
	 */
	get user(): Prisma.UserDelegate<ExtArgs, ClientOptions>

	/**
	 * `prisma.task`: Exposes CRUD operations for the **Task** model.
	 * Example usage:
	 * ```ts
	 * // Fetch zero or more Tasks
	 * const tasks = await prisma.task.findMany()
	 * ```
	 */
	get task(): Prisma.TaskDelegate<ExtArgs, ClientOptions>

	/**
	 * `prisma.checkpoint`: Exposes CRUD operations for the **Checkpoint** model.
	 * Example usage:
	 * ```ts
	 * // Fetch zero or more Checkpoints
	 * const checkpoints = await prisma.checkpoint.findMany()
	 * ```
	 */
	get checkpoint(): Prisma.CheckpointDelegate<ExtArgs, ClientOptions>

	/**
	 * `prisma.settings`: Exposes CRUD operations for the **Settings** model.
	 * Example usage:
	 * ```ts
	 * // Fetch zero or more Settings
	 * const settings = await prisma.settings.findMany()
	 * ```
	 */
	get settings(): Prisma.SettingsDelegate<ExtArgs, ClientOptions>

	/**
	 * `prisma.fileCache`: Exposes CRUD operations for the **FileCache** model.
	 * Example usage:
	 * ```ts
	 * // Fetch zero or more FileCaches
	 * const fileCaches = await prisma.fileCache.findMany()
	 * ```
	 */
	get fileCache(): Prisma.FileCacheDelegate<ExtArgs, ClientOptions>
}

export namespace Prisma {
	export import DMMF = runtime.DMMF

	export type PrismaPromise<T> = $Public.PrismaPromise<T>

	/**
	 * Validator
	 */
	export import validator = runtime.Public.validator

	/**
	 * Prisma Errors
	 */
	export import PrismaClientKnownRequestError = runtime.PrismaClientKnownRequestError
	export import PrismaClientUnknownRequestError = runtime.PrismaClientUnknownRequestError
	export import PrismaClientRustPanicError = runtime.PrismaClientRustPanicError
	export import PrismaClientInitializationError = runtime.PrismaClientInitializationError
	export import PrismaClientValidationError = runtime.PrismaClientValidationError

	/**
	 * Re-export of sql-template-tag
	 */
	export import sql = runtime.sqltag
	export import empty = runtime.empty
	export import join = runtime.join
	export import raw = runtime.raw
	export import Sql = runtime.Sql

	/**
	 * Decimal.js
	 */
	export import Decimal = runtime.Decimal

	export type DecimalJsLike = runtime.DecimalJsLike

	/**
	 * Metrics
	 */
	export type Metrics = runtime.Metrics
	export type Metric<T> = runtime.Metric<T>
	export type MetricHistogram = runtime.MetricHistogram
	export type MetricHistogramBucket = runtime.MetricHistogramBucket

	/**
	 * Extensions
	 */
	export import Extension = $Extensions.UserArgs
	export import getExtensionContext = runtime.Extensions.getExtensionContext
	export import Args = $Public.Args
	export import Payload = $Public.Payload
	export import Result = $Public.Result
	export import Exact = $Public.Exact

	/**
	 * Prisma Client JS version: 6.17.1
	 * Query Engine version: 272a37d34178c2894197e17273bf937f25acdeac
	 */
	export type PrismaVersion = {
		client: string
	}

	export const prismaVersion: PrismaVersion

	/**
	 * Utility Types
	 */

	export import JsonObject = runtime.JsonObject
	export import JsonArray = runtime.JsonArray
	export import JsonValue = runtime.JsonValue
	export import InputJsonObject = runtime.InputJsonObject
	export import InputJsonArray = runtime.InputJsonArray
	export import InputJsonValue = runtime.InputJsonValue

	/**
	 * Types of the values used to represent different kinds of `null` values when working with JSON fields.
	 *
	 * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
	 */
	namespace NullTypes {
		/**
		 * Type of `Prisma.DbNull`.
		 *
		 * You cannot use other instances of this class. Please use the `Prisma.DbNull` value.
		 *
		 * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
		 */
		class DbNull {
			private DbNull: never
			private constructor()
		}

		/**
		 * Type of `Prisma.JsonNull`.
		 *
		 * You cannot use other instances of this class. Please use the `Prisma.JsonNull` value.
		 *
		 * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
		 */
		class JsonNull {
			private JsonNull: never
			private constructor()
		}

		/**
		 * Type of `Prisma.AnyNull`.
		 *
		 * You cannot use other instances of this class. Please use the `Prisma.AnyNull` value.
		 *
		 * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
		 */
		class AnyNull {
			private AnyNull: never
			private constructor()
		}
	}

	/**
	 * Helper for filtering JSON entries that have `null` on the database (empty on the db)
	 *
	 * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
	 */
	export const DbNull: NullTypes.DbNull

	/**
	 * Helper for filtering JSON entries that have JSON `null` values (not empty on the db)
	 *
	 * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
	 */
	export const JsonNull: NullTypes.JsonNull

	/**
	 * Helper for filtering JSON entries that are `Prisma.DbNull` or `Prisma.JsonNull`
	 *
	 * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
	 */
	export const AnyNull: NullTypes.AnyNull

	type SelectAndInclude = {
		select: any
		include: any
	}

	type SelectAndOmit = {
		select: any
		omit: any
	}

	/**
	 * Get the type of the value, that the Promise holds.
	 */
	export type PromiseType<T extends PromiseLike<any>> = T extends PromiseLike<infer U> ? U : T

	/**
	 * Get the return type of a function which returns a Promise.
	 */
	export type PromiseReturnType<T extends (...args: any) => $Utils.JsPromise<any>> = PromiseType<ReturnType<T>>

	/**
	 * From T, pick a set of properties whose keys are in the union K
	 */
	type Prisma__Pick<T, K extends keyof T> = {
		[P in K]: T[P]
	}

	export type Enumerable<T> = T | Array<T>

	export type RequiredKeys<T> = {
		[K in keyof T]-?: {} extends Prisma__Pick<T, K> ? never : K
	}[keyof T]

	export type TruthyKeys<T> = keyof {
		[K in keyof T as T[K] extends false | undefined | null ? never : K]: K
	}

	export type TrueKeys<T> = TruthyKeys<Prisma__Pick<T, RequiredKeys<T>>>

	/**
	 * Subset
	 * @desc From `T` pick properties that exist in `U`. Simple version of Intersection
	 */
	export type Subset<T, U> = {
		[key in keyof T]: key extends keyof U ? T[key] : never
	}

	/**
	 * SelectSubset
	 * @desc From `T` pick properties that exist in `U`. Simple version of Intersection.
	 * Additionally, it validates, if both select and include are present. If the case, it errors.
	 */
	export type SelectSubset<T, U> = {
		[key in keyof T]: key extends keyof U ? T[key] : never
	} & (T extends SelectAndInclude
		? "Please either choose `select` or `include`."
		: T extends SelectAndOmit
			? "Please either choose `select` or `omit`."
			: {})

	/**
	 * Subset + Intersection
	 * @desc From `T` pick properties that exist in `U` and intersect `K`
	 */
	export type SubsetIntersection<T, U, K> = {
		[key in keyof T]: key extends keyof U ? T[key] : never
	} & K

	type Without<T, U> = { [P in Exclude<keyof T, keyof U>]?: never }

	/**
	 * XOR is needed to have a real mutually exclusive union type
	 * https://stackoverflow.com/questions/42123407/does-typescript-support-mutually-exclusive-types
	 */
	type XOR<T, U> = T extends object ? (U extends object ? (Without<T, U> & U) | (Without<U, T> & T) : U) : T

	/**
	 * Is T a Record?
	 */
	type IsObject<T extends any> =
		T extends Array<any>
			? False
			: T extends Date
				? False
				: T extends Uint8Array
					? False
					: T extends bigint
						? False
						: T extends object
							? True
							: False

	/**
	 * If it's T[], return T
	 */
	export type UnEnumerate<T extends unknown> = T extends Array<infer U> ? U : T

	/**
	 * From ts-toolbelt
	 */

	type __Either<O extends object, K extends Key> = Omit<O, K> &
		{
			// Merge all but K
			[P in K]: Prisma__Pick<O, P & keyof O> // With K possibilities
		}[K]

	type EitherStrict<O extends object, K extends Key> = Strict<__Either<O, K>>

	type EitherLoose<O extends object, K extends Key> = ComputeRaw<__Either<O, K>>

	type _Either<O extends object, K extends Key, strict extends Boolean> = {
		1: EitherStrict<O, K>
		0: EitherLoose<O, K>
	}[strict]

	type Either<O extends object, K extends Key, strict extends Boolean = 1> = O extends unknown
		? _Either<O, K, strict>
		: never

	export type Union = any

	type PatchUndefined<O extends object, O1 extends object> = {
		[K in keyof O]: O[K] extends undefined ? At<O1, K> : O[K]
	} & {}

	/** Helper Types for "Merge" **/
	export type IntersectOf<U extends Union> = (U extends unknown ? (k: U) => void : never) extends (k: infer I) => void
		? I
		: never

	export type Overwrite<O extends object, O1 extends object> = {
		[K in keyof O]: K extends keyof O1 ? O1[K] : O[K]
	} & {}

	type _Merge<U extends object> = IntersectOf<
		Overwrite<
			U,
			{
				[K in keyof U]-?: At<U, K>
			}
		>
	>

	type Key = string | number | symbol
	type AtBasic<O extends object, K extends Key> = K extends keyof O ? O[K] : never
	type AtStrict<O extends object, K extends Key> = O[K & keyof O]
	type AtLoose<O extends object, K extends Key> = O extends unknown ? AtStrict<O, K> : never
	export type At<O extends object, K extends Key, strict extends Boolean = 1> = {
		1: AtStrict<O, K>
		0: AtLoose<O, K>
	}[strict]

	export type ComputeRaw<A extends any> = A extends Function
		? A
		: {
				[K in keyof A]: A[K]
			} & {}

	export type OptionalFlat<O> = {
		[K in keyof O]?: O[K]
	} & {}

	type _Record<K extends keyof any, T> = {
		[P in K]: T
	}

	// cause typescript not to expand types and preserve names
	type NoExpand<T> = T extends unknown ? T : never

	// this type assumes the passed object is entirely optional
	type AtLeast<O extends object, K extends string> = NoExpand<
		O extends unknown
			?
					| (K extends keyof O ? { [P in K]: O[P] } & O : O)
					| ({ [P in keyof O as P extends K ? P : never]-?: O[P] } & O)
			: never
	>

	type _Strict<U, _U = U> = U extends unknown ? U & OptionalFlat<_Record<Exclude<Keys<_U>, keyof U>, never>> : never

	export type Strict<U extends object> = ComputeRaw<_Strict<U>>
	/** End Helper Types for "Merge" **/

	export type Merge<U extends object> = ComputeRaw<_Merge<Strict<U>>>

	/**
  A [[Boolean]]
  */
	export type Boolean = True | False

	// /**
	// 1
	// */
	export type True = 1

	/**
  0
  */
	export type False = 0

	export type Not<B extends Boolean> = {
		0: 1
		1: 0
	}[B]

	export type Extends<A1 extends any, A2 extends any> = [A1] extends [never]
		? 0 // anything `never` is false
		: A1 extends A2
			? 1
			: 0

	export type Has<U extends Union, U1 extends Union> = Not<Extends<Exclude<U1, U>, U1>>

	export type Or<B1 extends Boolean, B2 extends Boolean> = {
		0: {
			0: 0
			1: 1
		}
		1: {
			0: 1
			1: 1
		}
	}[B1][B2]

	export type Keys<U extends Union> = U extends unknown ? keyof U : never

	type Cast<A, B> = A extends B ? A : B

	export const type: unique symbol

	/**
	 * Used by group by
	 */

	export type GetScalarType<T, O> = O extends object
		? {
				[P in keyof T]: P extends keyof O ? O[P] : never
			}
		: never

	type FieldPaths<T, U = Omit<T, "_avg" | "_sum" | "_count" | "_min" | "_max">> = IsObject<T> extends True ? U : T

	type GetHavingFields<T> = {
		[K in keyof T]: Or<Or<Extends<"OR", K>, Extends<"AND", K>>, Extends<"NOT", K>> extends True
			? // infer is only needed to not hit TS limit
				// based on the brilliant idea of Pierre-Antoine Mills
				// https://github.com/microsoft/TypeScript/issues/30188#issuecomment-478938437
				T[K] extends infer TK
				? GetHavingFields<UnEnumerate<TK> extends object ? Merge<UnEnumerate<TK>> : never>
				: never
			: {} extends FieldPaths<T[K]>
				? never
				: K
	}[keyof T]

	/**
	 * Convert tuple to union
	 */
	type _TupleToUnion<T> = T extends (infer E)[] ? E : never
	type TupleToUnion<K extends readonly any[]> = _TupleToUnion<K>
	type MaybeTupleToUnion<T> = T extends any[] ? TupleToUnion<T> : T

	/**
	 * Like `Pick`, but additionally can also accept an array of keys
	 */
	type PickEnumerable<T, K extends Enumerable<keyof T> | keyof T> = Prisma__Pick<T, MaybeTupleToUnion<K>>

	/**
	 * Exclude all keys with underscores
	 */
	type ExcludeUnderscoreKeys<T extends string> = T extends `_${string}` ? never : T

	export type FieldRef<Model, FieldType> = runtime.FieldRef<Model, FieldType>

	type FieldRefInputType<Model, FieldType> = Model extends never ? never : FieldRef<Model, FieldType>

	export const ModelName: {
		User: "User"
		Task: "Task"
		Checkpoint: "Checkpoint"
		Settings: "Settings"
		FileCache: "FileCache"
	}

	export type ModelName = (typeof ModelName)[keyof typeof ModelName]

	export type Datasources = {
		db?: Datasource
	}

	interface TypeMapCb<ClientOptions = {}>
		extends $Utils.Fn<{ extArgs: $Extensions.InternalArgs }, $Utils.Record<string, any>> {
		returns: Prisma.TypeMap<
			this["params"]["extArgs"],
			ClientOptions extends { omit: infer OmitOptions } ? OmitOptions : {}
		>
	}

	export type TypeMap<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> = {
		globalOmitOptions: {
			omit: GlobalOmitOptions
		}
		meta: {
			modelProps: "user" | "task" | "checkpoint" | "settings" | "fileCache"
			txIsolationLevel: Prisma.TransactionIsolationLevel
		}
		model: {
			User: {
				payload: Prisma.$UserPayload<ExtArgs>
				fields: Prisma.UserFieldRefs
				operations: {
					findUnique: {
						args: Prisma.UserFindUniqueArgs<ExtArgs>
						result: $Utils.PayloadToResult<Prisma.$UserPayload> | null
					}
					findUniqueOrThrow: {
						args: Prisma.UserFindUniqueOrThrowArgs<ExtArgs>
						result: $Utils.PayloadToResult<Prisma.$UserPayload>
					}
					findFirst: {
						args: Prisma.UserFindFirstArgs<ExtArgs>
						result: $Utils.PayloadToResult<Prisma.$UserPayload> | null
					}
					findFirstOrThrow: {
						args: Prisma.UserFindFirstOrThrowArgs<ExtArgs>
						result: $Utils.PayloadToResult<Prisma.$UserPayload>
					}
					findMany: {
						args: Prisma.UserFindManyArgs<ExtArgs>
						result: $Utils.PayloadToResult<Prisma.$UserPayload>[]
					}
					create: {
						args: Prisma.UserCreateArgs<ExtArgs>
						result: $Utils.PayloadToResult<Prisma.$UserPayload>
					}
					createMany: {
						args: Prisma.UserCreateManyArgs<ExtArgs>
						result: BatchPayload
					}
					createManyAndReturn: {
						args: Prisma.UserCreateManyAndReturnArgs<ExtArgs>
						result: $Utils.PayloadToResult<Prisma.$UserPayload>[]
					}
					delete: {
						args: Prisma.UserDeleteArgs<ExtArgs>
						result: $Utils.PayloadToResult<Prisma.$UserPayload>
					}
					update: {
						args: Prisma.UserUpdateArgs<ExtArgs>
						result: $Utils.PayloadToResult<Prisma.$UserPayload>
					}
					deleteMany: {
						args: Prisma.UserDeleteManyArgs<ExtArgs>
						result: BatchPayload
					}
					updateMany: {
						args: Prisma.UserUpdateManyArgs<ExtArgs>
						result: BatchPayload
					}
					updateManyAndReturn: {
						args: Prisma.UserUpdateManyAndReturnArgs<ExtArgs>
						result: $Utils.PayloadToResult<Prisma.$UserPayload>[]
					}
					upsert: {
						args: Prisma.UserUpsertArgs<ExtArgs>
						result: $Utils.PayloadToResult<Prisma.$UserPayload>
					}
					aggregate: {
						args: Prisma.UserAggregateArgs<ExtArgs>
						result: $Utils.Optional<AggregateUser>
					}
					groupBy: {
						args: Prisma.UserGroupByArgs<ExtArgs>
						result: $Utils.Optional<UserGroupByOutputType>[]
					}
					count: {
						args: Prisma.UserCountArgs<ExtArgs>
						result: $Utils.Optional<UserCountAggregateOutputType> | number
					}
				}
			}
			Task: {
				payload: Prisma.$TaskPayload<ExtArgs>
				fields: Prisma.TaskFieldRefs
				operations: {
					findUnique: {
						args: Prisma.TaskFindUniqueArgs<ExtArgs>
						result: $Utils.PayloadToResult<Prisma.$TaskPayload> | null
					}
					findUniqueOrThrow: {
						args: Prisma.TaskFindUniqueOrThrowArgs<ExtArgs>
						result: $Utils.PayloadToResult<Prisma.$TaskPayload>
					}
					findFirst: {
						args: Prisma.TaskFindFirstArgs<ExtArgs>
						result: $Utils.PayloadToResult<Prisma.$TaskPayload> | null
					}
					findFirstOrThrow: {
						args: Prisma.TaskFindFirstOrThrowArgs<ExtArgs>
						result: $Utils.PayloadToResult<Prisma.$TaskPayload>
					}
					findMany: {
						args: Prisma.TaskFindManyArgs<ExtArgs>
						result: $Utils.PayloadToResult<Prisma.$TaskPayload>[]
					}
					create: {
						args: Prisma.TaskCreateArgs<ExtArgs>
						result: $Utils.PayloadToResult<Prisma.$TaskPayload>
					}
					createMany: {
						args: Prisma.TaskCreateManyArgs<ExtArgs>
						result: BatchPayload
					}
					createManyAndReturn: {
						args: Prisma.TaskCreateManyAndReturnArgs<ExtArgs>
						result: $Utils.PayloadToResult<Prisma.$TaskPayload>[]
					}
					delete: {
						args: Prisma.TaskDeleteArgs<ExtArgs>
						result: $Utils.PayloadToResult<Prisma.$TaskPayload>
					}
					update: {
						args: Prisma.TaskUpdateArgs<ExtArgs>
						result: $Utils.PayloadToResult<Prisma.$TaskPayload>
					}
					deleteMany: {
						args: Prisma.TaskDeleteManyArgs<ExtArgs>
						result: BatchPayload
					}
					updateMany: {
						args: Prisma.TaskUpdateManyArgs<ExtArgs>
						result: BatchPayload
					}
					updateManyAndReturn: {
						args: Prisma.TaskUpdateManyAndReturnArgs<ExtArgs>
						result: $Utils.PayloadToResult<Prisma.$TaskPayload>[]
					}
					upsert: {
						args: Prisma.TaskUpsertArgs<ExtArgs>
						result: $Utils.PayloadToResult<Prisma.$TaskPayload>
					}
					aggregate: {
						args: Prisma.TaskAggregateArgs<ExtArgs>
						result: $Utils.Optional<AggregateTask>
					}
					groupBy: {
						args: Prisma.TaskGroupByArgs<ExtArgs>
						result: $Utils.Optional<TaskGroupByOutputType>[]
					}
					count: {
						args: Prisma.TaskCountArgs<ExtArgs>
						result: $Utils.Optional<TaskCountAggregateOutputType> | number
					}
				}
			}
			Checkpoint: {
				payload: Prisma.$CheckpointPayload<ExtArgs>
				fields: Prisma.CheckpointFieldRefs
				operations: {
					findUnique: {
						args: Prisma.CheckpointFindUniqueArgs<ExtArgs>
						result: $Utils.PayloadToResult<Prisma.$CheckpointPayload> | null
					}
					findUniqueOrThrow: {
						args: Prisma.CheckpointFindUniqueOrThrowArgs<ExtArgs>
						result: $Utils.PayloadToResult<Prisma.$CheckpointPayload>
					}
					findFirst: {
						args: Prisma.CheckpointFindFirstArgs<ExtArgs>
						result: $Utils.PayloadToResult<Prisma.$CheckpointPayload> | null
					}
					findFirstOrThrow: {
						args: Prisma.CheckpointFindFirstOrThrowArgs<ExtArgs>
						result: $Utils.PayloadToResult<Prisma.$CheckpointPayload>
					}
					findMany: {
						args: Prisma.CheckpointFindManyArgs<ExtArgs>
						result: $Utils.PayloadToResult<Prisma.$CheckpointPayload>[]
					}
					create: {
						args: Prisma.CheckpointCreateArgs<ExtArgs>
						result: $Utils.PayloadToResult<Prisma.$CheckpointPayload>
					}
					createMany: {
						args: Prisma.CheckpointCreateManyArgs<ExtArgs>
						result: BatchPayload
					}
					createManyAndReturn: {
						args: Prisma.CheckpointCreateManyAndReturnArgs<ExtArgs>
						result: $Utils.PayloadToResult<Prisma.$CheckpointPayload>[]
					}
					delete: {
						args: Prisma.CheckpointDeleteArgs<ExtArgs>
						result: $Utils.PayloadToResult<Prisma.$CheckpointPayload>
					}
					update: {
						args: Prisma.CheckpointUpdateArgs<ExtArgs>
						result: $Utils.PayloadToResult<Prisma.$CheckpointPayload>
					}
					deleteMany: {
						args: Prisma.CheckpointDeleteManyArgs<ExtArgs>
						result: BatchPayload
					}
					updateMany: {
						args: Prisma.CheckpointUpdateManyArgs<ExtArgs>
						result: BatchPayload
					}
					updateManyAndReturn: {
						args: Prisma.CheckpointUpdateManyAndReturnArgs<ExtArgs>
						result: $Utils.PayloadToResult<Prisma.$CheckpointPayload>[]
					}
					upsert: {
						args: Prisma.CheckpointUpsertArgs<ExtArgs>
						result: $Utils.PayloadToResult<Prisma.$CheckpointPayload>
					}
					aggregate: {
						args: Prisma.CheckpointAggregateArgs<ExtArgs>
						result: $Utils.Optional<AggregateCheckpoint>
					}
					groupBy: {
						args: Prisma.CheckpointGroupByArgs<ExtArgs>
						result: $Utils.Optional<CheckpointGroupByOutputType>[]
					}
					count: {
						args: Prisma.CheckpointCountArgs<ExtArgs>
						result: $Utils.Optional<CheckpointCountAggregateOutputType> | number
					}
				}
			}
			Settings: {
				payload: Prisma.$SettingsPayload<ExtArgs>
				fields: Prisma.SettingsFieldRefs
				operations: {
					findUnique: {
						args: Prisma.SettingsFindUniqueArgs<ExtArgs>
						result: $Utils.PayloadToResult<Prisma.$SettingsPayload> | null
					}
					findUniqueOrThrow: {
						args: Prisma.SettingsFindUniqueOrThrowArgs<ExtArgs>
						result: $Utils.PayloadToResult<Prisma.$SettingsPayload>
					}
					findFirst: {
						args: Prisma.SettingsFindFirstArgs<ExtArgs>
						result: $Utils.PayloadToResult<Prisma.$SettingsPayload> | null
					}
					findFirstOrThrow: {
						args: Prisma.SettingsFindFirstOrThrowArgs<ExtArgs>
						result: $Utils.PayloadToResult<Prisma.$SettingsPayload>
					}
					findMany: {
						args: Prisma.SettingsFindManyArgs<ExtArgs>
						result: $Utils.PayloadToResult<Prisma.$SettingsPayload>[]
					}
					create: {
						args: Prisma.SettingsCreateArgs<ExtArgs>
						result: $Utils.PayloadToResult<Prisma.$SettingsPayload>
					}
					createMany: {
						args: Prisma.SettingsCreateManyArgs<ExtArgs>
						result: BatchPayload
					}
					createManyAndReturn: {
						args: Prisma.SettingsCreateManyAndReturnArgs<ExtArgs>
						result: $Utils.PayloadToResult<Prisma.$SettingsPayload>[]
					}
					delete: {
						args: Prisma.SettingsDeleteArgs<ExtArgs>
						result: $Utils.PayloadToResult<Prisma.$SettingsPayload>
					}
					update: {
						args: Prisma.SettingsUpdateArgs<ExtArgs>
						result: $Utils.PayloadToResult<Prisma.$SettingsPayload>
					}
					deleteMany: {
						args: Prisma.SettingsDeleteManyArgs<ExtArgs>
						result: BatchPayload
					}
					updateMany: {
						args: Prisma.SettingsUpdateManyArgs<ExtArgs>
						result: BatchPayload
					}
					updateManyAndReturn: {
						args: Prisma.SettingsUpdateManyAndReturnArgs<ExtArgs>
						result: $Utils.PayloadToResult<Prisma.$SettingsPayload>[]
					}
					upsert: {
						args: Prisma.SettingsUpsertArgs<ExtArgs>
						result: $Utils.PayloadToResult<Prisma.$SettingsPayload>
					}
					aggregate: {
						args: Prisma.SettingsAggregateArgs<ExtArgs>
						result: $Utils.Optional<AggregateSettings>
					}
					groupBy: {
						args: Prisma.SettingsGroupByArgs<ExtArgs>
						result: $Utils.Optional<SettingsGroupByOutputType>[]
					}
					count: {
						args: Prisma.SettingsCountArgs<ExtArgs>
						result: $Utils.Optional<SettingsCountAggregateOutputType> | number
					}
				}
			}
			FileCache: {
				payload: Prisma.$FileCachePayload<ExtArgs>
				fields: Prisma.FileCacheFieldRefs
				operations: {
					findUnique: {
						args: Prisma.FileCacheFindUniqueArgs<ExtArgs>
						result: $Utils.PayloadToResult<Prisma.$FileCachePayload> | null
					}
					findUniqueOrThrow: {
						args: Prisma.FileCacheFindUniqueOrThrowArgs<ExtArgs>
						result: $Utils.PayloadToResult<Prisma.$FileCachePayload>
					}
					findFirst: {
						args: Prisma.FileCacheFindFirstArgs<ExtArgs>
						result: $Utils.PayloadToResult<Prisma.$FileCachePayload> | null
					}
					findFirstOrThrow: {
						args: Prisma.FileCacheFindFirstOrThrowArgs<ExtArgs>
						result: $Utils.PayloadToResult<Prisma.$FileCachePayload>
					}
					findMany: {
						args: Prisma.FileCacheFindManyArgs<ExtArgs>
						result: $Utils.PayloadToResult<Prisma.$FileCachePayload>[]
					}
					create: {
						args: Prisma.FileCacheCreateArgs<ExtArgs>
						result: $Utils.PayloadToResult<Prisma.$FileCachePayload>
					}
					createMany: {
						args: Prisma.FileCacheCreateManyArgs<ExtArgs>
						result: BatchPayload
					}
					createManyAndReturn: {
						args: Prisma.FileCacheCreateManyAndReturnArgs<ExtArgs>
						result: $Utils.PayloadToResult<Prisma.$FileCachePayload>[]
					}
					delete: {
						args: Prisma.FileCacheDeleteArgs<ExtArgs>
						result: $Utils.PayloadToResult<Prisma.$FileCachePayload>
					}
					update: {
						args: Prisma.FileCacheUpdateArgs<ExtArgs>
						result: $Utils.PayloadToResult<Prisma.$FileCachePayload>
					}
					deleteMany: {
						args: Prisma.FileCacheDeleteManyArgs<ExtArgs>
						result: BatchPayload
					}
					updateMany: {
						args: Prisma.FileCacheUpdateManyArgs<ExtArgs>
						result: BatchPayload
					}
					updateManyAndReturn: {
						args: Prisma.FileCacheUpdateManyAndReturnArgs<ExtArgs>
						result: $Utils.PayloadToResult<Prisma.$FileCachePayload>[]
					}
					upsert: {
						args: Prisma.FileCacheUpsertArgs<ExtArgs>
						result: $Utils.PayloadToResult<Prisma.$FileCachePayload>
					}
					aggregate: {
						args: Prisma.FileCacheAggregateArgs<ExtArgs>
						result: $Utils.Optional<AggregateFileCache>
					}
					groupBy: {
						args: Prisma.FileCacheGroupByArgs<ExtArgs>
						result: $Utils.Optional<FileCacheGroupByOutputType>[]
					}
					count: {
						args: Prisma.FileCacheCountArgs<ExtArgs>
						result: $Utils.Optional<FileCacheCountAggregateOutputType> | number
					}
				}
			}
		}
	} & {
		other: {
			payload: any
			operations: {
				$executeRaw: {
					args: [query: TemplateStringsArray | Prisma.Sql, ...values: any[]]
					result: any
				}
				$executeRawUnsafe: {
					args: [query: string, ...values: any[]]
					result: any
				}
				$queryRaw: {
					args: [query: TemplateStringsArray | Prisma.Sql, ...values: any[]]
					result: any
				}
				$queryRawUnsafe: {
					args: [query: string, ...values: any[]]
					result: any
				}
			}
		}
	}
	export const defineExtension: $Extensions.ExtendsHook<"define", Prisma.TypeMapCb, $Extensions.DefaultArgs>
	export type DefaultPrismaClient = PrismaClient
	export type ErrorFormat = "pretty" | "colorless" | "minimal"
	export interface PrismaClientOptions {
		/**
		 * Overwrites the datasource url from your schema.prisma file
		 */
		datasources?: Datasources
		/**
		 * Overwrites the datasource url from your schema.prisma file
		 */
		datasourceUrl?: string
		/**
		 * @default "colorless"
		 */
		errorFormat?: ErrorFormat
		/**
		 * @example
		 * ```
		 * // Shorthand for `emit: 'stdout'`
		 * log: ['query', 'info', 'warn', 'error']
		 *
		 * // Emit as events only
		 * log: [
		 *   { emit: 'event', level: 'query' },
		 *   { emit: 'event', level: 'info' },
		 *   { emit: 'event', level: 'warn' }
		 *   { emit: 'event', level: 'error' }
		 * ]
		 *
		 * / Emit as events and log to stdout
		 * og: [
		 *  { emit: 'stdout', level: 'query' },
		 *  { emit: 'stdout', level: 'info' },
		 *  { emit: 'stdout', level: 'warn' }
		 *  { emit: 'stdout', level: 'error' }
		 *
		 * ```
		 * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/logging#the-log-option).
		 */
		log?: (LogLevel | LogDefinition)[]
		/**
		 * The default values for transactionOptions
		 * maxWait ?= 2000
		 * timeout ?= 5000
		 */
		transactionOptions?: {
			maxWait?: number
			timeout?: number
			isolationLevel?: Prisma.TransactionIsolationLevel
		}
		/**
		 * Instance of a Driver Adapter, e.g., like one provided by `@prisma/adapter-planetscale`
		 */
		adapter?: runtime.SqlDriverAdapterFactory | null
		/**
		 * Global configuration for omitting model fields by default.
		 *
		 * @example
		 * ```
		 * const prisma = new PrismaClient({
		 *   omit: {
		 *     user: {
		 *       password: true
		 *     }
		 *   }
		 * })
		 * ```
		 */
		omit?: Prisma.GlobalOmitConfig
	}
	export type GlobalOmitConfig = {
		user?: UserOmit
		task?: TaskOmit
		checkpoint?: CheckpointOmit
		settings?: SettingsOmit
		fileCache?: FileCacheOmit
	}

	/* Types for Logging */
	export type LogLevel = "info" | "query" | "warn" | "error"
	export type LogDefinition = {
		level: LogLevel
		emit: "stdout" | "event"
	}

	export type CheckIsLogLevel<T> = T extends LogLevel ? T : never

	export type GetLogType<T> = CheckIsLogLevel<T extends LogDefinition ? T["level"] : T>

	export type GetEvents<T extends any[]> = T extends Array<LogLevel | LogDefinition> ? GetLogType<T[number]> : never

	export type QueryEvent = {
		timestamp: Date
		query: string
		params: string
		duration: number
		target: string
	}

	export type LogEvent = {
		timestamp: Date
		message: string
		target: string
	}
	/* End Types for Logging */

	export type PrismaAction =
		| "findUnique"
		| "findUniqueOrThrow"
		| "findMany"
		| "findFirst"
		| "findFirstOrThrow"
		| "create"
		| "createMany"
		| "createManyAndReturn"
		| "update"
		| "updateMany"
		| "updateManyAndReturn"
		| "upsert"
		| "delete"
		| "deleteMany"
		| "executeRaw"
		| "queryRaw"
		| "aggregate"
		| "count"
		| "runCommandRaw"
		| "findRaw"
		| "groupBy"

	// tested in getLogLevel.test.ts
	export function getLogLevel(log: Array<LogLevel | LogDefinition>): LogLevel | undefined

	/**
	 * `PrismaClient` proxy available in interactive transactions.
	 */
	export type TransactionClient = Omit<Prisma.DefaultPrismaClient, runtime.ITXClientDenyList>

	export type Datasource = {
		url?: string
	}

	/**
	 * Count Types
	 */

	/**
	 * Count Type UserCountOutputType
	 */

	export type UserCountOutputType = {
		tasks: number
	}

	export type UserCountOutputTypeSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
		tasks?: boolean | UserCountOutputTypeCountTasksArgs
	}

	// Custom InputTypes
	/**
	 * UserCountOutputType without action
	 */
	export type UserCountOutputTypeDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
		/**
		 * Select specific fields to fetch from the UserCountOutputType
		 */
		select?: UserCountOutputTypeSelect<ExtArgs> | null
	}

	/**
	 * UserCountOutputType without action
	 */
	export type UserCountOutputTypeCountTasksArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
		{
			where?: TaskWhereInput
		}

	/**
	 * Count Type TaskCountOutputType
	 */

	export type TaskCountOutputType = {
		checkpoints: number
	}

	export type TaskCountOutputTypeSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
		checkpoints?: boolean | TaskCountOutputTypeCountCheckpointsArgs
	}

	// Custom InputTypes
	/**
	 * TaskCountOutputType without action
	 */
	export type TaskCountOutputTypeDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
		/**
		 * Select specific fields to fetch from the TaskCountOutputType
		 */
		select?: TaskCountOutputTypeSelect<ExtArgs> | null
	}

	/**
	 * TaskCountOutputType without action
	 */
	export type TaskCountOutputTypeCountCheckpointsArgs<
		ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
	> = {
		where?: CheckpointWhereInput
	}

	/**
	 * Models
	 */

	/**
	 * Model User
	 */

	export type AggregateUser = {
		_count: UserCountAggregateOutputType | null
		_min: UserMinAggregateOutputType | null
		_max: UserMaxAggregateOutputType | null
	}

	export type UserMinAggregateOutputType = {
		id: string | null
		email: string | null
		name: string | null
		hashedPassword: string | null
		githubId: string | null
		githubToken: string | null
		createdAt: Date | null
		updatedAt: Date | null
	}

	export type UserMaxAggregateOutputType = {
		id: string | null
		email: string | null
		name: string | null
		hashedPassword: string | null
		githubId: string | null
		githubToken: string | null
		createdAt: Date | null
		updatedAt: Date | null
	}

	export type UserCountAggregateOutputType = {
		id: number
		email: number
		name: number
		hashedPassword: number
		githubId: number
		githubToken: number
		createdAt: number
		updatedAt: number
		_all: number
	}

	export type UserMinAggregateInputType = {
		id?: true
		email?: true
		name?: true
		hashedPassword?: true
		githubId?: true
		githubToken?: true
		createdAt?: true
		updatedAt?: true
	}

	export type UserMaxAggregateInputType = {
		id?: true
		email?: true
		name?: true
		hashedPassword?: true
		githubId?: true
		githubToken?: true
		createdAt?: true
		updatedAt?: true
	}

	export type UserCountAggregateInputType = {
		id?: true
		email?: true
		name?: true
		hashedPassword?: true
		githubId?: true
		githubToken?: true
		createdAt?: true
		updatedAt?: true
		_all?: true
	}

	export type UserAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
		/**
		 * Filter which User to aggregate.
		 */
		where?: UserWhereInput
		/**
		 * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
		 *
		 * Determine the order of Users to fetch.
		 */
		orderBy?: UserOrderByWithRelationInput | UserOrderByWithRelationInput[]
		/**
		 * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
		 *
		 * Sets the start position
		 */
		cursor?: UserWhereUniqueInput
		/**
		 * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
		 *
		 * Take `±n` Users from the position of the cursor.
		 */
		take?: number
		/**
		 * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
		 *
		 * Skip the first `n` Users.
		 */
		skip?: number
		/**
		 * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
		 *
		 * Count returned Users
		 **/
		_count?: true | UserCountAggregateInputType
		/**
		 * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
		 *
		 * Select which fields to find the minimum value
		 **/
		_min?: UserMinAggregateInputType
		/**
		 * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
		 *
		 * Select which fields to find the maximum value
		 **/
		_max?: UserMaxAggregateInputType
	}

	export type GetUserAggregateType<T extends UserAggregateArgs> = {
		[P in keyof T & keyof AggregateUser]: P extends "_count" | "count"
			? T[P] extends true
				? number
				: GetScalarType<T[P], AggregateUser[P]>
			: GetScalarType<T[P], AggregateUser[P]>
	}

	export type UserGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
		where?: UserWhereInput
		orderBy?: UserOrderByWithAggregationInput | UserOrderByWithAggregationInput[]
		by: UserScalarFieldEnum[] | UserScalarFieldEnum
		having?: UserScalarWhereWithAggregatesInput
		take?: number
		skip?: number
		_count?: UserCountAggregateInputType | true
		_min?: UserMinAggregateInputType
		_max?: UserMaxAggregateInputType
	}

	export type UserGroupByOutputType = {
		id: string
		email: string
		name: string | null
		hashedPassword: string | null
		githubId: string | null
		githubToken: string | null
		createdAt: Date
		updatedAt: Date
		_count: UserCountAggregateOutputType | null
		_min: UserMinAggregateOutputType | null
		_max: UserMaxAggregateOutputType | null
	}

	type GetUserGroupByPayload<T extends UserGroupByArgs> = Prisma.PrismaPromise<
		Array<
			PickEnumerable<UserGroupByOutputType, T["by"]> & {
				[P in keyof T & keyof UserGroupByOutputType]: P extends "_count"
					? T[P] extends boolean
						? number
						: GetScalarType<T[P], UserGroupByOutputType[P]>
					: GetScalarType<T[P], UserGroupByOutputType[P]>
			}
		>
	>

	export type UserSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<
		{
			id?: boolean
			email?: boolean
			name?: boolean
			hashedPassword?: boolean
			githubId?: boolean
			githubToken?: boolean
			createdAt?: boolean
			updatedAt?: boolean
			tasks?: boolean | User$tasksArgs<ExtArgs>
			settings?: boolean | User$settingsArgs<ExtArgs>
			_count?: boolean | UserCountOutputTypeDefaultArgs<ExtArgs>
		},
		ExtArgs["result"]["user"]
	>

	export type UserSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
		$Extensions.GetSelect<
			{
				id?: boolean
				email?: boolean
				name?: boolean
				hashedPassword?: boolean
				githubId?: boolean
				githubToken?: boolean
				createdAt?: boolean
				updatedAt?: boolean
			},
			ExtArgs["result"]["user"]
		>

	export type UserSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
		$Extensions.GetSelect<
			{
				id?: boolean
				email?: boolean
				name?: boolean
				hashedPassword?: boolean
				githubId?: boolean
				githubToken?: boolean
				createdAt?: boolean
				updatedAt?: boolean
			},
			ExtArgs["result"]["user"]
		>

	export type UserSelectScalar = {
		id?: boolean
		email?: boolean
		name?: boolean
		hashedPassword?: boolean
		githubId?: boolean
		githubToken?: boolean
		createdAt?: boolean
		updatedAt?: boolean
	}

	export type UserOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<
		"id" | "email" | "name" | "hashedPassword" | "githubId" | "githubToken" | "createdAt" | "updatedAt",
		ExtArgs["result"]["user"]
	>
	export type UserInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
		tasks?: boolean | User$tasksArgs<ExtArgs>
		settings?: boolean | User$settingsArgs<ExtArgs>
		_count?: boolean | UserCountOutputTypeDefaultArgs<ExtArgs>
	}
	export type UserIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {}
	export type UserIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {}

	export type $UserPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
		name: "User"
		objects: {
			tasks: Prisma.$TaskPayload<ExtArgs>[]
			settings: Prisma.$SettingsPayload<ExtArgs> | null
		}
		scalars: $Extensions.GetPayloadResult<
			{
				id: string
				email: string
				name: string | null
				hashedPassword: string | null
				githubId: string | null
				githubToken: string | null
				createdAt: Date
				updatedAt: Date
			},
			ExtArgs["result"]["user"]
		>
		composites: {}
	}

	type UserGetPayload<S extends boolean | null | undefined | UserDefaultArgs> = $Result.GetResult<
		Prisma.$UserPayload,
		S
	>

	type UserCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = Omit<
		UserFindManyArgs,
		"select" | "include" | "distinct" | "omit"
	> & {
		select?: UserCountAggregateInputType | true
	}

	export interface UserDelegate<
		ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
		GlobalOmitOptions = {},
	> {
		[K: symbol]: { types: Prisma.TypeMap<ExtArgs>["model"]["User"]; meta: { name: "User" } }
		/**
		 * Find zero or one User that matches the filter.
		 * @param {UserFindUniqueArgs} args - Arguments to find a User
		 * @example
		 * // Get one User
		 * const user = await prisma.user.findUnique({
		 *   where: {
		 *     // ... provide filter here
		 *   }
		 * })
		 */
		findUnique<T extends UserFindUniqueArgs>(
			args: SelectSubset<T, UserFindUniqueArgs<ExtArgs>>,
		): Prisma__UserClient<
			$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null,
			null,
			ExtArgs,
			GlobalOmitOptions
		>

		/**
		 * Find one User that matches the filter or throw an error with `error.code='P2025'`
		 * if no matches were found.
		 * @param {UserFindUniqueOrThrowArgs} args - Arguments to find a User
		 * @example
		 * // Get one User
		 * const user = await prisma.user.findUniqueOrThrow({
		 *   where: {
		 *     // ... provide filter here
		 *   }
		 * })
		 */
		findUniqueOrThrow<T extends UserFindUniqueOrThrowArgs>(
			args: SelectSubset<T, UserFindUniqueOrThrowArgs<ExtArgs>>,
		): Prisma__UserClient<
			$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>,
			never,
			ExtArgs,
			GlobalOmitOptions
		>

		/**
		 * Find the first User that matches the filter.
		 * Note, that providing `undefined` is treated as the value not being there.
		 * Read more here: https://pris.ly/d/null-undefined
		 * @param {UserFindFirstArgs} args - Arguments to find a User
		 * @example
		 * // Get one User
		 * const user = await prisma.user.findFirst({
		 *   where: {
		 *     // ... provide filter here
		 *   }
		 * })
		 */
		findFirst<T extends UserFindFirstArgs>(
			args?: SelectSubset<T, UserFindFirstArgs<ExtArgs>>,
		): Prisma__UserClient<
			$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null,
			null,
			ExtArgs,
			GlobalOmitOptions
		>

		/**
		 * Find the first User that matches the filter or
		 * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
		 * Note, that providing `undefined` is treated as the value not being there.
		 * Read more here: https://pris.ly/d/null-undefined
		 * @param {UserFindFirstOrThrowArgs} args - Arguments to find a User
		 * @example
		 * // Get one User
		 * const user = await prisma.user.findFirstOrThrow({
		 *   where: {
		 *     // ... provide filter here
		 *   }
		 * })
		 */
		findFirstOrThrow<T extends UserFindFirstOrThrowArgs>(
			args?: SelectSubset<T, UserFindFirstOrThrowArgs<ExtArgs>>,
		): Prisma__UserClient<
			$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>,
			never,
			ExtArgs,
			GlobalOmitOptions
		>

		/**
		 * Find zero or more Users that matches the filter.
		 * Note, that providing `undefined` is treated as the value not being there.
		 * Read more here: https://pris.ly/d/null-undefined
		 * @param {UserFindManyArgs} args - Arguments to filter and select certain fields only.
		 * @example
		 * // Get all Users
		 * const users = await prisma.user.findMany()
		 *
		 * // Get first 10 Users
		 * const users = await prisma.user.findMany({ take: 10 })
		 *
		 * // Only select the `id`
		 * const userWithIdOnly = await prisma.user.findMany({ select: { id: true } })
		 *
		 */
		findMany<T extends UserFindManyArgs>(
			args?: SelectSubset<T, UserFindManyArgs<ExtArgs>>,
		): Prisma.PrismaPromise<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

		/**
		 * Create a User.
		 * @param {UserCreateArgs} args - Arguments to create a User.
		 * @example
		 * // Create one User
		 * const User = await prisma.user.create({
		 *   data: {
		 *     // ... data to create a User
		 *   }
		 * })
		 *
		 */
		create<T extends UserCreateArgs>(
			args: SelectSubset<T, UserCreateArgs<ExtArgs>>,
		): Prisma__UserClient<
			$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "create", GlobalOmitOptions>,
			never,
			ExtArgs,
			GlobalOmitOptions
		>

		/**
		 * Create many Users.
		 * @param {UserCreateManyArgs} args - Arguments to create many Users.
		 * @example
		 * // Create many Users
		 * const user = await prisma.user.createMany({
		 *   data: [
		 *     // ... provide data here
		 *   ]
		 * })
		 *
		 */
		createMany<T extends UserCreateManyArgs>(
			args?: SelectSubset<T, UserCreateManyArgs<ExtArgs>>,
		): Prisma.PrismaPromise<BatchPayload>

		/**
		 * Create many Users and returns the data saved in the database.
		 * @param {UserCreateManyAndReturnArgs} args - Arguments to create many Users.
		 * @example
		 * // Create many Users
		 * const user = await prisma.user.createManyAndReturn({
		 *   data: [
		 *     // ... provide data here
		 *   ]
		 * })
		 *
		 * // Create many Users and only return the `id`
		 * const userWithIdOnly = await prisma.user.createManyAndReturn({
		 *   select: { id: true },
		 *   data: [
		 *     // ... provide data here
		 *   ]
		 * })
		 * Note, that providing `undefined` is treated as the value not being there.
		 * Read more here: https://pris.ly/d/null-undefined
		 *
		 */
		createManyAndReturn<T extends UserCreateManyAndReturnArgs>(
			args?: SelectSubset<T, UserCreateManyAndReturnArgs<ExtArgs>>,
		): Prisma.PrismaPromise<
			$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>
		>

		/**
		 * Delete a User.
		 * @param {UserDeleteArgs} args - Arguments to delete one User.
		 * @example
		 * // Delete one User
		 * const User = await prisma.user.delete({
		 *   where: {
		 *     // ... filter to delete one User
		 *   }
		 * })
		 *
		 */
		delete<T extends UserDeleteArgs>(
			args: SelectSubset<T, UserDeleteArgs<ExtArgs>>,
		): Prisma__UserClient<
			$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "delete", GlobalOmitOptions>,
			never,
			ExtArgs,
			GlobalOmitOptions
		>

		/**
		 * Update one User.
		 * @param {UserUpdateArgs} args - Arguments to update one User.
		 * @example
		 * // Update one User
		 * const user = await prisma.user.update({
		 *   where: {
		 *     // ... provide filter here
		 *   },
		 *   data: {
		 *     // ... provide data here
		 *   }
		 * })
		 *
		 */
		update<T extends UserUpdateArgs>(
			args: SelectSubset<T, UserUpdateArgs<ExtArgs>>,
		): Prisma__UserClient<
			$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "update", GlobalOmitOptions>,
			never,
			ExtArgs,
			GlobalOmitOptions
		>

		/**
		 * Delete zero or more Users.
		 * @param {UserDeleteManyArgs} args - Arguments to filter Users to delete.
		 * @example
		 * // Delete a few Users
		 * const { count } = await prisma.user.deleteMany({
		 *   where: {
		 *     // ... provide filter here
		 *   }
		 * })
		 *
		 */
		deleteMany<T extends UserDeleteManyArgs>(
			args?: SelectSubset<T, UserDeleteManyArgs<ExtArgs>>,
		): Prisma.PrismaPromise<BatchPayload>

		/**
		 * Update zero or more Users.
		 * Note, that providing `undefined` is treated as the value not being there.
		 * Read more here: https://pris.ly/d/null-undefined
		 * @param {UserUpdateManyArgs} args - Arguments to update one or more rows.
		 * @example
		 * // Update many Users
		 * const user = await prisma.user.updateMany({
		 *   where: {
		 *     // ... provide filter here
		 *   },
		 *   data: {
		 *     // ... provide data here
		 *   }
		 * })
		 *
		 */
		updateMany<T extends UserUpdateManyArgs>(
			args: SelectSubset<T, UserUpdateManyArgs<ExtArgs>>,
		): Prisma.PrismaPromise<BatchPayload>

		/**
		 * Update zero or more Users and returns the data updated in the database.
		 * @param {UserUpdateManyAndReturnArgs} args - Arguments to update many Users.
		 * @example
		 * // Update many Users
		 * const user = await prisma.user.updateManyAndReturn({
		 *   where: {
		 *     // ... provide filter here
		 *   },
		 *   data: [
		 *     // ... provide data here
		 *   ]
		 * })
		 *
		 * // Update zero or more Users and only return the `id`
		 * const userWithIdOnly = await prisma.user.updateManyAndReturn({
		 *   select: { id: true },
		 *   where: {
		 *     // ... provide filter here
		 *   },
		 *   data: [
		 *     // ... provide data here
		 *   ]
		 * })
		 * Note, that providing `undefined` is treated as the value not being there.
		 * Read more here: https://pris.ly/d/null-undefined
		 *
		 */
		updateManyAndReturn<T extends UserUpdateManyAndReturnArgs>(
			args: SelectSubset<T, UserUpdateManyAndReturnArgs<ExtArgs>>,
		): Prisma.PrismaPromise<
			$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>
		>

		/**
		 * Create or update one User.
		 * @param {UserUpsertArgs} args - Arguments to update or create a User.
		 * @example
		 * // Update or create a User
		 * const user = await prisma.user.upsert({
		 *   create: {
		 *     // ... data to create a User
		 *   },
		 *   update: {
		 *     // ... in case it already exists, update
		 *   },
		 *   where: {
		 *     // ... the filter for the User we want to update
		 *   }
		 * })
		 */
		upsert<T extends UserUpsertArgs>(
			args: SelectSubset<T, UserUpsertArgs<ExtArgs>>,
		): Prisma__UserClient<
			$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>,
			never,
			ExtArgs,
			GlobalOmitOptions
		>

		/**
		 * Count the number of Users.
		 * Note, that providing `undefined` is treated as the value not being there.
		 * Read more here: https://pris.ly/d/null-undefined
		 * @param {UserCountArgs} args - Arguments to filter Users to count.
		 * @example
		 * // Count the number of Users
		 * const count = await prisma.user.count({
		 *   where: {
		 *     // ... the filter for the Users we want to count
		 *   }
		 * })
		 **/
		count<T extends UserCountArgs>(
			args?: Subset<T, UserCountArgs>,
		): Prisma.PrismaPromise<
			T extends $Utils.Record<"select", any>
				? T["select"] extends true
					? number
					: GetScalarType<T["select"], UserCountAggregateOutputType>
				: number
		>

		/**
		 * Allows you to perform aggregations operations on a User.
		 * Note, that providing `undefined` is treated as the value not being there.
		 * Read more here: https://pris.ly/d/null-undefined
		 * @param {UserAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
		 * @example
		 * // Ordered by age ascending
		 * // Where email contains prisma.io
		 * // Limited to the 10 users
		 * const aggregations = await prisma.user.aggregate({
		 *   _avg: {
		 *     age: true,
		 *   },
		 *   where: {
		 *     email: {
		 *       contains: "prisma.io",
		 *     },
		 *   },
		 *   orderBy: {
		 *     age: "asc",
		 *   },
		 *   take: 10,
		 * })
		 **/
		aggregate<T extends UserAggregateArgs>(
			args: Subset<T, UserAggregateArgs>,
		): Prisma.PrismaPromise<GetUserAggregateType<T>>

		/**
		 * Group by User.
		 * Note, that providing `undefined` is treated as the value not being there.
		 * Read more here: https://pris.ly/d/null-undefined
		 * @param {UserGroupByArgs} args - Group by arguments.
		 * @example
		 * // Group by city, order by createdAt, get count
		 * const result = await prisma.user.groupBy({
		 *   by: ['city', 'createdAt'],
		 *   orderBy: {
		 *     createdAt: true
		 *   },
		 *   _count: {
		 *     _all: true
		 *   },
		 * })
		 *
		 **/
		groupBy<
			T extends UserGroupByArgs,
			HasSelectOrTake extends Or<Extends<"skip", Keys<T>>, Extends<"take", Keys<T>>>,
			OrderByArg extends True extends HasSelectOrTake
				? { orderBy: UserGroupByArgs["orderBy"] }
				: { orderBy?: UserGroupByArgs["orderBy"] },
			OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T["orderBy"]>>>,
			ByFields extends MaybeTupleToUnion<T["by"]>,
			ByValid extends Has<ByFields, OrderFields>,
			HavingFields extends GetHavingFields<T["having"]>,
			HavingValid extends Has<ByFields, HavingFields>,
			ByEmpty extends T["by"] extends never[] ? True : False,
			InputErrors extends ByEmpty extends True
				? `Error: "by" must not be empty.`
				: HavingValid extends False
					? {
							[P in HavingFields]: P extends ByFields
								? never
								: P extends string
									? `Error: Field "${P}" used in "having" needs to be provided in "by".`
									: [Error, "Field ", P, ` in "having" needs to be provided in "by"`]
						}[HavingFields]
					: "take" extends Keys<T>
						? "orderBy" extends Keys<T>
							? ByValid extends True
								? {}
								: {
										[P in OrderFields]: P extends ByFields
											? never
											: `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
									}[OrderFields]
							: 'Error: If you provide "take", you also need to provide "orderBy"'
						: "skip" extends Keys<T>
							? "orderBy" extends Keys<T>
								? ByValid extends True
									? {}
									: {
											[P in OrderFields]: P extends ByFields
												? never
												: `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
										}[OrderFields]
								: 'Error: If you provide "skip", you also need to provide "orderBy"'
							: ByValid extends True
								? {}
								: {
										[P in OrderFields]: P extends ByFields
											? never
											: `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
									}[OrderFields],
		>(
			args: SubsetIntersection<T, UserGroupByArgs, OrderByArg> & InputErrors,
		): {} extends InputErrors ? GetUserGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
		/**
		 * Fields of the User model
		 */
		readonly fields: UserFieldRefs
	}

	/**
	 * The delegate class that acts as a "Promise-like" for User.
	 * Why is this prefixed with `Prisma__`?
	 * Because we want to prevent naming conflicts as mentioned in
	 * https://github.com/prisma/prisma-client-js/issues/707
	 */
	export interface Prisma__UserClient<
		T,
		Null = never,
		ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
		GlobalOmitOptions = {},
	> extends Prisma.PrismaPromise<T> {
		readonly [Symbol.toStringTag]: "PrismaPromise"
		tasks<T extends User$tasksArgs<ExtArgs> = {}>(
			args?: Subset<T, User$tasksArgs<ExtArgs>>,
		): Prisma.PrismaPromise<
			$Result.GetResult<Prisma.$TaskPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null
		>
		settings<T extends User$settingsArgs<ExtArgs> = {}>(
			args?: Subset<T, User$settingsArgs<ExtArgs>>,
		): Prisma__SettingsClient<
			$Result.GetResult<Prisma.$SettingsPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | null,
			null,
			ExtArgs,
			GlobalOmitOptions
		>
		/**
		 * Attaches callbacks for the resolution and/or rejection of the Promise.
		 * @param onfulfilled The callback to execute when the Promise is resolved.
		 * @param onrejected The callback to execute when the Promise is rejected.
		 * @returns A Promise for the completion of which ever callback is executed.
		 */
		then<TResult1 = T, TResult2 = never>(
			onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null,
			onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null,
		): $Utils.JsPromise<TResult1 | TResult2>
		/**
		 * Attaches a callback for only the rejection of the Promise.
		 * @param onrejected The callback to execute when the Promise is rejected.
		 * @returns A Promise for the completion of the callback.
		 */
		catch<TResult = never>(
			onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null,
		): $Utils.JsPromise<T | TResult>
		/**
		 * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
		 * resolved value cannot be modified from the callback.
		 * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
		 * @returns A Promise for the completion of the callback.
		 */
		finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
	}

	/**
	 * Fields of the User model
	 */
	interface UserFieldRefs {
		readonly id: FieldRef<"User", "String">
		readonly email: FieldRef<"User", "String">
		readonly name: FieldRef<"User", "String">
		readonly hashedPassword: FieldRef<"User", "String">
		readonly githubId: FieldRef<"User", "String">
		readonly githubToken: FieldRef<"User", "String">
		readonly createdAt: FieldRef<"User", "DateTime">
		readonly updatedAt: FieldRef<"User", "DateTime">
	}

	// Custom InputTypes
	/**
	 * User findUnique
	 */
	export type UserFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
		/**
		 * Select specific fields to fetch from the User
		 */
		select?: UserSelect<ExtArgs> | null
		/**
		 * Omit specific fields from the User
		 */
		omit?: UserOmit<ExtArgs> | null
		/**
		 * Choose, which related nodes to fetch as well
		 */
		include?: UserInclude<ExtArgs> | null
		/**
		 * Filter, which User to fetch.
		 */
		where: UserWhereUniqueInput
	}

	/**
	 * User findUniqueOrThrow
	 */
	export type UserFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
		/**
		 * Select specific fields to fetch from the User
		 */
		select?: UserSelect<ExtArgs> | null
		/**
		 * Omit specific fields from the User
		 */
		omit?: UserOmit<ExtArgs> | null
		/**
		 * Choose, which related nodes to fetch as well
		 */
		include?: UserInclude<ExtArgs> | null
		/**
		 * Filter, which User to fetch.
		 */
		where: UserWhereUniqueInput
	}

	/**
	 * User findFirst
	 */
	export type UserFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
		/**
		 * Select specific fields to fetch from the User
		 */
		select?: UserSelect<ExtArgs> | null
		/**
		 * Omit specific fields from the User
		 */
		omit?: UserOmit<ExtArgs> | null
		/**
		 * Choose, which related nodes to fetch as well
		 */
		include?: UserInclude<ExtArgs> | null
		/**
		 * Filter, which User to fetch.
		 */
		where?: UserWhereInput
		/**
		 * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
		 *
		 * Determine the order of Users to fetch.
		 */
		orderBy?: UserOrderByWithRelationInput | UserOrderByWithRelationInput[]
		/**
		 * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
		 *
		 * Sets the position for searching for Users.
		 */
		cursor?: UserWhereUniqueInput
		/**
		 * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
		 *
		 * Take `±n` Users from the position of the cursor.
		 */
		take?: number
		/**
		 * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
		 *
		 * Skip the first `n` Users.
		 */
		skip?: number
		/**
		 * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
		 *
		 * Filter by unique combinations of Users.
		 */
		distinct?: UserScalarFieldEnum | UserScalarFieldEnum[]
	}

	/**
	 * User findFirstOrThrow
	 */
	export type UserFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
		/**
		 * Select specific fields to fetch from the User
		 */
		select?: UserSelect<ExtArgs> | null
		/**
		 * Omit specific fields from the User
		 */
		omit?: UserOmit<ExtArgs> | null
		/**
		 * Choose, which related nodes to fetch as well
		 */
		include?: UserInclude<ExtArgs> | null
		/**
		 * Filter, which User to fetch.
		 */
		where?: UserWhereInput
		/**
		 * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
		 *
		 * Determine the order of Users to fetch.
		 */
		orderBy?: UserOrderByWithRelationInput | UserOrderByWithRelationInput[]
		/**
		 * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
		 *
		 * Sets the position for searching for Users.
		 */
		cursor?: UserWhereUniqueInput
		/**
		 * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
		 *
		 * Take `±n` Users from the position of the cursor.
		 */
		take?: number
		/**
		 * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
		 *
		 * Skip the first `n` Users.
		 */
		skip?: number
		/**
		 * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
		 *
		 * Filter by unique combinations of Users.
		 */
		distinct?: UserScalarFieldEnum | UserScalarFieldEnum[]
	}

	/**
	 * User findMany
	 */
	export type UserFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
		/**
		 * Select specific fields to fetch from the User
		 */
		select?: UserSelect<ExtArgs> | null
		/**
		 * Omit specific fields from the User
		 */
		omit?: UserOmit<ExtArgs> | null
		/**
		 * Choose, which related nodes to fetch as well
		 */
		include?: UserInclude<ExtArgs> | null
		/**
		 * Filter, which Users to fetch.
		 */
		where?: UserWhereInput
		/**
		 * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
		 *
		 * Determine the order of Users to fetch.
		 */
		orderBy?: UserOrderByWithRelationInput | UserOrderByWithRelationInput[]
		/**
		 * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
		 *
		 * Sets the position for listing Users.
		 */
		cursor?: UserWhereUniqueInput
		/**
		 * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
		 *
		 * Take `±n` Users from the position of the cursor.
		 */
		take?: number
		/**
		 * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
		 *
		 * Skip the first `n` Users.
		 */
		skip?: number
		distinct?: UserScalarFieldEnum | UserScalarFieldEnum[]
	}

	/**
	 * User create
	 */
	export type UserCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
		/**
		 * Select specific fields to fetch from the User
		 */
		select?: UserSelect<ExtArgs> | null
		/**
		 * Omit specific fields from the User
		 */
		omit?: UserOmit<ExtArgs> | null
		/**
		 * Choose, which related nodes to fetch as well
		 */
		include?: UserInclude<ExtArgs> | null
		/**
		 * The data needed to create a User.
		 */
		data: XOR<UserCreateInput, UserUncheckedCreateInput>
	}

	/**
	 * User createMany
	 */
	export type UserCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
		/**
		 * The data used to create many Users.
		 */
		data: UserCreateManyInput | UserCreateManyInput[]
		skipDuplicates?: boolean
	}

	/**
	 * User createManyAndReturn
	 */
	export type UserCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
		/**
		 * Select specific fields to fetch from the User
		 */
		select?: UserSelectCreateManyAndReturn<ExtArgs> | null
		/**
		 * Omit specific fields from the User
		 */
		omit?: UserOmit<ExtArgs> | null
		/**
		 * The data used to create many Users.
		 */
		data: UserCreateManyInput | UserCreateManyInput[]
		skipDuplicates?: boolean
	}

	/**
	 * User update
	 */
	export type UserUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
		/**
		 * Select specific fields to fetch from the User
		 */
		select?: UserSelect<ExtArgs> | null
		/**
		 * Omit specific fields from the User
		 */
		omit?: UserOmit<ExtArgs> | null
		/**
		 * Choose, which related nodes to fetch as well
		 */
		include?: UserInclude<ExtArgs> | null
		/**
		 * The data needed to update a User.
		 */
		data: XOR<UserUpdateInput, UserUncheckedUpdateInput>
		/**
		 * Choose, which User to update.
		 */
		where: UserWhereUniqueInput
	}

	/**
	 * User updateMany
	 */
	export type UserUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
		/**
		 * The data used to update Users.
		 */
		data: XOR<UserUpdateManyMutationInput, UserUncheckedUpdateManyInput>
		/**
		 * Filter which Users to update
		 */
		where?: UserWhereInput
		/**
		 * Limit how many Users to update.
		 */
		limit?: number
	}

	/**
	 * User updateManyAndReturn
	 */
	export type UserUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
		/**
		 * Select specific fields to fetch from the User
		 */
		select?: UserSelectUpdateManyAndReturn<ExtArgs> | null
		/**
		 * Omit specific fields from the User
		 */
		omit?: UserOmit<ExtArgs> | null
		/**
		 * The data used to update Users.
		 */
		data: XOR<UserUpdateManyMutationInput, UserUncheckedUpdateManyInput>
		/**
		 * Filter which Users to update
		 */
		where?: UserWhereInput
		/**
		 * Limit how many Users to update.
		 */
		limit?: number
	}

	/**
	 * User upsert
	 */
	export type UserUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
		/**
		 * Select specific fields to fetch from the User
		 */
		select?: UserSelect<ExtArgs> | null
		/**
		 * Omit specific fields from the User
		 */
		omit?: UserOmit<ExtArgs> | null
		/**
		 * Choose, which related nodes to fetch as well
		 */
		include?: UserInclude<ExtArgs> | null
		/**
		 * The filter to search for the User to update in case it exists.
		 */
		where: UserWhereUniqueInput
		/**
		 * In case the User found by the `where` argument doesn't exist, create a new User with this data.
		 */
		create: XOR<UserCreateInput, UserUncheckedCreateInput>
		/**
		 * In case the User was found with the provided `where` argument, update it with this data.
		 */
		update: XOR<UserUpdateInput, UserUncheckedUpdateInput>
	}

	/**
	 * User delete
	 */
	export type UserDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
		/**
		 * Select specific fields to fetch from the User
		 */
		select?: UserSelect<ExtArgs> | null
		/**
		 * Omit specific fields from the User
		 */
		omit?: UserOmit<ExtArgs> | null
		/**
		 * Choose, which related nodes to fetch as well
		 */
		include?: UserInclude<ExtArgs> | null
		/**
		 * Filter which User to delete.
		 */
		where: UserWhereUniqueInput
	}

	/**
	 * User deleteMany
	 */
	export type UserDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
		/**
		 * Filter which Users to delete
		 */
		where?: UserWhereInput
		/**
		 * Limit how many Users to delete.
		 */
		limit?: number
	}

	/**
	 * User.tasks
	 */
	export type User$tasksArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
		/**
		 * Select specific fields to fetch from the Task
		 */
		select?: TaskSelect<ExtArgs> | null
		/**
		 * Omit specific fields from the Task
		 */
		omit?: TaskOmit<ExtArgs> | null
		/**
		 * Choose, which related nodes to fetch as well
		 */
		include?: TaskInclude<ExtArgs> | null
		where?: TaskWhereInput
		orderBy?: TaskOrderByWithRelationInput | TaskOrderByWithRelationInput[]
		cursor?: TaskWhereUniqueInput
		take?: number
		skip?: number
		distinct?: TaskScalarFieldEnum | TaskScalarFieldEnum[]
	}

	/**
	 * User.settings
	 */
	export type User$settingsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
		/**
		 * Select specific fields to fetch from the Settings
		 */
		select?: SettingsSelect<ExtArgs> | null
		/**
		 * Omit specific fields from the Settings
		 */
		omit?: SettingsOmit<ExtArgs> | null
		/**
		 * Choose, which related nodes to fetch as well
		 */
		include?: SettingsInclude<ExtArgs> | null
		where?: SettingsWhereInput
	}

	/**
	 * User without action
	 */
	export type UserDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
		/**
		 * Select specific fields to fetch from the User
		 */
		select?: UserSelect<ExtArgs> | null
		/**
		 * Omit specific fields from the User
		 */
		omit?: UserOmit<ExtArgs> | null
		/**
		 * Choose, which related nodes to fetch as well
		 */
		include?: UserInclude<ExtArgs> | null
	}

	/**
	 * Model Task
	 */

	export type AggregateTask = {
		_count: TaskCountAggregateOutputType | null
		_avg: TaskAvgAggregateOutputType | null
		_sum: TaskSumAggregateOutputType | null
		_min: TaskMinAggregateOutputType | null
		_max: TaskMaxAggregateOutputType | null
	}

	export type TaskAvgAggregateOutputType = {
		id: number | null
	}

	export type TaskSumAggregateOutputType = {
		id: number | null
	}

	export type TaskMinAggregateOutputType = {
		id: number | null
		taskId: string | null
		instanceId: string | null
		userId: string | null
		status: string | null
		createdAt: Date | null
		updatedAt: Date | null
	}

	export type TaskMaxAggregateOutputType = {
		id: number | null
		taskId: string | null
		instanceId: string | null
		userId: string | null
		status: string | null
		createdAt: Date | null
		updatedAt: Date | null
	}

	export type TaskCountAggregateOutputType = {
		id: number
		taskId: number
		instanceId: number
		userId: number
		messages: number
		configuration: number
		status: number
		createdAt: number
		updatedAt: number
		_all: number
	}

	export type TaskAvgAggregateInputType = {
		id?: true
	}

	export type TaskSumAggregateInputType = {
		id?: true
	}

	export type TaskMinAggregateInputType = {
		id?: true
		taskId?: true
		instanceId?: true
		userId?: true
		status?: true
		createdAt?: true
		updatedAt?: true
	}

	export type TaskMaxAggregateInputType = {
		id?: true
		taskId?: true
		instanceId?: true
		userId?: true
		status?: true
		createdAt?: true
		updatedAt?: true
	}

	export type TaskCountAggregateInputType = {
		id?: true
		taskId?: true
		instanceId?: true
		userId?: true
		messages?: true
		configuration?: true
		status?: true
		createdAt?: true
		updatedAt?: true
		_all?: true
	}

	export type TaskAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
		/**
		 * Filter which Task to aggregate.
		 */
		where?: TaskWhereInput
		/**
		 * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
		 *
		 * Determine the order of Tasks to fetch.
		 */
		orderBy?: TaskOrderByWithRelationInput | TaskOrderByWithRelationInput[]
		/**
		 * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
		 *
		 * Sets the start position
		 */
		cursor?: TaskWhereUniqueInput
		/**
		 * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
		 *
		 * Take `±n` Tasks from the position of the cursor.
		 */
		take?: number
		/**
		 * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
		 *
		 * Skip the first `n` Tasks.
		 */
		skip?: number
		/**
		 * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
		 *
		 * Count returned Tasks
		 **/
		_count?: true | TaskCountAggregateInputType
		/**
		 * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
		 *
		 * Select which fields to average
		 **/
		_avg?: TaskAvgAggregateInputType
		/**
		 * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
		 *
		 * Select which fields to sum
		 **/
		_sum?: TaskSumAggregateInputType
		/**
		 * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
		 *
		 * Select which fields to find the minimum value
		 **/
		_min?: TaskMinAggregateInputType
		/**
		 * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
		 *
		 * Select which fields to find the maximum value
		 **/
		_max?: TaskMaxAggregateInputType
	}

	export type GetTaskAggregateType<T extends TaskAggregateArgs> = {
		[P in keyof T & keyof AggregateTask]: P extends "_count" | "count"
			? T[P] extends true
				? number
				: GetScalarType<T[P], AggregateTask[P]>
			: GetScalarType<T[P], AggregateTask[P]>
	}

	export type TaskGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
		where?: TaskWhereInput
		orderBy?: TaskOrderByWithAggregationInput | TaskOrderByWithAggregationInput[]
		by: TaskScalarFieldEnum[] | TaskScalarFieldEnum
		having?: TaskScalarWhereWithAggregatesInput
		take?: number
		skip?: number
		_count?: TaskCountAggregateInputType | true
		_avg?: TaskAvgAggregateInputType
		_sum?: TaskSumAggregateInputType
		_min?: TaskMinAggregateInputType
		_max?: TaskMaxAggregateInputType
	}

	export type TaskGroupByOutputType = {
		id: number
		taskId: string
		instanceId: string
		userId: string
		messages: JsonValue
		configuration: JsonValue
		status: string
		createdAt: Date
		updatedAt: Date
		_count: TaskCountAggregateOutputType | null
		_avg: TaskAvgAggregateOutputType | null
		_sum: TaskSumAggregateOutputType | null
		_min: TaskMinAggregateOutputType | null
		_max: TaskMaxAggregateOutputType | null
	}

	type GetTaskGroupByPayload<T extends TaskGroupByArgs> = Prisma.PrismaPromise<
		Array<
			PickEnumerable<TaskGroupByOutputType, T["by"]> & {
				[P in keyof T & keyof TaskGroupByOutputType]: P extends "_count"
					? T[P] extends boolean
						? number
						: GetScalarType<T[P], TaskGroupByOutputType[P]>
					: GetScalarType<T[P], TaskGroupByOutputType[P]>
			}
		>
	>

	export type TaskSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<
		{
			id?: boolean
			taskId?: boolean
			instanceId?: boolean
			userId?: boolean
			messages?: boolean
			configuration?: boolean
			status?: boolean
			createdAt?: boolean
			updatedAt?: boolean
			user?: boolean | UserDefaultArgs<ExtArgs>
			checkpoints?: boolean | Task$checkpointsArgs<ExtArgs>
			_count?: boolean | TaskCountOutputTypeDefaultArgs<ExtArgs>
		},
		ExtArgs["result"]["task"]
	>

	export type TaskSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
		$Extensions.GetSelect<
			{
				id?: boolean
				taskId?: boolean
				instanceId?: boolean
				userId?: boolean
				messages?: boolean
				configuration?: boolean
				status?: boolean
				createdAt?: boolean
				updatedAt?: boolean
				user?: boolean | UserDefaultArgs<ExtArgs>
			},
			ExtArgs["result"]["task"]
		>

	export type TaskSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
		$Extensions.GetSelect<
			{
				id?: boolean
				taskId?: boolean
				instanceId?: boolean
				userId?: boolean
				messages?: boolean
				configuration?: boolean
				status?: boolean
				createdAt?: boolean
				updatedAt?: boolean
				user?: boolean | UserDefaultArgs<ExtArgs>
			},
			ExtArgs["result"]["task"]
		>

	export type TaskSelectScalar = {
		id?: boolean
		taskId?: boolean
		instanceId?: boolean
		userId?: boolean
		messages?: boolean
		configuration?: boolean
		status?: boolean
		createdAt?: boolean
		updatedAt?: boolean
	}

	export type TaskOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<
		"id" | "taskId" | "instanceId" | "userId" | "messages" | "configuration" | "status" | "createdAt" | "updatedAt",
		ExtArgs["result"]["task"]
	>
	export type TaskInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
		user?: boolean | UserDefaultArgs<ExtArgs>
		checkpoints?: boolean | Task$checkpointsArgs<ExtArgs>
		_count?: boolean | TaskCountOutputTypeDefaultArgs<ExtArgs>
	}
	export type TaskIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
		user?: boolean | UserDefaultArgs<ExtArgs>
	}
	export type TaskIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
		user?: boolean | UserDefaultArgs<ExtArgs>
	}

	export type $TaskPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
		name: "Task"
		objects: {
			user: Prisma.$UserPayload<ExtArgs>
			checkpoints: Prisma.$CheckpointPayload<ExtArgs>[]
		}
		scalars: $Extensions.GetPayloadResult<
			{
				id: number
				taskId: string
				instanceId: string
				userId: string
				messages: Prisma.JsonValue
				configuration: Prisma.JsonValue
				status: string
				createdAt: Date
				updatedAt: Date
			},
			ExtArgs["result"]["task"]
		>
		composites: {}
	}

	type TaskGetPayload<S extends boolean | null | undefined | TaskDefaultArgs> = $Result.GetResult<
		Prisma.$TaskPayload,
		S
	>

	type TaskCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = Omit<
		TaskFindManyArgs,
		"select" | "include" | "distinct" | "omit"
	> & {
		select?: TaskCountAggregateInputType | true
	}

	export interface TaskDelegate<
		ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
		GlobalOmitOptions = {},
	> {
		[K: symbol]: { types: Prisma.TypeMap<ExtArgs>["model"]["Task"]; meta: { name: "Task" } }
		/**
		 * Find zero or one Task that matches the filter.
		 * @param {TaskFindUniqueArgs} args - Arguments to find a Task
		 * @example
		 * // Get one Task
		 * const task = await prisma.task.findUnique({
		 *   where: {
		 *     // ... provide filter here
		 *   }
		 * })
		 */
		findUnique<T extends TaskFindUniqueArgs>(
			args: SelectSubset<T, TaskFindUniqueArgs<ExtArgs>>,
		): Prisma__TaskClient<
			$Result.GetResult<Prisma.$TaskPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null,
			null,
			ExtArgs,
			GlobalOmitOptions
		>

		/**
		 * Find one Task that matches the filter or throw an error with `error.code='P2025'`
		 * if no matches were found.
		 * @param {TaskFindUniqueOrThrowArgs} args - Arguments to find a Task
		 * @example
		 * // Get one Task
		 * const task = await prisma.task.findUniqueOrThrow({
		 *   where: {
		 *     // ... provide filter here
		 *   }
		 * })
		 */
		findUniqueOrThrow<T extends TaskFindUniqueOrThrowArgs>(
			args: SelectSubset<T, TaskFindUniqueOrThrowArgs<ExtArgs>>,
		): Prisma__TaskClient<
			$Result.GetResult<Prisma.$TaskPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>,
			never,
			ExtArgs,
			GlobalOmitOptions
		>

		/**
		 * Find the first Task that matches the filter.
		 * Note, that providing `undefined` is treated as the value not being there.
		 * Read more here: https://pris.ly/d/null-undefined
		 * @param {TaskFindFirstArgs} args - Arguments to find a Task
		 * @example
		 * // Get one Task
		 * const task = await prisma.task.findFirst({
		 *   where: {
		 *     // ... provide filter here
		 *   }
		 * })
		 */
		findFirst<T extends TaskFindFirstArgs>(
			args?: SelectSubset<T, TaskFindFirstArgs<ExtArgs>>,
		): Prisma__TaskClient<
			$Result.GetResult<Prisma.$TaskPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null,
			null,
			ExtArgs,
			GlobalOmitOptions
		>

		/**
		 * Find the first Task that matches the filter or
		 * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
		 * Note, that providing `undefined` is treated as the value not being there.
		 * Read more here: https://pris.ly/d/null-undefined
		 * @param {TaskFindFirstOrThrowArgs} args - Arguments to find a Task
		 * @example
		 * // Get one Task
		 * const task = await prisma.task.findFirstOrThrow({
		 *   where: {
		 *     // ... provide filter here
		 *   }
		 * })
		 */
		findFirstOrThrow<T extends TaskFindFirstOrThrowArgs>(
			args?: SelectSubset<T, TaskFindFirstOrThrowArgs<ExtArgs>>,
		): Prisma__TaskClient<
			$Result.GetResult<Prisma.$TaskPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>,
			never,
			ExtArgs,
			GlobalOmitOptions
		>

		/**
		 * Find zero or more Tasks that matches the filter.
		 * Note, that providing `undefined` is treated as the value not being there.
		 * Read more here: https://pris.ly/d/null-undefined
		 * @param {TaskFindManyArgs} args - Arguments to filter and select certain fields only.
		 * @example
		 * // Get all Tasks
		 * const tasks = await prisma.task.findMany()
		 *
		 * // Get first 10 Tasks
		 * const tasks = await prisma.task.findMany({ take: 10 })
		 *
		 * // Only select the `id`
		 * const taskWithIdOnly = await prisma.task.findMany({ select: { id: true } })
		 *
		 */
		findMany<T extends TaskFindManyArgs>(
			args?: SelectSubset<T, TaskFindManyArgs<ExtArgs>>,
		): Prisma.PrismaPromise<$Result.GetResult<Prisma.$TaskPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

		/**
		 * Create a Task.
		 * @param {TaskCreateArgs} args - Arguments to create a Task.
		 * @example
		 * // Create one Task
		 * const Task = await prisma.task.create({
		 *   data: {
		 *     // ... data to create a Task
		 *   }
		 * })
		 *
		 */
		create<T extends TaskCreateArgs>(
			args: SelectSubset<T, TaskCreateArgs<ExtArgs>>,
		): Prisma__TaskClient<
			$Result.GetResult<Prisma.$TaskPayload<ExtArgs>, T, "create", GlobalOmitOptions>,
			never,
			ExtArgs,
			GlobalOmitOptions
		>

		/**
		 * Create many Tasks.
		 * @param {TaskCreateManyArgs} args - Arguments to create many Tasks.
		 * @example
		 * // Create many Tasks
		 * const task = await prisma.task.createMany({
		 *   data: [
		 *     // ... provide data here
		 *   ]
		 * })
		 *
		 */
		createMany<T extends TaskCreateManyArgs>(
			args?: SelectSubset<T, TaskCreateManyArgs<ExtArgs>>,
		): Prisma.PrismaPromise<BatchPayload>

		/**
		 * Create many Tasks and returns the data saved in the database.
		 * @param {TaskCreateManyAndReturnArgs} args - Arguments to create many Tasks.
		 * @example
		 * // Create many Tasks
		 * const task = await prisma.task.createManyAndReturn({
		 *   data: [
		 *     // ... provide data here
		 *   ]
		 * })
		 *
		 * // Create many Tasks and only return the `id`
		 * const taskWithIdOnly = await prisma.task.createManyAndReturn({
		 *   select: { id: true },
		 *   data: [
		 *     // ... provide data here
		 *   ]
		 * })
		 * Note, that providing `undefined` is treated as the value not being there.
		 * Read more here: https://pris.ly/d/null-undefined
		 *
		 */
		createManyAndReturn<T extends TaskCreateManyAndReturnArgs>(
			args?: SelectSubset<T, TaskCreateManyAndReturnArgs<ExtArgs>>,
		): Prisma.PrismaPromise<
			$Result.GetResult<Prisma.$TaskPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>
		>

		/**
		 * Delete a Task.
		 * @param {TaskDeleteArgs} args - Arguments to delete one Task.
		 * @example
		 * // Delete one Task
		 * const Task = await prisma.task.delete({
		 *   where: {
		 *     // ... filter to delete one Task
		 *   }
		 * })
		 *
		 */
		delete<T extends TaskDeleteArgs>(
			args: SelectSubset<T, TaskDeleteArgs<ExtArgs>>,
		): Prisma__TaskClient<
			$Result.GetResult<Prisma.$TaskPayload<ExtArgs>, T, "delete", GlobalOmitOptions>,
			never,
			ExtArgs,
			GlobalOmitOptions
		>

		/**
		 * Update one Task.
		 * @param {TaskUpdateArgs} args - Arguments to update one Task.
		 * @example
		 * // Update one Task
		 * const task = await prisma.task.update({
		 *   where: {
		 *     // ... provide filter here
		 *   },
		 *   data: {
		 *     // ... provide data here
		 *   }
		 * })
		 *
		 */
		update<T extends TaskUpdateArgs>(
			args: SelectSubset<T, TaskUpdateArgs<ExtArgs>>,
		): Prisma__TaskClient<
			$Result.GetResult<Prisma.$TaskPayload<ExtArgs>, T, "update", GlobalOmitOptions>,
			never,
			ExtArgs,
			GlobalOmitOptions
		>

		/**
		 * Delete zero or more Tasks.
		 * @param {TaskDeleteManyArgs} args - Arguments to filter Tasks to delete.
		 * @example
		 * // Delete a few Tasks
		 * const { count } = await prisma.task.deleteMany({
		 *   where: {
		 *     // ... provide filter here
		 *   }
		 * })
		 *
		 */
		deleteMany<T extends TaskDeleteManyArgs>(
			args?: SelectSubset<T, TaskDeleteManyArgs<ExtArgs>>,
		): Prisma.PrismaPromise<BatchPayload>

		/**
		 * Update zero or more Tasks.
		 * Note, that providing `undefined` is treated as the value not being there.
		 * Read more here: https://pris.ly/d/null-undefined
		 * @param {TaskUpdateManyArgs} args - Arguments to update one or more rows.
		 * @example
		 * // Update many Tasks
		 * const task = await prisma.task.updateMany({
		 *   where: {
		 *     // ... provide filter here
		 *   },
		 *   data: {
		 *     // ... provide data here
		 *   }
		 * })
		 *
		 */
		updateMany<T extends TaskUpdateManyArgs>(
			args: SelectSubset<T, TaskUpdateManyArgs<ExtArgs>>,
		): Prisma.PrismaPromise<BatchPayload>

		/**
		 * Update zero or more Tasks and returns the data updated in the database.
		 * @param {TaskUpdateManyAndReturnArgs} args - Arguments to update many Tasks.
		 * @example
		 * // Update many Tasks
		 * const task = await prisma.task.updateManyAndReturn({
		 *   where: {
		 *     // ... provide filter here
		 *   },
		 *   data: [
		 *     // ... provide data here
		 *   ]
		 * })
		 *
		 * // Update zero or more Tasks and only return the `id`
		 * const taskWithIdOnly = await prisma.task.updateManyAndReturn({
		 *   select: { id: true },
		 *   where: {
		 *     // ... provide filter here
		 *   },
		 *   data: [
		 *     // ... provide data here
		 *   ]
		 * })
		 * Note, that providing `undefined` is treated as the value not being there.
		 * Read more here: https://pris.ly/d/null-undefined
		 *
		 */
		updateManyAndReturn<T extends TaskUpdateManyAndReturnArgs>(
			args: SelectSubset<T, TaskUpdateManyAndReturnArgs<ExtArgs>>,
		): Prisma.PrismaPromise<
			$Result.GetResult<Prisma.$TaskPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>
		>

		/**
		 * Create or update one Task.
		 * @param {TaskUpsertArgs} args - Arguments to update or create a Task.
		 * @example
		 * // Update or create a Task
		 * const task = await prisma.task.upsert({
		 *   create: {
		 *     // ... data to create a Task
		 *   },
		 *   update: {
		 *     // ... in case it already exists, update
		 *   },
		 *   where: {
		 *     // ... the filter for the Task we want to update
		 *   }
		 * })
		 */
		upsert<T extends TaskUpsertArgs>(
			args: SelectSubset<T, TaskUpsertArgs<ExtArgs>>,
		): Prisma__TaskClient<
			$Result.GetResult<Prisma.$TaskPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>,
			never,
			ExtArgs,
			GlobalOmitOptions
		>

		/**
		 * Count the number of Tasks.
		 * Note, that providing `undefined` is treated as the value not being there.
		 * Read more here: https://pris.ly/d/null-undefined
		 * @param {TaskCountArgs} args - Arguments to filter Tasks to count.
		 * @example
		 * // Count the number of Tasks
		 * const count = await prisma.task.count({
		 *   where: {
		 *     // ... the filter for the Tasks we want to count
		 *   }
		 * })
		 **/
		count<T extends TaskCountArgs>(
			args?: Subset<T, TaskCountArgs>,
		): Prisma.PrismaPromise<
			T extends $Utils.Record<"select", any>
				? T["select"] extends true
					? number
					: GetScalarType<T["select"], TaskCountAggregateOutputType>
				: number
		>

		/**
		 * Allows you to perform aggregations operations on a Task.
		 * Note, that providing `undefined` is treated as the value not being there.
		 * Read more here: https://pris.ly/d/null-undefined
		 * @param {TaskAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
		 * @example
		 * // Ordered by age ascending
		 * // Where email contains prisma.io
		 * // Limited to the 10 users
		 * const aggregations = await prisma.user.aggregate({
		 *   _avg: {
		 *     age: true,
		 *   },
		 *   where: {
		 *     email: {
		 *       contains: "prisma.io",
		 *     },
		 *   },
		 *   orderBy: {
		 *     age: "asc",
		 *   },
		 *   take: 10,
		 * })
		 **/
		aggregate<T extends TaskAggregateArgs>(
			args: Subset<T, TaskAggregateArgs>,
		): Prisma.PrismaPromise<GetTaskAggregateType<T>>

		/**
		 * Group by Task.
		 * Note, that providing `undefined` is treated as the value not being there.
		 * Read more here: https://pris.ly/d/null-undefined
		 * @param {TaskGroupByArgs} args - Group by arguments.
		 * @example
		 * // Group by city, order by createdAt, get count
		 * const result = await prisma.user.groupBy({
		 *   by: ['city', 'createdAt'],
		 *   orderBy: {
		 *     createdAt: true
		 *   },
		 *   _count: {
		 *     _all: true
		 *   },
		 * })
		 *
		 **/
		groupBy<
			T extends TaskGroupByArgs,
			HasSelectOrTake extends Or<Extends<"skip", Keys<T>>, Extends<"take", Keys<T>>>,
			OrderByArg extends True extends HasSelectOrTake
				? { orderBy: TaskGroupByArgs["orderBy"] }
				: { orderBy?: TaskGroupByArgs["orderBy"] },
			OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T["orderBy"]>>>,
			ByFields extends MaybeTupleToUnion<T["by"]>,
			ByValid extends Has<ByFields, OrderFields>,
			HavingFields extends GetHavingFields<T["having"]>,
			HavingValid extends Has<ByFields, HavingFields>,
			ByEmpty extends T["by"] extends never[] ? True : False,
			InputErrors extends ByEmpty extends True
				? `Error: "by" must not be empty.`
				: HavingValid extends False
					? {
							[P in HavingFields]: P extends ByFields
								? never
								: P extends string
									? `Error: Field "${P}" used in "having" needs to be provided in "by".`
									: [Error, "Field ", P, ` in "having" needs to be provided in "by"`]
						}[HavingFields]
					: "take" extends Keys<T>
						? "orderBy" extends Keys<T>
							? ByValid extends True
								? {}
								: {
										[P in OrderFields]: P extends ByFields
											? never
											: `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
									}[OrderFields]
							: 'Error: If you provide "take", you also need to provide "orderBy"'
						: "skip" extends Keys<T>
							? "orderBy" extends Keys<T>
								? ByValid extends True
									? {}
									: {
											[P in OrderFields]: P extends ByFields
												? never
												: `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
										}[OrderFields]
								: 'Error: If you provide "skip", you also need to provide "orderBy"'
							: ByValid extends True
								? {}
								: {
										[P in OrderFields]: P extends ByFields
											? never
											: `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
									}[OrderFields],
		>(
			args: SubsetIntersection<T, TaskGroupByArgs, OrderByArg> & InputErrors,
		): {} extends InputErrors ? GetTaskGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
		/**
		 * Fields of the Task model
		 */
		readonly fields: TaskFieldRefs
	}

	/**
	 * The delegate class that acts as a "Promise-like" for Task.
	 * Why is this prefixed with `Prisma__`?
	 * Because we want to prevent naming conflicts as mentioned in
	 * https://github.com/prisma/prisma-client-js/issues/707
	 */
	export interface Prisma__TaskClient<
		T,
		Null = never,
		ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
		GlobalOmitOptions = {},
	> extends Prisma.PrismaPromise<T> {
		readonly [Symbol.toStringTag]: "PrismaPromise"
		user<T extends UserDefaultArgs<ExtArgs> = {}>(
			args?: Subset<T, UserDefaultArgs<ExtArgs>>,
		): Prisma__UserClient<
			$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null,
			Null,
			ExtArgs,
			GlobalOmitOptions
		>
		checkpoints<T extends Task$checkpointsArgs<ExtArgs> = {}>(
			args?: Subset<T, Task$checkpointsArgs<ExtArgs>>,
		): Prisma.PrismaPromise<
			$Result.GetResult<Prisma.$CheckpointPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null
		>
		/**
		 * Attaches callbacks for the resolution and/or rejection of the Promise.
		 * @param onfulfilled The callback to execute when the Promise is resolved.
		 * @param onrejected The callback to execute when the Promise is rejected.
		 * @returns A Promise for the completion of which ever callback is executed.
		 */
		then<TResult1 = T, TResult2 = never>(
			onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null,
			onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null,
		): $Utils.JsPromise<TResult1 | TResult2>
		/**
		 * Attaches a callback for only the rejection of the Promise.
		 * @param onrejected The callback to execute when the Promise is rejected.
		 * @returns A Promise for the completion of the callback.
		 */
		catch<TResult = never>(
			onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null,
		): $Utils.JsPromise<T | TResult>
		/**
		 * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
		 * resolved value cannot be modified from the callback.
		 * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
		 * @returns A Promise for the completion of the callback.
		 */
		finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
	}

	/**
	 * Fields of the Task model
	 */
	interface TaskFieldRefs {
		readonly id: FieldRef<"Task", "Int">
		readonly taskId: FieldRef<"Task", "String">
		readonly instanceId: FieldRef<"Task", "String">
		readonly userId: FieldRef<"Task", "String">
		readonly messages: FieldRef<"Task", "Json">
		readonly configuration: FieldRef<"Task", "Json">
		readonly status: FieldRef<"Task", "String">
		readonly createdAt: FieldRef<"Task", "DateTime">
		readonly updatedAt: FieldRef<"Task", "DateTime">
	}

	// Custom InputTypes
	/**
	 * Task findUnique
	 */
	export type TaskFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
		/**
		 * Select specific fields to fetch from the Task
		 */
		select?: TaskSelect<ExtArgs> | null
		/**
		 * Omit specific fields from the Task
		 */
		omit?: TaskOmit<ExtArgs> | null
		/**
		 * Choose, which related nodes to fetch as well
		 */
		include?: TaskInclude<ExtArgs> | null
		/**
		 * Filter, which Task to fetch.
		 */
		where: TaskWhereUniqueInput
	}

	/**
	 * Task findUniqueOrThrow
	 */
	export type TaskFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
		/**
		 * Select specific fields to fetch from the Task
		 */
		select?: TaskSelect<ExtArgs> | null
		/**
		 * Omit specific fields from the Task
		 */
		omit?: TaskOmit<ExtArgs> | null
		/**
		 * Choose, which related nodes to fetch as well
		 */
		include?: TaskInclude<ExtArgs> | null
		/**
		 * Filter, which Task to fetch.
		 */
		where: TaskWhereUniqueInput
	}

	/**
	 * Task findFirst
	 */
	export type TaskFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
		/**
		 * Select specific fields to fetch from the Task
		 */
		select?: TaskSelect<ExtArgs> | null
		/**
		 * Omit specific fields from the Task
		 */
		omit?: TaskOmit<ExtArgs> | null
		/**
		 * Choose, which related nodes to fetch as well
		 */
		include?: TaskInclude<ExtArgs> | null
		/**
		 * Filter, which Task to fetch.
		 */
		where?: TaskWhereInput
		/**
		 * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
		 *
		 * Determine the order of Tasks to fetch.
		 */
		orderBy?: TaskOrderByWithRelationInput | TaskOrderByWithRelationInput[]
		/**
		 * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
		 *
		 * Sets the position for searching for Tasks.
		 */
		cursor?: TaskWhereUniqueInput
		/**
		 * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
		 *
		 * Take `±n` Tasks from the position of the cursor.
		 */
		take?: number
		/**
		 * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
		 *
		 * Skip the first `n` Tasks.
		 */
		skip?: number
		/**
		 * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
		 *
		 * Filter by unique combinations of Tasks.
		 */
		distinct?: TaskScalarFieldEnum | TaskScalarFieldEnum[]
	}

	/**
	 * Task findFirstOrThrow
	 */
	export type TaskFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
		/**
		 * Select specific fields to fetch from the Task
		 */
		select?: TaskSelect<ExtArgs> | null
		/**
		 * Omit specific fields from the Task
		 */
		omit?: TaskOmit<ExtArgs> | null
		/**
		 * Choose, which related nodes to fetch as well
		 */
		include?: TaskInclude<ExtArgs> | null
		/**
		 * Filter, which Task to fetch.
		 */
		where?: TaskWhereInput
		/**
		 * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
		 *
		 * Determine the order of Tasks to fetch.
		 */
		orderBy?: TaskOrderByWithRelationInput | TaskOrderByWithRelationInput[]
		/**
		 * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
		 *
		 * Sets the position for searching for Tasks.
		 */
		cursor?: TaskWhereUniqueInput
		/**
		 * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
		 *
		 * Take `±n` Tasks from the position of the cursor.
		 */
		take?: number
		/**
		 * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
		 *
		 * Skip the first `n` Tasks.
		 */
		skip?: number
		/**
		 * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
		 *
		 * Filter by unique combinations of Tasks.
		 */
		distinct?: TaskScalarFieldEnum | TaskScalarFieldEnum[]
	}

	/**
	 * Task findMany
	 */
	export type TaskFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
		/**
		 * Select specific fields to fetch from the Task
		 */
		select?: TaskSelect<ExtArgs> | null
		/**
		 * Omit specific fields from the Task
		 */
		omit?: TaskOmit<ExtArgs> | null
		/**
		 * Choose, which related nodes to fetch as well
		 */
		include?: TaskInclude<ExtArgs> | null
		/**
		 * Filter, which Tasks to fetch.
		 */
		where?: TaskWhereInput
		/**
		 * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
		 *
		 * Determine the order of Tasks to fetch.
		 */
		orderBy?: TaskOrderByWithRelationInput | TaskOrderByWithRelationInput[]
		/**
		 * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
		 *
		 * Sets the position for listing Tasks.
		 */
		cursor?: TaskWhereUniqueInput
		/**
		 * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
		 *
		 * Take `±n` Tasks from the position of the cursor.
		 */
		take?: number
		/**
		 * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
		 *
		 * Skip the first `n` Tasks.
		 */
		skip?: number
		distinct?: TaskScalarFieldEnum | TaskScalarFieldEnum[]
	}

	/**
	 * Task create
	 */
	export type TaskCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
		/**
		 * Select specific fields to fetch from the Task
		 */
		select?: TaskSelect<ExtArgs> | null
		/**
		 * Omit specific fields from the Task
		 */
		omit?: TaskOmit<ExtArgs> | null
		/**
		 * Choose, which related nodes to fetch as well
		 */
		include?: TaskInclude<ExtArgs> | null
		/**
		 * The data needed to create a Task.
		 */
		data: XOR<TaskCreateInput, TaskUncheckedCreateInput>
	}

	/**
	 * Task createMany
	 */
	export type TaskCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
		/**
		 * The data used to create many Tasks.
		 */
		data: TaskCreateManyInput | TaskCreateManyInput[]
		skipDuplicates?: boolean
	}

	/**
	 * Task createManyAndReturn
	 */
	export type TaskCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
		/**
		 * Select specific fields to fetch from the Task
		 */
		select?: TaskSelectCreateManyAndReturn<ExtArgs> | null
		/**
		 * Omit specific fields from the Task
		 */
		omit?: TaskOmit<ExtArgs> | null
		/**
		 * The data used to create many Tasks.
		 */
		data: TaskCreateManyInput | TaskCreateManyInput[]
		skipDuplicates?: boolean
		/**
		 * Choose, which related nodes to fetch as well
		 */
		include?: TaskIncludeCreateManyAndReturn<ExtArgs> | null
	}

	/**
	 * Task update
	 */
	export type TaskUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
		/**
		 * Select specific fields to fetch from the Task
		 */
		select?: TaskSelect<ExtArgs> | null
		/**
		 * Omit specific fields from the Task
		 */
		omit?: TaskOmit<ExtArgs> | null
		/**
		 * Choose, which related nodes to fetch as well
		 */
		include?: TaskInclude<ExtArgs> | null
		/**
		 * The data needed to update a Task.
		 */
		data: XOR<TaskUpdateInput, TaskUncheckedUpdateInput>
		/**
		 * Choose, which Task to update.
		 */
		where: TaskWhereUniqueInput
	}

	/**
	 * Task updateMany
	 */
	export type TaskUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
		/**
		 * The data used to update Tasks.
		 */
		data: XOR<TaskUpdateManyMutationInput, TaskUncheckedUpdateManyInput>
		/**
		 * Filter which Tasks to update
		 */
		where?: TaskWhereInput
		/**
		 * Limit how many Tasks to update.
		 */
		limit?: number
	}

	/**
	 * Task updateManyAndReturn
	 */
	export type TaskUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
		/**
		 * Select specific fields to fetch from the Task
		 */
		select?: TaskSelectUpdateManyAndReturn<ExtArgs> | null
		/**
		 * Omit specific fields from the Task
		 */
		omit?: TaskOmit<ExtArgs> | null
		/**
		 * The data used to update Tasks.
		 */
		data: XOR<TaskUpdateManyMutationInput, TaskUncheckedUpdateManyInput>
		/**
		 * Filter which Tasks to update
		 */
		where?: TaskWhereInput
		/**
		 * Limit how many Tasks to update.
		 */
		limit?: number
		/**
		 * Choose, which related nodes to fetch as well
		 */
		include?: TaskIncludeUpdateManyAndReturn<ExtArgs> | null
	}

	/**
	 * Task upsert
	 */
	export type TaskUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
		/**
		 * Select specific fields to fetch from the Task
		 */
		select?: TaskSelect<ExtArgs> | null
		/**
		 * Omit specific fields from the Task
		 */
		omit?: TaskOmit<ExtArgs> | null
		/**
		 * Choose, which related nodes to fetch as well
		 */
		include?: TaskInclude<ExtArgs> | null
		/**
		 * The filter to search for the Task to update in case it exists.
		 */
		where: TaskWhereUniqueInput
		/**
		 * In case the Task found by the `where` argument doesn't exist, create a new Task with this data.
		 */
		create: XOR<TaskCreateInput, TaskUncheckedCreateInput>
		/**
		 * In case the Task was found with the provided `where` argument, update it with this data.
		 */
		update: XOR<TaskUpdateInput, TaskUncheckedUpdateInput>
	}

	/**
	 * Task delete
	 */
	export type TaskDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
		/**
		 * Select specific fields to fetch from the Task
		 */
		select?: TaskSelect<ExtArgs> | null
		/**
		 * Omit specific fields from the Task
		 */
		omit?: TaskOmit<ExtArgs> | null
		/**
		 * Choose, which related nodes to fetch as well
		 */
		include?: TaskInclude<ExtArgs> | null
		/**
		 * Filter which Task to delete.
		 */
		where: TaskWhereUniqueInput
	}

	/**
	 * Task deleteMany
	 */
	export type TaskDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
		/**
		 * Filter which Tasks to delete
		 */
		where?: TaskWhereInput
		/**
		 * Limit how many Tasks to delete.
		 */
		limit?: number
	}

	/**
	 * Task.checkpoints
	 */
	export type Task$checkpointsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
		/**
		 * Select specific fields to fetch from the Checkpoint
		 */
		select?: CheckpointSelect<ExtArgs> | null
		/**
		 * Omit specific fields from the Checkpoint
		 */
		omit?: CheckpointOmit<ExtArgs> | null
		/**
		 * Choose, which related nodes to fetch as well
		 */
		include?: CheckpointInclude<ExtArgs> | null
		where?: CheckpointWhereInput
		orderBy?: CheckpointOrderByWithRelationInput | CheckpointOrderByWithRelationInput[]
		cursor?: CheckpointWhereUniqueInput
		take?: number
		skip?: number
		distinct?: CheckpointScalarFieldEnum | CheckpointScalarFieldEnum[]
	}

	/**
	 * Task without action
	 */
	export type TaskDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
		/**
		 * Select specific fields to fetch from the Task
		 */
		select?: TaskSelect<ExtArgs> | null
		/**
		 * Omit specific fields from the Task
		 */
		omit?: TaskOmit<ExtArgs> | null
		/**
		 * Choose, which related nodes to fetch as well
		 */
		include?: TaskInclude<ExtArgs> | null
	}

	/**
	 * Model Checkpoint
	 */

	export type AggregateCheckpoint = {
		_count: CheckpointCountAggregateOutputType | null
		_avg: CheckpointAvgAggregateOutputType | null
		_sum: CheckpointSumAggregateOutputType | null
		_min: CheckpointMinAggregateOutputType | null
		_max: CheckpointMaxAggregateOutputType | null
	}

	export type CheckpointAvgAggregateOutputType = {
		id: number | null
		timestamp: number | null
	}

	export type CheckpointSumAggregateOutputType = {
		id: number | null
		timestamp: bigint | null
	}

	export type CheckpointMinAggregateOutputType = {
		id: number | null
		taskId: string | null
		timestamp: bigint | null
		createdAt: Date | null
	}

	export type CheckpointMaxAggregateOutputType = {
		id: number | null
		taskId: string | null
		timestamp: bigint | null
		createdAt: Date | null
	}

	export type CheckpointCountAggregateOutputType = {
		id: number
		taskId: number
		data: number
		timestamp: number
		createdAt: number
		_all: number
	}

	export type CheckpointAvgAggregateInputType = {
		id?: true
		timestamp?: true
	}

	export type CheckpointSumAggregateInputType = {
		id?: true
		timestamp?: true
	}

	export type CheckpointMinAggregateInputType = {
		id?: true
		taskId?: true
		timestamp?: true
		createdAt?: true
	}

	export type CheckpointMaxAggregateInputType = {
		id?: true
		taskId?: true
		timestamp?: true
		createdAt?: true
	}

	export type CheckpointCountAggregateInputType = {
		id?: true
		taskId?: true
		data?: true
		timestamp?: true
		createdAt?: true
		_all?: true
	}

	export type CheckpointAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
		/**
		 * Filter which Checkpoint to aggregate.
		 */
		where?: CheckpointWhereInput
		/**
		 * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
		 *
		 * Determine the order of Checkpoints to fetch.
		 */
		orderBy?: CheckpointOrderByWithRelationInput | CheckpointOrderByWithRelationInput[]
		/**
		 * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
		 *
		 * Sets the start position
		 */
		cursor?: CheckpointWhereUniqueInput
		/**
		 * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
		 *
		 * Take `±n` Checkpoints from the position of the cursor.
		 */
		take?: number
		/**
		 * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
		 *
		 * Skip the first `n` Checkpoints.
		 */
		skip?: number
		/**
		 * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
		 *
		 * Count returned Checkpoints
		 **/
		_count?: true | CheckpointCountAggregateInputType
		/**
		 * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
		 *
		 * Select which fields to average
		 **/
		_avg?: CheckpointAvgAggregateInputType
		/**
		 * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
		 *
		 * Select which fields to sum
		 **/
		_sum?: CheckpointSumAggregateInputType
		/**
		 * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
		 *
		 * Select which fields to find the minimum value
		 **/
		_min?: CheckpointMinAggregateInputType
		/**
		 * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
		 *
		 * Select which fields to find the maximum value
		 **/
		_max?: CheckpointMaxAggregateInputType
	}

	export type GetCheckpointAggregateType<T extends CheckpointAggregateArgs> = {
		[P in keyof T & keyof AggregateCheckpoint]: P extends "_count" | "count"
			? T[P] extends true
				? number
				: GetScalarType<T[P], AggregateCheckpoint[P]>
			: GetScalarType<T[P], AggregateCheckpoint[P]>
	}

	export type CheckpointGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
		where?: CheckpointWhereInput
		orderBy?: CheckpointOrderByWithAggregationInput | CheckpointOrderByWithAggregationInput[]
		by: CheckpointScalarFieldEnum[] | CheckpointScalarFieldEnum
		having?: CheckpointScalarWhereWithAggregatesInput
		take?: number
		skip?: number
		_count?: CheckpointCountAggregateInputType | true
		_avg?: CheckpointAvgAggregateInputType
		_sum?: CheckpointSumAggregateInputType
		_min?: CheckpointMinAggregateInputType
		_max?: CheckpointMaxAggregateInputType
	}

	export type CheckpointGroupByOutputType = {
		id: number
		taskId: string
		data: JsonValue
		timestamp: bigint
		createdAt: Date
		_count: CheckpointCountAggregateOutputType | null
		_avg: CheckpointAvgAggregateOutputType | null
		_sum: CheckpointSumAggregateOutputType | null
		_min: CheckpointMinAggregateOutputType | null
		_max: CheckpointMaxAggregateOutputType | null
	}

	type GetCheckpointGroupByPayload<T extends CheckpointGroupByArgs> = Prisma.PrismaPromise<
		Array<
			PickEnumerable<CheckpointGroupByOutputType, T["by"]> & {
				[P in keyof T & keyof CheckpointGroupByOutputType]: P extends "_count"
					? T[P] extends boolean
						? number
						: GetScalarType<T[P], CheckpointGroupByOutputType[P]>
					: GetScalarType<T[P], CheckpointGroupByOutputType[P]>
			}
		>
	>

	export type CheckpointSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
		$Extensions.GetSelect<
			{
				id?: boolean
				taskId?: boolean
				data?: boolean
				timestamp?: boolean
				createdAt?: boolean
				task?: boolean | TaskDefaultArgs<ExtArgs>
			},
			ExtArgs["result"]["checkpoint"]
		>

	export type CheckpointSelectCreateManyAndReturn<
		ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
	> = $Extensions.GetSelect<
		{
			id?: boolean
			taskId?: boolean
			data?: boolean
			timestamp?: boolean
			createdAt?: boolean
			task?: boolean | TaskDefaultArgs<ExtArgs>
		},
		ExtArgs["result"]["checkpoint"]
	>

	export type CheckpointSelectUpdateManyAndReturn<
		ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
	> = $Extensions.GetSelect<
		{
			id?: boolean
			taskId?: boolean
			data?: boolean
			timestamp?: boolean
			createdAt?: boolean
			task?: boolean | TaskDefaultArgs<ExtArgs>
		},
		ExtArgs["result"]["checkpoint"]
	>

	export type CheckpointSelectScalar = {
		id?: boolean
		taskId?: boolean
		data?: boolean
		timestamp?: boolean
		createdAt?: boolean
	}

	export type CheckpointOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
		$Extensions.GetOmit<"id" | "taskId" | "data" | "timestamp" | "createdAt", ExtArgs["result"]["checkpoint"]>
	export type CheckpointInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
		task?: boolean | TaskDefaultArgs<ExtArgs>
	}
	export type CheckpointIncludeCreateManyAndReturn<
		ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
	> = {
		task?: boolean | TaskDefaultArgs<ExtArgs>
	}
	export type CheckpointIncludeUpdateManyAndReturn<
		ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
	> = {
		task?: boolean | TaskDefaultArgs<ExtArgs>
	}

	export type $CheckpointPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
		name: "Checkpoint"
		objects: {
			task: Prisma.$TaskPayload<ExtArgs>
		}
		scalars: $Extensions.GetPayloadResult<
			{
				id: number
				taskId: string
				data: Prisma.JsonValue
				timestamp: bigint
				createdAt: Date
			},
			ExtArgs["result"]["checkpoint"]
		>
		composites: {}
	}

	type CheckpointGetPayload<S extends boolean | null | undefined | CheckpointDefaultArgs> = $Result.GetResult<
		Prisma.$CheckpointPayload,
		S
	>

	type CheckpointCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = Omit<
		CheckpointFindManyArgs,
		"select" | "include" | "distinct" | "omit"
	> & {
		select?: CheckpointCountAggregateInputType | true
	}

	export interface CheckpointDelegate<
		ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
		GlobalOmitOptions = {},
	> {
		[K: symbol]: { types: Prisma.TypeMap<ExtArgs>["model"]["Checkpoint"]; meta: { name: "Checkpoint" } }
		/**
		 * Find zero or one Checkpoint that matches the filter.
		 * @param {CheckpointFindUniqueArgs} args - Arguments to find a Checkpoint
		 * @example
		 * // Get one Checkpoint
		 * const checkpoint = await prisma.checkpoint.findUnique({
		 *   where: {
		 *     // ... provide filter here
		 *   }
		 * })
		 */
		findUnique<T extends CheckpointFindUniqueArgs>(
			args: SelectSubset<T, CheckpointFindUniqueArgs<ExtArgs>>,
		): Prisma__CheckpointClient<
			$Result.GetResult<Prisma.$CheckpointPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null,
			null,
			ExtArgs,
			GlobalOmitOptions
		>

		/**
		 * Find one Checkpoint that matches the filter or throw an error with `error.code='P2025'`
		 * if no matches were found.
		 * @param {CheckpointFindUniqueOrThrowArgs} args - Arguments to find a Checkpoint
		 * @example
		 * // Get one Checkpoint
		 * const checkpoint = await prisma.checkpoint.findUniqueOrThrow({
		 *   where: {
		 *     // ... provide filter here
		 *   }
		 * })
		 */
		findUniqueOrThrow<T extends CheckpointFindUniqueOrThrowArgs>(
			args: SelectSubset<T, CheckpointFindUniqueOrThrowArgs<ExtArgs>>,
		): Prisma__CheckpointClient<
			$Result.GetResult<Prisma.$CheckpointPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>,
			never,
			ExtArgs,
			GlobalOmitOptions
		>

		/**
		 * Find the first Checkpoint that matches the filter.
		 * Note, that providing `undefined` is treated as the value not being there.
		 * Read more here: https://pris.ly/d/null-undefined
		 * @param {CheckpointFindFirstArgs} args - Arguments to find a Checkpoint
		 * @example
		 * // Get one Checkpoint
		 * const checkpoint = await prisma.checkpoint.findFirst({
		 *   where: {
		 *     // ... provide filter here
		 *   }
		 * })
		 */
		findFirst<T extends CheckpointFindFirstArgs>(
			args?: SelectSubset<T, CheckpointFindFirstArgs<ExtArgs>>,
		): Prisma__CheckpointClient<
			$Result.GetResult<Prisma.$CheckpointPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null,
			null,
			ExtArgs,
			GlobalOmitOptions
		>

		/**
		 * Find the first Checkpoint that matches the filter or
		 * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
		 * Note, that providing `undefined` is treated as the value not being there.
		 * Read more here: https://pris.ly/d/null-undefined
		 * @param {CheckpointFindFirstOrThrowArgs} args - Arguments to find a Checkpoint
		 * @example
		 * // Get one Checkpoint
		 * const checkpoint = await prisma.checkpoint.findFirstOrThrow({
		 *   where: {
		 *     // ... provide filter here
		 *   }
		 * })
		 */
		findFirstOrThrow<T extends CheckpointFindFirstOrThrowArgs>(
			args?: SelectSubset<T, CheckpointFindFirstOrThrowArgs<ExtArgs>>,
		): Prisma__CheckpointClient<
			$Result.GetResult<Prisma.$CheckpointPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>,
			never,
			ExtArgs,
			GlobalOmitOptions
		>

		/**
		 * Find zero or more Checkpoints that matches the filter.
		 * Note, that providing `undefined` is treated as the value not being there.
		 * Read more here: https://pris.ly/d/null-undefined
		 * @param {CheckpointFindManyArgs} args - Arguments to filter and select certain fields only.
		 * @example
		 * // Get all Checkpoints
		 * const checkpoints = await prisma.checkpoint.findMany()
		 *
		 * // Get first 10 Checkpoints
		 * const checkpoints = await prisma.checkpoint.findMany({ take: 10 })
		 *
		 * // Only select the `id`
		 * const checkpointWithIdOnly = await prisma.checkpoint.findMany({ select: { id: true } })
		 *
		 */
		findMany<T extends CheckpointFindManyArgs>(
			args?: SelectSubset<T, CheckpointFindManyArgs<ExtArgs>>,
		): Prisma.PrismaPromise<$Result.GetResult<Prisma.$CheckpointPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

		/**
		 * Create a Checkpoint.
		 * @param {CheckpointCreateArgs} args - Arguments to create a Checkpoint.
		 * @example
		 * // Create one Checkpoint
		 * const Checkpoint = await prisma.checkpoint.create({
		 *   data: {
		 *     // ... data to create a Checkpoint
		 *   }
		 * })
		 *
		 */
		create<T extends CheckpointCreateArgs>(
			args: SelectSubset<T, CheckpointCreateArgs<ExtArgs>>,
		): Prisma__CheckpointClient<
			$Result.GetResult<Prisma.$CheckpointPayload<ExtArgs>, T, "create", GlobalOmitOptions>,
			never,
			ExtArgs,
			GlobalOmitOptions
		>

		/**
		 * Create many Checkpoints.
		 * @param {CheckpointCreateManyArgs} args - Arguments to create many Checkpoints.
		 * @example
		 * // Create many Checkpoints
		 * const checkpoint = await prisma.checkpoint.createMany({
		 *   data: [
		 *     // ... provide data here
		 *   ]
		 * })
		 *
		 */
		createMany<T extends CheckpointCreateManyArgs>(
			args?: SelectSubset<T, CheckpointCreateManyArgs<ExtArgs>>,
		): Prisma.PrismaPromise<BatchPayload>

		/**
		 * Create many Checkpoints and returns the data saved in the database.
		 * @param {CheckpointCreateManyAndReturnArgs} args - Arguments to create many Checkpoints.
		 * @example
		 * // Create many Checkpoints
		 * const checkpoint = await prisma.checkpoint.createManyAndReturn({
		 *   data: [
		 *     // ... provide data here
		 *   ]
		 * })
		 *
		 * // Create many Checkpoints and only return the `id`
		 * const checkpointWithIdOnly = await prisma.checkpoint.createManyAndReturn({
		 *   select: { id: true },
		 *   data: [
		 *     // ... provide data here
		 *   ]
		 * })
		 * Note, that providing `undefined` is treated as the value not being there.
		 * Read more here: https://pris.ly/d/null-undefined
		 *
		 */
		createManyAndReturn<T extends CheckpointCreateManyAndReturnArgs>(
			args?: SelectSubset<T, CheckpointCreateManyAndReturnArgs<ExtArgs>>,
		): Prisma.PrismaPromise<
			$Result.GetResult<Prisma.$CheckpointPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>
		>

		/**
		 * Delete a Checkpoint.
		 * @param {CheckpointDeleteArgs} args - Arguments to delete one Checkpoint.
		 * @example
		 * // Delete one Checkpoint
		 * const Checkpoint = await prisma.checkpoint.delete({
		 *   where: {
		 *     // ... filter to delete one Checkpoint
		 *   }
		 * })
		 *
		 */
		delete<T extends CheckpointDeleteArgs>(
			args: SelectSubset<T, CheckpointDeleteArgs<ExtArgs>>,
		): Prisma__CheckpointClient<
			$Result.GetResult<Prisma.$CheckpointPayload<ExtArgs>, T, "delete", GlobalOmitOptions>,
			never,
			ExtArgs,
			GlobalOmitOptions
		>

		/**
		 * Update one Checkpoint.
		 * @param {CheckpointUpdateArgs} args - Arguments to update one Checkpoint.
		 * @example
		 * // Update one Checkpoint
		 * const checkpoint = await prisma.checkpoint.update({
		 *   where: {
		 *     // ... provide filter here
		 *   },
		 *   data: {
		 *     // ... provide data here
		 *   }
		 * })
		 *
		 */
		update<T extends CheckpointUpdateArgs>(
			args: SelectSubset<T, CheckpointUpdateArgs<ExtArgs>>,
		): Prisma__CheckpointClient<
			$Result.GetResult<Prisma.$CheckpointPayload<ExtArgs>, T, "update", GlobalOmitOptions>,
			never,
			ExtArgs,
			GlobalOmitOptions
		>

		/**
		 * Delete zero or more Checkpoints.
		 * @param {CheckpointDeleteManyArgs} args - Arguments to filter Checkpoints to delete.
		 * @example
		 * // Delete a few Checkpoints
		 * const { count } = await prisma.checkpoint.deleteMany({
		 *   where: {
		 *     // ... provide filter here
		 *   }
		 * })
		 *
		 */
		deleteMany<T extends CheckpointDeleteManyArgs>(
			args?: SelectSubset<T, CheckpointDeleteManyArgs<ExtArgs>>,
		): Prisma.PrismaPromise<BatchPayload>

		/**
		 * Update zero or more Checkpoints.
		 * Note, that providing `undefined` is treated as the value not being there.
		 * Read more here: https://pris.ly/d/null-undefined
		 * @param {CheckpointUpdateManyArgs} args - Arguments to update one or more rows.
		 * @example
		 * // Update many Checkpoints
		 * const checkpoint = await prisma.checkpoint.updateMany({
		 *   where: {
		 *     // ... provide filter here
		 *   },
		 *   data: {
		 *     // ... provide data here
		 *   }
		 * })
		 *
		 */
		updateMany<T extends CheckpointUpdateManyArgs>(
			args: SelectSubset<T, CheckpointUpdateManyArgs<ExtArgs>>,
		): Prisma.PrismaPromise<BatchPayload>

		/**
		 * Update zero or more Checkpoints and returns the data updated in the database.
		 * @param {CheckpointUpdateManyAndReturnArgs} args - Arguments to update many Checkpoints.
		 * @example
		 * // Update many Checkpoints
		 * const checkpoint = await prisma.checkpoint.updateManyAndReturn({
		 *   where: {
		 *     // ... provide filter here
		 *   },
		 *   data: [
		 *     // ... provide data here
		 *   ]
		 * })
		 *
		 * // Update zero or more Checkpoints and only return the `id`
		 * const checkpointWithIdOnly = await prisma.checkpoint.updateManyAndReturn({
		 *   select: { id: true },
		 *   where: {
		 *     // ... provide filter here
		 *   },
		 *   data: [
		 *     // ... provide data here
		 *   ]
		 * })
		 * Note, that providing `undefined` is treated as the value not being there.
		 * Read more here: https://pris.ly/d/null-undefined
		 *
		 */
		updateManyAndReturn<T extends CheckpointUpdateManyAndReturnArgs>(
			args: SelectSubset<T, CheckpointUpdateManyAndReturnArgs<ExtArgs>>,
		): Prisma.PrismaPromise<
			$Result.GetResult<Prisma.$CheckpointPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>
		>

		/**
		 * Create or update one Checkpoint.
		 * @param {CheckpointUpsertArgs} args - Arguments to update or create a Checkpoint.
		 * @example
		 * // Update or create a Checkpoint
		 * const checkpoint = await prisma.checkpoint.upsert({
		 *   create: {
		 *     // ... data to create a Checkpoint
		 *   },
		 *   update: {
		 *     // ... in case it already exists, update
		 *   },
		 *   where: {
		 *     // ... the filter for the Checkpoint we want to update
		 *   }
		 * })
		 */
		upsert<T extends CheckpointUpsertArgs>(
			args: SelectSubset<T, CheckpointUpsertArgs<ExtArgs>>,
		): Prisma__CheckpointClient<
			$Result.GetResult<Prisma.$CheckpointPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>,
			never,
			ExtArgs,
			GlobalOmitOptions
		>

		/**
		 * Count the number of Checkpoints.
		 * Note, that providing `undefined` is treated as the value not being there.
		 * Read more here: https://pris.ly/d/null-undefined
		 * @param {CheckpointCountArgs} args - Arguments to filter Checkpoints to count.
		 * @example
		 * // Count the number of Checkpoints
		 * const count = await prisma.checkpoint.count({
		 *   where: {
		 *     // ... the filter for the Checkpoints we want to count
		 *   }
		 * })
		 **/
		count<T extends CheckpointCountArgs>(
			args?: Subset<T, CheckpointCountArgs>,
		): Prisma.PrismaPromise<
			T extends $Utils.Record<"select", any>
				? T["select"] extends true
					? number
					: GetScalarType<T["select"], CheckpointCountAggregateOutputType>
				: number
		>

		/**
		 * Allows you to perform aggregations operations on a Checkpoint.
		 * Note, that providing `undefined` is treated as the value not being there.
		 * Read more here: https://pris.ly/d/null-undefined
		 * @param {CheckpointAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
		 * @example
		 * // Ordered by age ascending
		 * // Where email contains prisma.io
		 * // Limited to the 10 users
		 * const aggregations = await prisma.user.aggregate({
		 *   _avg: {
		 *     age: true,
		 *   },
		 *   where: {
		 *     email: {
		 *       contains: "prisma.io",
		 *     },
		 *   },
		 *   orderBy: {
		 *     age: "asc",
		 *   },
		 *   take: 10,
		 * })
		 **/
		aggregate<T extends CheckpointAggregateArgs>(
			args: Subset<T, CheckpointAggregateArgs>,
		): Prisma.PrismaPromise<GetCheckpointAggregateType<T>>

		/**
		 * Group by Checkpoint.
		 * Note, that providing `undefined` is treated as the value not being there.
		 * Read more here: https://pris.ly/d/null-undefined
		 * @param {CheckpointGroupByArgs} args - Group by arguments.
		 * @example
		 * // Group by city, order by createdAt, get count
		 * const result = await prisma.user.groupBy({
		 *   by: ['city', 'createdAt'],
		 *   orderBy: {
		 *     createdAt: true
		 *   },
		 *   _count: {
		 *     _all: true
		 *   },
		 * })
		 *
		 **/
		groupBy<
			T extends CheckpointGroupByArgs,
			HasSelectOrTake extends Or<Extends<"skip", Keys<T>>, Extends<"take", Keys<T>>>,
			OrderByArg extends True extends HasSelectOrTake
				? { orderBy: CheckpointGroupByArgs["orderBy"] }
				: { orderBy?: CheckpointGroupByArgs["orderBy"] },
			OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T["orderBy"]>>>,
			ByFields extends MaybeTupleToUnion<T["by"]>,
			ByValid extends Has<ByFields, OrderFields>,
			HavingFields extends GetHavingFields<T["having"]>,
			HavingValid extends Has<ByFields, HavingFields>,
			ByEmpty extends T["by"] extends never[] ? True : False,
			InputErrors extends ByEmpty extends True
				? `Error: "by" must not be empty.`
				: HavingValid extends False
					? {
							[P in HavingFields]: P extends ByFields
								? never
								: P extends string
									? `Error: Field "${P}" used in "having" needs to be provided in "by".`
									: [Error, "Field ", P, ` in "having" needs to be provided in "by"`]
						}[HavingFields]
					: "take" extends Keys<T>
						? "orderBy" extends Keys<T>
							? ByValid extends True
								? {}
								: {
										[P in OrderFields]: P extends ByFields
											? never
											: `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
									}[OrderFields]
							: 'Error: If you provide "take", you also need to provide "orderBy"'
						: "skip" extends Keys<T>
							? "orderBy" extends Keys<T>
								? ByValid extends True
									? {}
									: {
											[P in OrderFields]: P extends ByFields
												? never
												: `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
										}[OrderFields]
								: 'Error: If you provide "skip", you also need to provide "orderBy"'
							: ByValid extends True
								? {}
								: {
										[P in OrderFields]: P extends ByFields
											? never
											: `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
									}[OrderFields],
		>(
			args: SubsetIntersection<T, CheckpointGroupByArgs, OrderByArg> & InputErrors,
		): {} extends InputErrors ? GetCheckpointGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
		/**
		 * Fields of the Checkpoint model
		 */
		readonly fields: CheckpointFieldRefs
	}

	/**
	 * The delegate class that acts as a "Promise-like" for Checkpoint.
	 * Why is this prefixed with `Prisma__`?
	 * Because we want to prevent naming conflicts as mentioned in
	 * https://github.com/prisma/prisma-client-js/issues/707
	 */
	export interface Prisma__CheckpointClient<
		T,
		Null = never,
		ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
		GlobalOmitOptions = {},
	> extends Prisma.PrismaPromise<T> {
		readonly [Symbol.toStringTag]: "PrismaPromise"
		task<T extends TaskDefaultArgs<ExtArgs> = {}>(
			args?: Subset<T, TaskDefaultArgs<ExtArgs>>,
		): Prisma__TaskClient<
			$Result.GetResult<Prisma.$TaskPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null,
			Null,
			ExtArgs,
			GlobalOmitOptions
		>
		/**
		 * Attaches callbacks for the resolution and/or rejection of the Promise.
		 * @param onfulfilled The callback to execute when the Promise is resolved.
		 * @param onrejected The callback to execute when the Promise is rejected.
		 * @returns A Promise for the completion of which ever callback is executed.
		 */
		then<TResult1 = T, TResult2 = never>(
			onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null,
			onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null,
		): $Utils.JsPromise<TResult1 | TResult2>
		/**
		 * Attaches a callback for only the rejection of the Promise.
		 * @param onrejected The callback to execute when the Promise is rejected.
		 * @returns A Promise for the completion of the callback.
		 */
		catch<TResult = never>(
			onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null,
		): $Utils.JsPromise<T | TResult>
		/**
		 * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
		 * resolved value cannot be modified from the callback.
		 * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
		 * @returns A Promise for the completion of the callback.
		 */
		finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
	}

	/**
	 * Fields of the Checkpoint model
	 */
	interface CheckpointFieldRefs {
		readonly id: FieldRef<"Checkpoint", "Int">
		readonly taskId: FieldRef<"Checkpoint", "String">
		readonly data: FieldRef<"Checkpoint", "Json">
		readonly timestamp: FieldRef<"Checkpoint", "BigInt">
		readonly createdAt: FieldRef<"Checkpoint", "DateTime">
	}

	// Custom InputTypes
	/**
	 * Checkpoint findUnique
	 */
	export type CheckpointFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
		/**
		 * Select specific fields to fetch from the Checkpoint
		 */
		select?: CheckpointSelect<ExtArgs> | null
		/**
		 * Omit specific fields from the Checkpoint
		 */
		omit?: CheckpointOmit<ExtArgs> | null
		/**
		 * Choose, which related nodes to fetch as well
		 */
		include?: CheckpointInclude<ExtArgs> | null
		/**
		 * Filter, which Checkpoint to fetch.
		 */
		where: CheckpointWhereUniqueInput
	}

	/**
	 * Checkpoint findUniqueOrThrow
	 */
	export type CheckpointFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
		/**
		 * Select specific fields to fetch from the Checkpoint
		 */
		select?: CheckpointSelect<ExtArgs> | null
		/**
		 * Omit specific fields from the Checkpoint
		 */
		omit?: CheckpointOmit<ExtArgs> | null
		/**
		 * Choose, which related nodes to fetch as well
		 */
		include?: CheckpointInclude<ExtArgs> | null
		/**
		 * Filter, which Checkpoint to fetch.
		 */
		where: CheckpointWhereUniqueInput
	}

	/**
	 * Checkpoint findFirst
	 */
	export type CheckpointFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
		/**
		 * Select specific fields to fetch from the Checkpoint
		 */
		select?: CheckpointSelect<ExtArgs> | null
		/**
		 * Omit specific fields from the Checkpoint
		 */
		omit?: CheckpointOmit<ExtArgs> | null
		/**
		 * Choose, which related nodes to fetch as well
		 */
		include?: CheckpointInclude<ExtArgs> | null
		/**
		 * Filter, which Checkpoint to fetch.
		 */
		where?: CheckpointWhereInput
		/**
		 * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
		 *
		 * Determine the order of Checkpoints to fetch.
		 */
		orderBy?: CheckpointOrderByWithRelationInput | CheckpointOrderByWithRelationInput[]
		/**
		 * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
		 *
		 * Sets the position for searching for Checkpoints.
		 */
		cursor?: CheckpointWhereUniqueInput
		/**
		 * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
		 *
		 * Take `±n` Checkpoints from the position of the cursor.
		 */
		take?: number
		/**
		 * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
		 *
		 * Skip the first `n` Checkpoints.
		 */
		skip?: number
		/**
		 * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
		 *
		 * Filter by unique combinations of Checkpoints.
		 */
		distinct?: CheckpointScalarFieldEnum | CheckpointScalarFieldEnum[]
	}

	/**
	 * Checkpoint findFirstOrThrow
	 */
	export type CheckpointFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
		/**
		 * Select specific fields to fetch from the Checkpoint
		 */
		select?: CheckpointSelect<ExtArgs> | null
		/**
		 * Omit specific fields from the Checkpoint
		 */
		omit?: CheckpointOmit<ExtArgs> | null
		/**
		 * Choose, which related nodes to fetch as well
		 */
		include?: CheckpointInclude<ExtArgs> | null
		/**
		 * Filter, which Checkpoint to fetch.
		 */
		where?: CheckpointWhereInput
		/**
		 * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
		 *
		 * Determine the order of Checkpoints to fetch.
		 */
		orderBy?: CheckpointOrderByWithRelationInput | CheckpointOrderByWithRelationInput[]
		/**
		 * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
		 *
		 * Sets the position for searching for Checkpoints.
		 */
		cursor?: CheckpointWhereUniqueInput
		/**
		 * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
		 *
		 * Take `±n` Checkpoints from the position of the cursor.
		 */
		take?: number
		/**
		 * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
		 *
		 * Skip the first `n` Checkpoints.
		 */
		skip?: number
		/**
		 * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
		 *
		 * Filter by unique combinations of Checkpoints.
		 */
		distinct?: CheckpointScalarFieldEnum | CheckpointScalarFieldEnum[]
	}

	/**
	 * Checkpoint findMany
	 */
	export type CheckpointFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
		/**
		 * Select specific fields to fetch from the Checkpoint
		 */
		select?: CheckpointSelect<ExtArgs> | null
		/**
		 * Omit specific fields from the Checkpoint
		 */
		omit?: CheckpointOmit<ExtArgs> | null
		/**
		 * Choose, which related nodes to fetch as well
		 */
		include?: CheckpointInclude<ExtArgs> | null
		/**
		 * Filter, which Checkpoints to fetch.
		 */
		where?: CheckpointWhereInput
		/**
		 * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
		 *
		 * Determine the order of Checkpoints to fetch.
		 */
		orderBy?: CheckpointOrderByWithRelationInput | CheckpointOrderByWithRelationInput[]
		/**
		 * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
		 *
		 * Sets the position for listing Checkpoints.
		 */
		cursor?: CheckpointWhereUniqueInput
		/**
		 * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
		 *
		 * Take `±n` Checkpoints from the position of the cursor.
		 */
		take?: number
		/**
		 * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
		 *
		 * Skip the first `n` Checkpoints.
		 */
		skip?: number
		distinct?: CheckpointScalarFieldEnum | CheckpointScalarFieldEnum[]
	}

	/**
	 * Checkpoint create
	 */
	export type CheckpointCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
		/**
		 * Select specific fields to fetch from the Checkpoint
		 */
		select?: CheckpointSelect<ExtArgs> | null
		/**
		 * Omit specific fields from the Checkpoint
		 */
		omit?: CheckpointOmit<ExtArgs> | null
		/**
		 * Choose, which related nodes to fetch as well
		 */
		include?: CheckpointInclude<ExtArgs> | null
		/**
		 * The data needed to create a Checkpoint.
		 */
		data: XOR<CheckpointCreateInput, CheckpointUncheckedCreateInput>
	}

	/**
	 * Checkpoint createMany
	 */
	export type CheckpointCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
		/**
		 * The data used to create many Checkpoints.
		 */
		data: CheckpointCreateManyInput | CheckpointCreateManyInput[]
		skipDuplicates?: boolean
	}

	/**
	 * Checkpoint createManyAndReturn
	 */
	export type CheckpointCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
		{
			/**
			 * Select specific fields to fetch from the Checkpoint
			 */
			select?: CheckpointSelectCreateManyAndReturn<ExtArgs> | null
			/**
			 * Omit specific fields from the Checkpoint
			 */
			omit?: CheckpointOmit<ExtArgs> | null
			/**
			 * The data used to create many Checkpoints.
			 */
			data: CheckpointCreateManyInput | CheckpointCreateManyInput[]
			skipDuplicates?: boolean
			/**
			 * Choose, which related nodes to fetch as well
			 */
			include?: CheckpointIncludeCreateManyAndReturn<ExtArgs> | null
		}

	/**
	 * Checkpoint update
	 */
	export type CheckpointUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
		/**
		 * Select specific fields to fetch from the Checkpoint
		 */
		select?: CheckpointSelect<ExtArgs> | null
		/**
		 * Omit specific fields from the Checkpoint
		 */
		omit?: CheckpointOmit<ExtArgs> | null
		/**
		 * Choose, which related nodes to fetch as well
		 */
		include?: CheckpointInclude<ExtArgs> | null
		/**
		 * The data needed to update a Checkpoint.
		 */
		data: XOR<CheckpointUpdateInput, CheckpointUncheckedUpdateInput>
		/**
		 * Choose, which Checkpoint to update.
		 */
		where: CheckpointWhereUniqueInput
	}

	/**
	 * Checkpoint updateMany
	 */
	export type CheckpointUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
		/**
		 * The data used to update Checkpoints.
		 */
		data: XOR<CheckpointUpdateManyMutationInput, CheckpointUncheckedUpdateManyInput>
		/**
		 * Filter which Checkpoints to update
		 */
		where?: CheckpointWhereInput
		/**
		 * Limit how many Checkpoints to update.
		 */
		limit?: number
	}

	/**
	 * Checkpoint updateManyAndReturn
	 */
	export type CheckpointUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
		{
			/**
			 * Select specific fields to fetch from the Checkpoint
			 */
			select?: CheckpointSelectUpdateManyAndReturn<ExtArgs> | null
			/**
			 * Omit specific fields from the Checkpoint
			 */
			omit?: CheckpointOmit<ExtArgs> | null
			/**
			 * The data used to update Checkpoints.
			 */
			data: XOR<CheckpointUpdateManyMutationInput, CheckpointUncheckedUpdateManyInput>
			/**
			 * Filter which Checkpoints to update
			 */
			where?: CheckpointWhereInput
			/**
			 * Limit how many Checkpoints to update.
			 */
			limit?: number
			/**
			 * Choose, which related nodes to fetch as well
			 */
			include?: CheckpointIncludeUpdateManyAndReturn<ExtArgs> | null
		}

	/**
	 * Checkpoint upsert
	 */
	export type CheckpointUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
		/**
		 * Select specific fields to fetch from the Checkpoint
		 */
		select?: CheckpointSelect<ExtArgs> | null
		/**
		 * Omit specific fields from the Checkpoint
		 */
		omit?: CheckpointOmit<ExtArgs> | null
		/**
		 * Choose, which related nodes to fetch as well
		 */
		include?: CheckpointInclude<ExtArgs> | null
		/**
		 * The filter to search for the Checkpoint to update in case it exists.
		 */
		where: CheckpointWhereUniqueInput
		/**
		 * In case the Checkpoint found by the `where` argument doesn't exist, create a new Checkpoint with this data.
		 */
		create: XOR<CheckpointCreateInput, CheckpointUncheckedCreateInput>
		/**
		 * In case the Checkpoint was found with the provided `where` argument, update it with this data.
		 */
		update: XOR<CheckpointUpdateInput, CheckpointUncheckedUpdateInput>
	}

	/**
	 * Checkpoint delete
	 */
	export type CheckpointDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
		/**
		 * Select specific fields to fetch from the Checkpoint
		 */
		select?: CheckpointSelect<ExtArgs> | null
		/**
		 * Omit specific fields from the Checkpoint
		 */
		omit?: CheckpointOmit<ExtArgs> | null
		/**
		 * Choose, which related nodes to fetch as well
		 */
		include?: CheckpointInclude<ExtArgs> | null
		/**
		 * Filter which Checkpoint to delete.
		 */
		where: CheckpointWhereUniqueInput
	}

	/**
	 * Checkpoint deleteMany
	 */
	export type CheckpointDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
		/**
		 * Filter which Checkpoints to delete
		 */
		where?: CheckpointWhereInput
		/**
		 * Limit how many Checkpoints to delete.
		 */
		limit?: number
	}

	/**
	 * Checkpoint without action
	 */
	export type CheckpointDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
		/**
		 * Select specific fields to fetch from the Checkpoint
		 */
		select?: CheckpointSelect<ExtArgs> | null
		/**
		 * Omit specific fields from the Checkpoint
		 */
		omit?: CheckpointOmit<ExtArgs> | null
		/**
		 * Choose, which related nodes to fetch as well
		 */
		include?: CheckpointInclude<ExtArgs> | null
	}

	/**
	 * Model Settings
	 */

	export type AggregateSettings = {
		_count: SettingsCountAggregateOutputType | null
		_avg: SettingsAvgAggregateOutputType | null
		_sum: SettingsSumAggregateOutputType | null
		_min: SettingsMinAggregateOutputType | null
		_max: SettingsMaxAggregateOutputType | null
	}

	export type SettingsAvgAggregateOutputType = {
		id: number | null
		timestamp: number | null
		version: number | null
	}

	export type SettingsSumAggregateOutputType = {
		id: number | null
		timestamp: bigint | null
		version: number | null
	}

	export type SettingsMinAggregateOutputType = {
		id: number | null
		userId: string | null
		timestamp: bigint | null
		version: number | null
		createdAt: Date | null
		updatedAt: Date | null
	}

	export type SettingsMaxAggregateOutputType = {
		id: number | null
		userId: string | null
		timestamp: bigint | null
		version: number | null
		createdAt: Date | null
		updatedAt: Date | null
	}

	export type SettingsCountAggregateOutputType = {
		id: number
		userId: number
		settings: number
		timestamp: number
		version: number
		createdAt: number
		updatedAt: number
		_all: number
	}

	export type SettingsAvgAggregateInputType = {
		id?: true
		timestamp?: true
		version?: true
	}

	export type SettingsSumAggregateInputType = {
		id?: true
		timestamp?: true
		version?: true
	}

	export type SettingsMinAggregateInputType = {
		id?: true
		userId?: true
		timestamp?: true
		version?: true
		createdAt?: true
		updatedAt?: true
	}

	export type SettingsMaxAggregateInputType = {
		id?: true
		userId?: true
		timestamp?: true
		version?: true
		createdAt?: true
		updatedAt?: true
	}

	export type SettingsCountAggregateInputType = {
		id?: true
		userId?: true
		settings?: true
		timestamp?: true
		version?: true
		createdAt?: true
		updatedAt?: true
		_all?: true
	}

	export type SettingsAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
		/**
		 * Filter which Settings to aggregate.
		 */
		where?: SettingsWhereInput
		/**
		 * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
		 *
		 * Determine the order of Settings to fetch.
		 */
		orderBy?: SettingsOrderByWithRelationInput | SettingsOrderByWithRelationInput[]
		/**
		 * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
		 *
		 * Sets the start position
		 */
		cursor?: SettingsWhereUniqueInput
		/**
		 * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
		 *
		 * Take `±n` Settings from the position of the cursor.
		 */
		take?: number
		/**
		 * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
		 *
		 * Skip the first `n` Settings.
		 */
		skip?: number
		/**
		 * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
		 *
		 * Count returned Settings
		 **/
		_count?: true | SettingsCountAggregateInputType
		/**
		 * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
		 *
		 * Select which fields to average
		 **/
		_avg?: SettingsAvgAggregateInputType
		/**
		 * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
		 *
		 * Select which fields to sum
		 **/
		_sum?: SettingsSumAggregateInputType
		/**
		 * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
		 *
		 * Select which fields to find the minimum value
		 **/
		_min?: SettingsMinAggregateInputType
		/**
		 * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
		 *
		 * Select which fields to find the maximum value
		 **/
		_max?: SettingsMaxAggregateInputType
	}

	export type GetSettingsAggregateType<T extends SettingsAggregateArgs> = {
		[P in keyof T & keyof AggregateSettings]: P extends "_count" | "count"
			? T[P] extends true
				? number
				: GetScalarType<T[P], AggregateSettings[P]>
			: GetScalarType<T[P], AggregateSettings[P]>
	}

	export type SettingsGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
		where?: SettingsWhereInput
		orderBy?: SettingsOrderByWithAggregationInput | SettingsOrderByWithAggregationInput[]
		by: SettingsScalarFieldEnum[] | SettingsScalarFieldEnum
		having?: SettingsScalarWhereWithAggregatesInput
		take?: number
		skip?: number
		_count?: SettingsCountAggregateInputType | true
		_avg?: SettingsAvgAggregateInputType
		_sum?: SettingsSumAggregateInputType
		_min?: SettingsMinAggregateInputType
		_max?: SettingsMaxAggregateInputType
	}

	export type SettingsGroupByOutputType = {
		id: number
		userId: string
		settings: JsonValue
		timestamp: bigint
		version: number
		createdAt: Date
		updatedAt: Date
		_count: SettingsCountAggregateOutputType | null
		_avg: SettingsAvgAggregateOutputType | null
		_sum: SettingsSumAggregateOutputType | null
		_min: SettingsMinAggregateOutputType | null
		_max: SettingsMaxAggregateOutputType | null
	}

	type GetSettingsGroupByPayload<T extends SettingsGroupByArgs> = Prisma.PrismaPromise<
		Array<
			PickEnumerable<SettingsGroupByOutputType, T["by"]> & {
				[P in keyof T & keyof SettingsGroupByOutputType]: P extends "_count"
					? T[P] extends boolean
						? number
						: GetScalarType<T[P], SettingsGroupByOutputType[P]>
					: GetScalarType<T[P], SettingsGroupByOutputType[P]>
			}
		>
	>

	export type SettingsSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
		$Extensions.GetSelect<
			{
				id?: boolean
				userId?: boolean
				settings?: boolean
				timestamp?: boolean
				version?: boolean
				createdAt?: boolean
				updatedAt?: boolean
				user?: boolean | UserDefaultArgs<ExtArgs>
			},
			ExtArgs["result"]["settings"]
		>

	export type SettingsSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
		$Extensions.GetSelect<
			{
				id?: boolean
				userId?: boolean
				settings?: boolean
				timestamp?: boolean
				version?: boolean
				createdAt?: boolean
				updatedAt?: boolean
				user?: boolean | UserDefaultArgs<ExtArgs>
			},
			ExtArgs["result"]["settings"]
		>

	export type SettingsSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
		$Extensions.GetSelect<
			{
				id?: boolean
				userId?: boolean
				settings?: boolean
				timestamp?: boolean
				version?: boolean
				createdAt?: boolean
				updatedAt?: boolean
				user?: boolean | UserDefaultArgs<ExtArgs>
			},
			ExtArgs["result"]["settings"]
		>

	export type SettingsSelectScalar = {
		id?: boolean
		userId?: boolean
		settings?: boolean
		timestamp?: boolean
		version?: boolean
		createdAt?: boolean
		updatedAt?: boolean
	}

	export type SettingsOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<
		"id" | "userId" | "settings" | "timestamp" | "version" | "createdAt" | "updatedAt",
		ExtArgs["result"]["settings"]
	>
	export type SettingsInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
		user?: boolean | UserDefaultArgs<ExtArgs>
	}
	export type SettingsIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
		{
			user?: boolean | UserDefaultArgs<ExtArgs>
		}
	export type SettingsIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
		{
			user?: boolean | UserDefaultArgs<ExtArgs>
		}

	export type $SettingsPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
		name: "Settings"
		objects: {
			user: Prisma.$UserPayload<ExtArgs>
		}
		scalars: $Extensions.GetPayloadResult<
			{
				id: number
				userId: string
				settings: Prisma.JsonValue
				timestamp: bigint
				version: number
				createdAt: Date
				updatedAt: Date
			},
			ExtArgs["result"]["settings"]
		>
		composites: {}
	}

	type SettingsGetPayload<S extends boolean | null | undefined | SettingsDefaultArgs> = $Result.GetResult<
		Prisma.$SettingsPayload,
		S
	>

	type SettingsCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = Omit<
		SettingsFindManyArgs,
		"select" | "include" | "distinct" | "omit"
	> & {
		select?: SettingsCountAggregateInputType | true
	}

	export interface SettingsDelegate<
		ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
		GlobalOmitOptions = {},
	> {
		[K: symbol]: { types: Prisma.TypeMap<ExtArgs>["model"]["Settings"]; meta: { name: "Settings" } }
		/**
		 * Find zero or one Settings that matches the filter.
		 * @param {SettingsFindUniqueArgs} args - Arguments to find a Settings
		 * @example
		 * // Get one Settings
		 * const settings = await prisma.settings.findUnique({
		 *   where: {
		 *     // ... provide filter here
		 *   }
		 * })
		 */
		findUnique<T extends SettingsFindUniqueArgs>(
			args: SelectSubset<T, SettingsFindUniqueArgs<ExtArgs>>,
		): Prisma__SettingsClient<
			$Result.GetResult<Prisma.$SettingsPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null,
			null,
			ExtArgs,
			GlobalOmitOptions
		>

		/**
		 * Find one Settings that matches the filter or throw an error with `error.code='P2025'`
		 * if no matches were found.
		 * @param {SettingsFindUniqueOrThrowArgs} args - Arguments to find a Settings
		 * @example
		 * // Get one Settings
		 * const settings = await prisma.settings.findUniqueOrThrow({
		 *   where: {
		 *     // ... provide filter here
		 *   }
		 * })
		 */
		findUniqueOrThrow<T extends SettingsFindUniqueOrThrowArgs>(
			args: SelectSubset<T, SettingsFindUniqueOrThrowArgs<ExtArgs>>,
		): Prisma__SettingsClient<
			$Result.GetResult<Prisma.$SettingsPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>,
			never,
			ExtArgs,
			GlobalOmitOptions
		>

		/**
		 * Find the first Settings that matches the filter.
		 * Note, that providing `undefined` is treated as the value not being there.
		 * Read more here: https://pris.ly/d/null-undefined
		 * @param {SettingsFindFirstArgs} args - Arguments to find a Settings
		 * @example
		 * // Get one Settings
		 * const settings = await prisma.settings.findFirst({
		 *   where: {
		 *     // ... provide filter here
		 *   }
		 * })
		 */
		findFirst<T extends SettingsFindFirstArgs>(
			args?: SelectSubset<T, SettingsFindFirstArgs<ExtArgs>>,
		): Prisma__SettingsClient<
			$Result.GetResult<Prisma.$SettingsPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null,
			null,
			ExtArgs,
			GlobalOmitOptions
		>

		/**
		 * Find the first Settings that matches the filter or
		 * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
		 * Note, that providing `undefined` is treated as the value not being there.
		 * Read more here: https://pris.ly/d/null-undefined
		 * @param {SettingsFindFirstOrThrowArgs} args - Arguments to find a Settings
		 * @example
		 * // Get one Settings
		 * const settings = await prisma.settings.findFirstOrThrow({
		 *   where: {
		 *     // ... provide filter here
		 *   }
		 * })
		 */
		findFirstOrThrow<T extends SettingsFindFirstOrThrowArgs>(
			args?: SelectSubset<T, SettingsFindFirstOrThrowArgs<ExtArgs>>,
		): Prisma__SettingsClient<
			$Result.GetResult<Prisma.$SettingsPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>,
			never,
			ExtArgs,
			GlobalOmitOptions
		>

		/**
		 * Find zero or more Settings that matches the filter.
		 * Note, that providing `undefined` is treated as the value not being there.
		 * Read more here: https://pris.ly/d/null-undefined
		 * @param {SettingsFindManyArgs} args - Arguments to filter and select certain fields only.
		 * @example
		 * // Get all Settings
		 * const settings = await prisma.settings.findMany()
		 *
		 * // Get first 10 Settings
		 * const settings = await prisma.settings.findMany({ take: 10 })
		 *
		 * // Only select the `id`
		 * const settingsWithIdOnly = await prisma.settings.findMany({ select: { id: true } })
		 *
		 */
		findMany<T extends SettingsFindManyArgs>(
			args?: SelectSubset<T, SettingsFindManyArgs<ExtArgs>>,
		): Prisma.PrismaPromise<$Result.GetResult<Prisma.$SettingsPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

		/**
		 * Create a Settings.
		 * @param {SettingsCreateArgs} args - Arguments to create a Settings.
		 * @example
		 * // Create one Settings
		 * const Settings = await prisma.settings.create({
		 *   data: {
		 *     // ... data to create a Settings
		 *   }
		 * })
		 *
		 */
		create<T extends SettingsCreateArgs>(
			args: SelectSubset<T, SettingsCreateArgs<ExtArgs>>,
		): Prisma__SettingsClient<
			$Result.GetResult<Prisma.$SettingsPayload<ExtArgs>, T, "create", GlobalOmitOptions>,
			never,
			ExtArgs,
			GlobalOmitOptions
		>

		/**
		 * Create many Settings.
		 * @param {SettingsCreateManyArgs} args - Arguments to create many Settings.
		 * @example
		 * // Create many Settings
		 * const settings = await prisma.settings.createMany({
		 *   data: [
		 *     // ... provide data here
		 *   ]
		 * })
		 *
		 */
		createMany<T extends SettingsCreateManyArgs>(
			args?: SelectSubset<T, SettingsCreateManyArgs<ExtArgs>>,
		): Prisma.PrismaPromise<BatchPayload>

		/**
		 * Create many Settings and returns the data saved in the database.
		 * @param {SettingsCreateManyAndReturnArgs} args - Arguments to create many Settings.
		 * @example
		 * // Create many Settings
		 * const settings = await prisma.settings.createManyAndReturn({
		 *   data: [
		 *     // ... provide data here
		 *   ]
		 * })
		 *
		 * // Create many Settings and only return the `id`
		 * const settingsWithIdOnly = await prisma.settings.createManyAndReturn({
		 *   select: { id: true },
		 *   data: [
		 *     // ... provide data here
		 *   ]
		 * })
		 * Note, that providing `undefined` is treated as the value not being there.
		 * Read more here: https://pris.ly/d/null-undefined
		 *
		 */
		createManyAndReturn<T extends SettingsCreateManyAndReturnArgs>(
			args?: SelectSubset<T, SettingsCreateManyAndReturnArgs<ExtArgs>>,
		): Prisma.PrismaPromise<
			$Result.GetResult<Prisma.$SettingsPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>
		>

		/**
		 * Delete a Settings.
		 * @param {SettingsDeleteArgs} args - Arguments to delete one Settings.
		 * @example
		 * // Delete one Settings
		 * const Settings = await prisma.settings.delete({
		 *   where: {
		 *     // ... filter to delete one Settings
		 *   }
		 * })
		 *
		 */
		delete<T extends SettingsDeleteArgs>(
			args: SelectSubset<T, SettingsDeleteArgs<ExtArgs>>,
		): Prisma__SettingsClient<
			$Result.GetResult<Prisma.$SettingsPayload<ExtArgs>, T, "delete", GlobalOmitOptions>,
			never,
			ExtArgs,
			GlobalOmitOptions
		>

		/**
		 * Update one Settings.
		 * @param {SettingsUpdateArgs} args - Arguments to update one Settings.
		 * @example
		 * // Update one Settings
		 * const settings = await prisma.settings.update({
		 *   where: {
		 *     // ... provide filter here
		 *   },
		 *   data: {
		 *     // ... provide data here
		 *   }
		 * })
		 *
		 */
		update<T extends SettingsUpdateArgs>(
			args: SelectSubset<T, SettingsUpdateArgs<ExtArgs>>,
		): Prisma__SettingsClient<
			$Result.GetResult<Prisma.$SettingsPayload<ExtArgs>, T, "update", GlobalOmitOptions>,
			never,
			ExtArgs,
			GlobalOmitOptions
		>

		/**
		 * Delete zero or more Settings.
		 * @param {SettingsDeleteManyArgs} args - Arguments to filter Settings to delete.
		 * @example
		 * // Delete a few Settings
		 * const { count } = await prisma.settings.deleteMany({
		 *   where: {
		 *     // ... provide filter here
		 *   }
		 * })
		 *
		 */
		deleteMany<T extends SettingsDeleteManyArgs>(
			args?: SelectSubset<T, SettingsDeleteManyArgs<ExtArgs>>,
		): Prisma.PrismaPromise<BatchPayload>

		/**
		 * Update zero or more Settings.
		 * Note, that providing `undefined` is treated as the value not being there.
		 * Read more here: https://pris.ly/d/null-undefined
		 * @param {SettingsUpdateManyArgs} args - Arguments to update one or more rows.
		 * @example
		 * // Update many Settings
		 * const settings = await prisma.settings.updateMany({
		 *   where: {
		 *     // ... provide filter here
		 *   },
		 *   data: {
		 *     // ... provide data here
		 *   }
		 * })
		 *
		 */
		updateMany<T extends SettingsUpdateManyArgs>(
			args: SelectSubset<T, SettingsUpdateManyArgs<ExtArgs>>,
		): Prisma.PrismaPromise<BatchPayload>

		/**
		 * Update zero or more Settings and returns the data updated in the database.
		 * @param {SettingsUpdateManyAndReturnArgs} args - Arguments to update many Settings.
		 * @example
		 * // Update many Settings
		 * const settings = await prisma.settings.updateManyAndReturn({
		 *   where: {
		 *     // ... provide filter here
		 *   },
		 *   data: [
		 *     // ... provide data here
		 *   ]
		 * })
		 *
		 * // Update zero or more Settings and only return the `id`
		 * const settingsWithIdOnly = await prisma.settings.updateManyAndReturn({
		 *   select: { id: true },
		 *   where: {
		 *     // ... provide filter here
		 *   },
		 *   data: [
		 *     // ... provide data here
		 *   ]
		 * })
		 * Note, that providing `undefined` is treated as the value not being there.
		 * Read more here: https://pris.ly/d/null-undefined
		 *
		 */
		updateManyAndReturn<T extends SettingsUpdateManyAndReturnArgs>(
			args: SelectSubset<T, SettingsUpdateManyAndReturnArgs<ExtArgs>>,
		): Prisma.PrismaPromise<
			$Result.GetResult<Prisma.$SettingsPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>
		>

		/**
		 * Create or update one Settings.
		 * @param {SettingsUpsertArgs} args - Arguments to update or create a Settings.
		 * @example
		 * // Update or create a Settings
		 * const settings = await prisma.settings.upsert({
		 *   create: {
		 *     // ... data to create a Settings
		 *   },
		 *   update: {
		 *     // ... in case it already exists, update
		 *   },
		 *   where: {
		 *     // ... the filter for the Settings we want to update
		 *   }
		 * })
		 */
		upsert<T extends SettingsUpsertArgs>(
			args: SelectSubset<T, SettingsUpsertArgs<ExtArgs>>,
		): Prisma__SettingsClient<
			$Result.GetResult<Prisma.$SettingsPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>,
			never,
			ExtArgs,
			GlobalOmitOptions
		>

		/**
		 * Count the number of Settings.
		 * Note, that providing `undefined` is treated as the value not being there.
		 * Read more here: https://pris.ly/d/null-undefined
		 * @param {SettingsCountArgs} args - Arguments to filter Settings to count.
		 * @example
		 * // Count the number of Settings
		 * const count = await prisma.settings.count({
		 *   where: {
		 *     // ... the filter for the Settings we want to count
		 *   }
		 * })
		 **/
		count<T extends SettingsCountArgs>(
			args?: Subset<T, SettingsCountArgs>,
		): Prisma.PrismaPromise<
			T extends $Utils.Record<"select", any>
				? T["select"] extends true
					? number
					: GetScalarType<T["select"], SettingsCountAggregateOutputType>
				: number
		>

		/**
		 * Allows you to perform aggregations operations on a Settings.
		 * Note, that providing `undefined` is treated as the value not being there.
		 * Read more here: https://pris.ly/d/null-undefined
		 * @param {SettingsAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
		 * @example
		 * // Ordered by age ascending
		 * // Where email contains prisma.io
		 * // Limited to the 10 users
		 * const aggregations = await prisma.user.aggregate({
		 *   _avg: {
		 *     age: true,
		 *   },
		 *   where: {
		 *     email: {
		 *       contains: "prisma.io",
		 *     },
		 *   },
		 *   orderBy: {
		 *     age: "asc",
		 *   },
		 *   take: 10,
		 * })
		 **/
		aggregate<T extends SettingsAggregateArgs>(
			args: Subset<T, SettingsAggregateArgs>,
		): Prisma.PrismaPromise<GetSettingsAggregateType<T>>

		/**
		 * Group by Settings.
		 * Note, that providing `undefined` is treated as the value not being there.
		 * Read more here: https://pris.ly/d/null-undefined
		 * @param {SettingsGroupByArgs} args - Group by arguments.
		 * @example
		 * // Group by city, order by createdAt, get count
		 * const result = await prisma.user.groupBy({
		 *   by: ['city', 'createdAt'],
		 *   orderBy: {
		 *     createdAt: true
		 *   },
		 *   _count: {
		 *     _all: true
		 *   },
		 * })
		 *
		 **/
		groupBy<
			T extends SettingsGroupByArgs,
			HasSelectOrTake extends Or<Extends<"skip", Keys<T>>, Extends<"take", Keys<T>>>,
			OrderByArg extends True extends HasSelectOrTake
				? { orderBy: SettingsGroupByArgs["orderBy"] }
				: { orderBy?: SettingsGroupByArgs["orderBy"] },
			OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T["orderBy"]>>>,
			ByFields extends MaybeTupleToUnion<T["by"]>,
			ByValid extends Has<ByFields, OrderFields>,
			HavingFields extends GetHavingFields<T["having"]>,
			HavingValid extends Has<ByFields, HavingFields>,
			ByEmpty extends T["by"] extends never[] ? True : False,
			InputErrors extends ByEmpty extends True
				? `Error: "by" must not be empty.`
				: HavingValid extends False
					? {
							[P in HavingFields]: P extends ByFields
								? never
								: P extends string
									? `Error: Field "${P}" used in "having" needs to be provided in "by".`
									: [Error, "Field ", P, ` in "having" needs to be provided in "by"`]
						}[HavingFields]
					: "take" extends Keys<T>
						? "orderBy" extends Keys<T>
							? ByValid extends True
								? {}
								: {
										[P in OrderFields]: P extends ByFields
											? never
											: `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
									}[OrderFields]
							: 'Error: If you provide "take", you also need to provide "orderBy"'
						: "skip" extends Keys<T>
							? "orderBy" extends Keys<T>
								? ByValid extends True
									? {}
									: {
											[P in OrderFields]: P extends ByFields
												? never
												: `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
										}[OrderFields]
								: 'Error: If you provide "skip", you also need to provide "orderBy"'
							: ByValid extends True
								? {}
								: {
										[P in OrderFields]: P extends ByFields
											? never
											: `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
									}[OrderFields],
		>(
			args: SubsetIntersection<T, SettingsGroupByArgs, OrderByArg> & InputErrors,
		): {} extends InputErrors ? GetSettingsGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
		/**
		 * Fields of the Settings model
		 */
		readonly fields: SettingsFieldRefs
	}

	/**
	 * The delegate class that acts as a "Promise-like" for Settings.
	 * Why is this prefixed with `Prisma__`?
	 * Because we want to prevent naming conflicts as mentioned in
	 * https://github.com/prisma/prisma-client-js/issues/707
	 */
	export interface Prisma__SettingsClient<
		T,
		Null = never,
		ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
		GlobalOmitOptions = {},
	> extends Prisma.PrismaPromise<T> {
		readonly [Symbol.toStringTag]: "PrismaPromise"
		user<T extends UserDefaultArgs<ExtArgs> = {}>(
			args?: Subset<T, UserDefaultArgs<ExtArgs>>,
		): Prisma__UserClient<
			$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null,
			Null,
			ExtArgs,
			GlobalOmitOptions
		>
		/**
		 * Attaches callbacks for the resolution and/or rejection of the Promise.
		 * @param onfulfilled The callback to execute when the Promise is resolved.
		 * @param onrejected The callback to execute when the Promise is rejected.
		 * @returns A Promise for the completion of which ever callback is executed.
		 */
		then<TResult1 = T, TResult2 = never>(
			onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null,
			onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null,
		): $Utils.JsPromise<TResult1 | TResult2>
		/**
		 * Attaches a callback for only the rejection of the Promise.
		 * @param onrejected The callback to execute when the Promise is rejected.
		 * @returns A Promise for the completion of the callback.
		 */
		catch<TResult = never>(
			onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null,
		): $Utils.JsPromise<T | TResult>
		/**
		 * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
		 * resolved value cannot be modified from the callback.
		 * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
		 * @returns A Promise for the completion of the callback.
		 */
		finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
	}

	/**
	 * Fields of the Settings model
	 */
	interface SettingsFieldRefs {
		readonly id: FieldRef<"Settings", "Int">
		readonly userId: FieldRef<"Settings", "String">
		readonly settings: FieldRef<"Settings", "Json">
		readonly timestamp: FieldRef<"Settings", "BigInt">
		readonly version: FieldRef<"Settings", "Int">
		readonly createdAt: FieldRef<"Settings", "DateTime">
		readonly updatedAt: FieldRef<"Settings", "DateTime">
	}

	// Custom InputTypes
	/**
	 * Settings findUnique
	 */
	export type SettingsFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
		/**
		 * Select specific fields to fetch from the Settings
		 */
		select?: SettingsSelect<ExtArgs> | null
		/**
		 * Omit specific fields from the Settings
		 */
		omit?: SettingsOmit<ExtArgs> | null
		/**
		 * Choose, which related nodes to fetch as well
		 */
		include?: SettingsInclude<ExtArgs> | null
		/**
		 * Filter, which Settings to fetch.
		 */
		where: SettingsWhereUniqueInput
	}

	/**
	 * Settings findUniqueOrThrow
	 */
	export type SettingsFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
		/**
		 * Select specific fields to fetch from the Settings
		 */
		select?: SettingsSelect<ExtArgs> | null
		/**
		 * Omit specific fields from the Settings
		 */
		omit?: SettingsOmit<ExtArgs> | null
		/**
		 * Choose, which related nodes to fetch as well
		 */
		include?: SettingsInclude<ExtArgs> | null
		/**
		 * Filter, which Settings to fetch.
		 */
		where: SettingsWhereUniqueInput
	}

	/**
	 * Settings findFirst
	 */
	export type SettingsFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
		/**
		 * Select specific fields to fetch from the Settings
		 */
		select?: SettingsSelect<ExtArgs> | null
		/**
		 * Omit specific fields from the Settings
		 */
		omit?: SettingsOmit<ExtArgs> | null
		/**
		 * Choose, which related nodes to fetch as well
		 */
		include?: SettingsInclude<ExtArgs> | null
		/**
		 * Filter, which Settings to fetch.
		 */
		where?: SettingsWhereInput
		/**
		 * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
		 *
		 * Determine the order of Settings to fetch.
		 */
		orderBy?: SettingsOrderByWithRelationInput | SettingsOrderByWithRelationInput[]
		/**
		 * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
		 *
		 * Sets the position for searching for Settings.
		 */
		cursor?: SettingsWhereUniqueInput
		/**
		 * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
		 *
		 * Take `±n` Settings from the position of the cursor.
		 */
		take?: number
		/**
		 * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
		 *
		 * Skip the first `n` Settings.
		 */
		skip?: number
		/**
		 * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
		 *
		 * Filter by unique combinations of Settings.
		 */
		distinct?: SettingsScalarFieldEnum | SettingsScalarFieldEnum[]
	}

	/**
	 * Settings findFirstOrThrow
	 */
	export type SettingsFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
		/**
		 * Select specific fields to fetch from the Settings
		 */
		select?: SettingsSelect<ExtArgs> | null
		/**
		 * Omit specific fields from the Settings
		 */
		omit?: SettingsOmit<ExtArgs> | null
		/**
		 * Choose, which related nodes to fetch as well
		 */
		include?: SettingsInclude<ExtArgs> | null
		/**
		 * Filter, which Settings to fetch.
		 */
		where?: SettingsWhereInput
		/**
		 * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
		 *
		 * Determine the order of Settings to fetch.
		 */
		orderBy?: SettingsOrderByWithRelationInput | SettingsOrderByWithRelationInput[]
		/**
		 * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
		 *
		 * Sets the position for searching for Settings.
		 */
		cursor?: SettingsWhereUniqueInput
		/**
		 * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
		 *
		 * Take `±n` Settings from the position of the cursor.
		 */
		take?: number
		/**
		 * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
		 *
		 * Skip the first `n` Settings.
		 */
		skip?: number
		/**
		 * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
		 *
		 * Filter by unique combinations of Settings.
		 */
		distinct?: SettingsScalarFieldEnum | SettingsScalarFieldEnum[]
	}

	/**
	 * Settings findMany
	 */
	export type SettingsFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
		/**
		 * Select specific fields to fetch from the Settings
		 */
		select?: SettingsSelect<ExtArgs> | null
		/**
		 * Omit specific fields from the Settings
		 */
		omit?: SettingsOmit<ExtArgs> | null
		/**
		 * Choose, which related nodes to fetch as well
		 */
		include?: SettingsInclude<ExtArgs> | null
		/**
		 * Filter, which Settings to fetch.
		 */
		where?: SettingsWhereInput
		/**
		 * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
		 *
		 * Determine the order of Settings to fetch.
		 */
		orderBy?: SettingsOrderByWithRelationInput | SettingsOrderByWithRelationInput[]
		/**
		 * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
		 *
		 * Sets the position for listing Settings.
		 */
		cursor?: SettingsWhereUniqueInput
		/**
		 * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
		 *
		 * Take `±n` Settings from the position of the cursor.
		 */
		take?: number
		/**
		 * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
		 *
		 * Skip the first `n` Settings.
		 */
		skip?: number
		distinct?: SettingsScalarFieldEnum | SettingsScalarFieldEnum[]
	}

	/**
	 * Settings create
	 */
	export type SettingsCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
		/**
		 * Select specific fields to fetch from the Settings
		 */
		select?: SettingsSelect<ExtArgs> | null
		/**
		 * Omit specific fields from the Settings
		 */
		omit?: SettingsOmit<ExtArgs> | null
		/**
		 * Choose, which related nodes to fetch as well
		 */
		include?: SettingsInclude<ExtArgs> | null
		/**
		 * The data needed to create a Settings.
		 */
		data: XOR<SettingsCreateInput, SettingsUncheckedCreateInput>
	}

	/**
	 * Settings createMany
	 */
	export type SettingsCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
		/**
		 * The data used to create many Settings.
		 */
		data: SettingsCreateManyInput | SettingsCreateManyInput[]
		skipDuplicates?: boolean
	}

	/**
	 * Settings createManyAndReturn
	 */
	export type SettingsCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
		/**
		 * Select specific fields to fetch from the Settings
		 */
		select?: SettingsSelectCreateManyAndReturn<ExtArgs> | null
		/**
		 * Omit specific fields from the Settings
		 */
		omit?: SettingsOmit<ExtArgs> | null
		/**
		 * The data used to create many Settings.
		 */
		data: SettingsCreateManyInput | SettingsCreateManyInput[]
		skipDuplicates?: boolean
		/**
		 * Choose, which related nodes to fetch as well
		 */
		include?: SettingsIncludeCreateManyAndReturn<ExtArgs> | null
	}

	/**
	 * Settings update
	 */
	export type SettingsUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
		/**
		 * Select specific fields to fetch from the Settings
		 */
		select?: SettingsSelect<ExtArgs> | null
		/**
		 * Omit specific fields from the Settings
		 */
		omit?: SettingsOmit<ExtArgs> | null
		/**
		 * Choose, which related nodes to fetch as well
		 */
		include?: SettingsInclude<ExtArgs> | null
		/**
		 * The data needed to update a Settings.
		 */
		data: XOR<SettingsUpdateInput, SettingsUncheckedUpdateInput>
		/**
		 * Choose, which Settings to update.
		 */
		where: SettingsWhereUniqueInput
	}

	/**
	 * Settings updateMany
	 */
	export type SettingsUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
		/**
		 * The data used to update Settings.
		 */
		data: XOR<SettingsUpdateManyMutationInput, SettingsUncheckedUpdateManyInput>
		/**
		 * Filter which Settings to update
		 */
		where?: SettingsWhereInput
		/**
		 * Limit how many Settings to update.
		 */
		limit?: number
	}

	/**
	 * Settings updateManyAndReturn
	 */
	export type SettingsUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
		/**
		 * Select specific fields to fetch from the Settings
		 */
		select?: SettingsSelectUpdateManyAndReturn<ExtArgs> | null
		/**
		 * Omit specific fields from the Settings
		 */
		omit?: SettingsOmit<ExtArgs> | null
		/**
		 * The data used to update Settings.
		 */
		data: XOR<SettingsUpdateManyMutationInput, SettingsUncheckedUpdateManyInput>
		/**
		 * Filter which Settings to update
		 */
		where?: SettingsWhereInput
		/**
		 * Limit how many Settings to update.
		 */
		limit?: number
		/**
		 * Choose, which related nodes to fetch as well
		 */
		include?: SettingsIncludeUpdateManyAndReturn<ExtArgs> | null
	}

	/**
	 * Settings upsert
	 */
	export type SettingsUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
		/**
		 * Select specific fields to fetch from the Settings
		 */
		select?: SettingsSelect<ExtArgs> | null
		/**
		 * Omit specific fields from the Settings
		 */
		omit?: SettingsOmit<ExtArgs> | null
		/**
		 * Choose, which related nodes to fetch as well
		 */
		include?: SettingsInclude<ExtArgs> | null
		/**
		 * The filter to search for the Settings to update in case it exists.
		 */
		where: SettingsWhereUniqueInput
		/**
		 * In case the Settings found by the `where` argument doesn't exist, create a new Settings with this data.
		 */
		create: XOR<SettingsCreateInput, SettingsUncheckedCreateInput>
		/**
		 * In case the Settings was found with the provided `where` argument, update it with this data.
		 */
		update: XOR<SettingsUpdateInput, SettingsUncheckedUpdateInput>
	}

	/**
	 * Settings delete
	 */
	export type SettingsDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
		/**
		 * Select specific fields to fetch from the Settings
		 */
		select?: SettingsSelect<ExtArgs> | null
		/**
		 * Omit specific fields from the Settings
		 */
		omit?: SettingsOmit<ExtArgs> | null
		/**
		 * Choose, which related nodes to fetch as well
		 */
		include?: SettingsInclude<ExtArgs> | null
		/**
		 * Filter which Settings to delete.
		 */
		where: SettingsWhereUniqueInput
	}

	/**
	 * Settings deleteMany
	 */
	export type SettingsDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
		/**
		 * Filter which Settings to delete
		 */
		where?: SettingsWhereInput
		/**
		 * Limit how many Settings to delete.
		 */
		limit?: number
	}

	/**
	 * Settings without action
	 */
	export type SettingsDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
		/**
		 * Select specific fields to fetch from the Settings
		 */
		select?: SettingsSelect<ExtArgs> | null
		/**
		 * Omit specific fields from the Settings
		 */
		omit?: SettingsOmit<ExtArgs> | null
		/**
		 * Choose, which related nodes to fetch as well
		 */
		include?: SettingsInclude<ExtArgs> | null
	}

	/**
	 * Model FileCache
	 */

	export type AggregateFileCache = {
		_count: FileCacheCountAggregateOutputType | null
		_avg: FileCacheAvgAggregateOutputType | null
		_sum: FileCacheSumAggregateOutputType | null
		_min: FileCacheMinAggregateOutputType | null
		_max: FileCacheMaxAggregateOutputType | null
	}

	export type FileCacheAvgAggregateOutputType = {
		id: number | null
	}

	export type FileCacheSumAggregateOutputType = {
		id: number | null
	}

	export type FileCacheMinAggregateOutputType = {
		id: number | null
		path: string | null
		content: string | null
		sha: string | null
		repoOwner: string | null
		repoName: string | null
		expiresAt: Date | null
		createdAt: Date | null
		updatedAt: Date | null
	}

	export type FileCacheMaxAggregateOutputType = {
		id: number | null
		path: string | null
		content: string | null
		sha: string | null
		repoOwner: string | null
		repoName: string | null
		expiresAt: Date | null
		createdAt: Date | null
		updatedAt: Date | null
	}

	export type FileCacheCountAggregateOutputType = {
		id: number
		path: number
		content: number
		sha: number
		repoOwner: number
		repoName: number
		expiresAt: number
		createdAt: number
		updatedAt: number
		_all: number
	}

	export type FileCacheAvgAggregateInputType = {
		id?: true
	}

	export type FileCacheSumAggregateInputType = {
		id?: true
	}

	export type FileCacheMinAggregateInputType = {
		id?: true
		path?: true
		content?: true
		sha?: true
		repoOwner?: true
		repoName?: true
		expiresAt?: true
		createdAt?: true
		updatedAt?: true
	}

	export type FileCacheMaxAggregateInputType = {
		id?: true
		path?: true
		content?: true
		sha?: true
		repoOwner?: true
		repoName?: true
		expiresAt?: true
		createdAt?: true
		updatedAt?: true
	}

	export type FileCacheCountAggregateInputType = {
		id?: true
		path?: true
		content?: true
		sha?: true
		repoOwner?: true
		repoName?: true
		expiresAt?: true
		createdAt?: true
		updatedAt?: true
		_all?: true
	}

	export type FileCacheAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
		/**
		 * Filter which FileCache to aggregate.
		 */
		where?: FileCacheWhereInput
		/**
		 * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
		 *
		 * Determine the order of FileCaches to fetch.
		 */
		orderBy?: FileCacheOrderByWithRelationInput | FileCacheOrderByWithRelationInput[]
		/**
		 * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
		 *
		 * Sets the start position
		 */
		cursor?: FileCacheWhereUniqueInput
		/**
		 * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
		 *
		 * Take `±n` FileCaches from the position of the cursor.
		 */
		take?: number
		/**
		 * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
		 *
		 * Skip the first `n` FileCaches.
		 */
		skip?: number
		/**
		 * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
		 *
		 * Count returned FileCaches
		 **/
		_count?: true | FileCacheCountAggregateInputType
		/**
		 * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
		 *
		 * Select which fields to average
		 **/
		_avg?: FileCacheAvgAggregateInputType
		/**
		 * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
		 *
		 * Select which fields to sum
		 **/
		_sum?: FileCacheSumAggregateInputType
		/**
		 * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
		 *
		 * Select which fields to find the minimum value
		 **/
		_min?: FileCacheMinAggregateInputType
		/**
		 * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
		 *
		 * Select which fields to find the maximum value
		 **/
		_max?: FileCacheMaxAggregateInputType
	}

	export type GetFileCacheAggregateType<T extends FileCacheAggregateArgs> = {
		[P in keyof T & keyof AggregateFileCache]: P extends "_count" | "count"
			? T[P] extends true
				? number
				: GetScalarType<T[P], AggregateFileCache[P]>
			: GetScalarType<T[P], AggregateFileCache[P]>
	}

	export type FileCacheGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
		where?: FileCacheWhereInput
		orderBy?: FileCacheOrderByWithAggregationInput | FileCacheOrderByWithAggregationInput[]
		by: FileCacheScalarFieldEnum[] | FileCacheScalarFieldEnum
		having?: FileCacheScalarWhereWithAggregatesInput
		take?: number
		skip?: number
		_count?: FileCacheCountAggregateInputType | true
		_avg?: FileCacheAvgAggregateInputType
		_sum?: FileCacheSumAggregateInputType
		_min?: FileCacheMinAggregateInputType
		_max?: FileCacheMaxAggregateInputType
	}

	export type FileCacheGroupByOutputType = {
		id: number
		path: string
		content: string
		sha: string | null
		repoOwner: string
		repoName: string
		expiresAt: Date
		createdAt: Date
		updatedAt: Date
		_count: FileCacheCountAggregateOutputType | null
		_avg: FileCacheAvgAggregateOutputType | null
		_sum: FileCacheSumAggregateOutputType | null
		_min: FileCacheMinAggregateOutputType | null
		_max: FileCacheMaxAggregateOutputType | null
	}

	type GetFileCacheGroupByPayload<T extends FileCacheGroupByArgs> = Prisma.PrismaPromise<
		Array<
			PickEnumerable<FileCacheGroupByOutputType, T["by"]> & {
				[P in keyof T & keyof FileCacheGroupByOutputType]: P extends "_count"
					? T[P] extends boolean
						? number
						: GetScalarType<T[P], FileCacheGroupByOutputType[P]>
					: GetScalarType<T[P], FileCacheGroupByOutputType[P]>
			}
		>
	>

	export type FileCacheSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
		$Extensions.GetSelect<
			{
				id?: boolean
				path?: boolean
				content?: boolean
				sha?: boolean
				repoOwner?: boolean
				repoName?: boolean
				expiresAt?: boolean
				createdAt?: boolean
				updatedAt?: boolean
			},
			ExtArgs["result"]["fileCache"]
		>

	export type FileCacheSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
		$Extensions.GetSelect<
			{
				id?: boolean
				path?: boolean
				content?: boolean
				sha?: boolean
				repoOwner?: boolean
				repoName?: boolean
				expiresAt?: boolean
				createdAt?: boolean
				updatedAt?: boolean
			},
			ExtArgs["result"]["fileCache"]
		>

	export type FileCacheSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
		$Extensions.GetSelect<
			{
				id?: boolean
				path?: boolean
				content?: boolean
				sha?: boolean
				repoOwner?: boolean
				repoName?: boolean
				expiresAt?: boolean
				createdAt?: boolean
				updatedAt?: boolean
			},
			ExtArgs["result"]["fileCache"]
		>

	export type FileCacheSelectScalar = {
		id?: boolean
		path?: boolean
		content?: boolean
		sha?: boolean
		repoOwner?: boolean
		repoName?: boolean
		expiresAt?: boolean
		createdAt?: boolean
		updatedAt?: boolean
	}

	export type FileCacheOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<
		"id" | "path" | "content" | "sha" | "repoOwner" | "repoName" | "expiresAt" | "createdAt" | "updatedAt",
		ExtArgs["result"]["fileCache"]
	>

	export type $FileCachePayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
		name: "FileCache"
		objects: {}
		scalars: $Extensions.GetPayloadResult<
			{
				id: number
				path: string
				content: string
				sha: string | null
				repoOwner: string
				repoName: string
				expiresAt: Date
				createdAt: Date
				updatedAt: Date
			},
			ExtArgs["result"]["fileCache"]
		>
		composites: {}
	}

	type FileCacheGetPayload<S extends boolean | null | undefined | FileCacheDefaultArgs> = $Result.GetResult<
		Prisma.$FileCachePayload,
		S
	>

	type FileCacheCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = Omit<
		FileCacheFindManyArgs,
		"select" | "include" | "distinct" | "omit"
	> & {
		select?: FileCacheCountAggregateInputType | true
	}

	export interface FileCacheDelegate<
		ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
		GlobalOmitOptions = {},
	> {
		[K: symbol]: { types: Prisma.TypeMap<ExtArgs>["model"]["FileCache"]; meta: { name: "FileCache" } }
		/**
		 * Find zero or one FileCache that matches the filter.
		 * @param {FileCacheFindUniqueArgs} args - Arguments to find a FileCache
		 * @example
		 * // Get one FileCache
		 * const fileCache = await prisma.fileCache.findUnique({
		 *   where: {
		 *     // ... provide filter here
		 *   }
		 * })
		 */
		findUnique<T extends FileCacheFindUniqueArgs>(
			args: SelectSubset<T, FileCacheFindUniqueArgs<ExtArgs>>,
		): Prisma__FileCacheClient<
			$Result.GetResult<Prisma.$FileCachePayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null,
			null,
			ExtArgs,
			GlobalOmitOptions
		>

		/**
		 * Find one FileCache that matches the filter or throw an error with `error.code='P2025'`
		 * if no matches were found.
		 * @param {FileCacheFindUniqueOrThrowArgs} args - Arguments to find a FileCache
		 * @example
		 * // Get one FileCache
		 * const fileCache = await prisma.fileCache.findUniqueOrThrow({
		 *   where: {
		 *     // ... provide filter here
		 *   }
		 * })
		 */
		findUniqueOrThrow<T extends FileCacheFindUniqueOrThrowArgs>(
			args: SelectSubset<T, FileCacheFindUniqueOrThrowArgs<ExtArgs>>,
		): Prisma__FileCacheClient<
			$Result.GetResult<Prisma.$FileCachePayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>,
			never,
			ExtArgs,
			GlobalOmitOptions
		>

		/**
		 * Find the first FileCache that matches the filter.
		 * Note, that providing `undefined` is treated as the value not being there.
		 * Read more here: https://pris.ly/d/null-undefined
		 * @param {FileCacheFindFirstArgs} args - Arguments to find a FileCache
		 * @example
		 * // Get one FileCache
		 * const fileCache = await prisma.fileCache.findFirst({
		 *   where: {
		 *     // ... provide filter here
		 *   }
		 * })
		 */
		findFirst<T extends FileCacheFindFirstArgs>(
			args?: SelectSubset<T, FileCacheFindFirstArgs<ExtArgs>>,
		): Prisma__FileCacheClient<
			$Result.GetResult<Prisma.$FileCachePayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null,
			null,
			ExtArgs,
			GlobalOmitOptions
		>

		/**
		 * Find the first FileCache that matches the filter or
		 * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
		 * Note, that providing `undefined` is treated as the value not being there.
		 * Read more here: https://pris.ly/d/null-undefined
		 * @param {FileCacheFindFirstOrThrowArgs} args - Arguments to find a FileCache
		 * @example
		 * // Get one FileCache
		 * const fileCache = await prisma.fileCache.findFirstOrThrow({
		 *   where: {
		 *     // ... provide filter here
		 *   }
		 * })
		 */
		findFirstOrThrow<T extends FileCacheFindFirstOrThrowArgs>(
			args?: SelectSubset<T, FileCacheFindFirstOrThrowArgs<ExtArgs>>,
		): Prisma__FileCacheClient<
			$Result.GetResult<Prisma.$FileCachePayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>,
			never,
			ExtArgs,
			GlobalOmitOptions
		>

		/**
		 * Find zero or more FileCaches that matches the filter.
		 * Note, that providing `undefined` is treated as the value not being there.
		 * Read more here: https://pris.ly/d/null-undefined
		 * @param {FileCacheFindManyArgs} args - Arguments to filter and select certain fields only.
		 * @example
		 * // Get all FileCaches
		 * const fileCaches = await prisma.fileCache.findMany()
		 *
		 * // Get first 10 FileCaches
		 * const fileCaches = await prisma.fileCache.findMany({ take: 10 })
		 *
		 * // Only select the `id`
		 * const fileCacheWithIdOnly = await prisma.fileCache.findMany({ select: { id: true } })
		 *
		 */
		findMany<T extends FileCacheFindManyArgs>(
			args?: SelectSubset<T, FileCacheFindManyArgs<ExtArgs>>,
		): Prisma.PrismaPromise<$Result.GetResult<Prisma.$FileCachePayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

		/**
		 * Create a FileCache.
		 * @param {FileCacheCreateArgs} args - Arguments to create a FileCache.
		 * @example
		 * // Create one FileCache
		 * const FileCache = await prisma.fileCache.create({
		 *   data: {
		 *     // ... data to create a FileCache
		 *   }
		 * })
		 *
		 */
		create<T extends FileCacheCreateArgs>(
			args: SelectSubset<T, FileCacheCreateArgs<ExtArgs>>,
		): Prisma__FileCacheClient<
			$Result.GetResult<Prisma.$FileCachePayload<ExtArgs>, T, "create", GlobalOmitOptions>,
			never,
			ExtArgs,
			GlobalOmitOptions
		>

		/**
		 * Create many FileCaches.
		 * @param {FileCacheCreateManyArgs} args - Arguments to create many FileCaches.
		 * @example
		 * // Create many FileCaches
		 * const fileCache = await prisma.fileCache.createMany({
		 *   data: [
		 *     // ... provide data here
		 *   ]
		 * })
		 *
		 */
		createMany<T extends FileCacheCreateManyArgs>(
			args?: SelectSubset<T, FileCacheCreateManyArgs<ExtArgs>>,
		): Prisma.PrismaPromise<BatchPayload>

		/**
		 * Create many FileCaches and returns the data saved in the database.
		 * @param {FileCacheCreateManyAndReturnArgs} args - Arguments to create many FileCaches.
		 * @example
		 * // Create many FileCaches
		 * const fileCache = await prisma.fileCache.createManyAndReturn({
		 *   data: [
		 *     // ... provide data here
		 *   ]
		 * })
		 *
		 * // Create many FileCaches and only return the `id`
		 * const fileCacheWithIdOnly = await prisma.fileCache.createManyAndReturn({
		 *   select: { id: true },
		 *   data: [
		 *     // ... provide data here
		 *   ]
		 * })
		 * Note, that providing `undefined` is treated as the value not being there.
		 * Read more here: https://pris.ly/d/null-undefined
		 *
		 */
		createManyAndReturn<T extends FileCacheCreateManyAndReturnArgs>(
			args?: SelectSubset<T, FileCacheCreateManyAndReturnArgs<ExtArgs>>,
		): Prisma.PrismaPromise<
			$Result.GetResult<Prisma.$FileCachePayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>
		>

		/**
		 * Delete a FileCache.
		 * @param {FileCacheDeleteArgs} args - Arguments to delete one FileCache.
		 * @example
		 * // Delete one FileCache
		 * const FileCache = await prisma.fileCache.delete({
		 *   where: {
		 *     // ... filter to delete one FileCache
		 *   }
		 * })
		 *
		 */
		delete<T extends FileCacheDeleteArgs>(
			args: SelectSubset<T, FileCacheDeleteArgs<ExtArgs>>,
		): Prisma__FileCacheClient<
			$Result.GetResult<Prisma.$FileCachePayload<ExtArgs>, T, "delete", GlobalOmitOptions>,
			never,
			ExtArgs,
			GlobalOmitOptions
		>

		/**
		 * Update one FileCache.
		 * @param {FileCacheUpdateArgs} args - Arguments to update one FileCache.
		 * @example
		 * // Update one FileCache
		 * const fileCache = await prisma.fileCache.update({
		 *   where: {
		 *     // ... provide filter here
		 *   },
		 *   data: {
		 *     // ... provide data here
		 *   }
		 * })
		 *
		 */
		update<T extends FileCacheUpdateArgs>(
			args: SelectSubset<T, FileCacheUpdateArgs<ExtArgs>>,
		): Prisma__FileCacheClient<
			$Result.GetResult<Prisma.$FileCachePayload<ExtArgs>, T, "update", GlobalOmitOptions>,
			never,
			ExtArgs,
			GlobalOmitOptions
		>

		/**
		 * Delete zero or more FileCaches.
		 * @param {FileCacheDeleteManyArgs} args - Arguments to filter FileCaches to delete.
		 * @example
		 * // Delete a few FileCaches
		 * const { count } = await prisma.fileCache.deleteMany({
		 *   where: {
		 *     // ... provide filter here
		 *   }
		 * })
		 *
		 */
		deleteMany<T extends FileCacheDeleteManyArgs>(
			args?: SelectSubset<T, FileCacheDeleteManyArgs<ExtArgs>>,
		): Prisma.PrismaPromise<BatchPayload>

		/**
		 * Update zero or more FileCaches.
		 * Note, that providing `undefined` is treated as the value not being there.
		 * Read more here: https://pris.ly/d/null-undefined
		 * @param {FileCacheUpdateManyArgs} args - Arguments to update one or more rows.
		 * @example
		 * // Update many FileCaches
		 * const fileCache = await prisma.fileCache.updateMany({
		 *   where: {
		 *     // ... provide filter here
		 *   },
		 *   data: {
		 *     // ... provide data here
		 *   }
		 * })
		 *
		 */
		updateMany<T extends FileCacheUpdateManyArgs>(
			args: SelectSubset<T, FileCacheUpdateManyArgs<ExtArgs>>,
		): Prisma.PrismaPromise<BatchPayload>

		/**
		 * Update zero or more FileCaches and returns the data updated in the database.
		 * @param {FileCacheUpdateManyAndReturnArgs} args - Arguments to update many FileCaches.
		 * @example
		 * // Update many FileCaches
		 * const fileCache = await prisma.fileCache.updateManyAndReturn({
		 *   where: {
		 *     // ... provide filter here
		 *   },
		 *   data: [
		 *     // ... provide data here
		 *   ]
		 * })
		 *
		 * // Update zero or more FileCaches and only return the `id`
		 * const fileCacheWithIdOnly = await prisma.fileCache.updateManyAndReturn({
		 *   select: { id: true },
		 *   where: {
		 *     // ... provide filter here
		 *   },
		 *   data: [
		 *     // ... provide data here
		 *   ]
		 * })
		 * Note, that providing `undefined` is treated as the value not being there.
		 * Read more here: https://pris.ly/d/null-undefined
		 *
		 */
		updateManyAndReturn<T extends FileCacheUpdateManyAndReturnArgs>(
			args: SelectSubset<T, FileCacheUpdateManyAndReturnArgs<ExtArgs>>,
		): Prisma.PrismaPromise<
			$Result.GetResult<Prisma.$FileCachePayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>
		>

		/**
		 * Create or update one FileCache.
		 * @param {FileCacheUpsertArgs} args - Arguments to update or create a FileCache.
		 * @example
		 * // Update or create a FileCache
		 * const fileCache = await prisma.fileCache.upsert({
		 *   create: {
		 *     // ... data to create a FileCache
		 *   },
		 *   update: {
		 *     // ... in case it already exists, update
		 *   },
		 *   where: {
		 *     // ... the filter for the FileCache we want to update
		 *   }
		 * })
		 */
		upsert<T extends FileCacheUpsertArgs>(
			args: SelectSubset<T, FileCacheUpsertArgs<ExtArgs>>,
		): Prisma__FileCacheClient<
			$Result.GetResult<Prisma.$FileCachePayload<ExtArgs>, T, "upsert", GlobalOmitOptions>,
			never,
			ExtArgs,
			GlobalOmitOptions
		>

		/**
		 * Count the number of FileCaches.
		 * Note, that providing `undefined` is treated as the value not being there.
		 * Read more here: https://pris.ly/d/null-undefined
		 * @param {FileCacheCountArgs} args - Arguments to filter FileCaches to count.
		 * @example
		 * // Count the number of FileCaches
		 * const count = await prisma.fileCache.count({
		 *   where: {
		 *     // ... the filter for the FileCaches we want to count
		 *   }
		 * })
		 **/
		count<T extends FileCacheCountArgs>(
			args?: Subset<T, FileCacheCountArgs>,
		): Prisma.PrismaPromise<
			T extends $Utils.Record<"select", any>
				? T["select"] extends true
					? number
					: GetScalarType<T["select"], FileCacheCountAggregateOutputType>
				: number
		>

		/**
		 * Allows you to perform aggregations operations on a FileCache.
		 * Note, that providing `undefined` is treated as the value not being there.
		 * Read more here: https://pris.ly/d/null-undefined
		 * @param {FileCacheAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
		 * @example
		 * // Ordered by age ascending
		 * // Where email contains prisma.io
		 * // Limited to the 10 users
		 * const aggregations = await prisma.user.aggregate({
		 *   _avg: {
		 *     age: true,
		 *   },
		 *   where: {
		 *     email: {
		 *       contains: "prisma.io",
		 *     },
		 *   },
		 *   orderBy: {
		 *     age: "asc",
		 *   },
		 *   take: 10,
		 * })
		 **/
		aggregate<T extends FileCacheAggregateArgs>(
			args: Subset<T, FileCacheAggregateArgs>,
		): Prisma.PrismaPromise<GetFileCacheAggregateType<T>>

		/**
		 * Group by FileCache.
		 * Note, that providing `undefined` is treated as the value not being there.
		 * Read more here: https://pris.ly/d/null-undefined
		 * @param {FileCacheGroupByArgs} args - Group by arguments.
		 * @example
		 * // Group by city, order by createdAt, get count
		 * const result = await prisma.user.groupBy({
		 *   by: ['city', 'createdAt'],
		 *   orderBy: {
		 *     createdAt: true
		 *   },
		 *   _count: {
		 *     _all: true
		 *   },
		 * })
		 *
		 **/
		groupBy<
			T extends FileCacheGroupByArgs,
			HasSelectOrTake extends Or<Extends<"skip", Keys<T>>, Extends<"take", Keys<T>>>,
			OrderByArg extends True extends HasSelectOrTake
				? { orderBy: FileCacheGroupByArgs["orderBy"] }
				: { orderBy?: FileCacheGroupByArgs["orderBy"] },
			OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T["orderBy"]>>>,
			ByFields extends MaybeTupleToUnion<T["by"]>,
			ByValid extends Has<ByFields, OrderFields>,
			HavingFields extends GetHavingFields<T["having"]>,
			HavingValid extends Has<ByFields, HavingFields>,
			ByEmpty extends T["by"] extends never[] ? True : False,
			InputErrors extends ByEmpty extends True
				? `Error: "by" must not be empty.`
				: HavingValid extends False
					? {
							[P in HavingFields]: P extends ByFields
								? never
								: P extends string
									? `Error: Field "${P}" used in "having" needs to be provided in "by".`
									: [Error, "Field ", P, ` in "having" needs to be provided in "by"`]
						}[HavingFields]
					: "take" extends Keys<T>
						? "orderBy" extends Keys<T>
							? ByValid extends True
								? {}
								: {
										[P in OrderFields]: P extends ByFields
											? never
											: `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
									}[OrderFields]
							: 'Error: If you provide "take", you also need to provide "orderBy"'
						: "skip" extends Keys<T>
							? "orderBy" extends Keys<T>
								? ByValid extends True
									? {}
									: {
											[P in OrderFields]: P extends ByFields
												? never
												: `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
										}[OrderFields]
								: 'Error: If you provide "skip", you also need to provide "orderBy"'
							: ByValid extends True
								? {}
								: {
										[P in OrderFields]: P extends ByFields
											? never
											: `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
									}[OrderFields],
		>(
			args: SubsetIntersection<T, FileCacheGroupByArgs, OrderByArg> & InputErrors,
		): {} extends InputErrors ? GetFileCacheGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
		/**
		 * Fields of the FileCache model
		 */
		readonly fields: FileCacheFieldRefs
	}

	/**
	 * The delegate class that acts as a "Promise-like" for FileCache.
	 * Why is this prefixed with `Prisma__`?
	 * Because we want to prevent naming conflicts as mentioned in
	 * https://github.com/prisma/prisma-client-js/issues/707
	 */
	export interface Prisma__FileCacheClient<
		T,
		Null = never,
		ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs,
		GlobalOmitOptions = {},
	> extends Prisma.PrismaPromise<T> {
		readonly [Symbol.toStringTag]: "PrismaPromise"
		/**
		 * Attaches callbacks for the resolution and/or rejection of the Promise.
		 * @param onfulfilled The callback to execute when the Promise is resolved.
		 * @param onrejected The callback to execute when the Promise is rejected.
		 * @returns A Promise for the completion of which ever callback is executed.
		 */
		then<TResult1 = T, TResult2 = never>(
			onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null,
			onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null,
		): $Utils.JsPromise<TResult1 | TResult2>
		/**
		 * Attaches a callback for only the rejection of the Promise.
		 * @param onrejected The callback to execute when the Promise is rejected.
		 * @returns A Promise for the completion of the callback.
		 */
		catch<TResult = never>(
			onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null,
		): $Utils.JsPromise<T | TResult>
		/**
		 * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
		 * resolved value cannot be modified from the callback.
		 * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
		 * @returns A Promise for the completion of the callback.
		 */
		finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
	}

	/**
	 * Fields of the FileCache model
	 */
	interface FileCacheFieldRefs {
		readonly id: FieldRef<"FileCache", "Int">
		readonly path: FieldRef<"FileCache", "String">
		readonly content: FieldRef<"FileCache", "String">
		readonly sha: FieldRef<"FileCache", "String">
		readonly repoOwner: FieldRef<"FileCache", "String">
		readonly repoName: FieldRef<"FileCache", "String">
		readonly expiresAt: FieldRef<"FileCache", "DateTime">
		readonly createdAt: FieldRef<"FileCache", "DateTime">
		readonly updatedAt: FieldRef<"FileCache", "DateTime">
	}

	// Custom InputTypes
	/**
	 * FileCache findUnique
	 */
	export type FileCacheFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
		/**
		 * Select specific fields to fetch from the FileCache
		 */
		select?: FileCacheSelect<ExtArgs> | null
		/**
		 * Omit specific fields from the FileCache
		 */
		omit?: FileCacheOmit<ExtArgs> | null
		/**
		 * Filter, which FileCache to fetch.
		 */
		where: FileCacheWhereUniqueInput
	}

	/**
	 * FileCache findUniqueOrThrow
	 */
	export type FileCacheFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
		/**
		 * Select specific fields to fetch from the FileCache
		 */
		select?: FileCacheSelect<ExtArgs> | null
		/**
		 * Omit specific fields from the FileCache
		 */
		omit?: FileCacheOmit<ExtArgs> | null
		/**
		 * Filter, which FileCache to fetch.
		 */
		where: FileCacheWhereUniqueInput
	}

	/**
	 * FileCache findFirst
	 */
	export type FileCacheFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
		/**
		 * Select specific fields to fetch from the FileCache
		 */
		select?: FileCacheSelect<ExtArgs> | null
		/**
		 * Omit specific fields from the FileCache
		 */
		omit?: FileCacheOmit<ExtArgs> | null
		/**
		 * Filter, which FileCache to fetch.
		 */
		where?: FileCacheWhereInput
		/**
		 * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
		 *
		 * Determine the order of FileCaches to fetch.
		 */
		orderBy?: FileCacheOrderByWithRelationInput | FileCacheOrderByWithRelationInput[]
		/**
		 * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
		 *
		 * Sets the position for searching for FileCaches.
		 */
		cursor?: FileCacheWhereUniqueInput
		/**
		 * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
		 *
		 * Take `±n` FileCaches from the position of the cursor.
		 */
		take?: number
		/**
		 * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
		 *
		 * Skip the first `n` FileCaches.
		 */
		skip?: number
		/**
		 * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
		 *
		 * Filter by unique combinations of FileCaches.
		 */
		distinct?: FileCacheScalarFieldEnum | FileCacheScalarFieldEnum[]
	}

	/**
	 * FileCache findFirstOrThrow
	 */
	export type FileCacheFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
		/**
		 * Select specific fields to fetch from the FileCache
		 */
		select?: FileCacheSelect<ExtArgs> | null
		/**
		 * Omit specific fields from the FileCache
		 */
		omit?: FileCacheOmit<ExtArgs> | null
		/**
		 * Filter, which FileCache to fetch.
		 */
		where?: FileCacheWhereInput
		/**
		 * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
		 *
		 * Determine the order of FileCaches to fetch.
		 */
		orderBy?: FileCacheOrderByWithRelationInput | FileCacheOrderByWithRelationInput[]
		/**
		 * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
		 *
		 * Sets the position for searching for FileCaches.
		 */
		cursor?: FileCacheWhereUniqueInput
		/**
		 * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
		 *
		 * Take `±n` FileCaches from the position of the cursor.
		 */
		take?: number
		/**
		 * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
		 *
		 * Skip the first `n` FileCaches.
		 */
		skip?: number
		/**
		 * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
		 *
		 * Filter by unique combinations of FileCaches.
		 */
		distinct?: FileCacheScalarFieldEnum | FileCacheScalarFieldEnum[]
	}

	/**
	 * FileCache findMany
	 */
	export type FileCacheFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
		/**
		 * Select specific fields to fetch from the FileCache
		 */
		select?: FileCacheSelect<ExtArgs> | null
		/**
		 * Omit specific fields from the FileCache
		 */
		omit?: FileCacheOmit<ExtArgs> | null
		/**
		 * Filter, which FileCaches to fetch.
		 */
		where?: FileCacheWhereInput
		/**
		 * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
		 *
		 * Determine the order of FileCaches to fetch.
		 */
		orderBy?: FileCacheOrderByWithRelationInput | FileCacheOrderByWithRelationInput[]
		/**
		 * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
		 *
		 * Sets the position for listing FileCaches.
		 */
		cursor?: FileCacheWhereUniqueInput
		/**
		 * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
		 *
		 * Take `±n` FileCaches from the position of the cursor.
		 */
		take?: number
		/**
		 * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
		 *
		 * Skip the first `n` FileCaches.
		 */
		skip?: number
		distinct?: FileCacheScalarFieldEnum | FileCacheScalarFieldEnum[]
	}

	/**
	 * FileCache create
	 */
	export type FileCacheCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
		/**
		 * Select specific fields to fetch from the FileCache
		 */
		select?: FileCacheSelect<ExtArgs> | null
		/**
		 * Omit specific fields from the FileCache
		 */
		omit?: FileCacheOmit<ExtArgs> | null
		/**
		 * The data needed to create a FileCache.
		 */
		data: XOR<FileCacheCreateInput, FileCacheUncheckedCreateInput>
	}

	/**
	 * FileCache createMany
	 */
	export type FileCacheCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
		/**
		 * The data used to create many FileCaches.
		 */
		data: FileCacheCreateManyInput | FileCacheCreateManyInput[]
		skipDuplicates?: boolean
	}

	/**
	 * FileCache createManyAndReturn
	 */
	export type FileCacheCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
		/**
		 * Select specific fields to fetch from the FileCache
		 */
		select?: FileCacheSelectCreateManyAndReturn<ExtArgs> | null
		/**
		 * Omit specific fields from the FileCache
		 */
		omit?: FileCacheOmit<ExtArgs> | null
		/**
		 * The data used to create many FileCaches.
		 */
		data: FileCacheCreateManyInput | FileCacheCreateManyInput[]
		skipDuplicates?: boolean
	}

	/**
	 * FileCache update
	 */
	export type FileCacheUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
		/**
		 * Select specific fields to fetch from the FileCache
		 */
		select?: FileCacheSelect<ExtArgs> | null
		/**
		 * Omit specific fields from the FileCache
		 */
		omit?: FileCacheOmit<ExtArgs> | null
		/**
		 * The data needed to update a FileCache.
		 */
		data: XOR<FileCacheUpdateInput, FileCacheUncheckedUpdateInput>
		/**
		 * Choose, which FileCache to update.
		 */
		where: FileCacheWhereUniqueInput
	}

	/**
	 * FileCache updateMany
	 */
	export type FileCacheUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
		/**
		 * The data used to update FileCaches.
		 */
		data: XOR<FileCacheUpdateManyMutationInput, FileCacheUncheckedUpdateManyInput>
		/**
		 * Filter which FileCaches to update
		 */
		where?: FileCacheWhereInput
		/**
		 * Limit how many FileCaches to update.
		 */
		limit?: number
	}

	/**
	 * FileCache updateManyAndReturn
	 */
	export type FileCacheUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
		/**
		 * Select specific fields to fetch from the FileCache
		 */
		select?: FileCacheSelectUpdateManyAndReturn<ExtArgs> | null
		/**
		 * Omit specific fields from the FileCache
		 */
		omit?: FileCacheOmit<ExtArgs> | null
		/**
		 * The data used to update FileCaches.
		 */
		data: XOR<FileCacheUpdateManyMutationInput, FileCacheUncheckedUpdateManyInput>
		/**
		 * Filter which FileCaches to update
		 */
		where?: FileCacheWhereInput
		/**
		 * Limit how many FileCaches to update.
		 */
		limit?: number
	}

	/**
	 * FileCache upsert
	 */
	export type FileCacheUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
		/**
		 * Select specific fields to fetch from the FileCache
		 */
		select?: FileCacheSelect<ExtArgs> | null
		/**
		 * Omit specific fields from the FileCache
		 */
		omit?: FileCacheOmit<ExtArgs> | null
		/**
		 * The filter to search for the FileCache to update in case it exists.
		 */
		where: FileCacheWhereUniqueInput
		/**
		 * In case the FileCache found by the `where` argument doesn't exist, create a new FileCache with this data.
		 */
		create: XOR<FileCacheCreateInput, FileCacheUncheckedCreateInput>
		/**
		 * In case the FileCache was found with the provided `where` argument, update it with this data.
		 */
		update: XOR<FileCacheUpdateInput, FileCacheUncheckedUpdateInput>
	}

	/**
	 * FileCache delete
	 */
	export type FileCacheDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
		/**
		 * Select specific fields to fetch from the FileCache
		 */
		select?: FileCacheSelect<ExtArgs> | null
		/**
		 * Omit specific fields from the FileCache
		 */
		omit?: FileCacheOmit<ExtArgs> | null
		/**
		 * Filter which FileCache to delete.
		 */
		where: FileCacheWhereUniqueInput
	}

	/**
	 * FileCache deleteMany
	 */
	export type FileCacheDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
		/**
		 * Filter which FileCaches to delete
		 */
		where?: FileCacheWhereInput
		/**
		 * Limit how many FileCaches to delete.
		 */
		limit?: number
	}

	/**
	 * FileCache without action
	 */
	export type FileCacheDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
		/**
		 * Select specific fields to fetch from the FileCache
		 */
		select?: FileCacheSelect<ExtArgs> | null
		/**
		 * Omit specific fields from the FileCache
		 */
		omit?: FileCacheOmit<ExtArgs> | null
	}

	/**
	 * Enums
	 */

	export const TransactionIsolationLevel: {
		ReadUncommitted: "ReadUncommitted"
		ReadCommitted: "ReadCommitted"
		RepeatableRead: "RepeatableRead"
		Serializable: "Serializable"
	}

	export type TransactionIsolationLevel = (typeof TransactionIsolationLevel)[keyof typeof TransactionIsolationLevel]

	export const UserScalarFieldEnum: {
		id: "id"
		email: "email"
		name: "name"
		hashedPassword: "hashedPassword"
		githubId: "githubId"
		githubToken: "githubToken"
		createdAt: "createdAt"
		updatedAt: "updatedAt"
	}

	export type UserScalarFieldEnum = (typeof UserScalarFieldEnum)[keyof typeof UserScalarFieldEnum]

	export const TaskScalarFieldEnum: {
		id: "id"
		taskId: "taskId"
		instanceId: "instanceId"
		userId: "userId"
		messages: "messages"
		configuration: "configuration"
		status: "status"
		createdAt: "createdAt"
		updatedAt: "updatedAt"
	}

	export type TaskScalarFieldEnum = (typeof TaskScalarFieldEnum)[keyof typeof TaskScalarFieldEnum]

	export const CheckpointScalarFieldEnum: {
		id: "id"
		taskId: "taskId"
		data: "data"
		timestamp: "timestamp"
		createdAt: "createdAt"
	}

	export type CheckpointScalarFieldEnum = (typeof CheckpointScalarFieldEnum)[keyof typeof CheckpointScalarFieldEnum]

	export const SettingsScalarFieldEnum: {
		id: "id"
		userId: "userId"
		settings: "settings"
		timestamp: "timestamp"
		version: "version"
		createdAt: "createdAt"
		updatedAt: "updatedAt"
	}

	export type SettingsScalarFieldEnum = (typeof SettingsScalarFieldEnum)[keyof typeof SettingsScalarFieldEnum]

	export const FileCacheScalarFieldEnum: {
		id: "id"
		path: "path"
		content: "content"
		sha: "sha"
		repoOwner: "repoOwner"
		repoName: "repoName"
		expiresAt: "expiresAt"
		createdAt: "createdAt"
		updatedAt: "updatedAt"
	}

	export type FileCacheScalarFieldEnum = (typeof FileCacheScalarFieldEnum)[keyof typeof FileCacheScalarFieldEnum]

	export const SortOrder: {
		asc: "asc"
		desc: "desc"
	}

	export type SortOrder = (typeof SortOrder)[keyof typeof SortOrder]

	export const JsonNullValueInput: {
		JsonNull: typeof JsonNull
	}

	export type JsonNullValueInput = (typeof JsonNullValueInput)[keyof typeof JsonNullValueInput]

	export const QueryMode: {
		default: "default"
		insensitive: "insensitive"
	}

	export type QueryMode = (typeof QueryMode)[keyof typeof QueryMode]

	export const NullsOrder: {
		first: "first"
		last: "last"
	}

	export type NullsOrder = (typeof NullsOrder)[keyof typeof NullsOrder]

	export const JsonNullValueFilter: {
		DbNull: typeof DbNull
		JsonNull: typeof JsonNull
		AnyNull: typeof AnyNull
	}

	export type JsonNullValueFilter = (typeof JsonNullValueFilter)[keyof typeof JsonNullValueFilter]

	/**
	 * Field references
	 */

	/**
	 * Reference to a field of type 'String'
	 */
	export type StringFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, "String">

	/**
	 * Reference to a field of type 'String[]'
	 */
	export type ListStringFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, "String[]">

	/**
	 * Reference to a field of type 'DateTime'
	 */
	export type DateTimeFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, "DateTime">

	/**
	 * Reference to a field of type 'DateTime[]'
	 */
	export type ListDateTimeFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, "DateTime[]">

	/**
	 * Reference to a field of type 'Int'
	 */
	export type IntFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, "Int">

	/**
	 * Reference to a field of type 'Int[]'
	 */
	export type ListIntFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, "Int[]">

	/**
	 * Reference to a field of type 'Json'
	 */
	export type JsonFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, "Json">

	/**
	 * Reference to a field of type 'QueryMode'
	 */
	export type EnumQueryModeFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, "QueryMode">

	/**
	 * Reference to a field of type 'BigInt'
	 */
	export type BigIntFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, "BigInt">

	/**
	 * Reference to a field of type 'BigInt[]'
	 */
	export type ListBigIntFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, "BigInt[]">

	/**
	 * Reference to a field of type 'Float'
	 */
	export type FloatFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, "Float">

	/**
	 * Reference to a field of type 'Float[]'
	 */
	export type ListFloatFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, "Float[]">

	/**
	 * Deep Input Types
	 */

	export type UserWhereInput = {
		AND?: UserWhereInput | UserWhereInput[]
		OR?: UserWhereInput[]
		NOT?: UserWhereInput | UserWhereInput[]
		id?: StringFilter<"User"> | string
		email?: StringFilter<"User"> | string
		name?: StringNullableFilter<"User"> | string | null
		hashedPassword?: StringNullableFilter<"User"> | string | null
		githubId?: StringNullableFilter<"User"> | string | null
		githubToken?: StringNullableFilter<"User"> | string | null
		createdAt?: DateTimeFilter<"User"> | Date | string
		updatedAt?: DateTimeFilter<"User"> | Date | string
		tasks?: TaskListRelationFilter
		settings?: XOR<SettingsNullableScalarRelationFilter, SettingsWhereInput> | null
	}

	export type UserOrderByWithRelationInput = {
		id?: SortOrder
		email?: SortOrder
		name?: SortOrderInput | SortOrder
		hashedPassword?: SortOrderInput | SortOrder
		githubId?: SortOrderInput | SortOrder
		githubToken?: SortOrderInput | SortOrder
		createdAt?: SortOrder
		updatedAt?: SortOrder
		tasks?: TaskOrderByRelationAggregateInput
		settings?: SettingsOrderByWithRelationInput
	}

	export type UserWhereUniqueInput = Prisma.AtLeast<
		{
			id?: string
			email?: string
			githubId?: string
			AND?: UserWhereInput | UserWhereInput[]
			OR?: UserWhereInput[]
			NOT?: UserWhereInput | UserWhereInput[]
			name?: StringNullableFilter<"User"> | string | null
			hashedPassword?: StringNullableFilter<"User"> | string | null
			githubToken?: StringNullableFilter<"User"> | string | null
			createdAt?: DateTimeFilter<"User"> | Date | string
			updatedAt?: DateTimeFilter<"User"> | Date | string
			tasks?: TaskListRelationFilter
			settings?: XOR<SettingsNullableScalarRelationFilter, SettingsWhereInput> | null
		},
		"id" | "email" | "githubId"
	>

	export type UserOrderByWithAggregationInput = {
		id?: SortOrder
		email?: SortOrder
		name?: SortOrderInput | SortOrder
		hashedPassword?: SortOrderInput | SortOrder
		githubId?: SortOrderInput | SortOrder
		githubToken?: SortOrderInput | SortOrder
		createdAt?: SortOrder
		updatedAt?: SortOrder
		_count?: UserCountOrderByAggregateInput
		_max?: UserMaxOrderByAggregateInput
		_min?: UserMinOrderByAggregateInput
	}

	export type UserScalarWhereWithAggregatesInput = {
		AND?: UserScalarWhereWithAggregatesInput | UserScalarWhereWithAggregatesInput[]
		OR?: UserScalarWhereWithAggregatesInput[]
		NOT?: UserScalarWhereWithAggregatesInput | UserScalarWhereWithAggregatesInput[]
		id?: StringWithAggregatesFilter<"User"> | string
		email?: StringWithAggregatesFilter<"User"> | string
		name?: StringNullableWithAggregatesFilter<"User"> | string | null
		hashedPassword?: StringNullableWithAggregatesFilter<"User"> | string | null
		githubId?: StringNullableWithAggregatesFilter<"User"> | string | null
		githubToken?: StringNullableWithAggregatesFilter<"User"> | string | null
		createdAt?: DateTimeWithAggregatesFilter<"User"> | Date | string
		updatedAt?: DateTimeWithAggregatesFilter<"User"> | Date | string
	}

	export type TaskWhereInput = {
		AND?: TaskWhereInput | TaskWhereInput[]
		OR?: TaskWhereInput[]
		NOT?: TaskWhereInput | TaskWhereInput[]
		id?: IntFilter<"Task"> | number
		taskId?: StringFilter<"Task"> | string
		instanceId?: StringFilter<"Task"> | string
		userId?: StringFilter<"Task"> | string
		messages?: JsonFilter<"Task">
		configuration?: JsonFilter<"Task">
		status?: StringFilter<"Task"> | string
		createdAt?: DateTimeFilter<"Task"> | Date | string
		updatedAt?: DateTimeFilter<"Task"> | Date | string
		user?: XOR<UserScalarRelationFilter, UserWhereInput>
		checkpoints?: CheckpointListRelationFilter
	}

	export type TaskOrderByWithRelationInput = {
		id?: SortOrder
		taskId?: SortOrder
		instanceId?: SortOrder
		userId?: SortOrder
		messages?: SortOrder
		configuration?: SortOrder
		status?: SortOrder
		createdAt?: SortOrder
		updatedAt?: SortOrder
		user?: UserOrderByWithRelationInput
		checkpoints?: CheckpointOrderByRelationAggregateInput
	}

	export type TaskWhereUniqueInput = Prisma.AtLeast<
		{
			id?: number
			taskId?: string
			AND?: TaskWhereInput | TaskWhereInput[]
			OR?: TaskWhereInput[]
			NOT?: TaskWhereInput | TaskWhereInput[]
			instanceId?: StringFilter<"Task"> | string
			userId?: StringFilter<"Task"> | string
			messages?: JsonFilter<"Task">
			configuration?: JsonFilter<"Task">
			status?: StringFilter<"Task"> | string
			createdAt?: DateTimeFilter<"Task"> | Date | string
			updatedAt?: DateTimeFilter<"Task"> | Date | string
			user?: XOR<UserScalarRelationFilter, UserWhereInput>
			checkpoints?: CheckpointListRelationFilter
		},
		"id" | "taskId"
	>

	export type TaskOrderByWithAggregationInput = {
		id?: SortOrder
		taskId?: SortOrder
		instanceId?: SortOrder
		userId?: SortOrder
		messages?: SortOrder
		configuration?: SortOrder
		status?: SortOrder
		createdAt?: SortOrder
		updatedAt?: SortOrder
		_count?: TaskCountOrderByAggregateInput
		_avg?: TaskAvgOrderByAggregateInput
		_max?: TaskMaxOrderByAggregateInput
		_min?: TaskMinOrderByAggregateInput
		_sum?: TaskSumOrderByAggregateInput
	}

	export type TaskScalarWhereWithAggregatesInput = {
		AND?: TaskScalarWhereWithAggregatesInput | TaskScalarWhereWithAggregatesInput[]
		OR?: TaskScalarWhereWithAggregatesInput[]
		NOT?: TaskScalarWhereWithAggregatesInput | TaskScalarWhereWithAggregatesInput[]
		id?: IntWithAggregatesFilter<"Task"> | number
		taskId?: StringWithAggregatesFilter<"Task"> | string
		instanceId?: StringWithAggregatesFilter<"Task"> | string
		userId?: StringWithAggregatesFilter<"Task"> | string
		messages?: JsonWithAggregatesFilter<"Task">
		configuration?: JsonWithAggregatesFilter<"Task">
		status?: StringWithAggregatesFilter<"Task"> | string
		createdAt?: DateTimeWithAggregatesFilter<"Task"> | Date | string
		updatedAt?: DateTimeWithAggregatesFilter<"Task"> | Date | string
	}

	export type CheckpointWhereInput = {
		AND?: CheckpointWhereInput | CheckpointWhereInput[]
		OR?: CheckpointWhereInput[]
		NOT?: CheckpointWhereInput | CheckpointWhereInput[]
		id?: IntFilter<"Checkpoint"> | number
		taskId?: StringFilter<"Checkpoint"> | string
		data?: JsonFilter<"Checkpoint">
		timestamp?: BigIntFilter<"Checkpoint"> | bigint | number
		createdAt?: DateTimeFilter<"Checkpoint"> | Date | string
		task?: XOR<TaskScalarRelationFilter, TaskWhereInput>
	}

	export type CheckpointOrderByWithRelationInput = {
		id?: SortOrder
		taskId?: SortOrder
		data?: SortOrder
		timestamp?: SortOrder
		createdAt?: SortOrder
		task?: TaskOrderByWithRelationInput
	}

	export type CheckpointWhereUniqueInput = Prisma.AtLeast<
		{
			id?: number
			AND?: CheckpointWhereInput | CheckpointWhereInput[]
			OR?: CheckpointWhereInput[]
			NOT?: CheckpointWhereInput | CheckpointWhereInput[]
			taskId?: StringFilter<"Checkpoint"> | string
			data?: JsonFilter<"Checkpoint">
			timestamp?: BigIntFilter<"Checkpoint"> | bigint | number
			createdAt?: DateTimeFilter<"Checkpoint"> | Date | string
			task?: XOR<TaskScalarRelationFilter, TaskWhereInput>
		},
		"id"
	>

	export type CheckpointOrderByWithAggregationInput = {
		id?: SortOrder
		taskId?: SortOrder
		data?: SortOrder
		timestamp?: SortOrder
		createdAt?: SortOrder
		_count?: CheckpointCountOrderByAggregateInput
		_avg?: CheckpointAvgOrderByAggregateInput
		_max?: CheckpointMaxOrderByAggregateInput
		_min?: CheckpointMinOrderByAggregateInput
		_sum?: CheckpointSumOrderByAggregateInput
	}

	export type CheckpointScalarWhereWithAggregatesInput = {
		AND?: CheckpointScalarWhereWithAggregatesInput | CheckpointScalarWhereWithAggregatesInput[]
		OR?: CheckpointScalarWhereWithAggregatesInput[]
		NOT?: CheckpointScalarWhereWithAggregatesInput | CheckpointScalarWhereWithAggregatesInput[]
		id?: IntWithAggregatesFilter<"Checkpoint"> | number
		taskId?: StringWithAggregatesFilter<"Checkpoint"> | string
		data?: JsonWithAggregatesFilter<"Checkpoint">
		timestamp?: BigIntWithAggregatesFilter<"Checkpoint"> | bigint | number
		createdAt?: DateTimeWithAggregatesFilter<"Checkpoint"> | Date | string
	}

	export type SettingsWhereInput = {
		AND?: SettingsWhereInput | SettingsWhereInput[]
		OR?: SettingsWhereInput[]
		NOT?: SettingsWhereInput | SettingsWhereInput[]
		id?: IntFilter<"Settings"> | number
		userId?: StringFilter<"Settings"> | string
		settings?: JsonFilter<"Settings">
		timestamp?: BigIntFilter<"Settings"> | bigint | number
		version?: IntFilter<"Settings"> | number
		createdAt?: DateTimeFilter<"Settings"> | Date | string
		updatedAt?: DateTimeFilter<"Settings"> | Date | string
		user?: XOR<UserScalarRelationFilter, UserWhereInput>
	}

	export type SettingsOrderByWithRelationInput = {
		id?: SortOrder
		userId?: SortOrder
		settings?: SortOrder
		timestamp?: SortOrder
		version?: SortOrder
		createdAt?: SortOrder
		updatedAt?: SortOrder
		user?: UserOrderByWithRelationInput
	}

	export type SettingsWhereUniqueInput = Prisma.AtLeast<
		{
			id?: number
			userId?: string
			AND?: SettingsWhereInput | SettingsWhereInput[]
			OR?: SettingsWhereInput[]
			NOT?: SettingsWhereInput | SettingsWhereInput[]
			settings?: JsonFilter<"Settings">
			timestamp?: BigIntFilter<"Settings"> | bigint | number
			version?: IntFilter<"Settings"> | number
			createdAt?: DateTimeFilter<"Settings"> | Date | string
			updatedAt?: DateTimeFilter<"Settings"> | Date | string
			user?: XOR<UserScalarRelationFilter, UserWhereInput>
		},
		"id" | "userId"
	>

	export type SettingsOrderByWithAggregationInput = {
		id?: SortOrder
		userId?: SortOrder
		settings?: SortOrder
		timestamp?: SortOrder
		version?: SortOrder
		createdAt?: SortOrder
		updatedAt?: SortOrder
		_count?: SettingsCountOrderByAggregateInput
		_avg?: SettingsAvgOrderByAggregateInput
		_max?: SettingsMaxOrderByAggregateInput
		_min?: SettingsMinOrderByAggregateInput
		_sum?: SettingsSumOrderByAggregateInput
	}

	export type SettingsScalarWhereWithAggregatesInput = {
		AND?: SettingsScalarWhereWithAggregatesInput | SettingsScalarWhereWithAggregatesInput[]
		OR?: SettingsScalarWhereWithAggregatesInput[]
		NOT?: SettingsScalarWhereWithAggregatesInput | SettingsScalarWhereWithAggregatesInput[]
		id?: IntWithAggregatesFilter<"Settings"> | number
		userId?: StringWithAggregatesFilter<"Settings"> | string
		settings?: JsonWithAggregatesFilter<"Settings">
		timestamp?: BigIntWithAggregatesFilter<"Settings"> | bigint | number
		version?: IntWithAggregatesFilter<"Settings"> | number
		createdAt?: DateTimeWithAggregatesFilter<"Settings"> | Date | string
		updatedAt?: DateTimeWithAggregatesFilter<"Settings"> | Date | string
	}

	export type FileCacheWhereInput = {
		AND?: FileCacheWhereInput | FileCacheWhereInput[]
		OR?: FileCacheWhereInput[]
		NOT?: FileCacheWhereInput | FileCacheWhereInput[]
		id?: IntFilter<"FileCache"> | number
		path?: StringFilter<"FileCache"> | string
		content?: StringFilter<"FileCache"> | string
		sha?: StringNullableFilter<"FileCache"> | string | null
		repoOwner?: StringFilter<"FileCache"> | string
		repoName?: StringFilter<"FileCache"> | string
		expiresAt?: DateTimeFilter<"FileCache"> | Date | string
		createdAt?: DateTimeFilter<"FileCache"> | Date | string
		updatedAt?: DateTimeFilter<"FileCache"> | Date | string
	}

	export type FileCacheOrderByWithRelationInput = {
		id?: SortOrder
		path?: SortOrder
		content?: SortOrder
		sha?: SortOrderInput | SortOrder
		repoOwner?: SortOrder
		repoName?: SortOrder
		expiresAt?: SortOrder
		createdAt?: SortOrder
		updatedAt?: SortOrder
	}

	export type FileCacheWhereUniqueInput = Prisma.AtLeast<
		{
			id?: number
			repoOwner_repoName_path?: FileCacheRepoOwnerRepoNamePathCompoundUniqueInput
			AND?: FileCacheWhereInput | FileCacheWhereInput[]
			OR?: FileCacheWhereInput[]
			NOT?: FileCacheWhereInput | FileCacheWhereInput[]
			path?: StringFilter<"FileCache"> | string
			content?: StringFilter<"FileCache"> | string
			sha?: StringNullableFilter<"FileCache"> | string | null
			repoOwner?: StringFilter<"FileCache"> | string
			repoName?: StringFilter<"FileCache"> | string
			expiresAt?: DateTimeFilter<"FileCache"> | Date | string
			createdAt?: DateTimeFilter<"FileCache"> | Date | string
			updatedAt?: DateTimeFilter<"FileCache"> | Date | string
		},
		"id" | "repoOwner_repoName_path"
	>

	export type FileCacheOrderByWithAggregationInput = {
		id?: SortOrder
		path?: SortOrder
		content?: SortOrder
		sha?: SortOrderInput | SortOrder
		repoOwner?: SortOrder
		repoName?: SortOrder
		expiresAt?: SortOrder
		createdAt?: SortOrder
		updatedAt?: SortOrder
		_count?: FileCacheCountOrderByAggregateInput
		_avg?: FileCacheAvgOrderByAggregateInput
		_max?: FileCacheMaxOrderByAggregateInput
		_min?: FileCacheMinOrderByAggregateInput
		_sum?: FileCacheSumOrderByAggregateInput
	}

	export type FileCacheScalarWhereWithAggregatesInput = {
		AND?: FileCacheScalarWhereWithAggregatesInput | FileCacheScalarWhereWithAggregatesInput[]
		OR?: FileCacheScalarWhereWithAggregatesInput[]
		NOT?: FileCacheScalarWhereWithAggregatesInput | FileCacheScalarWhereWithAggregatesInput[]
		id?: IntWithAggregatesFilter<"FileCache"> | number
		path?: StringWithAggregatesFilter<"FileCache"> | string
		content?: StringWithAggregatesFilter<"FileCache"> | string
		sha?: StringNullableWithAggregatesFilter<"FileCache"> | string | null
		repoOwner?: StringWithAggregatesFilter<"FileCache"> | string
		repoName?: StringWithAggregatesFilter<"FileCache"> | string
		expiresAt?: DateTimeWithAggregatesFilter<"FileCache"> | Date | string
		createdAt?: DateTimeWithAggregatesFilter<"FileCache"> | Date | string
		updatedAt?: DateTimeWithAggregatesFilter<"FileCache"> | Date | string
	}

	export type UserCreateInput = {
		id?: string
		email: string
		name?: string | null
		hashedPassword?: string | null
		githubId?: string | null
		githubToken?: string | null
		createdAt?: Date | string
		updatedAt?: Date | string
		tasks?: TaskCreateNestedManyWithoutUserInput
		settings?: SettingsCreateNestedOneWithoutUserInput
	}

	export type UserUncheckedCreateInput = {
		id?: string
		email: string
		name?: string | null
		hashedPassword?: string | null
		githubId?: string | null
		githubToken?: string | null
		createdAt?: Date | string
		updatedAt?: Date | string
		tasks?: TaskUncheckedCreateNestedManyWithoutUserInput
		settings?: SettingsUncheckedCreateNestedOneWithoutUserInput
	}

	export type UserUpdateInput = {
		id?: StringFieldUpdateOperationsInput | string
		email?: StringFieldUpdateOperationsInput | string
		name?: NullableStringFieldUpdateOperationsInput | string | null
		hashedPassword?: NullableStringFieldUpdateOperationsInput | string | null
		githubId?: NullableStringFieldUpdateOperationsInput | string | null
		githubToken?: NullableStringFieldUpdateOperationsInput | string | null
		createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
		updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
		tasks?: TaskUpdateManyWithoutUserNestedInput
		settings?: SettingsUpdateOneWithoutUserNestedInput
	}

	export type UserUncheckedUpdateInput = {
		id?: StringFieldUpdateOperationsInput | string
		email?: StringFieldUpdateOperationsInput | string
		name?: NullableStringFieldUpdateOperationsInput | string | null
		hashedPassword?: NullableStringFieldUpdateOperationsInput | string | null
		githubId?: NullableStringFieldUpdateOperationsInput | string | null
		githubToken?: NullableStringFieldUpdateOperationsInput | string | null
		createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
		updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
		tasks?: TaskUncheckedUpdateManyWithoutUserNestedInput
		settings?: SettingsUncheckedUpdateOneWithoutUserNestedInput
	}

	export type UserCreateManyInput = {
		id?: string
		email: string
		name?: string | null
		hashedPassword?: string | null
		githubId?: string | null
		githubToken?: string | null
		createdAt?: Date | string
		updatedAt?: Date | string
	}

	export type UserUpdateManyMutationInput = {
		id?: StringFieldUpdateOperationsInput | string
		email?: StringFieldUpdateOperationsInput | string
		name?: NullableStringFieldUpdateOperationsInput | string | null
		hashedPassword?: NullableStringFieldUpdateOperationsInput | string | null
		githubId?: NullableStringFieldUpdateOperationsInput | string | null
		githubToken?: NullableStringFieldUpdateOperationsInput | string | null
		createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
		updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
	}

	export type UserUncheckedUpdateManyInput = {
		id?: StringFieldUpdateOperationsInput | string
		email?: StringFieldUpdateOperationsInput | string
		name?: NullableStringFieldUpdateOperationsInput | string | null
		hashedPassword?: NullableStringFieldUpdateOperationsInput | string | null
		githubId?: NullableStringFieldUpdateOperationsInput | string | null
		githubToken?: NullableStringFieldUpdateOperationsInput | string | null
		createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
		updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
	}

	export type TaskCreateInput = {
		taskId: string
		instanceId: string
		messages?: JsonNullValueInput | InputJsonValue
		configuration?: JsonNullValueInput | InputJsonValue
		status?: string
		createdAt?: Date | string
		updatedAt?: Date | string
		user: UserCreateNestedOneWithoutTasksInput
		checkpoints?: CheckpointCreateNestedManyWithoutTaskInput
	}

	export type TaskUncheckedCreateInput = {
		id?: number
		taskId: string
		instanceId: string
		userId: string
		messages?: JsonNullValueInput | InputJsonValue
		configuration?: JsonNullValueInput | InputJsonValue
		status?: string
		createdAt?: Date | string
		updatedAt?: Date | string
		checkpoints?: CheckpointUncheckedCreateNestedManyWithoutTaskInput
	}

	export type TaskUpdateInput = {
		taskId?: StringFieldUpdateOperationsInput | string
		instanceId?: StringFieldUpdateOperationsInput | string
		messages?: JsonNullValueInput | InputJsonValue
		configuration?: JsonNullValueInput | InputJsonValue
		status?: StringFieldUpdateOperationsInput | string
		createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
		updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
		user?: UserUpdateOneRequiredWithoutTasksNestedInput
		checkpoints?: CheckpointUpdateManyWithoutTaskNestedInput
	}

	export type TaskUncheckedUpdateInput = {
		id?: IntFieldUpdateOperationsInput | number
		taskId?: StringFieldUpdateOperationsInput | string
		instanceId?: StringFieldUpdateOperationsInput | string
		userId?: StringFieldUpdateOperationsInput | string
		messages?: JsonNullValueInput | InputJsonValue
		configuration?: JsonNullValueInput | InputJsonValue
		status?: StringFieldUpdateOperationsInput | string
		createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
		updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
		checkpoints?: CheckpointUncheckedUpdateManyWithoutTaskNestedInput
	}

	export type TaskCreateManyInput = {
		id?: number
		taskId: string
		instanceId: string
		userId: string
		messages?: JsonNullValueInput | InputJsonValue
		configuration?: JsonNullValueInput | InputJsonValue
		status?: string
		createdAt?: Date | string
		updatedAt?: Date | string
	}

	export type TaskUpdateManyMutationInput = {
		taskId?: StringFieldUpdateOperationsInput | string
		instanceId?: StringFieldUpdateOperationsInput | string
		messages?: JsonNullValueInput | InputJsonValue
		configuration?: JsonNullValueInput | InputJsonValue
		status?: StringFieldUpdateOperationsInput | string
		createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
		updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
	}

	export type TaskUncheckedUpdateManyInput = {
		id?: IntFieldUpdateOperationsInput | number
		taskId?: StringFieldUpdateOperationsInput | string
		instanceId?: StringFieldUpdateOperationsInput | string
		userId?: StringFieldUpdateOperationsInput | string
		messages?: JsonNullValueInput | InputJsonValue
		configuration?: JsonNullValueInput | InputJsonValue
		status?: StringFieldUpdateOperationsInput | string
		createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
		updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
	}

	export type CheckpointCreateInput = {
		data: JsonNullValueInput | InputJsonValue
		timestamp: bigint | number
		createdAt?: Date | string
		task: TaskCreateNestedOneWithoutCheckpointsInput
	}

	export type CheckpointUncheckedCreateInput = {
		id?: number
		taskId: string
		data: JsonNullValueInput | InputJsonValue
		timestamp: bigint | number
		createdAt?: Date | string
	}

	export type CheckpointUpdateInput = {
		data?: JsonNullValueInput | InputJsonValue
		timestamp?: BigIntFieldUpdateOperationsInput | bigint | number
		createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
		task?: TaskUpdateOneRequiredWithoutCheckpointsNestedInput
	}

	export type CheckpointUncheckedUpdateInput = {
		id?: IntFieldUpdateOperationsInput | number
		taskId?: StringFieldUpdateOperationsInput | string
		data?: JsonNullValueInput | InputJsonValue
		timestamp?: BigIntFieldUpdateOperationsInput | bigint | number
		createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
	}

	export type CheckpointCreateManyInput = {
		id?: number
		taskId: string
		data: JsonNullValueInput | InputJsonValue
		timestamp: bigint | number
		createdAt?: Date | string
	}

	export type CheckpointUpdateManyMutationInput = {
		data?: JsonNullValueInput | InputJsonValue
		timestamp?: BigIntFieldUpdateOperationsInput | bigint | number
		createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
	}

	export type CheckpointUncheckedUpdateManyInput = {
		id?: IntFieldUpdateOperationsInput | number
		taskId?: StringFieldUpdateOperationsInput | string
		data?: JsonNullValueInput | InputJsonValue
		timestamp?: BigIntFieldUpdateOperationsInput | bigint | number
		createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
	}

	export type SettingsCreateInput = {
		settings: JsonNullValueInput | InputJsonValue
		timestamp: bigint | number
		version?: number
		createdAt?: Date | string
		updatedAt?: Date | string
		user: UserCreateNestedOneWithoutSettingsInput
	}

	export type SettingsUncheckedCreateInput = {
		id?: number
		userId: string
		settings: JsonNullValueInput | InputJsonValue
		timestamp: bigint | number
		version?: number
		createdAt?: Date | string
		updatedAt?: Date | string
	}

	export type SettingsUpdateInput = {
		settings?: JsonNullValueInput | InputJsonValue
		timestamp?: BigIntFieldUpdateOperationsInput | bigint | number
		version?: IntFieldUpdateOperationsInput | number
		createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
		updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
		user?: UserUpdateOneRequiredWithoutSettingsNestedInput
	}

	export type SettingsUncheckedUpdateInput = {
		id?: IntFieldUpdateOperationsInput | number
		userId?: StringFieldUpdateOperationsInput | string
		settings?: JsonNullValueInput | InputJsonValue
		timestamp?: BigIntFieldUpdateOperationsInput | bigint | number
		version?: IntFieldUpdateOperationsInput | number
		createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
		updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
	}

	export type SettingsCreateManyInput = {
		id?: number
		userId: string
		settings: JsonNullValueInput | InputJsonValue
		timestamp: bigint | number
		version?: number
		createdAt?: Date | string
		updatedAt?: Date | string
	}

	export type SettingsUpdateManyMutationInput = {
		settings?: JsonNullValueInput | InputJsonValue
		timestamp?: BigIntFieldUpdateOperationsInput | bigint | number
		version?: IntFieldUpdateOperationsInput | number
		createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
		updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
	}

	export type SettingsUncheckedUpdateManyInput = {
		id?: IntFieldUpdateOperationsInput | number
		userId?: StringFieldUpdateOperationsInput | string
		settings?: JsonNullValueInput | InputJsonValue
		timestamp?: BigIntFieldUpdateOperationsInput | bigint | number
		version?: IntFieldUpdateOperationsInput | number
		createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
		updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
	}

	export type FileCacheCreateInput = {
		path: string
		content: string
		sha?: string | null
		repoOwner: string
		repoName: string
		expiresAt: Date | string
		createdAt?: Date | string
		updatedAt?: Date | string
	}

	export type FileCacheUncheckedCreateInput = {
		id?: number
		path: string
		content: string
		sha?: string | null
		repoOwner: string
		repoName: string
		expiresAt: Date | string
		createdAt?: Date | string
		updatedAt?: Date | string
	}

	export type FileCacheUpdateInput = {
		path?: StringFieldUpdateOperationsInput | string
		content?: StringFieldUpdateOperationsInput | string
		sha?: NullableStringFieldUpdateOperationsInput | string | null
		repoOwner?: StringFieldUpdateOperationsInput | string
		repoName?: StringFieldUpdateOperationsInput | string
		expiresAt?: DateTimeFieldUpdateOperationsInput | Date | string
		createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
		updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
	}

	export type FileCacheUncheckedUpdateInput = {
		id?: IntFieldUpdateOperationsInput | number
		path?: StringFieldUpdateOperationsInput | string
		content?: StringFieldUpdateOperationsInput | string
		sha?: NullableStringFieldUpdateOperationsInput | string | null
		repoOwner?: StringFieldUpdateOperationsInput | string
		repoName?: StringFieldUpdateOperationsInput | string
		expiresAt?: DateTimeFieldUpdateOperationsInput | Date | string
		createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
		updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
	}

	export type FileCacheCreateManyInput = {
		id?: number
		path: string
		content: string
		sha?: string | null
		repoOwner: string
		repoName: string
		expiresAt: Date | string
		createdAt?: Date | string
		updatedAt?: Date | string
	}

	export type FileCacheUpdateManyMutationInput = {
		path?: StringFieldUpdateOperationsInput | string
		content?: StringFieldUpdateOperationsInput | string
		sha?: NullableStringFieldUpdateOperationsInput | string | null
		repoOwner?: StringFieldUpdateOperationsInput | string
		repoName?: StringFieldUpdateOperationsInput | string
		expiresAt?: DateTimeFieldUpdateOperationsInput | Date | string
		createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
		updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
	}

	export type FileCacheUncheckedUpdateManyInput = {
		id?: IntFieldUpdateOperationsInput | number
		path?: StringFieldUpdateOperationsInput | string
		content?: StringFieldUpdateOperationsInput | string
		sha?: NullableStringFieldUpdateOperationsInput | string | null
		repoOwner?: StringFieldUpdateOperationsInput | string
		repoName?: StringFieldUpdateOperationsInput | string
		expiresAt?: DateTimeFieldUpdateOperationsInput | Date | string
		createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
		updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
	}

	export type StringFilter<$PrismaModel = never> = {
		equals?: string | StringFieldRefInput<$PrismaModel>
		in?: string[] | ListStringFieldRefInput<$PrismaModel>
		notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
		lt?: string | StringFieldRefInput<$PrismaModel>
		lte?: string | StringFieldRefInput<$PrismaModel>
		gt?: string | StringFieldRefInput<$PrismaModel>
		gte?: string | StringFieldRefInput<$PrismaModel>
		contains?: string | StringFieldRefInput<$PrismaModel>
		startsWith?: string | StringFieldRefInput<$PrismaModel>
		endsWith?: string | StringFieldRefInput<$PrismaModel>
		mode?: QueryMode
		not?: NestedStringFilter<$PrismaModel> | string
	}

	export type StringNullableFilter<$PrismaModel = never> = {
		equals?: string | StringFieldRefInput<$PrismaModel> | null
		in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
		notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
		lt?: string | StringFieldRefInput<$PrismaModel>
		lte?: string | StringFieldRefInput<$PrismaModel>
		gt?: string | StringFieldRefInput<$PrismaModel>
		gte?: string | StringFieldRefInput<$PrismaModel>
		contains?: string | StringFieldRefInput<$PrismaModel>
		startsWith?: string | StringFieldRefInput<$PrismaModel>
		endsWith?: string | StringFieldRefInput<$PrismaModel>
		mode?: QueryMode
		not?: NestedStringNullableFilter<$PrismaModel> | string | null
	}

	export type DateTimeFilter<$PrismaModel = never> = {
		equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
		in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
		notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
		lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
		lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
		gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
		gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
		not?: NestedDateTimeFilter<$PrismaModel> | Date | string
	}

	export type TaskListRelationFilter = {
		every?: TaskWhereInput
		some?: TaskWhereInput
		none?: TaskWhereInput
	}

	export type SettingsNullableScalarRelationFilter = {
		is?: SettingsWhereInput | null
		isNot?: SettingsWhereInput | null
	}

	export type SortOrderInput = {
		sort: SortOrder
		nulls?: NullsOrder
	}

	export type TaskOrderByRelationAggregateInput = {
		_count?: SortOrder
	}

	export type UserCountOrderByAggregateInput = {
		id?: SortOrder
		email?: SortOrder
		name?: SortOrder
		hashedPassword?: SortOrder
		githubId?: SortOrder
		githubToken?: SortOrder
		createdAt?: SortOrder
		updatedAt?: SortOrder
	}

	export type UserMaxOrderByAggregateInput = {
		id?: SortOrder
		email?: SortOrder
		name?: SortOrder
		hashedPassword?: SortOrder
		githubId?: SortOrder
		githubToken?: SortOrder
		createdAt?: SortOrder
		updatedAt?: SortOrder
	}

	export type UserMinOrderByAggregateInput = {
		id?: SortOrder
		email?: SortOrder
		name?: SortOrder
		hashedPassword?: SortOrder
		githubId?: SortOrder
		githubToken?: SortOrder
		createdAt?: SortOrder
		updatedAt?: SortOrder
	}

	export type StringWithAggregatesFilter<$PrismaModel = never> = {
		equals?: string | StringFieldRefInput<$PrismaModel>
		in?: string[] | ListStringFieldRefInput<$PrismaModel>
		notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
		lt?: string | StringFieldRefInput<$PrismaModel>
		lte?: string | StringFieldRefInput<$PrismaModel>
		gt?: string | StringFieldRefInput<$PrismaModel>
		gte?: string | StringFieldRefInput<$PrismaModel>
		contains?: string | StringFieldRefInput<$PrismaModel>
		startsWith?: string | StringFieldRefInput<$PrismaModel>
		endsWith?: string | StringFieldRefInput<$PrismaModel>
		mode?: QueryMode
		not?: NestedStringWithAggregatesFilter<$PrismaModel> | string
		_count?: NestedIntFilter<$PrismaModel>
		_min?: NestedStringFilter<$PrismaModel>
		_max?: NestedStringFilter<$PrismaModel>
	}

	export type StringNullableWithAggregatesFilter<$PrismaModel = never> = {
		equals?: string | StringFieldRefInput<$PrismaModel> | null
		in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
		notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
		lt?: string | StringFieldRefInput<$PrismaModel>
		lte?: string | StringFieldRefInput<$PrismaModel>
		gt?: string | StringFieldRefInput<$PrismaModel>
		gte?: string | StringFieldRefInput<$PrismaModel>
		contains?: string | StringFieldRefInput<$PrismaModel>
		startsWith?: string | StringFieldRefInput<$PrismaModel>
		endsWith?: string | StringFieldRefInput<$PrismaModel>
		mode?: QueryMode
		not?: NestedStringNullableWithAggregatesFilter<$PrismaModel> | string | null
		_count?: NestedIntNullableFilter<$PrismaModel>
		_min?: NestedStringNullableFilter<$PrismaModel>
		_max?: NestedStringNullableFilter<$PrismaModel>
	}

	export type DateTimeWithAggregatesFilter<$PrismaModel = never> = {
		equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
		in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
		notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
		lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
		lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
		gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
		gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
		not?: NestedDateTimeWithAggregatesFilter<$PrismaModel> | Date | string
		_count?: NestedIntFilter<$PrismaModel>
		_min?: NestedDateTimeFilter<$PrismaModel>
		_max?: NestedDateTimeFilter<$PrismaModel>
	}

	export type IntFilter<$PrismaModel = never> = {
		equals?: number | IntFieldRefInput<$PrismaModel>
		in?: number[] | ListIntFieldRefInput<$PrismaModel>
		notIn?: number[] | ListIntFieldRefInput<$PrismaModel>
		lt?: number | IntFieldRefInput<$PrismaModel>
		lte?: number | IntFieldRefInput<$PrismaModel>
		gt?: number | IntFieldRefInput<$PrismaModel>
		gte?: number | IntFieldRefInput<$PrismaModel>
		not?: NestedIntFilter<$PrismaModel> | number
	}
	export type JsonFilter<$PrismaModel = never> =
		| PatchUndefined<
				Either<
					Required<JsonFilterBase<$PrismaModel>>,
					Exclude<keyof Required<JsonFilterBase<$PrismaModel>>, "path">
				>,
				Required<JsonFilterBase<$PrismaModel>>
		  >
		| OptionalFlat<Omit<Required<JsonFilterBase<$PrismaModel>>, "path">>

	export type JsonFilterBase<$PrismaModel = never> = {
		equals?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
		path?: string[]
		mode?: QueryMode | EnumQueryModeFieldRefInput<$PrismaModel>
		string_contains?: string | StringFieldRefInput<$PrismaModel>
		string_starts_with?: string | StringFieldRefInput<$PrismaModel>
		string_ends_with?: string | StringFieldRefInput<$PrismaModel>
		array_starts_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
		array_ends_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
		array_contains?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
		lt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
		lte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
		gt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
		gte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
		not?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
	}

	export type UserScalarRelationFilter = {
		is?: UserWhereInput
		isNot?: UserWhereInput
	}

	export type CheckpointListRelationFilter = {
		every?: CheckpointWhereInput
		some?: CheckpointWhereInput
		none?: CheckpointWhereInput
	}

	export type CheckpointOrderByRelationAggregateInput = {
		_count?: SortOrder
	}

	export type TaskCountOrderByAggregateInput = {
		id?: SortOrder
		taskId?: SortOrder
		instanceId?: SortOrder
		userId?: SortOrder
		messages?: SortOrder
		configuration?: SortOrder
		status?: SortOrder
		createdAt?: SortOrder
		updatedAt?: SortOrder
	}

	export type TaskAvgOrderByAggregateInput = {
		id?: SortOrder
	}

	export type TaskMaxOrderByAggregateInput = {
		id?: SortOrder
		taskId?: SortOrder
		instanceId?: SortOrder
		userId?: SortOrder
		status?: SortOrder
		createdAt?: SortOrder
		updatedAt?: SortOrder
	}

	export type TaskMinOrderByAggregateInput = {
		id?: SortOrder
		taskId?: SortOrder
		instanceId?: SortOrder
		userId?: SortOrder
		status?: SortOrder
		createdAt?: SortOrder
		updatedAt?: SortOrder
	}

	export type TaskSumOrderByAggregateInput = {
		id?: SortOrder
	}

	export type IntWithAggregatesFilter<$PrismaModel = never> = {
		equals?: number | IntFieldRefInput<$PrismaModel>
		in?: number[] | ListIntFieldRefInput<$PrismaModel>
		notIn?: number[] | ListIntFieldRefInput<$PrismaModel>
		lt?: number | IntFieldRefInput<$PrismaModel>
		lte?: number | IntFieldRefInput<$PrismaModel>
		gt?: number | IntFieldRefInput<$PrismaModel>
		gte?: number | IntFieldRefInput<$PrismaModel>
		not?: NestedIntWithAggregatesFilter<$PrismaModel> | number
		_count?: NestedIntFilter<$PrismaModel>
		_avg?: NestedFloatFilter<$PrismaModel>
		_sum?: NestedIntFilter<$PrismaModel>
		_min?: NestedIntFilter<$PrismaModel>
		_max?: NestedIntFilter<$PrismaModel>
	}
	export type JsonWithAggregatesFilter<$PrismaModel = never> =
		| PatchUndefined<
				Either<
					Required<JsonWithAggregatesFilterBase<$PrismaModel>>,
					Exclude<keyof Required<JsonWithAggregatesFilterBase<$PrismaModel>>, "path">
				>,
				Required<JsonWithAggregatesFilterBase<$PrismaModel>>
		  >
		| OptionalFlat<Omit<Required<JsonWithAggregatesFilterBase<$PrismaModel>>, "path">>

	export type JsonWithAggregatesFilterBase<$PrismaModel = never> = {
		equals?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
		path?: string[]
		mode?: QueryMode | EnumQueryModeFieldRefInput<$PrismaModel>
		string_contains?: string | StringFieldRefInput<$PrismaModel>
		string_starts_with?: string | StringFieldRefInput<$PrismaModel>
		string_ends_with?: string | StringFieldRefInput<$PrismaModel>
		array_starts_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
		array_ends_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
		array_contains?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
		lt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
		lte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
		gt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
		gte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
		not?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
		_count?: NestedIntFilter<$PrismaModel>
		_min?: NestedJsonFilter<$PrismaModel>
		_max?: NestedJsonFilter<$PrismaModel>
	}

	export type BigIntFilter<$PrismaModel = never> = {
		equals?: bigint | number | BigIntFieldRefInput<$PrismaModel>
		in?: bigint[] | number[] | ListBigIntFieldRefInput<$PrismaModel>
		notIn?: bigint[] | number[] | ListBigIntFieldRefInput<$PrismaModel>
		lt?: bigint | number | BigIntFieldRefInput<$PrismaModel>
		lte?: bigint | number | BigIntFieldRefInput<$PrismaModel>
		gt?: bigint | number | BigIntFieldRefInput<$PrismaModel>
		gte?: bigint | number | BigIntFieldRefInput<$PrismaModel>
		not?: NestedBigIntFilter<$PrismaModel> | bigint | number
	}

	export type TaskScalarRelationFilter = {
		is?: TaskWhereInput
		isNot?: TaskWhereInput
	}

	export type CheckpointCountOrderByAggregateInput = {
		id?: SortOrder
		taskId?: SortOrder
		data?: SortOrder
		timestamp?: SortOrder
		createdAt?: SortOrder
	}

	export type CheckpointAvgOrderByAggregateInput = {
		id?: SortOrder
		timestamp?: SortOrder
	}

	export type CheckpointMaxOrderByAggregateInput = {
		id?: SortOrder
		taskId?: SortOrder
		timestamp?: SortOrder
		createdAt?: SortOrder
	}

	export type CheckpointMinOrderByAggregateInput = {
		id?: SortOrder
		taskId?: SortOrder
		timestamp?: SortOrder
		createdAt?: SortOrder
	}

	export type CheckpointSumOrderByAggregateInput = {
		id?: SortOrder
		timestamp?: SortOrder
	}

	export type BigIntWithAggregatesFilter<$PrismaModel = never> = {
		equals?: bigint | number | BigIntFieldRefInput<$PrismaModel>
		in?: bigint[] | number[] | ListBigIntFieldRefInput<$PrismaModel>
		notIn?: bigint[] | number[] | ListBigIntFieldRefInput<$PrismaModel>
		lt?: bigint | number | BigIntFieldRefInput<$PrismaModel>
		lte?: bigint | number | BigIntFieldRefInput<$PrismaModel>
		gt?: bigint | number | BigIntFieldRefInput<$PrismaModel>
		gte?: bigint | number | BigIntFieldRefInput<$PrismaModel>
		not?: NestedBigIntWithAggregatesFilter<$PrismaModel> | bigint | number
		_count?: NestedIntFilter<$PrismaModel>
		_avg?: NestedFloatFilter<$PrismaModel>
		_sum?: NestedBigIntFilter<$PrismaModel>
		_min?: NestedBigIntFilter<$PrismaModel>
		_max?: NestedBigIntFilter<$PrismaModel>
	}

	export type SettingsCountOrderByAggregateInput = {
		id?: SortOrder
		userId?: SortOrder
		settings?: SortOrder
		timestamp?: SortOrder
		version?: SortOrder
		createdAt?: SortOrder
		updatedAt?: SortOrder
	}

	export type SettingsAvgOrderByAggregateInput = {
		id?: SortOrder
		timestamp?: SortOrder
		version?: SortOrder
	}

	export type SettingsMaxOrderByAggregateInput = {
		id?: SortOrder
		userId?: SortOrder
		timestamp?: SortOrder
		version?: SortOrder
		createdAt?: SortOrder
		updatedAt?: SortOrder
	}

	export type SettingsMinOrderByAggregateInput = {
		id?: SortOrder
		userId?: SortOrder
		timestamp?: SortOrder
		version?: SortOrder
		createdAt?: SortOrder
		updatedAt?: SortOrder
	}

	export type SettingsSumOrderByAggregateInput = {
		id?: SortOrder
		timestamp?: SortOrder
		version?: SortOrder
	}

	export type FileCacheRepoOwnerRepoNamePathCompoundUniqueInput = {
		repoOwner: string
		repoName: string
		path: string
	}

	export type FileCacheCountOrderByAggregateInput = {
		id?: SortOrder
		path?: SortOrder
		content?: SortOrder
		sha?: SortOrder
		repoOwner?: SortOrder
		repoName?: SortOrder
		expiresAt?: SortOrder
		createdAt?: SortOrder
		updatedAt?: SortOrder
	}

	export type FileCacheAvgOrderByAggregateInput = {
		id?: SortOrder
	}

	export type FileCacheMaxOrderByAggregateInput = {
		id?: SortOrder
		path?: SortOrder
		content?: SortOrder
		sha?: SortOrder
		repoOwner?: SortOrder
		repoName?: SortOrder
		expiresAt?: SortOrder
		createdAt?: SortOrder
		updatedAt?: SortOrder
	}

	export type FileCacheMinOrderByAggregateInput = {
		id?: SortOrder
		path?: SortOrder
		content?: SortOrder
		sha?: SortOrder
		repoOwner?: SortOrder
		repoName?: SortOrder
		expiresAt?: SortOrder
		createdAt?: SortOrder
		updatedAt?: SortOrder
	}

	export type FileCacheSumOrderByAggregateInput = {
		id?: SortOrder
	}

	export type TaskCreateNestedManyWithoutUserInput = {
		create?:
			| XOR<TaskCreateWithoutUserInput, TaskUncheckedCreateWithoutUserInput>
			| TaskCreateWithoutUserInput[]
			| TaskUncheckedCreateWithoutUserInput[]
		connectOrCreate?: TaskCreateOrConnectWithoutUserInput | TaskCreateOrConnectWithoutUserInput[]
		createMany?: TaskCreateManyUserInputEnvelope
		connect?: TaskWhereUniqueInput | TaskWhereUniqueInput[]
	}

	export type SettingsCreateNestedOneWithoutUserInput = {
		create?: XOR<SettingsCreateWithoutUserInput, SettingsUncheckedCreateWithoutUserInput>
		connectOrCreate?: SettingsCreateOrConnectWithoutUserInput
		connect?: SettingsWhereUniqueInput
	}

	export type TaskUncheckedCreateNestedManyWithoutUserInput = {
		create?:
			| XOR<TaskCreateWithoutUserInput, TaskUncheckedCreateWithoutUserInput>
			| TaskCreateWithoutUserInput[]
			| TaskUncheckedCreateWithoutUserInput[]
		connectOrCreate?: TaskCreateOrConnectWithoutUserInput | TaskCreateOrConnectWithoutUserInput[]
		createMany?: TaskCreateManyUserInputEnvelope
		connect?: TaskWhereUniqueInput | TaskWhereUniqueInput[]
	}

	export type SettingsUncheckedCreateNestedOneWithoutUserInput = {
		create?: XOR<SettingsCreateWithoutUserInput, SettingsUncheckedCreateWithoutUserInput>
		connectOrCreate?: SettingsCreateOrConnectWithoutUserInput
		connect?: SettingsWhereUniqueInput
	}

	export type StringFieldUpdateOperationsInput = {
		set?: string
	}

	export type NullableStringFieldUpdateOperationsInput = {
		set?: string | null
	}

	export type DateTimeFieldUpdateOperationsInput = {
		set?: Date | string
	}

	export type TaskUpdateManyWithoutUserNestedInput = {
		create?:
			| XOR<TaskCreateWithoutUserInput, TaskUncheckedCreateWithoutUserInput>
			| TaskCreateWithoutUserInput[]
			| TaskUncheckedCreateWithoutUserInput[]
		connectOrCreate?: TaskCreateOrConnectWithoutUserInput | TaskCreateOrConnectWithoutUserInput[]
		upsert?: TaskUpsertWithWhereUniqueWithoutUserInput | TaskUpsertWithWhereUniqueWithoutUserInput[]
		createMany?: TaskCreateManyUserInputEnvelope
		set?: TaskWhereUniqueInput | TaskWhereUniqueInput[]
		disconnect?: TaskWhereUniqueInput | TaskWhereUniqueInput[]
		delete?: TaskWhereUniqueInput | TaskWhereUniqueInput[]
		connect?: TaskWhereUniqueInput | TaskWhereUniqueInput[]
		update?: TaskUpdateWithWhereUniqueWithoutUserInput | TaskUpdateWithWhereUniqueWithoutUserInput[]
		updateMany?: TaskUpdateManyWithWhereWithoutUserInput | TaskUpdateManyWithWhereWithoutUserInput[]
		deleteMany?: TaskScalarWhereInput | TaskScalarWhereInput[]
	}

	export type SettingsUpdateOneWithoutUserNestedInput = {
		create?: XOR<SettingsCreateWithoutUserInput, SettingsUncheckedCreateWithoutUserInput>
		connectOrCreate?: SettingsCreateOrConnectWithoutUserInput
		upsert?: SettingsUpsertWithoutUserInput
		disconnect?: SettingsWhereInput | boolean
		delete?: SettingsWhereInput | boolean
		connect?: SettingsWhereUniqueInput
		update?: XOR<
			XOR<SettingsUpdateToOneWithWhereWithoutUserInput, SettingsUpdateWithoutUserInput>,
			SettingsUncheckedUpdateWithoutUserInput
		>
	}

	export type TaskUncheckedUpdateManyWithoutUserNestedInput = {
		create?:
			| XOR<TaskCreateWithoutUserInput, TaskUncheckedCreateWithoutUserInput>
			| TaskCreateWithoutUserInput[]
			| TaskUncheckedCreateWithoutUserInput[]
		connectOrCreate?: TaskCreateOrConnectWithoutUserInput | TaskCreateOrConnectWithoutUserInput[]
		upsert?: TaskUpsertWithWhereUniqueWithoutUserInput | TaskUpsertWithWhereUniqueWithoutUserInput[]
		createMany?: TaskCreateManyUserInputEnvelope
		set?: TaskWhereUniqueInput | TaskWhereUniqueInput[]
		disconnect?: TaskWhereUniqueInput | TaskWhereUniqueInput[]
		delete?: TaskWhereUniqueInput | TaskWhereUniqueInput[]
		connect?: TaskWhereUniqueInput | TaskWhereUniqueInput[]
		update?: TaskUpdateWithWhereUniqueWithoutUserInput | TaskUpdateWithWhereUniqueWithoutUserInput[]
		updateMany?: TaskUpdateManyWithWhereWithoutUserInput | TaskUpdateManyWithWhereWithoutUserInput[]
		deleteMany?: TaskScalarWhereInput | TaskScalarWhereInput[]
	}

	export type SettingsUncheckedUpdateOneWithoutUserNestedInput = {
		create?: XOR<SettingsCreateWithoutUserInput, SettingsUncheckedCreateWithoutUserInput>
		connectOrCreate?: SettingsCreateOrConnectWithoutUserInput
		upsert?: SettingsUpsertWithoutUserInput
		disconnect?: SettingsWhereInput | boolean
		delete?: SettingsWhereInput | boolean
		connect?: SettingsWhereUniqueInput
		update?: XOR<
			XOR<SettingsUpdateToOneWithWhereWithoutUserInput, SettingsUpdateWithoutUserInput>,
			SettingsUncheckedUpdateWithoutUserInput
		>
	}

	export type UserCreateNestedOneWithoutTasksInput = {
		create?: XOR<UserCreateWithoutTasksInput, UserUncheckedCreateWithoutTasksInput>
		connectOrCreate?: UserCreateOrConnectWithoutTasksInput
		connect?: UserWhereUniqueInput
	}

	export type CheckpointCreateNestedManyWithoutTaskInput = {
		create?:
			| XOR<CheckpointCreateWithoutTaskInput, CheckpointUncheckedCreateWithoutTaskInput>
			| CheckpointCreateWithoutTaskInput[]
			| CheckpointUncheckedCreateWithoutTaskInput[]
		connectOrCreate?: CheckpointCreateOrConnectWithoutTaskInput | CheckpointCreateOrConnectWithoutTaskInput[]
		createMany?: CheckpointCreateManyTaskInputEnvelope
		connect?: CheckpointWhereUniqueInput | CheckpointWhereUniqueInput[]
	}

	export type CheckpointUncheckedCreateNestedManyWithoutTaskInput = {
		create?:
			| XOR<CheckpointCreateWithoutTaskInput, CheckpointUncheckedCreateWithoutTaskInput>
			| CheckpointCreateWithoutTaskInput[]
			| CheckpointUncheckedCreateWithoutTaskInput[]
		connectOrCreate?: CheckpointCreateOrConnectWithoutTaskInput | CheckpointCreateOrConnectWithoutTaskInput[]
		createMany?: CheckpointCreateManyTaskInputEnvelope
		connect?: CheckpointWhereUniqueInput | CheckpointWhereUniqueInput[]
	}

	export type UserUpdateOneRequiredWithoutTasksNestedInput = {
		create?: XOR<UserCreateWithoutTasksInput, UserUncheckedCreateWithoutTasksInput>
		connectOrCreate?: UserCreateOrConnectWithoutTasksInput
		upsert?: UserUpsertWithoutTasksInput
		connect?: UserWhereUniqueInput
		update?: XOR<
			XOR<UserUpdateToOneWithWhereWithoutTasksInput, UserUpdateWithoutTasksInput>,
			UserUncheckedUpdateWithoutTasksInput
		>
	}

	export type CheckpointUpdateManyWithoutTaskNestedInput = {
		create?:
			| XOR<CheckpointCreateWithoutTaskInput, CheckpointUncheckedCreateWithoutTaskInput>
			| CheckpointCreateWithoutTaskInput[]
			| CheckpointUncheckedCreateWithoutTaskInput[]
		connectOrCreate?: CheckpointCreateOrConnectWithoutTaskInput | CheckpointCreateOrConnectWithoutTaskInput[]
		upsert?: CheckpointUpsertWithWhereUniqueWithoutTaskInput | CheckpointUpsertWithWhereUniqueWithoutTaskInput[]
		createMany?: CheckpointCreateManyTaskInputEnvelope
		set?: CheckpointWhereUniqueInput | CheckpointWhereUniqueInput[]
		disconnect?: CheckpointWhereUniqueInput | CheckpointWhereUniqueInput[]
		delete?: CheckpointWhereUniqueInput | CheckpointWhereUniqueInput[]
		connect?: CheckpointWhereUniqueInput | CheckpointWhereUniqueInput[]
		update?: CheckpointUpdateWithWhereUniqueWithoutTaskInput | CheckpointUpdateWithWhereUniqueWithoutTaskInput[]
		updateMany?: CheckpointUpdateManyWithWhereWithoutTaskInput | CheckpointUpdateManyWithWhereWithoutTaskInput[]
		deleteMany?: CheckpointScalarWhereInput | CheckpointScalarWhereInput[]
	}

	export type IntFieldUpdateOperationsInput = {
		set?: number
		increment?: number
		decrement?: number
		multiply?: number
		divide?: number
	}

	export type CheckpointUncheckedUpdateManyWithoutTaskNestedInput = {
		create?:
			| XOR<CheckpointCreateWithoutTaskInput, CheckpointUncheckedCreateWithoutTaskInput>
			| CheckpointCreateWithoutTaskInput[]
			| CheckpointUncheckedCreateWithoutTaskInput[]
		connectOrCreate?: CheckpointCreateOrConnectWithoutTaskInput | CheckpointCreateOrConnectWithoutTaskInput[]
		upsert?: CheckpointUpsertWithWhereUniqueWithoutTaskInput | CheckpointUpsertWithWhereUniqueWithoutTaskInput[]
		createMany?: CheckpointCreateManyTaskInputEnvelope
		set?: CheckpointWhereUniqueInput | CheckpointWhereUniqueInput[]
		disconnect?: CheckpointWhereUniqueInput | CheckpointWhereUniqueInput[]
		delete?: CheckpointWhereUniqueInput | CheckpointWhereUniqueInput[]
		connect?: CheckpointWhereUniqueInput | CheckpointWhereUniqueInput[]
		update?: CheckpointUpdateWithWhereUniqueWithoutTaskInput | CheckpointUpdateWithWhereUniqueWithoutTaskInput[]
		updateMany?: CheckpointUpdateManyWithWhereWithoutTaskInput | CheckpointUpdateManyWithWhereWithoutTaskInput[]
		deleteMany?: CheckpointScalarWhereInput | CheckpointScalarWhereInput[]
	}

	export type TaskCreateNestedOneWithoutCheckpointsInput = {
		create?: XOR<TaskCreateWithoutCheckpointsInput, TaskUncheckedCreateWithoutCheckpointsInput>
		connectOrCreate?: TaskCreateOrConnectWithoutCheckpointsInput
		connect?: TaskWhereUniqueInput
	}

	export type BigIntFieldUpdateOperationsInput = {
		set?: bigint | number
		increment?: bigint | number
		decrement?: bigint | number
		multiply?: bigint | number
		divide?: bigint | number
	}

	export type TaskUpdateOneRequiredWithoutCheckpointsNestedInput = {
		create?: XOR<TaskCreateWithoutCheckpointsInput, TaskUncheckedCreateWithoutCheckpointsInput>
		connectOrCreate?: TaskCreateOrConnectWithoutCheckpointsInput
		upsert?: TaskUpsertWithoutCheckpointsInput
		connect?: TaskWhereUniqueInput
		update?: XOR<
			XOR<TaskUpdateToOneWithWhereWithoutCheckpointsInput, TaskUpdateWithoutCheckpointsInput>,
			TaskUncheckedUpdateWithoutCheckpointsInput
		>
	}

	export type UserCreateNestedOneWithoutSettingsInput = {
		create?: XOR<UserCreateWithoutSettingsInput, UserUncheckedCreateWithoutSettingsInput>
		connectOrCreate?: UserCreateOrConnectWithoutSettingsInput
		connect?: UserWhereUniqueInput
	}

	export type UserUpdateOneRequiredWithoutSettingsNestedInput = {
		create?: XOR<UserCreateWithoutSettingsInput, UserUncheckedCreateWithoutSettingsInput>
		connectOrCreate?: UserCreateOrConnectWithoutSettingsInput
		upsert?: UserUpsertWithoutSettingsInput
		connect?: UserWhereUniqueInput
		update?: XOR<
			XOR<UserUpdateToOneWithWhereWithoutSettingsInput, UserUpdateWithoutSettingsInput>,
			UserUncheckedUpdateWithoutSettingsInput
		>
	}

	export type NestedStringFilter<$PrismaModel = never> = {
		equals?: string | StringFieldRefInput<$PrismaModel>
		in?: string[] | ListStringFieldRefInput<$PrismaModel>
		notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
		lt?: string | StringFieldRefInput<$PrismaModel>
		lte?: string | StringFieldRefInput<$PrismaModel>
		gt?: string | StringFieldRefInput<$PrismaModel>
		gte?: string | StringFieldRefInput<$PrismaModel>
		contains?: string | StringFieldRefInput<$PrismaModel>
		startsWith?: string | StringFieldRefInput<$PrismaModel>
		endsWith?: string | StringFieldRefInput<$PrismaModel>
		not?: NestedStringFilter<$PrismaModel> | string
	}

	export type NestedStringNullableFilter<$PrismaModel = never> = {
		equals?: string | StringFieldRefInput<$PrismaModel> | null
		in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
		notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
		lt?: string | StringFieldRefInput<$PrismaModel>
		lte?: string | StringFieldRefInput<$PrismaModel>
		gt?: string | StringFieldRefInput<$PrismaModel>
		gte?: string | StringFieldRefInput<$PrismaModel>
		contains?: string | StringFieldRefInput<$PrismaModel>
		startsWith?: string | StringFieldRefInput<$PrismaModel>
		endsWith?: string | StringFieldRefInput<$PrismaModel>
		not?: NestedStringNullableFilter<$PrismaModel> | string | null
	}

	export type NestedDateTimeFilter<$PrismaModel = never> = {
		equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
		in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
		notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
		lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
		lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
		gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
		gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
		not?: NestedDateTimeFilter<$PrismaModel> | Date | string
	}

	export type NestedStringWithAggregatesFilter<$PrismaModel = never> = {
		equals?: string | StringFieldRefInput<$PrismaModel>
		in?: string[] | ListStringFieldRefInput<$PrismaModel>
		notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
		lt?: string | StringFieldRefInput<$PrismaModel>
		lte?: string | StringFieldRefInput<$PrismaModel>
		gt?: string | StringFieldRefInput<$PrismaModel>
		gte?: string | StringFieldRefInput<$PrismaModel>
		contains?: string | StringFieldRefInput<$PrismaModel>
		startsWith?: string | StringFieldRefInput<$PrismaModel>
		endsWith?: string | StringFieldRefInput<$PrismaModel>
		not?: NestedStringWithAggregatesFilter<$PrismaModel> | string
		_count?: NestedIntFilter<$PrismaModel>
		_min?: NestedStringFilter<$PrismaModel>
		_max?: NestedStringFilter<$PrismaModel>
	}

	export type NestedIntFilter<$PrismaModel = never> = {
		equals?: number | IntFieldRefInput<$PrismaModel>
		in?: number[] | ListIntFieldRefInput<$PrismaModel>
		notIn?: number[] | ListIntFieldRefInput<$PrismaModel>
		lt?: number | IntFieldRefInput<$PrismaModel>
		lte?: number | IntFieldRefInput<$PrismaModel>
		gt?: number | IntFieldRefInput<$PrismaModel>
		gte?: number | IntFieldRefInput<$PrismaModel>
		not?: NestedIntFilter<$PrismaModel> | number
	}

	export type NestedStringNullableWithAggregatesFilter<$PrismaModel = never> = {
		equals?: string | StringFieldRefInput<$PrismaModel> | null
		in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
		notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
		lt?: string | StringFieldRefInput<$PrismaModel>
		lte?: string | StringFieldRefInput<$PrismaModel>
		gt?: string | StringFieldRefInput<$PrismaModel>
		gte?: string | StringFieldRefInput<$PrismaModel>
		contains?: string | StringFieldRefInput<$PrismaModel>
		startsWith?: string | StringFieldRefInput<$PrismaModel>
		endsWith?: string | StringFieldRefInput<$PrismaModel>
		not?: NestedStringNullableWithAggregatesFilter<$PrismaModel> | string | null
		_count?: NestedIntNullableFilter<$PrismaModel>
		_min?: NestedStringNullableFilter<$PrismaModel>
		_max?: NestedStringNullableFilter<$PrismaModel>
	}

	export type NestedIntNullableFilter<$PrismaModel = never> = {
		equals?: number | IntFieldRefInput<$PrismaModel> | null
		in?: number[] | ListIntFieldRefInput<$PrismaModel> | null
		notIn?: number[] | ListIntFieldRefInput<$PrismaModel> | null
		lt?: number | IntFieldRefInput<$PrismaModel>
		lte?: number | IntFieldRefInput<$PrismaModel>
		gt?: number | IntFieldRefInput<$PrismaModel>
		gte?: number | IntFieldRefInput<$PrismaModel>
		not?: NestedIntNullableFilter<$PrismaModel> | number | null
	}

	export type NestedDateTimeWithAggregatesFilter<$PrismaModel = never> = {
		equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
		in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
		notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
		lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
		lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
		gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
		gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
		not?: NestedDateTimeWithAggregatesFilter<$PrismaModel> | Date | string
		_count?: NestedIntFilter<$PrismaModel>
		_min?: NestedDateTimeFilter<$PrismaModel>
		_max?: NestedDateTimeFilter<$PrismaModel>
	}

	export type NestedIntWithAggregatesFilter<$PrismaModel = never> = {
		equals?: number | IntFieldRefInput<$PrismaModel>
		in?: number[] | ListIntFieldRefInput<$PrismaModel>
		notIn?: number[] | ListIntFieldRefInput<$PrismaModel>
		lt?: number | IntFieldRefInput<$PrismaModel>
		lte?: number | IntFieldRefInput<$PrismaModel>
		gt?: number | IntFieldRefInput<$PrismaModel>
		gte?: number | IntFieldRefInput<$PrismaModel>
		not?: NestedIntWithAggregatesFilter<$PrismaModel> | number
		_count?: NestedIntFilter<$PrismaModel>
		_avg?: NestedFloatFilter<$PrismaModel>
		_sum?: NestedIntFilter<$PrismaModel>
		_min?: NestedIntFilter<$PrismaModel>
		_max?: NestedIntFilter<$PrismaModel>
	}

	export type NestedFloatFilter<$PrismaModel = never> = {
		equals?: number | FloatFieldRefInput<$PrismaModel>
		in?: number[] | ListFloatFieldRefInput<$PrismaModel>
		notIn?: number[] | ListFloatFieldRefInput<$PrismaModel>
		lt?: number | FloatFieldRefInput<$PrismaModel>
		lte?: number | FloatFieldRefInput<$PrismaModel>
		gt?: number | FloatFieldRefInput<$PrismaModel>
		gte?: number | FloatFieldRefInput<$PrismaModel>
		not?: NestedFloatFilter<$PrismaModel> | number
	}
	export type NestedJsonFilter<$PrismaModel = never> =
		| PatchUndefined<
				Either<
					Required<NestedJsonFilterBase<$PrismaModel>>,
					Exclude<keyof Required<NestedJsonFilterBase<$PrismaModel>>, "path">
				>,
				Required<NestedJsonFilterBase<$PrismaModel>>
		  >
		| OptionalFlat<Omit<Required<NestedJsonFilterBase<$PrismaModel>>, "path">>

	export type NestedJsonFilterBase<$PrismaModel = never> = {
		equals?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
		path?: string[]
		mode?: QueryMode | EnumQueryModeFieldRefInput<$PrismaModel>
		string_contains?: string | StringFieldRefInput<$PrismaModel>
		string_starts_with?: string | StringFieldRefInput<$PrismaModel>
		string_ends_with?: string | StringFieldRefInput<$PrismaModel>
		array_starts_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
		array_ends_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
		array_contains?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
		lt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
		lte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
		gt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
		gte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
		not?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
	}

	export type NestedBigIntFilter<$PrismaModel = never> = {
		equals?: bigint | number | BigIntFieldRefInput<$PrismaModel>
		in?: bigint[] | number[] | ListBigIntFieldRefInput<$PrismaModel>
		notIn?: bigint[] | number[] | ListBigIntFieldRefInput<$PrismaModel>
		lt?: bigint | number | BigIntFieldRefInput<$PrismaModel>
		lte?: bigint | number | BigIntFieldRefInput<$PrismaModel>
		gt?: bigint | number | BigIntFieldRefInput<$PrismaModel>
		gte?: bigint | number | BigIntFieldRefInput<$PrismaModel>
		not?: NestedBigIntFilter<$PrismaModel> | bigint | number
	}

	export type NestedBigIntWithAggregatesFilter<$PrismaModel = never> = {
		equals?: bigint | number | BigIntFieldRefInput<$PrismaModel>
		in?: bigint[] | number[] | ListBigIntFieldRefInput<$PrismaModel>
		notIn?: bigint[] | number[] | ListBigIntFieldRefInput<$PrismaModel>
		lt?: bigint | number | BigIntFieldRefInput<$PrismaModel>
		lte?: bigint | number | BigIntFieldRefInput<$PrismaModel>
		gt?: bigint | number | BigIntFieldRefInput<$PrismaModel>
		gte?: bigint | number | BigIntFieldRefInput<$PrismaModel>
		not?: NestedBigIntWithAggregatesFilter<$PrismaModel> | bigint | number
		_count?: NestedIntFilter<$PrismaModel>
		_avg?: NestedFloatFilter<$PrismaModel>
		_sum?: NestedBigIntFilter<$PrismaModel>
		_min?: NestedBigIntFilter<$PrismaModel>
		_max?: NestedBigIntFilter<$PrismaModel>
	}

	export type TaskCreateWithoutUserInput = {
		taskId: string
		instanceId: string
		messages?: JsonNullValueInput | InputJsonValue
		configuration?: JsonNullValueInput | InputJsonValue
		status?: string
		createdAt?: Date | string
		updatedAt?: Date | string
		checkpoints?: CheckpointCreateNestedManyWithoutTaskInput
	}

	export type TaskUncheckedCreateWithoutUserInput = {
		id?: number
		taskId: string
		instanceId: string
		messages?: JsonNullValueInput | InputJsonValue
		configuration?: JsonNullValueInput | InputJsonValue
		status?: string
		createdAt?: Date | string
		updatedAt?: Date | string
		checkpoints?: CheckpointUncheckedCreateNestedManyWithoutTaskInput
	}

	export type TaskCreateOrConnectWithoutUserInput = {
		where: TaskWhereUniqueInput
		create: XOR<TaskCreateWithoutUserInput, TaskUncheckedCreateWithoutUserInput>
	}

	export type TaskCreateManyUserInputEnvelope = {
		data: TaskCreateManyUserInput | TaskCreateManyUserInput[]
		skipDuplicates?: boolean
	}

	export type SettingsCreateWithoutUserInput = {
		settings: JsonNullValueInput | InputJsonValue
		timestamp: bigint | number
		version?: number
		createdAt?: Date | string
		updatedAt?: Date | string
	}

	export type SettingsUncheckedCreateWithoutUserInput = {
		id?: number
		settings: JsonNullValueInput | InputJsonValue
		timestamp: bigint | number
		version?: number
		createdAt?: Date | string
		updatedAt?: Date | string
	}

	export type SettingsCreateOrConnectWithoutUserInput = {
		where: SettingsWhereUniqueInput
		create: XOR<SettingsCreateWithoutUserInput, SettingsUncheckedCreateWithoutUserInput>
	}

	export type TaskUpsertWithWhereUniqueWithoutUserInput = {
		where: TaskWhereUniqueInput
		update: XOR<TaskUpdateWithoutUserInput, TaskUncheckedUpdateWithoutUserInput>
		create: XOR<TaskCreateWithoutUserInput, TaskUncheckedCreateWithoutUserInput>
	}

	export type TaskUpdateWithWhereUniqueWithoutUserInput = {
		where: TaskWhereUniqueInput
		data: XOR<TaskUpdateWithoutUserInput, TaskUncheckedUpdateWithoutUserInput>
	}

	export type TaskUpdateManyWithWhereWithoutUserInput = {
		where: TaskScalarWhereInput
		data: XOR<TaskUpdateManyMutationInput, TaskUncheckedUpdateManyWithoutUserInput>
	}

	export type TaskScalarWhereInput = {
		AND?: TaskScalarWhereInput | TaskScalarWhereInput[]
		OR?: TaskScalarWhereInput[]
		NOT?: TaskScalarWhereInput | TaskScalarWhereInput[]
		id?: IntFilter<"Task"> | number
		taskId?: StringFilter<"Task"> | string
		instanceId?: StringFilter<"Task"> | string
		userId?: StringFilter<"Task"> | string
		messages?: JsonFilter<"Task">
		configuration?: JsonFilter<"Task">
		status?: StringFilter<"Task"> | string
		createdAt?: DateTimeFilter<"Task"> | Date | string
		updatedAt?: DateTimeFilter<"Task"> | Date | string
	}

	export type SettingsUpsertWithoutUserInput = {
		update: XOR<SettingsUpdateWithoutUserInput, SettingsUncheckedUpdateWithoutUserInput>
		create: XOR<SettingsCreateWithoutUserInput, SettingsUncheckedCreateWithoutUserInput>
		where?: SettingsWhereInput
	}

	export type SettingsUpdateToOneWithWhereWithoutUserInput = {
		where?: SettingsWhereInput
		data: XOR<SettingsUpdateWithoutUserInput, SettingsUncheckedUpdateWithoutUserInput>
	}

	export type SettingsUpdateWithoutUserInput = {
		settings?: JsonNullValueInput | InputJsonValue
		timestamp?: BigIntFieldUpdateOperationsInput | bigint | number
		version?: IntFieldUpdateOperationsInput | number
		createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
		updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
	}

	export type SettingsUncheckedUpdateWithoutUserInput = {
		id?: IntFieldUpdateOperationsInput | number
		settings?: JsonNullValueInput | InputJsonValue
		timestamp?: BigIntFieldUpdateOperationsInput | bigint | number
		version?: IntFieldUpdateOperationsInput | number
		createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
		updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
	}

	export type UserCreateWithoutTasksInput = {
		id?: string
		email: string
		name?: string | null
		hashedPassword?: string | null
		githubId?: string | null
		githubToken?: string | null
		createdAt?: Date | string
		updatedAt?: Date | string
		settings?: SettingsCreateNestedOneWithoutUserInput
	}

	export type UserUncheckedCreateWithoutTasksInput = {
		id?: string
		email: string
		name?: string | null
		hashedPassword?: string | null
		githubId?: string | null
		githubToken?: string | null
		createdAt?: Date | string
		updatedAt?: Date | string
		settings?: SettingsUncheckedCreateNestedOneWithoutUserInput
	}

	export type UserCreateOrConnectWithoutTasksInput = {
		where: UserWhereUniqueInput
		create: XOR<UserCreateWithoutTasksInput, UserUncheckedCreateWithoutTasksInput>
	}

	export type CheckpointCreateWithoutTaskInput = {
		data: JsonNullValueInput | InputJsonValue
		timestamp: bigint | number
		createdAt?: Date | string
	}

	export type CheckpointUncheckedCreateWithoutTaskInput = {
		id?: number
		data: JsonNullValueInput | InputJsonValue
		timestamp: bigint | number
		createdAt?: Date | string
	}

	export type CheckpointCreateOrConnectWithoutTaskInput = {
		where: CheckpointWhereUniqueInput
		create: XOR<CheckpointCreateWithoutTaskInput, CheckpointUncheckedCreateWithoutTaskInput>
	}

	export type CheckpointCreateManyTaskInputEnvelope = {
		data: CheckpointCreateManyTaskInput | CheckpointCreateManyTaskInput[]
		skipDuplicates?: boolean
	}

	export type UserUpsertWithoutTasksInput = {
		update: XOR<UserUpdateWithoutTasksInput, UserUncheckedUpdateWithoutTasksInput>
		create: XOR<UserCreateWithoutTasksInput, UserUncheckedCreateWithoutTasksInput>
		where?: UserWhereInput
	}

	export type UserUpdateToOneWithWhereWithoutTasksInput = {
		where?: UserWhereInput
		data: XOR<UserUpdateWithoutTasksInput, UserUncheckedUpdateWithoutTasksInput>
	}

	export type UserUpdateWithoutTasksInput = {
		id?: StringFieldUpdateOperationsInput | string
		email?: StringFieldUpdateOperationsInput | string
		name?: NullableStringFieldUpdateOperationsInput | string | null
		hashedPassword?: NullableStringFieldUpdateOperationsInput | string | null
		githubId?: NullableStringFieldUpdateOperationsInput | string | null
		githubToken?: NullableStringFieldUpdateOperationsInput | string | null
		createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
		updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
		settings?: SettingsUpdateOneWithoutUserNestedInput
	}

	export type UserUncheckedUpdateWithoutTasksInput = {
		id?: StringFieldUpdateOperationsInput | string
		email?: StringFieldUpdateOperationsInput | string
		name?: NullableStringFieldUpdateOperationsInput | string | null
		hashedPassword?: NullableStringFieldUpdateOperationsInput | string | null
		githubId?: NullableStringFieldUpdateOperationsInput | string | null
		githubToken?: NullableStringFieldUpdateOperationsInput | string | null
		createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
		updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
		settings?: SettingsUncheckedUpdateOneWithoutUserNestedInput
	}

	export type CheckpointUpsertWithWhereUniqueWithoutTaskInput = {
		where: CheckpointWhereUniqueInput
		update: XOR<CheckpointUpdateWithoutTaskInput, CheckpointUncheckedUpdateWithoutTaskInput>
		create: XOR<CheckpointCreateWithoutTaskInput, CheckpointUncheckedCreateWithoutTaskInput>
	}

	export type CheckpointUpdateWithWhereUniqueWithoutTaskInput = {
		where: CheckpointWhereUniqueInput
		data: XOR<CheckpointUpdateWithoutTaskInput, CheckpointUncheckedUpdateWithoutTaskInput>
	}

	export type CheckpointUpdateManyWithWhereWithoutTaskInput = {
		where: CheckpointScalarWhereInput
		data: XOR<CheckpointUpdateManyMutationInput, CheckpointUncheckedUpdateManyWithoutTaskInput>
	}

	export type CheckpointScalarWhereInput = {
		AND?: CheckpointScalarWhereInput | CheckpointScalarWhereInput[]
		OR?: CheckpointScalarWhereInput[]
		NOT?: CheckpointScalarWhereInput | CheckpointScalarWhereInput[]
		id?: IntFilter<"Checkpoint"> | number
		taskId?: StringFilter<"Checkpoint"> | string
		data?: JsonFilter<"Checkpoint">
		timestamp?: BigIntFilter<"Checkpoint"> | bigint | number
		createdAt?: DateTimeFilter<"Checkpoint"> | Date | string
	}

	export type TaskCreateWithoutCheckpointsInput = {
		taskId: string
		instanceId: string
		messages?: JsonNullValueInput | InputJsonValue
		configuration?: JsonNullValueInput | InputJsonValue
		status?: string
		createdAt?: Date | string
		updatedAt?: Date | string
		user: UserCreateNestedOneWithoutTasksInput
	}

	export type TaskUncheckedCreateWithoutCheckpointsInput = {
		id?: number
		taskId: string
		instanceId: string
		userId: string
		messages?: JsonNullValueInput | InputJsonValue
		configuration?: JsonNullValueInput | InputJsonValue
		status?: string
		createdAt?: Date | string
		updatedAt?: Date | string
	}

	export type TaskCreateOrConnectWithoutCheckpointsInput = {
		where: TaskWhereUniqueInput
		create: XOR<TaskCreateWithoutCheckpointsInput, TaskUncheckedCreateWithoutCheckpointsInput>
	}

	export type TaskUpsertWithoutCheckpointsInput = {
		update: XOR<TaskUpdateWithoutCheckpointsInput, TaskUncheckedUpdateWithoutCheckpointsInput>
		create: XOR<TaskCreateWithoutCheckpointsInput, TaskUncheckedCreateWithoutCheckpointsInput>
		where?: TaskWhereInput
	}

	export type TaskUpdateToOneWithWhereWithoutCheckpointsInput = {
		where?: TaskWhereInput
		data: XOR<TaskUpdateWithoutCheckpointsInput, TaskUncheckedUpdateWithoutCheckpointsInput>
	}

	export type TaskUpdateWithoutCheckpointsInput = {
		taskId?: StringFieldUpdateOperationsInput | string
		instanceId?: StringFieldUpdateOperationsInput | string
		messages?: JsonNullValueInput | InputJsonValue
		configuration?: JsonNullValueInput | InputJsonValue
		status?: StringFieldUpdateOperationsInput | string
		createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
		updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
		user?: UserUpdateOneRequiredWithoutTasksNestedInput
	}

	export type TaskUncheckedUpdateWithoutCheckpointsInput = {
		id?: IntFieldUpdateOperationsInput | number
		taskId?: StringFieldUpdateOperationsInput | string
		instanceId?: StringFieldUpdateOperationsInput | string
		userId?: StringFieldUpdateOperationsInput | string
		messages?: JsonNullValueInput | InputJsonValue
		configuration?: JsonNullValueInput | InputJsonValue
		status?: StringFieldUpdateOperationsInput | string
		createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
		updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
	}

	export type UserCreateWithoutSettingsInput = {
		id?: string
		email: string
		name?: string | null
		hashedPassword?: string | null
		githubId?: string | null
		githubToken?: string | null
		createdAt?: Date | string
		updatedAt?: Date | string
		tasks?: TaskCreateNestedManyWithoutUserInput
	}

	export type UserUncheckedCreateWithoutSettingsInput = {
		id?: string
		email: string
		name?: string | null
		hashedPassword?: string | null
		githubId?: string | null
		githubToken?: string | null
		createdAt?: Date | string
		updatedAt?: Date | string
		tasks?: TaskUncheckedCreateNestedManyWithoutUserInput
	}

	export type UserCreateOrConnectWithoutSettingsInput = {
		where: UserWhereUniqueInput
		create: XOR<UserCreateWithoutSettingsInput, UserUncheckedCreateWithoutSettingsInput>
	}

	export type UserUpsertWithoutSettingsInput = {
		update: XOR<UserUpdateWithoutSettingsInput, UserUncheckedUpdateWithoutSettingsInput>
		create: XOR<UserCreateWithoutSettingsInput, UserUncheckedCreateWithoutSettingsInput>
		where?: UserWhereInput
	}

	export type UserUpdateToOneWithWhereWithoutSettingsInput = {
		where?: UserWhereInput
		data: XOR<UserUpdateWithoutSettingsInput, UserUncheckedUpdateWithoutSettingsInput>
	}

	export type UserUpdateWithoutSettingsInput = {
		id?: StringFieldUpdateOperationsInput | string
		email?: StringFieldUpdateOperationsInput | string
		name?: NullableStringFieldUpdateOperationsInput | string | null
		hashedPassword?: NullableStringFieldUpdateOperationsInput | string | null
		githubId?: NullableStringFieldUpdateOperationsInput | string | null
		githubToken?: NullableStringFieldUpdateOperationsInput | string | null
		createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
		updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
		tasks?: TaskUpdateManyWithoutUserNestedInput
	}

	export type UserUncheckedUpdateWithoutSettingsInput = {
		id?: StringFieldUpdateOperationsInput | string
		email?: StringFieldUpdateOperationsInput | string
		name?: NullableStringFieldUpdateOperationsInput | string | null
		hashedPassword?: NullableStringFieldUpdateOperationsInput | string | null
		githubId?: NullableStringFieldUpdateOperationsInput | string | null
		githubToken?: NullableStringFieldUpdateOperationsInput | string | null
		createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
		updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
		tasks?: TaskUncheckedUpdateManyWithoutUserNestedInput
	}

	export type TaskCreateManyUserInput = {
		id?: number
		taskId: string
		instanceId: string
		messages?: JsonNullValueInput | InputJsonValue
		configuration?: JsonNullValueInput | InputJsonValue
		status?: string
		createdAt?: Date | string
		updatedAt?: Date | string
	}

	export type TaskUpdateWithoutUserInput = {
		taskId?: StringFieldUpdateOperationsInput | string
		instanceId?: StringFieldUpdateOperationsInput | string
		messages?: JsonNullValueInput | InputJsonValue
		configuration?: JsonNullValueInput | InputJsonValue
		status?: StringFieldUpdateOperationsInput | string
		createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
		updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
		checkpoints?: CheckpointUpdateManyWithoutTaskNestedInput
	}

	export type TaskUncheckedUpdateWithoutUserInput = {
		id?: IntFieldUpdateOperationsInput | number
		taskId?: StringFieldUpdateOperationsInput | string
		instanceId?: StringFieldUpdateOperationsInput | string
		messages?: JsonNullValueInput | InputJsonValue
		configuration?: JsonNullValueInput | InputJsonValue
		status?: StringFieldUpdateOperationsInput | string
		createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
		updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
		checkpoints?: CheckpointUncheckedUpdateManyWithoutTaskNestedInput
	}

	export type TaskUncheckedUpdateManyWithoutUserInput = {
		id?: IntFieldUpdateOperationsInput | number
		taskId?: StringFieldUpdateOperationsInput | string
		instanceId?: StringFieldUpdateOperationsInput | string
		messages?: JsonNullValueInput | InputJsonValue
		configuration?: JsonNullValueInput | InputJsonValue
		status?: StringFieldUpdateOperationsInput | string
		createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
		updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
	}

	export type CheckpointCreateManyTaskInput = {
		id?: number
		data: JsonNullValueInput | InputJsonValue
		timestamp: bigint | number
		createdAt?: Date | string
	}

	export type CheckpointUpdateWithoutTaskInput = {
		data?: JsonNullValueInput | InputJsonValue
		timestamp?: BigIntFieldUpdateOperationsInput | bigint | number
		createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
	}

	export type CheckpointUncheckedUpdateWithoutTaskInput = {
		id?: IntFieldUpdateOperationsInput | number
		data?: JsonNullValueInput | InputJsonValue
		timestamp?: BigIntFieldUpdateOperationsInput | bigint | number
		createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
	}

	export type CheckpointUncheckedUpdateManyWithoutTaskInput = {
		id?: IntFieldUpdateOperationsInput | number
		data?: JsonNullValueInput | InputJsonValue
		timestamp?: BigIntFieldUpdateOperationsInput | bigint | number
		createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
	}

	/**
	 * Batch Payload for updateMany & deleteMany & createMany
	 */

	export type BatchPayload = {
		count: number
	}

	/**
	 * DMMF
	 */
	export const dmmf: runtime.BaseDMMF
}
