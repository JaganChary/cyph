import {analytics} from './analytics';
import {Email} from './email';
import {util} from './util';


/**
 * Handles this.
 */
export class Errors {
	/**
	 * Logs generic error (used by self.onerror).
	 * @param errorMessage
	 * @param url
	 * @param line
	 * @param column
	 * @param errorObject
	 */
	public readonly log			= this.baseErrorLog(
		'WARNING WARNING WARNING SOMETHING IS SRSLY FUCKED UP LADS',
		true
	);

	/**
	 * Logs chat authentication failure (attempted mitm and/or mistyped shared secret).
	 */
	public readonly logAuthFail	= this.baseErrorLog(
		'AUTHENTICATION JUST FAILED FOR SOMEONE LADS'
	);

	/** @ignore */
	private baseErrorLog (subject: string, requireErrorMessage?: boolean) : (
		errorMessage?: string,
		url?: string,
		line?: number,
		column?: number,
		errorObject?: any
	) => void {
		let numEmails	= 0;

		return (
			errorMessage?: string,
			url?: string,
			line?: number,
			column?: number,
			errorObject?: any
		) : void => {
			if (
				(requireErrorMessage && !errorMessage) ||
				/* Annoying useless iframe-related spam */
				errorMessage === 'Script error.' ||
				/* Google Search iOS app bug */
				errorMessage === "TypeError: null is not an object (evaluating 'elt.parentNode')"
			) {
				return;
			}

			const exception: string	= !errorMessage ? '' : `
				${errorMessage}

				URL: ${url}
				Line: ${line === undefined ? '' : line.toString()}
				Column: ${column === undefined ? '' : column.toString()}

				${errorObject === undefined ? '' : <string> errorObject.stack}
			`.replace(
				/\/#.*/g,
				''
			);

			if (numEmails++ < 50) {
				util.email(new Email(
					'errors',
					'CYPH: ' + subject,
					exception
				));
			}

			analytics.sendEvent('exception', {
				exDescription: exception
			});
		};
	}

	constructor () {
		self.onerror	= this.log;

		try {
			/* tslint:disable-next-line:no-unbound-method */
			const oldConsoleError	= console.error;
			/* tslint:disable-next-line:no-unbound-method */
			console.error			= (errorMessage: string) => {
				oldConsoleError.call(console, errorMessage);
				self.onerror(errorMessage);
			};
		}
		catch (_) {}

		(<any> self).onunhandledrejection	= (e: any) => { self.onerror(e.reason); };
	}
}

/** @see Errors */
export const errors	= new Errors();
