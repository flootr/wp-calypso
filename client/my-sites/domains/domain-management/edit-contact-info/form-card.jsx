/**
 * External dependencies
 *
 * @format
 */

import PropTypes from 'prop-types';
import React from 'react';
import { deburr, endsWith, get, includes, isEqual, keys, omit, pick, snakeCase } from 'lodash';
import page from 'page';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import { localize } from 'i18n-calypso';

/**
 * Internal dependencies
 */
import Card from 'components/card';
import FormButton from 'components/forms/form-button';
import FormCountrySelect from 'my-sites/domains/components/form/country-select';
import FormFooter from 'my-sites/domains/domain-management/components/form-footer';
import FormStateSelect from 'my-sites/domains/components/form/state-select';
import FormInput from 'my-sites/domains/components/form/input';
import FormCheckbox from 'components/forms/form-checkbox';
import FormLabel from 'components/forms/form-label';
import ValidationErrorList from 'notices/validation-error-list';
import countriesListBuilder from 'lib/countries-list';
import formState from 'lib/form-state';
import notices from 'notices';
import paths from 'my-sites/domains/paths';
import upgradesActions from 'lib/upgrades/actions';
import wp from 'lib/wp';
import { successNotice } from 'state/notices/actions';
import support from 'lib/url/support';
import { registrar as registrarNames } from 'lib/domains/constants';
import DesignatedAgentNotice from 'my-sites/domains/domain-management/components/designated-agent-notice';
import Dialog from 'components/dialog';
import { getCurrentUser } from 'state/current-user/selectors';
import ContactDetailsFormFields from 'components/contact-details-form-fields';

const countriesList = countriesListBuilder.forDomainRegistrations();
const wpcom = wp.undocumented();

class EditContactInfoFormCard extends React.Component {
	static propTypes = {
		contactInformation: PropTypes.object.isRequired,
		selectedDomain: PropTypes.object.isRequired,
		selectedSite: PropTypes.oneOfType( [ PropTypes.object, PropTypes.bool ] ).isRequired,
		currentUser: PropTypes.object.isRequired,
	};

	constructor( props ) {
		super( props );

		this.state = {
			notice: null,
			formSubmitting: false,
			hasUnmounted: false,
			transferLock: true,
			showNonDaConfirmationDialog: false,
			hasEmailChanged: false,
		};
	}

	componentWillMount() {
		this.setState( {
			hasUnmounted: false,
			transferLock: true,
		} );
	}

	componentWillUnmount() {
		this.setState( {
			hasUnmounted: true,
		} );
	}

	validate = ( fieldValues, onComplete ) => {
		wpcom.validateDomainContactInformation(
			fieldValues,
			[ this.props.selectedDomain.name ],
			( error, data ) => {
				if ( error ) {
					onComplete( error );
				} else {
					onComplete( null, data.messages || {} );
				}
			}
		);
	};

	requiresConfirmation() {
		const { firstName, lastName, organization, email } = this.props.contactInformation,
			isWwdDomain = this.props.selectedDomain.registrar === registrarNames.WWD,
			primaryFieldsChanged = ! (
				firstName === formState.getFieldValue( this.state.form, 'first-name' ) &&
				lastName === formState.getFieldValue( this.state.form, 'last-name' ) &&
				organization === formState.getFieldValue( this.state.form, 'organization' ) &&
				email === formState.getFieldValue( this.state.form, 'email' )
			);
		return isWwdDomain && primaryFieldsChanged;
	}

	handleDialogClose = () => {
		this.setState( { showNonDaConfirmationDialog: false } );
	};

	renderTransferLockOptOut() {
		return (
			<div>
				<FormLabel>
					<FormCheckbox
						name="transfer-lock-opt-out"
						disabled={ this.state.formSubmitting }
						onChange={ this.onTransferLockOptOutChange }
					/>
					<span>
						{ this.props.translate( 'Opt-out of the {{link}}60-day transfer lock{{/link}}.', {
							components: {
								link: (
									<a
										href={ support.UPDATE_CONTACT_INFORMATION }
										target="_blank"
										rel="noopener noreferrer"
									/>
								),
							},
						} ) }
					</span>
				</FormLabel>
			</div>
		);
	}

	renderBackupEmail() {
		const currentEmail = this.props.contactInformation.email,
			wpcomEmail = this.props.currentUser.email,
			strong = <strong />;

		return (
			<p>
				{ this.props.translate(
					'If you don’t have access to {{strong}}%(currentEmail)s{{/strong}}, ' +
						'we will also email you at {{strong}}%(wpcomEmail)s{{/strong}}, as backup.',
					{
						args: { currentEmail, wpcomEmail },
						components: { strong },
					}
				) }
			</p>
		);
	}

	renderDialog() {
		const { translate } = this.props,
			strong = <strong />,
			buttons = [
				{
					action: 'cancel',
					label: this.props.translate( 'Cancel' ),
				},
				{
					action: 'confirm',
					label: this.props.translate( 'Request Confirmation' ),
					onClick: this.saveContactInfo,
					isPrimary: true,
				},
			],
			currentEmail = this.props.contactInformation.email,
			wpcomEmail = this.props.currentUser.email;

		let text;
		if ( this.state.hasEmailChanged ) {
			const newEmail = formState.getFieldValue( this.state.form, 'email' );

			text = translate(
				'We’ll email you at {{strong}}%(oldEmail)s{{/strong}} and {{strong}}%(newEmail)s{{/strong}} ' +
					'with a link to confirm the new details. The change won’t go live until we receive confirmation from both emails.',
				{ args: { oldEmail: currentEmail, newEmail }, components: { strong } }
			);
		} else {
			text = translate(
				'We’ll email you at {{strong}}%(currentEmail)s{{/strong}} with a link to confirm the new details. ' +
					"The change won't go live until we receive confirmation from this email.",
				{ args: { currentEmail }, components: { strong } }
			);
		}
		return (
			<Dialog
				isVisible={ this.state.showNonDaConfirmationDialog }
				buttons={ buttons }
				onClose={ this.handleDialogClose }
			>
				<h1>{ translate( 'Confirmation Needed' ) }</h1>
				<p>{ text }</p>
				{ currentEmail !== wpcomEmail && this.renderBackupEmail() }
			</Dialog>
		);
	}

	render() {
		const { translate } = this.props;
		const saveButtonLabel = translate( 'Save Contact Info' );
		const canUseDesignatedAgent = this.props.selectedDomain.transferLockOnWhoisUpdateOptional;
		const currentContactInformation = formState.getAllFieldValues( this.state.form );
		const initialContactInformation = pick(
			this.props.contactInformation,
			keys( currentContactInformation )
		);
		const contactInformation = omit( this.props.contactInformation, [
			'countryName',
			'stateName',
		] );
		const isSaveButtonDisabled =
			this.state.formSubmitting || isEqual( initialContactInformation, currentContactInformation );

		return (
			<Card>
				<form>
					<ContactDetailsFormFields
						contactDetails={ contactInformation }
						needsFax={ this.needsFax() }
						onFieldChange={ this.handleContactDetailsChange }
						onSubmit={ this.handleSubmitButtonClick }
						eventFormName="Checkout Form"
						onValidate={ this.validate }
						submitText={ saveButtonLabel }
						onCancel={ this.goToContactsPrivacy }
					>
						{ canUseDesignatedAgent && this.renderTransferLockOptOut() }
						{ canUseDesignatedAgent && (
							<DesignatedAgentNotice saveButtonLabel={ saveButtonLabel } />
						) }
					</ContactDetailsFormFields>
				</form>
				{ this.renderDialog() }
			</Card>
		);
	}

	needsFax() {
		const NETHERLANDS_TLD = '.nl';

		return (
			endsWith( this.props.selectedDomain.name, NETHERLANDS_TLD ) ||
			this.props.contactInformation.fax
		);
	}

	handleContactDetailsChange = newContactDetails => {
		this.setState( {
			hasEmailChanged: this.props.contactInformation.email !== newContactDetails.email,
		} );
	};

	onTransferLockOptOutChange = event => {
		this.setState( { transferLock: ! event.target.checked } );
	};

	goToContactsPrivacy = () => {
		page(
			paths.domainManagementContactsPrivacy(
				this.props.selectedSite.slug,
				this.props.selectedDomain.name
			)
		);
	};

	saveContactInfo = event => {
		event.preventDefault && event.preventDefault();

		if ( this.state.formSubmitting ) {
			return;
		}

		this.setState( {
			formSubmitting: true,
			showNonDaConfirmationDialog: false,
		} );

		this.formStateController.handleSubmit( hasErrors => {
			if ( hasErrors ) {
				this.setState( { formSubmitting: false } );
				return;
			}
			upgradesActions.updateWhois(
				this.props.selectedDomain.name,
				formState.getAllFieldValues( this.state.form ),
				this.state.transferLock,
				this.onWhoisUpdate
			);
		} );
	};

	showNonDaConfirmationDialog = event => {
		event.preventDefault();
		this.setState( { showNonDaConfirmationDialog: true } );
	};

	onWhoisUpdate = ( error, data ) => {
		this.setState( { formSubmitting: false } );
		if ( data && data.success ) {
			if ( ! this.requiresConfirmation() ) {
				this.props.successNotice(
					this.props.translate(
						'The contact info has been updated. ' +
							'There may be a short delay before the changes show up in the public records.'
					)
				);
				return;
			}

			const currentEmail = this.props.contactInformation.email,
				strong = <strong />;
			let message;

			if ( this.state.hasEmailChanged() ) {
				const newEmail = formState.getFieldValue( this.state.form, 'email' );

				message = this.props.translate(
					'Emails have been sent to {{strong}}%(oldEmail)s{{/strong}} and {{strong}}%(newEmail)s{{/strong}}. ' +
						"Please ensure they're both confirmed to finish this process.",
					{
						args: { oldEmail: currentEmail, newEmail },
						components: { strong },
					}
				);
			} else {
				message = this.props.translate(
					'An email has been sent to {{strong}}%(email)s{{/strong}}. ' +
						'Please confirm it to finish this process.',
					{
						args: { email: currentEmail },
						components: { strong },
					}
				);
			}

			this.props.successNotice( message );
		} else if ( error && error.message ) {
			notices.error( error.message );
		} else {
			notices.error(
				this.props.translate(
					'There was a problem updating your contact info. ' +
						'Please try again later or contact support.'
				)
			);
		}
	};
}

export default connect(
	state => ( { currentUser: getCurrentUser( state ) } ),
	dispatch => bindActionCreators( { successNotice }, dispatch )
)( localize( EditContactInfoFormCard ) );
