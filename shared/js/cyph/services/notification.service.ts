import {Injectable} from '@angular/core';
import {INotificationService} from '../service-interfaces/inotification.service';
import {ConfigService} from './config.service';
import {EnvService} from './env.service';
import {VisibilityWatcherService} from './visibility-watcher.service';


/**
 * @inheritDoc
 */
@Injectable()
export class NotificationService implements INotificationService {
	/** @ignore */
	private readonly config	= {
		audio: '/audio/beep.mp3',
		icon: customBuildFavicon || '/img/favicon/favicon-192x192.png',
		title: 'Cyph'
	};

	/** @ignore */
	private readonly audio: {play: Function}	= Audio ?
		new Audio(this.config.audio) :
		{play: () => {}}
	;

	/** Indicates whether notifications are currently silenced. */
	private disableNotify: boolean				= false;

	/** Currently open notification objects. */
	private readonly openNotifications: any[]	= [];

	/** @ignore */
	private async createNotification (message: string) : Promise<any> {
		const options	= {
			audio: <string|undefined> undefined,
			body: message,
			icon: this.config.icon,
			lang: this.envService.language,
			noscreen: false,
			sticky: false
		};

		try {
			const notification	= new (<any> self).Notification(this.config.title, options);

			try {
				this.audio.play();
			}
			catch (_) {}

			return notification;
		}
		catch (_) {
			options.audio	= this.config.audio;

			const serviceWorkerRegistration	= await (<any> navigator).serviceWorker.
				register(this.configService.webSignConfig.serviceWorker)
			;

			return serviceWorkerRegistration.showNotification(
				this.config.title,
				options
			);
		}
	}

	/** @inheritDoc */
	public async notify (message: string) : Promise<void> {
		try {
			if ((await (<any> self).Notification.requestPermission()) === 'denied') {
				return;
			}
		}
		catch (_) {}

		if (!this.disableNotify && !this.visibilityWatcherService.isVisible) {
			this.disableNotify	= true;

			try {
				const notification		= await this.createNotification(message);

				notification.onclick	= () => {
					notification.close();
					self.focus();
				};

				this.openNotifications.push(notification);
			}
			catch (_) {}
		}
	}

	constructor (
		/** @ignore */
		private readonly configService: ConfigService,

		/** @ignore */
		private readonly envService: EnvService,

		/** @ignore */
		private readonly visibilityWatcherService: VisibilityWatcherService
	) {
		this.visibilityWatcherService.onChange((isVisible: boolean) => {
			if (isVisible) {
				for (const notification of this.openNotifications) {
					try {
						notification.close();
					}
					catch (_) {}
				}

				this.openNotifications.length	= 0;
			}
			else {
				this.disableNotify	= false;
			}
		});

		try {
			(<any> self).Notification.requestPermission();
		}
		catch (_) {}
	}
}
