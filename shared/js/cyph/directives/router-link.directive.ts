import {Directive, ElementRef, OnInit, Renderer2} from '@angular/core';


/**
 * Adds router-link CSS class to router links.
 */
@Directive({
	/* tslint:disable-next-line:directive-selector */
	selector: '[routerLink]'
})
export class RouterLinkDirective implements OnInit {
	/** @inheritDoc */
	public ngOnInit () : void {
		if (this.elementRef.nativeElement) {
			this.renderer.addClass(this.elementRef.nativeElement, 'router-link');
		}
	}

	constructor (
		/** @ignore */
		private readonly elementRef: ElementRef,

		/** @ignore */
		private readonly renderer: Renderer2
	) {}
}
