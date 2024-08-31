export type ConvertToUnknown<T> = {
	[K in keyof T]: unknown;
};

export type SafeOmit<T, K extends keyof T> = Omit<T, K>;
