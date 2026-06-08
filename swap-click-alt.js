/**
 * draw.io Swap Click/Alt+Click Plugin
 *
 * 透明クリック判定（Altダウン）の動作をトグル反転させ、
 * Altキーを使わず通常クリックで背面オブジェクトを選択可能にします。
 */
(function() {
    'use strict';

    var pluginName = 'Swap Click/Alt';

    /**
     * @param {string} message
     */
    function log(message) {
        if (typeof console !== 'undefined' && console.log) {
            console.log(pluginName + ': ' + message);
        }
    }

    /**
     * @param {string} message
     */
    function warn(message) {
        if (typeof console !== 'undefined' && console.warn) {
            console.warn(pluginName + ': ' + message);
        }
    }

    if (typeof Draw === 'undefined' || Draw.loadPlugin == null) {
        warn('Draw.loadPlugin is not available.');
        return;
    }

    Draw.loadPlugin(function(ui) {
        var STORAGE_KEY = 'drawio-swap-click-alt-enabled';
        var swapEnabled = false;

        try {
            swapEnabled = localStorage.getItem(STORAGE_KEY) === 'true';
        } catch (e) { warn('Failed to read swap state: ' + e); }

        var graph = ui.editor.graph;
        var origIsTransparentClickEvent = graph.isTransparentClickEvent;

        /**
         * swapEnabled が true の場合、Altキー非押下時に背面オブジェクトを選択するよう挙動を反転する
         * @param {Event} evt
         * @returns {boolean}
         */
        graph.isTransparentClickEvent = function(evt) {
            if (swapEnabled) {
                return !mxEvent.isAltDown(evt) || (mxClient.IS_CHROMEOS && mxEvent.isShiftDown(evt));
            }
            return origIsTransparentClickEvent.apply(this, arguments);
        };

        mxResources.parse('swapClickAlt=Swap Click/Alt+Click');

        var action = ui.actions.addAction('swapClickAlt', function() {
            swapEnabled = !swapEnabled;
            try {
                localStorage.setItem(STORAGE_KEY, String(swapEnabled));
            } catch (e) { warn('Failed to save swap state: ' + e); }
        });

        action.setToggleAction(true);
        action.setSelectedCallback(function() { return swapEnabled; });

        if (ui.menus) {
            var menu = ui.menus.get('extras') || ui.menus.get('view');
            if (menu) {
                var oldFunct = menu.funct;

                menu.funct = function(menu, parent) {
                    oldFunct.apply(this, arguments);
                    ui.menus.addMenuItems(menu, ['-', 'swapClickAlt'], parent);
                };
                log('registered in menu successfully');
            } else {
                warn('Extras or View menu not found');
            }
        }

        log('loaded.');
    });
})();
