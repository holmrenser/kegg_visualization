import * as d3 from 'd3';
import 'whatwg-fetch';

const processCompoundString = (compoundString) => {
  let parts = compoundString.trim().split(' ');
  if (+parts[0] === +parts[0] || parts[0] === 'n'){
    parts = parts.slice(1, parts.length)
  }
  let compound = parts.join(' ')
  return { id: compound }
};

const parseResults = (results) => {
  const lines = results.split('\n')//.slice(1,1000);
  const processedLines = lines.filter((line) => {
    return line.length > 0;
  }).map( (line) => {
    let parts = line.split('\t');
    let reactionCode = parts[0]
    let reactionText = parts.slice(1, parts.length).join('\t')
    let text = reactionText.split(';');
    let description;
    let reaction;
    if (text.length > 1){
      description = `${reactionCode}: ${text[0]}`;
      reaction = text.slice(1, text.length).join(';');
    } else {
      description = `${reactionCode}: Unnamed reaction`;
      reaction = text[0];
    }

    let [input,output] = reaction.split('<=>')
    let inputParts = input.split(' + ').map( processCompoundString )
    let inputLinks = inputParts.map((input) => { return {source: input.id, target: description}})

    let outputParts = output.split(' + ').map( processCompoundString )
    let outputLinks = outputParts.map((output) => { return {source: description, target: output.id}})
    
    let nodes = [].concat({ id: description }, inputParts, outputParts)

    let edges = [].concat(inputLinks, outputLinks)
    return {nodes: nodes, edges: edges}
  })

  let nodes = [].concat(...processedLines.map((processedLine) => {return processedLine.nodes}))
    .filter((node, index, self) => { 
      let dupIndex = self.findIndex( (n) => {
        return n.id === node.id
      })
      return index === dupIndex
    })

  let edges = [].concat(...processedLines.map((processedLine) => {return processedLine.edges}))

  return {nodes: nodes, edges: edges};
};

const drawGraph = (nodes,edges) => {
  const svg = d3.select('svg');
  const width = +svg.attr('width');
  const height = + svg.attr('height');

  const zoom = d3.zoom().on('zoom', zoomed);

  svg.selectAll('text').remove()

  let vis = svg.append('g')
      .attr('class','vis')
      .call(zoom)

  const forceCharge = d3.forceManyBody().strength(-10).distanceMax(100)

  const forceLink = d3.forceLink().id( (d) => {return d.id} ).distance(100);
  //charge.strength = -10
  //charge.distanceMax = 100

  const simulation = d3.forceSimulation()
    .force('link', forceLink)
    .force('charge', forceCharge)
    .force('center', d3.forceCenter(width / 2, height / 2))

  let link = vis.append('g')
      .attr('class','links')
    .selectAll('line')
    .data(edges)
    .enter().append('line')
      .attr('stroke-width', (d) => { return 1 }) //fill this in later

  let node = vis.append('g')
      .attr('class','nodes')
    .selectAll('circle')
    .data(nodes)
    .enter().append('circle')
      .attr('r', 5)
      .attr('fill', (d) => { 
        console.log(d)
        if (d.id.slice(0,2) === 'rn'){
          return 'darkorange'
        } else {
          return 'lightblue'
        }
      })
      .on('click',(d) => {
        console.log(d.id)
      })

  simulation.nodes(nodes)
    .on('tick', ticked)

  simulation.force('link')
    .links(edges)

  function ticked()  {
    console.log('ticked')
    link
        .attr("x1", function(d) { return d.source.x; })
        .attr("y1", function(d) { return d.source.y; })
        .attr("x2", function(d) { return d.target.x; })
        .attr("y2", function(d) { return d.target.y; });

    node
        .attr("cx", function(d) { return d.x; })
        .attr("cy", function(d) { return d.y; });
  }
  function zoomed() {
    vis
        .attr('transform', d3.event.transform);
  }
};

console.log('Fetching data from KEGG REST API')
fetch('http://cors-anywhere.herokuapp.com/http://rest.kegg.jp/list/reaction')
  .then( (response) => {
    return response.text()
  }).then( (results) => {
    return parseResults(results)
  }).then( (data) => {
    console.log('Finished parsing data')
    drawGraph(data.nodes,data.edges)
  })