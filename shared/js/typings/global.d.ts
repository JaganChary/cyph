/**
 * @global
 * Message to return for beforeunload event.
 */
declare let beforeUnloadMessage: string|undefined;

/**
 * @global
 * If applicable, identifier of this custom build.
 */
declare let customBuild: string|undefined;

/**
 * @global
 * If applicable, favicon for this custom build.
 */
declare let customBuildFavicon: string|undefined;

/**
 * @global
 * If applicable, password for this custom build.
 */
declare let customBuildPassword: string|undefined;

/**
 * @ignore
 */
declare let IS_WEB: boolean;

/**
 * @global
 * Cross-browser container of values in self.location.
 */
declare let locationData: Location;

/**
 * @global
 * Cross-browser container of values in self.navigator.
 */
declare let navigatorData: Navigator;

/**
 * @global
 * Event handler for messages to the current thread.
 */
declare let onthreadmessage: ((e: MessageEvent) => any)|undefined;

/**
 * @global
 * Mapping of language codes to translations of English phrases
 * (populated during build process).
 */
declare let translations: {[language: string]: {[text: string]: string}};
