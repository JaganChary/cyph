#!/bin/bash


source ~/.bashrc
cd $(cd "$(dirname "$0")" ; pwd)/..
dir="$PWD"


installPackages () {
	rm -rf node_modules 2> /dev/null
	mkdir node_modules
	yarn add --ignore-engines --ignore-platform --ignore-scripts --non-interactive \
		$(node -e "
			const package	= JSON.parse(
				fs.readFileSync('${dir}/shared/lib/js/package.json').toString()
			);

			for (const k of Object.keys(package.dependencies).filter(package => ${1})) {
				console.log(\`\${k}@\${package.dependencies[k]}\`);
			}
		") \
	|| exit 1
}


go get -u \
	github.com/gorilla/context \
	github.com/gorilla/mux \
	github.com/lionelbarrow/braintree-go \
	github.com/microcosm-cc/bluemonday \
	github.com/oschwald/geoip2-golang \
	golang.org/x/net/context \
	google.golang.org/appengine \
	google.golang.org/appengine/datastore \
	google.golang.org/appengine/mail \
	google.golang.org/appengine/memcache \
	google.golang.org/appengine/urlfetch


nativePlugins="$(cat native/plugins.list)"

sudo rm -rf \
	/node_modules \
	~/cyph \
	~/lib \
	~/node_modules \
	shared/lib/.js.tmp \
	shared/lib/js/node_modules \
	shared/lib/native \
	shared/node_modules \
2> /dev/null

cp -a shared/lib ~/

cd

installPackages "package === 'nativescript'"
rm package.json yarn.lock
~/node_modules/.bin/tns error-reporting disable
~/node_modules/.bin/tns usage-reporting disable
~/node_modules/.bin/tns create cyph --ng --appid com.cyph.app
cd cyph
git init
for plugin in ${nativePlugins} ; do
	~/node_modules/.bin/tns plugin add ${plugin} < /dev/null || exit 1
done
installPackages "
	package.startsWith('nativescript-dev') ||
	package.startsWith('tns')
"
rm yarn.lock
mv package.json package.json.tmp
sudo mv node_modules ~/native_node_modules
mkdir node_modules
cp ~/lib/js/package.json ~/lib/js/yarn.lock ./
yarn install --ignore-engines --ignore-platform --non-interactive || exit 1
rm -rf ~/node_modules
mv node_modules ~/
mv ~/native_node_modules ./node_modules
mv package.json.tmp package.json
cd
mv cyph ~/lib/native


cd ~/lib
cp -a js .js.tmp
cd js
mv ~/node_modules ./
cd node_modules

mkdir -p @types/libsodium
cat > @types/libsodium/index.d.ts << EOM
declare module 'libsodium' {
	interface ISodium {
		crypto_aead_xchacha20poly1305_ietf_ABYTES: number;
		crypto_aead_xchacha20poly1305_ietf_KEYBYTES: number;
		crypto_aead_xchacha20poly1305_ietf_NPUBBYTES: number;
		crypto_box_curve25519xchacha20poly1305_NONCEBYTES: number;
		crypto_box_curve25519xchacha20poly1305_PUBLICKEYBYTES: number;
		crypto_box_curve25519xchacha20poly1305_SECRETKEYBYTES: number;
		crypto_onetimeauth_BYTES: number;
		crypto_onetimeauth_KEYBYTES: number;
		crypto_pwhash_ALG_DEFAULT: number;
		crypto_pwhash_BYTES_MAX: number;
		crypto_pwhash_BYTES_MIN: number;
		crypto_pwhash_MEMLIMIT_INTERACTIVE: number;
		crypto_pwhash_MEMLIMIT_MAX: number;
		crypto_pwhash_MEMLIMIT_MIN: number;
		crypto_pwhash_MEMLIMIT_MODERATE: number;
		crypto_pwhash_MEMLIMIT_SENSITIVE: number;
		crypto_pwhash_OPSLIMIT_INTERACTIVE: number;
		crypto_pwhash_OPSLIMIT_MAX: number;
		crypto_pwhash_OPSLIMIT_MIN: number;
		crypto_pwhash_OPSLIMIT_MODERATE: number;
		crypto_pwhash_OPSLIMIT_SENSITIVE: number;
		crypto_pwhash_PASSWD_MAX: number;
		crypto_pwhash_PASSWD_MIN: number;
		crypto_pwhash_SALTBYTES: number;
		crypto_pwhash_scryptsalsa208sha256_MEMLIMIT_INTERACTIVE: number;
		crypto_pwhash_scryptsalsa208sha256_OPSLIMIT_INTERACTIVE: number;
		crypto_pwhash_scryptsalsa208sha256_OPSLIMIT_SENSITIVE: number;
		crypto_pwhash_scryptsalsa208sha256_SALTBYTES: number;
		crypto_scalarmult_BYTES: number;
		crypto_scalarmult_SCALARBYTES: number;
		ready: Promise<void>;

		crypto_aead_xchacha20poly1305_ietf_decrypt (
			secretNonce: Uint8Array|undefined,
			cyphertext: Uint8Array,
			additionalData: Uint8Array|undefined,
			publicNonce: Uint8Array,
			key: Uint8Array
		) : Uint8Array;
		crypto_aead_xchacha20poly1305_ietf_encrypt (
			plaintext: Uint8Array,
			additionalData: Uint8Array|undefined,
			secretNonce: Uint8Array|undefined,
			publicNonce: Uint8Array,
			key: Uint8Array
		) : Uint8Array;
		crypto_box_curve25519xchacha20poly1305_keypair () : {
			privateKey: Uint8Array;
			publicKey: Uint8Array;
		};
		crypto_box_curve25519xchacha20poly1305_seal (
			plaintext: Uint8Array,
			publicKey: Uint8Array
		) : Uint8Array;
		crypto_box_curve25519xchacha20poly1305_seal_open (
			cyphertext: Uint8Array,
			publicKey: Uint8Array,
			privateKey: Uint8Array
		) : Uint8Array;
		crypto_generichash (
			outputBytes: number,
			plaintext: Uint8Array,
			key?: Uint8Array
		) : Uint8Array;
		crypto_onetimeauth (
			message: Uint8Array,
			key: Uint8Array
		) : Uint8Array;
		crypto_onetimeauth_verify (
			mac: Uint8Array,
			message: Uint8Array,
			key: Uint8Array
		) : boolean;
		crypto_pwhash (
			keyBytes: number,
			password: Uint8Array,
			salt: Uint8Array,
			opsLimit: number,
			memLimit: number,
			algorithm: number
		) : Uint8Array;
		crypto_pwhash_scryptsalsa208sha256 (
			keyBytes: number,
			password: Uint8Array,
			salt: Uint8Array,
			opsLimit: number,
			memLimit: number
		) : Uint8Array;
		crypto_scalarmult (privateKey: Uint8Array, publicKey: Uint8Array) : Uint8Array;
		crypto_scalarmult_base (privateKey: Uint8Array) : Uint8Array;
		crypto_stream_chacha20 (
			outLength: number,
			key: Uint8Array,
			nonce: Uint8Array
		) : Uint8Array;
		from_base64 (s: string) : Uint8Array;
		from_hex (s: string) : Uint8Array;
		from_string (s: string) : Uint8Array;
		memcmp (a: Uint8Array, b: Uint8Array) : boolean;
		memzero (a: Uint8Array) : void;
		to_base64 (a: Uint8Array) : string;
		to_hex (a: Uint8Array) : string;
		to_string (a: Uint8Array) : string;
	}

	const sodium: ISodium;
}
EOM

mkdir -p @types/lz4
cat > @types/lz4/index.d.ts << EOM
declare module 'lz4' {
	const decode: (a: Uint8Array) => Uint8Array;
	const encode: (a: Uint8Array, opts?: {streamChecksum: boolean}) => Uint8Array;
}
EOM

for anyType in \
	braintree-web-drop-in \
	granim \
	konami-code.js \
	markdown-it-emoji \
	markdown-it-sup \
	quill-delta \
	quill-delta-to-html \
	simplewebrtc \
	tab-indent \
	u2f-api-polyfill \
	wowjs
do
	mkdir -p "@types/${anyType}"
	echo "
		declare module '${anyType}' {
			const balls: any;
			export = balls;
		}
	" > "@types/${anyType}/index.d.ts"
done

mkdir -p @types/fg-loadcss
echo "
	declare module 'fg-loadcss' {
		const loadCSS: (stylesheet: string) => void;
	}
" > @types/fg-loadcss/index.d.ts

for arr in \
	'konami-code.js/konami.js Konami' \
	'tab-indent/js/tabIndent.js tabIndent' \
	'wowjs/dist/wow.js this.WOW'
do
	read -ra arr <<< "${arr}"
	echo "module.exports = ${arr[1]};" >> "${arr[0]}"
done

for m in libsodium* ; do cd ${m} ; mv package-${m}.json package.json ; cd .. ; done

sed -i 's/saveAs\s*||/self.saveAs||/g' file-saver/*.js

cp -f simplewebrtc/out/simplewebrtc-with-adapter.bundle.js simplewebrtc/src/simplewebrtc.js
sed -i "s|require('./socketioconnection')|null|g" simplewebrtc/src/simplewebrtc.js

cat wowjs/dist/wow.js | perl -pe 's/this\.([A-Z][a-z])/self.\1/g' > wowjs/dist/wow.js.new
mv wowjs/dist/wow.js.new wowjs/dist/wow.js

# Temporary workaround for https://github.com/angular/angular-cli/issues/1548
sed -i "s|crypto: 'empty'|crypto: true|g" @angular/cli/models/webpack-configs/browser.js

# Temporary workaround for https://github.com/werk85/node-html-to-text/issues/151
grep -rl lodash html-to-text | xargs -I% sed -i 's|lodash|lodash-es|g' %

# Temporary workaround for https://github.com/Jamaks/ng-fullcalendar/issues/33
rm -rf ng-fullcalendar/node_modules &> /dev/null

# Temporary workaround for https://github.com/dcodeIO/protobuf.js/issues/863
wget https://raw.githubusercontent.com/dcodeIO/protobuf.js/952c7d1b478cc7c6de82475a17a1387992e8651f/cli/pbts.js -O protobufjs/cli/pbts.js

./.bin/pbjs --help &> /dev/null
./.bin/pbts --help &> /dev/null

rm grpc/node_modules/protobufjs/src/bower.json

find firebase @firebase -type f -name '*.node.js' -exec bash -c '
	cp -f {} $(echo "{}" | sed "s|\.node\.js$|.js|")
' \;

cd @types
for d in * ; do if [ ! -f ${d}/package.json ] ; then
cat > ${d}/package.json << EOM
{
	"name": "${d}",
	"version": "1.0.0",
	"license": "Ms-RSL"
}
EOM
fi ; done
cd ..

cd tslint
cat package.json | grep -v tslint-test-config-non-relative > package.json.new
mv package.json.new package.json
yarn install --ignore-engines --ignore-platform --ignore-scripts --non-interactive
cd ..

cd ../..

mv js/node_modules .js.tmp/
rm -rf js
mv .js.tmp js
cp js/yarn.lock js/node_modules/

cd
rm -rf ${dir}/shared/lib ${dir}/shared/node_modules 2> /dev/null
cp -aL lib ${dir}/shared/
mv ${dir}/shared/lib/js/node_modules ${dir}/shared/
sudo mv lib/js/node_modules /
sudo chmod -R 777 /node_modules
rm -rf lib

# Temporary workaround pending AGSE update to SuperSPHINCS v6
if [ ! -d oldsupersphincs ] ; then
	mkdir oldsupersphincs
	cd oldsupersphincs
	yarn add supersphincs@^5
fi
