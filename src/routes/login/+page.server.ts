import { createAuthJWT } from '$lib/server/jws.js';
import { redirect } from '@sveltejs/kit';
import bcrypt from 'bcrypt';

export const actions = {
	signup: async ({ request, cookies }) => {
		const data = await request.formData();
		const username = data.get('username') ?? '';
		const password = data.get('password') ?? '';

		const hash = bcrypt.hashSync(password.toString(), 10);

		// save to database
		console.log(username, hash);

		const token = await createAuthJWT({ username: username.toString(), id: 1 });

		cookies.set('auth_token', token, { path: '/' });

		return redirect(301, '/');
	},

	login: async ({ request, cookies }) => {
		const data = await request.formData();
		const username = data.get('username') ?? '';
		const password = data.get('password') ?? '';

		// get from database
		const hash = bcrypt.hashSync(password.toString(), 10);

		if (bcrypt.compareSync(password.toString(), hash)) {
			const token = await createAuthJWT({ username: username.toString(), id: 1 });

			cookies.set('auth_token', token, { path: '/' });

			return redirect(301, '/');
		} else {
			return { success: false };
		}
	},

	logout: async ({ cookies }) => {
		cookies.delete('auth_token', { path: '/' });
		return redirect(301, '/');
	}
};
