/**
 * CSS Adapter - Default styles for the watch viewport.
 * Matches OHOS Lite Wearable rendering defaults so compiled apps look correct.
 */
const CSSAdapter = (() => {

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
swiper[vertical="true"] {
  flex-direction: column;
  overflow-x: hidden;
  overflow-y: auto;
  scroll-snap-type: y mandatory;
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
  white-space: pre-wrap;
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
input[type="button"] {
  background: transparent;
  color: inherit;
  font: inherit;
  padding: 0;
  border-radius: 0;
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

  return { getWatchBaseStyles };
})();
