export const onGoogleScriptLoad = () => {
	try {
		const handleCredentialResponse = (response: { credential: string }) => {
			// decodeJwtResponse() is a custom function defined by you
			// to decode the credential response.
			console.log(response.credential);
		};
		// disable TS check for this file
		// eslint-disable-next-line @typescript-eslint/ban-ts-comment
		// @ts-expect-error
		google.accounts.id.initialize({
			client_id: '576158683082-ufcdalm0uc088e4bnk0mluju0jphpkdc',
			callback: handleCredentialResponse
		});
		// eslint-disable-next-line @typescript-eslint/ban-ts-comment
		// @ts-expect-error
		google.accounts.id.renderButton(
			document.getElementById('googleSignIn'),
			{
				theme: 'filled_black',
				size: 'large',
				text: 'signin_with',
				shape: 'rectangular',
				logo_alignment: 'left'
			} // customization attributes
		);
		// eslint-disable-next-line @typescript-eslint/ban-ts-comment
		// @ts-expect-error
		google.accounts.id.prompt(); // also display the One Tap dialog
	} catch (e) {
		console.error(e);
	}
};
