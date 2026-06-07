/**
 * draw.io Props Changer Plugin
 */
(function() {
    'use strict';

    var pluginName = 'Props Changer';

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

    var CONFIG = {
        menuLabel: '簡易プロパティ編集',
        properties: [
            {
                key: 'expand',
                label: '図のサイズを拡張',
                values: [
                    { value: '1', label: 'ON' },
                    { value: '0', label: 'OFF' }
                ]
            },
            {
                key: 'sketch',
                label: 'スケッチ',
                defaultOff: true,
                values: [
                    { value: '1', label: 'ON' },
                    { value: '0', label: 'OFF' }
                ]
            },
            {
                key: 'allowArrows',
                label: '矢印を許可',
                values: [
                    { value: '1', label: 'ON' },
                    { value: '0', label: 'OFF' }
                ]
            },
            {
                key: 'connectable',
                label: '接続可能',
                values: [
                    { value: '1', label: 'ON' },
                    { value: '0', label: 'OFF' }
                ]
            },
            {
                key: 'autosize',
                label: '自動サイズ調整',
                defaultOff: true,
                values: [
                    { value: '1', label: 'ON' },
                    { value: '0', label: 'OFF' }
                ]
            },
            {
                key: 'snapToPoint',
                label: 'ポイントにスナップ',
                values: [
                    { value: '1', label: 'ON' },
                    { value: '0', label: 'OFF' }
                ]
            }
        ]
    };

    /**
     * @param {mxGraph} graph
     * @param {string} key
     * @param {string} value
     */
    function setProp(graph, key, value) {
        var cells = graph.getSelectionCells();
        if (cells.length > 0) {
            graph.setCellStyles(key, value, cells);
            graph.refresh();
        }
    }

    /**
     * @param {mxGraph} graph
     * @param {mxCell} cell
     * @param {string} key
     * @returns {string|null}
     */
    function getCurrentVal(graph, cell, key) {
        var resolved = graph.getCellStyle(cell);
        if (resolved[key]) return resolved[key];
        var match = cell.getStyle().match(new RegExp('(?:^|;)' + key + '=([^;]*)'));
        return match ? match[1] : null;
    }

    if (typeof Draw === 'undefined' || Draw.loadPlugin == null) {
        warn('Draw.loadPlugin is not available.');
        return;
    }

    Draw.loadPlugin(function(ui) {
        var graph = ui.editor.graph;
        var menus = ui.menus;
        var originalCreatePopupMenu = menus.createPopupMenu;

        menus.createPopupMenu = function(menu, cell, evt) {
            originalCreatePopupMenu.call(menus, menu, cell, evt);

            if (cell == null || !graph.model.isVertex(cell)) return;

            menu.addSeparator();

            var parentItem = menu.addItem(CONFIG.menuLabel, null, null);

            CONFIG.properties.forEach(function(prop) {
                if (prop.values.length === 2) {
                    var cur = getCurrentVal(graph, cell, prop.key);
                    var checked;
                    if (cur == null) {
                        checked = !prop.defaultOff;
                    } else {
                        checked = (cur !== prop.values[1].value);
                    }
                    var nextVal = checked ? prop.values[1].value : prop.values[0].value;
                    var curLabel = checked ? prop.values[0].label : prop.values[1].label;
                    var label = (checked ? '\u2714 ' : '\u3000 ') + prop.label + ' [' + curLabel + ']';

                    menu.addItem(label, null, function() {
                        setProp(graph, prop.key, nextVal);
                    }, parentItem);
                } else {
                    var propItem = menu.addItem(prop.label, null, null, parentItem);
                    prop.values.forEach(function(val) {
                        menu.addItem(val.label, null, function() {
                            setProp(graph, prop.key, val.value);
                        }, propItem);
                    });
                }
            });
        };

        log('loaded (' + CONFIG.properties.length + ' properties)');
    });
})();
