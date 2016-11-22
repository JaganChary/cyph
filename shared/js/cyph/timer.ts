import {ITimer} from './itimer';
import {Util} from './util';


/** @inheritDoc */
export class Timer implements ITimer {
	/** @ignore */
	private endTime: number;

	/** @ignore */
	private includeHours: boolean;

	/** @ignore */
	private includeMinutes: boolean;

	/** @ignore */
	private stopped: boolean;

	/** @inheritDoc */
	public isComplete: boolean;

	/** @inheritDoc */
	public timestamp: string;

	/** @ignore */
	private updateTimestamp (timeRemaining: number) : void {
		const hours		= Math.floor(timeRemaining / 3600000);
		const minutes	= Math.floor((timeRemaining % 3600000) / 60000);
		const seconds	= Math.floor(((timeRemaining % 3600000) % 60000) / 1000);

		this.timestamp	= this.includeHours ?
			`${hours}:${`0${minutes}`.slice(-2)}:${`0${seconds}`.slice(-2)}` :
			this.includeMinutes ?
				`${minutes}:${`0${seconds}`.slice(-2)}` :
				`${seconds}`
		;
	}

	/** @inheritDoc */
	public addTime (milliseconds: number) : void {
		this.countdown += milliseconds;

		if (this.endTime) {
			this.endTime += milliseconds;
		}
	}

	/** @inheritDoc */
	public async start () : Promise<void> {
		if (this.stopped) {
			return;
		}

		this.endTime	= Util.timestamp() + this.countdown;

		for (
			let timeRemaining = this.countdown;
			timeRemaining > 0;
			timeRemaining = this.endTime - Util.timestamp()
		) {
			if (this.stopped) {
				return;
			}

			this.updateTimestamp(timeRemaining);
			await Util.sleep(500);
		}

		this.isComplete	= true;
		this.timestamp	= this.includeHours ?
			'0:00:00' :
			this.includeMinutes ?
				'0:00' :
				'0'
		;
	}

	/** @inheritDoc */
	public stop () : void {
		this.isComplete	= true;
		this.stopped	= true;
	}

	constructor (
		/** @inheritDoc */
		public countdown: number,

		autostart?: boolean
	) {
		this.includeHours	= this.countdown >= 3600000;
		this.includeMinutes	= this.countdown >= 60000;

		this.updateTimestamp(this.countdown);

		if (autostart) {
			this.start();
		}
	}
}
