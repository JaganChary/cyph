import {Injectable} from '@angular/core';
import {BehaviorSubject, Observable} from 'rxjs';
import {filter, take} from 'rxjs/operators';
import {User} from '../account/user';
import {BinaryProto, ISessionMessage, SessionMessageList, StringProto} from '../proto';
import {events, ISessionMessageData, rpcEvents} from '../session';
import {filterUndefined} from '../util/filter';
import {normalizeArray} from '../util/formatting';
import {getOrSetDefault} from '../util/get-or-set-default';
import {debugLog} from '../util/log';
import {uuid} from '../util/uuid';
import {resolvable} from '../util/wait';
import {AccountContactsService} from './account-contacts.service';
import {AccountUserLookupService} from './account-user-lookup.service';
import {AccountService} from './account.service';
import {AnalyticsService} from './analytics.service';
import {ChannelService} from './channel.service';
import {AccountDatabaseService} from './crypto/account-database.service';
import {CastleService} from './crypto/castle.service';
import {PotassiumService} from './crypto/potassium.service';
import {EnvService} from './env.service';
import {ErrorService} from './error.service';
import {SessionInitService} from './session-init.service';
import {SessionService} from './session.service';
import {StringsService} from './strings.service';


/**
 * Account session service.
 */
@Injectable()
export class AccountSessionService extends SessionService {
	/** @ignore */
	private readonly _ACCOUNTS_SYMMETRIC_KEY	= resolvable<Uint8Array>();

	/** @ignore */
	private readonly _READY						= resolvable();

	/** @ignore */
	private group?: AccountSessionService[];

	/** @ignore */
	private initiated: boolean					= false;

	/** @ignore */
	private readonly resolveAccountsSymmetricKey: (symmetricKey: Uint8Array) => void	=
		this._ACCOUNTS_SYMMETRIC_KEY.resolve
	;

	/** @ignore */
	private readonly resolveReady: () => void	= this._READY.resolve;

	/** @ignore */
	private readonly stateResolver				= resolvable();

	/** @inheritDoc */
	protected readonly symmetricKey: Promise<Uint8Array>	=
		this._ACCOUNTS_SYMMETRIC_KEY.promise
	;

	/** If true, this is an ephemeral sub-session. */
	public ephemeralSubSession: boolean							= false;

	/** @inheritDoc */
	public readonly ready: Promise<void>						= this._READY.promise;

	/** Remote user. */
	public readonly remoteUser: BehaviorSubject<User|undefined>	=
		new BehaviorSubject<User|undefined>(undefined)
	;

	/** @inheritDoc */
	protected async channelOnClose () : Promise<void> {
		if (this.group) {
			throw new Error('Master channelOnClose should not be used in a group session.');
		}

		if (this.ephemeralSubSession) {
			await super.channelOnClose();
		}
	}

	/** @inheritDoc */
	protected async channelOnOpen (isAlice: boolean) : Promise<void> {
		if (this.group) {
			throw new Error('Master channelOnOpen should not be used in a group session.');
		}

		await super.channelOnOpen(isAlice);
		this.stateResolver.resolve();
	}

	/** @inheritDoc */
	protected async getSessionMessageAuthor (
		message: ISessionMessageData
	) : Promise<Observable<string>|void> {
		if (!message.authorID) {
			return;
		}

		const user	= await this.accountUserLookupService.getUser(message.authorID, false);

		if (user) {
			return user.realUsername;
		}
	}

	/** @inheritDoc */
	protected async plaintextSendHandler (messages: ISessionMessage[]) : Promise<void> {
		if (this.group) {
			await Promise.all(this.group.map(async session =>
				session.plaintextSendHandler(messages)
			));
			return;
		}

		await super.plaintextSendHandler(messages);
	}

	/** @inheritDoc */
	public close () : void {
		if (this.group) {
			for (const session of this.group) {
				session.close();
			}
			return;
		}

		if (this.ephemeralSubSession) {
			super.close();
		}
	}

	/** Normalizes username or username list. */
	public normalizeUsername (username: string|string[]) : string|string[] {
		if (username instanceof Array) {
			username	= normalizeArray(username);

			if (this.accountDatabaseService.currentUser.value) {
				const {user}	= this.accountDatabaseService.currentUser.value;
				username		= username.filter(s => s !== user.username);
			}

			if (username.length === 1) {
				username	= username[0];
			}
		}

		return username;
	}

	/** Sets the remote user we're chatting with. */
	public async setUser (
		username: string|string[],
		sessionSubID?: string,
		ephemeralSubSession: boolean = false,
		setHeader: boolean = true
	) : Promise<void> {
		if (this.initiated) {
			throw new Error('User already set.');
		}

		debugLog(() => ({accountSessionInit: {
			ephemeralSubSession,
			sessionSubID,
			setHeader,
			username
		}}));

		username			= this.normalizeUsername(username);
		this.initiated		= true;
		this.sessionSubID	= sessionSubID;


		/* Group session init */

		if (username instanceof Array) {
			/* Create N pairwise sessions, one for each other group member */

			this.sessionSubID	=
				`group-${
					/* TODO: Kill username-based group chat route and share a file with a UUID */
					await this.accountContactsService.getCastleSessionID(username)
				}${
					this.sessionSubID ? `-${this.sessionSubID}` : ''
				}`
			;

			const group	= await Promise.all(username.map(async groupMember => {
				const session	= this.spawn();
				await session.setUser(groupMember, this.sessionSubID, ephemeralSubSession, false);
				return session;
			}));

			this.group	= group;

			/*
				Handle events on individual pairwise sessions and perform equivalent behavior.
				Note: rpcEvents.typing is ignored because it's unsupported in accounts.
			*/

			const confirmations	= new Map<string, Set<AccountSessionService>>();

			Promise.all(group.map(async session => session.opened)).then(() => {
				this.resolveOpened();
			});

			for (const {event, all} of [
				{all: true, event: events.beginChat},
				{all: false, event: events.closeChat},
				{all: true, event: events.connect},
				{all: false, event: events.connectFailure},
				{all: false, event: events.cyphNotFound}
			]) {
				const promises	= group.map(async session => session.one(event));
				const callback	= async () => this.trigger(event);

				if (all) {
					Promise.all(promises).then(callback);
				}
				else {
					Promise.race(promises).then(callback);
				}
			}

			for (const session of group) {
				session.on(rpcEvents.text, async newEvents =>
					this.trigger(rpcEvents.text, newEvents)
				);

				session.on(rpcEvents.confirm, async (newEvents: ISessionMessageData[]) =>
					this.trigger(rpcEvents.confirm, filterUndefined(newEvents.map(o => {
						if (!o.textConfirmation || !o.textConfirmation.id) {
							return;
						}

						const confirmedSessions	= getOrSetDefault(
							confirmations,
							o.textConfirmation.id,
							() => new Set<AccountSessionService>()
						);

						confirmedSessions.add(session);

						if (confirmedSessions.size === group.length) {
							confirmations.delete(o.textConfirmation.id);
							return o;
						}

						return;
					})))
				);
			}

			this.resolveReady();
			return;
		}


		/* Pairwise session init */

		(async () => {
			const castleSessionID	=
				await this.accountContactsService.getCastleSessionID(username)
			;

			if (ephemeralSubSession) {
				if (!this.sessionSubID) {
					throw new Error('Cannot start ephemeral sub-session without sessionSubID.');
				}

				this.ephemeralSubSession	= true;

				this.init(this.potassiumService.toHex(
					await this.potassiumService.hash.hash(
						`${castleSessionID}-${this.sessionSubID}`
					)
				));

				return;
			}

			const sessionURL		= `castleSessions/${castleSessionID}/session`;
			const symmetricKeyURL	= `${sessionURL}/symmetricKey`;

			this.incomingMessageQueue		= this.accountDatabaseService.getAsyncList(
				`${sessionURL}/incomingMessageQueue`,
				SessionMessageList,
				undefined,
				undefined,
				undefined,
				false,
				true
			);

			this.incomingMessageQueueLock	= this.accountDatabaseService.lockFunction(
				`${sessionURL}/incomingMessageQueueLock${sessionSubID ? `/${sessionSubID}` : ''}`
			);

			this.init(castleSessionID, await this.accountDatabaseService.getOrSetDefault(
				`${sessionURL}/channelUserID`,
				StringProto,
				() => uuid(true),
				undefined,
				undefined,
				true
			));


			const symmetricKeyPromise	= this.accountDatabaseService.getAsyncValue(
				symmetricKeyURL,
				BinaryProto,
				undefined,
				undefined,
				undefined,
				true,
				true
			).getValue();

			symmetricKeyPromise.then(symmetricKey => {
				this.resolveAccountsSymmetricKey(symmetricKey);
			});

			await this.stateResolver.promise;

			if (this.state.isAlice.value) {
				this.on(rpcEvents.requestSymmetricKey, async () => {
					this.send([rpcEvents.symmetricKey, {bytes: await symmetricKeyPromise}]);
				});
			}

			if ((await this.accountDatabaseService.hasItem(symmetricKeyURL))) {
				return;
			}

			if (this.state.isAlice.value) {
				const symmetricKey	= this.potassiumService.randomBytes(
					await this.potassiumService.secretBox.keyBytes
				);

				await Promise.all([
					this.accountDatabaseService.setItem(
						symmetricKeyURL,
						BinaryProto,
						symmetricKey
					),
					this.send([
						rpcEvents.symmetricKey,
						{bytes: symmetricKey}
					])
				]);
			}
			else {
				this.one<ISessionMessageData[]>(rpcEvents.symmetricKey).then(async newEvents =>
					this.accountDatabaseService.setItem(
						symmetricKeyURL,
						BinaryProto,
						(newEvents[0] || {bytes: undefined}).bytes || new Uint8Array(0)
					)
				);

				await this.send([rpcEvents.requestSymmetricKey, {}]);
			}
		})();

		const user	= await this.accountUserLookupService.getUser(username, false);

		if (user) {
			user.realUsername.subscribe(this.remoteUsername);

			if (setHeader) {
				await this.accountService.setHeader(user);
			}
		}

		debugLog(() => ({accountSessionInitComplete: {user}}));

		this.remoteUser.next(user);
		this.resolveReady();
	}

	/** @inheritDoc */
	public spawn () : AccountSessionService {
		return new AccountSessionService(
			this.analyticsService,
			this.castleService.spawn(),
			this.channelService.spawn(),
			this.envService,
			this.errorService,
			this.potassiumService,
			this.sessionInitService.spawn(),
			this.stringsService,
			this.accountService,
			this.accountContactsService,
			this.accountDatabaseService,
			this.accountUserLookupService
		);
	}

	/** @inheritDoc */
	public async yt () : Promise<void> {
		if (this.group) {
			await Promise.all(this.group.map(async session => session.yt()));
			return;
		}

		return new Promise<void>(resolve => {
			const id	= uuid();

			const f		= (newEvents: ISessionMessageData[]) => {
				for (const o of newEvents) {
					if (o.command && o.command.method === id) {
						this.off(rpcEvents.pong, f);
						resolve();
						return;
					}
				}
			};

			this.on(rpcEvents.pong, f);
			this.send([rpcEvents.ping, {command: {method: id}}]);
		});
	}

	constructor (
		analyticsService: AnalyticsService,
		castleService: CastleService,
		channelService: ChannelService,
		envService: EnvService,
		errorService: ErrorService,
		potassiumService: PotassiumService,
		sessionInitService: SessionInitService,
		stringsService: StringsService,

		/** @ignore */
		private readonly accountService: AccountService,

		/** @ignore */
		private readonly accountContactsService: AccountContactsService,

		/** @ignore */
		private readonly accountDatabaseService: AccountDatabaseService,

		/** @ignore */
		private readonly accountUserLookupService: AccountUserLookupService
	) {
		super(
			analyticsService,
			castleService,
			channelService,
			envService,
			errorService,
			potassiumService,
			sessionInitService,
			stringsService
		);

		this.on(rpcEvents.ping, async (newEvents: ISessionMessageData[]) => {
			for (const o of newEvents) {
				if (o.command && o.command.method) {
					await this.freezePong.pipe(filter(b => !b), take(1)).toPromise();
					this.send([rpcEvents.pong, {command: {method: o.command.method}}]);
				}
			}
		});
	}
}
