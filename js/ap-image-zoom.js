/**
* @license ap-image-zoom.js v0.3
* Updated: 04.09.2014
* DESCRIPTION
* Copyright (c) 2014 armin pfaeffle
* Released under the MIT license
* http://armin-pfaeffle.de/licenses/mit
*/

;(function($) {

	var datakey = '__apiz__';
	var cssPrefix = 'apiz-';

	/**
	 * Makes the first character of str uppercase and returns that string.
	 */
	function ucfirst(str) {
		str += ''; // ensure that str is a string
		var c = str[0].toUpperCase();
		return c + str.substr(1);
	}

	/**
	 * Adds ucfirst() method to String class. Makes the first character
	 * of str uppercase and returns that string.
	 */
	if (!String.prototype.ucfirst) {
		String.prototype.ucfirst = function() {
			return ucfirst(this);
		};
	}

	/**
	 * 2D Point class with properties x and y. Parses x and y to Float and applies
	 * Math.round() so x and y are Integer.
	 */
	function Point(x, y) {
		this.x = Math.round(parseFloat(x));
		this.y = Math.round(parseFloat(y));
	}

	/**
	 * 2D Size class with properties width and height. Both parameters are parsed to float and
	 * then rounded to Integer.
	 */
	function Size(width, height) {
		this.width = Math.round(parseFloat(width));
		this.height = Math.round(parseFloat(height));
	}

	/**
	 * Scale class with properties x, y and z. All three parameters are parsed to float.
	 */
	function Scale(x, y, z) {
		z = (typeof z !== 'undefined' ? z : 1);
		this.x = parseFloat(x);
		this.y = parseFloat(y);
		this.z = parseFloat(z);
	}

	/**
	 * Constructor for ApImageZoom plugin.
	 */
	function ApImageZoom(image, options) {
		// Do not remake the zoom plugin
		var data = $(image).data(datakey);
		if (data) {
			return data;
		}

		this.$image = $(image);
		this.settings = $.extend({}, ApImageZoom.defaultSettings, options);
		this._init();

		// Save the instance
		this.$image.data(datakey, this);
	}

	/**
	 * ApImageZoom class.
	 */
	ApImageZoom.prototype = {

		/**
		 *
		 */
		_init: function() {
			var self = this;

			this.panning = false;
			this.pinching = false;

			this.originSize = new Size(this.$image.width(), this.$image.height());
			this.originStyle = this.$image.attr('style');

			// Create a temporary hidden copy of image, so we obtain the real/natural size
			$('<img />')
				.hide()
				.appendTo('body')
				.load(function() {
					self.naturalSize = new Size($(this).width(), $(this).height());
					self._setConstraints();
					self._setup();
					$(this).remove();
				})
				.attr('src', this.$image.attr('src'));
		},

		/**
		 *
		 */
		_setup: function() {
			this._wrapImage();
			this._setCssClasses();
			this._resetSize();
			this._center();
			this._bind();

			this._trigger('init');
		},

		/**
		 *
		 */
		_wrapImage: function() {
			// Setup wrapper and overlay
			this.$wrapper = $('<div></div>').addClass(cssPrefix + 'wrapper');
			this.$overlay = $('<div></div>').addClass(cssPrefix + 'overlay');
			this.$wrapper.append(this.$overlay);

			// Apply ID with prefix "apiz-" if image has one
			var id = this.$image.attr('id');
			if (id) {
				this.$wrapper.attr('id', cssPrefix + id);
			}

			// Replace image with wrapper and place image into wrapper
			this.$image
				.after(this.$wrapper)
				.prependTo(this.$wrapper);
		},

		/**
		 *
		 */
		_unwrap: function() {
			this.$wrapper
				.after(this.$image)
				.remove();
		},

		/**
		 *
		 */
		_setCssClasses: function() {
			if (typeof this.settings.cssWrapperClass == 'string') {
				this.$wrapper.addClass(this.settings.cssWrapperClass);
			}
			var cssClasses = {
				hammer: {
					status: !this.settings.disableHammerPlugin,
					enabled: 'hammer-enabled',
					disabled: 'hammer-disabled'
				},
				mouseWheel: {
					status: !this.settings.disableMouseWheelPlugin,
					enabled: 'mouse-wheel-enabled',
					disabled: 'mouse-wheel-disabled'
				},
				enabled: {
					status: !this.settings.disabled,
					enabled: 'enabled',
					disabled: 'disabled'
				},
				panEnabled: {
					status: !this.settings.disablePan,
					enabled: 'pan-enabled',
					disabled: 'pan-disabled'
				},
				zoomEnabled: {
					status: !this.settings.disableZoom,
					enabled: 'zoom-enabled',
					disabled: 'zoom-disabled'
				}
			};

			for (key in cssClasses) {
				var property = cssClasses[key];
				this.$wrapper
					.removeClass(cssPrefix + (property.status ? property.disabled : property.enabled))
					.addClass(cssPrefix + (property.status ? property.enabled : property.disabled));
			}
		},

		/**
		 *
		 */
		_bind: function() {
			var self = this;

			// Hammer: pan, pinch, swipe, tap, double-tap
			if (!this.settings.disableHammerPlugin && typeof Hammer == "function") {
				this.hammerManager = new Hammer.Manager( this.$overlay[0] );

				this.hammerManager.add(new Hammer.Pan({ threshold: 0, pointers: 0 }));
				this.hammerManager.add(new Hammer.Pinch({ threshold: 0 })).recognizeWith( this.hammerManager.get('pan') );
				this.hammerManager.add(new Hammer.Swipe()).recognizeWith( this.hammerManager.get('pan') );
				this.hammerManager.add(new Hammer.Tap({ event: 'doubletap', taps: 2 }));
				this.hammerManager.add(new Hammer.Tap());

				this.hammerManager.on("panstart panmove panend", function(evt) { self._onPan(evt); } );
				this.hammerManager.on("pinchstart pinchmove pinchend", function(evt) { self._onPinch(evt); } );
				this.hammerManager.on("swipe", function(evt) { self._onSwipe(evt); } );
				this.hammerManager.on("tap", function(evt) { self._onTap(evt); } );
				this.hammerManager.on("doubletap", function(evt) { self._onDoubleTap(evt); } );
			}

			// MouseWheel: zoom
			if (!this.settings.disableMouseWheelPlugin && typeof jQuery.fn.mousewheel == "function") {
				this.$overlay.on('mousewheel', function(evt) { self._onMouseWheel(evt); } );
			}
		},

		/**
		 *
		 */
		_unbind: function() {
			if (this.hammerManager) {
				this.hammerManager.stop(true); // immediate stop recognition
				this.hammerManager.destroy();
				this._isPanning(false);
				this._isPinching(false);
			}
			this.$overlay.unbind('mousewheel');
		},

		/**
		 *
		 */
		_onPan: function(evt) {
			if (this.settings.disabled || this.settings.disablePan) {
				return;
			}

			if (evt.type == 'panstart') {
				this._isPanning(true);
				this.panStart = {
					imagePosition: this._imagePosition(),
					cursorPosition: new Point(evt.pointers[0].screenX, evt.pointers[0].screenY)
				};
				this._trigger('panstart', [this.panStart.imagePosition]);
			}
			else if (evt.type == 'panend') {
				this._isPanning(false);
				this.$wrapper.removeClass(cssPrefix + 'is-panning');
				this._trigger('panend', [this._imagePosition()]);
			}
			else {
				var position = new Point(
					this.panStart.imagePosition.x + (evt.pointers[0].screenX - this.panStart.cursorPosition.x),
					this.panStart.imagePosition.y + (evt.pointers[0].screenY - this.panStart.cursorPosition.y)
				);
				var updatedPosition = this._move(position);
				this._trigger('panmove', [updatedPosition]);
			}
			evt.preventDefault();
		},

		/**
		 *
		 */
		_onPinch: function(evt) {
			if (this.settings.disabled || this.settings.disableZoom) {
				return;
			}

			if (evt.type == 'pinchstart') {
				this._isPinching(true);

				// Save center between two points for relative positioning of image
				var p1 = new Point(evt.pointers[0].pageX || 0, evt.pointers[0].pageY || 0);
				var p2 = new Point(evt.pointers[1].pageX || 0, evt.pointers[1].pageY || 0);
				var touchCenter = new Point( (p1.x + p2.x) / 2, (p1.y + p2.y) / 2 );

				var imageSize = this._imageSize();
				var relativeOrigin = new Scale(
					(touchCenter.x - this.$image.offset().left) / imageSize.width,
					(touchCenter.y - this.$image.offset().top) / imageSize.height
				);

				this.pinchStart = {
					imageSize: imageSize,
					imagePosition: this._imagePosition(),
					relativeOrigin: relativeOrigin
				};
				this._trigger('pinchstart', [imageSize, this.pinchStart.imagePosition]);
			}
			else if (evt.type == 'pinchend') {
				this._isPinching(false);
				this._trigger('pinchend', [this._imageSize(), this._imagePosition()]);
			}
			else {
				// Here we do NOT depend on the internal zoomTo method because while
				// pinching we have to depend on the values on pinch starts. zoomTo
				// calculates the values for zooming each step and does not depend on
				// the start values.
				var size = new Size(
					this.pinchStart.imageSize.width * evt.scale,
					this.pinchStart.imageSize.height * evt.scale
				);
				var updatedSize = this._resize(size);

				// Only update position if size has been changed
				if (updatedSize.width > -1) {
					var deltaWidth = updatedSize.width - this.pinchStart.imageSize.width;
					var deltaHeight = updatedSize.height - this.pinchStart.imageSize.height;
					var position = new Point(
						this.pinchStart.imagePosition.x - (deltaWidth * this.pinchStart.relativeOrigin.x),
						this.pinchStart.imagePosition.y - (deltaHeight * this.pinchStart.relativeOrigin.y)
					);
					var updatedPosition = this._move(position);
					this._trigger('pinchmove', [updatedSize, updatedPosition]);
				}
			}
			evt.preventDefault();
		},

		/**
		 *
		 */
		_onSwipe: function(evt) {
			if (this.settings.disabled) {
				return;
			}

			// Only trigger event
			var eventType;
			switch (evt.direction) {
				case  8: eventType = 'swipetop'; break;
				case  4: eventType = 'swiperight'; break;
				case 16: eventType = 'swipebottom'; break;
				case  2: eventType = 'swipeleft'; break;
			};
			if (eventType) {
				this._trigger(eventType, [evt]);
				evt.preventDefault();
			}
		},

		/**
		 *
		 */
		_onTap: function(evt) {
			if (this.settings.disabled) {
				return;
			}

			// TODO: Should be do any action here?

			this._trigger('tap', [evt]);
			evt.preventDefault();
		},

		/**
		 *
		 */
		_onDoubleTap: function(evt) {
			if (this.settings.disabled) {
				return;
			}

			var zoom;
			var imageSize = this._imageSize();
			switch (this.settings.doubleTap) {
				case 'open':
					var src = this.$image.attr('src');
					window.open(src);
					break;

				case 'zoomMax':
					zoom = this.settings.maxZoom;
					break;

				case 'zoomToggle':
					if (imageSize.width == this.sizeConstraints.width.max) {
						this._resetSize();
						this._center();
					}
					else {
						zoom = this.settings.maxZoom;
					}
					break;
			}
			if (zoom) {
				var origin = new Scale(
					(evt.pointers[0].pageX - this.$image.offset().left) / imageSize.width,
					(evt.pointers[0].pageY - this.$image.offset().top) / imageSize.height
				);
				this._zoomTo(zoom, origin);
			}

			this._trigger('doubletap', [evt]);
			evt.preventDefault();
		},

		/**
		 * Event handler for mouse wheel events.
		 */
		_onMouseWheel: function(evt) {
			if (this.settings.disabled || this.settings.disableZoom || this._isPinching()) {
				return;
			}

			var zoom = this._getZoom() + (this.settings.zoomStep * evt.deltaY);

			var imageSize = this._imageSize();
			var origin = new Scale(
				(evt.pageX - this.$image.offset().left) / imageSize.width,
				(evt.pageY - this.$image.offset().top) / imageSize.height
			);
			var sizeAndPosition = this._zoomTo(zoom, origin);

			this._trigger('mousewheel', [sizeAndPosition.size, sizeAndPosition.position]);
			evt.preventDefault();
		},

		/**
		 *
		 */
		_setConstraints: function() {
			this.sizeConstraints = {
				width : {
					min: this.naturalSize.width * this.settings.minZoom,
					max: this.naturalSize.width * this.settings.maxZoom
				},
				height : {
					min: this.naturalSize.height * this.settings.minZoom,
					max: this.naturalSize.height * this.settings.maxZoom
				}
			};
		},

		/**
		 *
		 */
		_resetSize: function() {
			var size = this.originSize;
			if (typeof this.settings.initialSize == 'string') {
				switch (this.settings.initialSize) {
					case "auto":
						size = this._getAutoFitSize();
						break;

					case "min":
						size = new Size(this.sizeConstraints.width.min, this.sizeConstraints.height.min);
						break;

					case "max":
						size = new Size(this.sizeConstraints.width.max, this.sizeConstraints.height.max);
						break;
				}
			}
			var updatedSize = this._resize(size);
			this._trigger('resetSize', [updatedSize]);
		},

		/**
		 * Try to make size 100% width or 100% height so the whole image is visible
		 */
		_getAutoFitSize: function() {
			var overlaySize = this._overlaySize();
			var imageSize = this._imageSize();
			var isLandscapeFormat = (overlaySize.width / overlaySize.height) > 1;
			if (isLandscapeFormat) {
				size = new Size(imageSize.width * (overlaySize.height / imageSize.height), overlaySize.height);
			}
			else {
				size = new Size(overlaySize.width, imageSize.height * (overlaySize.width / imageSize.width));
			}
			return size;
		},

		/**
		 *
		 */
		_center: function(dimension) {
			var imageSize = this._imageSize();
			var overlaySize = this._overlaySize();
			var position = this._imagePosition();
			switch (dimension) {
				case 'x':
				case 'horizontal':
					position.x = (overlaySize.width - imageSize.width) / 2;
					break;
				case 'y':
				case 'vertical':
					position.y = (overlaySize.height - imageSize.height) / 2;
					break;
				default:
					position = new Point((overlaySize.width - imageSize.width) / 2, (overlaySize.height - imageSize.height) / 2);
			}
			var updatedPosition = this._move(position);
			this._trigger('center', [updatedPosition]);
		},

		/**
		 * Updates the position of the image considerungs position constraints, so image is
		 * always visible in overlay.
		 * Additionally it's possible that image is always centered horizontally, vertically
		 * or both, if image width or height is less than overlay width or height.
		 */
		_move: function(position) {
			var self = this;
			var overlaySize = this._overlaySize();
			var imageSize = this._imageSize();


			if (imageSize.width <= overlaySize.width) {
				var left = Math.min( Math.max(0, position.x), overlaySize.width - imageSize.width );
				if (self.settings.autoCenter == true || self.settings.autoCenter == 'both' || self.settings.autoCenter == 'horizontal') {
					left = Math.round( (overlaySize.width - imageSize.width) / 2 );
				}
			}
			else {
				var left = Math.max( Math.min(0, position.x), overlaySize.width - imageSize.width );
			}


			if (imageSize.height <= overlaySize.height) {
				var top = Math.min( Math.max(0, position.y), overlaySize.height - imageSize.height );
				if (self.settings.autoCenter == true || self.settings.autoCenter == 'both' || self.settings.autoCenter == 'vertical') {
					top = Math.round( (overlaySize.height - imageSize.height) / 2 );
				}
			}
			else {
				var top = Math.max( Math.min(0, position.y), overlaySize.height - imageSize.height );
			}

			var adjustedPosition = new Point(left, top);
			if (this._triggerHandler('beforePositionChange', [adjustedPosition]) === false) {
				return new Point(-1, -1);
			}
			else {
				this._imagePosition(adjustedPosition);
				this._trigger('positionChanged', [adjustedPosition])
				return adjustedPosition;
			}
		},

		/**
		 * Updates the size of the image considering the size constraints. After setting
		 * the new size is returned because it can differ from input size.
		 */
		_resize: function(size) {
			var adjustedSize = new Size(
				Math.max(Math.min(size.width, this.sizeConstraints.width.max), this.sizeConstraints.width.min),
				Math.max(Math.min(size.height, this.sizeConstraints.height.max), this.sizeConstraints.height.min)
			);
			if (this._triggerHandler('beforeSizeChange', [adjustedSize]) === false) {
				return new Size(-1, -1);
			}
			else {
				this._imageSize(adjustedSize);
				this._trigger('sizeChanged', [adjustedSize])
				return adjustedSize;
			}
		},

		/**
		 *
		 */
		_overlaySize: function() {
			return new Size(this.$overlay.width(), this.$overlay.height());
		},

		/**
		 * Getter and setter for image size.
		 */
		_imageSize: function(size) {
			if (size) {
				this.$image.width(size.width);
				this.$image.height(size.height);
			}
			else {
				return new Size(this.$image.width(), this.$image.height());
			}
		},

		/**
		 * Getter and setter for image position.
		 */
		_imagePosition: function(position) {
			if (position) {
				this.$image.css({
					left: position.x,
					top: position.y
				});
			}
			else {
				return new Point(this.$image.css('left'), this.$image.css('top'));
			}
		},

		/**
		 *
		 */
		_isPanning: function(value) {
			if ((value === true || value === false) && this.panning !== value) {
				this.panning = value;
				this.$wrapper.toggleClass(cssPrefix + 'is-panning');
			}
			else {
				return this.panning;
			}
		},

		/**
		 *
		 */
		_isPinching: function(value) {
			if ((value === true || value === false) && this.pinching !== value) {
				this.pinching = value;
				this.$wrapper.toggleClass(cssPrefix + 'is-pinching');
			}
			else {
				return this.pinching;
			}
		},

		/**
		 *
		 */
		_getZoom: function() {
			return this._imageSize().width / this.naturalSize.width;
		},

		/**
		 *
		 */
		_zoomTo: function(zoom, origin) {
			if (this.settings.disabled || this.settings.disableZoom) {
				return false;
			}

			// Update size
			var imageSize = this._imageSize();
			var newWidth =  this.naturalSize.width * zoom;
			var newHeight = parseInt(newWidth / imageSize.width * imageSize.height);
			var updatedSize = this._resize(new Size(newWidth, newHeight));

			// Only update position if size has been changed
			var updatedPosition = undefined;
			if (updatedSize.width > -1) {
				// if there is no origin given, we define it as center of the image
				if (!origin) {
					origin = new Scale(0.5, 0.5);
				}
				var deltaWidth = updatedSize.width - imageSize.width;
				var deltaHeight = updatedSize.height - imageSize.height;

				var imagePosition = this._imagePosition();
				var position = new Point(
					imagePosition.x - (deltaWidth * origin.x),
					imagePosition.y - (deltaHeight * origin.y)
				);
				updatedPosition = this._move(position);
			}
			return {
				size: updatedSize,
				position: updatedPosition
			};
		},

		/**
		 *
		 */
		_trigger: function(eventType, args) {
			var optionName = 'on' + eventType.ucfirst();
			if (typeof this.settings[optionName] == 'function') {
				var f = this.settings[optionName];
				f.apply(this.$image, args);
			}
			this.$image.trigger(eventType, args);
		},

		/**
		 *
		 */
		_triggerHandler: function(eventType, args) {
			var optionName = 'on' + eventType.ucfirst(),
				callbackResult = undefined,
				result;
			if (typeof this.settings[optionName] == 'function') {
				var f = this.settings[optionName];
				callbackResult = f.apply(this.$image, args);
			}
			result = ((result = this.$image.triggerHandler(eventType, args)) !== undefined ? result : callbackResult);
			return result;
		},

		/**
		 *
		 */
		enable: function() {
			this.settings.disabled = false;
			this._setCssClasses();
		},

		/**
		 *
		 */
		disable: function() {
			this.settings.disabled = true;
			this._setCssClasses();

			// Stop hammer recognition
			if (this.hammerManager) {
				this.hammerManager.stop(true);
				this._isPanning(false);
				this._isPinching(false);
			}
		},

		/**
		 *
		 */
		isDisable: function() {
			return this.settings.disabled;
		},
		/**
		 *
		 */
		isPanning: function() {
			return this._isPanning();
		},

		/**
		 *
		 */
		isPinching: function() {
			return this._isPinching;
		},

		/**
		 *
		 */
		size: function() {
			return this._imageSize();
		},

		/**
		 *
		 */
		position: function() {
			return this._imagePosition();
		},

		/**
		 *
		 */
		reset: function() {
			this._resetSize();
			this._center();
		},

		/**
		 *
		 */
		resetSize: function() {
			this._resetSize();
		},

		/**
		 *
		 */
		center: function(dimension) {
			this._center(dimension);
		},

		/**
		 * Getter  and setter for zoom. Parameter origin is optional, but should be used for better
		 * usability experience.
		 */
		zoom: function(zoom, origin) {
			if (!zoom) {
				// return current zoom, rounded to 3 decimals
				var zoom = this._getZoom();
				return Math.round(zoom * 1000) / 1000;
			}
			else {
				this._zoomTo(zoom, origin);
			}
		},

		/**
		 * Increments the zoom by settings.zoomStep.
		 */
		zoomIn: function(origin) {
			var zoom = this._getZoom() + this.settings.zoomStep;
			return this._zoomTo(zoom, origin);
		},

		/**
		 * Descrements the zoom by settings.zoomStep.
		 */
		zoomOut: function(origin) {
			var zoom = this._getZoom() - this.settings.zoomStep;
			return this._zoomTo(zoom, origin);
		},

		/**
		 *
		 */
		option: function(key, value) {
			if (!key) {
				// Return copy of current settings
				return $.extend({}, this.settings);
			}
			else {
				var options;
				if (typeof key == 'string') {
					if (arguments.length === 1) {
						// Return specific value of settings
						return (this.settings[key] !== undefined ? this.settings[key] : null);
					}
					options = {};
					options[key] = value;
				} else {
					options = key;
				}
				this._setOptions(options);
				this._setCssClasses();
			}
		},

		/**
		 *
		 */
		_setOptions: function(options) {
			for (key in options) {
				var value = options[key];

				// Disable/modify plugin before we apply new settings
				if ($.inArray(key, ['disableHammerPlugin', 'disableMouseWheelPlugin']) > -1) {
					this._unbind();
				}
				else if ($.inArray(key, ['disabled', 'disablePan', 'disableZoom']) > -1 && this.hammerManager) {
					this.hammerManager.stop(true);
				}
				else if (key == 'cssWrapperClass' && typeof this.settings.cssWrapperClass == 'string') {
					this.$wrapper.removeClass(this.settings.cssWrapperClass);
				}

				// Apply option
				this.settings[key] = value;

				// Disable/modify plugin before we apply new settings
				if ($.inArray(key, ['disableHammerPlugin', 'disableMouseWheelPlugin']) > -1) {
					this._bind();
				}
				else if ($.inArray(key, ['disabled', 'disablePan', 'disableZoom']) > -1 && this.hammerManager) {
					this.hammerManager.stop(true);
				}
				else if (key == 'cssWrapperClass' && typeof this.settings.cssWrapperClass == 'string') {
					this.$wrapper.addClass(this.settings.cssWrapperClass);
				}
				else if ($.inArray(key, ['minZoom', 'maxZoom']) > -1) {
					// Update constraints and set current zoom again to apply new constraints
					this._setConstraints();
					var zoom = this._getZoom();
					this._zoomTo(zoom);
				}
				else if (key == 'autoCenter') {
					switch (value) {
						case true:
						case 'both':
							this._center();
							break;

						case 'horizontal':
						case 'vertical':
							this._center(value);
							break;
					}
				}
			}
		},

		/**
		 *
		 */
		destroy: function() {
			this.$image.trigger('destroy');

			this._unbind();
			this._unwrap();

			// When reseting style it's important to remove style first and then set it again
			// because this.originStyle can be undefined and if so only settings style won't
			// do the job correctly
			this.$image.removeAttr('style').attr('style', this.originStyle);
			this._imageSize(this.originSize);

			this._isPanning(false);
			this._isPinching(false);

			this.$image.removeData(datakey);
		}
	};

	/**
	 *
	 */
	$.fn.apImageZoom = function( options ) {
		if (typeof options === 'string') {
			var instance, method, result, returnValues = [];
			var params = Array.prototype.slice.call(arguments, 1);
			this.each(function() {
				instance = $(this).data(datakey);
				if (!instance) {
					returnValues.push(undefined);
				}
				// Ignore private methods
				else if ((typeof (method = instance[options]) === 'function') && (options.charAt(0) !== '_')) {
					var result = method.apply(instance, params);
					if (result !== undefined) {
						returnValues.push(result);
					}
				}
			});
			// Return an array of values for the jQuery instances
			// Or the value itself if there is only one
			// Or keep chaining
			return returnValues.length ? (returnValues.length === 1 ? returnValues[0] : returnValues) : this;
		}
		return this.each(function() {
			new ApImageZoom(this, options);
		});
	};

	/**
	 * Default settings for ApZoomImage plugin.
	 */
	ApImageZoom.defaultSettings = {
		disableHammerPlugin: false,
		disableMouseWheelPlugin: false,

		disabled: false,
		disablePan: false,
		disableZoom: false,

		initialSize: 'auto',		// Options: 'none', 'auto', 'min', 'max'
		cssWrapperClass: null,
		minZoom: 0.2,				// = 20%
		maxZoom: 1.0,				// = 100%
		zoomStep: 0.1,				// = 10% steps
		autoCenter : true,			// Options: true, 'both', 'horizontal', 'vertical'

		doubleTap: null,			// Options: 'open', 'zoomMax', 'zoomToggle'

		onBeforeSizeChange: undefined,
		onSizeChanged: undefined,
		onBeforePositionChange: undefined,
		onPositionChanged: undefined
	};

}(jQuery));
