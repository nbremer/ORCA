// During what time of its existence has the author been involved
// Fraction of commits
// More than X or X% of the commits - Not trying to say that "the more commits is better"
// Make clear which repos are used by multiple authors

//Possible: use similarity of tags to put repos closer together or give colors to themes
// Look how long ago it was that the author was last active in the repo - link opacity?

// Get list of tags to Adam

// Central node a polygon of authors in points?


/////////////////////////////////////////////////////////////////////
///////////////////////////// CONSTANTS /////////////////////////////
/////////////////////////////////////////////////////////////////////

const REPOSITORY = "PDFjs"

const PI = Math.PI
const TAU = PI * 2

let render

let round = Math.round
let cos = Math.cos
let sin = Math.sin
let min = Math.min
let max = Math.max

// Datasets
let authors
let repos
let nodes = [], links

// Settings
const CENTRAL_RADIUS = 50//50

/////////////////////////////////////////////////////////////////////
/////////////////////////// Create Canvas ///////////////////////////
/////////////////////////////////////////////////////////////////////

const canvas = document.getElementById("canvas")
const context = canvas.getContext("2d")

/////////////////////////////////////////////////////////////////////
///////////////////////////// Set Sizes /////////////////////////////
/////////////////////////////////////////////////////////////////////

//Sizes
const DEFAULT_WIDTH = 1500
const DEFAULT_HEIGHT = 1500 //DEFAULT_WIDTH * ASPECT_RATIO
// const MARGIN = 100
// const INNER_WIDTH = DEFAULT_WIDTH - 2*MARGIN
// const INNER_HEIGHT = DEFAULT_HEIGHT - 2*MARGIN
let SF, WIDTH, HEIGHT

// Resize function
function resize() {

    // Screen pixel ratio
    let PIXEL_RATIO = window.devicePixelRatio

    // Screen sizes
    let width =  window.innerWidth
    let height = window.innerHeight

    WIDTH = round(width * PIXEL_RATIO)
    HEIGHT = round(height * PIXEL_RATIO)

    // Set the scale factor
    SF = WIDTH / DEFAULT_WIDTH
    // console.log("SF:", SF)

    // Size the canvas
    canvas.width = WIDTH
    canvas.height = HEIGHT
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`

    if (render) draw()
}//function resize

/////////////////////////////////////////////////////////////////////
/////////////////////////////// Colors //////////////////////////////
/////////////////////////////////////////////////////////////////////

const COLOR_BACKGROUND = "#f7f7f7"
const COLOR_REPO_MAIN = "#f2a900"
const COLOR_REPO = "#64d6d3" // "#b2faf8"
const COLOR_AUTHOR = "#ea9df5"
const COLOR_LINK = "#e8e8e8"

/////////////////////////////////////////////////////////////////////
////////////////////////// Create Functions /////////////////////////
/////////////////////////////////////////////////////////////////////

let formatDate = d3.timeParse("%Y-%m-%dT%H:%M:%SZ")
let formatDateUnix = d3.timeParse("%s")

const scale_repo_radius = d3.scaleSqrt()
    .range([4, 20])

// Based on the number of commits to the central repo
const scale_author_radius = d3.scaleSqrt()
    .range([4, 30])

// const scale_node_opacity = d3.scaleLinear()
//     .domain([1,7])
//     .range([0.2,1])
//     .clamp(true)

const scale_link_distance = d3.scaleLinear()
    .domain([1,50])
    .range([10,80])

const scale_link_strength = d3.scaleLinear()
    .domain([1,50])
    .range([10,80])

const scale_link_width = d3.scaleLinear()
    .domain([1,10,200])
    .range([1,2,5])
    // .clamp(true)

/////////////////////////////////////////////////////////////////////
/////////////////////////////// START ///////////////////////////////
/////////////////////////////////////////////////////////////////////

//Start it all the first time
window.addEventListener("resize", resize)
resize()

//Draw
function draw() {
    render(context, WIDTH, HEIGHT)
}//function draw

let promises = []
promises.push(d3.csv(`data/${REPOSITORY}/authorInfo-PDFjs.csv`))
promises.push(d3.csv(`data/${REPOSITORY}/baseRepoInfo-PDFjs.csv`))
promises.push(d3.csv(`data/${REPOSITORY}/links-PDFjs.csv`))

document.fonts.ready.then(() => {
    Promise.all(promises).then(values => {
        //Create the rendering function
        render = createFullVisual(values)
        //Draw the visual   
        draw()        
    })//promises
})//fonts.ready

/////////////////////////////////////////////////////////////////////
////////////////////////// Draw the Visual //////////////////////////
/////////////////////////////////////////////////////////////////////

function createFullVisual(values) {


    /////////////////////////////////////////////////////////////////
    //////////////////////// Data Preparation ///////////////////////
    /////////////////////////////////////////////////////////////////

    authors = values[0]
    repos = values[1]
    links = values[2]

    authors.forEach(d => {
        d.author_name = d.author_name_top
        
        d.color = COLOR_AUTHOR
        
        delete d.author_name_top
    })// forEach

    repos.forEach(d => {
        d.repo = d.base_repo_original
        d.forks = +d.repo_forks
        d.stars = +d.repo_stars
        d.createdAt = formatDate(d.repo_createdAt)
        d.updatedAt = formatDate(d.repo_updatedAt)

        // Get the substring until the slash
        d.owner = d.repo.substring(0, d.repo.indexOf("/"))
        // Get the substring after the slash
        d.name = d.repo.substring(d.repo.indexOf("/") + 1)

        d.color = COLOR_REPO

        delete d.base_repo_original
        delete d.repo_forks
        delete d.repo_stars
        // delete d.repo_createdAt
        // delete d.repo_updatedAt
    })// forEach

    links.forEach(d => {
        // Source
        d.author_name = d.author_name_top
        // Target
        d.repo = d.base_repo_original

        // Metadata of the "link"
        d.commit_count = +d.commit_count
        d.commit_sec_min = formatDateUnix(d.commit_sec_min)
        d.commit_sec_max = formatDateUnix(d.commit_sec_max)

        // Get the substring until the slash
        d.owner = d.base_repo_original.substring(0, d.base_repo_original.indexOf("/"))
        // Get the substring after the slash
        d.name = d.base_repo_original.substring(d.base_repo_original.indexOf("/") + 1)

        delete d.base_repo_original
        delete d.author_name_top
    })// forEach

    console.log(authors[0])
    console.log(repos[0])
    console.log(links[0])


    ////////////////////////// Create Nodes /////////////////////////
    // Combine the authors and repos into one variable to become the nodes
    authors.forEach((d,i) => {
        nodes.push({
            id: d.author_name, type: "author", label: d.author_name, data: d
        })
    })// forEach
    repos.forEach((d,i) => {
        nodes.push({
            id: d.repo, type: "repo", label: d.name, data: d
        })
    })// forEach

    // Add the index of the node to the links
    links.forEach(d => {
        d.source = nodes.find(n => n.id === d.author_name).id
        d.target = nodes.find(n => n.id === d.repo).id
    })// forEach

    // Find the degree of each node
    nodes.forEach(d => {
        d.degree = links.filter(l => l.source === d.id || l.target === d.id).length
        // d.in_degree = links.filter(l => l.target === d.id).length
        // d.out_degree = links.filter(l => l.source === d.id).length
    })// forEach

    // Sort the nodes by type and id (author name)
    nodes.sort((a,b) => {
        if(a.type === b.type) {
            if(a.id.toLowerCase() < b.id.toLowerCase()) return -1
            else if(a.id.toLowerCase() > b.id.toLowerCase()) return 1
            else return 0
        } else {
            if(a.type === "author") return -1
            else return 1
        }
    })// sort

    // Which is the central repo, the one that connects everyone (the one with the highest degree)
    const central_repo = nodes.find(d => d.type === "repo" && d.degree === d3.max(nodes.filter(d => d.type === "repo"), d => d.degree))

    central_repo.r = CENTRAL_RADIUS
    central_repo.padding = CENTRAL_RADIUS * 0.5
    central_repo.special_type = "central"

    // Set scales
    scale_repo_radius.domain(d3.extent(repos, d => d.stars))
    scale_author_radius.domain(d3.extent(links.filter(l => l.target === central_repo.id), d => d.commit_count))
    // console.log(scale_author_radius.domain())

    nodes.forEach((d,i) => {
        d.index = i
        d.data.index = i

        // If this node is an "author", find the number of commits they have on the central repo node
        if(d.type === "author") {
            d.data.commit_count_central = links.find(l => l.source === d.id && l.target === central_repo.id).commit_count
            d.r = scale_author_radius(d.data.commit_count_central)
        }     
        else {
            d.r = scale_repo_radius(d.data.stars)
        }// else 

        d.color = d.data.color
    })// forEach
    central_repo.color = COLOR_REPO_MAIN

    // console.log(nodes)

    /////////////////////////////////////////////////////////////////
    ////////////////////// Run Force Simulation /////////////////////
    /////////////////////////////////////////////////////////////////

    central_repo.x = central_repo.fx = 0 //WIDTH / 2
    central_repo.y = central_repo.fy = 0 //HEIGHT / 2

    // Fix the author nodes in a ring around the central node
    const RADIUS_AUTHOR = 400
    const angle = TAU / (nodes.filter(d => d.type === "author").length)
    nodes
        .filter(d => d.type === "author")
        .forEach((d,i) => {
            d.x = d.fx = central_repo.fx + RADIUS_AUTHOR * cos(i * angle - PI/2)
            d.y = d.fy = central_repo.fy + RADIUS_AUTHOR * sin(i * angle - PI/2)
        })// forEach

    let simulation = d3.forceSimulation()
        .force("link",
            d3.forceLink()
                .id(d => d.id)
                // .distance(50)
                // .distance(d => scale_link_distance(d.target.degree))
                // .strength(d => scale_link_strength(d.source.degree))
        )
        .force("collide",
            d3.forceCollide()
                .radius(d => d.r + (d.padding ? d.padding : Math.max(d.r, 15)))
                .strength(0)
        )
        // .force("charge",
        //     d3.forceManyBody()
        //         // .strength(d => scale_node_charge(d.d))
        //         // .distanceMax(WIDTH / 3)
        // )
        // .force("x", d3.forceX().x(d => d.focusX).strength(0.08)) //0.1
        // .force("y", d3.forceY().y(d => d.focusY).strength(0.08)) //0.1
        // .force("center", d3.forceCenter(0,0))

        // Keep the nodes that are an "author" or a repo that has a degree > 1 (and is thus commited to by more than one author)
        let nodes_central = nodes.filter(d => d.type === "author" || (d.type === "repo" && d.degree > 1))
        // Only keep the links that have the nodes that are in the nodes_central array
        let links_central = links.filter(d => nodes_central.find(n => n.id === d.source) && nodes_central.find(n => n.id === d.target))

        // Perform the simulation
        simulation
            .nodes(nodes_central)
            .stop()
            // .on("tick", ticked)

        // function ticked() {
        //     simulationPlacementConstraints()
        //     drawQuick()
        // }

        // // ramp up collision strength to provide smooth transition
        // let transitionTime = 3000
        // let t = d3.timer(function (elapsed) {
        //     let dt = elapsed / transitionTime
        //     simulation.force("collide").strength(0.1 + dt ** 2 * 0.6)
        //     if (dt >= 1.0) t.stop()
        // })

        // Only use the links that are not going to the central node
        simulation.force("link")
            .links(links_central)
            // .links(links_central.filter(d => d.target !== central_repo.id))
        // simulation.force("link").links(links)

        //Manually "tick" through the network
        let n_ticks = 300
        for (let i = 0; i < n_ticks; ++i) {
            simulation.tick()
            simulationPlacementConstraints()
            //Ramp up collision strength to provide smooth transition
            simulation.force("collide").strength(Math.pow(i / n_ticks, 2) * 0.7)
        }//for i
        drawQuick()

        // Once it's done, fix the positions of the nodes used in the simulation
        // simulation.on("end", () => {
            nodes_central.forEach(d => {
                d.fx = d.x
                d.fy = d.y
            })// forEach
        // })

        // Now run another simulation per author to show the links to nodes that are only connected to it
        nodes
            .filter(d => d.type === "author")
            .forEach(d => {
                // Find all the nodes that are connected to this one with a degree of one, including the author node itself
                let nodes_author = nodes.filter(n => links.find(l => l.source === d.id && l.target === n.id && n.degree === 1) || n.id === d.id)
                // Get the links between this node and nodes_author
                let links_author = links.filter(l => l.source === d.id && nodes_author.find(n => n.id === l.target))

                // Let the nodes start on the location of the author node
                nodes_author.forEach(n => {
                    n.x = d.fx
                    n.y = d.fy
                })// forEach

                let simulation = d3.forceSimulation()
                    .force("link",
                        d3.forceLink()
                            .id(d => d.id)
                            .strength(0)
                    )
                    .force("collide",
                        d3.forceCollide()
                            .radius(d => d.r + 2)
                            .strength(0)
                    )
                    .force("x", d3.forceX().x(d.fx).strength(0.1))
                    .force("y", d3.forceY().y(d.fy).strength(0.1))

                simulation
                    .nodes(nodes_author)
                    .stop()
                    // .on("tick", ticked)
        
                // Only use the links that are not going to the central node
                simulation.force("link").links(links_author)

                //Manually "tick" through the network
                let n_ticks = 300
                for (let i = 0; i < n_ticks; ++i) {
                    simulation.tick()
                    //Ramp up collision strength to provide smooth transition
                    simulation.force("collide").strength(Math.pow(i / n_ticks, 2) * 0.7)
                }//for i
                drawQuick()
        


            })// forEach

        /////////////////////////////////////////////////////////////
        function simulationPlacementConstraints() {
            // Make sure the "repo" nodes cannot be placed farther away from the center than RADIUS_AUTHOR
            nodes.forEach(d => {
                if(d.type === "repo") {
                    const dist = Math.sqrt(d.x ** 2 + d.y ** 2)
                    if(dist > RADIUS_AUTHOR * 0.8) {
                        d.x = d.x / dist * RADIUS_AUTHOR * 0.8
                        d.y = d.y / dist * RADIUS_AUTHOR * 0.8
                    }//if
                }//if
            })// forEach
        }// simulationPlacementConstraints

        function drawQuick() {
            // context.clearRect(0, 0, WIDTH, HEIGHT)
            context.fillStyle = COLOR_BACKGROUND
            context.fillRect(0, 0, WIDTH, HEIGHT)

            context.save()
            context.translate(WIDTH / 2, HEIGHT / 2)

            // Draw all the links as lines
            links.forEach(l => {
                if(l.source.x !== undefined && l.target.x !== undefined) {
                    calculateLinkGradient(context, l)
                    calculateEdgeCenters(l, 1)
                    context.strokeStyle = l.gradient 
                } else context.strokeStyle = COLOR_LINK

                let line_width = scale_link_width(l.commit_count)
                // if(l.target.id === central_repo.id) line_width *= 2
                context.lineWidth = line_width * SF
                drawLine(context, l, SF)

                // context.beginPath()
                // context.moveTo(l.source.x * SF, l.source.y * SF)
                // context.lineTo(l.target.x * SF, l.target.y * SF)
                // context.stroke()
            })// forEach

            // Draw all the nodes as circles
            nodes
                .filter(d => d.id !== central_repo.id)
                .forEach(d => {
                    context.shadowBlur = Math.max(3, d.r * 0.2) * SF
                    context.shadowColor = "#f7f7f7"//d.color
                    context.fillStyle = d.color
                    // context.globalAlpha = d.type === "author" ? 1 : scale_node_opacity(d.degree)
                    let r = d.r //d.type === "author" ? 10 : d.r
                    drawNode(context, d.x, d.y, SF, r)
                    context.shadowBlur = 0

                    // Also draw a stroke around the node
                    // context.globalAlpha = 0.5
                    context.strokeStyle = COLOR_BACKGROUND
                    context.lineWidth = Math.max(1, d.r * 0.07) * SF
                    context.stroke()
                    context.globalAlpha = 1

                    // context.globalAlpha = 1
                })// forEach

            // Draw the central node
            context.fillStyle = context.strokeStyle = COLOR_REPO_MAIN
            drawNode(context, 0, 0, SF, CENTRAL_RADIUS * 0.85)

            context.lineWidth = 3 * SF
            context.beginPath()
            context.moveTo(CENTRAL_RADIUS * SF, 0)
            context.arc(0, 0, CENTRAL_RADIUS * SF, 0, TAU)
            context.globalAlpha = 0.3
            context.stroke()
            context.globalAlpha = 1

            // Draw the name above each node
            context.fillStyle = "#4d4950"
            context.font = `${12 * SF}px sans-serif`
            context.textAlign = "center"
            nodes_central.forEach(d => {
                context.fillText(d.label, d.x * SF, d.y * SF - d.r * SF - 2)
            })// forEach

            context.restore()
        }//function drawQuick


    /////////////////////////////////////////////////////////////////
    ///////////////////////// Return Sketch /////////////////////////
    /////////////////////////////////////////////////////////////////

    return (context, WIDTH, HEIGHT) => {

        console.log("Finished Drawing")

    }// sketch
}// createFullVisual


/////////////////////////////////////////////////////////////////////
////////////////////////// Helper Functions /////////////////////////
/////////////////////////////////////////////////////////////////////

function mod (x, n) { return ((x % n) + n) % n }

function sq(x) { return x * x }

/////////////////////////////////////////////////////////////////////
/////////////////////// Node Drawing Functions //////////////////////
/////////////////////////////////////////////////////////////////////

// Draw a circle
function drawNode(context, x, y, SF, r = 10, begin = true) {
    if(begin) context.beginPath()
    context.moveTo((x+r) * SF, y * SF)
    context.arc(x * SF, y * SF, r * SF, 0, TAU)
    if(begin) context.fill()
}//function drawNode

/////////////////////////////////////////////////////////////////////
/////////////////////// Line Drawing Functions //////////////////////
/////////////////////////////////////////////////////////////////////

/////////////////////////// Draw the lines //////////////////////////
function drawLine(context, line, SF) {
    context.beginPath()
    context.moveTo(line.source.x * SF, line.source.y * SF)
    if(line.center) drawCircleArc(context, line, SF)
    else context.lineTo(line.target.x * SF, line.target.y * SF)
    context.stroke()
}//function drawLine

//////////////////////// Draw a curved line /////////////////////////
function drawCircleArc(context, line, SF) {
    let center = line.center
    let ang1 = Math.atan2(line.source.y - center.y, line.source.x - center.x)
    let ang2 = Math.atan2(line.target.y - center.y, line.target.x - center.x)
    context.arc(center.x * SF, center.y * SF, line.r * SF, ang1, ang2, line.sign)
}//function drawCircleArc

/////////////////////// Calculate Line Centers //////////////////////
function calculateEdgeCenters(l, size = 2, sign) {

    //Find a good radius
    l.r = Math.sqrt(sq(l.target.x - l.source.x) + sq(l.target.y - l.source.y)) * size //2 //Can run from >= 0.5
    //Find center of the arc function
    let centers = findCenters(l.r, { x: l.source.x, y: l.source.y }, { x: l.target.x, y: l.target.y })
    l.sign = sign !== undefined ? sign : l.sign
    l.center = l.sign ? centers.c2 : centers.c1

    /////////////// Calculate center for curved edges ///////////////
    //https://stackoverflow.com/questions/26030023
    //http://jsbin.com/jutidigepeta/3/edit?html,js,output
    function findCenters(r, p1, p2) {
        // pm is middle point of (p1, p2)
        let pm = { x: 0.5 * (p1.x + p2.x), y: 0.5 * (p1.y + p2.y) }
        // compute leading vector of the perpendicular to p1 p2 == C1C2 line
        let perpABdx = - (p2.y - p1.y)
        let perpABdy = p2.x - p1.x
        // normalize vector
        let norm = Math.sqrt(sq(perpABdx) + sq(perpABdy))
        perpABdx /= norm
        perpABdy /= norm
        // compute distance from pm to p1
        let dpmp1 = Math.sqrt(sq(pm.x - p1.x) + sq(pm.y - p1.y))
        // sin of the angle between { circle center,  middle , p1 }
        let sin = dpmp1 / r
        // is such a circle possible ?
        if (sin < -1 || sin > 1) return null // no, return null
        // yes, compute the two centers
        let cos = Math.sqrt(1 - sq(sin))   // build cos out of sin
        let d = r * cos
        let res1 = { x: pm.x + perpABdx * d, y: pm.y + perpABdy * d }
        let res2 = { x: pm.x - perpABdx * d, y: pm.y - perpABdy * d }
        return { c1: res1, c2: res2 }
    }//function findCenters
}//function calculateEdgeCenters

/////////////////// Create gradients for the links //////////////////
function calculateLinkGradient(context, l) {

    // l.gradient = context.createLinearGradient(l.source.x, l.source.y, l.target.x, l.target.y)
    // l.gradient.addColorStop(0, l.source.color)
    // l.gradient.addColorStop(1, l.target.color)

    // Incorporate opacity into gradient
    createGradient(l, l.target.special_type ? 0.2 : 0.4)

    function createGradient(l, alpha) {
        let col
        let color_rgb_source
        let color_rgb_target

        col = d3.rgb(l.source.color)
        color_rgb_source = "rgba(" + col.r + "," + col.g + "," + col.b + "," + alpha + ")"
        col = d3.rgb(l.target.color)
        color_rgb_target = "rgba(" + col.r + "," + col.g + "," + col.b + "," + alpha + ")"

        if(l.source.x !== undefined && l.target.x !== undefined) {
            l.gradient = context.createLinearGradient(l.source.x, l.source.y, l.target.x, l.target.y)
            l.gradient.addColorStop(0, color_rgb_source)
            l.gradient.addColorStop(1, color_rgb_target)
        }
        else l.gradient = COLOR_LINK
    }//function createGradient
}//function calculateLinkGradient



/////////////////////////////////////////////////////////////////////
////////////////////////////// Save PNG /////////////////////////////
/////////////////////////////////////////////////////////////////////

//Save as PNG on "s" and other key functions
window.onkeydown = function (e) {
    //Save at the current size
    if (e.which === 83) { //"s" key
        e.preventDefault()
        savePNG()
    }//if "s"
}//onkeydown

async function savePNG() {
    let time = new Date()
    let date_time = `${time.getFullYear()}-${pad(time.getMonth() + 1)}-${pad(time.getDate())} at ${pad(time.getHours())}.${pad(time.getMinutes())}.${pad(time.getSeconds())}`

    let download_link = document.createElement("a")
    canvas.toBlob(function(blob) {
        let url = URL.createObjectURL(blob)
        download_link.href = url
        download_link.download = `ORCA - ${date_time}.png`
        download_link.click()
        console.log("Saved image")
    })//toBlob

    //Pad with zero's on date/time
    function pad(value) {
        if (value < 10) return '0' + value
        else return value
    }//function pad
}//savePNG
