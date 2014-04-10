require("./Layer.js");
require("./reloaders/LayerReloader.js");

/**
 * Base class for all SMC viewer layer which are both reloadable and aggregable in grouping layers.
 * @class 
 * @extends SMC.layers.Layer
 * @abstract
 * @mixes SMC.layers.reloaders.LayerReloader
 *
 * @author Luis Román (lroman@emergya.com)
 */
SMC.layers.SingleLayer = SMC.layers.Layer.extend(
/** @lends SMC.layers.geometry.Layer# */
{
	includes: [SMC.layers.reloaders.LayerReloader.prototype],

	/**
	 * Load data from a layer
	 * @abstract
	 */
	load: function(){

	},

	onAdd: function(map){
		this.load();
	}
});
