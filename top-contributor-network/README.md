# The Top Contributor Network

This visualization shows how top contributors to a specific GitHub repository (the so-called _**central repository**_) are connected to the (other) repositories that they have made commits to.

![An example of the network for mozilla/pdf.js](img/top_contributor_network_pdfjs_random_orca.png)

## Setting up the chart

**The network** depends on [**d3.js**](https://github.com/d3/d3) and two of its plugins; [**d3-delaunay**](https://github.com/d3/d3-delaunay) (for mouse hovers and clicks) and [**d3-bboxCollide**](https://github.com/emeeks/d3-bboxCollide) (for non-overlap of both the circles and textual labels). Finally, there is the custom **createORCAVisual.js** file that needs to be included.

```html
<!-- JavaScript libraries -->
<script src="lib/d3.v7.js"></script>
<script src="lib/d3-delaunay.js"></script>
<script src="lib/d3-bboxCollide.min.js"></script>

<!-- Custom JavaScript file -->
<script src="createORCAVisual.js"></script>
```

First initialize the chart. This will not yet draw anything

```js
const REPOSITORY_FULL = "mozilla/pdf.js" // The name of the central repository

// Get the div container that will hold the chart
const container = document.getElementById("chart-container")
// Get the width of the container
let width = container.offsetWidth
// You can set the height to anything you want
// But the same as the width is the default
let height = width

// Set-up the visual - Doesn't draw anything yet
// It does create the 3 canvas elements of the visual into the container element
let ORCAVisual = createORCAVisual(container)
    .width(width)
    .height(height)
    .repository(REPOSITORY_FULL)
```

Next, you read in the datasets and supply it to the function. The specifics of the four datasets are explained further down below.

```js
////////////////// Datasets to Read in //////////////////
// It requires three datasets (and two optional ones) of
// contributors (authors), repositories, links between contributors and repositories,
// and remaining contributors and possible ORCA recipients, in that order

let promises = []
promises.push(d3.csv(`data/pdfjs/top_contributors.csv`))
promises.push(d3.csv(`data/pdfjs/repositories.csv`))
promises.push(d3.csv(`data/pdfjs/links.csv`))
promises.push(d3.csv(`data/pdfjs/remaining_contributors.csv`)) // optional
promises.push(d3.csv(`data/pdfjs/orca_recipients.csv`)) // optional

// Read in the data and create the visual
Promise.all(promises).then(values => {
    ORCAVisual(values)
})//promises
```

## Data

<a href="#top_contributors" name="top_contributors">#</a> <b>top_contributors.csv</b> _[required]_

The _top_contributors.csv_ dataset contains the information about each _contributor_ that will be shown in the central part; in either of the two rings. In general this should include any contributor that has received ORCA for their involvement with the _central_ repository_, and any other contributor that you might want to add, such as those that have made many commits.

This visual is roughly optimized to show somewhere between 20-40 contributors. Including more people comes at your own risk, the visual might not look coherent anymore.

**NOTE** | **It is advised to try and group the contributors to unique (real life) people.** The same person might have made commits from multiple emails (e.g. a personal and work one) but used the exact same name (also remember to ignore capitalization). Or a person has used different names to make commits under the same email. Try to group these together as much as possible into one contributor.

This dataset requires the following fields:

* **author_name** | The name of the author / contributor.
* **repositories** | _[optional]_ | The number of repositories that this contributor has made commits to.
* **commit_sec_min** | _[optional]_ | The datetime of the first commit made by the contributor on GitHub. It can either be given as a UNIX timestamp integer or as a string in the following format `"%Y-%m-%dT%H:%M:%SZ"` (e.g. `"2014-07-31T21:09:00Z"`).
* **commit_sec_max** | _[optional]_ | The datetime of the most recent commit made by the contributor on GitHub. Should be given in the same format as _commit_sec_min_.

<a href="#repositories" name="repositories">#</a> <b>repositories.csv</b> _[required]_

The _repositories.csv_ dataset contains the information about each _repository_ that is shown in the visualization. It is a combination of the unique repositories (not forks) that all of the top contributors have made commits to.

**NOTE** | **Be very aware that this should not include (or as few as possible) forks of repositories that a contributor is connected to**. We do not want to include all the forks made of _pdf.js_ if that contributor has not made actual commits to the fork, for example. Checking the `isFork` variable of the repository with the [GitHub GraphQL API](https://docs.github.com/en/graphql/overview/explorer) doesn't always give an accurate result (but it's a start). Although not perfect, you can filter out many of the possible remaining forks by checking the most recent commit time of a contributor to a repository against the creation time of that repository. If the most recent commit was before the repository was created, that repo is a fork and the connection between the contributor and that repo should be removed.

In general, to not overload the visual, and only take those repositories into account that have been found "useful", I would advise to only include repositories with at least 30 stars. However, it is eventually up to the creator to decide which repositories to include and where to set the possible cut-off.

This dataset requires the following fields:

* **repo** | The full name of the repository, including the _owner_ (and `/` in between), such as `mozilla/pdf.js`.
* **repo_stars** | The number of stars of the repository.
* **repo_forks** | The number of forks of the repository.
* **repo_createdAt** |  The datetime of creation of the repository. It can either be given as a UNIX timestamp integer or as a string in the following format `"%Y-%m-%dT%H:%M:%SZ"` (e.g. `"2014-07-31T21:09:00Z"`).
* **repo_updatedAt** |  The datetime of the most recent commit / update of the repository. Should be given in the same format as _repo_createdAt_.
* **repo_languages** | _[optional]_ | The languages of the repository, separated by a `,` (e.g. `"JavaScript,HTML,CSS"`).

The _stars, forks_ and _languages_ fields are only used to display information about the repository when a user hovers over the repository.

<a href="#links" name="links">#</a> <b>links.csv</b> _[required]_

The _links.csv_ dataset contains the information about the connections between each top contributor and the repositories that they have made a commit to. All the contributors of this dataset should also be present in the _top_contributors.csv_ dataset, and all the repositories should be present in the _repositories.csv_ dataset.

This dataset requires the following fields:

* **author_name** | The name of the author / contributor - should match the _author_name_ field in the _top_contributors.csv_ dataset.
* **repo** | The full name of the repository, including the _owner_ (and `/` in between), such as `mozilla/pdf.js` - should match the _repo_ field in the _repositories.csv_ dataset.
* **commit_count** | The number of commits that the contributor has made to the repository.
* **commit_sec_min** | The datetime of the first commit made by the contributor to this repository. It can either be given as a UNIX timestamp integer or as a string in the following format `"%Y-%m-%dT%H:%M:%SZ"` (e.g. `"2014-07-31T21:09:00Z"`).
* **commit_sec_max** | The datetime of the most recent commit made by the contributor to this repository. Should be given in the same format as _commit_sec_min_.

<a href="#remaining_contributors" name="remaining_contributors">#</a> <b>remaining_contributors.csv</b> _[optional]_

The _remaining_contributors.csv_ dataset contains the information about the other contributors to the _central repository_ that are not already a part of the _top_contributors_ dataset.

These people are shown as "floating" circles outside of the two rings. They are not connected to any of the repositories. If you do not load this dataset, these circles are therefore not visible in the visualization.

This dataset requires the following fields:

* **author_name** | The name of the author / contributor.
* **commit_count** | The number of commits that this contributor has made to the central repository.
* **commit_sec_min** | The datetime of the first commit made by this contributor to the central repository. It can either be given as a UNIX timestamp integer or as a string in the following format `"%Y-%m-%dT%H:%M:%SZ"` (e.g. `"2014-07-31T21:09:00Z"`).
* **commit_sec_max** | The datetime of the most recent commit made by this contributor to the central repository. Should be given in the same format as _commit_sec_min_.

<a href="#orca_recipients" name="orca_recipients">#</a> <b>orca_recipients.csv</b> _[optional]_

The _orca_recipients.csv_ dataset contains the names about the (possible) contributors that have received ORCA.

This dataset has the following fields:

* **name** | The name of the author / contributor that received ORCA - should match their _author_name_ in the _top_contributors.csv_ dataset.
* **contribution** | _[optional]_ | A short description of the contribution of the ORCA recipient to the repository.

## API Reference

<a href="#ORCAVisual" name="ORCAVisual">#</a> <b>createORCAVisual</b>([_container_])

Constructs the basics of the eventual visualization with the default settings. Will still require the datasets, a [_width_](#width), [_height_](#height), and [_repository_](#repository) to be set.

<a href="#repository" name="repository">#</a> <i>createORCAVisual</i>.<b>repository</b>([<i>repository</i>])

The visual needs to know which of the repositories in the _repositories.csv_ dataset is the _central repository_. This should be given as the full name of the repository, including the _owner_ (and `/` in between), such as `mozilla/pdf.js`.

```js
ORCAVisual.repository("mozilla/pdf.js")
```

This should be supplied as you set up the visual function for the first time:

```js
let ORCAVisual = createORCAVisual(container)
    .width(width)
    .height(height)
    .repository(REPOSITORY_FULL)
```

<a href="#resize" name="resize">#</a> <i>createORCAVisual</i>.<b>resize</b>()

Call this function whenever you want to resize the "canvas" of the chart, the area in which the chart is visible. You give an new [_width_](#width) and/or [_height_](#height) and next call _resize_. See below for a simple resizing example, and the _index.html_ for a slightly better example.

```js
let current_width = window.innerWidth
window.addEventListener("resize", function () {
    if(window.innerWidth !== current_width) {
        current_width = window.innerWidth
        //Decide what new sizes should be
        // .....
        // width = ....
        // height = ....
        //
        ORCAVisual
            .width(width)
            .height(height)
            .resize()
    }//if
})//on resize
```

<a href="#width" name="width">#</a> <i>createORCAVisual</i>.<b>width</b>([<i>width</i>])

Set or reset the _width_ of the chart. This should be a number. The default value is 1500px.

```js
ORCAVisual.width(1200)
```

Apart from setting the _width_ the very first time as you create the visual function, any new call to `.width()` should be accompanied by a call to [_resize_](#resize).

<a href="#height" name="height">#</a> <i>createORCAVisual</i>.<b>height</b>([<i>height</i>])

Set or reset the _height_ of the chart. This should be a number. The default value is 1500px. It is advised to keep this the same as the _width_.

```js
ORCAVisual.height(1200)
```

Apart from setting the _height_ the very first time as you create the visual function, any new call to `.height()` should be accompanied by a call to [_resize_](#resize).
