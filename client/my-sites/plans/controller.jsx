/**
 * External Dependencies
 */
import page from 'page';
import React from 'react';

/**
 * Internal Dependencies
 */
import { renderPage } from 'lib/react-helpers';
import get from 'lodash/get';
import { isValidFeatureKey } from 'lib/plans';

export default {
	plans( context ) {
		const Plans = require( 'my-sites/plans/main' ),
			CheckoutData = require( 'components/data/checkout' );

		renderPage(
			<CheckoutData>
				<Plans
					context={ context }
					intervalType={ context.params.intervalType }
					destinationType={ context.params.destinationType }
					selectedFeature={ context.query.feature }
				/>
			</CheckoutData>,
			context
		);
	},

	features( context ) {
		const domain = context.params.domain;
		const feature = get( context, 'params.feature' );
		let comparePath = domain ? `/plans/${ domain }` : '/plans/';

		if ( isValidFeatureKey( feature ) ) {
			comparePath += '?feature=' + feature;
		}

		// otherwise redirect to the compare page if not found
		page.redirect( comparePath );
	},

	redirectToCheckout( context ) {
		// this route is deprecated, use `/checkout/:site/:plan` to link to plan checkout
		page.redirect( `/checkout/${ context.params.domain }/${ context.params.plan }` );
	},

	redirectToPlans( context ) {
		const siteDomain = context.params.domain;

		if ( siteDomain ) {
			return page.redirect( `/plans/${ siteDomain }` );
		}

		return page.redirect( '/plans' );
	}
};
