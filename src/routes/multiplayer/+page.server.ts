import { redirect } from '@sveltejs/kit';

export const load = async (event) => {
	const token = event.cookies.get('auth_token');

	if (!token) {
		return redirect(301, '/login?redirect=/multiplayer');
	}
};
