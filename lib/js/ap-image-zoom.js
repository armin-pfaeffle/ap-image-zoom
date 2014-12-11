 /**
* @license ap-image-zoom.js v1.3
* Updated: 11.12.2014
* {DESCRIPTION}
* Copyright (c) 2014 armin pfaeffle
* Released under the MIT license
* http://armin-pfaeffle.de/licenses/mit
*/

;(function($) {

	var datakey = '__apiz__';
	var cssPrefix = 'apiz-';
	var eventNamespace = 'apiz';
	var triggerEventPrefix = 'apiz';


	/**
	 * Makes the first character of str uppercase and returns that string.
	 */
	function ucfirst(str) {
		str += ''; // ensure that str is a string
		var c = str.charAt(0).toUpperCase();
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
	 *
	 */
	jQuery.fn.tagName = function() {
		return this.prop("tagName").toLowerCase();
	};

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
	function ApImageZoom(element, options) {
		// Do not remake the zoom plugin
		var data = $(element).data(datakey);
		if (data) {
			return data;
		}

		this.settings = $.extend({}, ApImageZoom.defaultSettings, options);
		this.$target = $(element);
		this.mode = (this.$target.tagName() == 'img' ? 'image' : 'container');
		this.imageUrl = (this.mode == 'image' ? this.$target.attr('src') : this.settings.imageUrl);
		this._init();

		// Save the instance
		this.$target.data(datakey, this);
		if (this.mode == 'container') {
			this.$image.data(datakey, this);
		}
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

			this.loading = true;
			this.dragging = false;
			this.pinching = false;
			this.preventClickBecauseOfDragging = false;
			this.preventClickForDoubleClick = false;

			this._addWrapper();
			this._updateCssClasses();

			if (!this.imageUrl) {
				this.loading = false;
				this._showError('Invalid image url!');
				this.disable();
			}
			else {
				// Create a temporary hidden copy of image, so we obtain the real/natural size
				// We have to define the variable first, because of IE8 and lower
				this.$image = $('<img />');
				this.$image
					.hide()
					.prependTo(this.$wrapper)
					.load(function() {
						self._obtainNaturalImageSize();
						self._setup();
						self.$wrapper.removeClass(cssPrefix + 'loading');
					})
					.error(function() {
						self.loading = false;
						self.$wrapper.removeClass(cssPrefix + 'loading');
						self._showError('Error loading image!');
						self.disable();
					})
					.attr('src', this.imageUrl);
			}
		},

		/**
		 *
		 */
		_addWrapper: function() {
			// Setup wrapper and overlay which is for detecting all events
			this.$wrapper = $('<div></div>')
								.addClass(cssPrefix + 'wrapper')
								.addClass(cssPrefix + 'mode-' + this.mode)
								.addClass(cssPrefix + 'loading');
			this.$overlay = $('<div></div>')
								.addClass(cssPrefix + 'overlay')
								.appendTo(this.$wrapper);

			this._addLoadingAnimation();

			// Hide image and move it into added wrapper or add wrapper target container
			if (this.mode == 'image') {
				this.imageIsVisible = this.$target.is(':visible');
				this.$target
					.hide()
					.after(this.$wrapper)
					.appendTo(this.$wrapper);
			}
			else {
				this.$wrapper.appendTo(this.$target);
			}
		},

		/**
		 *
		 */
		_removeWrapper: function() {
			if (this.mode == 'image') {
				this.$wrapper.after(this.$target);
				if (this.imageIsVisible) {
					this.$target.show();
				}
			}
			this.$wrapper.remove();
		},

		/**
		 *
		 */
		_updateCssClasses: function() {
			if (typeof this.settings.cssWrapperClass == 'string' && !this.$wrapper.hasClass(this.settings.cssWrapperClass)) {
				this.$wrapper.addClass(this.settings.cssWrapperClass);
			}
			var cssClasses = {
				hammer: {
					status: this.settings.hammerPluginEnabled,
					enabled: 'hammer-enabled',
					disabled: 'hammer-disabled'
				},
				mouseWheel: {
					status: this.settings.mouseWheelPluginEnabled,
					enabled: 'mouse-wheel-enabled',
					disabled: 'mouse-wheel-disabled'
				},
				enabled: {
					status: !this.settings.disabled,
					enabled: 'enabled',
					disabled: 'disabled'
				},
				enableDragging: {
					status: this.settings.dragEnabled,
					enabled: 'drag-enabled',
					disabled: 'drag-disabled'
				},
				enableZooming: {
					status: this.settings.zoomEnabled,
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
		_addLoadingAnimation: function() {
			var $element;
			switch (this.settings.loadingAnimation) {
				case 'text':
					$element = $('<div></div>').addClass(cssPrefix + 'loading-animation-text');
					$element.html(this.settings.loadingAnimationData);
					break;

				case 'throbber':
					$element = $('<div></div>').addClass(cssPrefix + 'throbber');
					var circles = ['one', 'two', 'three'];
					for (index in circles) {
						$element.append( $('<div></div>').addClass(cssPrefix + 'circle ' + cssPrefix + 'circle-' + circles[index]) );
					}
					break;

				case 'image':
					$element = $('<div></div>').addClass(cssPrefix + 'loading-animation-image');
					$element.css('background-image', 'url(\'' + this.settings.loadingAnimationData + '\')');
					break;
			}

			if (this._triggerHandler('beforeShowLoadingAnimation', [$element]) !== false) {
				this.$loadingAnimation = $element;
				this.$wrapper
					.append($element)
					.addClass(cssPrefix + 'loading-animation');
				this._trigger('showLoadingAnimation');
			}
		},

		/**
		 *
		 */
		_removeLoadingAnimation: function() {
			var self = this;
			if (this.$loadingAnimation) {
				if (typeof this.settings.loadingAnimationFadeOutDuration == 'number') {
					this.$loadingAnimation.fadeOut(this.settings.loadingAnimationFadeOutDuration, function() {
						$(this).remove();
						self.$wrapper.removeClass(cssPrefix + 'loading-animation');
						self._trigger('hideLoadingAnimation');
					});
				}
				else {
					this.$loadingAnimation.remove();
					this.$wrapper.removeClass(cssPrefix + 'loading-animation');
					this._trigger('hideLoadingAnimation');
				}
				this.$loadingAnimation = undefined;
			}
		},

		/**
		 *
		 */
		_obtainNaturalImageSize: function() {
			var $image = (this.mode == 'image' ? this.$target : this.$image);
			this.naturalSize = new Size(this.$image.width(), this.$image.height());
		},

		/**
		 *
		 */
		_setup: function() {
			// Default zoom is 1.0, but is validated by min and max zoom and image is centered
			this.currentPosition = new Point(-1 * this.naturalSize.width / 2, -1 * this.naturalSize.height / 2);
			this.currentSize = new Size(this.naturalSize.width, this.naturalSize.height);
			this.currentZoom = this._getValidZoom(1.0);

			this._resetZoom();
			this._center();
			this._bind();

			this.loading = false;

			// Show image
			this._removeLoadingAnimation();
			if (typeof this.settings.loadingAnimationFadeOutDuration == 'number') {
				this.$image.fadeIn(this.settings.loadingAnimationFadeOutDuration);
			}
			else {
				this.$image.show();
			}

			this._trigger('init');
		},

		/**
		 *
		 */
		_bind: function() {
			var self = this;

			// Hammer: pan, pinch, swipe, tap, double-tap
			if (this.settings.hammerPluginEnabled && typeof Hammer == "function") {
				this.hammerManager = new Hammer.Manager( this.$overlay[0] );

				this.hammerManager.add(new Hammer.Pan({ threshold: 0, pointers: 0 }));
				this.hammerManager.add(new Hammer.Pinch({ threshold: 0 })).recognizeWith( this.hammerManager.get('pan') );
				this.hammerManager.add(new Hammer.Swipe()).recognizeWith( this.hammerManager.get('pan') );
				this.hammerManager.add(new Hammer.Tap({ event: 'doubletap', taps: 2, threshold: 15, posThreshold: 100 })).recognizeWith( this.hammerManager.get('pan') );
				this.hammerManager.add(new Hammer.Tap());

				this.hammerManager.on("panstart panmove panend", function(evt) { self._onDrag(evt); } );
				this.hammerManager.on("pinchstart pinchmove pinchend", function(evt) { self._onPinch(evt); } );
				this.hammerManager.on("swipe", function(evt) { self._onSwipe(evt); } );
				this.hammerManager.on("tap", function(evt) { self._onClick(evt); } );
				this.hammerManager.on("doubletap", function(evt) { self._onDoubleClick(evt); } );
			}
			else {
				// Drag & drop
				this.$overlay.on('mousedown.' + eventNamespace, function(evt) { self._onDrag(evt); } );
				$(document).on('mouseup.' + eventNamespace, function(evt) { self._onDrag(evt); } );
				$(document).on('mousemove.' + eventNamespace, function(evt) { self._onDrag(evt); } );

				// Click & double click
				this.$overlay.on('click.' + eventNamespace, function(evt) { self._onClick(evt); } );
				this.$overlay.on('dblclick.' + eventNamespace, function(evt) { self._onDoubleClick(evt); } );
			}

			// MouseWheel: zoom
			if (this.settings.mouseWheelPluginEnabled && typeof jQuery.fn.mousewheel == "function") {
				this.$overlay.mousewheel(function(evt, delta) { self._onMouseWheel(evt); return false; });
			}
		},

		/**
		 *
		 */
		_unbind: function() {
			if (this.hammerManager) {
				this.hammerManager.stop(true); // immediate stop recognition
				this.hammerManager.destroy();
				this._isDragging(false);
				this._isPinching(false);
			}
			else {
				this.$overlay.off('mousedown.' + eventNamespace);
				$(document).off('mouseup.' + eventNamespace);
				$(document).off('mousemove.' + eventNamespace);
			}
			this.$overlay.off('mousewheel.' + eventNamespace);
		},

		/**
		 *
		 */
		_onDrag: function(evt) {
			if (this.settings.disabled || !this.settings.dragEnabled) {
				return;
			}

			if (evt.type == 'panstart' || evt.type == 'mousedown') {
				this._isDragging(true);
				this.dragParams = {
					imagePosition: this.currentPosition,
					cursorPosition: new Point(
						(evt.type == 'panstart' ? evt.pointers[0].screenX : evt.screenX),
						(evt.type == 'panstart' ? evt.pointers[0].screenY : evt.screenY)
					)
				};
				if (evt.type == 'mousedown') {
					this.preventClickBecauseOfDragging = false;
				}
				this._trigger('dragStart', [this.currentPosition]);
			}
			else if (evt.type == 'panend' || evt.type == 'mouseup') {
				this._isDragging(false);
				this._trigger('dragEnd', [this.currentPosition]);
			}
			else if (evt.type == 'panmove' || (evt.type == 'mousemove' && this._isDragging())) {
				if (evt.type == 'mousemove') {
					this.preventClickBecauseOfDragging = true;
				}
				var position = new Point(
					this.dragParams.imagePosition.x + (evt.type == 'panmove' ? evt.pointers[0].screenX : evt.screenX) - this.dragParams.cursorPosition.x,
					this.dragParams.imagePosition.y + (evt.type == 'panmove' ? evt.pointers[0].screenY : evt.screenY) - this.dragParams.cursorPosition.y
				);
				this._move(position);
				this._trigger('dragMove', [this.currentPosition]);
			}

			evt.preventDefault();
		},

		/**
		 *
		 */
		_isDragging: function(value) {
			if ((value === true || value === false) && this.dragging !== value) {
				this.dragging = value;
				this.$wrapper.toggleClass(cssPrefix + 'dragging');
			}
			else {
				return this.dragging;
			}
		},

		/**
		 *
		 */
		_onPinch: function(evt) {
			if (this.settings.disabled || !this.settings.zoomEnabled) {
				return;
			}

			if (evt.type == 'pinchstart') {
				this._isPinching(true);

				// Save center between two points for relative positioning of image
				var p1 = new Point(evt.pointers[0].pageX || 0, evt.pointers[0].pageY || 0);
				var p2 = new Point(evt.pointers[1].pageX || 0, evt.pointers[1].pageY || 0);
				var touchCenter = new Point( (p1.x + p2.x) / 2, (p1.y + p2.y) / 2 );

				var relativeOrigin = new Scale(
					(touchCenter.x - this.$image.offset().left) / this.currentSize.width,
					(touchCenter.y - this.$image.offset().top) / this.currentSize.height
				);

				this.pinchParams = {
					zoom: this.currentZoom,
					imageSize: this.currentSize,
					imagePosition: this.currentPosition,
					relativeOrigin: relativeOrigin
				};
				this._trigger('pinchStart', [this.currentZoom, this.currentSize, this.currentPosition]);
			}
			else if (evt.type == 'pinchend') {
				this._isPinching(false);
				this._trigger('pinchEnd', [this.currentZoom, this.currentSize, this.currentPosition]);
			}
			else {
				// Here we do NOT depend on the internal zoomTo method because while
				// pinching we have to depend on the values on pinch starts. zoomTo
				// calculates the values for zooming each step and does not depend on
				// the start values.
				var zoom = this.pinchParams.zoom * evt.scale;
				this._zoomTo(zoom);

				var deltaWidth = this.currentSize.width - this.pinchParams.imageSize.width;
				var deltaHeight = this.currentSize.height - this.pinchParams.imageSize.height;
				var position = new Point(
					this.pinchParams.imagePosition.x - (deltaWidth * this.pinchParams.relativeOrigin.x),
					this.pinchParams.imagePosition.y - (deltaHeight * this.pinchParams.relativeOrigin.y)
				);
				this._move(position);

				this._trigger('pinchMove', [this.currentZoom, this.currentSize, this.currentPosition]);
			}
			evt.preventDefault();
		},

		/**
		 *
		 */
		_isPinching: function(value) {
			if ((value === true || value === false) && this.pinching !== value) {
				this.pinching = value;
				this.$wrapper.toggleClass(cssPrefix + 'pinching');
			}
			else {
				return this.pinching;
			}
		},

		/**
		 *
		 */
		_onSwipe: function(evt) {
			if (this.settings.disabled) {
				return;
			}

			// Only trigger event, so user can decide what to do with this event
			var eventType;
			switch (evt.direction) {
				case  8: eventType = 'swipeTop'; break;
				case  4: eventType = 'swipeRight'; break;
				case 16: eventType = 'swipeBottom'; break;
				case  2: eventType = 'swipeLeft'; break;
			};
			if (eventType) {
				this._handleAction(this.settings[eventType], evt);

				this._trigger(eventType, [evt]);
				evt.preventDefault();
			}
		},

		/**
		 *
		 */
		_onClick: function(evt) {
			if (this.settings.disabled || this.preventClickBecauseOfDragging || this.preventClickForDoubleClick) {
				return;
			}

			if (evt.type == 'click') {
				// Enable double click flag, so that there are not two click events
				// Microsoft Windows default double click time: 500ms
				var self = this;
				this.preventClickForDoubleClick = true;
				this.preventClickTimeout = setTimeout(function() {
					self.preventClickForDoubleClick = false;
					self.preventClickTimeout = undefined;
				}, 500);
			}

			this._handleAction(this.settings.click, evt);

			this._trigger('click', [evt]);
			evt.preventDefault();
		},

		/**
		 *
		 */
		_onDoubleClick: function(evt) {
			if (this.settings.disabled) {
				return;
			}

			// Unset double click timeout
			if (evt.type == 'dblclick' && this.preventClickTimeout) {
				this.preventClickForDoubleClick = false;
				clearTimeout(this.preventClickTimeout);
				this.preventClickTimeout = undefined;
			}

			this._handleAction(this.settings.doubleClick, evt);

			this._trigger('doubleClick', [evt]);
			evt.preventDefault();
		},

		/**
		 * Event handler for mouse wheel events.
		 */
		_onMouseWheel: function(evt) {
			if (this.settings.disabled || !this.settings.zoomEnabled || this._isDragging()) {
				return;
			}

			var zoom = this.currentZoom + (this.settings.zoomStep * evt.deltaY);
			var origin = new Scale(
				(evt.pageX - this.$image.offset().left) / this.currentSize.width,
				(evt.pageY - this.$image.offset().top) / this.currentSize.height
			);
			this._zoomTo(zoom, origin);

			this._trigger('mouseWheel', [this.currentZoom, this.currentSize, this.currentPosition]);
			evt.preventDefault();
		},

		/**
		 *
		 */
		_handleAction: function(action, evt, param) {
			if (typeof action == 'function') {
				action.apply(this.$target, evt);
			}
			else {
				switch (action) {
					case 'open':
						window.open(this.imageUrl);
						break;

					case 'zoomIn':
						this.zoomIn(param);
						break;

					case 'zoomOut':
						this.zoomOut(param);
						break;

					case 'zoomMin':
						this.zoomMin(param);
						break;

					case 'zoomMax':
						this.zoomMax(param);
						break;

					case 'zoomToggle':
						this.zoomToggle(param);
						break;

					case 'reset':
						this.reset();
						break;

					case 'center':
						this.center();
						break;
				}
			}
		},

		/**
		 *
		 */
		_getOverlaySize: function() {
			return new Size(this.$overlay.width(), this.$overlay.height());
		},

		/**
		 *
		 */
		_zoomTo: function(zoom, origin) {
			if (this.settings.disabled || !this.settings.zoomEnabled) {
				return false;
			}

			var oldZoom = this.currentZoom;
			var oldPosition = this.currentPosition;
			var oldSize = this.currentSize;

			if ((zoom = this._getValidZoom(zoom)) >= 0) {
				this.currentZoom = zoom;
				this.currentSize = new Size(this.naturalSize.width * this.currentZoom, this.naturalSize.height * this.currentZoom);
				this.currentPosition = this._getValidPosition(new Point(
					oldPosition.x - (this.currentSize.width - oldSize.width) * (origin ? origin.x : 0.5),
					oldPosition.y - (this.currentSize.height - oldSize.height) * (origin ? origin.y : 0.5)
				));

				this._updateSizeAndPosition();
			}
		},

		/**
		 *
		 */
		_getValidZoom: function(zoom, defaultZoom) {
			var zoom = this._parseZoom(zoom);
			var minZoom = this._parseZoom(this.settings.minZoom);
			var maxZoom = this._parseZoom(this.settings.maxZoom);

			if (zoom !== false) {
				if (minZoom !== false) {
					zoom = Math.max(zoom, minZoom);
				}
				if (maxZoom !== false) {
					zoom = Math.min(zoom, maxZoom);
				}
			}
			else {
				zoom = -1;
			}
			return zoom;
		},

		/**
		 *
		 */
		_parseZoom: function(zoom, defaultValue) {
			if (typeof zoom == 'number') {
				return zoom;
			}
			else if (typeof zoom == 'string') {
				var indexOfPercentage = zoom.indexOf('%');
				if (indexOfPercentage > 0 && indexOfPercentage == zoom.length - 1) {
					zoom = zoom.substr(0, indexOfPercentage) / 100;
					return zoom;
				}
				else if (zoom == 'contain' || zoom == 'cover') {
					var overlaySize = this._getOverlaySize();
					var zoomX = overlaySize.width / this.naturalSize.width;
					var zoomY = overlaySize.height / this.naturalSize.height;
					if (zoom == 'contain') {
						zoom = Math.min(zoomX, zoomY);
					}
					else {
						zoom = Math.max(zoomX, zoomY);
					}
					return zoom;
				}
			}

			if (defaultValue) {
				return defaultValue;
			}
			else {
				return false;
			}
		},

		/**
		 *
		 */
		_resetZoom: function() {
			var zoom;
			if (typeof this.settings.initialZoom == 'number' || this.settings.initialZoom == parseFloat(this.settings.initialZoom)) {
				zoom = parseFloat(this.settings.initialZoom);
			}
			else if (typeof this.settings.initialZoom == 'string') {
				switch (this.settings.initialZoom) {
					case "auto":
					case "contain":
						zoom = this._getValidZoom('contain');
						break;

					case "cover":
						zoom = this._getValidZoom('cover');
						break;

					case "min":
						zoom = this._parseZoom(this.settings.minZoom);
						break;

					case "max":
						zoom = this._parseZoom(this.settings.maxZoom);
						break;

					default:
						zoom = this._getValidZoom(this.settings.initialZoom);
				}
			}

			if (zoom) {
				this._zoomTo(zoom);
				this._trigger('resetZoom', [this.currentZoom, this.currentSize]);
			}
		},

		/**
		 * Updates the position of the image considerungs position constraints, so image is
		 * always visible in overlay. Additionally it's possible that image is always centered
		 * horizontally, vertically or both, if image width or height is less than overlay
		 * width or height.
		 */
		_move: function(position) {
			var adjustedPosition = this._getValidPosition(position);
			if (this._triggerHandler('beforePositionChange', [adjustedPosition]) === false) {
				return false;
			}
			else {
				this.currentPosition = adjustedPosition;
				this._updateSizeAndPosition();
				this._trigger('positionChanged', [this.currentPosition])
				return true;
			}
		},

		/**
		 *
		 */
		_getValidPosition: function(position) {
			var overlaySize = this._getOverlaySize();
			var left, top;

			// Adjust left value
			if (this.currentSize.width <= overlaySize.width) {
				if ($.inArray(this.settings.autoCenter, [true, 'both', 'x', 'h' , 'horizontal']) > -1) {
					left = -1 * this.currentSize.width / 2;
				}
				else {
					left = Math.min(Math.max(0 - overlaySize.width / 2, position.x), overlaySize.width / 2 - this.currentSize.width);
				}
			}
			else {
				left = Math.max(Math.min(0 - overlaySize.width / 2, position.x), overlaySize.width / 2 - this.currentSize.width);
			}
			left = Math.round(left);

			// Adjust top value
			if (this.currentSize.height <= overlaySize.height) {
				if ($.inArray(this.settings.autoCenter, [true, 'both', 'y', 'v' , 'vertical']) > -1) {
					top = -1 * this.currentSize.height / 2;
				}
				else {
					top = Math.min(Math.max(0 - overlaySize.height / 2, position.y), overlaySize.height / 2 - this.currentSize.height);
				}
			}
			else {
				top = Math.max(Math.min(0 - overlaySize.height / 2, position.y), overlaySize.height / 2 - this.currentSize.height);
			}
			top = Math.round(top);

			return new Point(left, top);
		},

		/**
		 * Centerizes image by dimension. If dimension is not given, image is centered
		 * horizontally and vertically.
		 */
		_center: function(dimension) {
			var position = new Point(this.currentPosition.x, this.currentPosition.y);
			switch (dimension) {
				case 'x':
				case 'h':
				case 'horizontal':
					position.x = -1 * this.currentSize.width / 2;
					break;

				case 'y':
				case 'v':
				case 'vertical':
					position.y = -1 * this.currentSize.height / 2;
					break;

				default:
					position = new Point(-1 * this.currentSize.width / 2, -1 * this.currentSize.height / 2);
			}
			this._move(position);
			this._trigger('center', [this.currentPosition]);
		},

		/**
		 * Updates the size and position of the image.
		 */
		_updateSizeAndPosition: function() {
			if (this.settings.hardwareAcceleration) {
				var matrix = 'matrix3d(' + this.currentZoom + ', 0, 0, 0, 0, ' + this.currentZoom + ', 0, 0, 0, 0, ' + this.currentZoom + ', 0, ' + this.currentPosition.x + ', ' + this.currentPosition.y + ', 0, 1)';
				this.$image.css({
					'-webkit-transform': matrix,
					'-moz-transform': matrix,
					'-ms-transform': matrix,
					'-o-transform': matrix,
					'transform': matrix
				});
			}
			else {
				var width = Math.round(this.naturalSize.width * this.currentZoom) + 'px';
				var height = Math.round(this.naturalSize.height * this.currentZoom) + 'px';
				var marginLeft = this.currentPosition.x + 'px';
				var marginTop = this.currentPosition.y + 'px';

				this.$image.css({
					width: width,
					height: height,
					marginLeft: marginLeft,
					marginTop: marginTop
				});
			}
		},

		/**
		 *
		 */
		_trigger: function(eventType, args, $context) {
			var optionName = 'on' + eventType.ucfirst(),
				f = this.settings[optionName];
			$context = ($context ? $context : this.$target);
			if (typeof f == 'function') {
				f.apply($context, args);
			}
			eventType = triggerEventPrefix + eventType.ucfirst();
			$context.trigger(eventType, args);
		},

		/**
		 *
		 */
		_triggerHandler: function(eventType, args, $context) {
			var optionName = 'on' + eventType.ucfirst(),
				f = this.settings[optionName],
				callbackResult = undefined,
				result;
			$context = ($context ? $context : this.$target);
			if (typeof f == 'function') {
				callbackResult = f.apply($context, args);
			}
			eventType = triggerEventPrefix + eventType.ucfirst();
			result = ((result = $context.triggerHandler(eventType, args)) !== undefined ? result : callbackResult);
			return result;
		},

		/**
		 *
		 */
		_showError: function(message) {
			if (!this.$errorMessage) {
				this.$errorMessage = $('<div></div>').addClass(cssPrefix + 'error-message');
				this.$wrapper.append(this.$errorMessage);
			}
			if (this.$loadingAnimation) {
				this.$loadingAnimation.remove();
			}
			this.$wrapper.addClass(cssPrefix + 'error');
			this.$errorMessage.html(message);

			this._trigger('error', message)
		},

		/**
		 *
		 */
		enable: function() {
			if (!this.loading) {
				this.settings.disabled = false;
				this._updateCssClasses();
			}
		},

		/**
		 *
		 */
		disable: function() {
			if (!this.loading) {
				this.settings.disabled = true;
				this._updateCssClasses();

				// Stop hammer recognition
				if (this.hammerManager) {
					this.hammerManager.stop(true);
					this._isDragging(false);
					this._isPinching(false);
				}
			}
		},

		/**
		 *
		 */
		isDisable: function() {
			return (this.loading ? undefined : this.settings.disabled);
		},
		/**
		 *
		 */
		isDragging: function() {
			return (this.loading ? undefined : this._isDragging());
		},

		/**
		 *
		 */
		isPinching: function() {
			return (this.loading ? undefined : this._isPinching());
		},

		/**
		 *
		 */
		isLoading: function() {
			return this.loading;
		},

		/**
		 *
		 */
		size: function() {
			return (this.loading ? undefined : this.currentSize);
		},

		/**
		 *
		 */
		position: function() {
			return (this.loading ? undefined : this.currentPosition);
		},

		/**
		 *
		 */
		reset: function() {
			if (!this.loading) {
				this._resetZoom();
				this._center();
			}
		},

		/**
		 *
		 */
		resetSize: function() {
			if (!this.loading) {
				this._resetZoom();
			}
		},

		/**
		 *
		 */
		center: function(dimension) {
			if (!this.loading) {
				this._center(dimension);
			}
		},

		/**
		 * Getter and setter for zoom. Parameter origin is optional, but should be used for better
		 * usability experience.
		 * Zoom value is always returned as float, truncated to five decimals.
		 */
		zoom: function(zoom, origin) {
			if (this.loading) {
				return undefined;
			}
			if (zoom) {
				this._zoomTo(zoom, origin);
			}
			zoom = Math.round(this.currentZoom * 100000) / 100000;
			return zoom;
		},

		/**
		 * Increments the zoom by settings.zoomStep.
		 */
		zoomIn: function(step, origin) {
			if (!this.loading) {
				var zoom = this.currentZoom + (step ? step : this.settings.zoomStep);
				this._zoomTo(zoom, origin);
			}
		},

		/**
		 * Descrements the zoom by settings.zoomStep.
		 */
		zoomOut: function(step, origin) {
			if (!this.loading) {
				var zoom = this.currentZoom - (step ? step : this.settings.zoomStep);
				this._zoomTo(zoom, origin);
			}
		},

		/**
		 *
		 */
		zoomMin: function(origin) {
			if (!this.loading) {
				this._zoomTo(this.settings.minZoom, origin);
			}
		},

		/**
		 *
		 */
		zoomMax: function(origin) {
			if (!this.loading) {
				this._zoomTo(this.settings.maxZoom, origin);
			}
		},

		/**
		 *
		 */
		zoomToggle: function(origin) {
			if (!this.loading) {
				if (this.isMaxZoomed()) {
					this._resetZoom();
					this._center();
				}
				else {
					this._zoomTo(this.settings.maxZoom, origin);
				}
			}
		},

		/**
		 *
		 */
		isMinZoomed: function() {
			if (this.loading) {
				return undefined;
			}
			else {
				var minZoom = this._parseZoom(this.settings.minZoom);
				if (typeof minZoom == 'number') {
					return Math.abs(this.currentZoom - minZoom) < 0.00001;
				}
				else {
					return false;
				}
			}
		},

		/**
		 *
		 */
		isMaxZoomed: function() {
			if (this.loading) {
				return undefined;
			}
			else {
				var maxZoom = this._parseZoom(this.settings.maxZoom);
				if (typeof maxZoom == 'number') {
					return Math.abs(maxZoom - this.currentZoom) < 0.00001;
				}
				else {
					return false;
				}
			}
		},

		/**
		 *
		 */
		option: function(key, value) {
			if (!key) {
				// Return copy of current settings
				return $.extend({}, this.settings);
			}
			else if (!this.loading) {
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
			}
		},

		/**
		 *
		 */
		_setOptions: function(options) {
			for (key in options) {
				var value = options[key];

				switch (key) {
					case 'hammerPluginEnabled':
					case 'mouseWheelPluginEnabled':
						this._unbind();
						break;

					case 'disabled':
					case 'dragEnabled':
					case 'zoomEnabled':
						if (this.hammerManager) {
							this.hammerManager.stop(true);
						}
						this._isDragging(false);
						this._isPinching(false);
						break;

					case 'cssWrapperClass':
						this.$wrapper.removeClass(this.settings.cssWrapperClass);
						break;

					case 'hardwareAcceleration':
						// Remove css style
						this.$image.css({
							'-webkit-transform': '',
							'-moz-transform': '',
							'-ms-transform': '',
							'-o-transform': '',
							'transform': '',
							'width': '',
							'height': '',
							'marginLeft': '',
							'marginTop': ''
						});
						break;
				}


				// Apply option
				this.settings[key] = value;


				// Enable/modify plugin
				switch (key) {
					case 'hammerPluginEnabled':
					case 'mouseWheelPluginEnabled':
						this._bind();
						break;

					case 'hardwareAcceleration':
						this._updateSizeAndPosition();
						break;

					case 'minZoom':
					case 'maxZoom':
						// Update current zoom, so min and max zoom are considered
						this._zoomTo(this.currentZoom);
						break;

					case 'autoCenter':
						switch (value) {
							case true:
							case 'both':
								this._center();
								break;

							case 'x':
							case 'h':
							case 'horizontal':
							case 'y':
							case 'v':
							case 'vertical':
								this._center(value);
								break;
						}
						break;
				}

				if ($.inArray(key, [
							'cssWrapperClass',
							'hammerPluginEnabled',
							'mouseWheelPluginEnabled',
							'disabled',
							'dragEnabled',
							'zoomEnabled'
					]) > -1) {

					this._updateCssClasses();
				}
			}
		},

		/**
		 *
		 */
		destroy: function() {
			if (!this.loading) {
				this._trigger('destroy');

				this._unbind();
				this._removeWrapper();

				this._isDragging(false);
				this._isPinching(false);

				this.$target.removeData(datakey);
				if (this.mode == 'container') {
					this.$image.removeData(datakey);
				}
			}
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
	 * Default settings for ApImageZoom plugin.
	 */
	ApImageZoom.defaultSettings = {
		imageUrl: undefined,
		loadingAnimation: undefined,			// Options: undefined, 'text', 'throbber', 'image'
		loadingAnimationData: undefined,
		loadingAnimationFadeOutDuration: 200,	// Options: value (float), false/null/undefined
		cssWrapperClass: undefined,
		initialZoom: 'auto',					// Options: value (float), 'none', 'auto', 'contain', 'cover', 'min', 'max'
		minZoom: 0.2,							// Options: value (float), 'contain', 'cover'
		maxZoom: 1.0,							// Options: value (float), 'contain', 'cover'
		zoomStep: 0.07,							// = 10% steps
		autoCenter : true,						// Options: true, 'both', 'x', 'h', horizontal', 'y', 'v', vertical'

		hammerPluginEnabled: true,
		mouseWheelPluginEnabled: true,
		hardwareAcceleration: true,

		disabled: false,
		dragEnabled: true,
		zoomEnabled: true,

		// Options: function(), 'open', 'zoomIn', 'zoomOut', 'zoomMin', 'zoomMax', 'zoomToggle', 'reset', 'center'
		// swipeTop: ,
		// swipeRight: ,
		// swipeBottom: ,
		// swipeLeft: ,
		// click: ,
		doubleClick: 'zoomToggle'
	};

}(jQuery));
