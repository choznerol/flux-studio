define([
    'react',
    'jquery',
    'jsx!widgets/Select',
    'jsx!widgets/List',
    'helpers/api/discover',
    'helpers/api/touch'
], function(React, $, SelectView, ListView, discover, touch) {
    'use strict';

    return function(args) {
        args = args || {};
        args.getPrinter = args.getPrinter || function() {};

        return React.createClass({
            timer: null,
            discover_socket: null,
            selected_printer: null,

            _renderPrinterSelection: function() {
                var self = this,
                    lang = args.state.lang.select_printer,
                    options = self.state.printer_options;

                return (
                    <div>
                        <p className="text-center">{lang.choose_printer}</p>
                        <ListView className="printer-list" items={options} ondblclick={self._selectPrinter}/>
                    </div>
                );
            },

            _renderEnterPassword: function() {
                var lang = args.state.lang.select_printer;

                return (
                    <div className="form">
                        <p className="text-center">{lang.notification}</p>
                        <input type="password" ref="password" className="span12" defaultValue="" placeholder={lang.please_enter_password}/>
                        <button className="btn btn-action btn-full-width sticky-bottom" onClick={this._returnSelectedPrinter}>{lang.submit}</button>
                    </div>
                );
            },

            _goBackToPrinterList: function() {
                this.setState({
                    auth_failure: null,
                    show_password: false
                });
            },

            _renderAuthFailure: function() {
                var lang = args.state.lang.select_printer;

                return (
                    <div>
                        <p>{lang.auth_failure}</p>
                        <button className="btn btn-action btn-full-width sticky-bottom" onClick={this._goBackToPrinterList}>
                            {lang.retry}
                        </button>
                    </div>
                );
            },

            _selectPrinter: function(e) {
                var self = this,
                    $el = $(e.target),
                    meta = $el.data('meta');

                self.selected_printer = meta;

                if (true === meta.password) {
                    self.setState({
                        show_password: true
                    });
                }
            },

            _renderPrinterItem: function(printer) {
                var class_name = 'printer-item fa ' + (true === printer.password ? 'fa-lock' : 'fa-unlock-alt'),
                    meta = JSON.stringify(printer);

                return (
                    <label className={class_name} data-meta={meta}>
                        <input type="radio" name="printer-group" value={printer.serial}/>
                        <span className="print-name">{printer.name}</span>
                    </label>
                );
            },

            _returnSelectedPrinter: function(e) {
                var self = this,
                    opts = {
                        onSuccess: function(data) {
                            args.getPrinter(self.selected_printer);
                        },
                        onError: function(data) {
                            self.setState({
                                auth_failure: true,
                                show_password: false
                            });
                        }
                    },
                    selected_printer = self.selected_printer,
                    touch_socket;

                selected_printer.plain_password = self.refs.password.getDOMNode().value;

                touch_socket = touch(opts).send(selected_printer.serial, selected_printer.plain_password);

            },
            render : function() {
                var self = this,
                    show_password = self.state.show_password,
                    auth_failure = self.state.auth_failure,
                    content = (
                        false === show_password ?
                        self._renderPrinterSelection() :
                        self._renderEnterPassword()
                    );

                if (true === auth_failure) {
                    content = self._renderAuthFailure();
                }

                return (
                    <div className="select-printer absolute-center">
                        <div className="select-printer-content">
                            {content}
                        </div>
                    </div>
                );
            },
            getInitialState: function() {
                var self = this,
                    options = [];

                self.discover_socket = discover(function(printers) {
                    options = [];

                    printers.forEach(function(el) {
                        var printer_item = self._renderPrinterItem(el);

                        options.push({
                            value: el.serial,
                            label: {printer_item}
                        });
                    });
                });

                self.timer = setInterval(function() {
                    self.setState({
                        printer_options: options
                    });
                }, 1000);

                return {
                    printer_options: [],
                    show_password: false
                };
            },
            componentWillUnmount: function() {
                this.discover_socket.connection.close();
                clearInterval(this.timer);
            }

        });
    };
});