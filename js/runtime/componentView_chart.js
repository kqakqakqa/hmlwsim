/**
 * Component View: chart
 * 图表控件，支持 line（线形图）和 bar（柱状图），type / options 不支持动态修改。
 *
 * 坐标换算按文档语义：数据点第 i 个点的横坐标是 xAxis.min + i，
 * 纵坐标按 yAxis.min~max 线性映射到绘图区高度。
 * 柱状图的文档描述（每组柱子数量与 axisTick 一致、柱子落在刻度处）在不同
 * axisTick / 数据长度组合下自相矛盾，这里统一按"数据序号等分整个宽度"来画，
 * axisTick 只影响刻线，不改变柱子位置。
 */
const ComponentViewChart = (() => {
  const DEFAULT_STROKE_COLOR = '#ff6384';
  const DEFAULT_FILL_COLOR = '#ff6384';
  const DEFAULT_AXIS_COLOR = '#c0c0c0';
  const DEFAULT_LINE_WIDTH = 1;
  const DEFAULT_POINT_SIZE = 5;
  const DEFAULT_POINT_STROKE_WIDTH = 1;
  const DEFAULT_POINT_STROKE_COLOR = '#ff0000';
  const DEFAULT_POINT_FILL_COLOR = '#ff0000';
  const BAR_GAP_RATIO = 0.2;

  function readOptions(state) {
    const options = state.attrs.options;
    return options && typeof options === 'object' ? options : {};
  }

  function readAxis(options, key) {
    const axis = options[key] && typeof options[key] === 'object' ? options[key] : {};
    const min = typeof axis.min === 'number' ? axis.min : 0;
    const max = typeof axis.max === 'number' ? axis.max : 100;
    return {
      min,
      max: max === min ? min + 1 : max,
      axisTick: Math.min(20, Math.max(1, Math.round(axis.axisTick || 10))),
      display: !!axis.display,
      color: axis.color || DEFAULT_AXIS_COLOR,
    };
  }

  function readDatasets(state) {
    const datasets = state.attrs.datasets;
    return Array.isArray(datasets) ? datasets : [];
  }

  // append() 进来的点单独存，文档明确说不回写 datasets[index].data。
  function seriesData(state, index) {
    const dataset = readDatasets(state)[index] || {};
    const base = Array.isArray(dataset.data) ? dataset.data : [];
    const appended = state.appended[index] || [];
    return appended.length > 0 ? base.concat(appended) : base;
  }

  function readLength(value, fallback) {
    const parsed = parseFloat(value);
    return isNaN(parsed) ? fallback : parsed;
  }

  // Catmull-Rom 转三次贝塞尔，用来做 smooth 线。
  function traceSmoothPath(ctx, points) {
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 0; i < points.length - 1; i++) {
      const prev = points[i - 1] || points[i];
      const start = points[i];
      const end = points[i + 1];
      const next = points[i + 2] || end;
      ctx.bezierCurveTo(
        start.x + (end.x - prev.x) / 6, start.y + (end.y - prev.y) / 6,
        end.x - (next.x - start.x) / 6, end.y - (next.y - start.y) / 6,
        end.x, end.y
      );
    }
  }

  function buildPoints(data, options, width, height, loop) {
    const xAxis = readAxis(options, 'xAxis');
    const yAxis = readAxis(options, 'yAxis');
    if (data.length === 0) return [];
    const span = xAxis.max - xAxis.min;
    // loop：最新点固定贴在右边缘，老点往左溢出后被裁掉，视觉上就是滚动。
    const lastX = loop ? xAxis.max : xAxis.min + (data.length - 1);
    const scaleX = width / span;
    const scaleY = height / (yAxis.max - yAxis.min);
    return data.map((value, index) => {
      const x = (lastX - (data.length - 1 - index) - xAxis.min) * scaleX;
      return { x, y: height - (value - yAxis.min) * scaleY };
    });
  }

  function limitForLoop(data, options, margin) {
    const xAxis = readAxis(options, 'xAxis');
    const limit = Math.max(1, Math.round(xAxis.max - xAxis.min) + 1 + margin);
    return data.length > limit ? data.slice(data.length - limit) : data;
  }

  function drawAxes(ctx, width, height, options) {
    const xAxis = readAxis(options, 'xAxis');
    const yAxis = readAxis(options, 'yAxis');
    ctx.lineWidth = 1;
    if (yAxis.display) {
      ctx.strokeStyle = yAxis.color;
      ctx.beginPath();
      ctx.moveTo(0.5, 0);
      ctx.lineTo(0.5, height);
      for (let i = 0; i <= yAxis.axisTick; i++) {
        const y = Math.round(height * i / yAxis.axisTick);
        ctx.moveTo(0, y);
        ctx.lineTo(4, y);
      }
      ctx.stroke();
    }
    if (xAxis.display) {
      ctx.strokeStyle = xAxis.color;
      ctx.beginPath();
      ctx.moveTo(0, height - 0.5);
      ctx.lineTo(width, height - 0.5);
      for (let i = 0; i <= xAxis.axisTick; i++) {
        const x = Math.round(width * i / xAxis.axisTick);
        ctx.moveTo(x, height);
        ctx.lineTo(x, height - 4);
      }
      ctx.stroke();
    }
  }

  function drawPointMarker(ctx, point, style) {
    if (!point || !style || style.display === false) return;
    const size = readLength(style.size, DEFAULT_POINT_SIZE);
    if (size <= 0) return;
    const radius = Math.max(size / 2 - DEFAULT_POINT_STROKE_WIDTH / 2, 0.5);
    ctx.beginPath();
    ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
    ctx.fillStyle = style.fillColor || DEFAULT_POINT_FILL_COLOR;
    ctx.fill();
    ctx.lineWidth = readLength(style.strokeWidth, DEFAULT_POINT_STROKE_WIDTH);
    ctx.strokeStyle = style.strokeColor || DEFAULT_POINT_STROKE_COLOR;
    ctx.stroke();
  }

  function drawLine(ctx, points, dataset, options, width, height) {
    const series = options.series && typeof options.series === 'object' ? options.series : {};
    const lineStyle = series.lineStyle && typeof series.lineStyle === 'object' ? series.lineStyle : {};
    const strokeColor = dataset.strokeColor || DEFAULT_STROKE_COLOR;
    const fillColor = dataset.fillColor || DEFAULT_FILL_COLOR;

    ctx.beginPath();
    if (lineStyle.smooth) traceSmoothPath(ctx, points);
    else {
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
    }

    if (dataset.gradient) {
      // 顺着线往下补一块渐变面积，最低点画在绘图区底部。
      const closed = new Path2D();
      closed.moveTo(points[0].x, points[0].y);
      if (lineStyle.smooth) traceSmoothPath(closed, points);
      else for (let i = 1; i < points.length; i++) closed.lineTo(points[i].x, points[i].y);
      closed.lineTo(points[points.length - 1].x, height);
      closed.lineTo(points[0].x, height);
      closed.closePath();
      const gradient = ctx.createLinearGradient(0, 0, 0, height);
      gradient.addColorStop(0, fillColor);
      gradient.addColorStop(1, 'transparent');
      ctx.fillStyle = gradient;
      ctx.fill(closed);
    }

    ctx.lineWidth = Math.max(readLength(lineStyle.width, DEFAULT_LINE_WIDTH), 0.5);
    ctx.strokeStyle = strokeColor;
    ctx.stroke();
  }

  function drawBar(ctx, dataSeries, datasets, options, width, height) {
    const yAxis = readAxis(options, 'yAxis');
    const count = dataSeries.reduce((max, data) => Math.max(max, data.length), 0);
    if (count === 0) return;
    const slot = width / count;
    const barWidth = datasets.length > 0 ? slot / datasets.length : slot;
    const scaleY = height / (yAxis.max - yAxis.min);

    dataSeries.forEach((data, seriesIndex) => {
      const dataset = datasets[seriesIndex] || {};
      ctx.fillStyle = dataset.fillColor || dataset.backgroundColor || DEFAULT_FILL_COLOR;
      data.forEach((value, index) => {
        const left = index * slot + seriesIndex * barWidth + barWidth * BAR_GAP_RATIO / 2;
        const barHeight = Math.max(0, (value - yAxis.min) * scaleY);
        ctx.fillRect(left, height - barHeight, barWidth * (1 - BAR_GAP_RATIO), barHeight);
      });
    });
  }

  function paint(el, ctx, width, height, state) {
    const options = readOptions(state);
    const datasets = readDatasets(state);
    if (datasets.length === 0) return;
    const type = String(state.attrs.type || 'line') === 'bar' ? 'bar' : 'line';

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, width, height);
    ctx.clip();

    drawAxes(ctx, width, height, options);

    if (type === 'bar') {
      drawBar(ctx, datasets.map((dataset, index) => seriesData(state, index)), datasets, options, width, height);
      ctx.restore();
      return;
    }

    const series = options.series && typeof options.series === 'object' ? options.series : {};
    const loop = !!series.loop;
    const margin = loop ? readLength(series.loop.margin, 0) : 0;

    datasets.forEach((dataset, index) => {
      const data = limitForLoop(seriesData(state, index), options, margin);
      if (data.length === 0) return;
      const points = buildPoints(data, options, width, height, loop);
      drawLine(ctx, points, dataset, options, width, height);
      let lowest = points[0];
      let highest = points[0];
      points.forEach(point => {
        if (point.y > lowest.y) lowest = point;
        if (point.y < highest.y) highest = point;
      });
      drawPointMarker(ctx, highest, series.topPoint);
      drawPointMarker(ctx, lowest, series.bottomPoint);
      drawPointMarker(ctx, points[points.length - 1], series.headPoint);
    });

    ctx.restore();
  }

  return {
    attrs: ['type', 'options', 'datasets'],
    init(el, state) {
      state.appended = [];
      // 真机上 append 是图表组件的实例方法，通过 refs 调用；
      // 它不会回写 datasets[index].data，所以增量数据单独存一份。
      el.append = function (params) {
        if (!params) return;
        const serial = Number(params.serial) || 0;
        const data = Array.isArray(params.data) ? params.data : [];
        if (!state.appended[serial]) state.appended[serial] = [];
        state.appended[serial] = state.appended[serial].concat(data);
        ComponentView.schedulePaint(el);
      };
    },
    paint,
  };
})();

ComponentView.register('chart', ComponentViewChart);
