/**

Events:
panstart -- Parameter: evt, position
panmove -- Parameter: evt, position
panend -- Parameter: evt, position

pinchstart -- Parameter: evt, size, position
pinchmove -- Parameter: evt, size, position
pinchend -- Parameter: evt, size, position

mousewheel -- Parameter: evt, size, position



**/


;(function ($) {

	var PLUGIN_VERSION = "0.1";
	var PLUGIN_DATE = "20.08.2014";


	$.fn.apImageZoom = function( action, options )
	{
		// if action is an object then it's probably a call like this $(element).apImageZoom(options)
		// so we have to apply these options
		if (action instanceof Object != false) {
			options = action;
			action = null;
		}

		// Merge options
		var settings = $.extend( $.apImageZoom.settings.default, options );


		/**
		 * Initialization.
		 *
		 * @param $checkbox
		 */
		function create($image)
		{
			this.targetImage = $image;
			this.targetImage.data('originalStyle', this.targetImage.attr('style')); // TODO: in destroy einbauen
			this.targetImage.data('settings', settings);

			var imageCopy = $('<img />')
								.hide()
								.appendTo('body')
								.data('targetImage', this.targetImage);
			imageCopy.load(function() {
				obtainImageProperties(imageCopy);
				initialize();
				$(this).remove();
			});
			imageCopy.attr('src', this.targetImage.attr('src'));
		}

		/**
		 *
		 */
		function obtainImageProperties(imageCopy)
		{
			var settings = this.targetImage.data('settings');

			var imageWidth = imageCopy.width();
			var imageHeight = imageCopy.height();

			this.targetImage.data('originSize', new Size( imageWidth, imageHeight ) );
			this.targetImage.data('sizeConstraints', {
				width : { min: imageWidth * settings.minZoom, max: imageWidth * settings.maxZoom },
				height : { min: imageHeight * settings.minZoom, max: imageHeight * settings.maxZoom }
			});
		}

		/**
		 *
		 */
		function initialize()
		{
			wrapImage();
			setInitialSizeAndPosition();
			enableControlFocus();
			assignEvents();
			assignTriggerFunctions();
		}

		/**
		 *
		 */
		function wrapImage()
		{
			var image = this.targetImage;
			var settings = image.data('settings');

			// Setup wrapper and overlay
			var wrapper = $('<div></div>').addClass('apiz-wrapper');
			image.data('wrapper', wrapper);
			if (settings.cssWrapperClass && typeof settings.cssWrapperClass == 'string') {
				wrapper.addClass(settings.cssWrapperClass);
			}

			// Apply ID with prefix "apiz-" if image has one
			var id = image.attr('id');
			if (id && id.length > 0) {
				wrapper.attr('id', 'apiz-' + id);
			}

			var overlay = $('<div></div>').addClass('apiz-overlay');
			image.data('overlay', overlay);
			wrapper.append(overlay);

			// Replace image with wrapper and place image into wrapper
			image
				.after(wrapper)
				.prependTo(wrapper);
		}

		/**
		 *
		 */
		function setInitialSizeAndPosition()
		{
			var initialSize = this.targetImage.data('settings').initialSize;
			var overlay = this.targetImage.data('overlay');
			var overlaySize = new Size(overlay.width(), overlay.height());
			var size = null;
			if (initialSize && typeof initialSize == 'string') {
				var sizeConstraints = this.targetImage.data('sizeConstraints');
				switch (initialSize) {
					case "auto":
						// Try to make size 100% width or 100% height so the whole image is visible
						var overlayRatio = overlaySize.width / overlaySize.height;
						var imageSize = new Size(this.targetImage.width(), this.targetImage.height());
						if (overlayRatio <= 1) {
							size = new Size( overlaySize.width, imageSize.height * (overlaySize.width / imageSize.width) );
						} else {
							size = new Size( imageSize.width * (overlaySize.height / imageSize.height), overlaySize.height );
						}
						break;

					case "min":
						size = new Size(sizeConstraints.width.min, sizeConstraints.height.min);
						break;

					case "max":
						size = new Size(sizeConstraints.width.max, sizeConstraints.height.max);
						break;
				}
				if (size) {
					size = updateSize(this.targetImage, size);
				}
			}

			// Do not modify position if position has NOT be changed
			if (size && size.width == -1) {
				return;
			}

			// Gather current image size and height for centering image
			if (!size) {
				var size = new Size(this.targetImage.width(), this.targetImage.height());
			}
			var position = new Point((overlaySize.width - size.width) / 2, (overlaySize.height - size.height) / 2);
			updatePosition(this.targetImage, position);
		}

		/**
		 *
		 */
		function enableControlFocus()
		{
			var image = this.targetImage;
			var overlay = image.data('overlay');

			var tabIndex = image.attr('tabindex');
			if (tabIndex && tabIndex > 0) {
				image.removeAttr('tabindex');
				image.data('originTabIndex', tabIndex);
			}
			overlay.attr('tabindex', (tabIndex ? tabIndex : -1));
		}

		/**
		 *
		 */
		function assignEvents()
		{
			var settings = this.targetImage.data('settings');
			if (!settings.disableHammer && typeof Hammer == "function") {
				setupHammer();
			}
			if (!settings.disableMouseWheel && typeof jQuery.fn.mousewheel == "function") {
				this.targetImage.data('overlay').on('mousewheel', onMouseWheel);
			}
		}

		/**
		 *
		 */
		function assignTriggerFunctions()
		{
			var image = this.targetImage;
			var settings = image.data('settings');
			var events = [
				'onBeforeSizeUpdate',
				'onAfterSizeUpdate',
				'onBeforePositionUpdate',
				'onAfterPositionUpdate'
			];
			for (index in events) {
				var eventName = events[index];
				if (typeof settings[eventName] == 'function') {
					image.on(eventName, settings[eventName]);
				}
			}
		}

		/**
		 *
		 */
		function setupHammer()
		{
			var hammerManager = new Hammer.Manager( this.targetImage.data('overlay')[0] );

			hammerManager.add(new Hammer.Pan({ threshold: 0, pointers: 0 }));
			hammerManager.add(new Hammer.Pinch({ threshold: 0 })).recognizeWith( hammerManager.get('pan') );
			hammerManager.add(new Hammer.Swipe()).recognizeWith( hammerManager.get('pan') );
			hammerManager.add(new Hammer.Tap({ event: 'doubletap', taps: 2 }));
			hammerManager.add(new Hammer.Tap());

			hammerManager.on("panstart panmove panend", onPan);
			hammerManager.on("pinchstart pinchmove pinchend", onPinch);
			hammerManager.on("swipe", onSwipe);
			hammerManager.on("tap", onTap);
			hammerManager.on("doubletap", onDoubleTap);
		}

		/**
		 *
		 */
		function onPan(evt) {
			var wrapper = $(evt.target).parent();
			var image = wrapper.children('img');

			if (image.data('settings').disablePan) {
				return;
			}

			var currentPosition = new Point(image.css('left'), image.css('top'));
			if (evt.type == 'panstart') {
				image.data('isPanning', true);
				image.data('panStartPosition', currentPosition);
				image.data('panStartCursor', new Point(
					evt.pointers[0].screenX,
					evt.pointers[0].screenY
				));
				image.trigger('panstart', [currentPosition]);
			} else if (evt.type == 'panend') {
				image.data('isPanning', false);
				image.trigger('panend', [currentPosition]);
			} else {
				var startPosition = image.data('panStartPosition');
				var startCursor = image.data('panStartCursor');
				var left = startPosition.x + (evt.pointers[0].screenX - startCursor.x);
				var top = startPosition.y + (evt.pointers[0].screenY - startCursor.y);

				var setPosition = updatePosition(image, new Point(left, top));
				image.trigger('panmove', [setPosition]);
			}
			evt.preventDefault();
		}

		/**
		 *
		 */
		function onPinch(evt) {
			var wrapper = $(evt.target).parent();
			var image = wrapper.children('img');

			var currentSize = new Size(image.width(), image.height());
			var currentPosition = new Point(image.css('left'), image.css('top'));

			if (evt.type == 'pinchstart') {
				image.data('isPinching', true);
				image.data('pinchStartSize', currentSize);
				image.data('pinchStartPosition', currentPosition);

				// Save center between two points for relative positioning of image
				var x1 = evt.pointers[0].screenX || 0;
				var x2 = evt.pointers[1].screenX || 0;
				var y1 = evt.pointers[0].screenY || 0;
				var y2 = evt.pointers[1].screenY || 0;
				var touchCenter = new Point( (x1 + x2) / 2, (y1 + y2) / 2 );
				var relativeLeft = (touchCenter.x - image.offset().left) / currentSize.width;
				var relativeTop = (touchCenter.y - image.offset().top) / currentSize.height;
				image.data('pinchStartRelativePositioning', new Scale(relativeLeft, relativeTop));
				image.trigger('pinchstart', [currentSize, currentPosition]);
			} else if (evt.type == 'pinchend') {
				image.data('isPinching', false);
				image.trigger('pinchend', [currentSize, currentPosition]);
			} else {
				var startSize = image.data('pinchStartSize');
				var position = image.data('pinchStartPosition');
				var relativePositioning = image.data('pinchStartRelativePositioning');

				var width = parseInt(startSize.width * evt.scale);
				var height = parseInt(startSize.height * evt.scale);
				var setSize = updateSize(image, new Size(width, height));

				// Only update position if size has been changedvar setPosition =
				var setPosition = null;
				if (setSize.width > 0) {
					var deltaWidth = setSize.width - startSize.width;
					var deltaHeight = setSize.height - startSize.height;
					var p = new Point(
						position.x - (deltaWidth * relativePositioning.x),
						position.y - (deltaHeight * relativePositioning.y)
					);
					setPosition = updatePosition(image, p);
				}
				image.trigger('pinchmove', [size, setPosition]);
			}
			evt.preventDefault();
		}

		/**
		 *
		 */
		function onSwipe(evt)
		{
			// TODO
			// console.debug('onSwipe');
			// image.trigger('swipe', []);
			// image.trigger('swipeleft', []);
			// image.trigger('swiperight', []);
			// image.trigger('swipetop', []);
			// image.trigger('swipebottom', []);
			// evt.preventDefault();
		}

		/**
		 *
		 */
		function onTap(evt)
		{
			// TODO
			// console.debug('onTap');
			// image.trigger('tap', []);
			// evt.preventDefault();
		}

		/**
		 *
		 */
		function onDoubleTap(evt)
		{
			// TODO
			// console.debug('onDoubleTap');
			// image.trigger('doubletap', []);
			// evt.preventDefault();
		}

		/**
		 *
		 */
		function onMouseWheel(evt)
		{
			var parent = $(evt.target).parent();
			var image = parent.children('img');

			if (image.data('isPanning')) {
				return;
			}

			var settings = image.data('settings');
			var originSize = image.data('originSize');
			var width = parseInt(image.attr('width'));
			var height = parseInt(image.attr('height'));

			var newWidth =  width + originSize.width * settings.mouseWheelZoomSteps * evt.deltaY;
			var newHeight = parseInt(newWidth / width * height);
			var setSize = updateSize(image, new Size(newWidth, newHeight));

			// Only update position if size has been changed
			var setPosition = null;
			if (setSize.width > 0) {
				var deltaWidth = setSize.width - width;
				var deltaHeight = setSize.height - height;

				var relativeLeft = (evt.pageX - image.offset().left) / width;
				var relativeTop = (evt.pageY - image.offset().top) / height;

				var position = new Point(
					parseInt(image.css('left')) - (deltaWidth * relativeLeft),
					parseInt(image.css('top')) - (deltaHeight * relativeTop)
				);
				setPosition = updatePosition(image, position);
			}
			image.trigger('mousewheel', [setSize, setPosition]);
			evt.preventDefault();
		}

		/**
		 * Updates the size of the image considering the size constraints. After setting
		 * the new size is returned because it can differ from input size.
		 */
		function updateSize(image, size)
		{
			if (image.data('settings').disableZoom) {
				return;
			}

			var constraints = image.data('sizeConstraints');
			var width = Math.max(Math.min(size.width, constraints.width.max), constraints.width.min);
			var height = Math.max(Math.min(size.height, constraints.height.max), constraints.height.min);

			var newSize = new Size(width, height);
			if (image.triggerHandler('beforeSizeUpdate', [newSize]) === false) {
				return new Size(-1, -1);
			} else {
				image.attr({
					width: newSize.width,
					height: newSize.height
				});
				image.trigger('afterSizeUpdate', [newSize])
				return newSize;
			}
		}

		/**
		 * Updates the position of the image considerungs position constraints, so image is
		 * always visible in overlay.
		 * Additionally it's possible that image is always centered horizontally, vertically
		 * or both, if image width or height is less than overlay width or height.
		 */
		function updatePosition(image, position)
		{
			var settings = image.data('settings');
			var overlay = image.data('overlay');
			var imageSize = new Size( image.width(), image.height() );
			var overlaySize = new Size( overlay.width(), overlay.height() );

			if (imageSize.width <= overlaySize.width) {
				var left = Math.min( Math.max(0, position.x), overlaySize.width - imageSize.width );
				if (settings.autoCenter == true || settings.autoCenter == 'both' || settings.autoCenter == 'horizontal') {
					left = Math.round( (overlaySize.width - imageSize.width) / 2 );
				}
			} else {
				var left = Math.max( Math.min(0, position.x), overlaySize.width - imageSize.width );
			}

			if (imageSize.height <= overlaySize.height) {
				var top = Math.min( Math.max(0, position.y), overlaySize.height - imageSize.height );
				if (settings.autoCenter == true || settings.autoCenter == 'both' || settings.autoCenter == 'vertical') {
					top = Math.round( (overlaySize.height - imageSize.height) / 2 );
				}
			} else {
				var top = Math.max( Math.min(0, position.y), overlaySize.height - imageSize.height );
			}

			var newPosition = new Point(left, top);
			if (image.triggerHandler('beforePositionUpdate', [newPosition]) === false) {
				return new Point(-1, -1);
			} else {
				image.css({
					left: newPosition.x,
					top: newPosition.y
				});
				image.trigger('afterPositionUpdate', [newPosition])
				return newPosition;
			}
		}

		/**
		 * Handle each selected element.
		 */
		return this.each(function()
		{
			if (empty(action)) {
				create($(this));
			} /* TODO else if (action == '   ') {
				// TODO
			}
			reset
			resize
			center
			zoomIn
			zoomOut
			zoomTo
			enable
			disable
			isDisabled
			isPanning
			destroy


			Events
			onPanStart
			onPanMove
			onPanEnd

			onPinchStart
			onPinchEnd

			panzoomstart
			panzoomchange
			panzoomzoom
			panzoompan
			panzoomend
			panzoomreset

			*/else if (action == 'center') {
				// TODO
			}
		});
	};

	/**
	 *
	 */
	$.apImageZoom =
	{
		version: PLUGIN_VERSION,
		date: PLUGIN_DATE,

		settings: {
			default: {
				disableHammer: false,
				disableMouseWheel: false,

				initialSize: 'auto',		// Options: 'none', 'auto', 'min', 'max'
				cssWrapperClass: null,
				minZoom: 0.2,				// = 20%
				maxZoom: 1.0,				// = 100%
				mouseWheelZoomSteps: 0.1,	// = 10% steps
				autoCenter : true,			// Options: true, 'both', 'horizontal', 'vertical'

				disablePan: false,
				disableZoom: false,

				/* TODO */
				// doubleTap: 'open', 'zoom-max', 'zoom-toggle'

				onBeforeSizeUpdate: undefined,
				onAfterSizeUpdate: undefined,
				onBeforePositionUpdate: undefined,
				onAfterPositionUpdate: undefined
			}
		}
	};


	// ----------------------------------------------------------------------------------


	/**
	 *
	 */
	function Point(x, y)
	{
		this.x = Math.round(parseFloat(x));
		this.y = Math.round(parseFloat(y));
	}

	function Size(width, height)
	{
		this.width = Math.round(parseFloat(width));
		this.height = Math.round(parseFloat(height));
	}

	function Scale(x, y, z)
	{
		z = typeof z !== 'undefined' ? z : 1;
		this.x = parseFloat(x);
		this.y = parseFloat(y);
		this.z = parseFloat(z);
	}

	function empty(value)
	{
		return (value == undefined)
			|| (value == null)
			|| (value == false)
			|| (typeof value == "string" && value.length == 0)
			|| (typeof value == "number" && (value == 0 || value == 0.0))
			|| (typeof value == "object" && value.length == 0);
	}

	function ucfirst(str)
	{
		str += ''; // ensure that str is a string
		var c = str[0].toUpperCase();
		return c + str.substr(1);
	}

	String.prototype.ucfirst = function()
	{
		return ucfirst(this);
	};

	String.prototype.format = function()
	{
		var args = arguments;
		return this.replace(/\{\{|\}\}|\{(\d+)\}/g, function (m, n) {
			if (m == "{{") { return "{"; }
			if (m == "}}") { return "}"; }
			return args[n];
		});
	};

}(jQuery));
