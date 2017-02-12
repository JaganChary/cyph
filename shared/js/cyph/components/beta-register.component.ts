import {Component, Input} from '@angular/core';
import {EnvService} from '../services/env.service';
import {SignupService} from '../services/signup.service';


/**
 * Angular component for beta register UI.
 */
@Component({
	selector: 'cyph-beta-register',
	styleUrls: ['../../css/components/beta-register.css'],
	templateUrl: '../../../templates/beta-register.html'
})
export class BetaRegisterComponent {
	/** @see SignupFormComponent.invite */
	@Input() public invite: boolean;

	constructor (
		/** @see EnvService */
		public readonly envService: EnvService,

		/** @see SignupService */
		public readonly signupService: SignupService
	) {}
}
