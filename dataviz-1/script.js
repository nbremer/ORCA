
// TODO: Mark the repos that are impacted by ORCA

// TODO: Make central node labels not overlap
// TODO: Look into label placement 
// Look into SAT solver for label placement
// Look into Cynthia Brewer paper for label

// TODO: On hover draw an arc around each connected repo to show the min and max date of involvement

// TODO: Make big lines into tapered ones?

// TODO: Add title and intro (summary) - On canvas or via divs?
// Top contributors by count are these people
// These people have also contributed to X other repos
// Tiny histogram of the number of people that have done Y commits - with those top contributors highlighted

// TODO: Add a legend
// TODO: Add credit

// TODO: A tiny mark for everyone else (like pebbles on the outside)
// TODO: Add hover for tiny circles, remaining contributors as well

/////////////////////////////////////////////////////////////////////
///////////////////////////// CONSTANTS /////////////////////////////
/////////////////////////////////////////////////////////////////////

let params = new URLSearchParams(window.location.search)
const REPOSITORY = [
    "pdfjs",
    "terraform"
].indexOf(params.get("repo")) === -1 ? "pdfjs" : params.get("repo")

let REPO_CENTRAL = "mozilla/pdf.js" // Default
if(REPOSITORY === "terraform") REPO_CENTRAL = "hashicorp/terraform"

// NOTE: Because there is no ORCA data yet, this is a dummy factor that will randomly determine roughly how many contributors are randomly selected to receive ORCA
const ORCA_LEVEL = Math.random()
console.log("Random ORCA level this time:", ORCA_LEVEL)

const PI = Math.PI
const TAU = PI * 2

let render

let round = Math.round
let cos = Math.cos
let sin = Math.sin
let min = Math.min
let max = Math.max

// Datasets
let contributors, remainingContributors
let repos
let nodes = [], nodes_central
let links
let central_repo

// Hover options
let delaunay
let voronoi
let HOVER_ACTIVE = false
let HOVERED_NODE = null

// Settings
const CENTRAL_RADIUS = 50 // The radius of the central repository node
let RADIUS_CONTRIBUTOR // The eventual radius along which the contributor nodes are placed
let RADIUS_CONTRIBUTOR_NON_ORCA // The radius along which the contributor nodes are placed that have not received ORCA
let ORCA_RING_WIDTH

const INNER_RADIUS_FACTOR = 0.7 // The factor of the RADIUS_CONTRIBUTOR outside of which the inner repos are not allowed to go in the force simulation
const MAX_CONTRIBUTOR_WIDTH = 55 // The maximum width (at SF = 1) of the contributor name before it gets wrapped
const CONTRIBUTOR_PADDING = 20 // The padding between the contributor nodes around the circle (at SF = 1)

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
const DEFAULT_SIZE = 1500
let WIDTH, HEIGHT, MARGIN_TOP
let SF, PIXEL_RATIO
let EXTRA_WIDTH_FACTOR = 1

// Resize function
function resize() {
    // Screen pixel ratio
    PIXEL_RATIO = window.devicePixelRatio

    // Screen sizes
    let width =  window.innerWidth - 20 // minus a little to avoid a possible horizontal scrollbar

    // It's the width that determines the size
    WIDTH = round(width * PIXEL_RATIO)
    MARGIN_TOP = round(WIDTH * 0.2) // For the title and legend etc.
    HEIGHT = round(width * PIXEL_RATIO) + MARGIN_TOP

    sizeCanvas(canvas)
    sizeCanvas(canvas_hover)

    // Size the canvas
    function sizeCanvas(canvas) {
        canvas.width = WIDTH
        canvas.height = HEIGHT
        canvas.style.width = `${width}px`
        canvas.style.height = `${HEIGHT / PIXEL_RATIO}px`
    }// function sizeCanvas

    if (render) draw()
}//function resize

/////////////////////////////////////////////////////////////////////
/////////////////////////////// Colors //////////////////////////////
/////////////////////////////////////////////////////////////////////

const COLOR_YELLOW = "#f2a900"
const COLOR_PURPLE = "#783ce6"

const COLOR_BACKGROUND = "#f7f7f7"
const COLOR_REPO_MAIN = "#a682e8"
const COLOR_REPO = "#64d6d3" // "#b2faf8"
const COLOR_OWNER = COLOR_YELLOW
const COLOR_CONTRIBUTOR = "#ea9df5"
const COLOR_LINK = "#e8e8e8"
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
const scale_contributor_radius = d3.scaleSqrt()
    .range([8, 30])

const scale_link_distance = d3.scaleLinear()
    .domain([1,50])
    .range([10,80])

const scale_link_strength = d3.scaleLinear()
    .domain([1,50])
    .range([10,80])

const scale_link_width = d3.scalePow()
    .exponent(0.75)
    .range([1,2,60])
    // .clamp(true)

// The scale for between which min and max date the contributor has been involved in the central repo
const scale_involved_range = d3.scaleLinear()
    .range([0, TAU])

/////////////////////////////////////////////////////////////////////
/////////////////////////////// START ///////////////////////////////
/////////////////////////////////////////////////////////////////////

//////////////////////// Datasets to Read in ////////////////////////
let promises = []
promises.push(d3.csv(`data/${REPOSITORY}/authorInfo-${REPOSITORY}.csv`))
promises.push(d3.csv(`data/${REPOSITORY}/baseRepoInfo-${REPOSITORY}.csv`))
promises.push(d3.csv(`data/${REPOSITORY}/links-${REPOSITORY}.csv`))
promises.push(d3.csv(`data/${REPOSITORY}/remainingContributors-${REPOSITORY}.csv`))

///////////////////////// Fonts to activate /////////////////////////
const FONT_FAMILY = "Atkinson Hyperlegible"
document.fonts.load(`normal 400 10px "${FONT_FAMILY}"`)
document.fonts.load(`italic 400 10px "${FONT_FAMILY}"`)
document.fonts.load(`normal 700 10px "${FONT_FAMILY}"`)
document.fonts.load(`italic 700 10px "${FONT_FAMILY}"`)

// Setup the resizing event and first scaling
window.addEventListener("resize", resize)
resize()

// Draw
function draw() {
    render(canvas, context, WIDTH, HEIGHT)
}//function draw

// Start
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
    contributors = values[0]
    repos = values[1]
    links = values[2]
    remainingContributors = values[3]
    prepareData()
    console.log("Data prepared")
    
    /////////////////////////////////////////////////////////////////
    ///////////////// Run Force Simulation per Owner ////////////////
    /////////////////////////////////////////////////////////////////
    // Run a force simulation for per owner for all the repos that have the same "owner"
    // Like a little cloud of repos around them
    singleOwnerForceSimulation()
    console.log("Contributor mini force simulation done")
    
    /////////////////////////////////////////////////////////////////
    ////////////// Run Force Simulation per Contributor /////////////
    /////////////////////////////////////////////////////////////////
    // Run a force simulation for per contributor for all the repos that are not shared between other contributors
    // Like a little cloud of repos around them
    singleContributorForceSimulation()
    console.log("Owner mini force simulation done")

    /////////////////////////////////////////////////////////////////
    /////////////////// Position Contributor Nodes //////////////////
    /////////////////////////////////////////////////////////////////
    // Place the central repo in the middle
    central_repo.x = central_repo.fx = 0
    central_repo.y = central_repo.fy = 0

    // Place the contributor nodes in a circle around the central repo
    // Taking into account the max_radius of single-degree repos around them
    positionContributorNodes()
    console.log("Contributor nodes positioned")

    /////////////////////////////////////////////////////////////////
    ///////////// Run Force Simulation for Shared Repos /////////////
    /////////////////////////////////////////////////////////////////
    // Run a force simulation to position the repos that are shared between contributors 
    collaborationRepoSimulation()
    console.log("Central force simulation done")

    /////////////////////////////////////////////////////////////////
    //////// Run Force Simulation for Remaining Contributors ////////
    /////////////////////////////////////////////////////////////////
    // Run a force simulation to position the remaining contributors around the central area
    remainingContributorSimulation()
    console.log("Remaining contributor force simulation done")

    /////////////////////////////////////////////////////////////////
    //////////////////////// Setup the Hover ////////////////////////
    /////////////////////////////////////////////////////////////////
    setupHover()

    /////////////////////////////////////////////////////////////////
    ///////////////////////// Return Sketch /////////////////////////
    /////////////////////////////////////////////////////////////////

    return (canvas, context, WIDTH, HEIGHT) => {

        // Set the scale factor
        SF = WIDTH / DEFAULT_SIZE
        // If this means that the ring won't fit, make the SF smaller        
        let OUTER_RING = RADIUS_CONTRIBUTOR_NON_ORCA + ORCA_RING_WIDTH/2*2
        if(WIDTH/2 < OUTER_RING * SF) SF = WIDTH / (2*OUTER_RING)
        console.log("SF:", SF)

        // Reset the voronoi/delaunay for the mouse events
        delaunay = d3.Delaunay.from(nodes.map(d => [d.x, d.y]))
        voronoi = delaunay.voronoi([0,0, WIDTH, HEIGHT])

        // Some canvas settings
        context.lineJoin = "round" 
        context.lineCap = "round"
        context_hover.lineJoin = "round" 
        context_hover.lineCap = "round"

        // Fill the background with a color
        context.fillStyle = COLOR_BACKGROUND
        context.fillRect(0, 0, WIDTH, HEIGHT)

        // Move the visual to the center
        context.save()
        context.translate(WIDTH / 2, MARGIN_TOP + WIDTH / 2)

        /////////////////////////////////////////////////////////////
        // Draw the remaining contributors
        context.fillStyle = COLOR_CONTRIBUTOR
        context.globalAlpha = 0.4
        remainingContributors.forEach(d => {
            context.globalAlpha = Math.random() * 0.4 + 0.2
            drawCircle(context, d.x, d.y, SF, d.r)
        })// forEach
        context.globalAlpha = 1

        /////////////////////////////////////////////////////////////
        // Draw two rings that show the placement of the ORCA receiving contributors versus the non-ORCA receiving contributors
        drawOrcaRings(context, SF)

        /////////////////////////////////////////////////////////////
        // Draw all the links as lines
        links.forEach(l => {
            drawLink(context, SF, l) 
        })// forEach

        /////////////////////////////////////////////////////////////
        // Draw all the nodes as circles
        nodes.forEach(d => {
            drawNode(context, SF, d)
        })// forEach

        /////////////////////////////////////////////////////////////
        // Draw the labels for the contributors and for the nodes in the center
        nodes_central
            // .filter(d => {
            //     return d.type === "contributor" || d.type === "owner" || (d.type === "repo" && d.degree > 3)
            // })
            .forEach(d => {
                drawNodeLabel(context, d)
            })// forEach

        context.restore()

    }// sketch
}// createFullVisual

/////////////////////////////////////////////////////////////////////
///////////////////// Data Preparation Functions ////////////////////
/////////////////////////////////////////////////////////////////////

////////////////// Prepare the data for the visual //////////////////
function prepareData() {
    /////////////////////////////////////////////////////////////////
    /////////////////////// Initial Data Prep ///////////////////////
    /////////////////////////////////////////////////////////////////

    ////////////////////////// CONTRIBUTORS /////////////////////////
    contributors.forEach(d => {
        d.contributor_name = d.author_name_top

        // TODO: NOTE | Because this data isn't available yet, make it random
        d.orca_received = Math.random() <= ORCA_LEVEL ? true : false

        d.color = COLOR_CONTRIBUTOR

        // Determine across how many lines to split the contributor name
        setContributorFont(context);
        [d.contributor_lines, d.contributor_max_width] = getLines(context, d.contributor_name, MAX_CONTRIBUTOR_WIDTH);
        
        delete d.contributor_name_top
    })// forEach

    ////////////////////////// REPOSITORIES /////////////////////////
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

        // d.repo = d.owner

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

    ///////////////////////////// LINKS /////////////////////////////
    links.forEach(d => {
        // Source
        d.contributor_name = d.author_name_top
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

        // d.repo = d.owner

        // Set-up initial source and target
        d.source = d.contributor_name
        d.target = d.repo

        delete d.base_repo_original
        delete d.author_name_top
    })// forEach

    /////////////////////// OTHER CONTRIBUTORS //////////////////////
    remainingContributors.forEach(d => {
        d.commit_count = +d.commit_count
        d.contributor_sec_min = parseDateUnix(d.author_sec_min)
        d.contributor_sec_max = parseDateUnix(d.author_sec_max)

        d.type = "contributor"
    })// forEach

    // console.log(contributors[0])
    // console.log(repos[0])
    // console.log(links[0])
    // console.log(remainingContributors)

    ////////////////////////// Create Nodes /////////////////////////
    // Combine the contributors and repos into one variable to become the nodes
    contributors.forEach((d,i) => {
        nodes.push({
            id: d.contributor_name, type: "contributor", label: d.contributor_name, data: d
        })
    })// forEach
    repos.forEach((d,i) => {
        nodes.push({
            id: d.repo, type: "repo", label: d.name, data: d
        })
    })// forEach

    // Save all the original links
    contributors.forEach(d => {
        d.links_original = links.filter(l => l.source === d.contributor_name)
    })// forEach
    repos.forEach(d => {
        d.links_original = links.filter(l => l.target === d.repo)
    })// forEach

    /////////////////////////////////////////////////////////////////
    // Which is the central repo, the one that connects everyone (the one with the highest degree)
    central_repo = nodes.find(d => d.type === "repo" && d.id === REPO_CENTRAL)

    ///////////////////////////// OWNERS ////////////////////////////
    // Create a dataset for all the repos that have an owner that occurs more than once
    let owners = nodes.filter(d => d.type === "repo" && nodes.filter(n => n.id !== d.id && n.type === "repo" && n.data.owner === d.data.owner).length > 1).map(d => d.data)
   
    // Create a unique entry per owner
    owners = d3.group(owners, d => d.owner)
    owners = Array.from(owners, ([key, value]) => ({ 
        owner: key, 
        repos: value.map(n => n.name),
        color: COLOR_OWNER, 
        stars: d3.sum(value, d => d.stars), 
        forks: d3.sum(value, d => d.forks) 
    }))
    
    // Sort by the owner name
    owners.sort((a,b) => {
        if(a.owner.toLowerCase() < b.owner.toLowerCase()) return -1
        else if(a.owner.toLowerCase() > b.owner.toLowerCase()) return 1
        else return 0
    })// sort

    console.log("Owners:", owners)
    console.log("Contributors:", contributors)

    // Check which of the repos are owned by those in the "owners" dataset
    nodes
        .filter(d => d.type === "repo")
        .forEach(d => {
            d.data.multi_repo_owner = owners.find(o => o.owner === d.data.owner) ? true : false
        })// forEach

    // Add the owners to the nodes dataset
    owners.forEach((d,i) => {
        nodes.push({
            id: d.owner, type: "owner", label: d.owner, data: d
        })
    })// forEach

    /////////////////////////////////////////////////////////////////
    // Redo Links to take owners into account as a grouping node

    // Also for the links where the target is also in the owner dataset replace the link to the owner and make a new link from the owner to the repo
    let new_links_owner_repo = []
    let new_links_contributor_owner = []
    links.forEach(d => {
        // If the target's owner is also in the owners dataset, replace the link to the owner and make a new link from the owner to the repo
        // Except if the target is the central repo
        if(d.repo !== REPO_CENTRAL && owners.find(o => o.owner === d.owner)) {
            // Add a new link from the owner to the repo
            new_links_owner_repo.push({
                source: d.owner,
                target: d.repo,
                owner: d.owner,
                // name: d.name,
                // repo: d.repo,
                
                commit_count: d.commit_count,
                commit_sec_min: d.commit_sec_min,
                commit_sec_max: d.commit_sec_max
            })// push

            // Add a new link from the contributor to the owner
            new_links_contributor_owner.push({
                source: d.contributor_name,
                target: d.owner,
                owner: d.owner,

                commit_count: d.commit_count,
                commit_sec_min: d.commit_sec_min,
                commit_sec_max: d.commit_sec_max
            })// push

            // delete d.commit_count
            // delete d.commit_sec_min
            // delete d.commit_sec_max

            // Delete this link
            d.to_remove = true
        }

    })// forEach
    links = links.filter(d => !(d.to_remove === true))

    /////////////////////////////////////////////////////////////////
    // Get the unique set of new_links

    // Group all the new_links_contributor_owner by their source and target and add the commit counts, and take the min and max of the commit_sec_min and commit_sec_max
    // new_links_contributor_owner = Array.from(new Set(new_links_contributor_owner.map(d => JSON.stringify(d)))).map(d => JSON.parse(d))
    new_links_contributor_owner = d3.group(new_links_contributor_owner, d => d.source + "~" + d.target)
    new_links_contributor_owner = Array.from(new_links_contributor_owner, ([key, value]) => {
        let [source, target] = key.split("~")
        return {
            source: source,
            target: target,
            owner: value[0].owner,
            commit_count: d3.sum(value, d => d.commit_count),
            commit_sec_min: d3.min(value, d => d.commit_sec_min),
            commit_sec_max: d3.max(value, d => d.commit_sec_max)
        }
    })// map

    // new_links_owner_repo = Array.from(new Set(new_links_owner_repo.map(d => JSON.stringify(d)))).map(d => JSON.parse(d))
    new_links_owner_repo = d3.group(new_links_owner_repo, d => d.source + "~" + d.target)
    new_links_owner_repo = Array.from(new_links_owner_repo, ([key, value]) => {
        let [source, target] = key.split("~")
        return {
            source: source,
            target: target,
            owner: value[0].owner,
            commit_count: d3.sum(value, d => d.commit_count),
            commit_sec_min: d3.min(value, d => d.commit_sec_min),
            commit_sec_max: d3.max(value, d => d.commit_sec_max)
        }
    })// map


    // Set-up the new links dataset
    links = [...links, ...new_links_owner_repo, ...new_links_contributor_owner]


    // Add a link between the owner of the central repo and the central repo
    links.push({
        source: central_repo.data.owner,
        target: central_repo.id,
        owner: central_repo.data.owner,
        commit_count: d3.sum(links.filter(l => l.target === central_repo.id), d => d.commit_count),
        commit_sec_min: d3.min(links.filter(l => l.target === central_repo.id), d => d.commit_sec_min),
        commit_sec_max: d3.max(links.filter(l => l.target === central_repo.id), d => d.commit_sec_max)
    })

    console.log("Links:", links)

    /////////////////////////////////////////////////////////////////
    // Which of these owner types have links that are all to the same contributor node
    // If so, mark them as "single-contributor"
    owners.forEach(d => {
        // Get all the links that are connected to this owner, where the owner is the target (and the source is a contributor)
        let links_owner = links.filter(l => l.target === d.owner)
        // If the length is 1, it means that this owner is only connected to one contributor
        d.single_contributor = links_owner.length === 1 ? true : false

        // Get all the repos that are connected to this owner
        d.repos = nodes.filter(n => n.type === "repo" && n.data.owner === d.owner).map(n => n.data)
    })// forEach

    /////////////////////////////////////////////////////////////////
    // Set scales
    scale_repo_radius.domain(d3.extent(repos, d => d.stars))
    scale_contributor_radius.domain(d3.extent(links.filter(l => l.target === central_repo.id), d => d.commit_count))
    scale_involved_range.domain([central_repo.data.createdAt, central_repo.data.updatedAt])
    scale_link_width.domain([1,10,d3.max(links, d => d.commit_count)])

    /////////////////////////////////////////////////////////////////
    // Determine some visual settings for the nodes
    nodes.forEach((d,i) => {
        d.index = i
        d.data.index = i

        // Find the degree of each node
        d.degree = links.filter(l => l.source === d.id || l.target === d.id).length
        // d.in_degree = links.filter(l => l.target === d.id).length
        // d.out_degree = links.filter(l => l.source === d.id).length

        // Get all the connected nodes
        // Takes too long, done on hover
        // d.neighbors = nodes.filter(n => links.find(l => l.source === d.id && l.target === n.id || l.target === d.id && l.source === n.id))

        // TEST - set initial placement
        d.x = 0
        d.y = 0

        // If this node is an "contributor", find the number of commits they have on the central repo node
        if(d.type === "contributor") {
            let link_to_central = links.find(l => l.source === d.id && l.target === central_repo.id)
            d.data.link_central = link_to_central
            // d.data.commit_count_central = link_to_central.commit_count
            d.r = scale_contributor_radius(d.data.link_central.commit_count)
        } else if(d.type === "repo") {
            d.r = scale_repo_radius(d.data.stars)
        } else { // "owner"
            d.r = scale_repo_radius(d.data.stars) // TODO 
        }// else 

        d.color = d.data.color
    })// forEach

    // Sort the nodes by their type and for the contributor nodes, by their min commit date to the central repo
    nodes.sort((a,b) => {
        if(a.type === b.type) {
            // if(a.id.toLowerCase() < b.id.toLowerCase()) return -1
            // else if(a.id.toLowerCase() > b.id.toLowerCase()) return 1
            if(a.data.link_central && b.data.link_central) {
                if(a.data.link_central.commit_sec_min < b.data.link_central.commit_sec_min) return -1
                else if(a.data.link_central.commit_sec_min > b.data.link_central.commit_sec_min) return 1
                else return 0
            } else return 0
        } else {
            if(a.type < b.type) return -1
            else if(a.type > b.type) return 1
            else return 0
        }// else
    })// sort

    // Replace some values for the central repository
    central_repo.r = CENTRAL_RADIUS
    central_repo.padding = CENTRAL_RADIUS
    central_repo.special_type = "central"
    central_repo.color = COLOR_REPO_MAIN
    
}// function prepareData

/////////////////////////////////////////////////////////////////////
///////////////// Force Simulation | Per Owner ////////////////
/////////////////////////////////////////////////////////////////////
// Run a force simulation for per "owner" node for all the repos that fall under it
function singleOwnerForceSimulation() {
    // First fix the nodes in the center - this is only temporarily
    nodes
        .filter(d => d.type === "owner")
        .forEach((d,i) => {
                d.x = d.fx = 0
                d.y = d.fy = 0

                // // For testing
                // // Place the contributors in a grid of 10 columns
                // d.x = -WIDTH/4 + (i % 8) * 140
                // d.y = -HEIGHT/4 + Math.floor(i / 8) * 150
                // d.fx = d.x
                // d.fy = d.y
            })// forEach

    // Next run a force simulation to place all the repositories
    nodes
        .filter(d => d.type === "owner")
        .forEach(d => {
            // Find all the nodes that are connected to this one with a degree of one, including the node itself
            let nodes_connected = nodes.filter(n => links.find(l => l.source === d.id && l.target === n.id && n.degree === 1) || n.id === d.id)

            // If there are no nodes connected to this one, skip it
            // if(nodes_to_contributor.length <= 1) return

            // Save the list of repositories that are connected to this node
            d.connected_node_cloud = nodes_connected.filter(n => n.type === "repo")

            // Get the links between this node and nodes_connected
            let links_connected = links.filter(l => l.source === d.id && nodes_connected.find(n => n.id === l.target))

            // Let the nodes start on the location of the contributor node
            nodes_connected.forEach(n => {
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
                        .radius(n => {
                            let r
                            if(n.id === d.id) {
                                if(d.data.single_contributor) r = d.r + 2
                                else r = d.r + Math.min(14, Math.max(10, d.r))
                            } else r = n.r + Math.max(2, n.r * 0.2)
                            return r
                        })
                        .strength(0)
                )
                // .force("charge",
                //     d3.forceManyBody()
                //         .strength(-20)
                //         // .distanceMax(WIDTH / 3)
                // )
                // Keep the repo nodes want to stay close to the contributor node
                // so they try to spread out evenly around it
                .force("x", d3.forceX().x(d.fx).strength(0.1))
                .force("y", d3.forceY().y(d.fy).strength(0.1))

            simulation
                .nodes(nodes_connected)
                .stop()
                // .on("tick", ticked)
    
            simulation.force("link").links(links_connected)

            //Manually "tick" through the network
            let n_ticks = 200
            for (let i = 0; i < n_ticks; ++i) {
                simulation.tick()
                //Ramp up collision strength to provide smooth transition
                simulation.force("collide").strength(Math.pow(i / n_ticks, 2) * 0.8)
            }//for i
            // TEST - Draw the result
            // drawContributorBubbles(nodes_connected, links_connected)

            // Determine the farthest distance of the nodes (including its radius) to the owner node
            d.max_radius = d3.max(nodes_connected, n => Math.sqrt((n.x - d.x)**2 + (n.y - d.y)**2))
            // Determine which node is the largest distance to the central node
            let max_radius_node = nodes_connected.find(n => Math.sqrt((n.x - d.x)**2 + (n.y - d.y)**2) === d.max_radius)
            // Get the overall radius to take into account for the next simulation and labeling
            d.max_radius = Math.max(d.max_radius + max_radius_node.r, d.r)
            // See this as the new "node" radius that includes all of it's repos

            // Reset the fx and fy
            delete d.fx
            delete d.fy
        })// forEach

}// function singleOwnerForceSimulation

/////////////////////////////////////////////////////////////////////
///////////////// Force Simulation | Per Contributor ////////////////
/////////////////////////////////////////////////////////////////////

// Run a force simulation for per contributor for all the repos that are not shared between other contributors
// Like a little cloud of repos around them
function singleContributorForceSimulation() {
    // First fix the contributor nodes in the center - this is only temporarily
    nodes
        .filter(d => d.type === "contributor")
        .forEach((d,i) => {
                d.x = d.fx = 0
                d.y = d.fy = 0

                // // For testing
                // // Place the contributors in a grid of 10 columns
                // d.x = -WIDTH/4 + (i % 8) * 140
                // d.y = -HEIGHT/4 + Math.floor(i / 8) * 150
                // d.fx = d.x
                // d.fy = d.y
            })// forEach

    // Next run a force simulation to place all the single-degree repositories
    nodes
        .filter(d => d.type === "contributor")
        .forEach(d => {
            // Find all the nodes that are connected to this one with a degree of one, including the contributor node itself
            // let nodes_to_contributor = nodes.filter(n => links.find(l => l.source === d.id && l.target === n.id && n.degree === 1) || n.id === d.id)
            let nodes_to_contributor = nodes.filter(n => links.find(l => l.source === d.id && l.target === n.id && n.degree === 1) || links.find(l => l.source === d.id && l.target === n.id && n.type === "owner" && n.data.single_contributor === true) || n.id === d.id)

            // If there are no nodes connected to this one, skip it
            // if(nodes_to_contributor.length <= 1) return

            // Save the list of repositories that are connected to this contributor (with a degree of one)
            d.connected_single_repo = nodes_to_contributor.filter(n => n.type === "repo" || n.type === "owner")

            // Get the links between this node and nodes_to_contributor
            let links_contributor = links.filter(l => l.source === d.id && nodes_to_contributor.find(n => n.id === l.target))

            // Let the nodes start on the location of the contributor node
            nodes_to_contributor.forEach(n => {
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
                        .radius(n => {
                            let r
                            if(n.id === d.id) r = d.r + Math.min(14, Math.max(10, d.r))
                            else if (n.max_radius) {
                                r = n.max_radius
                                // r -= 4
                                // r = r + Math.max(r*0.1, 2)
                            } else r = n.r + Math.max(2, n.r * 0.2)
                            return r
                        })
                        .strength(0)
                )
                // .force("charge",
                //     d3.forceManyBody()
                //         .strength(-20)
                //         // .distanceMax(WIDTH / 3)
                // )
                // Keep the repo nodes want to stay close to the contributor node
                // so they try to spread out evenly around it
                .force("x", d3.forceX().x(d.fx).strength(0.1))
                .force("y", d3.forceY().y(d.fy).strength(0.1))

            simulation
                .nodes(nodes_to_contributor)
                .stop()
                // .on("tick", ticked)
    
            simulation.force("link").links(links_contributor)

            //Manually "tick" through the network
            let n_ticks = 200
            for (let i = 0; i < n_ticks; ++i) {
                simulation.tick()
                //Ramp up collision strength to provide smooth transition
                simulation.force("collide").strength(Math.pow(i / n_ticks, 2) * 0.8)
            }//for i
            // TEST - Draw the result
            // drawContributorBubbles(nodes_to_contributor, links_contributor)

            // Determine the farthest distance of the nodes (including its radius) to the contributor node
            d.max_radius = d3.max(nodes_to_contributor, n => Math.sqrt((n.x - d.x)**2 + (n.y - d.y)**2))
            // Determine which node is the largest distance to the contributor node
            let max_radius_node = nodes_to_contributor.find(n => Math.sqrt((n.x - d.x)**2 + (n.y - d.y)**2) === d.max_radius)
            // Get the overall radius to take into account for the next simulation and labeling
            d.max_radius = Math.max(d.max_radius + max_radius_node.r, d.r)
            // See this as the new "contributor node" radius that includes all of it's single-degree repos

        })// forEach

    function drawContributorBubbles(nodes, links) {
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
                drawLine(context, SF, l)
            })// forEach

            // Draw all the nodes as circles
            nodes
                .filter(d => d.id !== central_repo.id)
                .forEach(d => {
                    context.fillStyle = d.color
                    let r = d.r //d.type === "contributor" ? 10 : d.r
                    drawCircle(context, d.x, d.y, SF, r)
                })// forEach

            context.restore()
    }// function drawContributorBubbles
}// function singleContributorForceSimulation

// Place the contributor nodes in a circle around the central repo
// Taking into account the max_radius of single-degree repos around them
function positionContributorNodes() {
    // Get the sum of all the contributor nodes' max_radius
    let sum_radius = nodes
        .filter(d => d.type === "contributor")
        .reduce((acc, curr) => acc + curr.max_radius * 2, 0)
    // Take padding into account between the contributor nodes
    sum_radius += contributors.length * CONTRIBUTOR_PADDING
    // This sum should be the circumference of the circle around the central node, what radius belongs to this -> 2*pi*R
    RADIUS_CONTRIBUTOR = sum_radius / TAU
    RADIUS_CONTRIBUTOR_NON_ORCA = RADIUS_CONTRIBUTOR * 1.3
    ORCA_RING_WIDTH = ((RADIUS_CONTRIBUTOR+RADIUS_CONTRIBUTOR_NON_ORCA)/2 - RADIUS_CONTRIBUTOR) * 2

    // Fix the contributor nodes in a ring around the central node
    // const angle = TAU / (nodes.filter(d => d.type === "contributor").length)
    let angle = 0
    nodes
        .filter(d => d.type === "contributor")
        .forEach((d,i) => {
            // console.log(d.id, d.connected_single_repo)
            // Subtract the contributor node position from all it's connected single-degree repos
            d.connected_single_repo.forEach(repo => {
                repo.x -= d.x
                repo.y -= d.y
            })// forEach

            // Find the new position of the contributor node in a ring around the central node
            let contributor_arc = d.max_radius * 2 + CONTRIBUTOR_PADDING
            // translate this distance to an angle
            let contributor_angle = (contributor_arc / RADIUS_CONTRIBUTOR)/2

            let radius_drawn = d.data.orca_received ? RADIUS_CONTRIBUTOR : RADIUS_CONTRIBUTOR_NON_ORCA
            d.x = central_repo.fx + radius_drawn * cos(angle + contributor_angle - PI/2)
            d.y = central_repo.fy + radius_drawn * sin(angle + contributor_angle - PI/2)
            d.contributor_angle = angle + contributor_angle - PI/2
            angle += contributor_angle * 2

            // Fix the contributors for the force simulation
            d.fx = d.x
            d.fy = d.y

            // Add the new contributor position to all it's connected single-degree repos
            d.connected_single_repo.forEach(repo => {
                repo.x += d.x
                repo.y += d.y

                // Just in case
                repo.fx = repo.x
                repo.fy = repo.y
            })// forEach

            // 
        })// forEach
}// function positionContributorNodes

/////////////////////////////////////////////////////////////////////
/////////////// Force Simulation | Collaboration Repos //////////////
/////////////////////////////////////////////////////////////////////
// Run a force simulation to position the repos that are shared between contributors
function collaborationRepoSimulation() {
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

    // Keep the nodes that are an "contributor" or a repo that has a degree > 1 (and is thus committed to by more than one contributor)
    // nodes_central = nodes.filter(d => d.type === "contributor" || d.type === "owner")
    nodes_central = nodes.filter(d => d.type === "contributor" || (d.type === "owner" && d.data.single_contributor == false) || d.id === REPO_CENTRAL || (d.type === "repo" && d.data.multi_repo_owner === false && d.degree > 1))
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

    // Update the position of the repositories connected to an "owner" node
    nodes
        .filter(d => d.type === "owner")
        .forEach(d => {
            d.connected_node_cloud.forEach(repo => {
                repo.x = d.x + repo.x
                repo.y = d.y + repo.y
            })// forEach
        })// forEach

    /////////////////////////////////////////////////////////////
    function simulationPlacementConstraints(nodes) {
        // Make sure the "repo" nodes cannot be placed farther away from the center than RADIUS_CONTRIBUTOR
        nodes.forEach(d => {
            if(d.type === "repo" || d.type === "owner") {
                const dist = Math.sqrt(d.x ** 2 + d.y ** 2)
                if(dist > RADIUS_CONTRIBUTOR * INNER_RADIUS_FACTOR) {
                    d.x = d.x / dist * RADIUS_CONTRIBUTOR * INNER_RADIUS_FACTOR
                    d.y = d.y / dist * RADIUS_CONTRIBUTOR * INNER_RADIUS_FACTOR
                }//if
            }//if
        })// forEach
    }// simulationPlacementConstraints
}// function collaborationRepoSimulation

/////////////////////////////////////////////////////////////////////
/////////////// Force Simulation | Other Contributors ///////////////
/////////////////////////////////////////////////////////////////////
// Run a force simulation to place the remaining contributors somewhere outside the outer NON-ORCA ring
function remainingContributorSimulation() {
    let LW = ((RADIUS_CONTRIBUTOR+RADIUS_CONTRIBUTOR_NON_ORCA)/2 - RADIUS_CONTRIBUTOR) * 2
    let R = RADIUS_CONTRIBUTOR_NON_ORCA + LW * 2

    // Initial random position, but outside of the ORCA ring
    remainingContributors.forEach(d => {
        let angle = Math.random() * TAU
        d.x = (R + Math.random() * 50) * cos(angle)
        d.y = (R + Math.random() * 50) * sin(angle)

        d.r = scale_contributor_radius(d.commit_count) / 2
    })// forEach

    let simulation = d3.forceSimulation()
        .force("collide",
            d3.forceCollide()
                .radius(d => d.r + Math.random() * 40 + 20)
                .strength(1)
        )
        // .force("charge",
        //     d3.forceManyBody()
        // )
    .force("x", d3.forceX().x(0).strength(0.01)) //0.1
    .force("y", d3.forceY().y(0).strength(0.01)) //0.1

    // Add a dummy node to the dataset that is fixed in the center that is as big as the NON-ORCA circle
    remainingContributors.push({
        x: 0,
        y: 0,
        fx: 0,
        fy: 0,
        r: RADIUS_CONTRIBUTOR_NON_ORCA + LW * 0.75,
        id: "dummy"
    })

    // Perform the simulation
    simulation
        .nodes(remainingContributors)
        .stop()

    // Manually "tick" through the network
    let n_ticks = 20
    for (let i = 0; i < n_ticks; ++i) simulation.tick()

    // Remove the dummy node from the dataset again
    remainingContributors.pop()

}// function remainingContributorSimulation

/////////////////////////////////////////////////////////////////////
//////////////////////// Background Elements ////////////////////////
/////////////////////////////////////////////////////////////////////
// Draw two rings around the central node to show those that receive ORCA vs those that do not
function drawOrcaRings(context, SF) {
    // Draw the ORCA rings
    context.fillStyle = context.strokeStyle = COLOR_PURPLE //COLOR_REPO_MAIN //spectral.mix("#e3e3e3", COLOR_REPO_MAIN, 0.75) 
    let LW = ORCA_RING_WIDTH
    let O = 4
    context.lineWidth = 1.5 * SF
    // context.lineWidth = LW * SF

    // Inner ring of those receiving ORCA
    context.beginPath()
    context.moveTo(0 + (RADIUS_CONTRIBUTOR + LW/2 - O) * SF, 0)
    context.arc(0, 0, (RADIUS_CONTRIBUTOR + LW/2 - O) * SF, 0, TAU)
    context.moveTo(0 + (RADIUS_CONTRIBUTOR - LW/2) * SF, 0)
    context.arc(0, 0, (RADIUS_CONTRIBUTOR - LW/2) * SF, 0, TAU, true)
    context.globalAlpha = 0.06
    context.fill()
    context.globalAlpha = 0.2
    // context.stroke()
    
    // Second ring of those not receiving ORCA
    context.beginPath()
    context.moveTo(0 + (RADIUS_CONTRIBUTOR_NON_ORCA + LW/2) * SF, 0)
    context.arc(0, 0, (RADIUS_CONTRIBUTOR_NON_ORCA + LW/2) * SF, 0, TAU)
    context.moveTo(0 + (RADIUS_CONTRIBUTOR_NON_ORCA - LW/2 + O) * SF, 0)
    context.arc(0, 0, (RADIUS_CONTRIBUTOR_NON_ORCA - LW/2 + O) * SF, 0, TAU, true)
    context.globalAlpha = 0.03
    context.fill()
    context.globalAlpha = 0.1
    // context.stroke()

    // Add the title along the two bands
    context.textAlign = "center"
    context.textBaseline = "bottom"
    context.globalAlpha = 0.5
    setFont(context, 16 * SF, 700, "italic")
    drawTextAlongArc(context, "contributors supported through ORCA", TAU * 0.9, (RADIUS_CONTRIBUTOR - (LW/2 - O - 2)) * SF, "up", 1.5 * SF) 
    
    context.textBaseline = "top"
    drawTextAlongArc(context, "other top contributors", TAU * 0.9, (RADIUS_CONTRIBUTOR_NON_ORCA + (LW/2 - O - 2)) * SF, "up", 1.5 * SF) 
    context.globalAlpha = 1
}// function drawOrcaRings

/////////////////////////////////////////////////////////////////////
/////////////////////// Node Drawing Functions //////////////////////
/////////////////////////////////////////////////////////////////////

function drawNode(context, SF, d) {
    context.shadowBlur = HOVER_ACTIVE ? 0 : Math.max(2, d.r * 0.2) * SF
    context.shadowColor = "#f7f7f7"//d.color
    context.fillStyle = d.color
    // context.globalAlpha = d.type === "contributor" ? 1 : scale_node_opacity(d.degree)
    let r = d.r //d.type === "contributor" ? 10 : d.r
    drawCircle(context, d.x, d.y, SF, r)
    context.shadowBlur = 0

    // Also draw a stroke around the node
    // context.globalAlpha = 0.5
    context.strokeStyle = COLOR_BACKGROUND
    context.lineWidth = Math.max(HOVER_ACTIVE ? 1.5 : 1, d.r * 0.07) * SF
    context.stroke()
    // context.globalAlpha = 1

    // Draw a tiny arc inside the contributor node to show how long they've been involved in the central repo's existence, based on their first and last commit
    if(d.type === "contributor") {
        context.save()
        context.translate(d.x * SF, d.y * SF)

        // TODO: Check that the angle is not too small
        // let angle = scale_involved_range(d.data.link_central.commit_sec_max) - scale_involved_range(d.data.link_central.commit_sec_min)
        const arc = d3.arc()
            .innerRadius((d.r + 2.5) * SF)
            .outerRadius((d.r + 2.5 + 3) * SF)
            .startAngle(scale_involved_range(d.data.link_central.commit_sec_min))
            .endAngle(scale_involved_range(d.data.link_central.commit_sec_max))
            .context(context)

        // Create the arc
        context.beginPath()
        arc()
        context.fillStyle = COLOR_REPO_MAIN
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
    let r = d.r + (d.type === "contributor" ? 11 : d.special_type ? 14 : 5)
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
function drawLink(context, SF, l) {
    if(l.source.x !== undefined && l.target.x !== undefined) {
        calculateLinkGradient(context, l)
        calculateEdgeCenters(l, 1)
        context.strokeStyle = l.gradient 
    } else context.strokeStyle = COLOR_LINK

    // Base line width
    let line_width = scale_link_width(l.commit_count)

    // If a hover is active, and the hovered node is a contributor, and this is a link between an owner and repository, make the line width depend on the commit_count of the original link between the contributor and the repository
    if(HOVER_ACTIVE && HOVERED_NODE.type === "contributor" && l.source.type === "owner" && l.target.type === "repo") {
        // Find the link between this contributor and the repository in the links_original
        let link_original = HOVERED_NODE.data.links_original.find(p => p.repo === l.target.id)
        // Base the line width on this commit count
        if(link_original) line_width = scale_link_width(link_original.commit_count)
        else console.log(HOVERED_NODE)
    }// if

    context.lineWidth = line_width * SF
    drawLine(context, SF, l)
}// function drawLink

/////////////////////////// Draw the lines //////////////////////////
function drawLine(context, SF, line) {
    context.beginPath()
    context.moveTo(line.source.x * SF, line.source.y * SF)
    if(line.center) drawCircleArc(context, SF, line)
    else context.lineTo(line.target.x * SF, line.target.y * SF)
    context.stroke()
}//function drawLine

//////////////////////// Draw a curved line /////////////////////////
function drawCircleArc(context, SF, line) {
    let center = line.center
    let ang1 = Math.atan2(line.source.y * SF - center.y * SF, line.source.x * SF - center.x * SF)
    let ang2 = Math.atan2(line.target.y * SF - center.y * SF, line.target.x * SF - center.x * SF)
    context.arc(center.x * SF, center.y * SF, line.r * SF, ang1, ang2, line.sign)
}//function drawCircleArc

/////////////////////// Calculate Line Centers //////////////////////
function calculateEdgeCenters(l, size = 2, sign = true) {
    //Find a good radius
    l.r = Math.sqrt(sq((l.target.x - l.source.x)) + sq((l.target.y - l.source.y))) * size //Can run from > 0.5
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

    // The opacity of the links depends on the number of links
    const scale_alpha = d3.scaleLinear()
        .domain([300,800])
        .range([0.5, 0.2])
        .clamp(true)

    // Incorporate opacity into gradient
    let alpha
    if(HOVER_ACTIVE) alpha = l.target.special_type ? 0.3 : 0.7
    else alpha = l.target.special_type ? 0.15 : scale_alpha(links.length)
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
////////////////////////// Hover Functions //////////////////////////
/////////////////////////////////////////////////////////////////////
// Setup the hover on the top canvas, get the mouse position and call the drawing functions
function setupHover() {
    d3.select("#canvas-hover").on("mousemove", function(event) {
        // Get the position of the mouse on the canvas
        let [mx, my] = d3.pointer(event, this)
        mx = ((mx * PIXEL_RATIO) - WIDTH / 2) / SF
        my = ((my * PIXEL_RATIO) - (MARGIN_TOP + WIDTH / 2)) / SF

        //Get the closest hovered node
        let point = delaunay.find(mx, my)
        let d = nodes[point]
        // Get the distance from the mouse to the node
        let dist = Math.sqrt((d.x - mx)**2 + (d.y - my)**2)
        // If the distance is too big, don't show anything
        let FOUND = dist < d.r + 50
        
        // Draw the hover state on the top canvas
        drawHoverState(context_hover, d, FOUND)
    })// on mousemove

    // canvas.ontouchmove =
    // canvas.onmousemove = event => {
    //         event.preventDefault();
    //         console.log(event.layerX)
    //     };

}// function setupHover

// Draw the hovered node and its links and neighbors and a tooltip
function drawHoverState(context, d, FOUND) {
    // Draw the hover canvas
    context.save()
    context.clearRect(0, 0, WIDTH, HEIGHT)
    context.translate(WIDTH / 2, MARGIN_TOP + WIDTH / 2)

    if(FOUND) {
        HOVER_ACTIVE = true
        HOVERED_NODE = d

        // Fade out the main canvas, using CSS
        canvas.style.opacity = '0.3'

        /////////////////////////////////////////////////
        // Get all the connected links (if not done before)
        if(d.neighbor_links === undefined) {
            d.neighbor_links = links.filter(l => l.source.id === d.id || l.target.id === d.id)
        }// if

        // Get all the connected nodes (if not done before)
        if(d.neighbors === undefined) {
            d.neighbors = nodes.filter(n => links.find(l => l.source.id === d.id && l.target.id === n.id || l.target.id === d.id && l.source.id === n.id))

            // If any of these neighbors are "owner" nodes, find what the original repo was from that owner that the contributor was connected to
            // OR
            // If this node is a repo and any of these neighbors are "owner" nodes, find what original contributor was connected to this repo
            if(d.type === "contributor" || (d.type === "repo" && d !== central_repo)) {
                d.neighbors.forEach(n => {
                    if(n.type === "owner") {
                        // Go through all of the original links and see if this owner is in there
                        d.data.links_original.forEach(l => {
                            if(l.owner === n.id) {
                                let node, link
                                if(d.type === "contributor") {
                                    // Find the repo node
                                    node = nodes.find(r => r.id === l.repo)
                                    // Also find the link between the repo and owner and add this to the neighbor_links
                                    link = links.find(l => l.source.id === n.id && l.target.id === node.id)
                                } else if (d.type === "repo") {
                                    // Find the contributor node
                                    node = nodes.find(r => r.id === l.contributor_name)
                                    // Also find the link between the contributor and owner and add this to the neighbor_links
                                    link = links.find(l => l.source.id === node.id && l.target.id === n.id)
                                }// else if

                                // Add it to the neighbors
                                d.neighbors.push(node)
                                if(link) d.neighbor_links.push(link)
                            }// if
                        })// forEach
                    }// if
                })// forEach

                // Filter out the possible link between the central_node and its owner, to not create a ring
                d.neighbor_links = d.neighbor_links.filter(l => !(l.target.id === central_repo.id && l.source.id === central_repo.data.owner))
            }// if

            // 
            // if(d.type === "repo") {
            //     d.neighbors.forEach(n => {
            //         if(n.type === "owner") {
            //             // Go through all of the original links and see if this owner is in there
            //             d.data.links_original.forEach(l => {
            //                 if(l.owner === n.id) {
            //                     // Find the contributor node
            //                     let contributor = nodes.find(r => r.id === l.contributor_name)
            //                     // Add it to the neighbors
            //                     d.neighbors.push(contributor)
            //                     // Also find the link between the contributor and owner and add this to the neighbor_links
            //                     let link = links.find(l => l.source.id === contributor.id && l.target.id === n.id)
            //                     if(link) {
            //                         d.neighbor_links.push(link)
            //                     }// if
            //                 }// if
            //             })// forEach
            //         }// if
            //     })// forEach
            // }// if
            
        }// if

        /////////////////////////////////////////////////
        // Draw all the links to this node
        d.neighbor_links.forEach(l => {
            drawLink(context, SF, l)
        })// forEach

        // Draw all the connected nodes
        d.neighbors.forEach(n => {
            drawNode(context, SF, n)
        })// forEach
        // Draw all the labels of the "central" connected nodes
        d.neighbors.forEach(n => {
            if(n.node_central) drawNodeLabel(context_hover, n)
        })// forEach

        /////////////////////////////////////////////////
        // Draw the hovered node
        drawNode(context, SF, d)
        // Show a ring around the hovered node
        drawHoverRing(context, d)
        
        /////////////////////////////////////////////////
        // Show its label
        if(d.node_central && d.type === "contributor") drawNodeLabel(context, d)

        /////////////////////////////////////////////////
        // Create a tooltip with more info
        drawTooltip(context, d)


    } else {
        HOVER_ACTIVE = false
        HOVERED_NODE = null

        // Fade the main canvas back in
        canvas.style.opacity = '1'
    }// else

    context.restore()
}// function drawHoverState

// Draw the tooltip above the node
function drawTooltip(context, d) {
    let line_height = 1.2
    let font_size
    let text

    // Figure out the base x and y position of the tooltip
    const x_base = d.x
    const y_base = d.y - d.r

    /////////////////////////////////////////////////////////////////
    // Figure out the required height of the tooltip
    let H = 93
    if(d.type === "contributor") {
        if(d.data.orca_received) H = 130
        else H = 105
    } else if(d.type === "repo") {
        if(d.data.languages.length > 3) H = 192
        else if(d.data.languages.length > 0) H = 180
        else H = 138
    }// else

    // Start with a minimum width
    let W = 240

    // Write all the repos for the "owner" nodes, but make sure they are not wider than the box and save each line to write out
    if(d.type === "owner") {
        font_size = 11.5
        setFont(context, font_size * SF, 400, "normal")
        d.text_lines = []
        text = ""
        d.connected_node_cloud.forEach((repo, i) => {
            // Check the length of the new text to add
            let new_repo = `${repo.data.name}${i < d.connected_node_cloud.length - 1 ? ", " : ""}`
            // If it's longer, push the current text to the array and start a new one
            if(context.measureText(`${text}${new_repo}`).width * 1.25 > 0.85 * W * SF) {
                d.text_lines.push(text)
                text = new_repo
            } else {
                text += new_repo
            }// else
        })// forEach
        // Add the final possible bit
        if(text !== "") d.text_lines.push(text)
        // Update the height of the tooltip
        H += d.text_lines.length * (font_size * line_height)
    }// if

    /////////////////////////////////////////////////////////////////
    // Figure out the required width of the tooltip

    // Check if any of the typically longer texts are wider than this
    // Bit of a hack (if I change the font's settings later, I need to remember to do it here), but it works
    let tW = 0
    if(d.type === "contributor") {
        // The contributor's name
        setFont(context, 15 * SF, 700, "normal")
        tW = context.measureText(d.data.contributor_name).width * 1.25
    } else if(d.type === "owner") {
        // The owner's name
        setFont(context, 15 * SF, 700, "normal")
        tW = context.measureText(d.data.owner).width * 1.25
        // Check if any of the "repo lines" are longer than the owner's name
        setFont(context, 11.5 * SF, 400, "normal")
        d.text_lines.forEach(t => {
            let line_width = context.measureText(t).width * 1.25
            if(line_width > tW) tW = line_width
        })// forEach
    } else if(d.type === "repo") {
        // The repo's owner and name
        setFont(context, 14 * SF, 700, "normal")
        tW = context.measureText(d.data.owner).width * 1.25
        if(context.measureText(d.data.name).width * 1.25 > tW) tW = context.measureText(d.data.name).width * 1.25
        // Languages
        if(d.data.languages.length > 0) {
            setFont(context, 11.5 * SF, 400, "normal")
            let text = ""
            for(let i = 0; i < Math.min(3, d.data.languages.length); i++) {
                text += `${d.data.languages[i]}${i < Math.min(3, d.data.languages.length) - 1 ? ", " : ""}`
            }// for i
            if(context.measureText(text).width * 1.25 > tW) tW = context.measureText(text).width * 1.24
        }// if
    }// else
    // Update the max width if the text is wider
    if(tW + 40 * SF > W * SF) W = tW / SF + 40

    /////////////////////////////////////////////////////////////////
    context.save()
    context.translate(x_base * SF, (y_base - H - 20) * SF)

    let x = 0
    let y = 0
    let COL
    if(d.type === "contributor") COL = COLOR_CONTRIBUTOR
    else if(d.type === "repo") COL = COLOR_REPO
    else if (d.type === "owner") COL = COLOR_OWNER

    // Background rectangle
    context.shadowBlur = 3 * SF
    context.shadowColor = "#d4d4d4"
    context.fillStyle = COLOR_BACKGROUND
    context.fillRect((x - W/2)*SF, y*SF, W*SF, H*SF)
    context.shadowBlur = 0
    
    // Line along the side
    context.fillStyle = COL
    context.fillRect((x - W/2 - 1)*SF, (y-1)*SF, (W+2)*SF, 6*SF)

    // Textual settings
    context.textAlign = "center"
    context.textBaseline = "middle"


    // Contributor, owner or repo
    y = 24
    font_size = 11
    setFont(context, font_size * SF, 400, "italic")
    context.fillStyle = COL
    text = ""
    if(d.type === "contributor") text = "Contributor"
    else if(d.type === "repo") text = "Repository"
    else if (d.type === "owner") text = "Owner" // TODO: Better wording?
    renderText(context, text, x * SF, y * SF, 2.5 * SF)

    context.fillStyle = COLOR_TEXT
    y += 22

    if (d.type === "contributor") {
        // The contributor's name
        font_size = 15
        setFont(context, font_size * SF, 700, "normal")
        renderText(context, d.data.contributor_name, x * SF, y * SF, 1.25 * SF)
        // d.data.contributor_lines.forEach((l, i) => {
        //     renderText(context, l, x * SF, (y + i * line_height * font_size) * SF, 1.25 * SF)
        // })

        // Number of commits to the central repo
        y += 25
        font_size = 12
        setFont(context, font_size * SF, 400, "normal")
        context.globalAlpha = 0.8
        renderText(context, `${formatDigit(d.data.link_central.commit_count)} commits to ${central_repo.label}`, x * SF, y * SF, 1.25 * SF)
        
        // First and last commit to main repo
        font_size = 10.5
        context.globalAlpha = 0.6
        setFont(context, font_size * SF, 400, "normal")
        y += font_size * line_height + 4
        // Check if the start and end date are in the same month of the same year
        if(d.data.link_central.commit_sec_min.getMonth() === d.data.link_central.commit_sec_max.getMonth() && d.data.link_central.commit_sec_min.getFullYear() === d.data.link_central.commit_sec_max.getFullYear()) {
            text = `In ${formatDate(d.data.link_central.commit_sec_min)}`
        } else { 
            text = `Between ${formatDate(d.data.link_central.commit_sec_min)} & ${formatDate(d.data.link_central.commit_sec_max)}`
        }// else
        renderText(context, text, x * SF, y * SF, 1.25 * SF)

        // Supported through ORCA
        if(d.data.orca_received) {
            y += 25
            font_size = 12
            context.fillStyle = COLOR_PURPLE
            setFont(context, font_size * SF, 700, "normal")
            renderText(context, "supported through ORCA", x * SF, y * SF, 1.5 * SF)
        }// if

    } else if(d.type === "owner") {
        // The name
        font_size = 15
        setFont(context, font_size * SF, 700, "normal")
        renderText(context, d.data.owner, x * SF, y * SF, 1.25 * SF)

        // Which repos fall under this owner in this visual
        y += 26
        font_size = 10.5
        context.globalAlpha = 0.6
        setFont(context, font_size * SF, 400, "italic")
        renderText(context, "Included repositories", x * SF, y * SF, 2 * SF)

        // Write out all the repositories
        font_size = 11.5
        y += font_size * line_height + 4
        context.globalAlpha = 0.9
        setFont(context, font_size * SF, 400, "normal")
        d.text_lines.forEach((l, i) => {
            renderText(context, l, x * SF, y * SF, 1.25 * SF)
            y += font_size * line_height
        })// forEach

    } else if(d.type === "repo") {
        // The repo's name and owner
        font_size = 14
        setFont(context, font_size * SF, 700, "normal")
        renderText(context, `${d.data.owner}/`, x * SF, y * SF, 1.25 * SF)
        renderText(context, d.data.name, x * SF, (y + line_height * font_size) * SF, 1.25 * SF)

        // The creation date
        y += 39
        font_size = 10
        context.globalAlpha = 0.6
        setFont(context, font_size * SF, 400, "normal")
        renderText(context, `Created in ${formatDate(d.data.createdAt)}`, x * SF, y * SF, 1.25 * SF)
        // The most recent updated date
        y += font_size * line_height
        renderText(context, `Last updated in ${formatDate(d.data.updatedAt)}`, x * SF, y * SF, 1.25 * SF)

        // The number of stars & forks
        y += 21
        font_size = 11
        setFont(context, font_size * SF, 400, "normal")
        context.globalAlpha = 0.9
        let stars = d.data.stars
        let forks = d.data.forks
        renderText(context, `${stars < 10 ? stars : formatDigit(stars)} stars | ${forks < 10 ? forks : formatDigit(forks)} forks`, x * SF, y * SF, 1.25 * SF)
        context.globalAlpha = 1

        // Languages
        if(d.data.languages.length > 0) {
            y += 26
            font_size = 10.5
            context.globalAlpha = 0.6
            setFont(context, font_size * SF, 400, "italic")
            renderText(context, "Languages", x * SF, y * SF, 2 * SF)

            font_size = 11.5
            y += font_size * line_height + 4
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
}// function drawTooltip

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

    if(d.type === "contributor") {
        setContributorFont(context, SF)
    } else {
        setRepoFont(context, SF)
    }// else

    if(d.id === central_repo.id) {
        font_weight = 700
        font_size = 16
        context.font = `${font_weight} ${font_size * SF}px ${FONT_FAMILY}`
    }// if

    if(d.type === "contributor") {
        // context.textAlign = "center"
        context.textBaseline = "middle"

        // Draw the contributor name radiating outward from the contributor's node
        context.save()
        context.translate(d.x * SF, d.y * SF)
        context.rotate(d.contributor_angle + (d.contributor_angle > PI/2 ? PI : 0))
        // Move the max_radius farther away
        context.translate((d.contributor_angle > PI/2 ? -1 : 1) * (d.max_radius + 14) * SF, 0)
        // context.textAlign = "center"
        context.textAlign = d.contributor_angle > PI/2 ? "right" : "left"

        let n = d.data.contributor_lines.length
        let label_line_height = 1.2
        let font_size = 13
        d.data.contributor_lines.forEach((l, i) => {
            let x = 0
            // Let the y-position be the center of the contributor node
            let y = (0 - (n - 1) * font_size * label_line_height / 2 + i * font_size * label_line_height) * SF

            // Draw a background colored rectangle for those receiving ORCA
            if(d.data.orca_received) {
                let W = context.measureText(l).width * 1.25 + 8 * SF
                let x_rect = x - 6 * SF
                if(d.contributor_angle > PI/2) x_rect = x + 4 * SF - W
                context.fillStyle = "#f1caf6"
                // context.fillStyle = COLOR_CONTRIBUTOR
                // context.fillStyle = COLOR_PURPLE
                // context.globalAlpha = 0.5
                context.fillRect(x_rect, -10 * SF + y, W, 20 * SF)
                context.globalAlpha = 1
                // context.fillStyle = COLOR_BACKGROUND
                context.fillStyle = COLOR_TEXT
            }// if

            renderText(context, l, x, y, 1.25 * SF)
        })// forEach

        context.restore()
    } else if(d.id === central_repo.id) {
        context.textAlign = "center"
        context.textBaseline = "middle"
        renderText(context, `${d.data.owner}/`, d.x * SF, (d.y - 0.6 * 12) * SF, 1.25 * SF)
        renderText(context, d.label, d.x * SF, (d.y + 0.6 * 12) * SF, 1.25 * SF)
    } else if(d.type === "repo") {
        context.textAlign = "center"
        context.textBaseline = "bottom"
        context.strokeStyle = COLOR_BACKGROUND
        context.lineWidth = 4 * SF
        renderText(context, `${d.data.owner}/`, d.x * SF, (d.y - d.r - 3 - 1.1 * 12) * SF, 1.25 * SF, true)
        renderText(context, d.label, d.x * SF, (d.y - d.r - 3) * SF, 1.25 * SF, true)
    } else { // owner
        context.textAlign = "center"
        context.textBaseline = "bottom"
        context.strokeStyle = COLOR_BACKGROUND
        context.lineWidth = 4 * SF
        renderText(context, d.label, d.x * SF, (d.y - d.r - 3) * SF, 1.25 * SF, true)
    }
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

function setContributorFont(context, SF = 1, font_size = 13) {
    setFont(context, font_size * SF, 700, "italic")
}//function setContributorFont

//////////////// Add tracking (space) between letters ///////////////
function renderText(context, text, x, y, letterSpacing = 0, stroke = false) {
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
        if(stroke) context.strokeText(current, currentPosition, y)
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

////////////////////////// Draw curved text /////////////////////////
function drawTextAlongArc(context, str, angle, radius, side, kerning = 0) {
    let startAngle = side === "up" ? angle : angle - pi
    if (side === "up") str = str.split("").reverse().join("") // Reverse letters

    //Rotate 50% of total angle for center alignment
    for (let j = 0; j < str.length; j++) {
        let charWid = (context.measureText(str[j]).width)
        startAngle += ((charWid + (j === str.length - 1 ? 0 : kerning)) / radius) / 2
    }//for j

    context.save()
    context.rotate(startAngle)

    for (let n = 0; n < str.length; n++) {
        let charWid = (context.measureText(str[n]).width / 2) // half letter
        let y = (side === "up" ? -1 : 1) * radius
        //Rotate half letter
        context.rotate(-(charWid + kerning) / radius)

        // context.fillText(str[n], 0, y)
        renderText(context, str[n], 0, y, 0)
        //Rotate another half letter
        context.rotate(-(charWid + kerning) / radius)
    }//for n

    context.restore()
}//function drawTextAlongArc

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
