"use strict";

__webpack_public_path__ = '/';

import * as d3 from 'd3';
import 'whatwg-fetch';
import groupBy from 'lodash/groupby';

const commonCompounds = ['^H2O','^NAD[HP+]','^trans,trans-Farnesyl diphosphate','^S-Adenosyl-L-homocysteine',
  '^H\+','^Oxygen','^Orthophosphate','^S-Adenosyl-L-methionine','^L-Glutamate','^CO2','^D-Glucose',
  '^Acetyl-CoA','^CoA','^Acceptor','^Reduced acceptor','^2-Oxoglutarate','^UDP-glucose',
  '^Pyruvate','^Diphosphate','^[AGU]TP','^[AGU]DP','^[AGU]MP','^Ammonia','^Acetate',
  '^Reduced ferredoxin','^Acyl-CoA','^Malonyl-CoA'].join('|')


const commonCompoundsRegex = new RegExp(commonCompounds)

const reactionRegex = /^rn:/

const processCompoundString = (compoundString) => {
  let parts = compoundString.trim().split(' ');
  if (+parts[0] === +parts[0] || parts[0] === 'n' || parts[0] === '(n+1)'){
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

  const nodes = [].concat(...processedLines.map((processedLine) => {return processedLine.nodes}))
    .filter((node, index, self) => { 
      let dupIndex = self.findIndex( (n) => {
        return n.id === node.id
      })
      return index === dupIndex
    })

  const edges = [].concat(...processedLines.map((processedLine) => {return processedLine.edges}))

  const filteredNodes = nodes.filter((node) => {
    return !commonCompoundsRegex.test(node.id) || reactionRegex.test(node.id)
  })

  const filteredEdges = edges.filter((edge) => {
    if (reactionRegex.test(edge.source)){
      return !commonCompoundsRegex.test(edge.target)
    } else {
      return !commonCompoundsRegex.test(edge.source)
    }
    //return !commonCompoundsRegex.test(edge.source) && !commonCompoundsRegex.test(edge.target)
  })

  const indegrees = groupBy(filteredEdges, (edge) => { return edge.source } )
  const outdegrees = groupBy(filteredEdges, (edge) => { return edge.target } )
  
  filteredNodes.forEach((node) => {
    let indegree = indegrees[node.id]
    let outdegree = outdegrees[node.id]
    node.indegree = indegree === undefined ? 1 : indegree.length
    node.outdegree = outdegree === undefined ? 1 : outdegree.length
  })


  console.log(filteredNodes)
  console.log(filteredEdges)
 
  return {nodes: filteredNodes, edges: filteredEdges};
};

const drawGraph = (nodes,edges) => {
  const MyWorker = require('worker-loader!./worker.js')
  const worker = new MyWorker();

  let meter = document.querySelector('#progress');

  const svg = d3.select('svg');
  const width = +svg.attr('width');
  const height = + svg.attr('height');

  const zoom = d3.zoom().on('zoom', zoomed);

  svg.selectAll('text').remove()

  let vis = svg.append('g')
      .attr('class','vis')
      .attr('transform','translate(300,300)scale(0.2,0.2)')
      .call(zoom)

  worker.postMessage({
    nodes: nodes,
    edges: edges,
    width: width,
    height: height
  })

  worker.onmessage = function(event){
    switch (event.data.type){
      case 'tick': return ticked(event.data);
      case 'end': return ended(event.data);
    }
  }

  function ticked(data) {
    let progress = data.progress;

    meter.style.width = 100 * progress + "%";
  }

  function ended(data) {
    let nodes = data.nodes;
    let edges = data.edges;

    meter.style.display = "none";

    let link = vis.append('g')
        .attr('class','links')
      .selectAll('line')
      .data(edges)
      .enter().append('line')
        .attr("x1", function(d) { return d.source.x; })
        .attr("y1", function(d) { return d.source.y; })
        .attr("x2", function(d) { return d.target.x; })
        .attr("y2", function(d) { return d.target.y; })
        .attr('stroke-width', (d) => { return 1 }) //fill this in later

    let node = vis.append('g')
        .attr('class','nodes')
      .selectAll('circle')
      .data(nodes)
      .enter().append('circle')
        .attr("cx", function(d) { return d.x; })
        .attr("cy", function(d) { return d.y; })
        .attr('r', (d) => {
          //return (1 + Math.log(d.indegree + d.outdegree)) * 10
          return (2 * Math.sqrt(d.indegree + d.outdegree)) + 3
        })
        .attr('fill', (d) => { 
          if (d.id.slice(0,2) === 'rn'){
            return '#fdae61'
          } else {
            return '#2b83ba'
          }
        })
        .on('click',(d) => {
          console.log(d.id, d.indegree, d.outdegree)
        })
    }
   function zoomed() {
    vis
        .attr('transform', d3.event.transform);
  }
}

console.log('Fetching data from KEGG REST API')

const kegg_url = 'http://rest.kegg.jp/list/reaction'

fetch(`https://cors-anywhere.herokuapp.com/${kegg_url}`)
  .then( (response) => {
    return response.text()
  }).then( (results) => {
    return parseResults(results)
  }).then( (data) => {
    console.log('Finished parsing data')
   drawGraph(data.nodes,data.edges)
  })