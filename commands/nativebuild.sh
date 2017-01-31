#!/bin/bash

cd $(cd "$(dirname "$0")" ; pwd)/..
dir="$PWD"


plugins="$(cat shared/js/native/plugins.list)"

cd
tns create cyph --ng --appid com.cyph.app || exit 1
cd cyph
node -e '
	const package	= JSON.parse(fs.readFileSync("package.json").toString());
	package.dependencies["@angular/compiler-cli"]	= package.dependencies["@angular/compiler"];
	fs.writeFileSync("package.json", JSON.stringify(package));
'
mkdir node_modules 2> /dev/null
npm install || exit 1
tns platform add android --sdk 22 || exit 1

cp ${dir}/shared/js/native/firebase.nativescript.json ./
for plugin in ${plugins} ; do tns plugin add ${plugin} < /dev/null || exit 1 ; done

cp -rf node_modules node_modules.old
rm -rf node_modules/@types 2> /dev/null
for d in $(ls -a /node_modules) ; do
	if [ ! -d "node_modules/${d}" ] ; then
		cp -rf "/node_modules/${d}" node_modules/
	fi
done

mkdir -p tmp/app
mv app/App_Resources tmp/app/
cd tmp

cp ${dir}/shared/lib/js/base.js ./
mv ../node_modules ./
cp -rf ${dir}/shared/js/typings ./
cp -rf ${dir}/shared/js/native/* app/
cp -rf ${dir}/shared/css/native/* app/
cp -rf ${dir}/shared/templates/native app/templates

rm -rf app/js
mkdir -p app/js/cyph.im app/js/preload
cp ${dir}/shared/js/preload/global.ts app/js/preload/
cp -rf ${dir}/shared/js/cyph.im/enums app/js/cyph.im/
cp -rf ${dir}/shared/js/cyph app/js/
rm -rf app/js/cyph/components/material
rm -rf app/js/cyph/components/checkout.component.ts
rm -rf app/js/cyph/components/register.component.ts

find app -type f -name '*.scss' -exec bash -c '
	scss -C -I${dir}/shared/css "{}" "$(echo "{}" | sed "s/\.scss$/.css/")"
' \;

getmodules () {
	{
		find node_modules/${1} -mindepth 1 -type d -or -name '*.ts' \
			-not -path 'node_modules/${1}/node_modules/*' |
			sed 's|node_modules/||g' |
			sed 's|\.d\.ts$||g' |
			sed 's|\.ts$||g' \
		;
		echo "${1}/index";
	} |
		perl -pe 's/(.*)\/index/\1\n\1\/index/g' |
		sort |
		uniq
}

getbadimports () {
	grep -rP "^import .* from [\"']" app |
		grep -v 'js/' |
		grep '\.ts:' |
		perl -pe "s/.* from [\"'](.*?)[\"'].*/\1/g" |
		grep -P "^($(
			echo -n "$(
				getmodules tns-core-modules |
				grep '/' |
				sed 's|^tns-core-modules/|../|g'
			)" |
				tr '\n' '|'
		))" |
		sort |
		uniq
}

cat node_modules/tns-core-modules/tns-core-modules.base.d.ts |
	grep -v 'declarations\.d\.ts' \
> node_modules/tns-core-modules/tns-core-modules.tmp.d.ts
echo \
	"/// <reference path=\"../node_modules/tns-core-modules/tns-core-modules.tmp.d.ts\" />" \
>> typings/libs.d.ts

node -e "
	const tsconfig	= JSON.parse(
		fs.readFileSync('${dir}/shared/js/tsconfig.json').toString().
			split('\n').
			filter(s => s.trim()[0] !== '/').
			join('\n')
	);

	/* Temporary, pending TS 2.1 */
	tsconfig.compilerOptions.alwaysStrict		= undefined;
	tsconfig.compilerOptions.lib				= undefined;
	tsconfig.compilerOptions.target				= 'es2015';

	/* For Angular AOT */
	tsconfig.compilerOptions.noUnusedParameters	= undefined;

	tsconfig.compilerOptions.outDir				= '.';

	tsconfig.files	= [
		'app/main.ts',
		'app/js/preload/global.ts',
		'app/js/cyph/base.ts',
		'app/js/cyph/crypto/potassium/index.ts',
		'app/js/cyph/session/session.ts',
		'typings/index.d.ts'
	];

	fs.writeFileSync(
		'tsconfig.json',
		JSON.stringify(tsconfig)
	);
"

./node_modules/.bin/ngc -p .
sed -i 's|\./app.module|\./app.module.ngfactory|g' app/main.ts
sed -i 's|AppModule|AppModuleNgFactory|g' app/main.ts
sed -i 's|bootstrapModule|bootstrapModuleFactory|g' app/main.ts
for module in $(getbadimports) ; do
	mkdir -p "app/${module}" 2> /dev/null
	node -e "
		console.log(
			fs.readFileSync(
				'node_modules/tns-core-modules$(
					echo "${module}" | perl -pe 's/\.\.(\/.*)?(\/[^\/\s]+)$/\1\2\2/'
				).d.ts'
			).toString().
				split('{').
				slice(1).
				join('{').
				split('}').
				slice(0, -1).
				join('}')
		)
	" > "app/${module}/index.d.ts"
done
./node_modules/.bin/ngc -p .
rm tsconfig.json node_modules/tns-core-modules/tns-core-modules.tmp.d.ts
for module in $(getbadimports) ; do
	moduleRegex="$(echo "${module}" | sed 's|^\.\./|\\.\\./|')"
	for f in $(grep -rl "${moduleRegex}" app) ; do
		sed -i "s|${moduleRegex}|$(echo "${module}" | sed 's|^\.\./||')|g" ${f}
	done
done

for platform in android ios ; do
	cat > webpack.js <<- EOM
		const webpack	= require('webpack');

		module.exports	= {
			entry: {
				app: './app/main'
			},
			externals: {
				$(for plugin in ${plugins} ; do echo "
					'${plugin}': \"require('${plugin}')\",
				" ; done)
				jquery: 'undefined',
				libsodium: 'self.sodium',
				mceliece: 'self.mceliece',
				ntru: 'self.ntru',
				rlwe: 'self.rlwe',
				sidh: 'self.sidh',
				simplewebrtc: '{}',
				sphincs: 'self.sphincs',
				supersphincs: 'self.superSphincs'
			},
			module: {
				rules: [
					{
						test: /\.js$/,
						use: [
							{
								loader: 'babel-loader',
								options: {
									compact: false,
									presets: [
										['es2015', {modules: false}]
									]
								}
							}
						]
					}
				]
			},
			node: {
				http: false,
				timers: false,
				setImmediate: false
			},
			output: {
				filename: 'app/main.${platform}.js',
				path: '.'
			},
			resolve: {
				extensions: [
					'.js',
					'.css',
					'.${platform}.js',
					'.${platform}.css'
				],
				modules: [
					'node_modules/tns-core-modules',
					'node_modules',
					'/node_modules'
				]
			}
		};
	EOM

	webpack --config webpack.js
	sed -i 's|lib/js/||g' app/main.${platform}.js
	sed -i 's|js/|app/js/|g' app/main.${platform}.js
	# ../commands/websign/threadpack.ts app/main.${platform}.js

	cp base.js main.${platform}.js
	babel --presets es2015 --compact false app/js/preload/global.js >> main.${platform}.js
	cat >> main.${platform}.js <<- EOM
		/* Temporary workaround pending APPS-35 */
		self.firebase	= {
			apps: [{}]
		};
	EOM
	node -e 'console.log(`
		self.translations = ${JSON.stringify(
			child_process.spawnSync("find", [
				"../translations",
				"-name",
				"*.json"
			]).stdout.toString().
				split("\n").
				filter(s => s).
				map(file => ({
					key: file.split("/").slice(-1)[0].split(".")[0],
					value: JSON.parse(fs.readFileSync(file).toString())
				})).
				reduce((translations, o) => {
					translations[o.key]	= o.value;
					return translations;
				}, {})
		)};
	`)' >> main.${platform}.js
	cat app/main.${platform}.js >> main.${platform}.js

	sed -i 's|use strict||g' main.${platform}.js
done

cd ..
rm -rf app hooks/before-prepare/nativescript-dev-typescript.js
mkdir app
mv tmp/main.*.js tmp/app/App_Resources tmp/app/app.css tmp/app/package.json app/
mv node_modules.old node_modules
rm -rf tmp

cd
rm -rf ${dir}/.nativebuild 2> /dev/null
mv cyph ${dir}/.nativebuild
