import numpy as np
import random

from typing import *

OUTPUT_CHARS = {0: ".", 1: "A", 2: "G", 3: "C", 4: "H"}
# OUTPUT_CHARS = {-1: ".", 0: "C", 1: "F", 2: "H", 3: "O"}


def stringify_scene(int_map):
    str_map = ""
    for row in int_map:
        row_str = "".join([OUTPUT_CHARS[c] for c in row]) + "\n"
        str_map += row_str
    return str_map


# TODO - map not guaranteed to be solvable (might be okay, robot should just return unsolvable)
def add_objects_until_full(
    object_int: int,
    current_map: np.ndarray,
    total_objects_of_type: int,
    width: int,
    height: int,
) -> np.ndarray:
    """Add objects of a specified type (object_int) to the current map until there are
    total_objects_of_type there.
    """
    objects_added = 0

    while objects_added < total_objects_of_type:
        if object_int == 0:  # if we're adding cover, do it in clusters
            x, y = add_set_of_adjacent_objects(
                min(4, total_objects_of_type - objects_added), width, height, "first"
            )
        else:
            # hijack this function to just return a single number in the x and y lists
            x, y = add_set_of_adjacent_objects(1, width, height)

        for x_temp, y_temp in zip(x, y):
            if current_map[x_temp, y_temp] == 0:
                current_map[x_temp, y_temp] = object_int
                objects_added += 1

    return current_map


def add_set_of_adjacent_objects(
    num_objects: int, width: int, height: int, adjacency: str = "last"
) -> Tuple[list, list]:
    """Return a set of positions that are adjacent to each other to add a set of objects.
    Adjacency = "last" calculates next object based on the last one added to a list
    Adjacency = "first" calculates the next object based only on the first one added to the list
    """
    assert adjacency in ["last", "first"]

    if adjacency == "last":
        idx = -1
    elif adjacency == "first":
        idx = 0

    x = []
    y = []

    # add the first object
    x.append(random.randrange(width))
    y.append(random.randrange(height))

    # this function doesn't have a sense of the map, so it shouldn't be possible for it to get stuck in this while loop here
    num_added = 1
    while num_added < num_objects:  # add objects based on position of last object
        dx = random.choice([-1, 0, 1])
        dy = random.choice([-1, 0, 1])
        x_temp = x[idx] + dx
        y_temp = y[idx] + dy
        if not (dx == 0 and dy == 0):
            if 0 <= x_temp < width and 0 <= y_temp < height:
                x.append(x_temp)
                y.append(y_temp)
                num_added += 1
    return x, y


def autogenerate_scene(
    allies=1, goals=1, covers=1, hostiles=1, ncols=6, nrows=4, cell_size=50
):
    """Automatically generate a scene with some default parameters."""

    assert covers + allies + hostiles + goals < (nrows * ncols)

    # start with a blank map
    int_map = np.zeros([nrows, ncols], dtype=int)
    int_map = add_objects_until_full(1, int_map, allies, nrows, ncols)
    int_map = add_objects_until_full(2, int_map, goals, nrows, ncols)
    int_map = add_objects_until_full(3, int_map, covers, nrows, ncols)
    int_map = add_objects_until_full(4, int_map, hostiles, nrows, ncols)

    return int_map


def write_int_map_to_chars(int_map: np.ndarray, save_filename: str):
    """Convert the stored map from an integer-based form to a char-based form
    (for readability) and save out.
    """

    # rotate to what the user sees
    int_map = np.flipud(np.rot90(int_map))
    print(save_filename)
    with open(save_filename, "w") as file:
        for line in int_map:
            for val in line:
                file.write(OUTPUT_CHARS[val])
                print(OUTPUT_CHARS[val], end="")
            print("")
            file.write("\n")
    print("")


def save_scene(int_map, save_filename):
    write_int_map_to_chars(int_map, save_filename)
