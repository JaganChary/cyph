/**
 * @file Handle custom builds.
 */


import * as $ from 'jquery';


customBuild			= $('meta[name="custom-build"]').attr('content');
customBuildFavicon	= $('meta[name="custom-build-favicon"]').attr('content');

$('.custom-build-favicon').each((_: number, elem: HTMLElement) => {
	if (elem instanceof HTMLLinkElement) {
		elem.href		= customBuildFavicon || '';
	}
	else if (elem instanceof HTMLMetaElement) {
		elem.content	= customBuildFavicon || '';
	}
});
