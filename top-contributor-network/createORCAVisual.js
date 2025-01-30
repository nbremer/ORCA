// TODO: Mark the ORCA recipients

// TODO MAYBE: Add to tooltip with information about the person being - in short prose - first commit, last commit, number of repos that they have (use colors from the visual)
// TODO MAYBE: Make tooltip scale independent?

// FINAL: Update GitHub explanation 

/////////////////////////////////////////////////////////////////////
/////////////// Visualization designed & developed by ///////////////
/////////////////////////// Nadieh Bremer ///////////////////////////
///////////////////////// VisualCinnamon.com ////////////////////////
/////////////////////////////////////////////////////////////////////
const createORCAVisual = (container) => {
    /////////////////////////////////////////////////////////////////
    ///////////////////// CONSTANTS & VARIABLES /////////////////////
    /////////////////////////////////////////////////////////////////

    const PI = Math.PI
    const TAU = PI * 2

    let round = Math.round
    let cos = Math.cos
    let sin = Math.sin
    let min = Math.min
    let max = Math.max
    let sqrt = Math.sqrt

    // Default repo
    let REPO_CENTRAL = "mozilla/pdf.js"

    // Datasets
    let contributors, remainingContributors, orcaRecipients
    let repos
    let nodes = [], nodes_central
    let links
    let central_repo

    // Hover options
    let delaunay
    let nodes_delaunay
    let delaunay_remaining
    let HOVER_ACTIVE = false
    let HOVERED_NODE = null
    let CLICK_ACTIVE = false
    let CLICKED_NODE = null

    // Visual Settings - Based on SF = 1
    const CENTRAL_RADIUS = 50 // The radius of the central repository node
    let RADIUS_CONTRIBUTOR // The eventual radius along which the contributor nodes are placed
    let RADIUS_CONTRIBUTOR_NON_ORCA // The radius along which the contributor nodes are placed that have not received ORCA
    let ORCA_RING_WIDTH

    const INNER_RADIUS_FACTOR = 0.7 // The factor of the RADIUS_CONTRIBUTOR outside of which the inner repos are not allowed to go in the force simulation
    const MAX_CONTRIBUTOR_WIDTH = 55 // The maximum width (at SF = 1) of the contributor name before it gets wrapped
    const CONTRIBUTOR_PADDING = 20 // The padding between the contributor nodes around the circle (at SF = 1)

    let REMAINING_PRESENT = false // Is the dataset of remaining contributors present?
    let ORCA_PRESENT = false // Is the dataset of ORCA recipients present?

    /////////////////////////////////////////////////////////////////
    ///////////////////////////// Colors ////////////////////////////
    /////////////////////////////////////////////////////////////////

    const COLOR_BACKGROUND = "#f7f7f7"

    const COLOR_PURPLE = "#783ce6"

    const COLOR_REPO_MAIN = "#a682e8"
    const COLOR_REPO = "#64d6d3" // "#b2faf8"
    const COLOR_OWNER = "#f2a900"
    const COLOR_CONTRIBUTOR = "#ea9df5"

    const COLOR_LINK = "#e8e8e8"
    const COLOR_TEXT = "#4d4950"

    /////////////////////////////////////////////////////////////////
    ///////////////////////// Create Canvas /////////////////////////
    /////////////////////////////////////////////////////////////////

    // Create the three canvases and add them to the container
    const canvas = document.createElement("canvas")
    canvas.id = "canvas"
    const context = canvas.getContext("2d")
    
    const canvas_click = document.createElement("canvas")
    canvas_click.id = "canvas-click"
    const context_click = canvas_click.getContext("2d")
    
    const canvas_hover = document.createElement("canvas")
    canvas_hover.id = "canvas-hover"
    const context_hover = canvas_hover.getContext("2d")

    container.appendChild(canvas)
    container.appendChild(canvas_click)
    container.appendChild(canvas_hover)

    // Set some important stylings of each canvas
    container.style.position = "relative"
    container.style["background-color"] = COLOR_BACKGROUND

    styleCanvas(canvas)
    styleCanvas(canvas_hover)
    styleCanvas(canvas_click)

    styleBackgroundCanvas(canvas)
    styleBackgroundCanvas(canvas_click)

    canvas_hover.style.position = "relative"
    canvas_hover.style.z_index = "1"

    function styleCanvas(canvas) {
        canvas.style.display = "block"
        canvas.style.margin = "0"
    }// function styleCanvas

    function styleBackgroundCanvas(canvas) {
        canvas.style.position = "absolute"
        canvas.style.top = "0"
        canvas.style.left = "0"
        canvas.style.pointer_events = "none"
        canvas.style.z_index = "0"
        canvas.style.transition = "opacity 200ms ease-in"
    }// function styleBackgroundCanvas

    /////////////////////////////////////////////////////////////////
    /////////////////////////// Set Sizes ///////////////////////////
    /////////////////////////////////////////////////////////////////

    //Sizes
    const DEFAULT_SIZE = 1500
    let WIDTH = DEFAULT_SIZE
    let HEIGHT = DEFAULT_SIZE
    let width = DEFAULT_SIZE
    let height = DEFAULT_SIZE
    let SF, PIXEL_RATIO

    /////////////////////////////////////////////////////////////////
    //////////////////////// Create Functions ///////////////////////
    /////////////////////////////////////////////////////////////////

    let parseDate = d3.timeParse("%Y-%m-%dT%H:%M:%SZ")
    let parseDateUnix = d3.timeParse("%s")
    let formatDate = d3.timeFormat("%b %Y")
    let formatDateExact = d3.timeFormat("%b %d, %Y")
    let formatDigit = d3.format(",.2s")
    // let formatDigit = d3.format(",.2r")

    const scale_repo_radius = d3.scaleSqrt()
        .range([4, 20])

    // Based on the number of commits to the central repo
    const scale_contributor_radius = d3.scaleSqrt()
        .range([8, 30])
    const scale_remaining_contributor_radius = d3.scaleSqrt()
        .range([1, 8])

    const scale_link_distance = d3.scaleLinear()
        .domain([1,50])
        .range([10,80])

    const scale_link_width = d3.scalePow()
        .exponent(0.75)
        .range([1,2,60])
        // .clamp(true)

    /////////////////////////////////////////////////////////////////
    //////////////////////// Draw the Visual ////////////////////////
    /////////////////////////////////////////////////////////////////

    function chart(values) {
        /////////////////////////////////////////////////////////////
        ////////////////////// Data Preparation /////////////////////
        /////////////////////////////////////////////////////////////
        contributors = values[0]
        repos = values[1]
        links = values[2]
        if(values[3]) {
            // Check if there is a column called "author_name" in the dataset
            if(values[3][0].author_name !== undefined) {
                remainingContributors = values[3]
                REMAINING_PRESENT = true
                if(values[4]) {
                    orcaRecipients = values[4]
                    ORCA_PRESENT = true
                }// if
            // Otherwise check if there is a column called "name", because then this is the ORCA recipient dataset
            } else if(values[3][0].name !== undefined) {
                orcaRecipients = values[3]
                ORCA_PRESENT = true
            }// else if
        }// if
        prepareData()
        // console.log("Data prepared")
        
        /////////////////////////////////////////////////////////////
        /////////////// Run Force Simulation per Owner //////////////
        /////////////////////////////////////////////////////////////
        // Run a force simulation for per owner for all the repos that have the same "owner"
        // Like a little cloud of repos around them
        singleOwnerForceSimulation()
        // console.log("Contributor mini force simulation done")
        
        /////////////////////////////////////////////////////////////
        //////////// Run Force Simulation per Contributor ///////////
        /////////////////////////////////////////////////////////////
        // Run a force simulation for per contributor for all the repos that are not shared between other contributors
        // Like a little cloud of repos around them
        singleContributorForceSimulation()
        // console.log("Owner mini force simulation done")

        /////////////////////////////////////////////////////////////
        ///////////////// Position Contributor Nodes ////////////////
        /////////////////////////////////////////////////////////////
        // Place the central repo in the middle
        central_repo.x = central_repo.fx = 0
        central_repo.y = central_repo.fy = 0

        // Place the contributor nodes in a circle around the central repo
        // Taking into account the max_radius of single-degree repos around them
        positionContributorNodes()
        // console.log("Contributor nodes positioned")

        /////////////////////////////////////////////////////////////
        /////////// Run Force Simulation for Shared Repos ///////////
        /////////////////////////////////////////////////////////////
        // Run a force simulation to position the repos that are shared between contributors 
        collaborationRepoSimulation()
        // console.log("Central force simulation done")

        /////////////////////////////////////////////////////////////
        ////// Run Force Simulation for Remaining Contributors //////
        /////////////////////////////////////////////////////////////
        // Run a force simulation to position the remaining contributors around the central area
        if(REMAINING_PRESENT) remainingContributorSimulation()
        // console.log("Remaining contributor force simulation done")

        /////////////////////////////////////////////////////////////
        ////////////////////// Setup the Hover //////////////////////
        /////////////////////////////////////////////////////////////
        setupHover()
        setupClick()

        /////////////////////////////////////////////////////////////
        ///////////// Set the Sizes and Draw the Visual /////////////
        /////////////////////////////////////////////////////////////
        chart.resize()
    }// function chart

    /////////////////////////////////////////////////////////////////
    //////////////////////// Draw the visual ////////////////////////
    /////////////////////////////////////////////////////////////////

    function draw() {
        /////////////////////////////////////////////////////////////
        // Fill the background with a color
        context.fillStyle = COLOR_BACKGROUND
        context.fillRect(0, 0, WIDTH, HEIGHT)

        // Move the visual to the center
        context.save()
        context.translate(WIDTH / 2, HEIGHT / 2)

        /////////////////////////////////////////////////////////////
        // Draw the remaining contributors as small circles outside the ORCA circles
        if(REMAINING_PRESENT) {
            context.fillStyle = COLOR_CONTRIBUTOR
            context.globalAlpha = 0.4
            remainingContributors.forEach(d => {
                drawCircle(context, d.x, d.y, SF, d.r)
            })// forEach
            context.globalAlpha = 1
        }// if

        /////////////////////////////////////////////////////////////
        // Draw two rings that show the placement of the ORCA receiving contributors versus the non-ORCA receiving contributors
        drawBigRings(context, SF)

        /////////////////////////////////////////////////////////////
        // Draw all the links as lines
        links.forEach(l => drawLink(context, SF, l) )

        /////////////////////////////////////////////////////////////
        // Draw the central repo label in the background (in case it is bigger than it's circle)
        drawNodeLabel(context, central_repo, true)

        /////////////////////////////////////////////////////////////
        // Draw all the nodes as circles
        nodes.forEach(d => drawNodeArc(context, SF, d) )
        nodes.forEach(d => drawNode(context, SF, d) )

        /////////////////////////////////////////////////////////////
        // Draw the labels
        nodes_central.forEach(d => drawNodeLabel(context, d) )

        // Test to see how the bbox of the nodes look
        // drawBbox(context, nodes)

        /////////////////////////////////////////////////////////////
        context.restore()
    }// function draw

    /////////////////////////////////////////////////////////////////
    //////////////////////// Resize the chart ///////////////////////
    /////////////////////////////////////////////////////////////////
    chart.resize = () => {
        // Screen pixel ratio
        PIXEL_RATIO = window.devicePixelRatio

        // It's the width that determines the size
        WIDTH = round(width * PIXEL_RATIO)
        HEIGHT = round(height * PIXEL_RATIO)

        sizeCanvas(canvas, context)
        sizeCanvas(canvas_click, context_click)
        sizeCanvas(canvas_hover, context_hover)

        // Size the canvas
        function sizeCanvas(canvas, context) {
            canvas.width = WIDTH
            canvas.height = HEIGHT
            canvas.style.width = `${width}px`
            canvas.style.height = `${HEIGHT / PIXEL_RATIO}px`

            // Some canvas settings
            context.lineJoin = "round" 
            context.lineCap = "round"
        }// function sizeCanvas

        // Set the scale factor
        SF = WIDTH / DEFAULT_SIZE
        // If this means that the ring won't fit, make the SF smaller        
        let OUTER_RING = RADIUS_CONTRIBUTOR_NON_ORCA + ORCA_RING_WIDTH/2*2
        if(WIDTH/2 < OUTER_RING * SF) SF = WIDTH / (2*OUTER_RING)
        // console.log("SF:", SF)

        // Reset the delaunay for the mouse events
        nodes_delaunay = nodes
        delaunay = d3.Delaunay.from(nodes_delaunay.map(d => [d.x, d.y]))
        if(REMAINING_PRESENT) delaunay_remaining = d3.Delaunay.from(remainingContributors.map(d => [d.x, d.y]))
        // // Test to see if the delaunay works
        // testDelaunay(delaunay, context_hover)

        // Draw the visual
        draw()
    }//function resize

    /////////////////////////////////////////////////////////////////
    /////////////////// Data Preparation Functions //////////////////
    /////////////////////////////////////////////////////////////////

    //////////////// Prepare the data for the visual ////////////////
    function prepareData() {
        /////////////////////////////////////////////////////////////
        ///////////////////// Initial Data Prep /////////////////////
        /////////////////////////////////////////////////////////////

        ////////////////////////// CONTRIBUTORS /////////////////////////
        contributors.forEach(d => {
            d.contributor_name = d.author_name

            // If the ORCA dataset is present, check if this contributor is in it
            if(ORCA_PRESENT) d.orca_received = orcaRecipients.find(o => o.name === d.author_name) ? true : false
            else d.orca_received = false

            d.color = COLOR_CONTRIBUTOR

            // Determine across how many lines to split the contributor name
            setContributorFont(context);
            [d.contributor_lines, d.contributor_max_width] = getLines(context, d.contributor_name, MAX_CONTRIBUTOR_WIDTH);
            
            delete d.contributor_name_top
        })// forEach

        //////////////////////// REPOSITORIES ///////////////////////
        repos.forEach(d => {
            // d.repo
            d.forks = +d.repo_forks
            d.stars = +d.repo_stars

            // Check if the dates are in unix time or not
            if(isInteger(d.createdAt)) {
                d.createdAt = parseDateUnix(d.createdAt)
                d.updatedAt = parseDateUnix(d.repo_updatedAt)
            } else {
                d.createdAt = parseDate(d.repo_createdAt)
                d.updatedAt = parseDate(d.repo_updatedAt)
            }// else

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

            delete d.repo_forks
            delete d.repo_stars
            delete d.repo_createdAt
            delete d.repo_updatedAt
        })// forEach

        /////////////////////////// LINKS ///////////////////////////
        links.forEach(d => {
            // Source
            d.contributor_name = d.author_name
            // Target
            // d.repo

            // Metadata of the "link"
            d.commit_count = +d.commit_count

            // Check if the dates are in unix time or not
            if(isInteger(d.commit_sec_min)) {
                d.commit_sec_min = parseDateUnix(d.commit_sec_min)
                d.commit_sec_max = parseDateUnix(d.commit_sec_max)
            } else {
                d.commit_sec_min = parseDate(d.commit_sec_min)
                d.commit_sec_max = parseDate(d.commit_sec_max)
            }// else

            // Get the substring until the slash
            d.owner = d.repo.substring(0, d.repo.indexOf("/"))
            // Get the substring after the slash
            d.name = d.repo.substring(d.repo.indexOf("/") + 1)

            // d.repo = d.owner

            // Set-up initial source and target
            d.source = d.contributor_name
            d.target = d.repo

            delete d.author_name
        })// forEach

        ///////////////////// OTHER CONTRIBUTORS ////////////////////
        if(REMAINING_PRESENT) {
            remainingContributors.forEach(d => {
                d.commit_count = +d.commit_count

                // Check if the dates are in unix time or not
                if(isInteger(d.commit_sec_min)) {
                    d.commit_sec_min = parseDateUnix(d.commit_sec_min)
                    d.commit_sec_max = parseDateUnix(d.commit_sec_max)
                } else {
                    d.commit_sec_min = parseDate(d.commit_sec_min)
                    d.commit_sec_max = parseDate(d.commit_sec_max)
                }// else

                d.type = "contributor"
                d.remaining_contributor = true
                d.color = COLOR_CONTRIBUTOR
            })// forEach
        }// if

        //////////////////////// Create Nodes ///////////////////////
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
            // To which repositories did this contributor contribute
            d.repos = d.links_original.map(l => repos.find(r => r.repo === l.repo))

        })// forEach
        repos.forEach(d => {
            d.links_original = links.filter(l => l.target === d.repo)
            // Who contributed to this repository
            d.contributors = d.links_original.map(l => contributors.find(r => r.contributor_name === l.contributor_name))
        })// forEach

        /////////////////////////////////////////////////////////////
        // Mark all the repositories that have a link to at least one contributor that has received ORCA
        repos.forEach(d => {
            d.orca_impacted = false
            d.links_original.forEach(l => {
                if(contributors.find(c => c.contributor_name === l.contributor_name && c.orca_received === true)) {
                    d.orca_impacted = true
                }// if
            })// forEach
        })// forEach
        
        /////////////////////////////////////////////////////////////
        // Which is the central repo, the one that connects everyone (the one with the highest degree)
        central_repo = nodes.find(d => d.type === "repo" && d.id === REPO_CENTRAL)

        /////////////////////////// OWNERS //////////////////////////
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

        /////////////////////////////////////////////////////////////
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

        /////////////////////////////////////////////////////////////
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

        /////////////////////////////////////////////////////////////
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

        /////////////////////////////////////////////////////////////
        // Set scales
        scale_repo_radius.domain(d3.extent(repos, d => d.stars))
        scale_contributor_radius.domain(d3.extent(links.filter(l => l.target === central_repo.id), d => d.commit_count))
        scale_link_width.domain([1,10,d3.max(links, d => d.commit_count)])
        scale_remaining_contributor_radius.domain([0, scale_contributor_radius.domain()[0]])

        /////////////////////////////////////////////////////////////
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
                d.r = scale_repo_radius(d.data.stars)
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

    /////////////////////////////////////////////////////////////////
    ///////////////// Force Simulation | Per Owner //////////////////
    /////////////////////////////////////////////////////////////////
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
                                    else r = d.r + min(14, max(10, d.r))
                                } else r = n.r + max(2, n.r * 0.2)
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
                d.max_radius = d3.max(nodes_connected, n => sqrt((n.x - d.x)**2 + (n.y - d.y)**2))
                // Determine which node is the largest distance to the central node
                let max_radius_node = nodes_connected.find(n => sqrt((n.x - d.x)**2 + (n.y - d.y)**2) === d.max_radius)
                // Get the overall radius to take into account for the next simulation and labeling
                d.max_radius = max(d.max_radius + max_radius_node.r, d.r)
                // See this as the new "node" radius that includes all of it's repos

                // Reset the fx and fy
                delete d.fx
                delete d.fy
            })// forEach

    }// function singleOwnerForceSimulation

    /////////////////////////////////////////////////////////////////
    /////////////// Force Simulation | Per Contributor //////////////
    /////////////////////////////////////////////////////////////////

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
                let nodes_to_contributor = nodes.filter(n => links.find(l => l.source === d.id && l.target === n.id && n.degree === 1) || links.find(l => l.source === d.id && l.target === n.id && n.type === "owner" && n.data.single_contributor === true) || n.id === d.id)

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
                                if(n.id === d.id) r = d.r + min(14, max(10, d.r))
                                else if (n.max_radius) {
                                    r = n.max_radius
                                    // r -= 4
                                    // r = r + max(r*0.1, 2)
                                } else r = n.r + max(2, n.r * 0.2)
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
                d.max_radius = d3.max(nodes_to_contributor, n => sqrt((n.x - d.x)**2 + (n.y - d.y)**2))
                // Determine which node is the largest distance to the contributor node
                let max_radius_node = nodes_to_contributor.find(n => sqrt((n.x - d.x)**2 + (n.y - d.y)**2) === d.max_radius)
                // Get the overall radius to take into account for the next simulation and labeling
                d.max_radius = max(d.max_radius + max_radius_node.r, d.r)
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
        RADIUS_CONTRIBUTOR_NON_ORCA = RADIUS_CONTRIBUTOR * (ORCA_PRESENT ? 1.3 : 1)
        ORCA_RING_WIDTH = ((RADIUS_CONTRIBUTOR * 2.3)/2 - RADIUS_CONTRIBUTOR) * 2 // Not too sure about this in how well it holds up for other data

        // Fix the contributor nodes in a ring around the central node
        // const angle = TAU / (nodes.filter(d => d.type === "contributor").length)
        let angle = 0
        nodes
            .filter(d => d.type === "contributor")
            .forEach((d,i) => {
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

    /////////////////////////////////////////////////////////////////
    ///////////// Force Simulation | Collaboration Repos ////////////
    /////////////////////////////////////////////////////////////////
    // Run a force simulation to position the repos that are shared between contributors
    function collaborationRepoSimulation() {

        let simulation = d3.forceSimulation()
            .force("link",
                d3.forceLink()
                    .id(d => d.id)
                    .distance(d => scale_link_distance(d.target.degree) * 5)
            )
            // .force("collide",
            //     d3.forceCollide()
            //         .radius(d => {
            //             let r = d.max_radius ? d.max_radius : d.r
            //             return r + (d.padding ? d.padding : max(r/2, 15))
            //         })
            //         .strength(0)
            // )
            .force("collide", 
                //Make sure that the words don't overlap
                //https://github.com/emeeks/d3-bboxCollide
                d3.bboxCollide(d => d.bbox)
                    .strength(0)
                    .iterations(1)
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

        // Calculate the bounding box around the nodes including their label
        nodes_central.forEach(d => {
            if(d.type === "contributor") {
                d.bbox = [[-d.max_radius, -d.max_radius],[d.max_radius, d.max_radius]]
                return
            }// if

            // Set the fonts
            if(d.id === central_repo.id) {
                setCentralRepoFont(context, 1)
            } else if(d.type === "owner") {
                setOwnerFont(context, 1)
            } else if(d.type === "repo") {
                setRepoFont(context, 1)
            }// else

            let text_size = context.measureText(d.label)

            // In case the owner name is longer than the repo name
            if(d.type === "repo") {
                if(context.measureText(d.data.owner).width > text_size.width) text_size = context.measureText(d.data.owner)
            }// if

            // The central repo is the only one with the label in the center instead of along the top
            if(d.id === REPO_CENTRAL) {
                let r = d.r + 14
                let w = max(r * 2, text_size.width * 1.25) + 10
                d.bbox = [[-w/2, -r], [w/2, r]]
                return
            }// if

            let text_height = text_size.fontBoundingBoxAscent + text_size.fontBoundingBoxDescent
            if(d.type === "repo") text_height *= 2

            let r = d.type === "owner" ? d.max_radius : d.r
            let top = max(r, d.r + text_height)
            let w = max(r * 2, text_size.width * 1.25) + 10

            d.bbox = [[-w/2, -top],[w/2, r]]
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
                    const dist = sqrt(d.x ** 2 + d.y ** 2)
                    if(dist > RADIUS_CONTRIBUTOR * INNER_RADIUS_FACTOR) {
                        d.x = d.x / dist * RADIUS_CONTRIBUTOR * INNER_RADIUS_FACTOR
                        d.y = d.y / dist * RADIUS_CONTRIBUTOR * INNER_RADIUS_FACTOR
                    }//if
                }//if
            })// forEach
        }// simulationPlacementConstraints
    }// function collaborationRepoSimulation

    /////////////////////////////////////////////////////////////////
    ///////////// Force Simulation | Other Contributors /////////////
    /////////////////////////////////////////////////////////////////
    // Run a force simulation to place the remaining contributors somewhere outside the outer NON-ORCA ring
    function remainingContributorSimulation() {
        let LW = ((RADIUS_CONTRIBUTOR * 2.3)/2 - RADIUS_CONTRIBUTOR) * 2
        let R = RADIUS_CONTRIBUTOR_NON_ORCA + LW * 2

        // Initial random position, but outside of the ORCA ring
        remainingContributors.forEach(d => {
            let angle = Math.random() * TAU
            d.x = (R + Math.random() * 50) * cos(angle)
            d.y = (R + Math.random() * 50) * sin(angle)

            d.r = scale_remaining_contributor_radius(d.commit_count)
        })// forEach

        let simulation = d3.forceSimulation()
            .force("collide",
                d3.forceCollide()
                    .radius(d => d.r + Math.random() * 20 + 10)
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
        let n_ticks = 30
        for (let i = 0; i < n_ticks; ++i) {
            simulation.tick()
            // Make sure that the nodes remain within the canvas
            // simulationPlacementConstraints(remainingContributors)
        }//for i

        // Remove the dummy node from the dataset again
        remainingContributors.pop()

        /////////////////////////////////////////////////////////////
        function simulationPlacementConstraints(nodes) {
            let OUTER_AREA = max(DEFAULT_SIZE/2, RADIUS_CONTRIBUTOR_NON_ORCA + ORCA_RING_WIDTH/2*2)
            let O = 30
            // Make sure the nodes remain within the canvas
            nodes.forEach(d => {
                if(d.x < -OUTER_AREA + d.r) d.x = -OUTER_AREA + d.r*2 + Math.random() * O
                else if(d.x > OUTER_AREA - d.r) d.x = OUTER_AREA - d.r*2 - Math.random() * O
                if(d.y < -OUTER_AREA + d.r) d.y = -OUTER_AREA + d.r*2 + Math.random() * O
                else if(d.y > OUTER_AREA - d.r) d.y = OUTER_AREA - d.r*2 - Math.random() * O
            })// forEach
        }// simulationPlacementConstraints

    }// function remainingContributorSimulation

    /////////////////////////////////////////////////////////////////
    ////////////////////// Background Elements //////////////////////
    /////////////////////////////////////////////////////////////////
    // Draw two rings around the central node to show those that receive ORCA (if present) vs the other top contributors
    function drawBigRings(context, SF) {
        // Draw the ORCA rings
        context.fillStyle = context.strokeStyle = COLOR_PURPLE //COLOR_REPO_MAIN //spectral.mix("#e3e3e3", COLOR_REPO_MAIN, 0.75) 
        let LW = ORCA_RING_WIDTH
        let O = 4
        context.lineWidth = 1.5 * SF
        // context.lineWidth = LW * SF

        if(ORCA_PRESENT) {
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
        }// if
        
        // Second ring of those not receiving ORCA
        context.beginPath()
        context.moveTo(0 + (RADIUS_CONTRIBUTOR_NON_ORCA + LW/2) * SF, 0)
        context.arc(0, 0, (RADIUS_CONTRIBUTOR_NON_ORCA + LW/2) * SF, 0, TAU)
        context.moveTo(0 + (RADIUS_CONTRIBUTOR_NON_ORCA - LW/2 + O) * SF, 0)
        context.arc(0, 0, (RADIUS_CONTRIBUTOR_NON_ORCA - LW/2 + O) * SF, 0, TAU, true)
        context.globalAlpha = ORCA_PRESENT ? 0.03 : 0.05
        context.fill()
        context.globalAlpha = 0.1
        // context.stroke()

        // Add the title along the two bands
        if(ORCA_PRESENT) {
            context.textAlign = "center"
            setFont(context, 16 * SF, 700, "italic")
            context.globalAlpha = 0.5
            context.textBaseline = "bottom"
            drawTextAlongArc(context, "contributors supported through ORCA", TAU * 0.9, (RADIUS_CONTRIBUTOR - (LW/2 - O - 2)) * SF, "up", 1.5 * SF) 
 
            context.textBaseline = "top"
            drawTextAlongArc(context, `other top contributors`, TAU * 0.9, (RADIUS_CONTRIBUTOR_NON_ORCA + (LW/2 - O - 2)) * SF, "up", 1.5 * SF) 
        }// if
        context.globalAlpha = 1
    }// function drawBigRings

    /////////////////////////////////////////////////////////////////
    ///////////////////// Node Drawing Functions ////////////////////
    /////////////////////////////////////////////////////////////////

    function drawNode(context, SF, d) {
        // Is this a node that is a repo that is not impacted by ORCA?
        let REPO_NOT_ORCA = d.type === "repo" && !d.data.orca_impacted
        // If this is the central node, it should always look fully opaque (like an ORCA node)
        if (d.id === REPO_CENTRAL) REPO_NOT_ORCA = false

        // Draw a circle for the node
        context.shadowBlur = HOVER_ACTIVE ? 0 : max(2, d.r * 0.2) * SF
        context.shadowColor = "#f7f7f7"

        context.globalAlpha = REPO_NOT_ORCA ? 0.4 : 1
        context.fillStyle = d.color
        drawCircle(context, d.x, d.y, SF, d.r)
        context.globalAlpha = 1
        context.shadowBlur = 0

        // Draw a small circle in the center for the not ORCA impacted repos
        if(REPO_NOT_ORCA) drawCircle(context, d.x, d.y, SF, d.r * 0.3)

        // Also draw a stroke around the node
        if(!d.remaining_contributor) {
            context.strokeStyle = COLOR_BACKGROUND
            context.lineWidth = max(HOVER_ACTIVE ? 1.5 : 1, d.r * 0.07) * SF
            drawCircle(context, d.x, d.y, SF, d.r, true, true)
            context.stroke()
        }// if
    }// function drawNode

    function drawNodeArc(context, SF, d) {
        // Draw a tiny arc inside the contributor node to show how long they've been involved in the central repo's existence, based on their first and last commit
        if(d.type === "contributor" && !CLICK_ACTIVE) {
            timeRangeArc(context, SF, d, central_repo, d.data.link_central)
        }// if

        // Draw an arc around the repository node that shows how long the contributor has been active in that repo for all its existence, based on the first and last commit time
        if(HOVER_ACTIVE && HOVERED_NODE.type === "contributor" && d.type === "repo") {
            let link = HOVERED_NODE.data.links_original.find(p => p.repo === d.id)
            timeRangeArc(context, SF, d, d, link, COLOR_CONTRIBUTOR)
        }// if

    }// function drawNodeArc

    //////////////////////// Draw Hover Ring ////////////////////////
    // Draw a stroked ring around the hovered node
    function drawHoverRing(context, d) {
        let r = d.r + (d.type === "contributor" ? 9 : d === central_repo ? 14 : 7)
        context.beginPath()
        context.moveTo((d.x + r) * SF, d.y * SF)
        context.arc(d.x * SF, d.y * SF, r * SF, 0, TAU)
        context.strokeStyle = d.color
        context.lineWidth = 3 * SF
        context.stroke()
    }// function drawHoverRing

    /////////////////////// Arc around Circle ///////////////////////
    // Draw a tiny arc around the node to show how long they've been involved in a certain repo's existence, based on their first and last commit
    function timeRangeArc(context, SF, d, repo, link, COL = COLOR_REPO_MAIN) {
        context.save()
        context.translate(d.x * SF, d.y * SF)

        context.fillStyle = COL
        context.strokeStyle = COL

        // The scale for between which min and max date the contributor has been involved in the central repo
        const scale_involved_range = d3.scaleLinear()
            .domain([repo.data.createdAt, repo.data.updatedAt])
            .range([0, TAU])

        let r_inner = d.r + (d.type === "contributor" || d === central_repo ? 2.5 : 1)
        let r_outer = r_inner + 3

        const arc = d3.arc()
            .innerRadius(r_inner * SF)
            .outerRadius(r_outer * SF)
            .startAngle(scale_involved_range(link.commit_sec_min))
            .endAngle(scale_involved_range(link.commit_sec_max))
            .context(context)

        // Create the arc
        context.beginPath()
        arc()
        context.fill()

        // // Draw a tiny marker at the top to show where the "start" is
        // context.beginPath()
        // context.moveTo(0, - (d.r + 2) * SF)
        // context.lineTo(0, - (d.r + 2 + 5) * SF)
        // context.lineWidth = 1 * SF
        // context.stroke()

        context.restore()
    }// function timeRangeArc

    ////////// Fill a circle with a diagonal hatch pattern //////////
    function drawHatchPattern(context, radius, angle) {
        context.save()
        context.beginPath()
        context.arc(0, 0, radius, 0, TAU)
        context.clip()
    
        const lW = 1.5 * SF
        // const lW = min(0.3 * radius, 2.5)
        const step = 4 * lW * sin(angle / 2)
        
        context.lineWidth = lW
        context.strokeStyle = d.color
        for (let x = -2.5*radius; x < 2.5*radius; x += step) {
        context.beginPath()
        context.moveTo(x, -radius)
        context.lineTo(x + radius * Math.tan(angle / 2), radius)
        context.stroke()
        }// for x
        context.restore()
    }// function drawHatchPattern

    ///////////////////////// Draw a circle /////////////////////////
    function drawCircle(context, x, y, SF, r = 10, begin = true, stroke = false) {
        if(begin === true) context.beginPath()
        context.moveTo((x+r) * SF, y * SF)
        context.arc(x * SF, y * SF, r * SF, 0, TAU)
        if(begin && stroke == false) context.fill()
        // if(begin) { context.lineWidth = 1.5 * SF; context.stroke() }
    }//function drawCircle

    /////////////////////////////////////////////////////////////////
    ///////////////////// Line Drawing Functions ////////////////////
    /////////////////////////////////////////////////////////////////

    ////////// Draw the link between the source and target //////////
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
        }// if

        context.lineWidth = line_width * SF
        drawLine(context, SF, l)
    }// function drawLink

    ///////////////////////// Draw the lines ////////////////////////
    function drawLine(context, SF, line) {
        context.beginPath()
        context.moveTo(line.source.x * SF, line.source.y * SF)
        if(line.center) drawCircleArc(context, SF, line)
        else context.lineTo(line.target.x * SF, line.target.y * SF)
        context.stroke()
    }//function drawLine

    ////////////////////// Draw a curved line ///////////////////////
    function drawCircleArc(context, SF, line) {
        let center = line.center
        let ang1 = Math.atan2(line.source.y * SF - center.y * SF, line.source.x * SF - center.x * SF)
        let ang2 = Math.atan2(line.target.y * SF - center.y * SF, line.target.x * SF - center.x * SF)
        context.arc(center.x * SF, center.y * SF, line.r * SF, ang1, ang2, line.sign)
    }//function drawCircleArc

    ///////////////////// Calculate Line Centers ////////////////////
    function calculateEdgeCenters(l, size = 2, sign = true) {
        //Find a good radius
        l.r = sqrt(sq((l.target.x - l.source.x)) + sq((l.target.y - l.source.y))) * size //Can run from > 0.5
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
            let norm = sqrt(sq(perpABdx) + sq(perpABdy))
            perpABdx /= norm
            perpABdy /= norm
            // compute distance from pm to p1
            let dpmp1 = sqrt(sq(pm.x - p1.x) + sq(pm.y - p1.y))
            // sin of the angle between { circle center,  middle , p1 }
            let sin = dpmp1 / r
            // is such a circle possible ?
            if (sin < -1 || sin > 1) return null // no, return null
            // yes, compute the two centers
            let cos = sqrt(1 - sq(sin))   // build cos out of sin
            let d = r * cos
            let res1 = { x: pm.x + perpABdx * d, y: pm.y + perpABdy * d }
            let res2 = { x: pm.x - perpABdx * d, y: pm.y - perpABdy * d }
            return { c1: res1, c2: res2 }
        }//function findCenters
    }//function calculateEdgeCenters

    ///////////////// Create gradients for the links ////////////////
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

            if(l.source.x !== undefined && l.target.x !== undefined) {
                l.gradient = context.createLinearGradient(l.source.x * SF, l.source.y * SF, l.target.x * SF, l.target.y * SF)

                // Distance between source and target
                let dist = sqrt(sq(l.target.x - l.source.x) + sq(l.target.y - l.source.y))
                // What percentage is the source's radius of the total distance
                let perc = l.source.r / dist
                // Let the starting color be at perc, so it starts changing color right outside the radius of the source node
                l.gradient.addColorStop(perc, color_rgb_source)
                l.gradient.addColorStop(1, color_rgb_target)
            }
            else l.gradient = COLOR_LINK
        }//function createGradient
    }//function calculateLinkGradient

    /////////////////////////////////////////////////////////////////
    //////////////////////// Hover Functions ////////////////////////
    /////////////////////////////////////////////////////////////////
    // Setup the hover on the top canvas, get the mouse position and call the drawing functions
    function setupHover() {
        d3.select("#canvas-hover").on("mousemove", function(event) {
            // Get the position of the mouse on the canvas
            let [mx, my] = d3.pointer(event, this);
            let [d, FOUND] = findNode(mx, my);

            // Draw the hover state on the top canvas
            if(FOUND) {
                HOVER_ACTIVE = true
                HOVERED_NODE = d

                // Fade out the main canvas, using CSS
                if(!d.remaining_contributor) canvas.style.opacity = d.type === "contributor" ? '0.15' : '0.3'

                // Draw the hovered node and its neighbors and links
                drawHoverState(context_hover, d)
            } else {
                context_hover.clearRect(0, 0, WIDTH, HEIGHT)
                HOVER_ACTIVE = false
                HOVERED_NODE = null
        
                if(!CLICK_ACTIVE) {
                    // Fade the main canvas back in
                    canvas.style.opacity = '1'
                }// if
            }// else

        })// on mousemove

        // canvas.ontouchmove =
        // canvas.onmousemove = event => {
        //         event.preventDefault();
        //         console.log(event.layerX)
        //     };

    }// function setupHover

    // Draw the hovered node and its links and neighbors and a tooltip
    function drawHoverState(context, d, DO_TOOLTIP = true) {
        // Draw the hover canvas
        context.save()
        context.clearRect(0, 0, WIDTH, HEIGHT)
        context.translate(WIDTH / 2, HEIGHT / 2)

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
            
        }// if

        /////////////////////////////////////////////////
        // Draw all the links to this node
        d.neighbor_links.forEach(l => {
            drawLink(context, SF, l)
        })// forEach

        // Draw all the connected nodes
        d.neighbors.forEach(n => drawNodeArc(context, SF, n))
        d.neighbors.forEach(n => drawNode(context, SF, n))
        // Draw all the labels of the "central" connected nodes
        d.neighbors.forEach(n => {
            if(n.node_central) drawNodeLabel(context, n)
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
        if(DO_TOOLTIP) drawTooltip(context, d)

        context.restore()
    }// function drawHoverState

    /////////////////////////////////////////////////////////////////
    //////////////////////// Click Functions ////////////////////////
    /////////////////////////////////////////////////////////////////

    function setupClick() {
        d3.select("#canvas-hover").on("click", function(event) {
            // Get the position of the mouse on the canvas
            let [mx, my] = d3.pointer(event, this);
            let [d, FOUND] = findNode(mx, my);
            
            // Clear the "clicked" canvas
            context_click.clearRect(0, 0, WIDTH, HEIGHT)

            if(FOUND) {
                CLICK_ACTIVE = true
                CLICKED_NODE = d

                // Reset the delaunay for the hover, taking only the neighbors into account of the clicked node
                nodes_delaunay = d.neighbors ? [...d.neighbors, d] : nodes
                delaunay = d3.Delaunay.from(nodes_delaunay.map(n => [n.x, n.y]))

                // Copy the context_hovered to the context_click without the tooltip
                drawHoverState(context_click, d, false)
                // Empty the hovered canvas
                context_hover.clearRect(0, 0, WIDTH, HEIGHT)

                // // Test if the delaunay works
                // testDelaunay(delaunay, context_hover)
            } else {
                CLICK_ACTIVE = false
                CLICKED_NODE = null
                HOVER_ACTIVE = false
                HOVERED_NODE = null
                
                // Reset the delaunay to all the nodes
                nodes_delaunay = nodes
                delaunay = d3.Delaunay.from(nodes_delaunay.map(d => [d.x, d.y]))

                // Fade the main canvas back in
                canvas.style.opacity = '1'
            }// else

        })// on mousemove
    }// function setupHover

    /////////////////////////////////////////////////////////////////
    ///////////////// General Interaction Functions /////////////////
    /////////////////////////////////////////////////////////////////

    // Turn the mouse position into a canvas x and y location and see if it's close enough to a node
    function findNode(mx, my) {
        mx = ((mx * PIXEL_RATIO) - WIDTH / 2) / SF
        my = ((my * PIXEL_RATIO) - HEIGHT / 2) / SF

        //Get the closest hovered node
        let point = delaunay.find(mx, my)
        let d = nodes_delaunay[point]

        // Get the distance from the mouse to the node
        let dist = sqrt((d.x - mx)**2 + (d.y - my)**2)
        // If the distance is too big, don't show anything
        let FOUND = dist < d.r + (CLICK_ACTIVE ? 10 : 50)

        // Check if the mouse is close enough to one of the remaining contributors of FOUND is false
        if(!FOUND && REMAINING_PRESENT) {
            point = delaunay_remaining.find(mx, my)
            d = remainingContributors[point]
            dist = sqrt((d.x - mx)**2 + (d.y - my)**2)
            FOUND = dist < d.r + 5
        }// if

        return [d, FOUND]
    }// function findNode

    // Draw the tooltip above the node
    function drawTooltip(context, d) {
        let line_height = 1.2
        let font_size
        let text

        // Figure out the base x and y position of the tooltip
        const x_base = d.x
        const y_base = d.y + (d.y < 0 ? 1 : -1) * (d.max_radius ? d.max_radius : d.r)

        /////////////////////////////////////////////////////////////
        // Figure out the required height of the tooltip
        let H = 93
        if(d.type === "contributor") {
            if(d.data && d.data.orca_received) H = 134
            else H = 109
        } else if(d.type === "repo") {
            if(d.data.languages.length > 3) H = 222
            else if(d.data.languages.length > 0) H = 210
            else H = 169

            if(CLICK_ACTIVE && CLICKED_NODE.type === "contributor") H+= 63
        }// else

        // Start with a minimum width
        let W = 280

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
            text = d.data ? d.data.contributor_name : d.author_name
            tW = context.measureText(text).width * 1.25
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
                for(let i = 0; i < min(3, d.data.languages.length); i++) {
                    text += `${d.data.languages[i]}${i < min(3, d.data.languages.length) - 1 ? ", " : ""}`
                }// for i
                if(context.measureText(text).width * 1.25 > tW) tW = context.measureText(text).width * 1.24
            }// if
        }// else
        // Update the max width if the text is wider
        if(tW + 40 * SF > W * SF) W = tW / SF + 40

        /////////////////////////////////////////////////////////////////
        // If the hovered node is above half of the page, place the tooltip below the node
        let H_OFFSET = d.y < 0 ? 20 : -H -20
        context.save()
        context.translate(x_base * SF, (y_base + H_OFFSET) * SF)

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
        y = 20
        font_size = 12
        setFont(context, font_size * SF, 400, "italic")
        context.fillStyle = COL
        text = ""
        if(d.type === "contributor") text = "Contributor"
        else if(d.type === "repo") text = "Repository"
        else if (d.type === "owner") text = "Owner"
        renderText(context, text, x * SF, y * SF, 2.5 * SF)

        context.fillStyle = COLOR_TEXT
        y += 24

        if (d.type === "contributor") {
            // The contributor's name
            font_size = 16
            setFont(context, font_size * SF, 700, "normal")
            text = d.data ? d.data.contributor_name : d.author_name
            renderText(context, text, x * SF, y * SF, 1.25 * SF)

            // Number of commits to the central repo
            y += 26
            font_size = 12.5
            setFont(context, font_size * SF, 400, "normal")
            context.globalAlpha = 0.9
            let num_commits = d.data ? d.data.link_central.commit_count : d.commit_count
            let extra_s = num_commits === 1 ? "" : "s"
            renderText(context, `${num_commits < 10 ? num_commits : formatDigit(num_commits)} commit${extra_s} to ${central_repo.label}`, x * SF, y * SF, 1.25 * SF)
            
            // First and last commit to main repo
            font_size = 11.5
            context.globalAlpha = 0.7
            setFont(context, font_size * SF, 400, "normal")
            y += font_size * line_height + 4
            // Check if the start and end date are in the same month of the same year
            let commit_min = d.data ? d.data.link_central.commit_sec_min : d.commit_sec_min
            let commit_max = d.data ? d.data.link_central.commit_sec_max : d.commit_sec_max
            if(commit_min.getMonth() === commit_max.getMonth() && commit_min.getFullYear() === commit_max.getFullYear()) {
                text = `In ${formatDate(commit_min)}`
            } else { 
                text = `Between ${formatDate(commit_min)} & ${formatDate(commit_max)}`
            }// else
            renderText(context, text, x * SF, y * SF, 1.25 * SF)

            // Supported through ORCA
            if(d.data && d.data.orca_received) {
                y += 25
                font_size = 12
                context.globalAlpha = 0.7
                context.fillStyle = COLOR_PURPLE
                setFont(context, font_size * SF, 700, "normal")
                renderText(context, "supported through ORCA", x * SF, y * SF, 1.5 * SF)
            }// if

        } else if(d.type === "owner") {
            // The name
            font_size = 16
            setFont(context, font_size * SF, 700, "normal")
            renderText(context, d.data.owner, x * SF, y * SF, 1.25 * SF)

            // Which repos fall under this owner in this visual
            y += 28
            font_size = 11
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
            font_size = 15
            setFont(context, font_size * SF, 700, "normal")
            renderText(context, `${d.data.owner}/`, x * SF, y * SF, 1.25 * SF)
            renderText(context, d.data.name, x * SF, (y + line_height * font_size) * SF, 1.25 * SF)

            // The creation date
            y += 42
            font_size = 11
            context.globalAlpha = 0.7
            setFont(context, font_size * SF, 400, "normal")
            renderText(context, `Created in ${formatDate(d.data.createdAt)}`, x * SF, y * SF, 1.25 * SF)
            // The most recent updated date
            y += font_size * line_height
            renderText(context, `Last updated in ${formatDate(d.data.updatedAt)}`, x * SF, y * SF, 1.25 * SF)

            // The number of stars & forks
            y += 23
            font_size = 12
            setFont(context, font_size * SF, 400, "normal")
            context.globalAlpha = 1
            let stars = d.data.stars
            let forks = d.data.forks
            renderText(context, `${stars < 10 ? stars : formatDigit(stars)} stars | ${forks < 10 ? forks : formatDigit(forks)} forks`, x * SF, y * SF, 1.25 * SF)
            context.globalAlpha = 1

            // Languages
            if(d.data.languages.length > 0) {
                y += 24
                font_size = 11
                context.globalAlpha = 0.6
                setFont(context, font_size * SF, 400, "italic")
                renderText(context, "Languages", x * SF, y * SF, 2 * SF)

                font_size = 11.5
                y += font_size * line_height + 4
                context.globalAlpha = 0.9
                setFont(context, font_size * SF, 400, "normal")
                text = ""
                for(let i = 0; i < min(3, d.data.languages.length); i++) {
                    text += `${d.data.languages[i]}${i < min(3, d.data.languages.length) - 1 ? ", " : ""}`
                }// for i
                renderText(context, text, x * SF, y * SF, 1.25 * SF)
                if(d.data.languages.length > 3) {
                    y += font_size * line_height
                    text = `& ${d.data.languages.length - 3} more`
                    renderText(context, text, x * SF, y * SF, 1.25 * SF)
                }// if

            }// if

            // Number of ORCA recipients
            let ORCA_RECEIVED = 0
            let weight = 400
            context.globalAlpha = 0.8
            font_size = 11

            d.data.contributors.forEach(c => {
                if(c.orca_received) ORCA_RECEIVED++
            })
            if(ORCA_RECEIVED > 0) {
                font_size = 12
                context.globalAlpha = 0.7
                context.fillStyle = COLOR_PURPLE
                weight = 700
                text = `supported by ${ORCA_RECEIVED} ORCA recipient`
                if(ORCA_RECEIVED > 1) text += "s"
            }
            else text = "not supported by ORCA"
            y += 26
            
            setFont(context, font_size * SF, weight, "normal")
            renderText(context, text, x * SF, y * SF, 1.25 * SF)
            context.fillStyle = COLOR_TEXT
            context.globalAlpha = 0.9

            // First and last commit the the hovered repo if a click is active
            if(CLICK_ACTIVE && CLICKED_NODE.type === "contributor") {
                // Get the first and last commit of the contributor to this repo
                let link = CLICKED_NODE.data.links_original.find(l => l.repo === d.id)
                let num_commits = link.commit_count

                y += 28
                font_size = 11
                context.globalAlpha = 0.6
                setFont(context, font_size * SF, 400, "italic")
                text = num_commits === 1 ? "1 commit by" : `${num_commits} commits by`
                renderText(context, text, x * SF, y * SF, 2 * SF)
                // renderText(context, "First and Last Commit by", x * SF, y * SF, 2 * SF)

                y += 16
                font_size = 11.5
                context.globalAlpha = 0.9
                setFont(context, font_size * SF, 700, "normal")
                renderText(context, CLICKED_NODE.data.contributor_name, x * SF, y * SF, 1.25 * SF)

                y += 18
                font_size = 11
                context.globalAlpha = 0.6
                setFont(context, font_size * SF, 400, "normal")
                if(formatDateExact(link.commit_sec_min) === formatDateExact(link.commit_sec_max)) text = `On ${formatDateExact(link.commit_sec_max)}`
                else if(formatDate(link.commit_sec_min) === formatDate(link.commit_sec_max)) text = `In ${formatDate(link.commit_sec_max)}`
                else text = `Between ${formatDate(link.commit_sec_min)} / ${formatDate(link.commit_sec_max)}`
                renderText(context, text, x * SF, y * SF, 1.25 * SF)
            }// if

        }// else

        context.restore()
    }// function drawTooltip

    /////////////////////////////////////////////////////////////////
    ///////////////////////// Text Functions ////////////////////////
    /////////////////////////////////////////////////////////////////

    function drawNodeLabel(context, d, DO_CENTRAL_OUTSIDE = false) {
        
        // Draw the name above each node
        context.fillStyle = COLOR_TEXT
        context.lineWidth = 2 * SF
        context.textAlign = "center"

        if(d.id === central_repo.id) {
            setCentralRepoFont(context, SF)
        } else if(d.type === "contributor") {
            setContributorFont(context, SF)
        } else if(d.type === "owner") {
            setOwnerFont(context, SF)
        } else {
            setRepoFont(context, SF)
        }// else

        if(d.type === "contributor") {
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
                    // context.fillStyle = "#cfbeee"
                    context.fillRect(x_rect, -10 * SF + y, W, 20 * SF)
                    context.globalAlpha = 1
                    // context.fillStyle = COLOR_BACKGROUND
                    context.fillStyle = COLOR_TEXT
                }// if

                renderText(context, l, x, y, 1.25 * SF)
            })// forEach

            context.restore()
        } else if(d.id === central_repo.id) {
            context.textBaseline = "middle"
            context.fillStyle = DO_CENTRAL_OUTSIDE ? COLOR_REPO_MAIN : COLOR_BACKGROUND
            // If this is drawing the text in the inside of the central circle, clip it to that circle
            if(!DO_CENTRAL_OUTSIDE) {
                context.save()
                context.beginPath()
                context.arc(d.x * SF, d.y * SF, d.r * SF, 0, 2 * PI)
                context.clip()
            }// if
            renderText(context, `${d.data.owner}/`, d.x * SF, (d.y - 0.6 * 12) * SF, 1.25 * SF)
            renderText(context, d.label, d.x * SF, (d.y + 0.9 * 12) * SF, 1.25 * SF)
            if(!DO_CENTRAL_OUTSIDE) context.restore()
        } else if(d.type === "repo") {
            context.textBaseline = "bottom"
            context.strokeStyle = COLOR_BACKGROUND
            context.lineWidth = 4 * SF
            renderText(context, `${d.data.owner}/`, d.x * SF, (d.y - d.r - 3 - 1.1 * 12) * SF, 1.25 * SF, true)
            renderText(context, d.label, d.x * SF, (d.y - d.r - 3) * SF, 1.25 * SF, true)
        } else { // owner
            context.textBaseline = "bottom"
            context.strokeStyle = COLOR_BACKGROUND
            context.lineWidth = 4 * SF
            renderText(context, `${d.label}/`, d.x * SF, (d.y - d.r - 3) * SF, 1.25 * SF, true)
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

    function setCentralRepoFont(context, SF = 1, font_size = 15) {
        setFont(context, font_size * SF, 700, "normal")
    }//function setCentralRepoFont

    function setOwnerFont(context, SF = 1, font_size = 12) {
        setFont(context, font_size * SF, 700, "normal")
    }//function setOwnerFont

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
        let min_value = min(...diff)
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

    /////////////////////////////////////////////////////////////////
    ///////////////////////// Test Functions ////////////////////////
    /////////////////////////////////////////////////////////////////

    // TEST - Draw a (scaled wrong) version of the delaunay triangles
    function testDelaunay(delaunay, context) {
        context.save()
        context.translate(WIDTH / 2, HEIGHT / 2)
        context.beginPath()
        delaunay.render(context)
        context.strokeStyle = "silver"
        context.lineWidth = 1 * SF
        context.stroke()
        context.restore()
    }// function testDelaunay

    // TEST - Draw a stroked rectangle around the bbox of the nodes
    function drawBbox(context, nodes) {
        context.strokeStyle = "red"
        context.lineWidth = 1
        nodes
            .filter(d => d.bbox)
            .forEach(d => {
                context.strokeRect(d.x * SF + d.bbox[0][0] * SF, d.y * SF + d.bbox[0][1] * SF, (d.bbox[1][0] - d.bbox[0][0]) * SF, (d.bbox[1][1] - d.bbox[0][1]) * SF)
        })// forEach 
    }// function drawBbox
    
    /////////////////////////////////////////////////////////////////
    //////////////////////// Helper Functions ///////////////////////
    /////////////////////////////////////////////////////////////////

    function mod (x, n) { return ((x % n) + n) % n }

    function sq(x) { return x * x }

    function isInteger(value) { return /^\d+$/.test(value) }

    /////////////////////////////////////////////////////////////////
    /////////////////////// Accessor functions //////////////////////
    /////////////////////////////////////////////////////////////////

    chart.width = function (value) {
        if (!arguments.length) return width
        width = value
        return chart
    }// chart.width

    chart.height = function (value) {
        if (!arguments.length) return height
        height = value
        return chart
    } // chart.height

    chart.repository = function (value) {
        if (!arguments.length) return REPO_CENTRAL
        REPO_CENTRAL = value
        return chart
    } // chart.repository

    return chart

}// function createORCAVisual
