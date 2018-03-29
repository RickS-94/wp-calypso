/** @format */

/**
 * External dependencies
 */

import debugFactory from 'debug';
import { omit, pick } from 'lodash';

/**
 * Internal dependencies
 */
import config from 'config';
import userFactory from 'lib/user';
import wpcom from 'lib/wp';
import { addQueryArgs, externalRedirect } from 'lib/route';
import { clearPlan, persistSession } from 'jetpack-connect/persistence-utils';
import { createSocialUser } from 'state/login/actions';
import { receiveDeletedSite, receiveSite } from 'state/sites/actions';
import { recordTracksEvent } from 'state/analytics/actions';
import { REMOTE_PATH_AUTH } from 'jetpack-connect/constants';
import { SITE_REQUEST_FIELDS, SITE_REQUEST_OPTIONS } from 'state/sites/constants';
import { urlToSlug } from 'lib/url';
import {
	JETPACK_CONNECT_AUTHORIZE,
	JETPACK_CONNECT_AUTHORIZE_LOGIN_COMPLETE,
	JETPACK_CONNECT_AUTHORIZE_RECEIVE,
	JETPACK_CONNECT_AUTHORIZE_RECEIVE_SITE_LIST,
	JETPACK_CONNECT_CHECK_URL,
	JETPACK_CONNECT_CHECK_URL_RECEIVE,
	JETPACK_CONNECT_COMPLETE_FLOW,
	JETPACK_CONNECT_CONFIRM_JETPACK_STATUS,
	JETPACK_CONNECT_CREATE_ACCOUNT,
	JETPACK_CONNECT_CREATE_ACCOUNT_RECEIVE,
	JETPACK_CONNECT_DISMISS_URL_STATUS,
	JETPACK_CONNECT_QUERY_SET,
	JETPACK_CONNECT_RETRY_AUTH,
	JETPACK_CONNECT_SSO_AUTHORIZE_ERROR,
	JETPACK_CONNECT_SSO_AUTHORIZE_REQUEST,
	JETPACK_CONNECT_SSO_AUTHORIZE_SUCCESS,
	JETPACK_CONNECT_SSO_VALIDATION_ERROR,
	JETPACK_CONNECT_SSO_VALIDATION_REQUEST,
	JETPACK_CONNECT_SSO_VALIDATION_SUCCESS,
	JETPACK_CONNECT_USER_ALREADY_CONNECTED,
	SITE_RECEIVE,
	SITE_REQUEST,
	SITE_REQUEST_FAILURE,
	SITE_REQUEST_SUCCESS,
} from 'state/action-types';

/**
 * Module constants
 */
const _fetching = {};
const calypsoEnv = config( 'env_id' );
const debug = debugFactory( 'calypso:jetpack-connect:actions' );

export function confirmJetpackInstallStatus( status ) {
	return {
		type: JETPACK_CONNECT_CONFIRM_JETPACK_STATUS,
		status: status,
	};
}

export function dismissUrl( url ) {
	return {
		type: JETPACK_CONNECT_DISMISS_URL_STATUS,
		url: url,
	};
}

export function startAuthorizeStep( clientId ) {
	return {
		type: JETPACK_CONNECT_QUERY_SET,
		clientId,
		timestamp: Date.now(),
	};
}

export function checkUrl( url, isUrlOnSites ) {
	return dispatch => {
		if ( _fetching[ url ] ) {
			return;
		}
		if ( isUrlOnSites ) {
			persistSession( url );
			dispatch( {
				type: JETPACK_CONNECT_CHECK_URL,
				url: url,
			} );
			setTimeout( () => {
				dispatch( {
					type: JETPACK_CONNECT_CHECK_URL_RECEIVE,
					url: url,
					data: {
						exists: true,
						isWordPress: true,
						hasJetpack: true,
						isJetpackActive: true,
						isJetpackConnected: true,
						isWordPressDotCom: false,
						userOwnsSite: true,
					},
					error: null,
				} );
			} );
			return;
		}
		_fetching[ url ] = true;
		setTimeout( () => {
			persistSession( url );
			dispatch( {
				type: JETPACK_CONNECT_CHECK_URL,
				url: url,
			} );
		}, 1 );
		wpcom
			.undocumented()
			.getSiteConnectInfo( url )
			.then( data => {
				_fetching[ url ] = null;
				debug( 'jetpack-connect state checked for url', url, data );
				dispatch( {
					type: JETPACK_CONNECT_CHECK_URL_RECEIVE,
					url: url,
					data: data,
					error: null,
				} );

				let errorCode = null;
				let instructionsType = null;
				if ( data && data.isWordPressDotCom ) {
					errorCode = 'calypso_jpc_error_wpdotcomsite';
				} else if ( data && ! data.exists ) {
					errorCode = 'calypso_jpc_error_notexists';
				} else if ( data && ! data.isWordPress ) {
					errorCode = 'calypso_jpc_error_notwpsite';
				} else if ( data && ! data.hasJetpack ) {
					errorCode = 'calypso_jpc_instructions_view';
					instructionsType = 'not_jetpack';
				} else if ( data && ! data.isJetpackActive ) {
					errorCode = 'calypso_jpc_instructions_view';
					instructionsType = 'inactive_jetpack';
				}

				if ( errorCode ) {
					dispatch(
						recordTracksEvent( errorCode, {
							url: url,
							type: instructionsType,
						} )
					);
				}
			} )
			.catch( error => {
				_fetching[ url ] = null;
				dispatch( {
					type: JETPACK_CONNECT_CHECK_URL_RECEIVE,
					url: url,
					data: null,
					error: error,
				} );
				dispatch(
					recordTracksEvent( 'calypso_jpc_error_other', {
						url: url,
					} )
				);
			} );
	};
}

export function retryAuth( url, attemptNumber ) {
	return dispatch => {
		debug( 'retrying auth', url, attemptNumber );
		dispatch( {
			type: JETPACK_CONNECT_RETRY_AUTH,
			attemptNumber: attemptNumber,
			slug: urlToSlug( url ),
		} );
		dispatch(
			recordTracksEvent( 'calypso_jpc_retry_auth', {
				url: url,
				attempt: attemptNumber,
			} )
		);
		debug( 'retryAuth', url );
		externalRedirect(
			addQueryArgs(
				{
					jetpack_connect_url: url + REMOTE_PATH_AUTH,
					calypso_env: calypsoEnv,
					auth_type: 'jetpack',
				},
				url + REMOTE_PATH_AUTH
			)
		);
	};
}

export function createSocialAccount( socialInfo ) {
	return dispatch => {
		dispatch( recordTracksEvent( 'calypso_jpc_social_create_account' ) );

		dispatch( { type: JETPACK_CONNECT_CREATE_ACCOUNT } );

		/**
		 * @TODO (sirreal) update to `jetpack-connect` when D11099-code lands
		 *
		 * The signup flow is required and affects some post signup activity.
		 * `account` should be safe until patch lands.
		 */
		createSocialUser( socialInfo, 'account' /* 'jetpack-connect' */ ).then(
			( { username, bearerToken } ) => {
				dispatch( recordTracksEvent( 'calypso_jpc_social_createaccount_success' ) );
				dispatch( {
					type: JETPACK_CONNECT_CREATE_ACCOUNT_RECEIVE,
					userData: { username },
					data: { bearer_token: bearerToken },
				} );
			},
			error =>
				dispatch(
					recordTracksEvent( 'calypso_jpc_social_createaccount_error', {
						error: JSON.stringify( error ),
						error_code: error.code,
					} )
				)
		);
	};
}

export function createAccount( userData ) {
	return dispatch => {
		dispatch( recordTracksEvent( 'calypso_jpc_create_account', {} ) );

		dispatch( { type: JETPACK_CONNECT_CREATE_ACCOUNT } );

		wpcom.undocumented().usersNew( userData, ( error, data ) => {
			if ( error ) {
				dispatch(
					recordTracksEvent( 'calypso_jpc_create_account_error', {
						error: JSON.stringify( error ),
						error_code: error.code,
					} )
				);
			} else {
				dispatch( recordTracksEvent( 'calypso_jpc_create_account_success' ) );
			}
			dispatch( {
				type: JETPACK_CONNECT_CREATE_ACCOUNT_RECEIVE,
				data,
				error,
				userData,
			} );
		} );
	};
}

export function isUserConnected( siteId, siteIsOnSitesList ) {
	let accessibleSite;
	return dispatch => {
		dispatch( {
			type: SITE_REQUEST,
			siteId,
		} );
		debug( 'checking that site is accessible', siteId );
		return wpcom
			.site( siteId )
			.get()
			.then( site => {
				accessibleSite = site;
				debug( 'site is accessible! checking that user is connected', siteId );
				return wpcom.undocumented().jetpackIsUserConnected( siteId );
			} )
			.then( () => {
				debug( 'user is connected to site.', accessibleSite );
				dispatch( {
					type: SITE_REQUEST_SUCCESS,
					siteId,
				} );
				dispatch( {
					type: JETPACK_CONNECT_USER_ALREADY_CONNECTED,
				} );
				if ( ! siteIsOnSitesList ) {
					debug( 'adding site to sites list' );
					dispatch( receiveSite( omit( accessibleSite, '_headers' ) ) );
				} else {
					debug( 'site is already on sites list' );
				}
			} )
			.catch( error => {
				dispatch( {
					type: SITE_REQUEST_FAILURE,
					siteId,
					error,
				} );
				debug( 'user is not connected from', error );
				if ( siteIsOnSitesList ) {
					debug( 'removing site from sites list', siteId );
					dispatch( receiveDeletedSite( siteId, true ) );
				}
			} );
	};
}

export function authorize( queryObject ) {
	return dispatch => {
		const {
			_wp_nonce,
			client_id,
			from,
			jp_version,
			redirect_uri,
			scope,
			secret,
			state,
		} = queryObject;
		debug( 'Trying Jetpack login.', _wp_nonce, redirect_uri, scope, state );
		dispatch( recordTracksEvent( 'calypso_jpc_authorize', { from, site: client_id } ) );
		dispatch( {
			type: JETPACK_CONNECT_AUTHORIZE,
			queryObject: queryObject,
		} );
		return wpcom
			.undocumented()
			.jetpackLogin( client_id, _wp_nonce, redirect_uri, scope, state )
			.then( data => {
				debug( 'Jetpack login complete. Trying Jetpack authorize.', data );
				dispatch( {
					type: JETPACK_CONNECT_AUTHORIZE_LOGIN_COMPLETE,
					data,
				} );
				return wpcom
					.undocumented()
					.jetpackAuthorize( client_id, data.code, state, redirect_uri, secret, jp_version );
			} )
			.then( data => {
				debug( 'Jetpack authorize complete. Updating sites list.', data );
				dispatch( {
					type: JETPACK_CONNECT_AUTHORIZE_RECEIVE,
					siteId: client_id,
					data: data,
					error: null,
				} );
				// Update the user now that we are fully connected.
				const user = userFactory();
				user.fetching = false;
				user.fetch();
				// Site may not be accessible yet, so force fetch from wpcom
				return wpcom.site( client_id ).get( {
					force: 'wpcom',
					fields: SITE_REQUEST_FIELDS,
					options: SITE_REQUEST_OPTIONS,
				} );
			} )
			.then( data => {
				dispatch(
					recordTracksEvent( 'calypso_jpc_auth_sitesrefresh', {
						site: client_id,
					} )
				);
				debug( 'Site updated', data );
				dispatch( {
					type: SITE_RECEIVE,
					site: data,
				} );
				dispatch( {
					type: JETPACK_CONNECT_AUTHORIZE_RECEIVE_SITE_LIST,
				} );
			} )
			.then( () => {
				dispatch(
					recordTracksEvent( 'calypso_jpc_authorize_success', {
						site: client_id,
						from,
					} )
				);
			} )
			.catch( error => {
				debug( 'Authorize error', error );
				dispatch(
					recordTracksEvent( 'calypso_jpc_authorize_error', {
						error_code: error.code,
						error_name: error.name,
						error_message: error.message,
						status: error.status,
						error: JSON.stringify( error ),
						site: client_id,
						from,
					} )
				);
				dispatch( {
					type: JETPACK_CONNECT_AUTHORIZE_RECEIVE,
					siteId: client_id,
					data: null,
					error: pick( error, [ 'error', 'status', 'message' ] ),
				} );
			} );
	};
}

export function validateSSONonce( siteId, ssoNonce ) {
	return dispatch => {
		debug( 'Attempting to validate SSO for ' + siteId );
		dispatch( {
			type: JETPACK_CONNECT_SSO_VALIDATION_REQUEST,
			siteId,
		} );

		return wpcom
			.undocumented()
			.jetpackValidateSSONonce( siteId, ssoNonce )
			.then( data => {
				dispatch( recordTracksEvent( 'calypso_jpc_validate_sso_success' ) );
				dispatch( {
					type: JETPACK_CONNECT_SSO_VALIDATION_SUCCESS,
					success: data.success,
					blogDetails: data.blog_details,
					sharedDetails: data.shared_details,
				} );
			} )
			.catch( error => {
				dispatch(
					recordTracksEvent( 'calypso_jpc_validate_sso_error', {
						error: error,
					} )
				);
				dispatch( {
					type: JETPACK_CONNECT_SSO_VALIDATION_ERROR,
					error: pick( error, [ 'error', 'status', 'message' ] ),
				} );
			} );
	};
}

export function authorizeSSO( siteId, ssoNonce, siteUrl ) {
	return dispatch => {
		debug( 'Attempting to authorize SSO for ' + siteId );
		dispatch( {
			type: JETPACK_CONNECT_SSO_AUTHORIZE_REQUEST,
			siteId,
		} );

		return wpcom
			.undocumented()
			.jetpackAuthorizeSSONonce( siteId, ssoNonce )
			.then( data => {
				dispatch( recordTracksEvent( 'calypso_jpc_authorize_sso_success' ) );
				dispatch( {
					type: JETPACK_CONNECT_SSO_AUTHORIZE_SUCCESS,
					ssoUrl: data.sso_url,
					siteUrl,
				} );
			} )
			.catch( error => {
				dispatch(
					recordTracksEvent( 'calypso_jpc_authorize_sso_error', {
						error: error,
					} )
				);
				dispatch( {
					type: JETPACK_CONNECT_SSO_AUTHORIZE_ERROR,
					error: pick( error, [ 'error', 'status', 'message' ] ),
				} );
			} );
	};
}

export function completeFlow( site ) {
	return dispatch => {
		clearPlan();
		dispatch( {
			type: JETPACK_CONNECT_COMPLETE_FLOW,
			site,
		} );
	};
}
