/**
 * draw.io Swap Click/Alt+Click Plugin
 *
 * 通常の左クリックと Alt+左クリックの transparent click 動作を入れ替えます。
 * - 左クリック: 選択済みの前面オブジェクトをスルーして背面オブジェクトを選択
 * - Alt+左クリック: draw.io 標準の通常クリックとして前面オブジェクトを選択
 */
(function() {
    'use strict';

    var PLUGIN_NAME = 'Swap Click/Alt';
    var STORAGE_KEY = 'drawio-swap-click-alt-enabled';
    var ACTION_NAME = 'swapClickAlt';
    var PATCH_VERSION = 3;
    var GRAPH_MARKER = '__swapClickAltGraphPatched';
    var HANDLER_MARKER = '__swapClickAltGraphHandlerPatched';
    var MENU_PATCH_MARKER = '__swapClickAltMenuPatched';
    var FORCED_CELL_FIELD = '__swapClickAltForcedCell';
    var LEGACY_CLICK_THROUGH_MARKER = '__clickThroughTransparentPatched';

    var state = {
        enabled: true
    };

    /**
     * @param {string} message
     */
    function log(message) {
        if (typeof console !== 'undefined' && console.log) {
            console.log(PLUGIN_NAME + ': ' + message);
        }
    }

    /**
     * @param {string} message
     */
    function warn(message) {
        if (typeof console !== 'undefined' && console.warn) {
            console.warn(PLUGIN_NAME + ': ' + message);
        }
    }

    /**
     * @returns {boolean}
     */
    function hasDrawPluginLoader() {
        return typeof Draw !== 'undefined' && Draw.loadPlugin != null;
    }

    /**
     * @returns {boolean}
     */
    function readEnabledState() {
        try {
            var value = localStorage.getItem(STORAGE_KEY);
            return value == null ? true : value === 'true';
        } catch (e) {
            warn('Failed to read swap state: ' + e);
            return true;
        }
    }

    /**
     * @param {boolean} enabled
     */
    function writeEnabledState(enabled) {
        try {
            localStorage.setItem(STORAGE_KEY, String(enabled));
        } catch (e) {
            warn('Failed to save swap state: ' + e);
        }
    }

    /**
     * @returns {boolean}
     */
    function isSwapEnabled() {
        return state.enabled === true;
    }

    /**
     * @param {Event} evt
     * @returns {boolean}
     */
    function isAltDown(evt) {
        if (evt == null) {
            return false;
        }

        if (typeof mxEvent !== 'undefined' && mxEvent.isAltDown) {
            return mxEvent.isAltDown(evt);
        }

        return !!evt.altKey;
    }

    /**
     * @param {Event} evt
     * @returns {boolean}
     */
    function isShiftDown(evt) {
        if (evt == null) {
            return false;
        }

        if (typeof mxEvent !== 'undefined' && mxEvent.isShiftDown) {
            return mxEvent.isShiftDown(evt);
        }

        return !!evt.shiftKey;
    }

    /**
     * @param {Event} evt
     * @returns {boolean}
     */
    function isTransparentModifierDown(evt) {
        return isAltDown(evt) ||
            (typeof mxClient !== 'undefined' && mxClient.IS_CHROMEOS && isShiftDown(evt));
    }

    /**
     * @param {Event} evt
     * @returns {boolean}
     */
    function isLeftMouseEvent(evt) {
        if (evt == null) {
            return false;
        }

        if (typeof mxEvent !== 'undefined' && mxEvent.isLeftMouseButton) {
            return mxEvent.isLeftMouseButton(evt);
        }

        return evt.button == null || evt.button === 0;
    }

    /**
     * @param {mxMouseEvent} me
     * @returns {Event|null}
     */
    function getEvent(me) {
        return me != null && me.getEvent != null ? me.getEvent() : null;
    }

    /**
     * @param {mxMouseEvent} me
     * @returns {mxCell|null}
     */
    function getMouseCell(me) {
        if (me != null && me.getCell != null) {
            var cell = me.getCell();

            if (cell != null) {
                return cell;
            }
        }

        var state = (me != null && me.getState != null) ? me.getState() : null;
        return state != null ? state.cell : null;
    }

    /**
     * @param {mxMouseEvent} me
     * @returns {number|null}
     */
    function getGraphX(me) {
        if (me == null) {
            return null;
        }

        return me.graphX != null ? me.graphX :
            (me.getGraphX != null ? me.getGraphX() : null);
    }

    /**
     * @param {mxMouseEvent} me
     * @returns {number|null}
     */
    function getGraphY(me) {
        if (me == null) {
            return null;
        }

        return me.graphY != null ? me.graphY :
            (me.getGraphY != null ? me.getGraphY() : null);
    }

    /**
     * @param {mxGraph} graph
     * @param {mxMouseEvent} me
     * @param {Function} ignoreFn
     * @returns {mxCell|null}
     */
    function getCellAt(graph, me, ignoreFn) {
        var x = getGraphX(me);
        var y = getGraphY(me);

        if (graph == null || graph.getCellAt == null || x == null || y == null) {
            return null;
        }

        return graph.getCellAt(x, y, null, null, null, ignoreFn);
    }

    /**
     * draw.io 標準の transparent click と同じ判定で、選択済みセルの背面セルを返します。
     * @param {mxGraph} graph
     * @param {mxMouseEvent} me
     * @param {mxCell} cell
     * @returns {mxCell|null}
     */
    function getNativeTransparentClickCell(graph, me, cell) {
        var active = false;

        return getCellAt(graph, me, function(cellState) {
            var selected = graph.isCellSelected(cellState.cell);
            active = active || selected;

            return !active || selected ||
                (cellState.cell !== cell && graph.model.isAncestor(cellState.cell, cell));
        });
    }

    /**
     * @param {mxGraph} graph
     * @param {mxMouseEvent} me
     * @param {mxCell} cell
     * @returns {mxCell|null}
     */
    function getChildCellBelow(graph, me, cell) {
        var model = graph != null ? graph.model : null;

        if (model == null ||
            model.getChildCount == null ||
            model.isAncestor == null ||
            model.getChildCount(cell) === 0) {
            return null;
        }

        var child = getCellAt(graph, me, function(cellState) {
            return cellState.cell === cell;
        });

        return child != null && child !== cell && model.isAncestor(cell, child) ?
            child :
            null;
    }

    /**
     * @param {mxGraphHandler} handler
     * @param {mxMouseEvent} me
     * @returns {mxCell|null}
     */
    function getSwappedLeftClickCell(handler, me) {
        var graph = handler.graph;
        var cell = getMouseCell(me);

        if (cell == null) {
            return null;
        }

        var transparentCell = getNativeTransparentClickCell(graph, me, cell);

        if (transparentCell != null && transparentCell !== cell) {
            return transparentCell;
        }

        return getChildCellBelow(graph, me, cell);
    }

    /**
     * @param {mxMouseEvent} me
     * @returns {boolean}
     */
    function shouldSwapLeftClick(me) {
        var evt = getEvent(me);
        return isSwapEnabled() && isLeftMouseEvent(evt) && !isTransparentModifierDown(evt);
    }

    /**
     * @param {mxGraph} graph
     * @returns {boolean}
     */
    function patchGraphTransparentClick(graph) {
        if (graph == null || graph.isTransparentClickEvent == null) {
            warn('graph.isTransparentClickEvent is not available.');
            return false;
        }

        var previousPatch = graph[GRAPH_MARKER];

        if (previousPatch != null && previousPatch.version === PATCH_VERSION) {
            previousPatch.isSwapEnabled = isSwapEnabled;
            return true;
        }

        var originalIsTransparentClickEvent =
            previousPatch != null && previousPatch.isTransparentClickEvent != null ?
                previousPatch.isTransparentClickEvent :
                graph.isTransparentClickEvent;

        graph[GRAPH_MARKER] = {
            version: PATCH_VERSION,
            isSwapEnabled: isSwapEnabled,
            isTransparentClickEvent: originalIsTransparentClickEvent
        };

        graph.isTransparentClickEvent = function(evt) {
            var patch = this[GRAPH_MARKER];

            if (patch != null &&
                patch.isSwapEnabled != null &&
                patch.isSwapEnabled() &&
                isLeftMouseEvent(evt)) {
                return false;
            }

            var original = patch != null && patch.isTransparentClickEvent != null ?
                patch.isTransparentClickEvent :
                originalIsTransparentClickEvent;

            return original.apply(this, arguments);
        };

        return true;
    }

    /**
     * @param {Object} prototype
     * @param {string} name
     * @returns {Function}
     */
    function getOriginalHandlerMethod(prototype, name) {
        var previousPatch = prototype[HANDLER_MARKER];

        if (previousPatch != null && previousPatch[name] != null) {
            return previousPatch[name];
        }

        var legacyPatch = prototype[LEGACY_CLICK_THROUGH_MARKER];

        if (legacyPatch != null && legacyPatch[name] != null) {
            return legacyPatch[name];
        }

        return prototype[name];
    }

    /**
     * @returns {boolean}
     */
    function patchGraphHandler() {
        if (typeof mxGraphHandler === 'undefined' ||
            mxGraphHandler.prototype == null ||
            mxGraphHandler.prototype.getInitialCellForEvent == null ||
            mxGraphHandler.prototype.selectCellForEvent == null) {
            warn('mxGraphHandler is not available; selection hook was not installed.');
            return false;
        }

        var prototype = mxGraphHandler.prototype;
        var originalGetInitialCellForEvent =
            getOriginalHandlerMethod(prototype, 'getInitialCellForEvent');
        var originalSelectCellForEvent =
            getOriginalHandlerMethod(prototype, 'selectCellForEvent');

        prototype[HANDLER_MARKER] = {
            version: PATCH_VERSION,
            isSwapEnabled: isSwapEnabled,
            getInitialCellForEvent: originalGetInitialCellForEvent,
            selectCellForEvent: originalSelectCellForEvent
        };

        prototype.getInitialCellForEvent = function(me) {
            this[FORCED_CELL_FIELD] = null;

            if (!shouldSwapLeftClick(me)) {
                return originalGetInitialCellForEvent.apply(this, arguments);
            }

            var cell = getSwappedLeftClickCell(this, me);

            if (cell != null) {
                this[FORCED_CELL_FIELD] = cell;
                return cell;
            }

            return originalGetInitialCellForEvent.apply(this, arguments);
        };

        prototype.selectCellForEvent = function(cell, me) {
            if (!shouldSwapLeftClick(me)) {
                this[FORCED_CELL_FIELD] = null;
                return originalSelectCellForEvent.apply(this, arguments);
            }

            if (this[FORCED_CELL_FIELD] !== cell) {
                this[FORCED_CELL_FIELD] = null;
                return originalSelectCellForEvent.apply(this, arguments);
            }

            this[FORCED_CELL_FIELD] = null;

            var state = this.graph.view.getState(cell);

            if (state != null) {
                this.graph.selectCellForEvent(cell, me.getEvent());
            }

            return cell;
        };

        return true;
    }

    if (!hasDrawPluginLoader()) {
        warn('Draw.loadPlugin is not available.');
        return;
    }

    Draw.loadPlugin(function(ui) {
        var graph = ui != null && ui.editor != null ? ui.editor.graph : null;

        state.enabled = readEnabledState();

        var graphPatched = patchGraphTransparentClick(graph);
        var handlerPatched = patchGraphHandler();

        mxResources.parse(ACTION_NAME + '=左クリックとALT+左クリックを入替');

        var action = ui.actions.addAction(ACTION_NAME, function() {
            state.enabled = !state.enabled;
            writeEnabledState(state.enabled);
            log('swap is now ' + (state.enabled ? 'enabled' : 'disabled') + '.');
        });

        action.setToggleAction(true);
        action.setSelectedCallback(function() {
            return state.enabled;
        });

        if (ui.menus) {
            var menu = ui.menus.get('extras') || ui.menus.get('view');

            if (menu) {
                var previousPatch = menu[MENU_PATCH_MARKER];
                var oldFunct =
                    previousPatch != null && previousPatch.funct != null ?
                        previousPatch.funct :
                        menu.funct;

                menu[MENU_PATCH_MARKER] = {
                    version: PATCH_VERSION,
                    funct: oldFunct
                };

                menu.funct = function(menu, parent) {
                    if (typeof oldFunct === 'function') {
                        oldFunct.apply(this, arguments);
                    }

                    ui.menus.addMenuItems(menu, ['-', ACTION_NAME], parent);
                };

                log('registered in menu successfully.');
            } else {
                warn('Extras or View menu not found.');
            }
        }

        log('loaded. enabled=' + state.enabled +
            ', graphPatched=' + graphPatched +
            ', handlerPatched=' + handlerPatched);
    });
})();
