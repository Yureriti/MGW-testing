from os import path
from typing import Optional

__version__ = "0.0.0"


def set_seed(r: Optional[int] = None):
    """Set a module-wide random seed
    Typically this is used for testing purposes and replicating experiments.
    """
    import numpy as np
    import struct
    import random
    from os import urandom

    if r is None:
        r = struct.unpack("i", urandom(4))[0]

    _random_seed = int(abs(r))

    np.random.seed(_random_seed)
    random.seed(_random_seed)


def new_token() -> str:
    """Returns a unique identifier string.
    Returns
    -------
    token : string
        Unique identifier combined from datetime metadata.
    """
    from datetime import datetime

    return datetime.now().strftime("%Y%m%d_%H%M%S")


ROOT_DIR = path.dirname(path.abspath(__file__))

TOKEN = new_token()
