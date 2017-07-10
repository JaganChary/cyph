import {IAsyncValue} from '../../iasync-value';
import {LocalAsyncValue} from '../../local-async-value';
import {LockFunction} from '../../lock-function-type';
import {util} from '../../util';
import {IPotassium} from '../potassium/ipotassium';


/**
 * The core Castle protocol logic.
 */
export class Core {
	/** Convert newly established shared secret into session keys. */
	public static async newSymmetricKeys (
		potassium: IPotassium,
		isAlice: boolean,
		secret: Uint8Array
	) : Promise<{
		incoming: Uint8Array;
		outgoing: Uint8Array;
	}> {
		const alt	= await potassium.hash.deriveKey(
			potassium.concatMemory(
				false,
				secret,
				new Uint8Array([1])
			),
			secret.length
		);

		return isAlice ?
			{incoming: secret, outgoing: alt} :
			{incoming: alt, outgoing: secret}
		;
	}


	/** @ignore */
	private async asymmetricRatchet (incomingPublicKey?: Uint8Array) : Promise<Uint8Array> {
		let outgoingPublicKey: Uint8Array|undefined;
		let secret: Uint8Array|undefined;

		const asymmetricKeys	= await (async () => {
			const [privateKey, publicKey]	= await Promise.all([
				this.asymmetricKeys.privateKey.getValue(),
				this.asymmetricKeys.publicKey.getValue()
			]);

			return {privateKey, publicKey};
		})();

		/* Part 1: Alice (outgoing) */
		if (this.isAlice && !asymmetricKeys.privateKey && !incomingPublicKey) {
			const aliceKeyPair	= await this.potassium.ephemeralKeyExchange.aliceKeyPair();
			outgoingPublicKey	= aliceKeyPair.publicKey;
			this.asymmetricKeys.privateKey.setValue(aliceKeyPair.privateKey);
		}

		/* Part 2a: Bob (incoming) */
		else if (!this.isAlice && !asymmetricKeys.publicKey && incomingPublicKey) {
			const secretData	=
				await this.potassium.ephemeralKeyExchange.bobSecret(
					incomingPublicKey
				)
			;

			secret	= secretData.secret;
			this.asymmetricKeys.publicKey.setValue(secretData.publicKey);
		}

		/* Part 2b: Bob (outgoing) */
		else if (!this.isAlice && asymmetricKeys.publicKey && !incomingPublicKey) {
			outgoingPublicKey	= new Uint8Array(asymmetricKeys.publicKey);
			this.asymmetricKeys.publicKey.setValue(undefined);
		}

		/* Part 3: Alice (incoming) */
		else if (this.isAlice && asymmetricKeys.privateKey && incomingPublicKey) {
			secret	=
				await this.potassium.ephemeralKeyExchange.aliceSecret(
					incomingPublicKey,
					asymmetricKeys.privateKey
				)
			;

			this.asymmetricKeys.privateKey.setValue(undefined);
		}

		if (secret) {
			const newKeys	= await Core.newSymmetricKeys(this.potassium, this.isAlice, secret);
			this.symmetricKeys.next.incoming.setValue(newKeys.incoming);
			this.symmetricKeys.next.outgoing.setValue(newKeys.outgoing);
		}

		if (outgoingPublicKey) {
			return this.potassium.concatMemory(
				true,
				new Uint8Array([1]),
				outgoingPublicKey
			);
		}
		else {
			return new Uint8Array([0]);
		}
	}

	/**
	 * Decrypt incoming cyphertext.
	 * @param cyphertext Data to be decrypted.
	 * @returns Plaintext.
	 */
	public async decrypt (cyphertext: Uint8Array) : Promise<Uint8Array> {
		const ephemeralKeyExchangePublicKeyBytes	=
			await this.potassium.ephemeralKeyExchange.publicKeyBytes
		;

		return this.lock(async () => {
			const messageId	= this.potassium.toBytes(cyphertext, undefined, 8);
			const encrypted	= this.potassium.toBytes(cyphertext, 8);

			for (const keys of [this.symmetricKeys.current, this.symmetricKeys.next]) {
				try {
					const incomingKey	= await this.potassium.hash.deriveKey(
						await keys.incoming.getValue()
					);

					const decrypted		= await this.potassium.secretBox.open(
						encrypted,
						incomingKey,
						messageId
					);

					keys.incoming.setValue(incomingKey);

					let startIndex	= 1;
					if (decrypted[0] === 1) {
						await this.asymmetricRatchet(this.potassium.toBytes(
							decrypted,
							startIndex,
							ephemeralKeyExchangePublicKeyBytes
						));

						startIndex += ephemeralKeyExchangePublicKeyBytes;
					}

					if (keys === this.symmetricKeys.next) {
						const [nextIncoming, nextOutgoing]	= await Promise.all([
							this.symmetricKeys.next.incoming.getValue(),
							this.symmetricKeys.next.outgoing.getValue()
						]);

						this.symmetricKeys.current.incoming.setValue(new Uint8Array(nextIncoming));
						this.symmetricKeys.current.outgoing.setValue(new Uint8Array(nextOutgoing));
					}

					return this.potassium.toBytes(decrypted, startIndex);
				}
				catch (_) {}
			}

			throw new Error('Invalid cyphertext.');
		});
	}

	/**
	 * Encrypt outgoing plaintext.
	 * @param plaintext Data to be encrypted.
	 * @param messageId Used to enforce message ordering.
	 * @returns Cyphertext.
	 */
	public async encrypt (plaintext: Uint8Array, messageId: Uint8Array) : Promise<Uint8Array> {
		const o	= await this.lock(async () => {
			const ratchetData	= await this.asymmetricRatchet();
			const fullPlaintext	= this.potassium.concatMemory(false, ratchetData, plaintext);

			const key			= await this.potassium.hash.deriveKey(
				await this.symmetricKeys.current.outgoing.getValue()
			);

			this.symmetricKeys.current.outgoing.setValue(new Uint8Array(key));
			this.potassium.clearMemory(ratchetData);

			return {fullPlaintext, key};
		});

		const cyphertext	= await this.potassium.secretBox.seal(
			o.fullPlaintext,
			o.key,
			messageId
		);

		this.potassium.clearMemory(o.key);
		this.potassium.clearMemory(o.fullPlaintext);

		return cyphertext;
	}

	constructor (
		/** @ignore */
		private readonly potassium: IPotassium,

		/** @ignore */
		private readonly isAlice: boolean,

		/** State of the symmetric (forward-secret) ratchet. */
		private readonly symmetricKeys: {
			current: {
				incoming: IAsyncValue<Uint8Array>;
				outgoing: IAsyncValue<Uint8Array>;
			};
			next: {
				incoming: IAsyncValue<Uint8Array>;
				outgoing: IAsyncValue<Uint8Array>;
			};
		},

		/** State of the asymmetric (future-secret) ratchet. */
		private readonly asymmetricKeys: {
			privateKey: IAsyncValue<Uint8Array|undefined>;
			publicKey: IAsyncValue<Uint8Array|undefined>;
		} = {
			privateKey: new LocalAsyncValue<Uint8Array|undefined>(undefined),
			publicKey: new LocalAsyncValue<Uint8Array|undefined>(undefined)
		},

		/** Lock function. */
		private readonly lock: LockFunction = util.lockFunction()
	) {}
}
