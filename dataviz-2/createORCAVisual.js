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
    let commits
    let commits_by_month

    // Hover options
    let delaunay
    let nodes_delaunay
    let delaunay_remaining
    let HOVER_ACTIVE = false
    let HOVERED_NODE = null
    let CLICK_ACTIVE = false
    let CLICKED_NODE = null

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

    container.appendChild(canvas)

    // // Set some important stylings of each canvas
    // container.style.position = "relative"
    // container.style["background-color"] = COLOR_BACKGROUND

    // styleCanvas(canvas)

    // function styleCanvas(canvas) {
    //     canvas.style.display = "block"
    //     canvas.style.margin = "0"
    // }// function styleCanvas

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

    let parseDate = d3.timeParse("%Y-%m-%d %H:%M:%S %Z")
    let formatMonth = d3.timeFormat("%Y-%m")
    let formatDate = d3.timeFormat("%b %Y")
    let formatDateExact = d3.timeFormat("%b %d, %Y")
    let formatDigit = d3.format(",.2s")
    // let formatDigit = d3.format(",.2r")

    const scale_radius = d3.scalePow()
        .exponent(0.5)
        .range([1.5, 8, 10])
        // .range([1, 10, 15])
        .clamp(true)

    const scale_color = d3.scalePow()
        .exponent(0.5)
        .range([COLOR_CONTRIBUTOR, COLOR_REPO])
        .clamp(true)

    /////////////////////////////////////////////////////////////////
    //////////////////////// Draw the Visual ////////////////////////
    /////////////////////////////////////////////////////////////////

    function chart(values) {
        /////////////////////////////////////////////////////////////
        ////////////////////// Data Preparation /////////////////////
        /////////////////////////////////////////////////////////////
        commits = values[0]
        // Initial simple data preparation
        prepareData()
        // Find the positions of the commits within each month's circle
        determineCommitPositions()
        // Find the positions of each month's circle
        determineMonthPositions()

        console.log(commits[0])
        
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

        // console.log(SF)

        context.strokeStyle = COLOR_OWNER
        context.lineWidth = 1.5 * SF
        commits_by_month.forEach((d, i) => {
            // Draw the month circle
            // console.log(d)
            
            context.fillStyle = COLOR_BACKGROUND
            context.shadowBlur = 10 * SF
            context.shadowColor = "#d4d2ce"
            drawCircle(context, d.x, d.y, d.r, SF, true, false)
            context.shadowBlur = 0

            d.forEach(n => {
                // Draw the commits
                context.fillStyle = scale_color(n.files_changed)
                // context.fillStyle = n.lines_changed < 212 ? COLOR_REPO : COLOR_CONTRIBUTOR
                drawCircle(context, n.x + d.x, n.y + d.y, n.radius, SF, true, false)
            })// forEach

        })//forEach
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

        // Draw the visual
        draw()
    }//function resize

    /////////////////////////////////////////////////////////////////
    /////////////////// Data Preparation Functions //////////////////
    /////////////////////////////////////////////////////////////////

    ///////////// Initial easy clean-up and calculations ////////////
    function prepareData() {

        commits.forEach(d => {
            d.files_changed = +d.files_changed
            d.line_insertions = +d.line_insertions
            d.line_deletions = +d.line_deletions
            d.lines_changed = d.line_insertions + d.line_deletions

            // Time
            d.author_time = parseDate(d.author_time)
            d.commit_time = parseDate(d.commit_time)
            d.commit_month = d.commit_time.getMonth()
            d.commit_year = d.commit_time.getFullYear()
        })// forEach

        // Find the 90% quantile of the number of lines changed
        let QUANTILE90 = d3.quantile(commits.filter(d => d.lines_changed > 0), 0.90, d => d.lines_changed)
        let QUANTILE99 = d3.quantile(commits.filter(d => d.lines_changed > 0), 0.99, d => d.lines_changed)
        // Set the radius scale
        scale_radius.domain([0, QUANTILE90, QUANTILE99])
        // console.log(scale_radius.domain())
        
        
        QUANTILE90 = d3.quantile(commits.filter(d => d.files_changed > 0), 0.90, d => d.files_changed)
        scale_color.domain([0, QUANTILE90])
        // console.log(scale_color.domain())

        // Calculate the Visual variables
        commits.forEach(d => {
            d.radius = scale_radius(d.lines_changed)
        })// forEach

        /////////////////////////////////////////////////////////////
        // Group the commits by month
        commits_by_month = d3.group(commits, d => formatMonth(d.commit_time))

        // Loop over all the months and save some statistics
        commits_by_month.forEach((d, i) => {
            d.index = i
            d.n_commits = d.length

            let total_files = 0
            let total_insertions = 0
            let total_deletions = 0
            let total_changes = 0
            let authors = new Set()
            d.forEach(n => {
                total_files += n.files_changed
                total_insertions += n.line_insertions
                total_deletions += n.line_deletions
                total_changes += n.lines_changed
                authors.add(n.author)
            })// forEach

            d.total_files = total_files
            d.total_insertions = total_insertions
            d.total_deletions = total_deletions
            d.total_changes = total_changes
            d.total_authors = authors.size
        })// forEach
    }// function prepareData

    ////// Determine the positions of the commits within a month ////
    function determineCommitPositions() {
        //Place the children circles within each month
        commits_by_month.forEach((d, i) => {

            let padding = 1.25

            // Do a circle pack with a simulation after it
            d.forEach(n => { n.r = n.radius + padding + Math.random()/2 })
            d3.packSiblings(d)

            // TODO webworker
            // //Do a static simulation to create slightly better looking groups
            // const simulation = d3.forceSimulation(d)
            //     .force("center", d3.forceCenter())
            //     .force("x", d3.forceX(0).strength(0.5))
            //     .force("y", d3.forceY(0).strength(0.5))
            //     .force("collide", d3.forceCollide(n => n.radius + padding).strength(1))
            //     .stop()
            // for (let i = 0; i < 300; ++i) simulation.tick()

            //////////////// Enclosing Parent Circle ////////////////
            // With the locations of the children known, calculate the smallest enclosing circle
            d.forEach(n => { n.r = n.radius + 12})
            let parent_circle = d3.packEnclose(d)

            //Offset the children slightly so the parent circle is on the 0,0 center
            d.forEach(n => { 
                n.r = n.radius
                // n.x = n.x + parent_circle.x
                // n.y = n.y + parent_circle.y
            })
            //Save the parent radius
            d.r = parent_circle.r
        })//forEach
        console.log(commits_by_month)

    }// function determineCommitPositions

    ///////////// Determine the positions of each month /////////////
    function determineMonthPositions() {
        // Loop over all the months and place them in a grid of N columns
        let N = 5
        let H = 200
        let padding = 20
        let index = 0
        commits_by_month.forEach(d => {
            d.x = (index % N) * (WIDTH / N) + padding
            d.y = Math.floor(index / N) * H
            index++
        })//forEach
    }// function determineMonthPositions

    ///////////////////////// Draw a circle /////////////////////////
    function drawCircle(context, x, y, r, SF, begin = true, stroke = false) {
        if(begin === true) context.beginPath()
        context.moveTo((x+r) * SF, y * SF)
        context.arc(x * SF, y * SF, r * SF, 0, TAU)
        if(begin && !stroke) context.fill()
        else if(begin && stroke) context.stroke()
    }//function drawCircle


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
            } else {
                HOVER_ACTIVE = false
                HOVERED_NODE = null
            }// else

        })// on mousemove

    }// function setupHover

    /////////////////////////////////////////////////////////////////
    //////////////////////// Click Functions ////////////////////////
    /////////////////////////////////////////////////////////////////


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

    /////////////////////////////////////////////////////////////////
    ///////////////////////// Text Functions ////////////////////////
    /////////////////////////////////////////////////////////////////


    /////////////////////////////////////////////////////////////////
    ///////////////////////// Font Functions ////////////////////////
    /////////////////////////////////////////////////////////////////

    //////////////////// Different Font Settings ////////////////////
    function setFont(context, font_size, font_weight, font_style = "normal") {
        context.font = `${font_weight} ${font_style} ${font_size}px ${FONT_FAMILY}`
    }//function setFont

    function setContributorFont(context, SF = 1, font_size = 13) {
        setFont(context, font_size * SF, 700, "italic")
    }//function setContributorFont

    ////////////// Add tracking (space) between letters /////////////
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
    
    /////////////////////////////////////////////////////////////////
    //////////////////////// Helper Functions ///////////////////////
    /////////////////////////////////////////////////////////////////

    function mod (x, n) { return ((x % n) + n) % n }

    function sq(x) { return x * x }

    //Phyllotaxis settings
    //https://observablehq.com/@fil/phyllotaxis-explained
    //https://observablehq.com/@mbostock/circle-packing-methods
    const theta = TAU / ((1 + sqrt(5)) / 2) //pi2 / (1 + (1 + Math.sqrt(5)) / 2) // Math.PI * (3 - Math.sqrt(5))

    function phyllotaxis(index, angle, padding) {
        const r = (radius + padding) * 1.2 * sqrt(index + 0.5)
        const a = index * angle
        return [r * cos(a), r * sin(a)]
    }//function phyllotaxis

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
