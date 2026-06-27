/**
 * CSS Adapter - Normalizes OHOS flex CSS for browser rendering
 */
const CSSAdapter = (() => {

  /**
   * Process OHOS CSS to browser-compatible CSS
   * OHOS uses flexbox by default; most properties map directly.
   */
  function process(css) {
    let result = css;

    // Handle @import - convert paths (already handled by HML compiler)
    // OHOS flex defaults: flex-direction: row (except list which is column)
    // Browser flexbox defaults: flex-direction: row, align-items: stretch

    // Add base component styles
    const baseStyles = `
.ohos-stack {
  position: relative;
}
.ohos-stack > * {
  position: absolute;
  top: 0;
  left: 0;
}
.ohos-text {
  display: inline;
}
.ohos-image {
  object-fit: contain;
  display: block;
}
.ohos-progress {
  -webkit-appearance: none;
  appearance: none;
}
span, div {
  word-wrap: break-word;
  overflow-wrap: break-word;
}
img {
  object-fit: contain;
  display: block;
}
`;

    // Convert OHOS-specific CSS quirks
    // align-items: center in OHOS is same as CSS
    // justify-content: center is same as CSS
    // flex-direction: column is same as CSS

    // OHOS uses 'background-color' (same as CSS)
    // OHOS uses 'border-radius' (same as CSS)
    // OHOS uses 'margin-*' (same as CSS)
    // OHOS uses 'padding-*' (same as CSS)

    return baseStyles + '\n' + result;
  }

  /**
   * Get default styles for the watch viewport.
   * Matches OHOS Lite Wearable rendering defaults so compiled apps look correct.
   */
  function getWatchBaseStyles() {
    return `
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
  -webkit-tap-highlight-color: transparent;
  flex-shrink: 0;
}
:host {
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: #000;
  color: #fff;
  font-family: 'HarmonyOS Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif;
  font-size: 30px;
  display: flex;
  flex-direction: row;
}
list {
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  overflow-x: hidden;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
}
list::-webkit-scrollbar { display: none; }
swiper {
  display: flex;
  flex-direction: row;
  overflow-x: auto;
  overflow-y: hidden;
  scroll-snap-type: x mandatory;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
}
swiper::-webkit-scrollbar { display: none; }
swiper > * {
  flex-shrink: 0;
  width: 100%;
  height: 100%;
  scroll-snap-align: start;
}
div, list-item {
  display: flex;
}
text {
  display: inline;
}
img, image {
  object-fit: contain;
  display: block;
}
list-item {
  flex-shrink: 0;
}
stack {
  position: relative;
}
stack > * {
  position: absolute;
  top: 0;
  left: 0;
}
progress {
  -webkit-appearance: none;
  appearance: none;
}
input, button {
  border: none;
  outline: none;
  -webkit-appearance: none;
  appearance: none;
}
.page-container {
  width: 100%;
  height: 100%;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
`;
  }

  return { process, getWatchBaseStyles };
})();
