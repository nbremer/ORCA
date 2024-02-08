// FINAL: Update GitHub explanation 
// TODO: webworker for the simulations

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

    // Grid
    let COLS_TOTAL

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
    let width = 1500
    let height = 2500
    let WIDTH
    let HEIGHT
    let MARGIN = {width: 0, height: 0}, W, H
    let PIXEL_RATIO

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
        .range([2, 12, 16])
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
        // Find the positions of each month's circle
        determineMonthPositions()

        /////////////////////////////////////////////////////////////
        // Fill the background with a color
        context.fillStyle = COLOR_BACKGROUND
        context.fillRect(0, 0, WIDTH, HEIGHT)

        context.save()
        context.translate(MARGIN.width, MARGIN.height)

        // Draw a line behind the circles to show how time connects them all

        // Draw the months and the commits within
        commits_by_month.forEach((d, i) => {
            // Draw the month circle
            context.fillStyle = COLOR_BACKGROUND
            context.shadowBlur = 10
            context.shadowColor = "#d4d2ce"
            drawCircle(context, d.x, d.y, d.r, true, false)
            context.shadowBlur = 0

            // Draw the commit circles
            d.values.forEach(n => {
                // Draw the commits
                context.fillStyle = scale_color(n.files_changed)
                drawCircle(context, n.x + d.x, n.y + d.y, n.radius, true, false)
            })// forEach

        })//forEach

        context.restore()
    }// function draw

    /////////////////////////////////////////////////////////////////
    //////////////////////// Resize the chart ///////////////////////
    /////////////////////////////////////////////////////////////////
    chart.resize = () => {
        // Screen pixel ratio
        PIXEL_RATIO = window.devicePixelRatio

        WIDTH = round(width * PIXEL_RATIO)
        HEIGHT = round(height * PIXEL_RATIO)
        MARGIN.width = WIDTH * 0.05
        MARGIN.height = WIDTH * 0.05
        W = WIDTH - 2 * MARGIN.width
        // H = HEIGHT - 2 * MARGIN.height

        sizeCanvas(canvas, context)

        // Size the canvas
        function sizeCanvas(canvas, context) {
            canvas.width = WIDTH
            canvas.height = HEIGHT
            canvas.style.width = `${width}px`
            canvas.style.height = `${height}px`

            // Some canvas settings
            context.lineJoin = "round" 
            context.lineCap = "round"
        }// function sizeCanvas

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

        // Find quantile numbers of the number of lines changed
        let QUANTILE90 = d3.quantile(commits.filter(d => d.lines_changed > 0), 0.90, d => d.lines_changed)
        let QUANTILE99 = d3.quantile(commits.filter(d => d.lines_changed > 0), 0.99, d => d.lines_changed)
        // Set the radius scale
        scale_radius.domain([0, QUANTILE90, QUANTILE99])
        // console.log(scale_radius.domain())
        
        // Find quantile numbers of the number of files changed
        QUANTILE90 = d3.quantile(commits.filter(d => d.files_changed > 0), 0.90, d => d.files_changed)
        scale_color.domain([0, QUANTILE90])
        // console.log(scale_color.domain())

        // Calculate the Visual variables
        commits.forEach(d => {
            d.radius = scale_radius(d.lines_changed)
        })// forEach

        /////////////////////////////////////////////////////////////
        // Group the commits by month
        commits_by_month = d3.groups(commits, d => formatMonth(d.commit_time))

        // Loop over all the months and save some statistics
        commits_by_month.forEach((d, i) => {
            d.index = i
            d.n_commits = d.length
            d.values = d[1]

            let total_files = 0
            let total_insertions = 0
            let total_deletions = 0
            let total_changes = 0
            let authors = new Set()
            d.values.forEach(n => {
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

    /////////////////////////////////////////////////////////////////
    //////////////////////// Data Placements ////////////////////////
    /////////////////////////////////////////////////////////////////

    ////// Determine the positions of the commits within a month ////
    function determineCommitPositions() {
        //Place the children circles within each month
        commits_by_month.forEach((d, i) => {

            let padding = 1.25

            // Do a circle pack with a simulation after it
            d.values.forEach(n => { n.r = n.radius + padding + Math.random()/2 })
            d3.packSiblings(d.values)

            // TODO webworker
            // //Do a static simulation to create slightly better looking groups
            // const simulation = d3.forceSimulation(d.values)
            //     .force("center", d3.forceCenter())
            //     .force("x", d3.forceX(0).strength(0.5))
            //     .force("y", d3.forceY(0).strength(0.5))
            //     .force("collide", d3.forceCollide(n => n.radius + padding).strength(1))
            //     .stop()
            // for (let i = 0; i < 300; ++i) simulation.tick()

            //////////////// Enclosing Parent Circle ////////////////
            // With the locations of the children known, calculate the smallest enclosing circle
            d.values.forEach(n => { n.r = n.radius + 12})
            let parent_circle = d3.packEnclose(d.values)

            //Offset the children slightly so the parent circle is on the 0,0 center
            d.values.forEach(n => { 
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
        let padding = 40
        
        let along_X = 0
        let along_Y = 0
        
        let index = 0
        let row = 0
        let col = 0

        /////////////////////////////////////////////////////////////
        // Do a first loop to determine which row and column each month circle is in
        commits_by_month.forEach(d => {
            // If the new circle doesn't fit in the current row, go to the next row
            if(along_X + 2 * d.r > W) nextColumn()

            d.x = along_X + d.r
            d.y = along_Y

            d.row = row
            d.col = col
            col++

            along_X += 2*d.r + padding

            // If the next position is too far to the right, go to the next row
            if(along_X > W) nextColumn()

            index++
        })//forEach

        function nextColumn() {
            row++
            col = 0
            along_X = 0
            along_Y += 200 + padding
        }// function nextColumn

        COLS_TOTAL = col

        /////////////////////////////////////////////////////////////
        // Center the circles within each row
        for(let i = 0; i <= row; i++) {
            let circles = commits_by_month.filter(d => d.row === i)
            let row_width = d3.sum(circles, d => 2*d.r + padding) - padding
            let row_offset = (W - row_width) / 2
            circles.forEach(d => {
                d.x += row_offset
            })//forEach
        }//for i

        /////////////////////////////////////////////////////////////
        // Find the height offset of the first row
        let circles_top = commits_by_month.filter(d => d.row === 0)
        let largest_circle = d3.max(circles_top, d => d.r)
        let height_offset = largest_circle
        circles_top.forEach(d => {
            d.y = height_offset
        })//forEach
        
        // Set the correct height by looking at the largest circle of the current row and the one above
        for(let i = 1; i <= row; i++) {
            let circles_above = commits_by_month.filter(d => d.row === i-1)
            let circles_current = commits_by_month.filter(d => d.row === i)
            let largest_radius_above = d3.max(circles_above, d => d.r)
            let largest_radius_current = d3.max(circles_current, d => d.r)
            height_offset += largest_radius_above + padding + largest_radius_current
            circles_current.forEach(d => {
                d.y = height_offset
            })//forEach
        }//for i

    }// function determineMonthPositions

    /////////////////////////////////////////////////////////////////
    /////////////////// General Drawing Functions ///////////////////
    /////////////////////////////////////////////////////////////////

    ///////////////////////// Draw a circle /////////////////////////
    function drawCircle(context, x, y, r, begin = true, stroke = false) {
        if(begin === true) context.beginPath()
        context.moveTo((x+r), y)
        context.arc(x, y, r, 0, TAU)
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
        mx = ((mx * PIXEL_RATIO) - WIDTH / 2)
        my = ((my * PIXEL_RATIO) - HEIGHT / 2)

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

    function setContributorFont(context, font_size = 13) {
        setFont(context, font_size, 700, "italic")
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
