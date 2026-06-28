/**
 * Device Feature: Vibrator
 * Simulates vibration via visual feedback on the watch frame
 */
const DeviceFeatureVibrator = (() => {
  function vibrate() {
    const frame = document.getElementById('watch-frame');
    if (frame) {
      frame.style.boxShadow = '0 0 20px rgba(233,69,96,0.5)';
      setTimeout(() => { frame.style.boxShadow = ''; }, 200);
    }
  }

  function stop() {
    const frame = document.getElementById('watch-frame');
    if (frame) {
      frame.style.boxShadow = '';
    }
  }

  return { vibrate, stop };
})();
