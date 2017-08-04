#!/usr/bin/env ts-node


import * as cheerio from 'cheerio';
import * as childProcess from 'child_process';
import * as datauri from 'datauri';
import * as fs from 'fs';
import * as htmlencode from 'htmlencode';
import * as superSphincs from 'supersphincs';


(async () => {


const args			= {
	customBuild: process.argv[2],
	customBuildConfig: process.argv[3],
	customBuildBackground: process.argv[4],
	customBuildFavicon: process.argv[5],
	customBuildStylesheet: process.argv[6],
	customBuildTheme: process.argv[7]
};


const compileSCSS	= scss =>
	childProcess.spawnSync('cleancss', [], {input:
		childProcess.spawnSync(
			'scss',
			['-s', '-C', '-I../../shared/css'],
			{input: `
				@import '/node_modules/bourbon/app/assets/stylesheets/bourbon';
				@import 'theme';

				${scss}
			`}
		).stdout.toString()
	}).stdout.toString().trim()
;

const $	= cheerio.load(fs.readFileSync('../cyph.ws').toString());

const o	= JSON.parse(
	fs.readFileSync(args.customBuildConfig).toString()
);

try {
	o.background	= datauri.sync(args.customBuildBackground);
}
catch (_) {}

try {
	o.favicon		= datauri.sync(args.customBuildFavicon);
}
catch (_) {}

let css	= '';
try {
	css	= compileSCSS(`
		${!o.backgroundColor ? '' : `
			$cyph-background: ${o.backgroundColor};

			#main-chat-gradient {
				display: none;
			}
		`}

		${!o.foregroundColor ? '' : `
			$cyph-foreground: ${o.foregroundColor};
		`}

		${fs.readFileSync(args.customBuildTheme).toString()}

		body {
			@include cyph-apply-theme;

			${!o.background ? '' : `
				chat-main {
					.message-list:after {
						background-image: url(${o.background}) !important;
					}

					.video-call .logo {
						height: 75% !important;
						opacity: 0.4 !important;
					}
				}
			`}
		}
	`);
}
catch (_) {}

const hash	= (await superSphincs.hash(css)).hex;


if (o.title) {
	$('title').text(htmlencode.htmlEncode(o.title));
}

let headStyle	= '';
if (o.backgroundColor) {
	$('head').find(
		'meta[name="theme-color"],' + 
		'meta[name="msapplication-TileColor"]'
	).
		attr('content', o.backgroundColor)
	;

	headStyle += `
		#pre-load {
			background-color: ${o.backgroundColor} !important;
		}
	`;
}
if (o.loadingAnimationFilter) {
	headStyle += `
		#pre-load > .transition, .loading > .logo-animation > *,
		.loading > .logo-animation.connected, md-progress-bar {
			@include filter(${o.loadingAnimationFilter});
		}
	`;
}
if (headStyle) {
	$('head').append(`<style>${compileSCSS(headStyle)}</style>`);
}

$('head').append(`<meta name='custom-build' content='${args.customBuild}' />`);

if (o.apiFlags) {
	$('head').append(`<meta name='custom-build-api-flags' content='${o.apiFlags}' />`);
}

if (o.callType) {
	$('head').append(`<meta name='custom-build-call-type' content='${o.callType}' />`);
}

if (o.favicon) {
	$('head').find(
		'link[type="image/png"],' + 
		'meta[name="msapplication-TileImage"]'
	).
		removeAttr('websign-sri-path').
		removeAttr('websign-sri-hash').
		removeAttr('href').
		removeAttr('content').
		addClass('custom-build-favicon')
	;

	$('head').append(`<meta name='custom-build-favicon' content='${o.favicon}' />`);
}

if (o.password) {
	/* Not going to pretend that this is a security feature. */
	$('head').append(
		`<meta name='custom-build-password' content='${
			Buffer.from(o.password).toString('base64')
		}' />`
	);
}

if (css) {
	$('body').append(`
		<link
			rel='stylesheet'
			websign-sri-path='${args.customBuildStylesheet}'
			websign-sri-hash='${hash}'
		></link>
	`);

	fs.writeFileSync(args.customBuildStylesheet, css);
	fs.writeFileSync(`${args.customBuildStylesheet}.srihash`, hash);
}

fs.writeFileSync(`../${args.customBuild}`, $.html().trim());


})();
