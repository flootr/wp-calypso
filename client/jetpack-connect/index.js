/** @format */
/**
 * External dependencies
 */
import page from 'page';

/**
 * Internal dependencies
 */
import controller from './controller';
import { siteSelection } from 'my-sites/controller';
import { makeLayout, render as clientRender } from 'controller';

const redirectToStoreWithInterval = context => {
	const interval =
		context && context.params && context.params.interval ? context.params.interval : '';
	page.redirect( `/jetpack/connect/store/${ interval }` );
};

export default function() {
	page(
		'/jetpack/connect/:type(personal|premium|pro)/:interval(yearly|monthly)?',
		controller.connect,
		makeLayout,
		clientRender
	);

	page(
		'/jetpack/connect/:type(install)/:locale?',
		controller.redirectWithoutLocaleifLoggedIn,
		controller.connect,
		makeLayout,
		clientRender
	);

	page( '/jetpack/connect', controller.connect, makeLayout, clientRender );

	page( '/jetpack/connect/choose/:site', controller.plansPreSelection, makeLayout, clientRender );

	page(
		'/jetpack/connect/authorize/:localeOrInterval?',
		controller.redirectWithoutLocaleifLoggedIn,
		controller.saveQueryObject,
		controller.authorizeForm,
		makeLayout,
		clientRender
	);

	page(
		'/jetpack/connect/authorize/:interval/:locale',
		controller.redirectWithoutLocaleifLoggedIn,
		controller.saveQueryObject,
		controller.authorizeForm,
		makeLayout,
		clientRender
	);

	page( '/jetpack/connect/store', controller.plansLanding, makeLayout, clientRender );
	page( '/jetpack/connect/store/:interval', controller.plansLanding, makeLayout, clientRender );

	page( '/jetpack/connect/vaultpress', '/jetpack/connect/store' );
	page(
		'/jetpack/connect/vaultpress/:interval',
		redirectToStoreWithInterval,
		makeLayout,
		clientRender
	);

	page( '/jetpack/connect/akismet', '/jetpack/connect/store' );
	page(
		'/jetpack/connect/akismet/:interval',
		redirectToStoreWithInterval,
		makeLayout,
		clientRender
	);

	page(
		'/jetpack/connect/:locale?',
		controller.redirectWithoutLocaleifLoggedIn,
		controller.connect,
		makeLayout,
		clientRender
	);

	page(
		'/jetpack/connect/plans/:site',
		siteSelection,
		controller.plansSelection,
		makeLayout,
		clientRender
	);
	page(
		'/jetpack/connect/plans/:interval/:site',
		siteSelection,
		controller.plansSelection,
		makeLayout,
		clientRender
	);

	page( '/jetpack/sso/:siteId?/:ssoNonce?', controller.sso, makeLayout, clientRender );
	page( '/jetpack/sso/*', controller.sso, makeLayout, clientRender );
	page( '/jetpack/new', controller.newSite, makeLayout, clientRender );
	page( '/jetpack/new/*', '/jetpack/connect' );
}
