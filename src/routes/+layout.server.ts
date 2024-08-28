import { verifyAuthJWT } from '$lib/server/jws.js';

export const load = async (event) => {
	const token = event.cookies.get('auth_token');

	if (token) {
		const user = await verifyAuthJWT(token);
		return { user };
	} else {
		return { user: null };
	}
};
