require("./layerTree.js");
/**
 * Base class for layer tree controls.
 * @class
 * @extends L.Control
 *
 * @author Moisés Arcos (marcos@emergya.com)
 */
SMC.controls.layerTree.LayerTreeControl = L.Control.extend({
    /** @lends SMC.controls.layerTree.LayerTreeControl# */

    options: {
        collapsed: true,
        position: 'topright',
        autoZIndex: true
    },

    initialize: function(baseLayers, options) {
        L.Util.setOptions(this, options);

        this._layers = {};
        this._lastZIndex = 0;
        this._handlingClick = false;
        this._groupList = [];
        this._domGroups = [];

        for (var i in baseLayers) {
            this._addLayer(baseLayers[i], i);
        }
    },

    /**
     * Method to load the control in the map
     */
    onAdd: function(map) {
        this._initLayout();
        this._update();

        map
            .on('layeradd', this._onLayerChange, this)
            .on('layerremove', this._onLayerChange, this);

        return this._container;
    },

    onRemove: function(map) {
        map
            .off('layeradd', this._onLayerChange)
            .off('layerremove', this._onLayerChange);
    },

    addBaseLayer: function(layer, name) {
        this._addLayer(layer, name);
        this._update();
        return this;
    },

    addOverlay: function(layer, name, group) {
        this._addLayer(layer, name, group, true);
        this._update();
        return this;
    },

    removeLayer: function(layer) {
        var id = L.Util.stamp(layer);
        delete this._layers[id];
        this._update();
        return this;
    },

    _initLayout: function() {
        var className = 'leaflet-control-layers',
            container = this._container = L.DomUtil.create('div', className);

        //Makes this work on IE10 Touch devices by stopping it from firing a mouseout event when the touch is released
        container.setAttribute('aria-haspopup', true);

        if (!L.Browser.touch) {
            L.DomEvent.disableClickPropagation(container);
            L.DomEvent.on(container, 'wheel', L.DomEvent.stopPropagation);
        } else {
            L.DomEvent.on(container, 'click', L.DomEvent.stopPropagation);
        }

        var form = this._form = L.DomUtil.create('form', className + '-list');

        if (this.options.collapsed) {
            if (!L.Browser.android) {
                L.DomEvent
                    .on(container, 'mouseover', this._expand, this)
                    .on(container, 'mouseout', this._collapse, this);
            }
            var link = this._layersLink = L.DomUtil.create('a', className + '-toggle', container);
            link.href = '#';
            link.title = 'Layers';

            if (L.Browser.touch) {
                L.DomEvent
                    .on(link, 'click', L.DomEvent.stop)
                    .on(link, 'click', this._expand, this);
            } else {
                L.DomEvent.on(link, 'focus', this._expand, this);
            }

            this._map.on('click', this._collapse, this);
            // TODO keyboard accessibility
        } else {
            this._expand();
        }

        this._baseLayersList = L.DomUtil.create('div', className + '-base', form);
        this._separator = L.DomUtil.create('div', className + '-separator', form);
        this._overlaysList = L.DomUtil.create('div', className + '-overlays', form);

        container.appendChild(form);
    },

    _addLayer: function(layer, name, group, overlay) {
        var id = L.Util.stamp(layer);

        this._layers[id] = {
            layer: layer,
            name: name,
            overlay: overlay
        };

        if (group) {
            var groupId = this._groupList.indexOf(group);

            if (groupId === -1) {
                groupId = this._groupList.push(group) - 1;
            }

            this._layers[id].group = {
                name: group,
                id: groupId
            };
        }

        if (this.options.autoZIndex && layer.setZIndex) {
            this._lastZIndex++;
            layer.setZIndex(this._lastZIndex);
        }
    },

    _update: function() {
        if (!this._container) {
            return;
        }

        this._baseLayersList.innerHTML = '';
        this._overlaysList.innerHTML = '';
        this._domGroups.length = 0;



        var baseLayersPresent = false,
            overlaysPresent = false,
            i, obj;

        for (i in this._layers) {
            obj = this._layers[i];
            this._addItem(obj);
            overlaysPresent = overlaysPresent || obj.overlay;
            baseLayersPresent = baseLayersPresent || !obj.overlay;
        }

        this._separator.style.display = overlaysPresent && baseLayersPresent ? '' : 'none';
    },

    _onLayerChange: function(e) {
        var obj = this._layers[L.Util.stamp(e.layer)];

        if (!obj) {
            // We get layer's parent folder's label (which is just a separation).
            var parentFolderLabel = "<br>";
            if (e.layer.parent) {
                if (e.layer.parent.createNodeHTML) {
                    parentFolderLabel = e.layer.parent.createNodeHTML();
                } else if (e.layer.parent.options.label) {
                    parentFolderLabel = e.layer.parent.options.label;
                }
            }

            if (e.layer.createNodeHTML) {
                // We add layers from SMC types but not Folders.
                if (!e.layer.loadLayers) {
                    this.addOverlay(e.layer, e.layer.createNodeHTML(), parentFolderLabel);
                }
            } else if (e.layer.options && e.layer.options.label) {
                // We add any other layer that has label.
                this.addOverlay(e.layer, e.layer.options.label, parentFolderLabel);
            }

        } else {
            var type = obj.overlay ?
                (e.type === 'layeradd' ? 'overlayadd' : 'overlayremove') :
                (e.type === 'layeradd' ? 'baselayerchange' : null);
            if (type) {
                this._map.fire(type, obj);
            }
        }

        if (!this._handlingClick) {
            this._update();
        }
    },

    // IE7 bugs out if you create a radio dynamically, so you have to do it this hacky way (see http://bit.ly/PqYLBe)
    _createRadioElement: function(name, checked) {

        var radioHtml = '<input type="radio" class="leaflet-control-layers-selector" name="' + name + '"';
        if (checked) {
            radioHtml += ' checked="checked"';
        }
        radioHtml += '/>';

        var radioFragment = document.createElement('div');
        radioFragment.innerHTML = radioHtml;

        return radioFragment.firstChild;
    },

    _addItem: function(obj) {
        var label = document.createElement('label'),
            input,
            checked = this._map.hasLayer(obj.layer);

        if (obj.overlay) {
            input = document.createElement('input');
            input.type = 'checkbox';
            input.className = 'leaflet-control-layers-selector';
            input.defaultChecked = checked;
        } else {
            input = this._createRadioElement('leaflet-base-layers', checked);
        }

        input.layerId = L.Util.stamp(obj.layer);

        L.DomEvent.on(input, 'click', this._onInputClick, this);

        var name = document.createElement('span');
        name.innerHTML = ' ' + obj.name;

        label.appendChild(input);
        label.appendChild(name);

        if (obj.overlay) {
            container = this._overlaysList;

            var groupContainer = this._domGroups[obj.group.id];

            // Create the group container if it doesn't exist
            if (!groupContainer) {
                groupContainer = document.createElement('div');
                groupContainer.className = 'leaflet-control-layers-group';
                groupContainer.id = 'leaflet-control-layers-group-' + obj.group.id;

                var groupLabel = document.createElement('span');
                groupLabel.className = 'leaflet-control-layers-group-name';
                // Add label icon folder
                var groupLabelIcon = document.createElement('i');
                groupLabelIcon.className = 'fa fa-folder-open';
                groupLabelIcon.style.cursor = "pointer";
                groupLabelIcon.onclick = this._clickOnFolder;
                groupLabelIcon.innerHTML = obj.group.name;
                groupLabel.appendChild(groupLabelIcon);

                groupContainer.appendChild(groupLabel);
                container.appendChild(groupContainer);

                this._domGroups[obj.group.id] = groupContainer;
            }

            container = groupContainer;
        } else {
            container = this._baseLayersList;
        }

        container.appendChild(label);

        return label;
    },

    _onInputClick: function() {
        var i, input, obj,
            inputs = this._form.getElementsByTagName('input'),
            inputsLen = inputs.length;

        this._handlingClick = true;

        for (i = 0; i < inputsLen; i++) {
            input = inputs[i];
            obj = this._layers[input.layerId];

            if (input.checked && !this._map.hasLayer(obj.layer)) {
                this._map.addLayer(obj.layer);

            } else if (!input.checked && this._map.hasLayer(obj.layer)) {
                this._map.removeLayer(obj.layer);
            }
        }
        this._handlingClick = false;
    },

    _clickOnFolder: function(){
        alert("Collapse folder");
    },

    _expand: function() {
        L.DomUtil.addClass(this._container, 'leaflet-control-layers-expanded');
    },

    _collapse: function() {
        this._container.className = this._container.className.replace(' leaflet-control-layers-expanded', '');
    }
});
/**
 * API factory method for ease creation of LayerTreeControl.

 * @params {Object} baseLayer - Javascript object with base layer name and its layer
 * @params {Object} overlays - Javascript object with overalys layer name ans its layer
 * @params {Object} options - Javascript object with the options params
 */
SMC.layerTreeControl = function(baseLayers, overlays, options) {
    return new SMC.controls.layerTree.LayerTreeControl(baseLayers, overlays, options);
};
