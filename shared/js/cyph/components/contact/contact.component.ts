import {Component, Input, OnInit} from '@angular/core';
import {emailPattern} from '../../email-pattern';
import {ConfigService} from '../../services/config.service';
import {StringsService} from '../../services/strings.service';
import {trackBySelf} from '../../track-by/track-by-self';
import {email} from '../../util/email';


/**
 * Angular component for contact form UI.
 */
@Component({
	selector: 'cyph-contact',
	styleUrls: ['./contact.component.scss'],
	templateUrl: './contact.component.html'
})
export class ContactComponent implements OnInit {
	/** @see emailPattern */
	public readonly emailPattern: typeof emailPattern	= emailPattern;

	/** Indicates whether the feedback form UI should be displayed. */
	public feedbackForm: boolean			= false;

	/** Sender email address. */
	@Input() public fromEmail: string		= '';

	/** Sender name. */
	@Input() public fromName: string		= '';

	/** Indicates whether data collection is consented to under the GDPR. */
	public gdprConsent: boolean				= false;

	/** Email body. */
	@Input() public message: string			= '';

	/** Indicates whether response is requested. */
	public responseRequested: boolean		= false;

	/** Indicates whether email has been sent. */
	public sent: boolean					= false;

	/** Email subject. */
	@Input() public subject: string			= '';

	/** Recipient @cyph.com email address ("@cyph.com" may be omitted). */
	@Input() public to: string				= '';

	/** @see trackBySelf */
	public trackBySelf: typeof trackBySelf	= trackBySelf;

	/** @inheritDoc */
	public ngOnInit () : void {
		this.feedbackForm	= this.to === 'feedback';

		if (!this.to) {
			this.to	= 'hello';
		}
	}

	/** Sends email. */
	public send () : void {
		email(
			this.to,
			this.subject,
			this.message,
			this.fromEmail,
			this.fromName
		);

		this.sent	= true;
	}

	constructor (
		/** @see ConfigService */
		public readonly configService: ConfigService,

		/** @see StringsService */
		public readonly stringsService: StringsService
	) {}
}
