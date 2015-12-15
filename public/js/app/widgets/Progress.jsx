define([
    'react',
    'jsx!widgets/Modal',
    'jsx!widgets/Alert',
    'app/constants/progress-constants'
],
function(React, Modal, Alert, ProgressConstants) {
    'use strict';

    var acceptableTypes = [
        ProgressConstants.WAITING,
        ProgressConstants.STEPPING,
        ProgressConstants.NONSTOP
    ];

    return React.createClass({

        propTypes: {
            type       : React.PropTypes.oneOf(acceptableTypes),
            isOpen     : React.PropTypes.bool,
            lang       : React.PropTypes.object,
            caption    : React.PropTypes.string,
            message    : React.PropTypes.string,
            percentage : React.PropTypes.number,
            hasStop    : React.PropTypes.object,
            onFinished : React.PropTypes.func
        },

        getDefaultProps: function () {
            return {
                lang       : {},
                isOpen     : true,
                caption    : '',
                message    : '',
                type       : ProgressConstants.WAITING,
                percentage : 0,
                hasStop    : true,
                onFinished : function() {}
            };
        },

        _getButton: function() {
            var buttons = [];

            switch (this.props.type) {
            case ProgressConstants.WAITING:
            case ProgressConstants.STEPPING:
                buttons.push({
                    label: this.props.lang.alert.stop,
                    onClick: this.props.onFinished
                });
                break;
            case ProgressConstants.NONSTOP:
                // No button
                break;
            }

            if (false === this.props.hasStop) {
                // clear button
                buttons = [];
            }

            return buttons;
        },

        _renderMessage: function() {
            var message,
                progressIcon = this._renderIcon();

            switch (this.props.type) {
            case ProgressConstants.WAITING:
            case ProgressConstants.STEPPING:
                message = (
                    <div>
                        <p>{this.props.message}</p>
                        {progressIcon}
                    </div>
                );
                break;
            case ProgressConstants.NONSTOP:
                message = progressIcon;
                break;
            }

            return message;
        },

        _renderIcon: function() {
            var icon,
                progressStyle = {
                    width: (this.props.percentage || 0) + '%'
                };

            switch (this.props.type) {
            case ProgressConstants.WAITING:
            case ProgressConstants.NONSTOP:
                icon = (
                    <div className="spinner-roller spinner-roller-reverse"/>
                );
                break;
            case ProgressConstants.STEPPING:
                icon = (
                    <div className="progress-bar" data-percentage={this.props.percentage}>
                        <div className="current-progress" style={progressStyle}/>
                    </div>
                );
                break;
            }

            return icon;

        },

        render: function() {
            if (false === this.props.isOpen) {
                return <div/>
            }

            var buttons = this._getButton(),
                progressIcon = this._renderIcon(),
                message = this._renderMessage(),
                content = (
                    <Alert
                        lang={this.props.lang}
                        caption={this.props.caption}
                        message={message}
                        buttons={buttons}
                    />
                ),
                className = {
                    'modal-progress': true,
                    'modal-progress-nonstop': ProgressConstants.NONSTOP === this.props.type
                };

            return (
                <Modal className={className} content={content} disabledEscapeOnBackground={false}/>
            );
        }
    });
});