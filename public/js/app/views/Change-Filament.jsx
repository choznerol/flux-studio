define([
    'jquery',
    'react',
    'helpers/i18n',
    'helpers/shortcuts',
    'jsx!widgets/Modal',
    'jsx!widgets/Alert',
    'helpers/device-master',
    'app/constants/device-constants',
    'app/actions/alert-actions',
    'app/stores/alert-store',
    'helpers/firmware-version-checker',
    'app/version-requirement',
    'helpers/device-error-handler',
    'helpers/check-device-status'
], function(
    $,
    React,
    i18n,
    shortcuts,
    Modal,
    Alert,
    DeviceMaster,
    DeviceConstants,
    AlertActions,
    AlertStore,
    FirmwareVersionChecker,
    Requirement,
    DeviceErrorHandler,
    CheckDeviceStatus
) {
    'use strict';

    var lang = i18n.get(),
        maxTemperature = 220,
        steps = {
            HOME      : 'HOME',
            GUIDE     : 'GUIDE',
            HEATING   : 'HEATING',
            EMERGING  : 'EMERGING',
            UNLOADING : 'UNLOADING',
            COMPLETED : 'COMPLETED'
        },
        View = React.createClass({

            propTypes: {
                open    : React.PropTypes.bool,
                device  : React.PropTypes.object,
                src     : React.PropTypes.string,
                onClose : React.PropTypes.func
            },

            getDefaultProps: function() {
                return {
                    open    : false,
                    device  : {},
                    onClose : function() {}
                };
            },

            getInitialState: function() {
                return {
                    type: this.props.src === 'TUTORIAL' ? DeviceConstants.LOAD_FILAMENT : '',
                    currentStep: this.props.src === 'TUTORIAL' ? steps.GUIDE : steps.HOME,
                    temperature: '-'
                };
            },

            componentWillUpdate: function(nextProps, nextState) {
                if (true === nextProps.open && false === this.props.open) {
                    this.setState(this.getInitialState());
                }
            },

            componentDidMount: function() {
                if (true === this.props.open) {
                    if(this.props.src === 'TUTORIAL') {
                        DeviceMaster.selectDevice(this.props.device).then((status) => {
                            if (status !== DeviceConstants.CONNECTED) {
                                // alert and close
                                AlertActions.showPopupError('change-filament', status);
                            }
                        });
                    }
                    else {
                        let selectedDevice = DeviceMaster.getSelectedDevice();
                        if(selectedDevice.uuid !== this.props.device.uuid) {
                            DeviceMaster.selectDevice(this.props.device).then(function(status) {
                                if (status !== DeviceConstants.CONNECTED) {
                                    // alert and close
                                    AlertActions.showPopupError('change-filament', status);
                                }
                            });
                        }
                    }

                    if(this.props.src !== 'TUTORIAL') {
                        AlertStore.onCancel(this._onCancel);
                    }
                }
            },

            componentWillUnmount: function() {
                AlertStore.removeCancelListener(this._onCancel);
                this._onClose();
                this._checkAndStopChangeFilamentDuringPause();
            },

            shouldComponentUpdate: function(nextProps, nextState) {
                if(this.state.currentStep === nextState.currentStep && this.state.temperature === nextState.temperature) {
                    return false;
                }

                if (steps.HEATING === nextState.currentStep && steps.HEATING !== this.state.currentStep) {
                    this._goMaintain(nextState.type);
                }

                return true;
            },

            _onCancel: function(id) {
                // go back to the beginning
                this.setState(this.getInitialState());
                this._checkAndStopChangeFilamentDuringPause();
            },

            _checkAndStopChangeFilamentDuringPause: function() {
                // if change filament during pause operation
                if(this.isChangingFilamentDuringPause === true) {
                    clearInterval(this.changeFilamentDuringPauseTimer);
                    DeviceMaster.endToolheadOperation();
                }
                else {
                    DeviceMaster.quitTask();
                }
            },

            _handleCancelJob: function(e) {
                e.preventDefault();
                if(this.isChangingFilamentDuringPause !== true) {
                    DeviceMaster.killSelf();
                }
                else {
                    DeviceMaster.endLoadingDuringPause();
                }
                this._onCancel(e);
            },

            _goMaintain: function(type) {
                var self = this,
                    nextStep = (self.state.type === DeviceConstants.LOAD_FILAMENT ? steps.EMERGING : steps.UNLOADING),
                    progress = function(response) {
                        switch (response.stage[1]) {
                        case 'WAITTING':
                        case 'WAITING':
                        case 'LOADING':
                            self._next(steps.EMERGING, DeviceConstants.LOAD_FILAMENT);
                            if(self.state.loading_status !== response.stage[1]) {
                                self.setState({ loading_status: response.stage[1] });
                                self.forceUpdate();
                            }
                            break;
                        case 'UNLOADING':
                            self._next(steps.UNLOADING);
                            break;
                        default:
                            if(response.error) {
                                if(response.error[0] === 'KICKED') {
                                    self.setState(self.getInitialState());
                                }
                            }
                            else {
                                // update temperature
                                self.setState({
                                    temperature: response.temperature || 220
                                });
                            }
                            break;
                        }
                    },
                    done = function(response) {
                        DeviceMaster.quitTask().done(function() {
                            self._next(steps.COMPLETED);
                        });
                    },
                    errorMessageHandler = (response) => {
                        if(typeof response.error === 'string') {
                            response.error = [response.error];
                        }

                        var messageMap = lang.monitor,
                            allJoinedMessage = response.error.join('_'),
                            genericMessage = response.error.slice(0, 2).join('_');

                        DeviceMaster.quitTask();

                        // has default
                        if (true === messageMap.hasOwnProperty(genericMessage)) {
                            if(response.error.length === 4) {
                                // TODO FIX Toolhead not found
                                if(response.error[3] === 'N/A') {
                                    AlertActions.showPopupError('change-filament-device-error', DeviceErrorHandler.translate(['HEAD_ERROR','HEAD_OFFLINE']));
                                }
                            }
                            else {
                                AlertActions.showPopupError(genericMessage, messageMap[genericMessage]);
                            }
                        }
                        // wrong toolhead
                        else if ('TYPE_ERROR' === response.error[1]) {
                            AlertActions.showPopupError('change-filament-device-error', DeviceErrorHandler.translate(['HEAD_ERROR','HEAD_OFFLINE']));
                        }
                        // default
                        else {
                            AlertActions.showPopupError('change-filament-device-error', DeviceErrorHandler.translate(response.error));
                        }
                    };

                DeviceMaster.selectDevice(self.props.device).then(() => {
                    return DeviceMaster.getReport();
                })
                .then(report => {
                    // if changing filament during pause
                    if(report.st_id === 48) {
                        this.isChangingFilamentDuringPause = true;

                        DeviceMaster.changeFilamentDuringPause(type)
                        .progress((p, t) => {
                            this.changeFilamentDuringPauseTimer = t;
                            p.device_status = p.device_status || {};    // sometimes backend is not passing device_status property

                            if(p.device_status.tt && p.device_status.rt) {
                                maxTemperature = p.device_status.tt[0];
                                if(p.device_status.rt) {
                                    this.setState({
                                        type: type,
                                        temperature: p.device_status.rt[0]
                                    });
                                }
                            }

                            // change to emerging when temperature is reached
                            if(type === 'LOAD' && this.state.currentStep !== steps.EMERGING) {
                                if(p.loading === true) {
                                    this.setState({
                                        currentStep: steps.EMERGING
                                    });
                                }
                            }
                        })
                        .then(() => {
                            this.setState({ currentStep: steps.COMPLETED });
                        });
                    }
                    // regular change filament
                    else {
                        DeviceMaster.changeFilament(type).progress(progress).done(done).fail(function(response) {
                            if ('RESOURCE_BUSY' === response.error[0]) {
                                AlertActions.showDeviceBusyPopup('change-filament-device-busy');
                            }
                            else if ('TIMEOUT' === response.error[0]) {
                                DeviceMaster.closeConnection();
                                AlertActions.showPopupError('change-filament-toolhead-no-response', lang.change_filament.toolhead_no_response);
                                self.props.onClose();
                            }
                            else if (response.error[1] === 'TYPE_ERROR' || response.info === 'TYPE_ERROR') {
                                if (response.error[3] === 'N/A') {
                                    AlertActions.showPopupError('change-filament-device-error', DeviceErrorHandler.translate(['HEAD_ERROR','HEAD_OFFLINE']));
                                } else {
                                    AlertActions.showPopupError('change-filament-device-error', DeviceErrorHandler.translate(['HEAD_ERROR','TYPE_ERROR']));
                                }
                                DeviceMaster.quitTask().then(function() {
                                    self.setState({ currentStep: steps.GUIDE });
                                });
                            }
                            else if ('UNKNOWN_COMMAND' === response.error[0]) {
                                AlertActions.showDeviceBusyPopup('change-filament-zombie', lang.change_filament.maintain_zombie);
                            }
                            else if ('KICKED' === response.error[0]) {
                                // self.props.onClose();
                            }
                            else {
                                errorMessageHandler(response);
                            }
                        });
                    }
                });
            },

            _onClose: function(e) {
                this.props.onClose(e);
                React.unmountComponentAtNode(this.refs.modal.getDOMNode().parentNode);
            },

            _next: function(nextStep, type) {
                if(nextStep !== this.state.currentStep) {
                    this.setState({
                        type: type || this.state.type,
                        currentStep: nextStep
                    });
                }
            },

            _loadFilamentFromComplete: function() {
                this.setState(this.getInitialState(), () => {
                    this._next(steps.GUIDE, DeviceConstants.LOAD_FILAMENT);
                });
            },

            _makeCaption: function(caption) {
                if ('undefined' === typeof caption) {
                    caption = (
                        DeviceConstants.LOAD_FILAMENT === this.state.type ?
                        lang.change_filament.load_filament :
                        lang.change_filament.unload_filament
                    );
                }

                return caption + ' - ' + (this.props.device.name || '');
            },

            // sections
            _sectionHome: function() {
                return {
                    caption: lang.change_filament.home_caption,
                    message: (
                        <div className="way-to-go">
                            <button
                                className="btn btn-default"
                                data-ga-event="load-filament"
                                onClick={this._next.bind(null, steps.GUIDE, DeviceConstants.LOAD_FILAMENT)}
                            >
                                {lang.change_filament.load_filament_caption}
                            </button>
                            <button
                                className="btn btn-default"
                                data-ga-event="unload-filament"
                                onClick={this._next.bind(null, steps.HEATING, DeviceConstants.UNLOAD_FILAMENT)}
                            >
                                {lang.change_filament.unload_filament_caption}
                            </button>
                        </div>
                    ),
                    buttons: [{
                        label: lang.change_filament.cancel,
                        className: 'btn-default btn-alone-left',
                        dataAttrs: {
                            'ga-event': 'cancel'
                        },
                        onClick: this.props.onClose
                    }]
                };
            },

            _sectionGuide: function() {
                var activeLang = i18n.getActiveLang(),
                    imageSrc = (
                        'en' === activeLang ?
                        '/img/insert-filament-en.png' :
                        '/img/insert-filament-zh-tw.png'
                    );

                return {
                    message: (
                        <img className="guide-image" src={imageSrc}/>
                    ),
                    buttons: [{
                        label: lang.change_filament.cancel,
                        dataAttrs: {
                            'ga-event': 'cancel'
                        },
                        onClick: this.props.onClose
                    },
                    {
                        label: lang.change_filament.next,
                        dataAttrs: {
                            'ga-event': 'heatup'
                        },
                        onClick: this._next.bind(null, steps.HEATING, '')
                    }]
                };
            },

            _sectionHeating: function() {
                let { temperature, targetTemperature } = this.state;

                return {
                    message: (
                        <div className="message-container">
                            <p className="temperature">
                                <span>{lang.change_filament.heating_nozzle}</span>
                                <span>{temperature} / {targetTemperature || maxTemperature}°C</span>
                            </p>
                            <div className="spinner-roller spinner-roller-reverse"/>
                        </div>
                    ),
                    buttons: [
                        {
                            label: lang.change_filament.cancel,
                            onClick: this._handleCancelJob
                        }
                    ]
                };
            },

            _sectionEmerging: function() {
                var self = this,
                    activeLang = i18n.getActiveLang(),
                    imageSrc, message, buttons;

                imageSrc = (
                    'en' === activeLang ?
                    '/img/press-to-accelerate-en.png' :
                    '/img/press-to-accelerate-zh-tw.png'
                );

                message = (
                    <div className="message-container">
                        <img className="guide-image" src={imageSrc}/>
                    </div>
                );

                buttons = [
                    {
                        label: 'ok',
                        className: 'btn-default btn-alone-right',
                        onClick: function(e) {
                            self.setState({
                                type: type || this.state.type,
                                currentStep: steps.COMPLETED
                            });
                        }
                    },
                    {
                        label: lang.change_filament.cancel,
                        className: 'btn-default btn-alone-left',
                        onClick: function(e) {
                            self._handleCancelJob(e);
                        }
                    },
                    {
                        label: [
                            <span className="auto-emerging">
                                {this.state.loading_status === 'WAITING' ?
                                    lang.change_filament.auto_emerging :
                                    lang.change_filament.loading_filament
                                }
                            </span>,
                            <div className="spinner-roller spinner-roller-reverse"/>
                        ],
                        type: 'icon',
                        className: 'btn-icon',
                        onClick: function(e) {
                            e.preventDefault();
                        }
                    }
                ];

                return { message, buttons };
            },

            _sectionUnloading: function() {
                return {
                    message: (
                        <div className="message-container">
                            <p>{lang.change_filament.unloading}</p>
                            <div className="spinner-roller spinner-roller-reverse"/>
                        </div>
                    ),
                    buttons: []
                };
            },

            _sectionCompleted: function() {
                let loaded, unloaded;

                loaded = (<div className="message-container">{lang.change_filament.loaded}</div>);

                unloaded = (
                    <div className="message-container">{lang.change_filament.unloaded}
                        <p>
                            <a onClick={this._loadFilamentFromComplete}>
                                {lang.change_filament.load_filament}
                            </a>
                        </p>
                    </div>
                );

                return {
                    message: (
                        this.state.type === DeviceConstants.LOAD_FILAMENT ? loaded : unloaded
                    ),
                    buttons: [{
                        label: lang.change_filament.ok,
                        className: 'btn-default btn-alone-right',
                        dataAttrs: {
                            'ga-event': 'completed'
                        },
                        onClick: this.props.onClose
                    }]
                };
            },

            _sectionFactory: function() {
                var self = this,
                    renderFunc,
                    renderName = this.state.currentStep.toLowerCase().split('');

                renderName[0] = renderName[0].toUpperCase();
                renderName = '_section' + renderName.join('').replace('_', '');

                if(this.state.currentStep === steps.COMPLETED) {
                    renderName = '_sectionCompleted';
                }
                else if(this.state.temperature === 220) {
                    renderName = '_sectionEmerging';
                }

                if (true === self.hasOwnProperty(renderName)) {
                    renderFunc = self[renderName];
                }
                else {
                    renderFunc = function() {
                        return {
                            buttons: [{
                                label: lang.change_filament.cancel,
                                className: 'btn-default btn-alone-left',
                                dataAttrs: {
                                    'ga-event': 'cancel'
                                },
                                onClick: self.props.onClose
                            }]
                        };
                    };
                }

                return renderFunc();
            },

            render: function() {
                if(false === this.props.open) {
                    return (<div/>);
                }

                var section = this._sectionFactory(),
                    content = (
                        <Alert
                            lang={lang}
                            caption={this._makeCaption(section.caption)}
                            message={section.message}
                            buttons={section.buttons}
                        />
                    ),
                    className = {
                        'modal-change-filament': true,
                        'shadow-modal': true
                    };

                return (
                    <div className="always-top" ref="modal">
                        <Modal className={className} content={content} disabledEscapeOnBackground={false}/>
                    </div>
                );
            }

        });

    return View;
});
