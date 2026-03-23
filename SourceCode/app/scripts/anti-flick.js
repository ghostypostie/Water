/**
 * Water Client - Anti-Flick
 * Requests raw (unadjusted) mouse input via pointer lock to eliminate
 * OS mouse acceleration flicks. Safe - does not patch any prototypes.
 */
(function() {
    'use strict';

    // Request unadjustedMovement on every pointer lock acquisition.
    // This bypasses OS mouse acceleration curves for 1:1 raw input.
    const _origLock = Element.prototype.requestPointerLock;
    Element.prototype.requestPointerLock = function(options) {
        try {
            return _origLock.call(this, Object.assign({}, options, { unadjustedMovement: true }));
        } catch (_) {
            // Browser may not support unadjustedMovement - fall back silently
            return _origLock.call(this, options);
        }
    };
})();
