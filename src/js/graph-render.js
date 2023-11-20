const highlightColor = "#000000";
const upstreamColor = "#2020A0";
const downstreamColor = "#0000FF";
const initialStrokeWidth = "3px";
const highlightStrokeWidth = "5px";
const duration = 500;

let g = new dagreD3.graphlib.Graph().setGraph({
  rankdir: "LR",
});

const svg = d3.select("#graph-svg");
const inner = svg.append("g");

let mapData = null;
let mapType = "";

// Returns true if a node's id or its children's id matches search_text
function nodeMatches(nodeId, searchText) {
  if (nodeId.indexOf(searchText) > -1) {
    return true;
  }
  return false;
}

function highlightNodes(nodesToHighlight, color, strokeWidth) {
  nodesToHighlight.forEach((nodeid) => {
    const myNode = g.node(nodeid).elem;
    d3.select(myNode)
      .selectAll("rect,circle")
      .style("stroke", color)
      .style("stroke-width", strokeWidth);
  });
}

let zoom = null;

function setUpZoomSupport() {
  // Set up zoom support for Graph
  zoom = d3.behavior.zoom().on("zoom", () => {
    inner.attr(
      "transform",
      `translate(${d3.event.translate})scale(${d3.event.scale})`
    );
  });
  svg.call(zoom);

  // Centering the DAG on load
  // Get Dagre Graph dimensions
  const graphWidth = g.graph().width;
  const graphHeight = g.graph().height;
  // Get SVG dimensions
  const padding = 20;
  const svgBb = svg.node().getBoundingClientRect();
  const width = svgBb.width - padding * 2;
  const height = svgBb.height - padding; // we are not centering the dag vertically

  // Calculate applicable scale for zoom
  const zoomScale = Math.min(
    Math.min(width / graphWidth, height / graphHeight),
    1.5 // cap zoom level to 1.5 so nodes are not too large
  );

  zoom.translate([width / 2 - (graphWidth * zoomScale) / 2 + padding, padding]);
  zoom.scale(zoomScale);
  zoom.event(inner);
}

function setUpNodeHighlighting() {
  // eslint-disable-next-line func-names
  d3.selectAll("g.node").on("mouseover", function (d) {
    d3.select(this).selectAll("rect").style("stroke", highlightColor);
    highlightNodes(g.predecessors(d), upstreamColor, highlightStrokeWidth);
    highlightNodes(g.successors(d), downstreamColor, highlightStrokeWidth);
    const adjacentNodeNames = [d, ...g.predecessors(d), ...g.successors(d)];
    d3.selectAll("g.nodes g.node")
      .filter((x) => !adjacentNodeNames.includes(x))
      .style("opacity", 0.2);
    const adjacentEdges = g.nodeEdges(d);
    d3.selectAll("g.edgePath")[0]
      // eslint-disable-next-line no-underscore-dangle
      .filter((x) => !adjacentEdges.includes(x.__data__))
      .forEach((x) => {
        d3.select(x).style("opacity", 0.2);
      });
  });

  // eslint-disable-next-line func-names
  d3.selectAll("g.node").on("mouseout", function (d) {
    d3.select(this).selectAll("rect,circle").style("stroke", null);
    highlightNodes(g.predecessors(d), null, initialStrokeWidth);
    highlightNodes(g.successors(d), null, initialStrokeWidth);
    d3.selectAll("g.node").style("opacity", 1);
    d3.selectAll("g.node rect").style("stroke-width", initialStrokeWidth);
    d3.selectAll("g.edgePath").style("opacity", 1);
  });
}

function searchboxHighlighting(s) {
  let match = null;

  d3.selectAll("g.nodes g.node").filter(function forEach(d) {
    if (s === "") {
      d3.select("g.edgePaths")
        .transition()
        .duration(duration)
        .style("opacity", 1);
      d3.select(this)
        .transition()
        .duration(duration)
        .style("opacity", 1)
        .selectAll("rect")
        .style("stroke-width", initialStrokeWidth);
    } else {
      d3.select("g.edgePaths")
        .transition()
        .duration(duration)
        .style("opacity", 0.2);
      if (nodeMatches(d, s)) {
        if (!match) {
          match = this;
        }
        d3.select(this)
          .transition()
          .duration(duration)
          .style("opacity", 1)
          .selectAll("rect")
          .style("stroke-width", highlightStrokeWidth);
      } else {
        d3.select(this)
          .transition()
          .style("opacity", 0.2)
          .duration(duration)
          .selectAll("rect")
          .style("stroke-width", initialStrokeWidth);
      }
    }
    return null;
  });

  // This moves the matched node to the center of the graph area
  if (match) {
    const transform = d3.transform(d3.select(match).attr("transform"));

    const svgBb = svg.node().getBoundingClientRect();
    transform.translate = [
      svgBb.width / 2 - transform.translate[0],
      svgBb.height / 2 - transform.translate[1],
    ];
    transform.scale = [1, 1];

    if (zoom !== null) {
      zoom.translate(transform.translate);
      zoom.scale(1);
      zoom.event(inner);
    }
  }
}

d3.select("#searchbox").on("keyup", () => {
  const s = document.getElementById("searchbox").value;
  searchboxHighlighting(s);
});

d3.select("#allBtn").on("click", () => {
  createMap(mapData, mapType);
});

function setUpNodeClickHandler() {
  d3.selectAll("g.node").on("click", function (id) {
    console.log(id, mapData, mapType);
    const newData = {};
    for (const [key, val] of Object.entries(mapData)) {
      if (key === id) {
        newData[key] = val;
      }
      if (mapType === "components") {
        if (val.includes(id)) {
          newData[key] = val;
        }
      } else {
        if (val.find((childFile) => childFile.filePath === id)) {
          newData[key] = val;
        }
      }
    }
    // 更新图表数据
    createMap(newData, mapType);
  });
}

function createMap(data, type) {
  if (!data) {
    return;
  }
  g = new dagreD3.graphlib.Graph().setGraph({
    rankdir: "LR",
  });

  if (type === "components") {
    // 创建节点
    for (const [key, val] of Object.entries(data)) {
      g.setNode(key, { label: key });
      val.forEach((oN) => {
        g.setNode(oN, { label: oN });
      });
    }

    // 创建边
    for (const [key, val] of Object.entries(data)) {
      val.forEach((cN) => {
        g.setEdge(cN, key, { label: "", curve: d3.curveBasis });
      });
    }
  } else {
    //创建节点;
    for (const [key, val] of Object.entries(data)) {
      g.setNode(key, { label: key });
      val.forEach((oN) => {
        g.setNode(oN.filePath, { label: oN.filePath });
      });
    }
    // 创建边
    for (const [key, val] of Object.entries(data)) {
      val.forEach((cN) => {
        let exportStr = "";
        if (cN.exports) {
          cN.exports.forEach((str, index) => {
            if (cN.exports.length > 1 && index === 0) {
              exportStr += `${str},`;
            } else if (index === cN.exports.length - 1) {
              exportStr += `\n${str}`;
            } else {
              exportStr += `\n${str},`;
            }
          });
        }
        g.setEdge(cN.filePath, key, {
          label: exportStr,
          curve: d3.curveBasis,
        });
      });
    }
  }

  const render = new dagreD3.render();
  // Run the renderer. This is what draws the final graph.
  render(inner, g);
  setUpNodeHighlighting();
  setUpZoomSupport();
  setUpNodeClickHandler();
  loadingBox.style.display = "none";
}

window.addEventListener("message", (event) => {
  const message = event.data;
  console.log("Webview接收到的消息：", message.type, message.data);
  mapData = message.data;
  mapType = message.type;
  createMap(mapData, mapType);
});
