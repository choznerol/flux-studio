define([
    'react',
    'jquery',
    'jsx!widgets/Select',
    'jsx!widgets/List',
    'helpers/api/discover',
    'helpers/device-master',
    'helpers/i18n',
    'helpers/api/touch',
    'helpers/api/config',
    'app/constants/device-constants',
    'app/actions/alert-actions',
    'app/actions/initialize-machine',
    'app/stores/alert-store',
    'app/actions/progress-actions',
    'app/constants/progress-constants',
    'app/actions/input-lightbox-actions',
    'app/constants/input-lightbox-constants'
], function(
    React,
    $,
    SelectView,
    ListView,
    discover,
    DeviceMaster,
    i18n,
    touch,
    config,
    DeviceConstants,
    AlertActions,
    initializeMachine,
    AlertStore,
    ProgressActions,
    ProgressConstants,
    InputLightboxActions,
    InputLightboxConstants
) {
    'use strict';

    var View = React.createClass({
        displayName: 'PrinterSelection',
        selected_printer: null,

        propTypes: {
            onClose: React.PropTypes.func,
            onGettingPrinter: React.PropTypes.func
        },

        getDefaultProps: function() {
            return {
                uniqleId: '',
                lang: i18n.get(),
                className: '',
                onGettingPrinter: function() {},
                onClose: function() {}
            };
        },

        getInitialState: function() {
            return {
                discoverId: 'printer-selector-' + (this.props.uniqleId || ''),
                printOptions: [],
                loadFinished: false,
                noDefaultPrinter: ('undefined' === typeof initializeMachine.defaultPrinter.get().uuid),
                discoverMethods: {}
            };
        },

        componentDidMount: function() {
            if (false === this.state.noDefaultPrinter) {
                this.selected_printer = initializeMachine.defaultPrinter.get();
                this._returnSelectedPrinter();
            }
        },

        _selectPrinter: function(printer, e) {
            e.preventDefault();

            var self = this,
                lang = self.props.lang.select_printer,
                onError = function() {
                    ProgressActions.close();
                    InputLightboxActions.open('auth-device', {
                        type         : InputLightboxConstants.TYPE_PASSWORD,
                        caption      : lang.notification,
                        inputHeader  : lang.please_enter_password,
                        confirmText  : lang.submit,
                        onSubmit     : function(password) {
                            ProgressActions.open(ProgressConstants.NONSTOP);

                            self._auth(printer.uuid, password, {
                                onError: function() {
                                    AlertActions.showPopupError('device-auth-fail', lang.auth_failure);
                                }
                            });
                        }
                    });
                },
                opts = {
                    onError: onError
                };

            self.selected_printer = printer;

            self._auth(printer.uuid, '', opts);
        },

        _auth: function(uuid, password, opts) {
            ProgressActions.open(ProgressConstants.NONSTOP);
            opts = opts || {};
            opts.onError = opts.onError || function() {};

            var self = this,
                _opts = {
                    onSuccess: function(data) {
                        self._returnSelectedPrinter();
                    },
                    onFail: function(data) {
                        ProgressActions.close();
                        opts.onError();
                    }
                },
                touch_socket;

            touch_socket = touch(_opts).send(uuid, password);
        },

        _handleClose: function(e) {
            this.props.onClose();
        },

        // renders
        _renderPrinterSelection: function(lang) {
            var self = this,
                options = self.state.printOptions,
                content = (
                    <div className="device-wrapper">
                        <ListView className="printer-list" items={options}/>
                    </div>
                );

            return content;
        },

        _returnSelectedPrinter: function() {
            var self = this;

            if ('00000000000000000000000000000000' === self.selected_printer.uuid) {
                self.props.onGettingPrinter(self.selected_printer);
                ProgressActions.close();
            }
            else {
                DeviceMaster.selectDevice(self.selected_printer).then(function(status) {
                    if (status === DeviceConstants.CONNECTED) {
                        self.props.onGettingPrinter(self.selected_printer);
                        ProgressActions.close();
                    }
                    else if (status === DeviceConstants.TIMEOUT) {
                        AlertActions.showPopupError('printer-selector', lang.message.connectionTimeout);
                    }
                });
            }

        },

        _renderPrinterItem: function(printer) {
            var meta,
                lang = this.props.lang,
                status = lang.machine_status,
                headModule = lang.head_module,
                statusText = status[printer.st_id] || status.UNKNOWN,
                headText = headModule[printer.head_module] || headModule.UNKNOWN;

            if (16 === printer.st_id && 'number' === typeof printer.st_prog) {
                statusText += ' - ' + (parseInt(printer.st_prog * 1000) * 0.1).toFixed(1) + '%';
            }

            try {
                meta = JSON.stringify(printer);
            }
            catch (ex) {
                console.log(ex, printer);
            }

            return (
                <label className="device printer-item" data-meta={meta} onClick={this._selectPrinter.bind(null, printer)}>
                    <input type="radio" name="printer-group" value={printer.uuid}/>
                    <div className="col device-name">{printer.name}</div>
                    <div className="col module">{headText}</div>
                    <div className="col status">{statusText}</div>
                </label>
            );
        },

        render: function() {
            var self = this,
                lang = self.props.lang,
                showPassword = self.state.showPassword,
                cx = React.addons.classSet,
                wrapperClass = ['select-printer'],
                content = self._renderPrinterSelection(lang),
                noDefaultPrinter = self.state.noDefaultPrinter;

            if ('string' === typeof self.props.className) {
                wrapperClass.push(self.props.className);
            }

            wrapperClass = cx.apply(null, wrapperClass);

            return (
                true === noDefaultPrinter ?
                <div className={wrapperClass}>
                    {content}
                    <div className="arrow arrow-right"/>
                </div> :
                <span/>
            );
        },

        componentWillMount: function () {
            var self = this,
                _options = [],
                refreshOption = function(options) {
                    _options = [];

                    options.forEach(function(el) {
                        _options.push({
                            label: self._renderPrinterItem(el)
                        });
                    });

                    self.setState({
                        printOptions: _options,
                        loadFinished: true
                    });
                };


            self.setState({
                discoverMethods: discover(
                    self.state.discoverId,
                    function(printers) {
                        refreshOption(printers);
                    }
                )
            });
        },

        componentWillUnmount: function() {
            if ('function' === typeof this.state.discoverMethods.removeListener) {
                this.state.discoverMethods.removeListener(this.state.discoverId);
            }
        }
    });

    return View;
});
