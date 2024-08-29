import type { User } from 'firebase/auth';

const createSession = () => {
	let user: User | null = $state(null);
	let ready = $state(false);
	return {
		setUser(value: User | null) {
			ready = true;
			user = value;
		},
		get data():
			| {
					ready: false;
			  }
			| {
					ready: true;
					user: typeof user;
			  } {
			return ready ? { ready, user } : { ready };
		}
	};
};

export const session = createSession();

export type Session = ReturnType<typeof createSession>;
