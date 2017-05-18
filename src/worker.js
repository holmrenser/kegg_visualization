import * as d3 from 'd3';

onmessage = function(event){
  let nodes = event.data.nodes;
  let edges = event.data.edges;
  let width = event.data.width;
  let height = event.data.height;

  const forceCharge = d3.forceManyBody().strength(-100).distanceMax(500)

  const distFunc = (link) => {
    return (Math.min(link.target.indegree,link.source.outdegree) + 4 ) * 6
  }

  const forceLink = d3.forceLink(edges).id( (d) => {return d.id} ).distance(distFunc);

  const forceCollide = d3.forceCollide().radius((node) => { 
    return node.indegree
    //return 10 * Math.sqrt( node.outdegree )
  })

  let simulation = d3.forceSimulation(nodes)
    .force('link', forceLink)
    .force('charge', forceCharge)
    .force('collide', forceCollide)
    .force('center', d3.forceCenter(width / 2, height / 2))
    .force('x',d3.forceX())
    .force('y',d3.forceY())
    .stop()
  for (var i = 0, n = Math.ceil(Math.log(simulation.alphaMin()) / Math.log(1 - simulation.alphaDecay())); i < n; ++i) {
    postMessage({type: "tick", progress: i / n});
    simulation.tick();
  }

  postMessage({type: "end", nodes: nodes, edges: edges});
}
