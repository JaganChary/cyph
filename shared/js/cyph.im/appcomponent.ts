import {Component} from '@angular/core';
import {Util} from '../cyph/util';


/**
 * Angular component for Cyph UI.
 */
@Component({
	selector: 'cyph-app',
	templateUrl: '../../templates/cyph.im.html'
})
export class AppComponent {
	/** @ignore */
	public cyph: any;

	/** @ignore */
	public ui: any;

	constructor () { (async () => {
		while (!cyph || !ui) {
			await Util.sleep();
		}

		this.cyph	= cyph;
		this.ui		= ui;
	})(); }
}
