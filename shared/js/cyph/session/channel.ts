import {firebaseApp} from '../firebase-app';
import {util} from '../util';


/**
 * Bidirectional network connection that sends and receives data (via Firebase).
 */
export class Channel {
	/** @ignore */
	private channelRef: firebase.database.Reference;

	/** @ignore */
	private messagesRef: firebase.database.Reference;

	/** @ignore */
	private usersRef: firebase.database.Reference;

	/** @ignore */
	private userId: string;

	/** @ignore */
	private isClosed: boolean		= false;

	/** @ignore */
	private isConnected: boolean	= false;

	/** @ignore */
	private isAlice: boolean		= false;

	/** This kills the channel. */
	public close () : void {
		if (this.isClosed) {
			return;
		}

		this.isClosed	= true;

		this.handlers.onClose();
		this.channelRef.remove().catch(() => {});
	}

	/** Indicates whether this channel is available for sending and receiving. */
	public get isAlive () : boolean {
		return !this.isClosed;
	}

	/** Sends message through this channel. */
	public send (message: string) : void {
		util.retryUntilSuccessful(async () => {
			if (this.isClosed) {
				return;
			}

			await this.messagesRef.push({
				cyphertext: message,
				sender: this.userId,
				timestamp: util.timestamp()
			});
		});
	}

	/**
	 * @param channelName Name of this channel.
	 * @param handlers Event handlers for this channel.
	 */
	constructor (
		channelName: string,
		private handlers: ({
			onClose: () => void;
			onConnect: () => void;
			onMessage: (message: string) => void;
			onOpen: (isAlice: boolean) => void;
		})
	) { (async () => {
		this.channelRef		= await util.retryUntilSuccessful(async () =>
			(await firebaseApp).database().ref('channels').child(channelName)
		);

		this.messagesRef	= await util.retryUntilSuccessful(() =>
			this.channelRef.child('messages')
		);
		this.usersRef		= await util.retryUntilSuccessful(() =>
			this.channelRef.child('users')
		);

		const userRef: firebase.database.ThenableReference	=
			await util.retryUntilSuccessful(() => this.usersRef.push(''))
		;

		this.userId			= userRef.key || '';

		util.retryUntilSuccessful(async () => userRef.set(this.userId));

		this.isAlice		=
			Object.keys(
				await util.retryUntilSuccessful(async () =>
					(await this.usersRef.once('value')).val()
				)
			).sort()[0] === this.userId
		;

		util.retryUntilSuccessful(async () =>
			this.channelRef.onDisconnect().remove()
		);

		this.handlers.onOpen(this.isAlice);

		if (this.isAlice) {
			util.retryUntilSuccessful(() =>
				this.usersRef.on('child_added', (snapshot: firebase.database.DataSnapshot) => {
					if (!this.isConnected && snapshot.key !== this.userId) {
						this.isConnected	= true;
						this.handlers.onConnect();
					}
				})
			);
		}
		else {
			this.handlers.onConnect();
		}

		util.retryUntilSuccessful(() =>
			this.channelRef.on('value', async (snapshot: firebase.database.DataSnapshot) => {
				if (await util.retryUntilSuccessful(() =>
					!snapshot.exists() && !this.isClosed
				)) {
					this.isClosed	= true;
					this.handlers.onClose();
				}
			})
		);

		util.retryUntilSuccessful(() =>
			this.messagesRef.on('child_added', async (snapshot: firebase.database.DataSnapshot) => {
				const o	= await util.retryUntilSuccessful(() =>
					snapshot.val()
				);

				if (o.sender !== this.userId) {
					this.handlers.onMessage(o.cyphertext);
				}
			})
		);
	})(); }
}
