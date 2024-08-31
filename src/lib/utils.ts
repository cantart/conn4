export type ConvertToUnknown<T> = {
	[K in keyof T]: unknown;
};
