/**
 * Component View: progress
 * 进度条控件，支持 horizontal（线性）和 arc（弧形）两种类型，type 不支持动态修改。
 * 文档里的 start-angle / total-angle / center-x / center-y / radius / stroke-width
 * 由 sandbox 映射成 --ohos-* 自定义属性，这里读回来算几何。
 */
const ComponentViewProgress = (() => {
  // 默认颜色 #6b9ac7 由 css-adapter 的基础样式给出，走正常的 color 继承，
  // 应用用 class 或内联样式都能覆盖。
  const DEFAULT_STROKE_WIDTH = 4;
  const DEFAULT_START_ANGLE = 240;
  const DEFAULT_TOTAL_ANGLE = 240;

  // 真机的 0 度在时钟 12 点方向、顺时针为正；canvas 的 0 度在 3 点方向、顺时针为正。
  function toCanvasAngle(deg) {
    return (deg - 90) * Math.PI / 180;
  }

  function isTransparent(color) {
    if (!color || color === 'transparent') return true;
    const match = color.match(/^rgba?\(([^)]+)\)$/);
    if (!match) return false;
    const parts = match[1].split(',');
    return parts.length === 4 && parseFloat(parts[3]) === 0;
  }

  function readPercent(state) {
    const raw = state.attrs.percent !== undefined ? state.attrs.percent : state.attrs.value;
    const value = parseFloat(raw);
    if (isNaN(value)) return 0;
    return Math.min(100, Math.max(0, value));
  }

  function strokeArc(ctx, centerX, centerY, radius, startAngle, sweepAngle, color) {
    ctx.strokeStyle = color;
    ctx.beginPath();
    if (Math.abs(sweepAngle) >= 360) {
      // 起点和终点重合时 canvas 的 arc 会退化成一个点，整圈要单独画。
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2, false);
    } else {
      ctx.arc(
        centerX, centerY, radius,
        toCanvasAngle(startAngle), toCanvasAngle(startAngle + sweepAngle),
        sweepAngle < 0
      );
    }
    ctx.stroke();
  }

  // 弧形进度条上 background-color 表示"弧形底环"的颜色，不是元素底色；
  // 元素自身底色要刷成透明，否则浏览器会在框里刷一整块实色。
  // 但作者值常常也写在内联样式里（动态样式就是这么写的），所以不能靠"摘掉再读"，
  // 只能记住自己写过什么：写 rgba(0, 0, 0, 0) 而不是 transparent，
  // 好和应用自己写的 transparent 区分开 —— 内联值还是自己写的那串，说明作者没改过。
  const SUPPRESSED_BACKGROUND = 'rgba(0, 0, 0, 0)';

  function resolveTrackColor(el, state) {
    if (state.suppressed && el.style.backgroundColor === SUPPRESSED_BACKGROUND) {
      return state.trackColor;
    }
    const current = getComputedStyle(el).backgroundColor;
    state.trackColor = isTransparent(current) ? '' : current;
    state.suppressed = true;
    el.style.backgroundColor = SUPPRESSED_BACKGROUND;
    return state.trackColor;
  }

  function paintArc(el, ctx, width, height, state) {
    const cs = getComputedStyle(el);
    const trackColor = resolveTrackColor(el, state);
    const strokeWidth = Math.max(0, ComponentView.readLength(cs, '--ohos-stroke-width', DEFAULT_STROKE_WIDTH));
    if (strokeWidth <= 0) return;

    const centerX = ComponentView.readLength(cs, '--ohos-center-x', width / 2);
    const centerY = ComponentView.readLength(cs, '--ohos-center-y', height / 2);
    const radius = ComponentView.readLength(cs, '--ohos-radius', Math.min(width, height) / 2);
    const startAngle = ComponentView.readLength(cs, '--ohos-start-angle', DEFAULT_START_ANGLE);
    const totalAngle = ComponentView.readLength(cs, '--ohos-total-angle', DEFAULT_TOTAL_ANGLE);
    // 进度条始终画在半径区域内：外沿到圆心距离是 radius，往里收一个 strokeWidth。
    const arcRadius = radius - strokeWidth / 2;
    if (arcRadius <= 0) return;

    ctx.lineWidth = strokeWidth;
    ctx.lineCap = 'butt';

    if (trackColor) strokeArc(ctx, centerX, centerY, arcRadius, startAngle, totalAngle, trackColor);
    const valueAngle = totalAngle * readPercent(state) / 100;
    if (valueAngle !== 0) strokeArc(ctx, centerX, centerY, arcRadius, startAngle, valueAngle, cs.color);
  }

  function paintHorizontal(el, ctx, width, height, state) {
    const cs = getComputedStyle(el);
    const strokeWidth = Math.max(0, ComponentView.readLength(cs, '--ohos-stroke-width', DEFAULT_STROKE_WIDTH));
    if (strokeWidth <= 0) return;
    const barWidth = width * readPercent(state) / 100;
    if (barWidth <= 0) return;
    // 线宽大于组件高度时按组件高度画，竖直居中。
    const barHeight = Math.min(strokeWidth, height);
    ctx.fillStyle = cs.color;
    ctx.fillRect(0, (height - barHeight) / 2, barWidth, barHeight);
  }

  return {
    attrs: ['type', 'percent', 'value'],
    paint(el, ctx, width, height, state) {
      if (String(state.attrs.type || 'horizontal') === 'arc') paintArc(el, ctx, width, height, state);
      else paintHorizontal(el, ctx, width, height, state);
    },
  };
})();

ComponentView.register('progress', ComponentViewProgress);
