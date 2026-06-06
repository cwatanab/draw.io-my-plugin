/**
 * draw.io Hierarchy Viewer Plugin
 */
(function() {
    Draw.loadPlugin(function(ui) {
        var graph = ui.editor.graph;
        
        var menuLabel = '階層・オブジェクトビューア';
        var windowTitle = 'オブジェクト階層';
        
        try {
            // Create window DOM container
            var container = document.createElement('div');
            container.style.width = '100%';
            container.style.height = '100%';
            container.style.overflow = 'auto';
            container.style.padding = '8px';
            container.style.boxSizing = 'border-box';
            container.style.fontFamily = 'Helvetica Neue, Helvetica, Arial, sans-serif';
            container.style.fontSize = '12px';
            container.style.backgroundColor = '#ffffff';
            container.style.userSelect = 'none';
            // Enable keyboard focus for F2 key listener
            container.tabIndex = 0;
            container.style.outline = 'none';

            // Add CSS styling including Drag and Drop visual indicators
            var style = document.createElement('style');
            style.type = 'text/css';
            style.innerHTML = 
                '.hierarchy-item { padding: 4px 6px; border-bottom: 1px solid #f3f4f6; display: flex; align-items: center; justify-content: space-between; transition: border 0.1s, background-color 0.1s; outline: none; }' +
                '.hierarchy-item:hover { background-color: #f3f4f6; }' +
                '.hierarchy-item-selected { background-color: #dbeafe !important; border-left: 3px solid #2563eb; }' +
                '.hierarchy-item-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex-grow: 1; display: flex; align-items: center; cursor: pointer; }' +
                '.hierarchy-drag-handle { cursor: grab; padding: 0 4px; color: #9ca3af; font-family: sans-serif; font-size: 14px; user-select: none; margin-right: 4px; flex-shrink: 0; }' +
                '.hierarchy-drag-handle:active { cursor: grabbing; }' +
                '.hierarchy-vis-btn { cursor: pointer; margin-right: 6px; display: inline-flex; align-items: center; justify-content: center; user-select: none; flex-shrink: 0; transition: opacity 0.15s, color 0.15s; }' +
                '.hierarchy-vis-btn:hover { opacity: 1.0 !important; color: #2563eb !important; }' +
                '.hierarchy-rename-btn { cursor: pointer; font-size: 12px; margin-left: 6px; user-select: none; flex-shrink: 0; transition: opacity 0.1s; }' +
                '.hierarchy-item-badge { font-size: 10px; color: #9ca3af; background-color: #f3f4f6; padding: 1px 4px; border-radius: 4px; margin-left: 6px; flex-shrink: 0; }' +
                '.hierarchy-children { margin-left: 12px; border-left: 1px dashed #e5e7eb; }' +
                '.drag-over-inside { background-color: #bfdbfe !important; }' +
                '.drag-over-before { border-top: 2px solid #2563eb !important; }' +
                '.drag-over-after { border-bottom: 2px solid #2563eb !important; }';
            (document.head || document.getElementsByTagName('head')[0]).appendChild(style);

            // Create mxWindow
            var wnd = new mxWindow(windowTitle, container, 200, 100, 280, 420, true, true);
            wnd.setResizable(true);
            wnd.setScrollable(false); // Scroll handled by container div
            
            // Helper to check if child is a descendant of parent
            function isDescendant(parent, child) {
                var node = child;
                while (node != null) {
                    if (node === parent) {
                        return true;
                    }
                    node = node.getParent();
                }
                return false;
            }

            // Clear all drag over styles in the tree
            function clearDragOverStyles(exceptItem) {
                var items = container.querySelectorAll('.hierarchy-item');
                for (var i = 0; i < items.length; i++) {
                    if (items[i] !== exceptItem) {
                        items[i].classList.remove('drag-over-before', 'drag-over-after', 'drag-over-inside');
                    }
                }
            }

            // Helper to get raw edit label for a cell (excluding icons/terminal status)
            function getRawCellLabel(cell) {
                if (cell.value) {
                    if (typeof cell.value === 'object' && cell.value.getAttribute) {
                        return cell.value.getAttribute('label') || '';
                    }
                    return String(cell.value);
                }
                return '';
            }

            // Helper to get printable label for a cell
            function getCellLabel(cell) {
                var raw = getRawCellLabel(cell);
                if (raw) return raw;

                if (graph.model.isEdge(cell)) {
                    var source = cell.getTerminal(true);
                    var target = cell.getTerminal(false);
                    var sourceLabel = source ? getCellLabel(source) : '?';
                    var targetLabel = target ? getCellLabel(target) : '?';
                    return sourceLabel + ' → ' + targetLabel;
                }
                return '[図形 ' + (cell.id || '') + ']';
            }

            // Recursively build the tree DOM
            function buildTreeDom(cell, depth, isSelected) {
                var wrapper = document.createElement('div');
                
                var isRoot = (depth === 0);
                var isLayer = (depth === 1);
                
                if (!isRoot) {
                    var item = document.createElement('div');
                    item.className = 'hierarchy-item';
                    if (isSelected) {
                        item.className += ' hierarchy-item-selected';
                    }

                    // Drag Handle (⋮⋮) to separate drag operation from click/double-click
                    var dragHandle = document.createElement('span');
                    dragHandle.className = 'hierarchy-drag-handle';
                    dragHandle.innerText = '⋮⋮';
                    dragHandle.title = 'ドラッグして順序・階層を移動';
                    item.appendChild(dragHandle);

                    // Visibility (SVG Eye) Toggle Button
                    var visBtn = document.createElement('span');
                    visBtn.className = 'hierarchy-vis-btn';
                    var isVisible = graph.model.isVisible(cell);
                    
                    // Inline SVG definitions (Lucide icons style)
                    var openEyeSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>';
                    var closedEyeSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>';
                    
                    visBtn.innerHTML = isVisible ? openEyeSvg : closedEyeSvg;
                    visBtn.style.opacity = isVisible ? '0.7' : '0.35';
                    visBtn.style.color = isVisible ? '#4b5563' : '#9ca3af'; // Slate grey for active, lighter grey for disabled
                    visBtn.title = isVisible ? 'クリックして非表示にする' : 'クリックして表示する';
                    
                    visBtn.onclick = function(e) {
                        e.stopPropagation();
                        var nextVis = !graph.model.isVisible(cell);
                        graph.getModel().beginUpdate();
                        try {
                            graph.model.setVisible(cell, nextVis);
                        } finally {
                            graph.getModel().endUpdate();
                        }
                        graph.refresh();
                        refreshTree();
                    };
                    item.appendChild(visBtn);
                    
                    // Icon styling based on cell type
                    var prefix = '';
                    if (isLayer) {
                        prefix = '🗂️ ';
                        item.style.fontWeight = 'bold';
                        item.style.backgroundColor = '#f9fafb';
                    } else if (graph.model.isEdge(cell)) {
                        prefix = '⚡ ';
                        item.style.color = '#4b5563';
                    } else {
                        prefix = '⬜ ';
                    }

                    // Node content
                    var labelSpan = document.createElement('span');
                    labelSpan.className = 'hierarchy-item-label';
                    labelSpan.innerText = prefix + getCellLabel(cell);
                    item.appendChild(labelSpan);

                    // Right side container for badges and actions
                    var rightContainer = document.createElement('div');
                    rightContainer.style.display = 'flex';
                    rightContainer.style.alignItems = 'center';
                    rightContainer.style.flexShrink = '0';

                    // Rename Button (✏️)
                    var renameBtn = document.createElement('span');
                    renameBtn.className = 'hierarchy-rename-btn';
                    renameBtn.innerText = '✏️';
                    renameBtn.style.opacity = '0.4';
                    renameBtn.title = '名前を変更 (F2 キーでも変更可能)';
                    
                    renameBtn.onmouseover = function() { renameBtn.style.opacity = '1.0'; };
                    renameBtn.onmouseout = function() { renameBtn.style.opacity = '0.4'; };
                    rightContainer.appendChild(renameBtn);

                    // Z-Order Badge (Index in parent's children array)
                    var parent = cell.getParent();
                    if (parent && parent.children && !isLayer) {
                        var idx = parent.children.indexOf(cell);
                        var total = parent.children.length;
                        var zBadge = document.createElement('span');
                        zBadge.className = 'hierarchy-item-badge';
                        zBadge.innerText = 'Z:' + idx + '/' + (total - 1);
                        zBadge.title = '重なり順 (インデックスが大きいほど前面)';
                        rightContainer.appendChild(zBadge);
                    }

                    item.appendChild(rightContainer);

                    // Hover effect
                    item.onmouseover = function() {
                        if (graph.getSelectionCell() !== cell) {
                            item.style.backgroundColor = '#f3f4f6';
                        }
                    };
                    item.onmouseout = function() {
                        if (graph.getSelectionCell() !== cell) {
                            item.style.backgroundColor = isLayer ? '#f9fafb' : 'transparent';
                        }
                    };

                    // Select cell in editor on click
                    item.onclick = function(e) {
                        e.stopPropagation();
                        graph.setSelectionCell(cell);
                        graph.scrollCellToVisible(cell);
                        container.focus(); // Give focus to container to enable F2 listener
                    };

                    // Define reusable rename function
                    var startEditing = function() {
                        // Temporarily disable dragging
                        dragHandle.setAttribute('draggable', 'false');
                        dragHandle.style.opacity = '0.3';
                        dragHandle.style.cursor = 'default';
                        
                        var currentText = getRawCellLabel(cell);
                        
                        var input = document.createElement('input');
                        input.type = 'text';
                        input.value = currentText;
                        input.style.width = '100%';
                        input.style.boxSizing = 'border-box';
                        input.style.padding = '2px 4px';
                        input.style.fontSize = '12px';
                        input.style.border = '1px solid #3b82f6';
                        input.style.borderRadius = '3px';
                        input.style.outline = 'none';
                        input.style.margin = '0 4px';
                        
                        // Hide right badges temporarily during edit
                        rightContainer.style.display = 'none';
                        
                        // Clear label text and insert input
                        labelSpan.innerHTML = '';
                        labelSpan.innerText = prefix; // keep icon prefix
                        labelSpan.appendChild(input);
                        
                        input.focus();
                        input.select();
                        
                        var isFinished = false;
                        function finishEdit(save) {
                            if (isFinished) return;
                            isFinished = true;
                            
                            var newValue = input.value.trim();
                            if (save && newValue !== currentText) {
                                graph.getModel().beginUpdate();
                                try {
                                    graph.cellLabelChanged(cell, newValue);
                                } catch(err) {
                                    console.error('Failed to change label:', err);
                                } finally {
                                    graph.getModel().endUpdate();
                                }
                            }
                            
                            dragHandle.setAttribute('draggable', 'true');
                            dragHandle.style.opacity = '1';
                            dragHandle.style.cursor = 'move';
                            rightContainer.style.display = 'flex';
                            refreshTree();
                            container.focus(); // return focus to container
                        }
                        
                        input.onblur = function() {
                            finishEdit(true);
                        };
                        
                        input.onkeydown = function(evt) {
                            if (evt.key === 'Enter') {
                                finishEdit(true);
                            } else if (evt.key === 'Escape') {
                                finishEdit(false);
                            }
                        };
                    };

                    // Attach the edit trigger function to the DOM element
                    item._startEditing = startEditing;

                    // Trigger edit mode via the pencil button
                    renameBtn.onclick = function(e) {
                        e.stopPropagation();
                        startEditing();
                    };

                    // Drag & Drop event handlers - attached to dragHandle for dragging
                    dragHandle.setAttribute('draggable', 'true');

                    dragHandle.ondragstart = function(e) {
                        e.dataTransfer.effectAllowed = 'move';
                        e.dataTransfer.setData('text/plain', cell.id);
                        window._draggedHierarchyCell = cell;
                        item.style.opacity = '0.5';
                    };

                    dragHandle.ondragend = function(e) {
                        item.style.opacity = '1';
                        window._draggedHierarchyCell = null;
                        clearDragOverStyles();
                    };

                    // Drag over/leave/drop handlers remain on the item container to receive drop
                    item.ondragover = function(e) {
                        var draggedCell = window._draggedHierarchyCell;
                        if (!draggedCell || isDescendant(draggedCell, cell)) {
                            return; // Cannot drag into self or descendant
                        }
                        
                        // Prevent default to allow drop
                        e.preventDefault();
                        
                        var rect = item.getBoundingClientRect();
                        var relativeY = e.clientY - rect.top;
                        var height = rect.height;
                        
                        clearDragOverStyles(item);

                        // Layers cannot be dropped INSIDE other vertices, only before/after other layers
                        if (isLayer) {
                            if (draggedCell.getParent() !== cell.getParent()) {
                                return; // Layers must stay under the main root
                            }
                            if (relativeY < height * 0.5) {
                                item.classList.add('drag-over-before');
                            } else {
                                item.classList.add('drag-over-after');
                            }
                            return;
                        }

                        // Determine drop position (before, after, or inside)
                        if (relativeY < height * 0.3) {
                            item.classList.add('drag-over-before');
                        } else if (relativeY > height * 0.7) {
                            item.classList.add('drag-over-after');
                        } else {
                            // Edges cannot have children
                            if (graph.model.isEdge(cell)) {
                                if (relativeY < height * 0.5) {
                                    item.classList.add('drag-over-before');
                                } else {
                                    item.classList.add('drag-over-after');
                                }
                            } else {
                                item.classList.add('drag-over-inside');
                            }
                        }
                    };

                    item.ondragleave = function(e) {
                        item.classList.remove('drag-over-before', 'drag-over-after', 'drag-over-inside');
                    };

                    item.ondrop = function(e) {
                        var draggedCell = window._draggedHierarchyCell;
                        if (!draggedCell) return;
                        e.preventDefault();

                        var rect = item.getBoundingClientRect();
                        var relativeY = e.clientY - rect.top;
                        var height = rect.height;

                        var insertMode = 'inside';
                        if (isLayer) {
                            insertMode = (relativeY < height * 0.5) ? 'before' : 'after';
                        } else if (relativeY < height * 0.3) {
                            insertMode = 'before';
                        } else if (relativeY > height * 0.7) {
                            insertMode = 'after';
                        }

                        // Fallback edge handling
                        if (insertMode === 'inside' && graph.model.isEdge(cell)) {
                            insertMode = (relativeY < height * 0.5) ? 'before' : 'after';
                        }

                        var parent = (insertMode === 'inside') ? cell : cell.getParent();
                        var index = 0;

                        graph.getModel().beginUpdate();
                        try {
                            if (insertMode === 'inside') {
                                index = parent.getChildCount();
                                graph.addCells([draggedCell], parent, index);
                            } else {
                                var targetIndex = parent.children.indexOf(cell);
                                var draggedIndex = parent.children.indexOf(draggedCell);

                                if (draggedCell.getParent() === parent) {
                                    // Re-order within same parent (adjusting Z-index)
                                    if (insertMode === 'before') {
                                        // Tree 'before' is higher Z-order (closer to front)
                                        index = (draggedIndex > targetIndex) ? targetIndex + 1 : targetIndex;
                                    } else {
                                        // Tree 'after' is lower Z-order (closer to back)
                                        index = (draggedIndex < targetIndex) ? targetIndex - 1 : targetIndex;
                                    }
                                    if (index < 0) index = 0;
                                } else {
                                    // Move to a different parent/layer
                                    if (insertMode === 'before') {
                                        index = targetIndex + 1;
                                    } else {
                                        index = targetIndex;
                                    }
                                }
                                graph.addCells([draggedCell], parent, index);
                            }
                        } catch (err) {
                            console.error('Failed to move cell:', err);
                        } finally {
                            graph.getModel().endUpdate();
                        }

                        clearDragOverStyles();
                        refreshTree();
                    };
                    
                    wrapper.appendChild(item);
                }

                // Recurse into children
                var childCount = cell.getChildCount();
                if (childCount > 0) {
                    var childrenContainer = document.createElement('div');
                    childrenContainer.className = 'hierarchy-children';
                    
                    // Show children in reverse Z-order (highest index on top = front elements on top)
                    for (var i = childCount - 1; i >= 0; i--) {
                        var child = cell.getChildAt(i);
                        var isChildSelected = (graph.getSelectionCell() === child);
                        var childDom = buildTreeDom(child, depth + 1, isChildSelected);
                        childrenContainer.appendChild(childDom);
                    }
                    wrapper.appendChild(childrenContainer);
                }

                return wrapper;
            }

            // Render the hierarchy tree
            function refreshTree() {
                container.innerHTML = '';
                
                var model = graph.getModel();
                var root = model.getRoot();
                
                if (root) {
                    var treeDom = buildTreeDom(root, 0, false);
                    container.appendChild(treeDom);
                } else {
                    container.innerText = 'オブジェクトが見つかりません。';
                }
            }

            // Listen for keydown (F2) on the container to trigger editing
            container.addEventListener('keydown', function(e) {
                if (e.key === 'F2') {
                    var selectedItem = container.querySelector('.hierarchy-item-selected');
                    if (selectedItem && typeof selectedItem._startEditing === 'function') {
                        e.preventDefault();
                        e.stopPropagation();
                        selectedItem._startEditing();
                    }
                }
            });

            // Listen for graph changes to update the viewer
            graph.getModel().addListener(mxEvent.CHANGE, function() {
                if (wnd.isVisible()) {
                    refreshTree();
                }
            });

            // Listen for selection changes to update highlighted elements in the tree
            graph.getSelectionModel().addListener(mxEvent.UNDO, function() {
                if (wnd.isVisible()) {
                    refreshTree();
                }
            });

            // Toggle window visibility function
            function toggleWindow() {
                wnd.setVisible(!wnd.isVisible());
                if (wnd.isVisible()) {
                    refreshTree();
                    container.focus(); // Focus container when opening window
                }
            }

            // Register window toggle action
            var actionName = 'toggleHierarchyViewer';
            var action = ui.actions.addAction(actionName, toggleWindow);
            action.label = menuLabel;

            // Add menu item under Extras (その他) or View (表示) using robust direct addItem
            function registerMenu() {
                var menu = ui.menus.get('extras') || ui.menus.get('view');
                if (menu) {
                    var oldFunct = menu.funct;
                    menu.funct = function(m, parent) {
                        oldFunct.apply(this, arguments);
                        
                        m.addSeparator(parent);
                        m.addItem(menuLabel, null, function() {
                            toggleWindow();
                        }, parent);
                    };
                    console.log('hierarchy-viewer: registered in menu successfully');
                } else {
                    console.warn('hierarchy-viewer: Extras or View menu not found');
                }
            }

            // Register menu immediately
            if (ui.menus) {
                registerMenu();
            }

            // Initialize window as invisible
            wnd.setVisible(false);
            
            console.log('hierarchy-viewer: loaded successfully');

        } catch (e) {
            console.error('hierarchy-viewer plugin load error:', e);
        }
    });
})();
