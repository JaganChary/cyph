import {Component, ElementRef, Input, OnInit} from '@angular/core';
import * as $ from 'jquery';
import {IChatMessage} from '../chat/ichat-message';
import {EnvService} from '../services/env.service';
import {ScrollService} from '../services/scroll.service';
import {SessionService} from '../services/session.service';
import {StringsService} from '../services/strings.service';


/**
 * Angular component for chat message.
 */
@Component({
	selector: 'cyph-chat-message',
	styleUrls: ['../../css/components/chat-message.css'],
	templateUrl: '../../../templates/chat-message.html'
})
export class ChatMessageComponent implements OnInit {
	/** @see IChatMessage */
	@Input() public message: IChatMessage;

	/** Indicates whether mobile version should be displayed. */
	@Input() public mobile: boolean;

	/** @inheritDoc */
	public async ngOnInit () : Promise<void> {
		if (!this.elementRef.nativeElement || !this.envService.isWeb) {
			/* TODO: HANDLE NATIVE */
			return;
		}

		this.scrollService.trackItem(this.message, $(this.elementRef.nativeElement));
	}

	constructor (
		/** @ignore */
		private readonly elementRef: ElementRef,

		/** @ignore */
		private readonly scrollService: ScrollService,

		/** @see EnvService */
		public readonly envService: EnvService,

		/** @see SessionService */
		public readonly sessionService: SessionService,

		/** @see StringsService */
		public readonly stringsService: StringsService
	) {}
}
