import { quintOut } from "svelte/easing";
import { crossfade } from "svelte/transition";

export const useCrossfade = () => {
    const [send, receive] = crossfade({
        duration: (d) => Math.sqrt(d * 200),

        fallback(node) {
            const style = getComputedStyle(node);
            const transform = style.transform === 'none' ? '' : style.transform;

            return {
                duration: 600,
                easing: quintOut,
                css: (t) => `
				transform: ${transform} scale(${t});
				opacity: ${t}
			`
            };
        }
    });
    return {
        send, receive
    }
}