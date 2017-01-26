import {ChangeDetectorRef, Component, ElementRef, Input, OnInit} from '@angular/core';
import * as $ from 'jquery';
import {ChatService} from '../services/chat.service';
import {EnvService} from '../services/env.service';
import {FileService} from '../services/file.service';
import {P2PService} from '../services/p2p.service';
import {ScrollService} from '../services/scroll.service';
import {SessionService} from '../services/session.service';
import {StringsService} from '../services/strings.service';
import {UtilService} from '../services/util.service';


/**
 * Angular component for main chat UI.
 */
@Component({
	selector: 'cyph-chat-main',
	templateUrl: '../../../templates/chat-main.html'
})
export class ChatMainComponent implements OnInit {
	/** Indicates whether projected disconnection message should be hidden. */
	@Input() public hideDisconnectMessage: boolean;

	/** Indicates whether message count should be displayed in title. */
	@Input() public messageCountInTitle: boolean;

	/** @inheritDoc */
	public ngOnInit () : void {
		this.fileService.files.changeDetectorRef	= this.changeDetectorRef;

		if (!this.elementRef.nativeElement || !this.envService.isWeb) {
			/* TODO: HANDLE NATIVE */
			return;
		}

		const $element	= $(this.elementRef.nativeElement);

		this.p2pService.init(
			() => $element.find('.video-call .me'),
			() => $element.find('.video-call .friend.stream')
		);

		this.scrollService.init(
			$element.find('.message-list > md2-content'),
			this.messageCountInTitle
		);
	}

	constructor (
		/** @ignore */
		private readonly changeDetectorRef: ChangeDetectorRef,

		/** @ignore */
		private readonly elementRef: ElementRef,

		/** @ignore */
		private readonly scrollService: ScrollService,

		/** @see ChatService */
		public readonly chatService: ChatService,

		/** @see EnvService */
		public readonly envService: EnvService,

		/** @see FileService */
		public readonly fileService: FileService,

		/** @see P2PService */
		public readonly p2pService: P2PService,

		/** @see SessionService */
		public readonly sessionService: SessionService,

		/** @see StringsService */
		public readonly stringsService: StringsService,

		/** @see UtilService */
		public readonly utilService: UtilService
	) {}
}
