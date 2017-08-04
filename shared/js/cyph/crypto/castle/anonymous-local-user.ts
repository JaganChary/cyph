import {IKeyPair} from '../../../proto';
import {IPotassium} from '../potassium/ipotassium';
import {potassiumUtil} from '../potassium/potassium-util';
import {IHandshakeState} from './ihandshake-state';
import {ILocalUser} from './ilocal-user';


/**
 * An anonymous user with an ephemeral key pair, authenticated via shared secret.
 */
export class AnonymousLocalUser implements ILocalUser {
	/** Salt used for shared secret handshake. */
	public static handshakeSalt: Uint8Array	= potassiumUtil.fromBase64(
		'QmaEvu1jYA3SKXsVtoR+9/92/tvMIXOe0NRfwQR5bPw='
	);


	/** @ignore */
	private keyPair: Promise<IKeyPair>	= (async () => {
		const keyPair		= await this.potassium.box.keyPair();

		const sharedSecret	= (await this.potassium.passwordHash.hash(
			this.sharedSecret,
			AnonymousLocalUser.handshakeSalt
		)).hash;

		await this.handshakeState.localPublicKey.setValue(
			await this.potassium.secretBox.seal(keyPair.publicKey, sharedSecret)
		);

		this.potassium.clearMemory(sharedSecret);

		this.sharedSecret	= '';

		return keyPair;
	})();

	/** @inheritDoc */
	public async getKeyPair () : Promise<IKeyPair> {
		return this.keyPair;
	}

	constructor (
		/** @ignore */
		private readonly potassium: IPotassium,

		/** @ignore */
		private readonly handshakeState: IHandshakeState,

		/** @ignore */
		private sharedSecret: string
	) {}
}
