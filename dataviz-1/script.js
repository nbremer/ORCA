// Hover for environment (rust, ruby, javascript, etc)
// Tooltip (on canvas?)
// TODO: also show label when hovering over nodes without permanent label
// A tiny mark for everyone else (like pebbles on the outside)
// TODO: Make big lines into tapered ones?

// Central node a star-like shape of authors in points?

// Look into SAT solver for label placement
// Look into Cynthia Brewer paper for label



// Add title and intro (summary)
// Mozilla/pdfjs has time period
// Top contributors by count are these people
// These people have also contributed to X other repos
// Tiny histogram of the number of people that have done Y commits - with those top contributors highlighted



// Show; these people are compensated through being an employee, these people through ORCA, and these not

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
let authors, remainingAuthors
let repos
let nodes = [], nodes_central
let links
let central_repo

// Hover options
let delaunay
let voronoi
let HOVER_ACTIVE = false

// Settings
const CENTRAL_RADIUS = 50 // The radius of the central repository node
let RADIUS_AUTHOR // The eventual radius along which the author nodes are placed
const MAX_AUTHOR_WIDTH = 50 // The maximum width (at SF = 1) of the author name before it gets wrapped
const AUTHOR_PADDING = 20 // The padding between the author nodes around the circle (at SF = 1)

/////////////////////////////////////////////////////////////////////
/////////////////////////// Create Canvas ///////////////////////////
/////////////////////////////////////////////////////////////////////

const canvas = document.getElementById("canvas")
const context = canvas.getContext("2d")

const canvas_hover = document.getElementById("canvas-hover")
const context_hover = canvas_hover.getContext("2d")

/////////////////////////////////////////////////////////////////////
///////////////////////////// Set Sizes /////////////////////////////
/////////////////////////////////////////////////////////////////////

//Sizes
const DEFAULT_SIZE = 1400
let WIDTH, HEIGHT
let SF, PIXEL_RATIO

// Resize function
function resize() {
    // Screen pixel ratio
    PIXEL_RATIO = window.devicePixelRatio

    // Screen sizes
    let width =  window.innerWidth
    let height = window.innerHeight
    // Take the smaller of the two
    let size = min(width, height)

    WIDTH = round(width * PIXEL_RATIO)
    HEIGHT = round(height * PIXEL_RATIO)

    // Set the scale factor
    SF = (size * PIXEL_RATIO) / DEFAULT_SIZE
    console.log("SF:", SF)

    sizeCanvas(canvas)
    sizeCanvas(canvas_hover)
    // Size the canvas
    function sizeCanvas(canvas) {
        canvas.width = WIDTH
        canvas.height = HEIGHT
        canvas.style.width = `${width}px`
        canvas.style.height = `${height}px`
    }// function sizeCanvas

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
const COLOR_PURPLE = "#783ce6"
const COLOR_TEXT = "#4d4950"

/////////////////////////////////////////////////////////////////////
////////////////////////// Create Functions /////////////////////////
/////////////////////////////////////////////////////////////////////

let parseDate = d3.timeParse("%Y-%m-%dT%H:%M:%SZ")
let parseDateUnix = d3.timeParse("%s")
let formatDate = d3.timeFormat("%b %Y")
let formatDigit = d3.format(",.2s")
// let formatDigit = d3.format(",.2r")

const scale_repo_radius = d3.scaleSqrt()
    .range([4, 20])

// Based on the number of commits to the central repo
const scale_author_radius = d3.scaleSqrt()
    .range([8, 30])

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

// The scale for between which min and max date the author has been involved in the central repo
const scale_involved_range = d3.scaleLinear()
    .range([0, TAU])
    // .range([0 - PI/2, TAU - PI/2])

/////////////////////////////////////////////////////////////////////
/////////////////////////////// START ///////////////////////////////
/////////////////////////////////////////////////////////////////////

//Start it all the first time
window.addEventListener("resize", resize)
resize()

//Draw
function draw() {
    render(canvas, context, WIDTH, HEIGHT, SF)
}//function draw

let promises = []
promises.push(d3.csv(`data/${REPOSITORY}/authorInfo-PDFjs.csv`))
promises.push(d3.csv(`data/${REPOSITORY}/baseRepoInfo-PDFjs.csv`))
promises.push(d3.csv(`data/${REPOSITORY}/links-PDFjs.csv`))
promises.push(d3.csv(`data/${REPOSITORY}/remainingContributors-PDFjs.csv`))

///////////////////////// Read in the fonts /////////////////////////

const FONT_FAMILY = "Atkinson Hyperlegible"
document.fonts.load(`normal 400 10px "${FONT_FAMILY}"`)
document.fonts.load(`italic 400 10px "${FONT_FAMILY}"`)
document.fonts.load(`normal 700 10px "${FONT_FAMILY}"`)
document.fonts.load(`italic 700 10px "${FONT_FAMILY}"`)

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
    remainingAuthors = values[3]
    prepareData(authors, repos, links, remainingAuthors)

    /////////////////////////////////////////////////////////////////
    //////////////// Run Force Simulation per Author ////////////////
    /////////////////////////////////////////////////////////////////
    // Run a force simulation for per author for all the repos that are not shared between other authors
    // Like a little cloud of repos around them
    singleAuthorForceSimulation()

    /////////////////////////////////////////////////////////////////
    ///////////////////// Position Author Nodes /////////////////////
    /////////////////////////////////////////////////////////////////
    // Place the central repo in the middle
    central_repo.x = central_repo.fx = 0 //WIDTH / 2
    central_repo.y = central_repo.fy = 0 //HEIGHT / 2

    // Place the author nodes in a circle around the central repo
    // Taking into account the max_radius of single-degree repos around them
    positionAuthorNodes()

    /////////////////////////////////////////////////////////////////
    ///////////// Run Force Simulation for Shared Repos /////////////
    /////////////////////////////////////////////////////////////////
    // Run a force simulation to position the repos that are shared between authors 
    collaborationRepoSimulation()

    /////////////////////////////////////////////////////////////////
    ///////////////////////// Return Sketch /////////////////////////
    /////////////////////////////////////////////////////////////////

    return (canvas, context, WIDTH, HEIGHT, SF) => {
        context.lineJoin = "round" 
        context_hover.lineJoin = "round" 

        context.fillStyle = COLOR_BACKGROUND
        context.fillRect(0, 0, WIDTH, HEIGHT)

        // context.save()
        context.translate(WIDTH / 2, HEIGHT / 2)

        // Reset the voronoi/delaunay for the mouse events
        delaunay = d3.Delaunay.from(nodes.map(d => [d.x, d.y]))
        voronoi = delaunay.voronoi([0,0, WIDTH, HEIGHT])

        // Draw all the links as lines
        links.forEach(l => {
            drawLink(context, l) 
            // context.beginPath()
            // context.moveTo(l.source.x * SF, l.source.y * SF)
            // context.lineTo(l.target.x * SF, l.target.y * SF)
            // context.stroke()
        })// forEach

        /////////////////////////////////////////////////////////////
        // Draw all the nodes as circles
        nodes
            // .filter(d => d.id !== central_repo.id)
            .forEach(d => {
                drawNode(context, SF, d)
            })// forEach

        /////////////////////////////////////////////////////////////
        // Draw the labels for the repositories in the center (those that have more than one contributor)
        nodes_central.forEach(d => {
            drawNodeLabel(context, d)
        })// forEach

        console.log("Finished Drawing")

        // canvas.ontouchmove =
        // canvas.onmousemove = event => {
        //         event.preventDefault();
        //         console.log(event.layerX)
        //     };

        // HOVER
        d3.select("#canvas-hover").on("mousemove", function(event) {
            // Get the position of the mouse on the canvas
            let [mx, my] = d3.pointer(event, this)
            mx = ((mx * PIXEL_RATIO) - WIDTH / 2) / SF
            my = ((my * PIXEL_RATIO) - HEIGHT / 2) / SF

            //Get the closest hovered node
            let point = delaunay.find(mx, my)
            let d = nodes[point]
            // Get the distance from the mouse to the node
            let dist = Math.sqrt((d.x - mx)**2 + (d.y - my)**2)
            // If the distance is too big, don't show anything
            let FOUND = dist < d.r + 50
            
            drawHoverState(context_hover, d, FOUND)

            function drawHoverState(context, d, FOUND) {
                // Draw the hover canvas
                context.save()
                context.clearRect(0, 0, WIDTH, HEIGHT)
                context.translate(WIDTH / 2, HEIGHT / 2)

                if(FOUND) {
                    HOVER_ACTIVE = true

                    // Fade out the main canvas, using CSS
                    canvas.style.opacity = '0.3'

                    /////////////////////////////////////////////////
                    // Draw all the links to this node
                    links.filter(l => l.source.id === d.id || l.target.id === d.id)
                        .forEach(l => {
                            drawLink(context, l)
                        })// forEach

                    /////////////////////////////////////////////////
                    // Get all the connected nodes (if not done before)
                    if(d.neighbors === undefined) d.neighbors = nodes.filter(n => links.find(l => l.source.id === d.id && l.target.id === n.id || l.target.id === d.id && l.source.id === n.id))
                    // Draw all the connected nodes
                    d.neighbors.forEach(n => {
                            // Draw the hovered node
                            drawNode(context, SF, n)
                            if(n.node_central) drawNodeLabel(context_hover, n)
                        })// forEach

                    /////////////////////////////////////////////////
                    // Draw the hovered node
                    drawNode(context, SF, d)
                    // Show a ring around the hovered node
                    drawHoverRing(context, d)
                    
                    /////////////////////////////////////////////////
                    // Show its label
                    // if(d.node_central && d.type === "author") drawNodeLabel(context, d)

                    /////////////////////////////////////////////////
                    // Create a tooltip with more info
                    const x_base = d.x
                    const y_base = d.y - d.r

                    let H
                    if(d.type === "author") H = 95
                    else {
                        if(d.data.languages.length > 3) H = 174
                        else if(d.data.languages.length > 0) H = 162
                        else H = 126
                    }
                    const W = 220
                    context.save()
                    context.translate(x_base * SF, (y_base - H - 20) * SF)

                    let x = 0
                    let y = 0

                    // Background rectangle
                    context.shadowBlur = 3 * SF
                    context.shadowColor = "#d4d4d4"
                    context.fillStyle = COLOR_BACKGROUND
                    context.fillRect((x - W/2)*SF, y*SF, W*SF, H*SF)
                    context.shadowBlur = 0
                    
                    // Line along the side
                    context.fillStyle = d.type === "author" ? COLOR_AUTHOR : COLOR_REPO
                    context.fillRect((x - W/2 - 1)*SF, (y-1)*SF, (W+2)*SF, 6*SF)


                    context.textAlign = "center"
                    context.textBaseline = "middle"
                    
                    let line_height = 1.2
                    let font_size
                    let text


                    // Contributor or repo
                    y = 22
                    font_size = 10.5
                    setFont(context, font_size * SF, 400, "italic")
                    context.fillStyle = d.type === "author" ? COLOR_AUTHOR : COLOR_REPO
                    renderText(context, d.type === "author" ? "contributor" : "repository", x * SF, y * SF, 2.5 * SF)

                    context.fillStyle = COLOR_TEXT
                    y += 20

                    if (d.type === "author") {
                        // The author's name
                        font_size = 14
                        setFont(context, font_size * SF, 700, "normal")
                        renderText(context, d.data.author_name, x * SF, y * SF, 1.25 * SF)
                        // d.data.author_lines.forEach((l, i) => {
                        //     renderText(context, l, x * SF, (y + i * line_height * font_size) * SF, 1.25 * SF)
                        // })

                        // Number of commits to the central repo
                        y += 22
                        font_size = 11
                        setFont(context, font_size * SF, 400, "normal")
                        context.globalAlpha = 0.8
                        renderText(context, `${formatDigit(d.data.link_central.commit_count)} commits to ${central_repo.label}`, x * SF, y * SF, 1.25 * SF)
                        
                        // First and last commit to main repo
                        font_size = 9.5
                        context.globalAlpha = 0.6
                        setFont(context, font_size * SF, 400, "normal")
                        y += font_size * line_height + 3
                        // Check if the start and end date are in the same month of the same year
                        if(d.data.link_central.commit_sec_min.getMonth() === d.data.link_central.commit_sec_max.getMonth() && d.data.link_central.commit_sec_min.getFullYear() === d.data.link_central.commit_sec_max.getFullYear()) {
                            text = `In ${formatDate(d.data.link_central.commit_sec_min)}`
                        } else { 
                            text = `Between ${formatDate(d.data.link_central.commit_sec_min)} & ${formatDate(d.data.link_central.commit_sec_max)}`
                        }
                        renderText(context, text, x * SF, y * SF, 1.25 * SF)

                    } else {
                        // The repo's name and owner
                        font_size = 13
                        setFont(context, font_size * SF, 700, "normal")
                        renderText(context, `${d.data.owner}/`, x * SF, y * SF, 1.25 * SF)
                        renderText(context, d.label, x * SF, (y + line_height * font_size) * SF, 1.25 * SF)

                        // The creation date
                        y += 35
                        font_size = 9.5
                        context.globalAlpha = 0.6
                        setFont(context, font_size * SF, 400, "normal")
                        renderText(context, `Created in ${formatDate(d.data.createdAt)}`, x * SF, y * SF, 1.25 * SF)
                        // The most recent updated date
                        y += font_size * line_height
                        renderText(context, `Last updated in ${formatDate(d.data.updatedAt)}`, x * SF, y * SF, 1.25 * SF)

                        // The number of stars & forks
                        y += 19
                        font_size = 10.5
                        setFont(context, font_size * SF, 400, "normal")
                        context.globalAlpha = 0.9
                        let stars = d.data.stars
                        let forks = d.data.forks
                        renderText(context, `${stars < 10 ? stars : formatDigit(stars)} stars | ${forks < 10 ? forks : formatDigit(forks)} forks`, x * SF, y * SF, 1.25 * SF)
                        context.globalAlpha = 1

                        // Languages
                        console.log(d.data.languages)
                        if(d.data.languages.length > 0) {
                            y += 23
                            font_size = 9.5
                            context.globalAlpha = 0.6
                            setFont(context, font_size * SF, 400, "italic")
                            renderText(context, "Languages", x * SF, y * SF, 2 * SF)

                            font_size = 10.5
                            y += font_size * line_height + 3
                            context.globalAlpha = 0.9
                            setFont(context, font_size * SF, 400, "normal")
                            text = ""
                            for(let i = 0; i < Math.min(3, d.data.languages.length); i++) {
                                text += `${d.data.languages[i]}${i < Math.min(3, d.data.languages.length) - 1 ? ", " : ""}`
                            }// for i
                            renderText(context, text, x * SF, y * SF, 1.25 * SF)
                            if(d.data.languages.length > 3) {
                                y += font_size * line_height
                                text = `& ${d.data.languages.length - 3} more`
                                renderText(context, text, x * SF, y * SF, 1.25 * SF)
                            }// if

                        }// if

                    }// else

                    context.restore()

                } else {
                    HOVER_ACTIVE = false

                    // Fade the main canvas back in
                    canvas.style.opacity = '1'
                }// else

                context.restore()
            }// function drawHoverState




        })
    }// sketch
}// createFullVisual

/////////////////////////////////////////////////////////////////////
///////////////////// Data Preparation Functions ////////////////////
/////////////////////////////////////////////////////////////////////

////////////////// Prepare the data for the visual //////////////////
function prepareData(authors, repos, links) {
    /////////////////////////////////////////////////////////////
    ///////////////////// Initial Data Prep /////////////////////
    /////////////////////////////////////////////////////////////
    authors.forEach(d => {
        d.author_name = d.author_name_top

        // Has the person been a (Mozilla) employee
        d.employee_sec_min = parseDateUnix(d.employee_sec_min)
        d.employee_sec_max = parseDateUnix(d.employee_sec_max)

        d.color = COLOR_AUTHOR

        // Determine across how many lines to split the author name
        setAuthorFont(context);
        [d.author_lines, d.author_max_width] = getLines(context, d.author_name, MAX_AUTHOR_WIDTH);
        
        delete d.author_name_top
    })// forEach

    repos.forEach(d => {
        d.repo = d.base_repo_original
        d.forks = +d.repo_forks
        d.stars = +d.repo_stars
        d.createdAt = parseDate(d.repo_createdAt)
        d.updatedAt = parseDate(d.repo_updatedAt)

        // Get the substring until the slash
        d.owner = d.repo.substring(0, d.repo.indexOf("/"))
        // Get the substring after the slash
        d.name = d.repo.substring(d.repo.indexOf("/") + 1)

        // Split the string of languages into an array
        d.languages = d.repo_languages.split(",")
        // Remove languages that are empty or ""
        d.languages = d.languages.filter(l => l !== "" && l !== " ")

        d.color = COLOR_REPO

        delete d.base_repo_original
        delete d.repo_forks
        delete d.repo_stars
        delete d.repo_createdAt
        delete d.repo_updatedAt
    })// forEach

    links.forEach(d => {
        // Source
        d.author_name = d.author_name_top
        // Target
        d.repo = d.base_repo_original

        // Metadata of the "link"
        d.commit_count = +d.commit_count
        d.commit_sec_min = parseDateUnix(d.commit_sec_min)
        d.commit_sec_max = parseDateUnix(d.commit_sec_max)

        // Get the substring until the slash
        d.owner = d.base_repo_original.substring(0, d.base_repo_original.indexOf("/"))
        // Get the substring after the slash
        d.name = d.base_repo_original.substring(d.base_repo_original.indexOf("/") + 1)

        delete d.base_repo_original
        delete d.author_name_top
    })// forEach

    remainingAuthors.forEach(d => {
        d.commit_count = +d.commit_count
        d.author_sec_min = parseDateUnix(d.author_sec_min)
        d.author_sec_max = parseDateUnix(d.author_sec_max)
    })// forEach

    // console.log(authors[0])
    // console.log(repos[0])
    // console.log(remainingAuthors[0])
    // console.log(links[0])

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

    ///////////// Calculate visual settings of Nodes ////////////
    nodes.forEach(d => {
        // Find the degree of each node
        d.degree = links.filter(l => l.source === d.id || l.target === d.id).length
        // d.in_degree = links.filter(l => l.target === d.id).length
        // d.out_degree = links.filter(l => l.source === d.id).length

        // Get all the connected nodes
        // d.neighbors = nodes.filter(n => links.find(l => l.source === d.id && l.target === n.id || l.target === d.id && l.source === n.id))
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
    central_repo = nodes.find(d => d.type === "repo" && d.degree === d3.max(nodes.filter(d => d.type === "repo"), d => d.degree))

    // Set scales
    scale_repo_radius.domain(d3.extent(repos, d => d.stars))
    scale_author_radius.domain(d3.extent(links.filter(l => l.target === central_repo.id), d => d.commit_count))
    scale_involved_range.domain([central_repo.data.createdAt, central_repo.data.updatedAt])

    // Determine some visual settings for the nodes
    nodes.forEach((d,i) => {
        d.index = i
        d.data.index = i

        // If this node is an "author", find the number of commits they have on the central repo node
        if(d.type === "author") {
            let link_to_central = links.find(l => l.source === d.id && l.target === central_repo.id)
            d.data.link_central = link_to_central
            // d.data.commit_count_central = link_to_central.commit_count
            d.r = scale_author_radius(d.data.link_central.commit_count)
        }     
        else {
            d.r = scale_repo_radius(d.data.stars)
        }// else 

        d.color = d.data.color
    })// forEach

    // Replace some values for the central repository
    central_repo.r = CENTRAL_RADIUS
    central_repo.padding = CENTRAL_RADIUS
    central_repo.special_type = "central"
    central_repo.color = COLOR_REPO_MAIN
    
}// function prepareData

/////////////////////////////////////////////////////////////////////
/////////////////// Force Simulation | Per Author ///////////////////
/////////////////////////////////////////////////////////////////////

// Run a force simulation for per author for all the repos that are not shared between other authors
// Like a little cloud of repos around them
function singleAuthorForceSimulation() {
    // First fix the author nodes in the center - this is only temporarily
    nodes
        .filter(d => d.type === "author")
        .forEach((d,i) => {
                d.x = d.fx = 0
                d.y = d.fy = 0

                // // For testing
                // // Place the authors in a grid of 10 columns
                // d.x = -WIDTH/4 + (i % 8) * 140
                // d.y = -HEIGHT/4 + Math.floor(i / 8) * 150
                // d.fx = d.x
                // d.fy = d.y
            })// forEach

    // Next run a force simulation to place all the single-degree repositories
    nodes
        .filter(d => d.type === "author")
        .forEach(d => {
            // Find all the nodes that are connected to this one with a degree of one, including the author node itself
            let nodes_to_author = nodes.filter(n => links.find(l => l.source === d.id && l.target === n.id && n.degree === 1) || n.id === d.id)

            // If there are no nodes connected to this one, skip it
            // if(nodes_to_author.length <= 1) return

            // Save the list of repositories that are connected to this author (with a degree of one)
            d.connected_single_repo = nodes_to_author.filter(n => n.type === "repo")

            // Get the links between this node and nodes_to_author
            let links_author = links.filter(l => l.source === d.id && nodes_to_author.find(n => n.id === l.target))

            // Let the nodes start on the location of the author node
            nodes_to_author.forEach(n => {
                n.x = d.fx + Math.random() * (Math.random() > 0.5 ? 1 : -1)
                n.y = d.fy + Math.random() * (Math.random() > 0.5 ? 1 : -1)
            })// forEach

            /////////////////////////////////////////////////////////
            /////////////////////// Simulation //////////////////////
            /////////////////////////////////////////////////////////
            // Define the simulation
            let simulation = d3.forceSimulation()
                .force("link",
                    // There are links, but they have no strength
                    d3.forceLink()
                        .id(d => d.id)
                        .strength(0)
                )
                .force("collide",
                    // Use a non-overlap, but let it start out at strength 0
                    d3.forceCollide()
                        .radius(n => n.id === d.id ? d.r + Math.min(14,Math.max(10, d.r)) : n.r + Math.max(2, n.r * 0.2))
                        .strength(0)
                )
                // .force("charge",
                //     d3.forceManyBody()
                //         .strength(-20)
                //         // .distanceMax(WIDTH / 3)
                // )
                // Keep the repo nodes want to stay close to the author node
                // so they try to spread out evenly around it
                .force("x", d3.forceX().x(d.fx).strength(0.1))
                .force("y", d3.forceY().y(d.fy).strength(0.1))

            simulation
                .nodes(nodes_to_author)
                .stop()
                // .on("tick", ticked)
    
            simulation.force("link").links(links_author)

            //Manually "tick" through the network
            let n_ticks = 200
            for (let i = 0; i < n_ticks; ++i) {
                simulation.tick()
                //Ramp up collision strength to provide smooth transition
                simulation.force("collide").strength(Math.pow(i / n_ticks, 2) * 0.8)
            }//for i
            // TEST - Draw the result
            // drawAuthorBubbles(nodes_to_author, links_author)

            // Determine the farthest distance of the nodes (including its radius) to the author node
            d.max_radius = d3.max(nodes_to_author, n => Math.sqrt((n.x - d.x)**2 + (n.y - d.y)**2))
            // Determine which node is the largest distance to the author node
            let max_radius_node = nodes_to_author.find(n => Math.sqrt((n.x - d.x)**2 + (n.y - d.y)**2) === d.max_radius)
            // Get the overall radius to take into account for the next simulation and labeling
            d.max_radius = Math.max(d.max_radius + max_radius_node.r, d.r)
            // See this as the new "author node" radius that includes all of it's single-degree repos

        })// forEach

    function drawAuthorBubbles(nodes, links) {
            context.save()
            context.translate(WIDTH / 2, HEIGHT / 2)

            // Draw all the links as lines
            links.forEach(l => {
                if(l.source.x !== undefined && l.target.x !== undefined) {
                    calculateEdgeCenters(l, 0.8)
                    calculateLinkGradient(context, l)
                    context.strokeStyle = l.gradient 
                } else context.strokeStyle = COLOR_LINK
                context.lineWidth = scale_link_width(l.commit_count) * SF
                drawLine(context, l, SF)
            })// forEach

            // Draw all the nodes as circles
            nodes
                .filter(d => d.id !== central_repo.id)
                .forEach(d => {
                    context.fillStyle = d.color
                    let r = d.r //d.type === "author" ? 10 : d.r
                    drawCircle(context, d.x, d.y, SF, r)
                })// forEach

            context.restore()
    }// function drawAuthorBubbles
}// function singleAuthorForceSimulation

// Place the author nodes in a circle around the central repo
// Taking into account the max_radius of single-degree repos around them
function positionAuthorNodes() {
    // Get the sum of all the author nodes' max_radius
    let sum_radius = nodes
        .filter(d => d.type === "author")
        .reduce((acc, curr) => acc + curr.max_radius * 2, 0)
    // Take padding into account between the author nodes
    sum_radius += authors.length * AUTHOR_PADDING
    // This sum should be the circumference of the circle around the central node, what radius belongs to this -> 2*pi*R
    RADIUS_AUTHOR = sum_radius / TAU

    // Fix the author nodes in a ring around the central node
    // const angle = TAU / (nodes.filter(d => d.type === "author").length)
    let angle = 0
    nodes
        .filter(d => d.type === "author")
        .forEach((d,i) => {
            // Subtract the author node position from all it's connected single-degree repos
            d.connected_single_repo.forEach(repo => {
                repo.x -= d.x
                repo.y -= d.y
            })// forEach

            // Find the new position of the author node in a ring around the central node
            let author_arc = d.max_radius * 2 + AUTHOR_PADDING
            // translate this distance to an angle
            let author_angle = (author_arc / RADIUS_AUTHOR)/2
            d.x = central_repo.fx + RADIUS_AUTHOR * cos(angle + author_angle - PI/2)
            d.y = central_repo.fy + RADIUS_AUTHOR * sin(angle + author_angle - PI/2)
            d.author_angle = angle + author_angle - PI/2
            angle += author_angle * 2

            // Fix the authors for the force simulation
            d.fx = d.x
            d.fy = d.y

            // Add the new author position to all it's connected single-degree repos
            d.connected_single_repo.forEach(repo => {
                repo.x += d.x
                repo.y += d.y

                // Just in case
                repo.fx = repo.x
                repo.fy = repo.y
            })// forEach

            // 
        })// forEach
}// function positionAuthorNodes

/////////////////////////////////////////////////////////////////////
/////////////// Force Simulation | Collaboration Repos //////////////
/////////////////////////////////////////////////////////////////////

// Run a force simulation to position the repos that are shared between authors
function collaborationRepoSimulation() {
    //
    let simulation = d3.forceSimulation()
        .force("link",
            d3.forceLink()
                .id(d => d.id)
                // .distance(50)
                .distance(d => scale_link_distance(d.target.degree) * 5)
                // .strength(d => scale_link_strength(d.source.degree))
        )
        .force("collide",
            d3.forceCollide()
                .radius(d => {
                    let r = d.max_radius ? d.max_radius : d.r
                    return r + (d.padding ? d.padding : Math.max(r/2, 15))
                })
                .strength(0)
        )
        .force("charge",
            d3.forceManyBody()
                // .strength(d => scale_node_charge(d.id))
                // .distanceMax(WIDTH / 3)
        )
        // .force("x", d3.forceX().x(d => d.focusX).strength(0.08)) //0.1
        // .force("y", d3.forceY().y(d => d.focusY).strength(0.08)) //0.1
        // .force("center", d3.forceCenter(0,0))

    // Keep the nodes that are an "author" or a repo that has a degree > 1 (and is thus committed to by more than one author)
    nodes_central = nodes.filter(d => d.type === "author" || (d.type === "repo" && d.degree > 1))
    nodes_central.forEach(d => {
        d.node_central = true
    })// forEach

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
        simulationPlacementConstraints(nodes_central)
        //Ramp up collision strength to provide smooth transition
        simulation.force("collide").strength(Math.pow(i / n_ticks, 2) * 0.7)
    }//for i

    // Once it's done, fix the positions of the nodes used in the simulation
    // simulation.on("end", () => {
        nodes_central.forEach(d => {
            d.fx = d.x
            d.fy = d.y
        })// forEach
    // })

    /////////////////////////////////////////////////////////////
    function simulationPlacementConstraints(nodes) {
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
}// function collaborationRepoSimulation

/////////////////////////////////////////////////////////////////////
/////////////////////// Node Drawing Functions //////////////////////
/////////////////////////////////////////////////////////////////////

function drawNode(context, SF, d) {
    context.shadowBlur = HOVER_ACTIVE ? 0 : Math.max(2, d.r * 0.2) * SF
    context.shadowColor = "#f7f7f7"//d.color
    context.fillStyle = d.color
    // context.globalAlpha = d.type === "author" ? 1 : scale_node_opacity(d.degree)
    let r = d.r //d.type === "author" ? 10 : d.r
    drawCircle(context, d.x, d.y, SF, r)
    context.shadowBlur = 0

    // Also draw a stroke around the node
    // context.globalAlpha = 0.5
    context.strokeStyle = COLOR_BACKGROUND
    context.lineWidth = Math.max(HOVER_ACTIVE ? 1.5 : 1, d.r * 0.07) * SF
    context.stroke()
    context.globalAlpha = 1

    // Draw a tiny arc inside the author node to show how long they've been involved in the central repo's existence, based on their first and last commit
    if(d.type === "author") {
        const arc = d3.arc()
            .context(context)

        context.save()
        context.translate(d.x * SF, d.y * SF)

        context.fillStyle = COLOR_REPO_MAIN

        // If this person also has a non-zero employee_sec_min, draw a thick arc from the min to max commit second that is connected to their employee status
        if(d.data.employee_sec_min) {
            arc
                .innerRadius((d.r + 2.5 - 1.5) * SF)
                .outerRadius((d.r + 2.5 + 3 + 1.5) * SF)
                .startAngle(scale_involved_range(d.data.employee_sec_min))
                .endAngle(scale_involved_range(d.data.employee_sec_max))

            // Create the arc
            context.beginPath()
            arc()
            context.fill()
        }// if

        // TODO: Check that the angle is not too small
        // let angle = scale_involved_range(d.data.link_central.commit_sec_max) - scale_involved_range(d.data.link_central.commit_sec_min)
        arc 
            .innerRadius((d.r + 2.5) * SF)
            .outerRadius((d.r + 2.5 + 3) * SF)
            .startAngle(scale_involved_range(d.data.link_central.commit_sec_min))
            .endAngle(scale_involved_range(d.data.link_central.commit_sec_max))
            .context(context)

        // Create the arc
        context.beginPath()
        arc()
        context.fill()
        
        // Draw a tiny marker at the top to show where the "start" is
        context.strokeStyle = COLOR_REPO_MAIN
        context.lineWidth = 1 * SF
        context.beginPath()
        context.moveTo(0, - (d.r + 2) * SF)
        context.lineTo(0, - (d.r + 2 + 5) * SF)
        context.stroke()

        context.restore()
    }// if
}// function drawNode

// Draw a stroked ring around the hovered node
function drawHoverRing(context, d) {
    let r = d.r + (d.type === "author" ? 11 : d.special_type ? 14 : 5)
    context.beginPath()
    context.moveTo((d.x + r) * SF, d.y * SF)
    context.arc(d.x * SF, d.y * SF, r * SF, 0, TAU)
    context.strokeStyle = d.color
    context.lineWidth = 3 * SF
    context.stroke()
}// function drawHoverRing

/////////////////////////// Draw a circle ///////////////////////////
function drawCircle(context, x, y, SF, r = 10, begin = true) {
    if(begin) context.beginPath()
    context.moveTo((x+r) * SF, y * SF)
    context.arc(x * SF, y * SF, r * SF, 0, TAU)
    if(begin) context.fill()
    // if(begin) { context.lineWidth = 1.5 * SF; context.stroke() }
}//function drawCircle

/////////////////////////////////////////////////////////////////////
/////////////////////// Line Drawing Functions //////////////////////
/////////////////////////////////////////////////////////////////////

//////////// Draw the link between the source and target ////////////
function drawLink(context, l) {
    if(l.source.x !== undefined && l.target.x !== undefined) {
        calculateLinkGradient(context, l)
        calculateEdgeCenters(l, 1)
        context.strokeStyle = l.gradient 
    } else context.strokeStyle = COLOR_LINK

    let line_width = scale_link_width(l.commit_count)
    context.lineWidth = line_width * SF
    drawLine(context, l, SF)
}// function drawLink

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
function calculateEdgeCenters(l, size = 2, sign = true) {

    //Find a good radius
    l.r = Math.sqrt(sq(l.target.x - l.source.x) + sq(l.target.y - l.source.y)) * size //Can run from > 0.5
    //Find center of the arc function
    let centers = findCenters(l.r, { x: l.source.x, y: l.source.y }, { x: l.target.x, y: l.target.y })
    l.sign = sign
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
    let alpha
    if(HOVER_ACTIVE) alpha = l.target.special_type ? 0.3 : 0.7
    else alpha = l.target.special_type ? 0.15 : 0.5
    createGradient(l, alpha)

    function createGradient(l, alpha) {
        let col
        let color_rgb_source
        let color_rgb_target

        col = d3.rgb(l.source.color)
        color_rgb_source = "rgba(" + col.r + "," + col.g + "," + col.b + "," + alpha + ")"
        col = d3.rgb(l.target.color)
        color_rgb_target = "rgba(" + col.r + "," + col.g + "," + col.b + "," + alpha + ")"

        // console.log(l.source.x, l.source.y, l.target.x, l.target.y)
        if(l.source.x !== undefined && l.target.x !== undefined) {
            l.gradient = context.createLinearGradient(l.source.x * SF, l.source.y * SF, l.target.x * SF, l.target.y * SF)

            // Distance between source and target
            let dist = Math.sqrt(sq(l.target.x - l.source.x) + sq(l.target.y - l.source.y))
            // What percentage is the source's radius of the total distance
            let perc = l.source.r / dist
            // Let the starting color be at perc, so it starts changing color right outside the radius of the source node
            l.gradient.addColorStop(perc, color_rgb_source)
            l.gradient.addColorStop(1, color_rgb_target)
        }
        else l.gradient = COLOR_LINK
    }//function createGradient
}//function calculateLinkGradient

/////////////////////////////////////////////////////////////////////
/////////////////////////// Text Functions //////////////////////////
/////////////////////////////////////////////////////////////////////

function drawNodeLabel(context, d) {
    // Draw the name above each node
    context.fillStyle = COLOR_TEXT
    context.lineWidth = 2 * SF
    context.textAlign = "center"
    context.textBaseline = "middle"
    // context.textBaseline = "bottom"

    if(d.type === "author") {
        setAuthorFont(context, SF)
    } else {
        setRepoFont(context, SF)
    }// else

    if(d.id === central_repo.id) {
        font_weight = 700
        font_size = 16
        context.font = `${font_weight} ${font_size * SF}px ${FONT_FAMILY}`
    }// if

    if(d.type === "author") {
        // context.textAlign = "center"
        context.textBaseline = "middle"

        // Draw the author name radiating outward from the author's node
        context.save()
        context.translate(d.x * SF, d.y * SF)
        context.rotate(d.author_angle + (d.author_angle > PI/2 ? PI : 0))
        // Move the max_radius farther away
        context.translate((d.author_angle > PI/2 ? -1 : 1) * (d.max_radius + 10) * SF, 0)
        context.textAlign = d.author_angle > PI/2 ? "right" : "left"

        let n = d.data.author_lines.length
        let label_line_height = 1.2
        let font_size = 12
        d.data.author_lines.forEach((l, i) => {
            let x = 0
            // Let the y-position be the center of the author node
            let y = (0 - (n - 1) * font_size * label_line_height / 2 + i * font_size * label_line_height) * SF
            renderText(context, l, x, y, 1.25 * SF)
        })

        // renderText(context, d.id, 0, 0, 1.25 * SF)

        context.restore()
    } else if(d.id === central_repo.id) {
        context.textAlign = "center"
        context.textBaseline = "middle"
        renderText(context, `${d.data.owner}/`, d.x * SF, (d.y - 0.6 * 12) * SF, 1.25 * SF)
        renderText(context, d.label, d.x * SF, (d.y + 0.6 * 12) * SF, 1.25 * SF)
    } else {
        context.textAlign = "center"
        context.textBaseline = "bottom"
        renderText(context, `${d.data.owner}/`, d.x * SF, (d.y - d.r - 3 - 1.1 * 12) * SF, 1.25 * SF)
        renderText(context, d.label, d.x * SF, (d.y - d.r - 3) * SF, 1.25 * SF)
    }// else
}// function drawNodeLabel

/////////////////////////////////////////////////////////////////////
/////////////////////////// Font Functions //////////////////////////
/////////////////////////////////////////////////////////////////////

////////////////////// Different Font Settings //////////////////////
function setFont(context, font_size, font_weight, font_style = "normal") {
    context.font = `${font_weight} ${font_style} ${font_size}px ${FONT_FAMILY}`
}//function setFont

function setRepoFont(context, SF = 1, font_size = 12) {
    setFont(context, font_size * SF, 400, "normal")
}//function setRepoFont

function setAuthorFont(context, SF = 1, font_size = 12) {
    setFont(context, font_size * SF, 700, "italic")
}//function setAuthorFont

//////////////// Add tracking (space) between letters ///////////////
function renderText(context, text, x, y, letterSpacing = 0) {
    //Based on http://jsfiddle.net/davidhong/hKbJ4/        
    let characters = String.prototype.split.call(text, '')
    let index = 0
    let current
    let currentPosition = x
    let alignment = context.textAlign

    let start_position
    let end_position

    let totalWidth = 0
    for (let i = 0; i < characters.length; i++) {
        totalWidth += context.measureText(characters[i]).width + letterSpacing
    }//for i

    if (alignment === "right") {
        currentPosition = x - totalWidth
    } else if (alignment === "center") {
        currentPosition = x - (totalWidth / 2)
    }//else if
    
    context.textAlign = "left"
    start_position = currentPosition
    while (index < text.length) {
        current = characters[index++]
        context.fillText(current, currentPosition, y)
        currentPosition += context.measureText(current).width + letterSpacing
    }//while
    end_position = currentPosition - (context.measureText(current).width/2)
    context.textAlign = alignment

    return [start_position, end_position]
}//function renderText

////////////// Split string into sections for wrapping //////////////
//From: https://stackoverflow.com/questions/2936112
function getLines(context, text, max_width, balance = true) {
    let words = text.split(" ")
    let lines = []
    let currentLine = words[0]

    for (let i = 1; i < words.length; i++) {
        let word = words[i]
        let width = context.measureText(currentLine + " " + word).width
        if (width < max_width) {
            currentLine += " " + word
        } else {
            lines.push(currentLine)
            currentLine = word
        }//else
    }//for i
    lines.push(currentLine)

    //Now that we know how many lines are needed, split those of 2 lines into better balanced sections
    if(balance && lines.length === 2) {
        lines = splitSpring(text)
    }//if

    //Figure out the maximum width of all the lines
    let max_length = 0
    lines.forEach(l => {
        let width = context.measureText(l).width
        if(width > max_length) max_length = width
    })//forEach

    return [lines, max_length]
}//function getLines

////////////// Split a string into 2 balanced sections //////////////
function splitSpring(text) {
    let len = text.length
    
    //Find the index of all spaces
    let indices = []
    for(let i = 0; i < text.length; i++) {
        if (text[i] === " ") indices.push(i)
    }//for i

    //Which space is the closes to the middle
    let diff = indices.map(d => Math.abs(len/2 - d))
    let min_value = Math.min(...diff)
    let ind = indices[diff.indexOf(min_value)]

    //Split the string at the "most-middle" space
    let str1 = text.substr(0, ind)
    let str2 = text.substr(ind)

    return [str1.trim(), str2.trim()]
}//function splitSpring

/////////////////////////////////////////////////////////////////////
////////////////////////// Helper Functions /////////////////////////
/////////////////////////////////////////////////////////////////////

function mod (x, n) { return ((x % n) + n) % n }

function sq(x) { return x * x }

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
