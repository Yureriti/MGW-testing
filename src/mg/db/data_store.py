import os
import json

from abc import ABC, abstractmethod


from mg import ROOT_DIR


class BaseDataStore(ABC):
    _DATA_DIR_NAME = "data"
    _DATA_DIR = os.path.join(ROOT_DIR, _DATA_DIR_NAME)

    @abstractmethod
    def save(self, src, data, fname=None):
        """save a file"""

    @abstractmethod
    def load(self, src, fname):
        """load a stored file"""


class SceneDataStore(BaseDataStore):
    extension = "txt"

    def save(self, src, data, fname=None):
        if fname is None:
            idx = 1337  # should be read from data directory
            fname = f"{src}-sample-{idx}.{self.extension}"
        fpath = os.path.join(self._DATA_DIR, src, fname)
        with open(fpath, "w") as f:
            f.write(data)

    def load(self, src, fname):
        fpath = os.path.join(self._DATA_DIR, src, fname)

        with open(fpath, "r") as f:
            return f.read()


class TrajectoryDataStore(BaseDataStore):
    extension = "json"

    def save(self, src, data, fname=None):
        if fname is None:
            idx = 1337  # should be read from data directory
            fname = f"{src}-sample-{idx}.{self.extension}"
        fpath = os.path.join(self._DATA_DIR, src, fname)
        with open(fpath, "w") as f:
            json.dump(data, f, indent=2)

    def load(self, src, fname):
        fpath = os.path.join(self._DATA_DIR, src, fname)
        with open(fpath, "r") as f:
            return json.load(f)

    def format(self):
        # TODO: format as a pandas dataframe to match original MG
        pass


class DataStore(BaseDataStore):

    _DS_MAP = {"trajectories": TrajectoryDataStore(), "scenes": SceneDataStore()}

    def __init__(self):
        pass

    def save(self, src, data, fname=None):
        """
        src = { scenes, trajectories }
        """
        try:
            self._DS_MAP[src].save(src, data, fname)
        except:
            raise

    def load(self, src, fname):
        try:
            return self._DS_MAP[src].load(src, fname)
        except:
            raise
