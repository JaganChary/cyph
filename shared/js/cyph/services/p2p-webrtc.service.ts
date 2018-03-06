/* tslint:disable:max-file-line-count */

import {Injectable} from '@angular/core';
import * as msgpack from 'msgpack-lite';
import {Observable} from 'rxjs/Observable';
import {Subject} from 'rxjs/Subject';
import * as SimpleWebRTC from 'simplewebrtc';
import {env} from '../env';
import {eventManager} from '../event-manager';
import {IP2PHandlers} from '../p2p/ip2p-handlers';
import {ISessionCommand} from '../proto';
import {IP2PWebRTCService} from '../service-interfaces/ip2p-webrtc.service';
import {events, ISessionMessageData, rpcEvents} from '../session';
import {request} from '../util/request';
import {parse} from '../util/serialization';
import {uuid} from '../util/uuid';
import {resolvable, sleep, waitForIterable, waitForValue} from '../util/wait';
import {AnalyticsService} from './analytics.service';
import {SessionCapabilitiesService} from './session-capabilities.service';
import {SessionService} from './session.service';


/** @inheritDoc */
@Injectable()
export class P2PWebRTCService implements IP2PWebRTCService {
	/** @ignore */
	private readonly _HANDLERS		= resolvable<IP2PHandlers>();

	/** @ignore */
	private readonly _LOCAL_VIDEO	= resolvable<() => JQuery>();

	/** @ignore */
	private readonly _READY			= resolvable(true);

	/** @ignore */
	private readonly _REMOTE_VIDEO	= resolvable<() => JQuery>();

	/** Indicates whether WebRTC is supported in the current environment. */
	private static readonly isSupported: boolean	=
		/* Temporarily blocking Edge until issue resolved in simplewebrtc/webrtc-adapter */
		!(env.environment.production && env.isEdge) &&
		/* Temporarily blocking Safari until it works */
		!(env.environment.production && env.isSafari) &&
		(() => {
			try {
				return new SimpleWebRTC({connection: {on: () => {}}}).capabilities.support;
			}
			catch {
				return false;
			}
		})()
	;

	/** Constant values used by P2P. */
	public static readonly constants	= {
		accept: 'accept',
		decline: 'decline',
		kill: 'kill',
		requestCall: 'requestCall',
		webRTC: 'webRTC'
	};


	/** @ignore */
	private readonly commands	= {
		accept: () : void => {
			this.join();
		},

		decline: async () : Promise<void> => {
			this.isAccepted		= false;
			this.p2pSessionData	= undefined;

			(await this.handlers).requestRejection();
		},

		kill: async () : Promise<void> => {
			const wasAccepted			= this.isAccepted;
			const wasInitialCallPending	= this.initialCallPending;
			this.isAccepted				= false;
			this.isActive				= false;
			this.initialCallPending		= false;
			this.p2pSessionData			= undefined;

			await sleep(500);

			this.incomingStream.audio	= false;
			this.incomingStream.video	= false;
			this.outgoingStream.audio	= false;
			this.outgoingStream.video	= false;

			if (this.webRTC && this.webRTC.mute) {
				this.webRTC.mute();
				this.webRTC.pauseVideo();
				this.webRTC.stopLocalVideo();
				this.webRTC.leaveRoom();
				this.webRTC.disconnect();
				this.webRTC	= undefined;
				this.disconnectInternal.next();
			}

			const handlers	= await this.handlers;

			if (wasInitialCallPending) {
				await handlers.canceled();
			}
			else if (wasAccepted) {
				await handlers.connected(false);
			}
		},

		webRTC: (data: {args: any[]; event: string}) : void => {
			eventManager.trigger(P2PWebRTCService.constants.webRTC + data.event, data.args);
		}
	};

	/** @inheritDoc */
	private readonly disconnectInternal: Subject<void>	= new Subject();

	/** @ignore */
	private readonly handlers: Promise<IP2PHandlers>	= this._HANDLERS.promise;

	/** @ignore */
	private isAccepted: boolean							= false;

	/** @ignore */
	private readonly localVideo: Promise<() => JQuery>	= this._LOCAL_VIDEO.promise;

	/** @ignore */
	private p2pSessionData?: {iceServers: string; id: string};

	/** @ignore */
	private readonly remoteVideo: Promise<() => JQuery>	= this._REMOTE_VIDEO.promise;

	/** @ignore */
	private readonly resolveHandlers: (handlers: IP2PHandlers) => void			=
		this._HANDLERS.resolve
	;

	/** @ignore */
	private readonly resolveLocalVideo: (localVideo: () => JQuery) => void		=
		this._LOCAL_VIDEO.resolve
	;

	/** @ignore */
	private readonly resolveRemoteVideo: (remoteVideo: () => JQuery) => void	=
		this._REMOTE_VIDEO.resolve
	;

	/** @ignore */
	private webRTC: any;

	/** @inheritDoc */
	public readonly disconnect: Observable<void>	= this.disconnectInternal;

	/** @inheritDoc */
	public readonly incomingStream					= {audio: false, video: false};

	/** @inheritDoc */
	public initialCallPending: boolean				= false;

	/** @inheritDoc */
	public isActive: boolean						= false;

	/** @inheritDoc */
	public loading: boolean							= false;

	/** @inheritDoc */
	public readonly outgoingStream					= {audio: false, video: false};

	/** @inheritDoc */
	public readonly ready: Promise<boolean>			= this._READY.promise;

	/** @inheritDoc */
	public readonly resolveReady: () => void		= this._READY.resolve;

	/** @ignore */
	private async receiveCommand (command: ISessionCommand) : Promise<void> {
		if (!P2PWebRTCService.isSupported) {
			return;
		}

		await this.ready;

		const method: Function|undefined	= (<any> this.commands)[command.method];

		if (this.isAccepted && method) {
			if (this.p2pSessionData && command.additionalData === this.p2pSessionData.id) {
				method(
					command.argument && command.argument.length > 0 ?
						msgpack.decode(command.argument) :
						undefined
				);
			}
		}
		else if (command.method === 'audio' || command.method === 'video') {
			const ok	= await (await this.handlers).acceptConfirm(
				command.method,
				500000,
				this.isAccepted
			);

			const p2pSessionData	= !command.additionalData ? undefined : (() => {
				const splitIndex	= command.additionalData.indexOf('\n');
				return {
					iceServers: command.additionalData.slice(splitIndex + 1),
					id: command.additionalData.slice(0, splitIndex)
				};
			})();

			if (p2pSessionData) {
				this.sessionService.send([rpcEvents.p2p, {command: {
					additionalData: p2pSessionData.id,
					method: ok ?
						P2PWebRTCService.constants.accept :
						P2PWebRTCService.constants.decline
				}}]);
			}

			if (!ok) {
				return;
			}

			if (
				p2pSessionData &&
				(!this.p2pSessionData || !this.sessionService.state.isAlice)
			) {
				this.p2pSessionData	= p2pSessionData;
			}

			this.accept(
				command.method === 'audio' ?
					'audio' :
					command.method === 'video' ?
						'video' :
						undefined
			);

			this.join();

			this.analyticsService.sendEvent({
				eventAction: 'start',
				eventCategory: 'call',
				eventLabel: command.method,
				eventValue: 1,
				hitType: 'event'
			});
		}
	}

	/** @inheritDoc */
	public accept (callType?: 'audio'|'video', isPassive: boolean = false) : void {
		this.isAccepted				= true;
		this.loading				= true;
		this.outgoingStream.video	= callType === 'video';
		this.outgoingStream.audio	= true;

		if (isPassive) {
			this.isActive	= true;
		}
	}

	/** @inheritDoc */
	public async close () : Promise<void> {
		this.initialCallPending	= false;

		await Promise.all([
			this.sessionService.send([rpcEvents.p2p, {command: {
				additionalData: this.p2pSessionData && this.p2pSessionData.id,
				method: P2PWebRTCService.constants.kill
			}}]),
			this.commands.kill()
		]);
	}

	/** @inheritDoc */
	public init (
		handlers: IP2PHandlers,
		localVideo: () => JQuery,
		remoteVideo: () => JQuery
	) : void {
		this.resolveHandlers(handlers);
		this.resolveLocalVideo(localVideo);
		this.resolveRemoteVideo(remoteVideo);
	}

	/** @inheritDoc */
	public async join () : Promise<void> {
		if (this.webRTC || !this.p2pSessionData) {
			return;
		}

		this.webRTC					= {};
		this.loading				= true;
		this.incomingStream.audio	= this.outgoingStream.audio;
		this.incomingStream.video	= this.outgoingStream.video;
		this.isActive				= true;

		const p2pSessionData			= this.p2pSessionData;
		const webRTCEvents: string[]	= [];

		const $localVideo	= await waitForIterable<JQuery>(await this.localVideo);
		const $remoteVideo	= await waitForIterable<JQuery>(await this.remoteVideo);

		const webRTC	= new SimpleWebRTC({
			adjustPeerVolume: false,
			autoRemoveVideos: true,
			autoRequestMedia: false,
			connection: {
				disconnect: () => {
					for (const event of webRTCEvents) {
						eventManager.off(event);
					}
				},
				emit: (event: string, ...args: any[]) => {
					const lastArg: any	= args.slice(-1)[0];

					if (event === 'join' && typeof lastArg === 'function') {
						lastArg(undefined, {clients: {friend: {video: true}}});
					}
					else if (
						event === 'message' &&
						typeof lastArg === 'object' &&
						lastArg.type === 'connectivityError'
					) {
						this.close();
					}
					else {
						this.sessionService.send([rpcEvents.p2p, {command: {
							additionalData: p2pSessionData.id,
							argument: msgpack.encode({args, event}),
							method: P2PWebRTCService.constants.webRTC
						}}]);
					}
				},
				getSessionid: () => this.sessionService.state.cyphID,
				on: (event: string, callback: Function) => {
					const fullEvent: string	= P2PWebRTCService.constants.webRTC + event;
					webRTCEvents.push(fullEvent);

					eventManager.on(
						fullEvent,
						(args: any) => {
							/* http://www.kapejod.org/en/2014/05/28/ */
							if (event === 'message' && args[0].type === 'offer') {
								args[0].payload.sdp	= (<string> args[0].payload.sdp).
									split('\n').
									filter(s => s.indexOf('ssrc-audio-level') < 0).
									join('\n')
								;
							}

							callback.apply(webRTC, args);
						}
					);
				}
			},
			debug: env.environment.local ? true : false,
			localVideoEl: $localVideo[0],
			media: {audio: true, video: true},
			peerConnectionConfig: {
				iceServers: parse<RTCIceServer[]>(p2pSessionData.iceServers).
					map(o => {
						if ((<any> o).url !== undefined) {
							o.urls			= (<any> o).url;
							(<any> o).url	= undefined;
						}

						if (this.sessionService.apiFlags.disableP2P) {
							o.urls	= typeof o.urls === 'string' && o.urls.indexOf('stun:') !== 0 ?
								o.urls :
								o.urls instanceof Array ?
									o.urls.filter((url: string) => url.indexOf('stun:') !== 0) :
									undefined
							;
						}

						return o;
					}).
					filter(o => o.urls && o.urls.length > 0)
			},
			remoteVideosEl: $remoteVideo[0]
		});

		webRTC.connection.on(
			'streamUpdate',
			(incomingStream: {audio: boolean; video: boolean}) => {
				this.incomingStream.audio	= !!incomingStream.audio;
				this.incomingStream.video	= !!incomingStream.video;
			}
		);

		webRTC.on('videoAdded', async () => {
			await (await this.handlers).loaded();
			this.loading	= false;
		});

		webRTC.on('readyToCall', async () => {
			webRTC.joinRoom(P2PWebRTCService.constants.webRTC);
		});

		webRTC.startLocalVideo();
		webRTC.connection.emit('connect');

		if (!this.outgoingStream.video) {
			this.toggle('video', true);
		}

		(await this.handlers).connected(true);

		this.webRTC				= webRTC;
		this.initialCallPending	= false;
	}

	/** @inheritDoc */
	public async request (callType: 'audio'|'video', isPassive: boolean = false) : Promise<void> {
		const handlers	= await this.handlers;

		if (isPassive && !this.isAccepted) {
			return;
		}

		const ok	= await handlers.requestConfirm(callType, this.isAccepted);

		if (!ok || this.p2pSessionData) {
			return;
		}

		this.accept(callType);

		this.p2pSessionData	= isPassive && !this.sessionService.state.isAlice ?
			undefined :
			{
				iceServers: await request({retries: 5, url: env.baseUrl + 'iceservers'}),
				id: uuid()
			}
		;

		this.sessionService.send([rpcEvents.p2p, {command: {
			additionalData: this.p2pSessionData ?
				this.p2pSessionData.id + '\n' + this.p2pSessionData.iceServers :
				undefined
			,
			method: callType
		}}]);

		await sleep();
		handlers.requestConfirmation();

		/* Time out if request hasn't been accepted within 10 minutes */

		for (let seconds = 0 ; seconds < 600 ; ++seconds) {
			if (this.isActive) {
				return;
			}

			await sleep(1000);
		}

		this.isAccepted	= false;
	}

	/** @inheritDoc */
	public async toggle (medium?: 'audio'|'video', shouldPause?: boolean) : Promise<void> {
		await waitForValue(() => this.webRTC && this.webRTC.connection);

		if (medium === 'audio' || medium === undefined) {
			this.outgoingStream.audio	=
				shouldPause === false ||
				(shouldPause === undefined && !this.outgoingStream.audio)
			;

			if (this.outgoingStream.audio) {
				this.webRTC.unmute();
			}
			else {
				this.webRTC.mute();
			}
		}

		if (medium === 'video' || medium === undefined) {
			this.outgoingStream.video	=
				shouldPause === false ||
				(shouldPause === undefined && !this.outgoingStream.video)
			;

			if (this.outgoingStream.video) {
				this.webRTC.resumeVideo();
			}
			else {
				this.webRTC.pauseVideo();
			}
		}

		this.webRTC.connection.emit('streamUpdate', this.outgoingStream);
	}

	constructor (
		sessionCapabilitiesService: SessionCapabilitiesService,

		/** @ignore */
		private readonly analyticsService: AnalyticsService,

		/** @ignore */
		private readonly sessionService: SessionService
	) {
		this.sessionService.on(events.closeChat, () => { this.close(); });

		this.sessionService.on(rpcEvents.p2p, (o: ISessionMessageData) => {
			if (o.command && o.command.method) {
				this.receiveCommand(o.command);
			}
		});

		sessionCapabilitiesService.resolveP2PSupport(P2PWebRTCService.isSupported);
	}
}
