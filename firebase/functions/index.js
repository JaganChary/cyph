const cors										= require('cors')({origin: true});
const firebase									= require('firebase');
const admin										= require('firebase-admin');
const functions									= require('firebase-functions');
const namespaces								= require('./namespaces');
const {normalize, retryUntilSuccessful, sleep}	= require('./util');

const {
	AccountFileRecord,
	AccountUserProfile,
	NotificationTypes,
	NumberProto,
	StringProto
}	= require('./proto');

const {
	auth,
	database,
	functionsUser,
	getItem,
	messaging,
	removeItem,
	setItem,
	storage
}	= require('./database-service')(functions.config(), true);

const {notify}	= require('./notify')(database, messaging);


const channelDisconnectTimeout	= 5000;

const getRealUsername	= async (namespace, username) => {
	try {
		const realUsername	=
			(await database.ref(
				`${namespace}/users/${username}/internal/realUsername`
			).once('value')).val()
		;

		if (realUsername) {
			return realUsername;
		}
	}
	catch {}

	return username;
};

const getName	= async (namespace, username) => {
	try {
		const name	=
			(await database.ref(
				`${namespace}/users/${username}/internal/name`
			).once('value')).val()
		;

		if (name) {
			return name;
		}
	}
	catch {}

	return getRealUsername(namespace, username);
};

const getURL	= (adminRef, namespace) => {
	const url	= adminRef.toString().split(
		`${adminRef.root.toString()}${namespace ? `${namespace}/` : ''}`
	)[1];

	if (!url) {
		throw new Error('Cannot get URL from input.');
	}

	return url;
};


exports.channelDisconnect	= functions.database.ref(
	'{namespace}/channels/{channel}/disconnects/{user}'
).onWrite(async (data, {params}) => {
	if (!data.exists()) {
		return;
	}

	const startingValue	= data.val();

	await sleep(Math.max(channelDisconnectTimeout - (Date.now() - startingValue), 0));

	if (startingValue !== (await data.ref.once('value')).val()) {
		return;
	}

	const doomedRef	= data.ref.parent.parent;

	if (doomedRef.key.length < 1) {
		throw new Error('INVALID DOOMED REF');
	}

	return removeItem(params.namespace, `channels/${doomedRef.key}`);
});


exports.environmentUnlock	= functions.https.onRequest((req, res) => cors(req, res, async () => {
	try {
		let {id, namespace}	= JSON.parse(req.body);
		namespace			= namespace.replace(/\./g, '_');

		if (!id || !namespace || id.indexOf('/') > -1 || namespace.indexOf('/') > -1) {
			throw new Error('Invalid data.');
		}

		const ref	= database.ref(`${namespace}/lockdownIds/${id}`);
		res.send((await ref.once('value')).val() || '');
	}
	catch (err) {
		console.error(err);
		res.send('');
	}
}));


/*
TODO: Handle this as a cron job that searches for folders
	with multiple items and deletes all but the oldest.

exports.itemHashChange	= functions.database.ref(
	'{namespace}'
).onUpdate(async (data, {params}) => {
	if (!data.exists() || data.key !== 'hash') {
		return;
	}

	const hash	= data.val();

	if (typeof hash !== 'string') {
		return;
	}

	const url		= getURL(data.adminRef.parent);

	const files	= await Promise.all(
		(await storage.getFiles({prefix: `${url}/`}))[0].map(async file => {
			const [metadata]	= await file.getMetadata();

			return {
				file,
				name: metadata.name.split('/').slice(-1)[0],
				timestamp: new Date(metadata.updated).getTime()
			};
		})
	);

	for (const o of files.sort((a, b) => a.timestamp > b.timestamp)) {
		if (o.name === hash) {
			return;
		}

		await retryUntilSuccessful(async () => {
			const [exists]	= await o.file.exists();
			if (!exists) {
				return;
			}

			await o.file.delete();
		});
	}
});
*/


exports.itemRemoved	= functions.database.ref(
	'{namespace}'
).onDelete(async (data, {params}) => {
	if (data.exists()) {
		return;
	}

	return removeItem(params.namespace, getURL(data.adminRef, params.namespace));
});


exports.userConsumeInvite	= functions.database.ref(
	'{namespace}/users/{user}/inviteCode'
).onCreate(async (data, {params}) => {
	const username		= params.user;
	const inviteCode	= await getItem(
		params.namespace,
		`users/${username}/inviteCode`,
		StringProto
	);

	if (!inviteCode) {
		return;
	}

	const inviterRef		= database.ref(`${params.namespace}/inviteCodes/${inviteCode}`);
	const inviterUsername	= (await inviterRef.once('value')).val() || '';

	return Promise.all([
		inviterRef.remove(),
		setItem(
			params.namespace,
			`users/${username}/inviterUsernamePlaintext`,
			StringProto,
			inviterUsername
		),
		!inviterUsername ?
			undefined :
			removeItem(
				params.namespace,
				`users/${inviterUsername}/inviteCodes/${inviteCode}`
			)
	]);
});


exports.userDisconnect	= functions.database.ref(
	'{namespace}/users/{user}/clientConnections'
).onDelete(async (data, {params}) => {
	const username	= params.user;

	return removeItem(params.namespace, `users/${username}/presence`);
});


exports.userEmailSet	= functions.database.ref(
	'{namespace}/users/{user}/email'
).onWrite(async (data, {params}) => {
	const username					= params.user;
	const internalURL				= `${params.namespace}/users/${username}/internal`;
	const emailRef					= database.ref(`${internalURL}/email`);
	const registrationEmailSentRef	= database.ref(`${internalURL}/registrationEmailSent`);

	const email						= await getItem(
		params.namespace,
		`users/${username}/email`,
		StringProto
	).catch(
		() => undefined
	);

	if (email) {
		await emailRef.set(email);
	}
	else {
		await emailRef.remove();
	}

	const registrationEmailSent		= (await registrationEmailSentRef.once('value')).val();

	if (registrationEmailSent) {
		return;
	}

	const [realUsername]	= await Promise.all([
		getRealUsername(params.namespace, username),
		registrationEmailSentRef.set(true)
	]);

	await notify(
		params.namespace,
		username,
		`Your Registration is Being Processed, ${realUsername}`,
		`We've received your registration request, and your account is on the way!\n` +
			`You'll receive a follow-up email as soon as one of the Cyph founders ` +
			`(Ryan or Josh) activates your account using their personal ` +
			`Air Gapped Signing Environment.`
	);
});


/* TODO: Translations and user block lists. */
exports.userNotification	= functions.database.ref(
	'{namespace}/users/{user}/notifications/{notification}'
).onCreate(async (data, {params}) => {
	const username		= params.user;
	const notification	= data.val();

	if (!notification || !notification.target || isNaN(notification.type)) {
		return;
	}

	await Promise.all([
		(async () => {
			const [senderName, senderUsername, targetName]	= await Promise.all([
				getName(params.namespace, username),
				getRealUsername(params.namespace, username),
				getName(params.namespace, notification.target)
			]);

			const {subject, text}	=
				notification.type === NotificationTypes.File ?
					{
						subject: `Incoming Data from ${senderUsername}`,
						text: `${targetName}, ${senderName} has shared something with you.`
					} :
				notification.type === NotificationTypes.Message ?
					{
						subject: `New Message from ${senderUsername}`,
						text: `${targetName}, ${senderName} has sent you a message.`
					} :
				/* else */
					{
						subject: `Sup Dog, it's ${senderUsername}`,
						text: `${targetName}, ${senderName} says yo.`
					}
			;

			await notify(params.namespace, notification.target, subject, text, true);
		})(),
		(async () => {
			const path	=
				notification.type === NotificationTypes.File ?
					'unreadFileCounts/' +
						(
							(
								!isNaN(notification.subType) &&
								notification.subType in AccountFileRecord.RecordTypes
							) ?
								notification.subType :
								AccountFileRecord.RecordTypes.File
						).toString()
					:
				notification.type === NotificationTypes.Message ?
					`unreadMessageCounts/${username}` :
				/* else */
					undefined
			;

			if (!path) {
				return;
			}

			const url	= `users/${notification.target}/${path}`;
			const count	= await getItem(params.namespace, url, NumberProto).
				catch(() => 0)
			;

			await setItem(params.namespace, url, NumberProto, count + 1);
		})()
	]);
});


exports.userPublicProfileSet	= functions.database.ref(
	'{namespace}/users/{user}/publicProfile'
).onWrite(async (data, {params}) => {
	const username			= params.user;
	const internalURL		= `${params.namespace}/users/${username}/internal`;
	const nameRef			= database.ref(`${internalURL}/name`);
	const realUsernameRef	= database.ref(`${internalURL}/realUsername`);

	const publicProfile		= await getItem(
		params.namespace,
		`users/${username}/publicProfile`,
		AccountUserProfile,
		true,
		true
	).catch(
		() => undefined
	);

	return Promise.all([
		nameRef.set(
			publicProfile && publicProfile.name ?
				publicProfile.name :
				username
		),
		realUsernameRef.set(
			publicProfile && normalize(publicProfile.realUsername) === username ?
				publicProfile.realUsername :
				username
		)
	]);
});


exports.userRegister	= functionsUser.onCreate(async (data, {params}) => {
	const emailSplit	= (data.email || '').split('@');

	if (emailSplit.length !== 2 || (
		data.providerData && (
			data.providerData.length !== 1 ||
			data.providerData[0].providerId !== firebase.auth.EmailAuthProvider.PROVIDER_ID
		)
	)) {
		return auth.deleteUser(data.uid);
	}

	const username	= emailSplit[0];
	const namespace	= emailSplit[1].replace(/\./g, '_');

	return database.ref(`${namespace}/pendingSignups/${username}`).set({
		timestamp: admin.database.ServerValue.TIMESTAMP,
		uid: data.uid
	});
});


exports.userRegisterConfirmed	= functions.database.ref(
	'{namespace}/users/{user}/certificate'
).onCreate(async (data, {params}) => {
	const username	= params.user;

	const [name, realUsername, registrationEmailSentRef]	= await Promise.all([
		getName(params.namespace, username),
		getRealUsername(params.namespace, username),
		database.ref(`${params.namespace}/users/${username}/internal/registrationEmailSent`)
	]);

	await Promise.all([
		notify(
			params.namespace,
			username,
			`Welcome to Cyph, ${realUsername}`,
			`Congratulations ${name}, your account is now activated!\n` +
				`Sign in at ${namespaces[params.namespace].accountsURL}login.`
		),
		registrationEmailSentRef.set(true)
	]);
});
