# ManeuverGameWeb

### Install

> This codebase is being developed and tested under Python 3.10.

For deployment:

    pip install .

For development

    pip install -e .

### Running

For deployment:

    # from root directory
    >> hypercorn src/webapp/server.py

For development:

    # from root directory
    >> python src/webapp/server.py

Now, navigate to `localhost:8000` on your browser. Be sure to tunnel your ports if the codebase is on a remote server (e.g., MITSC, LLSC).

### Usage

ManeuverGameWeb is a web application with several endpoints, each corresponding to a fundamental TERRAA component.

> Note: Be sure to have an active internet connection to pull the JavaScript libraries when the page loads.

#### Main Menu

Click the TERRAA Logo at any point to return to the main menu.

#### Cartographer

Create a scene manually or autogenerate. You can save the scene to a file on your local machine. The file can be used in `Cartographer` or `Control Room`.

#### Control Room

Load a scene file and create trajectories for each `Ally` asset (blue circle) on the scene.

> This endpoint is under active development!

##### Steps

1. Upload a scene file.

2. Click the red Recording button in the `Media Controls` penel below the rendered scene.

3. Click on any given `Ally` asset, either on the scene or in the `Action Table`.

4. Choose an action to take from the `Asset Controls` panel.

> Note: demos are not currently being saved persistently.

##### Miscallaneous

-   You must be by a `Cover` asset (e.g., gray squares) to toggle into Cover state.
-   An asset in `cover mode` cannot move
-   You will only be in true `cover mode` (i.e., undetected) if a `Cover` asset is between the `Ally` asset and each `Hostile` (red diamond) asset's Line of Sight.
-   You can scrub back-and-forth each action's actions and state over time by clicking through the `Action Table`.
-   You can erase action histories on a per asset (row) and/or time step (column) basis
-   Hover over the various buttons to see a tooltip.
-   The `Asset Control` buttons are mapped to keyboard keys (see tooltips).
