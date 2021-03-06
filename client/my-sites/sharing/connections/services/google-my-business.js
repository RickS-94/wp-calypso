/** @format */

/**
 * External dependencies
 */
import React from 'react';
import PropTypes from 'prop-types';
import { last, isEqual, memoize } from 'lodash';

/**
 * Internal dependencies
 */
import { deleteStoredKeyringConnection } from 'state/sharing/keyring/actions';
import { SharingService, connectFor } from 'my-sites/sharing/connections/service';

export class GoogleMyBusiness extends SharingService {
	static propTypes = {
		...SharingService.propTypes,
		deleteStoredKeyringConnection: PropTypes.func,
	};

	static defaultProps = {
		...SharingService.defaultProps,
		deleteStoredKeyringConnection: () => {},
	};

	// override `createOrUpdateConnection` to ignore connection update, this is only useful for publicize services
	createOrUpdateConnection = () => {};

	// override `removeConnection` to remove the keyring connection instead of the publicize one
	removeConnection = () => {
		this.setState( { isDisconnecting: true } );
		this.props.deleteStoredKeyringConnection( last( this.props.keyringConnections ) );
	};

	componentWillReceiveProps( { availableExternalAccounts } ) {
		if ( ! isEqual( this.props.availableExternalAccounts, availableExternalAccounts ) ) {
			this.setState( {
				isConnecting: false,
				isDisconnecting: false,
			} );
		}

		if ( ! this.state.isAwaitingConnections ) {
			return;
		}

		this.setState( {
			isAwaitingConnections: false,
			isRefreshing: false,
		} );

		if ( this.didKeyringConnectionSucceed( availableExternalAccounts ) ) {
			this.setState( { isConnecting: false } );
			this.props.successNotice(
				this.props.translate( 'The %(service)s account was successfully connected.', {
					args: { service: this.props.service.label },
					context: 'Sharing: Publicize connection confirmation',
				} ),
				{ id: 'publicize' }
			);
		}
	}

	/*
	 * We render a custom logo here because Google My Business is not part of SocialLogos
	 */
	renderLogo() {
		return (
			/* eslint-disable wpcalypso/jsx-classname-namespace */
			/* eslint-disable max-len */
			<svg
				className="sharing-service__logo"
				style={ { padding: 6 + 'px' } }
				version="1.1"
				height="36"
				width="36"
				viewBox="0 0 512 512"
			>
				<path
					fill="#518EF8"
					d="M481.241,201.453v248.419c0,16.544-13.392,29.948-29.948,29.948H60.694
					c-16.544,0-29.948-13.405-29.948-29.948V201.453c9.327,5.519,20.21,8.683,31.826,8.683c15.823,0,30.386-5.905,41.487-15.733
					c11.102-9.815,18.718-23.58,20.634-39.275l2.135-17.547c-0.309,2.637-0.476,5.274-0.476,7.86c0,35.21,28.623,64.695,64.823,64.695
					c35.801,0,64.823-29.022,64.823-64.81c0,35.789,29.009,64.81,64.81,64.81c36.226,0,64.836-29.485,64.836-64.72
					c0-2.56-0.154-5.146-0.476-7.77l2.135,17.483c1.917,15.694,9.532,29.459,20.622,39.275c11.102,9.828,25.677,15.733,41.487,15.733
					C461.032,210.137,471.915,206.972,481.241,201.453z"
				/>
				<path
					fill="#4786E2"
					d="M481.241,250.385v30.012c-9.327,5.519-20.21,8.683-31.826,8.683c-15.81,0-30.385-5.905-41.487-15.733
					c-11.089-9.815-18.705-23.58-20.622-39.275l-2.135-17.483c0.322,2.624,0.476,5.21,0.476,7.77c0,35.235-28.61,64.72-64.836,64.72
					c-35.801,0-64.81-29.022-64.81-64.81c0,35.789-29.022,64.81-64.823,64.81c-36.2,0-64.823-29.485-64.823-64.695
					c0-2.586,0.167-5.223,0.476-7.86l-2.135,17.547c-1.917,15.694-9.532,29.459-20.634,39.275
					c-11.102,9.828-25.664,15.733-41.487,15.733c-11.616,0-22.5-3.165-31.826-8.683v-30.012c9.327,5.519,20.21,8.683,31.826,8.683
					c15.823,0,30.386-5.905,41.487-15.733c11.102-9.815,18.718-23.58,20.634-39.275l2.135-17.547c-0.309,2.637-0.476,5.274-0.476,7.86
					c0,35.21,28.623,64.695,64.823,64.695c35.801,0,64.823-29.022,64.823-64.81c0,35.789,29.009,64.81,64.81,64.81
					c36.226,0,64.836-29.485,64.836-64.72c0-2.56-0.154-5.146-0.476-7.77l2.135,17.483c1.917,15.694,9.532,29.459,20.622,39.275
					c11.102,9.828,25.677,15.733,41.487,15.733C461.032,259.069,471.915,255.904,481.241,250.385z"
				/>
				<g>
					<path
						fill="#ACD1FC"
						d="M385.171,188.508c0.322,2.624,0.476,5.21,0.476,7.77c0,35.235-28.61,64.72-64.836,64.72
						c-35.801,0-64.81-29.022-64.81-64.81l-30.874-75.351L256,32.179h110.119l33.104,88.76l-14.065,67.401
						C385.171,188.392,385.171,188.457,385.171,188.508z"
					/>
					<path
						fill="#ACD1FC"
						d="M145.869,32.181l28.658,97.416l-47.684,58.744v0.001l-2.148,17.649
						c-1.917,15.694-9.532,29.459-20.634,39.275c-11.102,9.828-25.664,15.733-41.487,15.733c-11.616,0-22.5-3.165-31.826-8.683v-0.013
						C12.337,241.419,0,221.363,0,198.426v-4.644L42.621,47.816c2.705-9.266,11.201-15.635,20.854-15.635H145.869z"
					/>
				</g>
				<g>
					<path
						fill="#3A5BBC"
						d="M481.241,252.315c-9.327,5.519-20.21,8.683-31.826,8.683c-15.81,0-30.385-5.905-41.487-15.733
						c-11.089-9.815-18.705-23.58-20.622-39.275l-2.135-17.483c0-0.051,0-0.116-0.013-0.167l-19.039-156.16h82.395
						c9.652,0,18.148,6.369,20.854,15.634L512,193.782v4.644C512,221.363,499.65,241.419,481.241,252.315z"
					/>
					<path
						fill="#3A5BBC"
						d="M256,32.181v164.007c0,35.789-29.022,64.81-64.823,64.81c-36.2,0-64.823-29.485-64.823-64.695
						c0-2.586,0.167-5.223,0.476-7.86c0-0.039,0.013-0.064,0.013-0.103l19.026-156.16H256z"
					/>
				</g>
				<path
					fill="#FFFFFF"
					d="M384.708,445.486c-35.481,0-64.347-28.866-64.347-64.347s28.866-64.347,64.347-64.347
					c17.194,0,33.356,6.692,45.506,18.841l-13.644,13.644c-8.506-8.506-19.821-13.19-31.861-13.19
					c-24.841,0-45.051,20.209-45.051,45.051c0,24.842,20.21,45.051,45.051,45.051c21.53,0,39.581-15.182,44.01-35.403h-44.011v-19.296
					h64.347v9.648C449.055,416.619,420.189,445.486,384.708,445.486z"
				/>
			</svg>
		);
	}
}

const addKeyringConnectionIdToConnections = memoize( connections =>
	connections.map( connection => ( {
		...connection,
		keyring_connection_ID: connection.ID,
	} ) )
);

export default connectFor(
	GoogleMyBusiness,
	( state, props ) => {
		return {
			...props,
			removableConnections: props.keyringConnections,
			fetchConnection: props.requestKeyringConnections,
			siteUserConnections: addKeyringConnectionIdToConnections( props.keyringConnections ),
		};
	},
	{
		deleteStoredKeyringConnection,
	}
);
