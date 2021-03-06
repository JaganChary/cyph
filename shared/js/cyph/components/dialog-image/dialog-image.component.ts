import {ChangeDetectionStrategy, Component} from '@angular/core';
import {MatDialogRef} from '@angular/material/dialog';
import {DomSanitizer, SafeUrl} from '@angular/platform-browser';
import memoize from 'lodash-es/memoize';
import {IResolvable} from '../../iresolvable';
import {DataURIProto} from '../../proto';
import {StringsService} from '../../services/strings.service';


/**
 * Angular component for image dialog.
 */
@Component({
	changeDetection: ChangeDetectionStrategy.OnPush,
	selector: 'cyph-dialog-image',
	styleUrls: ['./dialog-image.component.scss'],
	templateUrl: './dialog-image.component.html'
})
export class DialogImageComponent {
	/** Aspect ratio for cropping. */
	public cropAspectRatio?: number;

	/** Callback for cropping image. */
	public cropResult?: IResolvable<SafeUrl|undefined>;

	/** In-progress cropped image. */
	public cropped?: string;

	/** @see DataURIProto.safeUrlToString */
	public readonly safeUrlToString	= memoize(async (data?: SafeUrl|string) =>
		!data ? undefined : DataURIProto.safeUrlToString(data).catch(() => undefined)
	);

	/** Image src. */
	public src?: SafeUrl|string;

	/** Image title. */
	public title?: string;

	/** Return final cropped image. */
	public async crop (accept: boolean) : Promise<void> {
		if (!this.cropResult || !this.src) {
			return;
		}

		this.cropResult.resolve(
			!accept ?
				undefined :
			this.cropped ?
				this.domSanitizer.bypassSecurityTrustUrl(
					await DataURIProto.normalize(this.cropped)
				) :
			typeof this.src === 'string' ?
				this.domSanitizer.bypassSecurityTrustUrl(this.src) :
				this.src
		);

		this.matDialogRef.close();
	}

	constructor (
		/** @ignore */
		private readonly domSanitizer: DomSanitizer,

		/** @ignore */
		private readonly matDialogRef: MatDialogRef<DialogImageComponent>,

		/** @see StringsService */
		public readonly stringsService: StringsService
	) {}
}
