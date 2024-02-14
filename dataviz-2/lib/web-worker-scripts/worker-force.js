// importScripts("d3.v5.min.js")
importScripts("d3-dispatch.min.js","d3-collection.min.js","d3-quadtree.min.js","d3-timer.min.js","d3-force.min.js")

//Based on 
//https://bl.ocks.org/mbostock/01ab2e85e8727d6529d20391c0fd9a16
//https://bl.ocks.org/Fil/b2b686c42eab4599d5c5922220971e53
//http://blockbuilder.org/samccone/3a259f9be9c0c09cd7490da80c98671e

onmessage = function (event) {
    let id = event.data.id
    let circles = event.data.circles
    let padding = event.data.padding
    
    //Initialize the force simulation
    // simulation = d3.forceSimulation()
    //     .velocityDecay(0.06)
    //     .alphaDecay(1 - Math.pow(0.001, 1 / 400))
    //     .force("collide",
    //         d3.forceCollide()
    //             .radius(d => d.pack_r + Math.min(4, Math.max(2, d.pack_r * 0.1)))
    //             .strength(0.3)
    //     )
    //     .force("x", d3.forceX().x(0).strength(0.002))
    //     .force("y", d3.forceY().y(0).strength(0.002))

        //Initialize the force simulation
        let simulation = d3.forceSimulation()
            // .force("center", d3.forceCenter())
                        //     const simulation = d3.forceSimulation(d.values)
            //         // .force("center", d3.forceCenter())
            //         // .velocityDecay(0.06)
            //         .alphaDecay(1 - Math.pow(0.001, 1 / 200))
            //         .force("x", d3.forceX(0).strength(0.02))
            //         .force("y", d3.forceY(0).strength(0.02))
            //         .force("collide", d3.forceCollide(n => n.radius + PADDING).strength(1))
            //         .stop()
            //     for (let i = 0; i < 200; ++i) simulation.tick()
            // .alphaDecay(1 - Math.pow(0.001, 1 / 200))
            .force("x", d3.forceX(0).strength(0.02))
            .force("y", d3.forceY(0).strength(0.02))
            .force("collide", d3.forceCollide(n => n.radius + padding).strength(0.3))
            .stop()

        //Perform the simulation
        simulation
            .nodes(circles)
            .stop()

        //Manually "tick" through the network
        for (let i = 0; i < 300; ++i) {
            simulation.tick()
            //Ramp up collision strength to provide smooth transition
            simulation.force("collide").strength(Math.min(0.9, 0.3 + Math.pow(i / 90, 2) * 0.7))
        }//for i
        

    postMessage({ id: id, circles: circles })
}