import {Injectable} from '@angular/core';
import {Router} from '@angular/router';
import {SessionInitService} from './session-init.service';


/**
 * SessionInitService implementation that gets ID from URL.
 */
@Injectable()
export class UrlSessionInitService implements SessionInitService {
	/** @inheritDoc */
	public readonly callType?: 'audio'|'video';

	/** @inheritDoc */
	public readonly id: string;

	constructor (routerService: Router) {
		const urlSegmentPaths	=
			routerService.routerState.snapshot.root.firstChild ?
				routerService.routerState.snapshot.root.firstChild.url.map(o => o.path) :
				[]
		;

		this.callType	=
			urlSegmentPaths[0] === 'audio' ?
				'audio' :
				urlSegmentPaths[0] === 'video' ?
					'video' :
					undefined
		;

		this.id	= urlSegmentPaths[this.callType ? 1 : 0] || '';

		if (!this.callType) {
			this.callType	= customBuildCallType;
		}
	}
}
