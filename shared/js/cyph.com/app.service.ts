import {Injectable} from '@angular/core';
import {Title} from '@angular/platform-browser';
import {NavigationEnd, Router} from '@angular/router';
import * as $ from 'jquery';
import * as WOW from 'wowjs';
import {BetaRegisterComponent} from '../cyph/components/beta-register.component';
import {ConfigService} from '../cyph/services/config.service';
import {DialogService} from '../cyph/services/dialog.service';
import {EnvService} from '../cyph/services/env.service';
import {SignupService} from '../cyph/services/signup.service';
import {util} from '../cyph/util';
import {Carousel} from './carousel';
import {elements} from './elements';
import {HomeSections, pageTitles, Promos, States} from './enums';


/**
 * Angular service for Cyph home page.
 */
@Injectable()
export class AppService {
	/** @ignore */
	private disableNextScroll: boolean	= false;

	/** Amount, category, and item respectively in cart. */
	public cart: {
		amount: number;
		category: number;
		item: number;
		subscription: boolean;
	};

	/** @see ContactComponent.to. */
	public contactTo?: string;

	/** Donation amount in dollars. */
	public readonly donationAmount: number	= 10;

	/** Carousel of features. */
	public featureCarousel: Carousel;

	/** Current feature displayed in hero section. */
	public featureIndex: number			= 0;

	/** List of features to cycle through in hero section. */
	public readonly features: string[]	= [
		'Video Calls',
		'Voice Calls',
		'Chats',
		'Photos',
		'File Transfers'
	];

	/** @see HomeSections */
	public homeSection?: HomeSections;

	/** @see Promos */
	public promo?: Promos;

	/** @see States */
	public state: States	= States.home;

	/** Carousel of testimonials. */
	public testimonialCarousel: Carousel;

	/** @ignore */
	private cycleFeatures () : void {
		if (this.featureIndex < this.features.length - 1) {
			this.featureIndex++;
		}
		else {
			this.featureIndex	= 0;
		}
	}

	/** @ignore */
	private async onUrlChange (url: string) : Promise<void> {
		/* Workaround to allow triggering this method
			even when URL hasn't changed (e.g. for scrolling). */
		this.routerService.navigated	= false;

		const urlSegmentPaths: string[]	= url.split('/').slice(1);
		const urlBasePath: string		= urlSegmentPaths[0];

		const state: States|undefined	= (<any> States)[urlBasePath];
		const promo: Promos|undefined	= (<any> Promos)[urlBasePath];

		this.homeSection	= promo === undefined ?
			(<any> HomeSections)[urlBasePath] :
			HomeSections.promo
		;

		this.titleService.setTitle(
			(<any> pageTitles)[urlBasePath] || pageTitles.defaultTitle
		);

		if (this.homeSection !== undefined) {
			this.state	= States.home;

			if (promo !== undefined) {
				this.promo					= promo;
				this.signupService.promo	= Promos[promo];
			}

			await util.sleep();

			switch (this.homeSection) {
				case HomeSections.register:
					await this.dialogService.baseDialog(BetaRegisterComponent);
					this.disableNextScroll	= true;
					this.routerService.navigate(['']);
					break;

				case HomeSections.invite:
					this.signupService.data.inviteCode	=
						urlSegmentPaths.join('/').split(
							`${HomeSections[HomeSections.invite]}/`
						)[1] || ''
					;

					await this.dialogService.baseDialog(BetaRegisterComponent, o => {
						o.invite	= true;
					});

					this.disableNextScroll	= true;
					this.routerService.navigate(['']);
					break;

				default:
					const loadComplete	= () => $('body.load-complete');
					if (loadComplete().length < 1) {
						await util.waitForIterable(loadComplete);
						await util.sleep(500);
					}

					this.scroll(
						$(`#${HomeSections[this.homeSection]}-section`).offset().top -
						(
							this.homeSection === HomeSections.gettingstarted ?
								-1 :
								elements.mainToolbar().height()
						)
					);
			}

			return;
		}

		if (state === States.checkout) {
			try {
				const category: string	= urlSegmentPaths[1];
				const item: string		= urlSegmentPaths[2].replace(
					/-(.)/g,
					(_, s) => s.toUpperCase()
				);

				const amount	=
					this.configService.pricingConfig.categories[category].items[item].amount
				;

				this.updateCart(
					amount,
					this.configService.pricingConfig.categories[category].id,
					this.configService.pricingConfig.categories[category].items[item].id,
					amount > 0
				);
			}
			catch (_) {
				this.routerService.navigate(['404']);
			}
		}
		else if (state === States.contact) {
			const to: string	= urlSegmentPaths[1];
			if (this.configService.contactEmailAddresses.indexOf(to) > -1) {
				this.contactTo	= to;
			}

			this.state	= state;
		}
		else if (state !== undefined) {
			this.state	= state;
		}
		else if (urlBasePath === '') {
			this.state	= States.home;
		}
		else if (urlBasePath === '404') {
			this.state	= States.error;
		}
		else {
			this.routerService.navigate(['404']);
		}

		if (this.disableNextScroll) {
			this.disableNextScroll	= false;
		}
		else {
			await util.sleep(500);
			this.scroll(0);
		}
	}

	/** @ignore */
	private async scroll (
		position: number,
		delayFactor: number = 0.75,
		onComplete?: Function
	) : Promise<void> {
		const delay: number	=
			delayFactor *
			Math.abs($(document).scrollTop() - position)
		;

		$(document.body).animate({scrollTop: position}, delay);

		if (onComplete) {
			await util.sleep(delay + 50);
			onComplete();
		}
	}

	/** Update cart and open checkout screen. */
	public updateCart (
		amount: number,
		category: number,
		item: number,
		subscription?: boolean
	) : void {
		this.cart	= {
			amount,
			category,
			item,
			subscription: subscription === true
		};

		this.state	= States.checkout;
	}

	constructor (
		/** @ignore */
		private readonly configService: ConfigService,

		/** @ignore */
		private readonly dialogService: DialogService,

		/** @ignore */
		private readonly envService: EnvService,

		/** @ignore */
		private readonly routerService: Router,

		/** @ignore */
		private readonly signupService: SignupService,

		/** @ignore */
		private readonly titleService: Title
	) {
		if (!this.envService.isMobile) {
			new WOW({live: true}).init();
		}

		this.routerService.events.subscribe(e => {
			if (e instanceof NavigationEnd) {
				this.onUrlChange(e.url);
			}
		});

		(async () => {
			/* Disable background video on mobile */

			await util.waitForIterable(elements.backgroundVideo);

			if (this.envService.isMobile) {
				const $mobilePoster: JQuery	= $(document.createElement('img'));
				$mobilePoster.attr('src', elements.backgroundVideo().attr('mobile-poster'));

				elements.backgroundVideo().replaceWith($mobilePoster).remove();
				elements.backgroundVideo	= () => $mobilePoster;
			}
			else {
				try {
					(<HTMLVideoElement> elements.backgroundVideo()[0]).currentTime	= 1.25;
				}
				catch (_) {}

				(<any> elements.backgroundVideo()).appear().
					on('appear', () => {
						try {
							(<any> elements.backgroundVideo()[0]).play().catch(() => {});
						}
						catch (_) {}
					}).
					on('disappear', () => {
						try {
							(<HTMLVideoElement> elements.backgroundVideo()[0]).pause();
						}
						catch (_) {}
					})
				;
			}

			/* Carousels */

			await util.waitForIterable(elements.featuresSection);
			await util.waitForIterable(elements.testimonialsSection);

			this.featureCarousel		= new Carousel(elements.featuresSection(), true);
			this.testimonialCarousel	= new Carousel(
				elements.testimonialsSection(),
				this.envService.isMobile
			);

			/* Header / new cyph button animation */

			await util.waitForIterable(elements.mainToolbar);

			let expanded	= this.routerService.routerState.snapshot.url === '';
			elements.mainToolbar().toggleClass('new-cyph-expanded', expanded);

			(async () => {
				await util.sleep(3000);

				while (true) {
					await util.sleep(500);

					const shouldExpand	= this.state === States.home && (
						(
							this.promo === undefined &&
							elements.heroText().is(':appeared')
						) ||
						elements.footer().is(':appeared')
					);

					if (expanded === shouldExpand) {
						continue;
					}

					expanded	= shouldExpand;
					elements.mainToolbar().toggleClass('new-cyph-expanded', expanded);
				}
			})();

			/* Hero section feature rotation */

			(async () => {
				while (true) {
					await util.sleep(4200);
					this.cycleFeatures();
				}
			})();

			/* Load complete */

			await util.waitForIterable(elements.heroSection);
			$(document.body).addClass('load-complete');
		})();
	}
}
