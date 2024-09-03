export const themes = [
	'light',
	'dark',
	'cupcake',
	'bumblebee',
	'emerald',
	'corporate',
	'synthwave',
	'retro',
	'cyberpunk',
	'valentine',
	'halloween',
	'garden',
	'forest',
	'aqua',
	'lofi',
	'pastel',
	'fantasy',
	'wireframe',
	'black',
	'luxury',
	'dracula',
	'cmyk',
	'autumn',
	'business',
	'acid',
	'lemonade',
	'night',
	'coffee',
	'winter',
	'dim',
	'nord',
	'sunset',
] as const;

export type Theme = (typeof themes)[number];

const createThem = () => {
	let value = $state<Theme>('synthwave');

	const loadSavedTheme = () => {
		const saved = localStorage.getItem('theme');
		if (saved && themes.includes(saved as Theme)) {
			value = saved as Theme;
		}
	};

	return {
		get value() {
			return value;
		},
		set value(val: Theme) {
			value = val;
		},
		loadSavedTheme,
	};
};

export const theme = createThem();
